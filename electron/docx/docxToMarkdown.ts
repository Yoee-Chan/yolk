import JSZip from 'jszip'
import {DOMParser, type Node as XmlNode, type Element as XmlElement, type Document as XmlDocument} from '@xmldom/xmldom'
import {promises as fs} from 'fs'
import path from 'path'

type Relationship = {target: string; type: string}
type ConvertedDocument = {markdown: string; displayMarkdown: string; title: string; outline: Array<{level: number; text: string}>; sourceName: string}

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const parser = new DOMParser()

function localName(node: any): string { return (node as XmlElement).localName || node.nodeName.split(':').pop() || node.nodeName }
function children(node: any, name: string): XmlElement[] { return Array.from((node?.childNodes ?? []) as XmlNode[]).filter((child) => child.nodeType === 1 && localName(child) === name) as XmlElement[] }
function descendants(node: any, name: string): XmlElement[] {
    const result: XmlElement[] = []
    const visit = (current: any) => { Array.from((current?.childNodes ?? []) as XmlNode[]).forEach((child) => { if (child.nodeType !== 1) return; if (localName(child) === name) result.push(child as XmlElement); visit(child) }) }
    visit(node)
    return result
}
function attr(node: any, name: string, namespace = WORD_NS): string { return node?.getAttributeNS?.(namespace, name) || node?.getAttribute?.(`w:${name}`) || node?.getAttribute?.(name) || '' }
function escapeMarkdown(value: string): string { return value.replace(/([\\`*_[\]#])/g, '\\$1') }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char] || char)) }

function readRelationships(xml: string): Map<string, Relationship> {
    const document = parser.parseFromString(xml, 'text/xml')
    const relationships = new Map<string, Relationship>()
    Array.from(document.documentElement?.childNodes || []).forEach((node) => {
        if (node.nodeType !== 1 || localName(node) !== 'Relationship') return
        const item = node as XmlElement
        const id = item.getAttribute('Id')
        const target = item.getAttribute('Target')
        const type = item.getAttribute('Type') || ''
        if (id && target) relationships.set(id, {target, type})
    })
    return relationships
}

function headingLevel(styleId: string, outlineLevel: string): number {
    if (outlineLevel !== '' && Number.isFinite(Number(outlineLevel))) return Math.min(6, Number(outlineLevel) + 1)
    const normalized = styleId.replace(/[\s_-]/g, '').toLowerCase()
    const match = normalized.match(/(?:heading|标题|h)(\d+)/)
    if (!match) return 0
    return Math.min(6, Number(match[1]))
}

function runText(run: XmlElement): string {
    return descendants(run, 't').map((node) => node.textContent || '').join('')
        + '\t'.repeat(descendants(run, 'tab').length)
        + '\n'.repeat(descendants(run, 'br').length + descendants(run, 'cr').length)
}

function formatRun(run: XmlElement): string {
    let value = escapeMarkdown(runText(run))
    const properties = descendants(run, 'rPr')[0]
    if (!properties) return value
    if (descendants(properties, 'b').length) value = `**${value}**`
    if (descendants(properties, 'i').length) value = `*${value}*`
    if (descendants(properties, 'u').length) value = `<u>${value}</u>`
    if (descendants(properties, 'strike').length) value = `<s>${value}</s>`
    const color = attr(descendants(properties, 'color')[0], 'val')
    const size = attr(descendants(properties, 'sz')[0], 'val')
    const font = attr(descendants(properties, 'rFonts')[0], 'eastAsia') || attr(descendants(properties, 'rFonts')[0], 'ascii')
    const styles = [color && color !== 'auto' ? `color:#${color}` : '', size ? `font-size:${Number(size) / 2}pt` : '', font ? `font-family:${font}` : ''].filter(Boolean)
    return styles.length ? `<span style="${styles.join(';')}">${value}</span>` : value
}

function paragraphMarkdown(paragraph: XmlElement, relationships: Map<string, Relationship>, media: Map<string, string>): {text: string; level: number} {
    const properties = children(paragraph, 'pPr')[0]
    const styleId = attr(children(properties, 'pStyle')[0], 'val')
    const level = headingLevel(styleId, attr(children(properties, 'outlineLvl')[0], 'val'))
    let text = descendants(paragraph, 'r').map((run) => {
        const drawing = descendants(run, 'blip')[0] || descendants(run, 'imagedata')[0]
        const relationshipId = drawing?.getAttributeNS(REL_NS, 'embed') || drawing?.getAttribute('r:embed') || drawing?.getAttribute('r:id') || ''
        if (relationshipId) {
            const relationship = relationships.get(relationshipId)
            const fileName = relationship && media.get(relationship.target.replace(/^\.\//, ''))
            if (fileName) return `![图片](${fileName})`
        }
        return formatRun(run)
    }).join('')
    const alignment = attr(children(properties, 'jc')[0], 'val')
    if (alignment === 'center') text = `<div align="center">${text}</div>`
    if (alignment === 'right') text = `<div align="right">${text}</div>`
    return {text: text.trim(), level}
}

export async function convertDocxToMarkdown(filePath: string, workspaceDirectory: string): Promise<ConvertedDocument> {
    const sourceName = path.basename(filePath)
    const folder = path.join(workspaceDirectory, 'imports', `${Date.now()}-${sourceName.replace(/\.docx$/i, '')}`)
    const mediaDirectory = path.join(folder, 'media')
    await fs.mkdir(mediaDirectory, {recursive: true})
    const zip = await JSZip.loadAsync(await fs.readFile(filePath))
    const documentXml = await zip.file('word/document.xml')?.async('string')
    if (!documentXml) throw new Error('Word 文档缺少正文内容')
    const relationshipsXml = await zip.file('word/_rels/document.xml.rels')?.async('string') || '<Relationships/>'
    const relationships = readRelationships(relationshipsXml)
    const media = new Map<string, string>()
    for (const name of Object.keys(zip.files).filter((entry) => entry.startsWith('word/media/') && !entry.endsWith('/'))) {
        const fileName = path.basename(name)
        await fs.writeFile(path.join(mediaDirectory, fileName), await zip.file(name)!.async('nodebuffer'))
        media.set(name.replace(/^word\//, ''), `media/${fileName}`)
    }
    const document = parser.parseFromString(documentXml, 'text/xml')
    const body = descendants(document, 'body')[0]
    if (!body) throw new Error('Word 文档缺少正文内容')
    const paragraphs: Array<{text: string; level: number}> = []
    children(body, 'p').forEach((paragraph) => { const item = paragraphMarkdown(paragraph, relationships, media); if (item.text) paragraphs.push(item) })
    const markdown = paragraphs.map((item) => `${item.level ? `${'#'.repeat(item.level)} ` : ''}${item.text}`).join('\n\n') + '\n'
    const title = paragraphs.find((item) => item.level === 1)?.text.replace(/<[^>]+>/g, '').trim() || sourceName.replace(/\.docx$/i, '')
    const outline = paragraphs.filter((item) => item.level > 0).map((item) => ({level: item.level, text: item.text.replace(/<[^>]+>/g, '').trim()}))
    await fs.writeFile(path.join(folder, 'article.md'), markdown, 'utf8')
    const displayMarkdown = await hydrateImages(markdown, folder)
    await fs.writeFile(path.join(folder, 'source.docx'), await fs.readFile(filePath))
    return {markdown, displayMarkdown, title, outline, sourceName}
}

async function hydrateImages(markdown: string, folder: string): Promise<string> {
    const matches = [...markdown.matchAll(/!\[([^\]]*)\]\((media\/[^)]+)\)/g)]
    let output = markdown
    for (const match of matches) {
        const bytes = await fs.readFile(path.join(folder, match[2]))
        const extension = path.extname(match[2]).toLowerCase()
        const mime = extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : extension === '.gif' ? 'image/gif' : 'image/png'
        output = output.replace(match[0], `![${match[1]}](data:${mime};base64,${bytes.toString('base64')})`)
    }
    return output
}
