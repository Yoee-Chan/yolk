import type {DocumentOperation, OperationPreview, OperationResult, ParagraphBlock, ParagraphProperties, RunProperties, TextRun, YolkDocument} from './types'
import type {XmlDocument, XmlElement} from './xmlUtils'
import {REL_NS, WORD_NS, XML_NS} from './constants'
import {childElements, descendants, serializer} from './xmlUtils'
import {refreshProjection} from './projection'

function paragraphText(block: ParagraphBlock): string {
    return block.runs.map(run => run.text).join('')
}

function createElement(document: XmlDocument, name: string, value?: string): XmlElement {
    const element = document.createElementNS(WORD_NS, `w:${name}`)
    if (value !== undefined) element.setAttributeNS(WORD_NS, 'w:val', value)
    return element
}

function createDrawing(document: XmlDocument, relationshipId: string, width: number, height: number): XmlElement {
    const drawing = document.createElementNS(WORD_NS, 'w:drawing')
    const inline = document.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:inline')
    const extent = document.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:extent')
    extent.setAttribute('cx', String(width)); extent.setAttribute('cy', String(height))
    const graphic = document.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:graphic')
    const graphicData = document.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:graphicData')
    graphicData.setAttribute('uri', 'http://schemas.openxmlformats.org/drawingml/2006/picture')
    const picture = document.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:pic')
    const blipFill = document.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:blipFill')
    const blip = document.createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:blip')
    blip.setAttributeNS(REL_NS, 'r:embed', relationshipId)
    blipFill.appendChild(blip); picture.appendChild(blipFill); graphicData.appendChild(picture); graphic.appendChild(graphicData); inline.appendChild(extent); inline.appendChild(graphic); drawing.appendChild(inline)
    return drawing
}

function nextRelationshipId(document: XmlDocument): string {
    const ids = descendants(document, 'Relationship').map(item => item.getAttribute('Id') || '').map(value => Number(value.replace(/^rId/, ''))).filter(Number.isFinite)
    return `rId${Math.max(0, ...ids) + 1}`
}

function cloneProperties(document: XmlDocument, properties: RunProperties): XmlElement | null {
    const result = createElement(document, 'rPr')
    const add = (name: string, value?: string) => {
        if (value === undefined || value === '') return
        result.appendChild(createElement(document, name, value))
    }
    if (properties.bold) result.appendChild(createElement(document, 'b'))
    if (properties.italic) result.appendChild(createElement(document, 'i'))
    if (properties.underline) add('u', String(properties.underline))
    if (properties.strike) result.appendChild(createElement(document, 'strike'))
    if (properties.color) add('color', String(properties.color).replace(/^#/, ''))
    if (properties.fontSize) add('sz', String(Math.round(Number(properties.fontSize) * 2)))
    if (properties.fontFamily) {
        const fonts = createElement(document, 'rFonts')
        for (const name of ['ascii', 'hAnsi', 'eastAsia', 'cs']) fonts.setAttributeNS(WORD_NS, `w:${name}`, String(properties.fontFamily))
        result.appendChild(fonts)
    }
    return result.childNodes.length ? result : null
}

function makeRunElement(document: XmlDocument, run: TextRun, text: string): XmlElement {
    const element = createElement(document, 'r')
    const properties = cloneProperties(document, run.properties)
    if (properties) element.appendChild(properties)
    const textElement = createElement(document, 't')
    if (/^\s|\s$/.test(text)) textElement.setAttributeNS(XML_NS, 'xml:space', 'preserve')
    textElement.appendChild(document.createTextNode(text))
    element.appendChild(textElement)
    return element
}

function findParagraphElement(document: XmlDocument, block: ParagraphBlock): XmlElement {
    const paragraphs = descendants(document, 'p')
    const paragraphNumber = Number(block.id.match(/paragraph-(\d+)/)?.[1] || 0)
    const match = paragraphs[paragraphNumber - 1]
    if (!match) throw new Error(`找不到段落源节点：${block.id}`)
    return match
}

function writeParagraphRuns(document: XmlDocument, block: ParagraphBlock): void {
    const paragraph = findParagraphElement(document, block)
    childElements(paragraph, 'r').forEach(run => paragraph.removeChild(run))
    const paragraphProperties = childElements(paragraph, 'pPr')[0]
    const insertionPoint = paragraphProperties?.nextSibling || null
    block.runs.forEach(run => paragraph.insertBefore(makeRunElement(document, run, run.text), insertionPoint))
    block.rawXml = serializer.serializeToString(paragraph)
    block.dirty = true
}

function refreshMappings(block: ParagraphBlock): void {
    let displayOffset = 0
    block.runs.forEach(run => {
        run.mappings = [{displayStart: displayOffset, displayEnd: displayOffset + run.text.length, runId: run.id, sourceTextNodePath: `${run.source.xmlPath}/w:t[1]`, sourceStart: 0, sourceEnd: run.text.length}]
        displayOffset += run.text.length
    })
}

function splitRuns(block: ParagraphBlock, start: number, end: number, update: (run: TextRun, selected: string) => TextRun): void {
    let offset = 0
    const nextRuns: TextRun[] = []
    block.runs.forEach((run, index) => {
        const runStart = offset
        const runEnd = offset + run.text.length
        const localStart = Math.max(0, start - runStart)
        const localEnd = Math.min(run.text.length, end - runStart)
        if (localStart >= localEnd) {
            nextRuns.push(run)
        } else {
            const before = run.text.slice(0, localStart)
            const selected = run.text.slice(localStart, localEnd)
            const after = run.text.slice(localEnd)
            if (before) nextRuns.push({...run, id: `${run.id}-before-${index}`, text: before, dirty: true})
            nextRuns.push(update({...run, id: `${run.id}-selected-${index}`, text: selected, dirty: true}, selected))
            if (after) nextRuns.push({...run, id: `${run.id}-after-${index}`, text: after, dirty: true})
        }
        offset = runEnd
    })
    block.runs = nextRuns
    refreshMappings(block)
}

function updateParagraphProperties(document: XmlDocument, block: ParagraphBlock, formatting: Partial<ParagraphProperties>): void {
    const paragraph = findParagraphElement(document, block)
    let properties = childElements(paragraph, 'pPr')[0]
    if (!properties) {
        properties = createElement(document, 'pPr')
        paragraph.insertBefore(properties, paragraph.firstChild)
    }
    const set = (name: string, value: string | undefined) => {
        const existing = childElements(properties, name)[0]
        if (value === undefined || value === '') {
            if (existing) properties.removeChild(existing)
            return
        }
        if (existing) existing.setAttributeNS(WORD_NS, 'w:val', value)
        else properties.appendChild(createElement(document, name, value))
    }
    if ('alignment' in formatting) set('jc', formatting.alignment ? String(formatting.alignment) : undefined)
    if ('styleId' in formatting) set('pStyle', formatting.styleId ? String(formatting.styleId) : undefined)
    if ('indentLeft' in formatting || 'indentRight' in formatting || 'firstLineIndent' in formatting) {
        const indent = childElements(properties, 'ind')[0] || createElement(document, 'ind')
        if (!indent.parentNode) properties.appendChild(indent)
        if ('indentLeft' in formatting) indent.setAttributeNS(WORD_NS, 'w:left', String(formatting.indentLeft ?? 0))
        if ('indentRight' in formatting) indent.setAttributeNS(WORD_NS, 'w:right', String(formatting.indentRight ?? 0))
        if ('firstLineIndent' in formatting) indent.setAttributeNS(WORD_NS, 'w:firstLine', String(formatting.firstLineIndent ?? 0))
    }
    if ('lineSpacing' in formatting || 'spaceBefore' in formatting || 'spaceAfter' in formatting) {
        const spacing = childElements(properties, 'spacing')[0] || createElement(document, 'spacing')
        if (!spacing.parentNode) properties.appendChild(spacing)
        if ('lineSpacing' in formatting) spacing.setAttributeNS(WORD_NS, 'w:line', String(formatting.lineSpacing ?? 0))
        if ('spaceBefore' in formatting) spacing.setAttributeNS(WORD_NS, 'w:before', String(formatting.spaceBefore ?? 0))
        if ('spaceAfter' in formatting) spacing.setAttributeNS(WORD_NS, 'w:after', String(formatting.spaceAfter ?? 0))
    }
    if ('pageBreakBefore' in formatting) set('pageBreakBefore', formatting.pageBreakBefore ? '1' : undefined)
    block.rawXml = serializer.serializeToString(paragraph)
    block.dirty = true
}

function paragraphBlock(document: YolkDocument, id: string): ParagraphBlock {
    const block = document.blocks.find(item => item.type === 'paragraph' && item.id === id) as ParagraphBlock | undefined
    if (!block) throw new Error(`找不到段落：${id}`)
    return block
}

function replaceParagraphText(document: YolkDocument, operation: Extract<DocumentOperation, {type: 'replaceText'}>): OperationResult {
    const block = paragraphBlock(document, operation.paragraphId)
    const currentText = paragraphText(block)
    if (!Number.isInteger(operation.start) || !Number.isInteger(operation.end) || operation.start < 0 || operation.end < operation.start || operation.end > currentText.length) throw new Error(`段落文字范围无效：${operation.start}-${operation.end}`)
    const expected = currentText.slice(operation.start, operation.end)
    if (expected !== operation.expectedText) throw new Error(`段落文字已变化，期望“${operation.expectedText}”，实际“${expected}”`)
    const nextRuns: TextRun[] = []
    let offset = 0
    let inserted = false
    block.runs.forEach((run, index) => {
        const runStart = offset
        const runEnd = offset + run.text.length
        const before = run.text.slice(0, Math.max(0, Math.min(run.text.length, operation.start - runStart)))
        const after = run.text.slice(Math.max(0, Math.min(run.text.length, operation.end - runStart)))
        if (before) nextRuns.push({...run, id: `${run.id}-before-${index}`, text: before, dirty: true})
        if (!inserted && operation.text && operation.start >= runStart && operation.start <= runEnd) {
            nextRuns.push({...run, id: `${block.id}-run-replacement`, text: operation.text, properties: operation.formatPolicy === 'plain' ? {} : {...run.properties}, dirty: true})
            inserted = true
        }
        if (after) nextRuns.push({...run, id: `${run.id}-after-${index}`, text: after, dirty: true})
        offset = runEnd
    })
    if (!inserted && operation.text) {
        const source = block.runs[block.runs.length - 1]
        nextRuns.push({...source, id: `${block.id}-run-replacement`, text: operation.text, properties: operation.formatPolicy === 'plain' ? {} : {...(source?.properties || {})}, dirty: true})
    }
    block.runs = nextRuns
    refreshMappings(block)
    writeParagraphRuns(document.sourcePackage.parts.document, block)
    refreshProjection(document)
    return {operation, inverse: {type: 'replaceText', paragraphId: block.id, start: operation.start, end: operation.start + operation.text.length, expectedText: operation.text, text: operation.expectedText, formatPolicy: 'preserve-runs'}, changedParagraphId: block.id, diff: {before: currentText, after: paragraphText(block)}}
}

function applyRunFormatting(document: YolkDocument, operation: Extract<DocumentOperation, {type: 'applyRunFormatting'}>): OperationResult {
    const block = paragraphBlock(document, operation.paragraphId)
    const currentText = paragraphText(block)
    const selected = currentText.slice(operation.start, operation.end)
    if (selected !== operation.expectedText) throw new Error(`格式化目标文字已变化，期望“${operation.expectedText}”，实际“${selected}”`)
    const previous = block.runs.map(run => ({...run, properties: {...run.properties}}))
    splitRuns(block, operation.start, operation.end, run => ({...run, properties: {...run.properties, ...operation.formatting}}))
    writeParagraphRuns(document.sourcePackage.parts.document, block)
    refreshProjection(document)
    const inverseFormatting: Partial<RunProperties> = {}
    previous.forEach(run => Object.keys(operation.formatting).forEach(key => { inverseFormatting[key] = run.properties[key] }))
    return {operation, inverse: {type: 'applyRunFormatting', paragraphId: block.id, start: operation.start, end: operation.end, expectedText: selected, formatting: inverseFormatting}, changedParagraphId: block.id, diff: {before: selected, after: selected}}
}

function insertParagraph(document: YolkDocument, operation: Extract<DocumentOperation, {type: 'insertParagraph'}>): OperationResult {
    const anchor = paragraphBlock(document, operation.afterBlockId)
    const anchorElement = findParagraphElement(document.sourcePackage.parts.document, anchor)
    const paragraph = createElement(document.sourcePackage.parts.document, 'p')
    if (operation.paragraph.styleId) {
        const properties = createElement(document.sourcePackage.parts.document, 'pPr')
        properties.appendChild(createElement(document.sourcePackage.parts.document, 'pStyle', operation.paragraph.styleId))
        paragraph.appendChild(properties)
    }
    const run: TextRun = {id: `${operation.afterBlockId}-inserted-run`, type: 'text', text: operation.paragraph.text, properties: operation.paragraph.formatting || {}, source: {xmlPath: ''}, dirty: true, mappings: []}
    paragraph.appendChild(makeRunElement(document.sourcePackage.parts.document, run, run.text))
    anchorElement.parentNode?.insertBefore(paragraph, anchorElement.nextSibling)
    refreshProjection(document)
    const inserted = document.blocks.find(block => block.type === 'paragraph' && block.runs.some(item => item.text === operation.paragraph.text)) as ParagraphBlock | undefined
    return {operation, inverse: {type: 'deleteBlock', blockId: inserted?.id || `${operation.afterBlockId}-inserted`, expectedText: operation.paragraph.text}, changedParagraphId: inserted?.id, diff: {before: '', after: operation.paragraph.text}}
}

function deleteBlock(document: YolkDocument, operation: Extract<DocumentOperation, {type: 'deleteBlock'}>): OperationResult {
    const block = paragraphBlock(document, operation.blockId)
    const text = paragraphText(block)
    if (operation.expectedText !== undefined && operation.expectedText !== text) throw new Error(`删除目标文字已变化，期望“${operation.expectedText}”，实际“${text}”`)
    const element = findParagraphElement(document.sourcePackage.parts.document, block)
    element.parentNode?.removeChild(element)
    refreshProjection(document)
    return {operation, inverse: {type: 'insertParagraph', afterBlockId: document.blocks[0]?.id || 'paragraph-0', paragraph: {text}}, changedParagraphId: block.id, diff: {before: text, after: ''}}
}

function insertImage(document: YolkDocument, operation: Extract<DocumentOperation, {type: 'insertImage'}>): OperationResult {
    const anchor = paragraphBlock(document, operation.afterBlockId)
    const entryName = typeof document.assets[operation.assetId] === 'object' ? String((document.assets[operation.assetId] as {entryName?: unknown}).entryName || '') : operation.assetId
    if (!entryName || !document.sourcePackage.entries.has(entryName)) throw new Error(`图片资源不存在：${operation.assetId}`)
    const relationships = document.sourcePackage.parts.relationships
    if (!relationships) throw new Error('DOCX 缺少正文关系部件')
    const relationshipId = nextRelationshipId(relationships)
    const relationship = relationships.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship')
    relationship.setAttribute('Id', relationshipId)
    relationship.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image')
    relationship.setAttribute('Target', entryName.replace(/^word\//, ''))
    const relationshipsRoot = relationships.documentElement
    if (!relationshipsRoot) throw new Error('DOCX 正文关系部件缺少根节点')
    relationshipsRoot.appendChild(relationship)
    const paragraph = createElement(document.sourcePackage.parts.document, 'p')
    const run = createElement(document.sourcePackage.parts.document, 'r')
    const width = Number(operation.properties?.width || 5486400)
    const height = Number(operation.properties?.height || 3200400)
    run.appendChild(createDrawing(document.sourcePackage.parts.document, relationshipId, width, height))
    paragraph.appendChild(run)
    const anchorElement = findParagraphElement(document.sourcePackage.parts.document, anchor)
    anchorElement.parentNode?.insertBefore(paragraph, anchorElement.nextSibling)
    refreshProjection(document)
    return {operation, inverse: {type: 'deleteBlock', blockId: `${operation.afterBlockId}-image`, expectedText: ''}, changedParagraphId: anchor.id, diff: {before: '', after: `[image:${operation.assetId}]`}}
}

function setParagraphFormatting(document: YolkDocument, operation: Extract<DocumentOperation, {type: 'setParagraphFormatting'}>): OperationResult {
    const block = paragraphBlock(document, operation.paragraphId)
    const previous = {...block.properties}
    block.properties = {...block.properties, ...operation.formatting}
    if (operation.formatting.styleId !== undefined) block.styleId = String(operation.formatting.styleId)
    updateParagraphProperties(document.sourcePackage.parts.document, block, operation.formatting)
    refreshProjection(document)
    return {operation, inverse: {type: 'setParagraphFormatting', paragraphId: block.id, formatting: previous}, changedParagraphId: block.id, diff: {before: JSON.stringify(previous), after: JSON.stringify(block.properties)}}
}

export function applyDocumentOperation(document: YolkDocument, operation: DocumentOperation): OperationResult {
    switch (operation.type) {
        case 'replaceText': return replaceParagraphText(document, operation)
        case 'applyRunFormatting': return applyRunFormatting(document, operation)
        case 'setParagraphFormatting': return setParagraphFormatting(document, operation)
        case 'insertParagraph': return insertParagraph(document, operation)
        case 'deleteBlock': return deleteBlock(document, operation)
        case 'insertImage': return insertImage(document, operation)
    }
}

export function previewDocumentOperations(document: YolkDocument, operations: DocumentOperation[]): OperationPreview {
    const results: OperationResult[] = []
    const errors: OperationPreview['errors'] = []
    for (const [index, operation] of operations.entries()) {
        try { results.push(applyDocumentOperation(document, operation)) } catch (error) { errors.push({index, message: error instanceof Error ? error.message : String(error)}) }
    }
    return {operations, results, errors}
}

export class DocumentOperationHistory {
    private undoStack: DocumentOperation[] = []
    private redoStack: DocumentOperation[] = []
    apply(document: YolkDocument, operation: DocumentOperation): OperationResult { const result = applyDocumentOperation(document, operation); this.undoStack.push(result.inverse); this.redoStack = []; return result }
    undo(document: YolkDocument): OperationResult | null { const operation = this.undoStack.pop(); if (!operation) return null; const result = applyDocumentOperation(document, operation); this.redoStack.push(result.inverse); return result }
    redo(document: YolkDocument): OperationResult | null { const operation = this.redoStack.pop(); if (!operation) return null; const result = applyDocumentOperation(document, operation); this.undoStack.push(result.inverse); return result }
}

export function documentText(document: YolkDocument): string { return document.blocks.filter((block): block is ParagraphBlock => block.type === 'paragraph').map(paragraphText).join('\n') }

export function parseFormattingStyle(value: unknown): Partial<RunProperties> {
    if (!value || typeof value !== 'object') return {}
    const input = value as Record<string, unknown>
    return Object.fromEntries(Object.entries(input).filter(([key]) => ['bold', 'italic', 'underline', 'strike', 'color', 'fontSize', 'fontFamily'].includes(key))) as Partial<RunProperties>
}

export function parseParagraphStyle(value: unknown): Partial<ParagraphProperties> {
    if (!value || typeof value !== 'object') return {}
    const input = value as Record<string, unknown>
    return Object.fromEntries(Object.entries(input).filter(([key]) => ['alignment', 'styleId', 'indentLeft', 'indentRight', 'firstLineIndent', 'lineSpacing', 'spaceBefore', 'spaceAfter', 'pageBreakBefore'].includes(key))) as Partial<ParagraphProperties>
}
