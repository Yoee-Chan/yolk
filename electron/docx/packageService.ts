import JSZip from 'jszip'
import {promises as fs} from 'fs'
import path from 'path'
import type {DocxImportResult, DocxPackage, SerializableDocxImportResult, DocumentOperation} from './types'
import {parseXml, serializeXml} from './xmlUtils'
import {hashBytes} from './valueUtils'
import {createYolkDocument} from './documentModel'
import {applyDocumentOperation} from './operations'
import {parseAiOperationBatch, validateAiOperations} from './aiOperations'

function isXmlEntry(name: string): boolean { return name.endsWith('.xml') || name.endsWith('.rels') }
function parsedPart(entries: Map<string, Uint8Array>, name: string) { const bytes = entries.get(name); return bytes ? parseXml(bytes) : undefined }

export async function loadDocxPackage(filePath: string): Promise<DocxPackage> {
    const bytes = await fs.readFile(filePath)
    const zip = await JSZip.loadAsync(bytes)
    const entries = new Map<string, Uint8Array>()
    for (const name of Object.keys(zip.files)) entries.set(name, await zip.files[name].async('uint8array'))
    const document = parsedPart(entries, 'word/document.xml')
    if (!document) throw new Error('DOCX 中缺少 word/document.xml')
    const parsedNames = new Set(['word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels', '[Content_Types].xml'])
    const headers = new Map<string, ReturnType<typeof parseXml>>()
    const footers = new Map<string, ReturnType<typeof parseXml>>()
    for (const name of entries.keys()) {
        if (name.startsWith('word/header') && isXmlEntry(name)) { const part = parsedPart(entries, name); if (part) headers.set(name, part); parsedNames.add(name) }
        else if (name.startsWith('word/footer') && isXmlEntry(name)) { const part = parsedPart(entries, name); if (part) footers.set(name, part); parsedNames.add(name) }
    }
    const unknown = new Map<string, Uint8Array>()
    for (const [name, value] of entries) if (!parsedNames.has(name)) unknown.set(name, value)
    return {originalFileName: path.basename(filePath), entries, parts: {document, styles: parsedPart(entries, 'word/styles.xml'), numbering: parsedPart(entries, 'word/numbering.xml'), relationships: parsedPart(entries, 'word/_rels/document.xml.rels'), contentTypes: parsedPart(entries, '[Content_Types].xml'), headers, footers, unknown}}
}

export async function importDocxPackage(filePath: string): Promise<DocxImportResult> {
    const sourcePackage = await loadDocxPackage(filePath)
    const document = createYolkDocument(sourcePackage)
    const documentBytes = sourcePackage.entries.get('word/document.xml') || new Uint8Array()
    return {fileName: sourcePackage.originalFileName, html: document.html, packageEntries: [...sourcePackage.entries.keys()], documentXml: Buffer.from(documentBytes).toString('utf8'), document, entryHashes: Object.fromEntries([...sourcePackage.entries].map(([name, value]) => [name, hashBytes(value)]))}
}

export function toSerializableImportResult(result: DocxImportResult): SerializableDocxImportResult {
    const {sourcePackage, ...document} = result.document
    return {...result, document: {...document, sourcePackage: {originalFileName: sourcePackage.originalFileName, entryNames: [...sourcePackage.entries.keys()]}}}
}

function safeEntryPath(packageDirectory: string, entryName: string): string {
    const normalized = entryName.replace(/\\/g, '/')
    if (normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error(`DOCX 包含不安全的 ZIP 条目：${entryName}`)
    return normalized.split('/').reduce((current, segment) => path.join(current, segment), packageDirectory)
}

export async function persistDocxPackage(filePath: string, targetPath: string, imported?: DocxImportResult): Promise<void> {
    const articleDirectory = path.dirname(targetPath)
    const packageDirectory = path.join(articleDirectory, 'package')
    const result = imported || await importDocxPackage(filePath)
    await fs.mkdir(articleDirectory, {recursive: true})
    await fs.copyFile(filePath, targetPath)
    for (const [entryName, bytes] of result.document.sourcePackage.entries) {
        if (entryName.endsWith('/')) continue
        const entryPath = safeEntryPath(packageDirectory, entryName)
        await fs.mkdir(path.dirname(entryPath), {recursive: true})
        await fs.writeFile(entryPath, bytes)
    }
    await fs.writeFile(path.join(articleDirectory, 'document.json'), JSON.stringify(toSerializableImportResult(result).document, null, 2), 'utf8')
    await fs.writeFile(path.join(articleDirectory, 'entry-hashes.json'), JSON.stringify(result.entryHashes, null, 2), 'utf8')
}

export async function cloneDocxPackage(filePath: string): Promise<Uint8Array> {
    const sourcePackage = await loadDocxPackage(filePath)
    const zip = new JSZip()
    for (const [name, bytes] of sourcePackage.entries) zip.file(name, bytes)
    return zip.generateAsync({type: 'uint8array', compression: 'STORE'})
}

export async function applyDocxOperations(filePath: string, targetPath: string, input: unknown): Promise<{changedParagraphIds: string[]; operationCount: number}> {
    const sourcePackage = await loadDocxPackage(filePath)
    const document = createYolkDocument(sourcePackage)
    const batch = parseAiOperationBatch(input)
    const validationErrors = validateAiOperations(document, batch.operations)
    if (validationErrors.length) throw new Error(validationErrors.map(error => `${error.index + 1}. ${error.message}`).join('; '))
    const changedParagraphIds: string[] = []
    for (const operation of batch.operations) {
        const result = applyDocumentOperation(document, operation)
        if (result.changedParagraphId) changedParagraphIds.push(result.changedParagraphId)
    }
    const zip = new JSZip()
    const serializedParts = new Map<string, Uint8Array>([['word/document.xml', serializeXml(sourcePackage.parts.document)]])
    if (sourcePackage.parts.relationships) serializedParts.set('word/_rels/document.xml.rels', serializeXml(sourcePackage.parts.relationships))
    if (sourcePackage.parts.contentTypes) serializedParts.set('[Content_Types].xml', serializeXml(sourcePackage.parts.contentTypes))
    for (const [name, bytes] of sourcePackage.entries) zip.file(name, serializedParts.get(name) || bytes)
    const output = await zip.generateAsync({type: 'nodebuffer', compression: 'STORE'})
    await validateDocxBytes(output)
    await fs.writeFile(targetPath, output)
    return {changedParagraphIds: [...new Set(changedParagraphIds)], operationCount: batch.operations.length}
}

const requiredDocxEntries = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']

export async function validateDocxBytes(bytes: Uint8Array): Promise<{entryNames: string[]; entryHashes: Record<string, string>}> {
    const zip = await JSZip.loadAsync(bytes)
    const names = Object.keys(zip.files).filter(name => !zip.files[name].dir)
    const missing = requiredDocxEntries.filter(name => !zip.files[name])
    if (missing.length) throw new Error(`DOCX 缺少必需部件：${missing.join(', ')}`)
    const hashes: Record<string, string> = {}
    for (const name of names) {
        const entry = await zip.files[name].async('uint8array')
        hashes[name] = hashBytes(entry)
        if (name.endsWith('.xml') || name.endsWith('.rels')) {
            const parsed = parseXml(entry)
            if (parsed.getElementsByTagName('parsererror').length) throw new Error(`DOCX XML 无法解析：${name}`)
        }
    }
    return {entryNames: names, entryHashes: hashes}
}

export async function validateDocxFile(filePath: string): Promise<{entryNames: string[]; entryHashes: Record<string, string>}> {
    return validateDocxBytes(await fs.readFile(filePath))
}

export async function compareDocxEntries(sourcePath: string, targetPath: string): Promise<{unchanged: string[]; changed: string[]; added: string[]; removed: string[]}> {
    const source = await validateDocxFile(sourcePath)
    const target = await validateDocxFile(targetPath)
    const sourceNames = new Set(source.entryNames)
    const targetNames = new Set(target.entryNames)
    const unchanged: string[] = []; const changed: string[] = []; const added: string[] = []; const removed: string[] = []
    for (const name of sourceNames) {
        if (!targetNames.has(name)) { removed.push(name); continue }
        if (source.entryHashes[name] === target.entryHashes[name]) unchanged.push(name); else changed.push(name)
    }
    for (const name of targetNames) if (!sourceNames.has(name)) added.push(name)
    return {unchanged, changed, added, removed}
}

export async function reimportAndVerifyDocx(filePath: string): Promise<{valid: boolean; document: DocxImportResult; validation: {entryNames: string[]; entryHashes: Record<string, string>}}> {
    const validation = await validateDocxFile(filePath)
    const document = await importDocxPackage(filePath)
    return {valid: validation.entryNames.includes('word/document.xml'), document, validation}
}
