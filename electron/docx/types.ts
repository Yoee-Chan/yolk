import type {DOMParser} from '@xmldom/xmldom'

export type XmlPart = ReturnType<DOMParser['parseFromString']>
export type XmlPartMap = Map<string, XmlPart>

export type DocxPackage = {
    originalFileName: string
    entries: Map<string, Uint8Array>
    parts: {
        document: XmlPart
        styles?: XmlPart
        numbering?: XmlPart
        relationships?: XmlPart
        contentTypes?: XmlPart
        headers: XmlPartMap
        footers: XmlPartMap
        unknown: Map<string, Uint8Array>
    }
}

export type TextSegmentMapping = {
    displayStart: number
    displayEnd: number
    runId: string
    sourceTextNodePath: string
    sourceStart: number
    sourceEnd: number
}

export type RunProperties = {
    bold?: boolean
    italic?: boolean
    underline?: string
    strike?: boolean
    color?: string
    fontSize?: number
    fontFamily?: string
    [key: string]: unknown
}

export type ParagraphProperties = {
    alignment?: string
    styleId?: string
    indentLeft?: number
    indentRight?: number
    firstLineIndent?: number
    lineSpacing?: number
    spaceBefore?: number
    spaceAfter?: number
    pageBreakBefore?: boolean
    [key: string]: unknown
}

export type TextRun = {
    id: string
    type: 'text'
    text: string
    styleId?: string
    properties: RunProperties
    source: {xmlPath: string}
    dirty: boolean
    mappings: TextSegmentMapping[]
}

export type ParagraphBlock = {
    id: string
    type: 'paragraph'
    source: {part: string; xmlPath: string; paragraphId?: string}
    styleId?: string
    properties: ParagraphProperties
    runs: TextRun[]
    rawXml?: string
    dirty: boolean
}

export type UnsupportedBlock = {
    id: string
    type: 'unsupported'
    sourcePart: string
    rawXml: string
    editable: false
}

export type TableCell = {
    id: string
    rowSpan: number
    colSpan: number
    paragraphs: ParagraphBlock[]
    source: {xmlPath: string}
}

export type TableBlock = {
    id: string
    type: 'table'
    rows: TableCell[][]
    source: {part: string; xmlPath: string}
    rawXml?: string
    dirty: boolean
}

export type ImageBlock = {
    id: string
    type: 'image'
    assetId: string
    relationshipId?: string
    properties: Record<string, unknown>
    source: {part: string; xmlPath: string}
    dirty: boolean
}

export type DocumentBlock = ParagraphBlock | TableBlock | ImageBlock | UnsupportedBlock

export type YolkDocument = {
    documentId: string
    title: string
    blocks: DocumentBlock[]
    styles: Record<string, unknown>
    numbering: Record<string, unknown>
    assets: Record<string, unknown>
    sections: Array<Record<string, unknown>>
    sourcePackage: DocxPackage
    html: string
    mappings: TextSegmentMapping[]
}

export type YolkDocumentSnapshot = Omit<YolkDocument, 'sourcePackage'> & {
    sourcePackage: {
        originalFileName: string
        entryNames: string[]
    }
}

export type FormatPolicy = 'preserve-runs' | 'inherit-first-run' | 'inherit-majority' | 'plain' | 'explicit'

export type NewParagraphInput = {
    text: string
    styleId?: string
    properties?: ParagraphProperties
    formatting?: RunProperties
}

export type DocumentOperation =
    | {
        type: 'replaceText'
        paragraphId: string
        start: number
        end: number
        expectedText: string
        text: string
        formatPolicy: FormatPolicy
    }
    | {
        type: 'applyRunFormatting'
        paragraphId: string
        start: number
        end: number
        expectedText: string
        formatting: Partial<RunProperties>
    }
    | {
        type: 'setParagraphFormatting'
        paragraphId: string
        formatting: Partial<ParagraphProperties>
    }
    | {
        type: 'insertParagraph'
        afterBlockId: string
        paragraph: NewParagraphInput
    }
    | {
        type: 'deleteBlock'
        blockId: string
        expectedText?: string
    }
    | {
        type: 'insertImage'
        afterBlockId: string
        assetId: string
        properties?: Record<string, unknown>
    }

export type OperationResult = {
    operation: DocumentOperation
    inverse: DocumentOperation
    changedParagraphId?: string
    diff: {before: string; after: string}
}

export type OperationValidationError = {
    index: number
    message: string
}

export type OperationBatch = {
    operations: DocumentOperation[]
}

export type OperationPreview = {
    operations: DocumentOperation[]
    results: OperationResult[]
    errors: OperationValidationError[]
}

export type DocxImportResult = {
    fileName: string
    html: string
    packageEntries: string[]
    documentXml: string
    document: YolkDocument
    entryHashes: Record<string, string>
}

export type SerializableDocxImportResult = Omit<DocxImportResult, 'document'> & {
    document: YolkDocumentSnapshot
    packagePath?: string
}
