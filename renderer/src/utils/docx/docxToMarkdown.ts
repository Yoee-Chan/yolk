import JSZip from 'jszip';
import { DOMParser, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';

type Relationship = { target: string; type: string };
export type ConvertedDocument = {
  markdown: string;
  displayMarkdown: string;
  title: string;
  outline: Array<{ level: number; text: string }>;
  sourceName: string;
};

const parser = new DOMParser();

function localName(node: unknown): string {
  const el = node as XmlElement;
  return el.localName || (el.nodeName?.split(':').pop() ?? el.nodeName);
}
function childNodesOf(node: unknown): XmlNode[] {
  return Array.from(((node as { childNodes?: ArrayLike<XmlNode> })?.childNodes ?? []) as ArrayLike<XmlNode>);
}
function children(node: unknown, name: string): XmlElement[] {
  return childNodesOf(node).filter((c) => c.nodeType === 1 && localName(c) === name) as XmlElement[];
}
function descendants(node: unknown, name: string): XmlElement[] {
  const result: XmlElement[] = [];
  const visit = (current: unknown) => {
    for (const child of childNodesOf(current)) {
      if (child.nodeType !== 1) continue;
      if (localName(child) === name) result.push(child as XmlElement);
      visit(child);
    }
  };
  visit(node);
  return result;
}
function attr(node: unknown, name: string, namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'): string {
  const el = node as XmlElement | undefined;
  if (!el) return '';
  return el.getAttributeNS?.(namespace, name) || el.getAttribute?.(`w:${name}`) || el.getAttribute?.(name) || '';
}
function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_[\]#])/g, '\\$1');
}

function readRelationships(xml: string): Map<string, Relationship> {
  const document = parser.parseFromString(xml, 'text/xml');
  const relationships = new Map<string, Relationship>();
  for (const node of childNodesOf(document.documentElement)) {
    if (node.nodeType !== 1 || localName(node) !== 'Relationship') continue;
    const item = node as XmlElement;
    const id = item.getAttribute('Id');
    const target = item.getAttribute('Target');
    const type = item.getAttribute('Type') || '';
    if (id && target) relationships.set(id, { target, type });
  }
  return relationships;
}

function headingLevel(styleId: string, outlineLevel: string): number {
  if (outlineLevel !== '' && Number.isFinite(Number(outlineLevel))) return Math.min(6, Number(outlineLevel) + 1);
  const normalized = styleId.replace(/[\s_-]/g, '').toLowerCase();
  const match = normalized.match(/(?:heading|h)(\d+)/);
  if (!match) return 0;
  return Math.min(6, Number(match[1]));
}

function runText(run: XmlElement): string {
  return (
    descendants(run, 't').map((n) => n.textContent || '').join('') +
    '\t'.repeat(descendants(run, 'tab').length) +
    '\n'.repeat(descendants(run, 'br').length + descendants(run, 'cr').length)
  );
}

function formatRun(run: XmlElement): string {
  let value = escapeMarkdown(runText(run));
  const properties = descendants(run, 'rPr')[0];
  if (!properties) return value;
  if (descendants(properties, 'b').length) value = `**${value}**`;
  if (descendants(properties, 'i').length) value = `*${value}*`;
  if (descendants(properties, 'u').length) value = `<u>${value}</u>`;
  if (descendants(properties, 'strike').length) value = `<s>${value}</s>`;
  const color = attr(descendants(properties, 'color')[0], 'val');
  const size = attr(descendants(properties, 'sz')[0], 'val');
  const fonts = descendants(properties, 'rFonts')[0];
  const font = attr(fonts, 'eastAsia') || attr(fonts, 'ascii');
  const styles = [
    color && color !== 'auto' ? `color:#${color}` : '',
    size ? `font-size:${Number(size) / 2}pt` : '',
    font ? `font-family:${font}` : '',
  ].filter(Boolean);
  return styles.length ? `<span style="${styles.join(';')}">${value}</span>` : value;
}

function paragraphMarkdown(
  paragraph: XmlElement,
  relationships: Map<string, Relationship>,
  media: Map<string, string>,
): { text: string; level: number } {
  const properties = children(paragraph, 'pPr')[0];
  const styleId = attr(children(properties, 'pStyle')[0], 'val');
  const level = headingLevel(styleId, attr(children(properties, 'outlineLvl')[0], 'val'));
  const text = descendants(paragraph, 'r')
    .map((run) => {
      const drawing = descendants(run, 'blip')[0] || descendants(run, 'imagedata')[0];
      const relationshipId =
        (drawing as XmlElement)?.getAttributeNS?.('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ||
        drawing?.getAttribute?.('r:embed') ||
        drawing?.getAttribute?.('r:id') ||
        '';
      if (relationshipId) {
        const relationship = relationships.get(relationshipId);
        const fileName = relationship && media.get(relationship.target.replace(/^\.\//, ''));
        if (fileName) return `![图片](${fileName})`;
      }
      return formatRun(run);
    })
    .join('');
  const alignment = attr(children(properties, 'jc')[0], 'val');
  let out = text.trim();
  if (alignment === 'center') out = `<div align="center">${out}</div>`;
  if (alignment === 'right') out = `<div align="right">${out}</div>`;
  return { text: out, level };
}

export async function convertDocxFile(file: File | Blob, sourceName: string): Promise<ConvertedDocument> {
  const buffer = await (file as Blob).arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('Word 文档缺少正文内容');
  const relationshipsXml = (await zip.file('word/_rels/document.xml.rels')?.async('string')) || '<Relationships/>';
  const relationships = readRelationships(relationshipsXml);

  const media = new Map<string, string>();
  const mediaEntries = Object.keys(zip.files).filter((e) => e.startsWith('word/media/') && !e.endsWith('/'));
  for (const name of mediaEntries) {
    const data = await zip.file(name)!.async('base64');
    const ext = name.split('.').pop()?.toLowerCase() ?? 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
    media.set(name.replace(/^word\//, ''), `data:${mime};base64,${data}`);
  }

  const document = parser.parseFromString(documentXml, 'text/xml');
  const body = descendants(document, 'body')[0];
  if (!body) throw new Error('Word 文档缺少正文内容');
  const paragraphs: Array<{ text: string; level: number }> = [];
  for (const paragraph of children(body, 'p')) {
    const item = paragraphMarkdown(paragraph, relationships, media);
    if (item.text) paragraphs.push(item);
  }
  const markdown = `${paragraphs.map((item) => `${item.level ? `${'#'.repeat(item.level)} ` : ''}${item.text}`).join('\n\n')}\n`;
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim();
  const title = stripTags(paragraphs.find((item) => item.level === 1)?.text ?? '') || sourceName.replace(/\.docx$/i, '');
  const outline = paragraphs.filter((item) => item.level > 0).map((item) => ({ level: item.level, text: stripTags(item.text) }));
  return { markdown, displayMarkdown: markdown, title, outline, sourceName };
}
