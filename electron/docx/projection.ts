import type {XmlElement, XmlNode} from './xmlUtils'
import type {XmlPart, ParagraphBlock, DocumentBlock, TextRun, TextSegmentMapping, YolkDocument, TableBlock, TableCell, ImageBlock} from './types'
import {attr, childElements, descendants, firstDescendant, localName, serializer, sourceXmlPath} from './xmlUtils'
import {escapeHtml} from './valueUtils'

function textTokens(run: XmlElement): Array<{text: string; node: XmlElement | null}> {
    const tokens: Array<{text: string; node: XmlElement | null}> = []
    const visit = (node: XmlNode) => {
        for (let child = node.firstChild; child; child = child.nextSibling) {
            if (child.nodeType !== 1) continue
            const element = child as XmlElement
            switch (localName(element)) {
                case 't': tokens.push({text: element.textContent || '', node: element}); break
                case 'tab': tokens.push({text: '\t', node: element}); break
                case 'br':
                case 'cr': tokens.push({text: '\n', node: element}); break
                default: visit(element)
            }
        }
    }
    visit(run)
    return tokens
}

function runText(run: XmlElement): string {
    return textTokens(run).map(token => token.text).join('')
}

function readRunProperties(run: XmlElement): TextRun['properties'] {
    const properties = firstDescendant(run, 'rPr')
    if (!properties) return {}
    const color = attr(firstDescendant(properties, 'color'), 'val')
    const size = Number(attr(firstDescendant(properties, 'sz'), 'val'))
    const fonts = firstDescendant(properties, 'rFonts')
    return {
        bold: Boolean(firstDescendant(properties, 'b')),
        italic: Boolean(firstDescendant(properties, 'i')),
        underline: attr(firstDescendant(properties, 'u'), 'val'),
        strike: Boolean(firstDescendant(properties, 'strike')),
        ...(color && color !== 'auto' ? {color: `#${color}`} : {}),
        ...(Number.isFinite(size) && size > 0 ? {fontSize: size / 2} : {}),
        ...(fonts ? {fontFamily: attr(fonts, 'ascii') || attr(fonts, 'eastAsia')} : {}),
    }
}

function parseParagraph(paragraph: XmlElement, index: number, sourcePath = `/w:document/w:body/w:p[${index + 1}]`, id = `paragraph-${index + 1}`): ParagraphBlock {
    const properties = firstDescendant(paragraph, 'pPr')
    const styleId = attr(firstDescendant(properties || paragraph, 'pStyle'), 'val')
    const alignment = attr(firstDescendant(properties || paragraph, 'jc'), 'val')
    const indentation = firstDescendant(properties || paragraph, 'ind')
    const spacing = firstDescendant(properties || paragraph, 'spacing')
    const numbering = firstDescendant(properties || paragraph, 'numPr')
    const paragraphProperties = {
        ...(styleId ? {styleId} : {}),
        ...(alignment ? {alignment} : {}),
        ...(attr(indentation, 'left') ? {indentLeft: Number(attr(indentation, 'left'))} : {}),
        ...(attr(indentation, 'right') ? {indentRight: Number(attr(indentation, 'right'))} : {}),
        ...(attr(indentation, 'firstLine') ? {firstLineIndent: Number(attr(indentation, 'firstLine'))} : {}),
        ...(attr(spacing, 'line') ? {lineSpacing: Number(attr(spacing, 'line'))} : {}),
        ...(attr(spacing, 'before') ? {spaceBefore: Number(attr(spacing, 'before'))} : {}),
        ...(attr(spacing, 'after') ? {spaceAfter: Number(attr(spacing, 'after'))} : {}),
        ...(firstDescendant(properties || paragraph, 'pageBreakBefore') ? {pageBreakBefore: true} : {}),
        ...(attr(firstDescendant(numbering || paragraph, 'ilvl'), 'val') ? {listLevel: Number(attr(firstDescendant(numbering || paragraph, 'ilvl'), 'val'))} : {}),
        ...(attr(firstDescendant(numbering || paragraph, 'numId'), 'val') ? {listId: attr(firstDescendant(numbering || paragraph, 'numId'), 'val')} : {}),
    }
    let displayOffset = 0
    const runs = descendants(paragraph, 'r').map((run, runIndex) => {
        const text = runText(run)
        const runId = `${id}-run-${runIndex + 1}`
        let sourceOffset = 0
        const mappings = textTokens(run).map(token => {
            const mapping: TextSegmentMapping = {
                displayStart: displayOffset + sourceOffset,
                displayEnd: displayOffset + sourceOffset + token.text.length,
                runId,
                sourceTextNodePath: token.node ? sourceXmlPath(token.node) : `${sourcePath}/w:r[${runIndex + 1}]/w:t[1]`,
                sourceStart: 0,
                sourceEnd: token.text.length,
            }
            sourceOffset += token.text.length
            return mapping
        })
        displayOffset += text.length
        return {
            id: runId,
            type: 'text' as const,
            text,
            ...(styleId ? {styleId} : {}),
            properties: readRunProperties(run),
            source: {xmlPath: `${sourcePath}/w:r[${runIndex + 1}]`},
            dirty: false,
            mappings,
        }
    })
    return {
        id,
        type: 'paragraph',
        source: {part: 'word/document.xml', xmlPath: sourcePath, paragraphId: id},
        ...(styleId ? {styleId} : {}),
        properties: paragraphProperties,
        runs,
        rawXml: serializer.serializeToString(paragraph),
        dirty: false,
    }
}

function paragraphTag(block: ParagraphBlock): string {
    const match = String(block.styleId || '').match(/(?:heading|标题)[ _-]?([1-6])/i)
    return match ? `h${match[1]}` : 'p'
}

function inlineRunHtml(run: TextRun): string {
    let value = escapeHtml(run.text).replace(/\n/g, '<br/>').replace(/\t/g, '&#9;')
    if (run.properties.bold) value = `<strong>${value}</strong>`
    if (run.properties.italic) value = `<em>${value}</em>`
    if (run.properties.underline) value = `<u>${value}</u>`
    if (run.properties.strike) value = `<s>${value}</s>`
    if (run.properties.color) value = `<span style="color:${escapeHtml(String(run.properties.color))}">${value}</span>`
    if (run.properties.fontSize) value = `<span style="font-size:${run.properties.fontSize}pt">${value}</span>`
    if (run.properties.fontFamily) value = `<span style="font-family:${escapeHtml(String(run.properties.fontFamily))}">${value}</span>`
    return `<span data-yolk-run-id="${escapeHtml(run.id)}">${value}</span>`
}

function projectTable(block: TableBlock): string {
    return `<table data-yolk-node-id="${escapeHtml(block.id)}"><tbody>${block.rows.map(row => `<tr>${row.map(cell => `<td${cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ''}${cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ''}>${cell.paragraphs.map(projectParagraph).join('')}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

function projectImage(block: ImageBlock): string {
    return `<div data-yolk-node-id="${escapeHtml(block.id)}" data-yolk-asset-id="${escapeHtml(block.assetId)}"><img alt="" data-yolk-image="true"/></div>`
}

export function projectParagraph(block: ParagraphBlock): string {
    const content = block.runs.map(inlineRunHtml).join('') || '&nbsp;'
    const style = block.styleId ? ` data-yolk-style-id="${escapeHtml(block.styleId)}"` : ''
    const css = [
        block.properties.alignment ? `text-align:${escapeHtml(String(block.properties.alignment))}` : '',
        block.properties.indentLeft ? `padding-left:${Number(block.properties.indentLeft) / 20}pt` : '',
        block.properties.indentRight ? `padding-right:${Number(block.properties.indentRight) / 20}pt` : '',
        block.properties.firstLineIndent ? `text-indent:${Number(block.properties.firstLineIndent) / 20}pt` : '',
        block.properties.lineSpacing ? `line-height:${Number(block.properties.lineSpacing) / 240}` : '',
        block.properties.spaceBefore ? `margin-top:${Number(block.properties.spaceBefore) / 20}pt` : '',
        block.properties.spaceAfter ? `margin-bottom:${Number(block.properties.spaceAfter) / 20}pt` : '',
        block.properties.pageBreakBefore ? 'break-before:page' : '',
    ].filter(Boolean).join(';')
    const inlineStyle = css ? ` style="${escapeHtml(css)}"` : ''
    const tag = paragraphTag(block)
    const listAttributes = block.properties.listId ? ` data-yolk-list-id="${escapeHtml(String(block.properties.listId))}" data-yolk-list-level="${Number(block.properties.listLevel || 0)}"` : ''
    return `<${tag} data-yolk-node-id="${escapeHtml(block.id)}"${style}${listAttributes}${inlineStyle}>${content}</${tag}>`
}

function parseTable(table: XmlElement, tableIndex: number, paragraphCounter: {value: number}): TableBlock {
    const rows: TableCell[][] = childElements(table, 'tr').map((row, rowIndex) => childElements(row, 'tc').map((cell, cellIndex) => {
        const cellPath = sourceXmlPath(cell)
        const cellProperties = firstDescendant(cell, 'tcPr')
        const gridSpan = Number(attr(firstDescendant(cellProperties || cell, 'gridSpan'), 'val') || 1)
        const vMerge = attr(firstDescendant(cellProperties || cell, 'vMerge'), 'val')
        let rowSpan = 1
        if (vMerge === 'restart') {
            for (let nextRow = rowIndex + 1; nextRow < childElements(table, 'tr').length; nextRow += 1) {
                const nextCell = childElements(childElements(table, 'tr')[nextRow], 'tc')[cellIndex]
                if (!nextCell || !firstDescendant(firstDescendant(nextCell, 'tcPr') || nextCell, 'vMerge')) break
                rowSpan += 1
            }
        }
        const paragraphs = childElements(cell, 'p').map((paragraph) => {
            const index = paragraphCounter.value++
            return parseParagraph(paragraph, index, `${cellPath}/w:p[${index + 1}]`, `table-${tableIndex + 1}-row-${rowIndex + 1}-cell-${cellIndex + 1}-paragraph-${index + 1}`)
        })
        return {id: `table-${tableIndex + 1}-row-${rowIndex + 1}-cell-${cellIndex + 1}`, rowSpan, colSpan: gridSpan, paragraphs, source: {xmlPath: cellPath}}
    }))
    return {id: `table-${tableIndex + 1}`, type: 'table', rows, source: {part: 'word/document.xml', xmlPath: sourceXmlPath(table)}, rawXml: serializer.serializeToString(table), dirty: false}
}

export function parseBody(document: XmlPart): {blocks: DocumentBlock[]; html: string; mappings: TextSegmentMapping[]} {
    const body = firstDescendant(document, 'body')
    if (!body) throw new Error('DOCX 正文结构无效：缺少 w:body')
    const blocks: DocumentBlock[] = []
    const paragraphCounter = {value: 0}
    let tableIndex = 0
    childElements(body).forEach((child, index) => {
        if (localName(child) === 'p') {
            blocks.push(parseParagraph(child, paragraphCounter.value++))
            return
        }
        if (localName(child) === 'tbl') {
            blocks.push(parseTable(child, tableIndex++, paragraphCounter))
            return
        }
        blocks.push({id: `unsupported-${index + 1}`, type: 'unsupported', sourcePart: 'word/document.xml', rawXml: serializer.serializeToString(child), editable: false})
    })
    return {
        blocks,
        html: blocks.map(block => block.type === 'paragraph' ? projectParagraph(block) : block.type === 'table' ? projectTable(block) : block.type === 'image' ? projectImage(block) : '').join(''),
        mappings: blocks.flatMap(block => block.type === 'paragraph' ? block.runs.flatMap(run => run.mappings) : block.type === 'table' ? block.rows.flatMap(row => row.flatMap(cell => cell.paragraphs.flatMap(paragraph => paragraph.runs.flatMap(run => run.mappings)))) : []),
    }
}

export function refreshProjection(document: YolkDocument): void {
    const projection = parseBody(document.sourcePackage.parts.document)
    document.html = projection.html
    document.mappings = projection.mappings
}
