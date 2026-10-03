import type {DocxPackage, YolkDocument} from './types'
import {parseBody} from './projection'

export function createYolkDocument(sourcePackage: DocxPackage, documentId = `docx-${Date.now()}`): YolkDocument {
    const projection = parseBody(sourcePackage.parts.document)
    const firstParagraph = projection.blocks.find(block => block.type === 'paragraph')
    const title = firstParagraph?.runs.map(run => run.text).join('').trim() || sourcePackage.originalFileName.replace(/\.docx$/i, '')
    return {
        documentId,
        title,
        blocks: projection.blocks,
        styles: {},
        numbering: {},
        assets: Object.fromEntries([...sourcePackage.entries.keys()].filter(name => name.startsWith('word/media/')).map(name => [name, {entryName: name}])),
        sections: [],
        sourcePackage,
        html: projection.html,
        mappings: projection.mappings,
    }
}
