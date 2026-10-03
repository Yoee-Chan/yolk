import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {AnnotationMenuPosition} from './types';

type RunProperties = {bold?: boolean; italic?: boolean; underline?: string; strike?: boolean; color?: string; fontSize?: number; fontFamily?: string};
type TextRun = {id: string; text: string; properties: RunProperties};
type ParagraphBlock = {id: string; type: 'paragraph'; styleId?: string; properties: {alignment?: string; indentLeft?: number; indentRight?: number; firstLineIndent?: number; lineSpacing?: number; spaceBefore?: number; spaceAfter?: number; pageBreakBefore?: boolean}; runs: TextRun[]};
type TableCell = {id: string; rowSpan: number; colSpan: number; paragraphs: ParagraphBlock[]};
type DocumentBlock = ParagraphBlock | {id: string; type: 'table'; rows: TableCell[][]} | {id: string; type: 'unsupported'; rawXml: string; editable: false};
export type ProjectionDocument = {documentId: string; title: string; blocks: DocumentBlock[]};
export type ProjectionSelection = {paragraphId: string; start: number; end: number; text: string};

function paragraphText(block: ParagraphBlock) { return block.runs.map((run) => run.text).join(''); }
function paragraphTag(styleId?: string) {
    if (!styleId) return 'p';
    const value = styleId.toLowerCase();
    if (value.includes('heading') || value.includes('标题')) return 'h2';
    return 'p';
}
function runStyle(properties: RunProperties): React.CSSProperties {
    return {fontWeight: properties.bold ? 700 : undefined, fontStyle: properties.italic ? 'italic' : undefined, textDecoration: [properties.underline ? 'underline' : '', properties.strike ? 'line-through' : ''].filter(Boolean).join(' ') || undefined, color: properties.color, fontSize: properties.fontSize ? `${properties.fontSize}pt` : undefined, fontFamily: properties.fontFamily};
}
function offsetAt(container: Node, offset: number, root: HTMLElement): number {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(container, offset);
    return range.toString().length;
}
function selectionInParagraph(root: HTMLElement, paragraphId: string): ProjectionSelection | null {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    // @ts-ignore
    const paragraph = (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest(`[data-yolk-node-id="${paragraphId}"]`) as HTMLElement | null;
    if (!paragraph) return null;
    const start = offsetAt(range.startContainer, range.startOffset, paragraph);
    const end = offsetAt(range.endContainer, range.endOffset, paragraph);
    return {paragraphId, start: Math.min(start, end), end: Math.max(start, end), text: selection.toString()};
}

function ParagraphView({block, editable, onInput, onSelect}: {block: ParagraphBlock; editable: boolean; onInput: (block: ParagraphBlock, text: string) => void; onSelect: (selection: ProjectionSelection | null) => void}) {
    const ref = useRef<HTMLElement>(null);
    const tag = paragraphTag(block.styleId);
    const props = {ref, 'data-yolk-node-id': block.id, 'data-yolk-style-id': block.styleId, contentEditable: editable, suppressContentEditableWarning: true, onInput: () => onInput(block, ref.current?.textContent || ''), onMouseUp: () => onSelect(ref.current ? selectionInParagraph(ref.current, block.id) : null), onKeyUp: () => onSelect(ref.current ? selectionInParagraph(ref.current, block.id) : null), style: {textAlign: block.properties.alignment as React.CSSProperties['textAlign'], paddingLeft: block.properties.indentLeft ? `${block.properties.indentLeft / 20}pt` : undefined, paddingRight: block.properties.indentRight ? `${block.properties.indentRight / 20}pt` : undefined, textIndent: block.properties.firstLineIndent ? `${block.properties.firstLineIndent / 20}pt` : undefined, lineHeight: block.properties.lineSpacing ? block.properties.lineSpacing / 240 : undefined, marginTop: block.properties.spaceBefore ? `${block.properties.spaceBefore / 20}pt` : undefined, marginBottom: block.properties.spaceAfter ? `${block.properties.spaceAfter / 20}pt` : undefined}, className: 'docx-projection__paragraph'};
    const children = block.runs.map((run) => <span key={run.id} data-yolk-run-id={run.id} style={runStyle(run.properties)}>{run.text}</span>);
    return React.createElement(tag, props, children.length ? children : '\u00a0');
}

export default function DocxProjectionEditor({document, editable, onReplaceText, onSelection, onContextMenu}: {document: ProjectionDocument; editable: boolean; onReplaceText: (block: ParagraphBlock, text: string) => void; onSelection: (selection: ProjectionSelection | null) => void; onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<ProjectionSelection | null>(null);
    const updateSelection = useCallback((value: ProjectionSelection | null) => { setSelection(value); onSelection(value); }, [onSelection]);
    useEffect(() => { if (!editable) { setSelection(null); onSelection(null); } }, [editable, onSelection]);
    const blocks = useMemo(() => document.blocks, [document.blocks]);
    const renderBlock = (block: DocumentBlock): React.ReactNode => {
        if (block.type === 'paragraph') return <ParagraphView key={block.id} block={block} editable={editable} onInput={onReplaceText} onSelect={updateSelection}/>;
        if (block.type === 'table') return <table key={block.id} data-yolk-node-id={block.id} className="docx-projection__table"><tbody>{block.rows.map((row) => <tr key={row.map((cell) => cell.id).join('-')}>{row.map((cell) => <td key={cell.id} colSpan={cell.colSpan} rowSpan={cell.rowSpan}>{cell.paragraphs.map((paragraph) => <ParagraphView key={paragraph.id} block={paragraph} editable={editable} onInput={onReplaceText} onSelect={updateSelection}/>)}</td>)}</tr>)}</tbody></table>;
        return <div key={block.id} className="docx-projection__unsupported" data-yolk-node-id={block.id}>此 Word 对象暂不支持直接编辑，将在导出时原样保留。</div>;
    };
    return <div ref={rootRef} className="docx-projection" onContextMenu={onContextMenu}>{blocks.map(renderBlock)}{editable && selection ? <span className="docx-projection__selection-marker" aria-hidden="true"/> : null}</div>;
}
