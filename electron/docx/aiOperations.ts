import type {DocumentOperation, FormatPolicy, OperationBatch, OperationValidationError, YolkDocument} from './types'
import {applyDocumentOperation, documentText, parseFormattingStyle, parseParagraphStyle} from './operations'

const formats = new Set(['preserve-runs', 'inherit-first-run', 'inherit-majority', 'plain', 'explicit'])
const operationTypes = new Set(['replaceText', 'applyRunFormatting', 'setParagraphFormatting', 'insertParagraph', 'deleteBlock', 'insertImage'])

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function requiredString(input: Record<string, unknown>, key: string): string | null { return typeof input[key] === 'string' ? input[key] as string : null }

export function parseAiOperationBatch(value: unknown): OperationBatch {
    const raw = isRecord(value) && Array.isArray(value.operations) ? value.operations : value
    if (!Array.isArray(raw)) throw new Error('AI 操作必须是包含 operations 数组的 JSON 对象')
    const operations = raw.map((item, index) => normalizeOperation(item, index))
    return {operations}
}

function normalizeOperation(value: unknown, index: number): DocumentOperation {
    if (!isRecord(value) || typeof value.type !== 'string' || !operationTypes.has(value.type)) throw new Error(`第 ${index + 1} 个 AI 操作类型无效`)
    const type = value.type as DocumentOperation['type']
    if (type === 'replaceText') {
        const paragraphId = requiredString(value, 'paragraphId')
        const expectedText = requiredString(value, 'expectedText')
        const text = requiredString(value, 'text')
        if (!paragraphId || expectedText === null || text === null || !Number.isInteger(value.start) || !Number.isInteger(value.end) || typeof value.formatPolicy !== 'string' || !formats.has(value.formatPolicy)) throw new Error(`第 ${index + 1} 个 replaceText 操作字段无效`)
        return {type, paragraphId, start: value.start as number, end: value.end as number, expectedText, text, formatPolicy: value.formatPolicy as FormatPolicy}
    }
    if (type === 'applyRunFormatting') {
        const paragraphId = requiredString(value, 'paragraphId')
        const expectedText = requiredString(value, 'expectedText')
        if (!paragraphId || expectedText === null || !Number.isInteger(value.start) || !Number.isInteger(value.end) || !isRecord(value.formatting)) throw new Error(`第 ${index + 1} 个 applyRunFormatting 操作字段无效`)
        return {type, paragraphId, start: value.start as number, end: value.end as number, expectedText, formatting: parseFormattingStyle(value.formatting)}
    }
    if (type === 'setParagraphFormatting') {
        const paragraphId = requiredString(value, 'paragraphId')
        if (!paragraphId || !isRecord(value.formatting)) throw new Error(`第 ${index + 1} 个 setParagraphFormatting 操作字段无效`)
        return {type, paragraphId, formatting: parseParagraphStyle(value.formatting)}
    }
    if (type === 'insertParagraph') {
        const afterBlockId = requiredString(value, 'afterBlockId')
        const paragraph = isRecord(value.paragraph) ? value.paragraph : null
        const text = paragraph && typeof paragraph.text === 'string' ? paragraph.text : null
        if (!afterBlockId || !paragraph || text === null) throw new Error(`第 ${index + 1} 个 insertParagraph 操作字段无效`)
        return {type, afterBlockId, paragraph: {text, ...(typeof paragraph.styleId === 'string' ? {styleId: paragraph.styleId} : {}), properties: parseParagraphStyle(paragraph.properties), formatting: parseFormattingStyle(paragraph.formatting)}}
    }
    if (type === 'deleteBlock') {
        const blockId = requiredString(value, 'blockId')
        if (!blockId) throw new Error(`第 ${index + 1} 个 deleteBlock 操作字段无效`)
        return {type, blockId, ...(typeof value.expectedText === 'string' ? {expectedText: value.expectedText} : {})}
    }
    const afterBlockId = requiredString(value, 'afterBlockId')
    const assetId = requiredString(value, 'assetId')
    if (!afterBlockId || !assetId) throw new Error(`第 ${index + 1} 个 insertImage 操作字段无效`)
    return {type, afterBlockId, assetId, properties: isRecord(value.properties) ? value.properties : {}}
}

export function validateAiOperations(document: YolkDocument, operations: DocumentOperation[]): OperationValidationError[] {
    const errors: OperationValidationError[] = []
    operations.forEach((operation, index) => {
        if (operation.type === 'replaceText' || operation.type === 'applyRunFormatting' || operation.type === 'setParagraphFormatting') {
            if (!document.blocks.some(block => block.id === operation.paragraphId)) errors.push({index, message: `目标段落不存在：${operation.paragraphId}`})
        } else if (!document.blocks.some(block => block.id === (operation.type === 'deleteBlock' ? operation.blockId : operation.afterBlockId))) {
            errors.push({index, message: `目标节点不存在：${operation.type === 'deleteBlock' ? operation.blockId : operation.afterBlockId}`})
        }
    })
    return errors
}

export function previewAiOperations(document: YolkDocument, batch: OperationBatch) {
    const validationErrors = validateAiOperations(document, batch.operations)
    if (validationErrors.length) return {operations: batch.operations, results: [], errors: validationErrors}
    const results = []
    const errors: OperationValidationError[] = []
    for (const [index, operation] of batch.operations.entries()) {
        try { results.push(applyDocumentOperation(document, operation)) } catch (error) { errors.push({index, message: error instanceof Error ? error.message : String(error)}) }
    }
    return {operations: batch.operations, results, errors}
}

export function operationPromptContext(document: YolkDocument): string {
    return document.blocks.map(block => block.type === 'paragraph' ? `${block.id}: ${block.runs.map(run => run.text).join('')}` : `${block.id}: [不可编辑对象]`).join('\n')
}

export {documentText}
