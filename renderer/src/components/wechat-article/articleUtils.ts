import type {OutlineNode, StreamPayload} from './types';

const ARTICLE_FOLLOW_UP_MARKERS = [
    '文章已按您的全部要求完成', '文章已按要求完成', '如需我为您', '如果需要我为您',
    '如需下一步操作', '如果需要下一步操作', '如需我继续', '如果需要我继续',
    '需要我为你生成', '需要我为您生成', '是否需要我为你', '是否需要我为您',
    '请告诉我是否需要', '请随时吩咐', '还有其他问题', '封面图建议', '保存至草稿箱',
    '直接发布', '需要你确认', '进行其他操作', '其他操作', '生成配图建议',
    '导出为 Markdown', '文章创作完成',
];

function stripToolOutput(value: string): string {
    return value
        .replace(/<tool_code>[\s\S]*?<\/tool_code>/gi, '')
        .replace(/<tool_code>[\s\S]*$/gi, '')
        .replace(/<\/tool_code>/gi, '')
        .replace(/```(?:json|xml)?\s*\{\s*"name"\s*:\s*"(?:str_replace_editor|bash|browser|python_execute)"[\s\S]*?```/gi, '')
        .replace(/\{\s*"name"\s*:\s*"(?:str_replace_editor|bash|browser|python_execute)"[\s\S]*$/gi, '');
}

export function cleanArticleContent(markdown: string): string {
    const lines = stripToolOutput(markdown)
        .replace(/```(?:markdown|md)?/gi, '')
        .replace(/```/g, '')
        .split(/\r?\n/)
        .filter((line) => !/^\s*\[(?:系统|system)\]/i.test(line));
    const firstHeading = lines.findIndex((line) => /^\s*#\s+\S/.test(line));
    const articleLines = firstHeading >= 0 ? lines.slice(firstHeading) : lines;
    const followUpIndex = articleLines.findIndex((line) => {
        const compact = line.replace(/[\\`*_>#\s]/g, '');
        return ARTICLE_FOLLOW_UP_MARKERS.some((marker) => compact.includes(marker));
    });
    return (followUpIndex >= 0 ? articleLines.slice(0, followUpIndex) : articleLines)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>\"]/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'}[character] ?? character));
}

export function markdownToHtml(markdown: string): string {
    const html = cleanArticleContent(markdown).split(/\r?\n/).map((line) => {
        if (/^###\s+/.test(line)) return `<h3>${escapeHtml(line.replace(/^###\s+/, '').replace(/\s+#+$/, ''))}</h3>`;
        if (/^##\s+/.test(line)) return `<h2>${escapeHtml(line.replace(/^##\s+/, '').replace(/\s+#+$/, ''))}</h2>`;
        if (/^#\s+/.test(line)) return `<h1>${escapeHtml(line.replace(/^#\s+/, '').replace(/\s+#+$/, ''))}</h1>`;
        const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (image) return `<figure><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1] || '文章配图')}" /><figcaption>${escapeHtml(image[1])}</figcaption></figure>`;
        if (/^[-*]\s+/.test(line)) return `<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`;
        return line ? `<p>${escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>` : '';
    }).join('');
    return html.replace(/(<li>.*?<\/li>)+/gs, (list) => `<ul>${list}</ul>`);
}

export function htmlToMarkdown(html: string): string {
    const root = document.createElement('div');
    root.innerHTML = html;
    const inline = (node: Node): string => Array.from(node.childNodes).map((child) => {
        if (child.nodeType === Node.TEXT_NODE) return child.textContent ?? '';
        if (child.nodeType !== Node.ELEMENT_NODE) return '';
        const element = child as HTMLElement;
        const text = inline(element);
        if (element.tagName === 'STRONG' || element.tagName === 'B') return `**${text}**`;
        if (element.tagName === 'BR') return '\n';
        if (element.tagName === 'A') return `[${text}](${element.getAttribute('href') ?? ''})`;
        return text;
    }).join('');
    return Array.from(root.children).map((element) => {
        const node = element as HTMLElement;
        if (/^H[1-6]$/.test(node.tagName)) return `${'#'.repeat(Number(node.tagName.slice(1)))} ${inline(node).trim()}`;
        if (node.tagName === 'UL' || node.tagName === 'OL') return Array.from(node.children).map((item) => `- ${inline(item).trim()}`).join('\n');
        if (node.tagName === 'FIGURE') {
            const image = node.querySelector('img');
            return image ? `![${image.alt || '文章配图'}](${image.getAttribute('src') || ''})` : '';
        }
        return inline(node).trim();
    }).filter(Boolean).join('\n\n').trim();
}

export function isRichArticleContent(content: string): boolean {
    return /<\/?(?:h[1-6]|p|ul|ol|li|strong|b|u|span|font|figure|img|div|br)\b/i.test(content);
}

export function removeImportedNoise(html: string): string {
    const root = document.createElement('div');
    root.innerHTML = html;
    root.querySelectorAll('script, style, meta, link, code, pre').forEach((node) => node.remove());
    root.querySelectorAll('*').forEach((node) => {
        const element = node as HTMLElement;
        Array.from(element.attributes).forEach((attribute) => {
            if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
            if (attribute.name === 'class' && /(?:mso|apple|gmail|spell)/i.test(attribute.value)) element.removeAttribute(attribute.name);
        });
        if (element.tagName === 'IMG') {
            element.removeAttribute('width');
            element.removeAttribute('height');
            element.style.cssText = 'width:auto;max-width:100%;height:auto;display:block;margin:22px auto';
        }
        if (element.tagName === 'TABLE') {
            element.style.cssText = 'max-width:100%;width:100%;box-sizing:border-box;border-collapse:collapse';
        }
    });
    return root.innerHTML.trim();
}

export function extractText(line: string): string | null {
    try {
        const payload = JSON.parse(line) as StreamPayload;
        if ((payload.type === 'stream' || payload.type === 'result') && typeof payload.text === 'string') return payload.text;
        if (payload.type === 'error' && typeof payload.text === 'string') throw new Error(payload.text);
    } catch (error) {
        if (error instanceof SyntaxError) return null;
        throw error;
    }
    return null;
}

export function outlineToMarkdown(nodes: OutlineNode[]): string {
    return nodes.flatMap((node) => [`${'#'.repeat(node.level + 1)} ${node.text.trim()}`, outlineToMarkdown(node.children)]).filter(Boolean).join('\n');
}

export function updateOutlineNodes(nodes: OutlineNode[], id: string, updater: (node: OutlineNode) => OutlineNode | null): OutlineNode[] {
    return nodes.flatMap((node) => {
        if (node.id === id) {
            const next = updater(node);
            return next ? [next] : [];
        }
        return [{...node, children: updateOutlineNodes(node.children, id, updater)}];
    });
}

export function parseOutline(markdown: string): OutlineNode[] {
    const roots: OutlineNode[] = [];
    const stack: OutlineNode[] = [];
    markdown.split(/\r?\n/).forEach((line, index) => {
        const match = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (!match) return;
        const node: OutlineNode = {id: `${index}-${match[1].length}`, level: match[1].length, text: match[2], children: []};
        while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
        if (stack.length) stack[stack.length - 1].children.push(node);
        else roots.push(node);
        stack.push(node);
    });
    return roots;
}

export function outlineFromHtml(html: string): OutlineNode[] {
    const root = document.createElement('div');
    root.innerHTML = html;
    const markdown = Array.from(root.querySelectorAll('h2, h3, h4')).map((heading) => {
        const level = Number(heading.tagName.slice(1)) - 1;
        return `${'#'.repeat(level)} ${heading.textContent?.trim() ?? ''}`;
    }).filter((line) => line.trim().length > 2).join('\n');
    return parseOutline(markdown);
}
