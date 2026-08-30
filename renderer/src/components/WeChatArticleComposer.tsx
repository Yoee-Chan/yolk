import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeftOutlined, BoldOutlined, CheckOutlined, CopyOutlined, FileTextOutlined, FontColorsOutlined, FontSizeOutlined, PictureOutlined, ReloadOutlined, RobotOutlined, SearchOutlined, SendOutlined, UnderlineOutlined, UploadOutlined} from '@ant-design/icons';
import {Input, message, Modal, Select, Tabs} from 'antd';
import {getStoredToken} from '../api/cloudApi';
import '../css/WeChatArticleComposer.css';

type StreamPayload = {type?: string; text?: string};

const EDITOR_TEXT_COLORS = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9',
    '#cc0000', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3',
    '#660000', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75',
];

const ARTICLE_FOLLOW_UP_MARKERS = [
    '文章已按您的全部要求完成',
    '文章已按要求完成',
    '如需我为您',
    '如果需要我为您',
    '如需下一步操作',
    '如果需要下一步操作',
    '如需我继续',
    '如果需要我继续',
    '需要我为你生成',
    '需要我为您生成',
    '是否需要我为你',
    '是否需要我为您',
    '请告诉我是否需要',
    '请随时吩咐',
    '还有其他问题',
    '封面图建议',
    '保存至草稿箱',
    '直接发布',
    '需要你确认',
    '进行其他操作',
    '其他操作',
    '生成配图建议',
    '导出为 Markdown',
    '文章创作完成',
];

function stripToolOutput(value: string): string {
    return value
        .replace(/<tool_code>[\s\S]*?<\/tool_code>/gi, '')
        .replace(/<tool_code>[\s\S]*$/gi, '')
        .replace(/<\/tool_code>/gi, '')
        .replace(/```(?:json|xml)?\s*\{\s*"name"\s*:\s*"(?:str_replace_editor|bash|browser|python_execute)"[\s\S]*?```/gi, '')
        .replace(/\{\s*"name"\s*:\s*"(?:str_replace_editor|bash|browser|python_execute)"[\s\S]*$/gi, '');
}

function cleanArticleContent(markdown: string): string {
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

function markdownToHtml(markdown: string): string {
    const html = cleanArticleContent(markdown)
        .split(/\r?\n/)
        .map((line) => {
            if (/^###\s+/.test(line)) return `<h3>${escapeHtml(line.replace(/^###\s+/, '').replace(/\s+#+$/, ''))}</h3>`;
            if (/^##\s+/.test(line)) return `<h2>${escapeHtml(line.replace(/^##\s+/, '').replace(/\s+#+$/, ''))}</h2>`;
            if (/^#\s+/.test(line)) return `<h1>${escapeHtml(line.replace(/^#\s+/, '').replace(/\s+#+$/, ''))}</h1>`;
            const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (image) return `<figure><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1] || '文章配图')}" /><figcaption>${escapeHtml(image[1])}</figcaption></figure>`;
            if (/^[-*]\s+/.test(line)) return `<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`;
            return line ? `<p>${escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>` : '';
        })
        .join('');
    return html.replace(/(<li>.*?<\/li>)+/gs, (list) => `<ul>${list}</ul>`);
}

function htmlToMarkdown(html: string): string {
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
    const blocks = Array.from(root.children).map((element) => {
        const node = element as HTMLElement;
        if (/^H[1-6]$/.test(node.tagName)) return `${'#'.repeat(Number(node.tagName.slice(1)))} ${inline(node).trim()}`;
        if (node.tagName === 'UL' || node.tagName === 'OL') {
            return Array.from(node.children).map((item) => `- ${inline(item).trim()}`).join('\n');
        }
        if (node.tagName === 'FIGURE') {
            const image = node.querySelector('img');
            if (!image) return '';
            return `![${image.alt || '文章配图'}](${image.getAttribute('src') || ''})`;
        }
        return inline(node).trim();
    });
    return blocks.filter(Boolean).join('\n\n').trim();
}

function isRichArticleContent(content: string): boolean {
    return /<\/?(?:h[1-6]|p|ul|ol|li|strong|b|u|span|font|figure|img|div|br)\b/i.test(content);
}

function extractText(line: string): string | null {
    try {
        const payload = JSON.parse(line) as StreamPayload;
        if (payload.type === 'stream' && typeof payload.text === 'string') {
            return payload.text;
        }
        if (payload.type === 'result' && typeof payload.text === 'string') {
            return payload.text;
        }
        if (payload.type === 'error' && typeof payload.text === 'string') {
            throw new Error(payload.text);
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
            return null;
        }
        throw error;
    }
    return null;
}

type WeChatArticleComposerProps = {
    onBack: () => void;
};

type OutlineNode = {
    id: string;
    level: number;
    text: string;
    children: OutlineNode[];
};

function outlineToMarkdown(nodes: OutlineNode[]): string {
    return nodes
        .flatMap((node) => [`${'#'.repeat(node.level + 1)} ${node.text.trim()}`, outlineToMarkdown(node.children)])
        .filter(Boolean)
        .join('\n');
}

function updateOutlineNodes(
    nodes: OutlineNode[],
    id: string,
    updater: (node: OutlineNode) => OutlineNode | null
): OutlineNode[] {
    return nodes.flatMap((node) => {
        if (node.id === id) {
            const next = updater(node);
            return next ? [next] : [];
        }
        return [{...node, children: updateOutlineNodes(node.children, id, updater)}];
    });
}

function parseOutline(markdown: string): OutlineNode[] {
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

function renderOutline(
    nodes: OutlineNode[],
    onChange: (id: string, text: string) => void,
    onAdd: (parentId: string | null, level: number) => void,
    onRemove: (id: string) => void
): React.ReactNode {
    return nodes.map((node) => (
        <li key={node.id} className={`wechat-flow__item wechat-flow__item--h${node.level + 1}`}>
            <div className="wechat-flow__card">
                <span className="wechat-outline__marker">H{node.level + 1}</span>
                <input
                    value={node.text}
                    onChange={(event) => onChange(node.id, event.target.value)}
                    placeholder="输入标题"
                    aria-label={`H${node.level + 1} 标题`}
                />
                {node.level < 3 ? (
                    <button type="button" className="wechat-flow__add" onClick={() => onAdd(node.id, node.level + 1)}>
                        + H{node.level + 2}
                    </button>
                ) : null}
                <button type="button" className="wechat-flow__remove" onClick={() => onRemove(node.id)} aria-label="删除标题">×</button>
            </div>
            {node.children.length ? (
                <div className="wechat-flow__children">
                    {renderOutline(node.children, onChange, onAdd, onRemove)}
                </div>
            ) : null}
        </li>
    ));
}

export default function WeChatArticleComposer({onBack}: WeChatArticleComposerProps) {
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [outlineTree, setOutlineTree] = useState<OutlineNode[]>([]);
    const [content, setContent] = useState('');
    const [editingContent, setEditingContent] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [leftWidth, setLeftWidth] = useState(360);
    const [isDragging, setIsDragging] = useState(false);
    const [flowHeight, setFlowHeight] = useState(320);
    const [fontSize, setFontSize] = useState(14);
    const [fontFamily, setFontFamily] = useState("'Microsoft YaHei', sans-serif");
    const [textColor, setTextColor] = useState('#293548');
    const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false);
    const [customHexColor, setCustomHexColor] = useState('#293548');
    const [customRgbColor, setCustomRgbColor] = useState('41, 53, 72');
    const [boldMode, setBoldMode] = useState(false);
    const [editorHtml, setEditorHtml] = useState('');
    const editorHtmlRef = useRef('');
    const [imageUrl, setImageUrl] = useState('');
    const [imageCaption, setImageCaption] = useState('');
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [imageTab, setImageTab] = useState('search');
    const [imagePrompt, setImagePrompt] = useState('');
    const [imageLoading, setImageLoading] = useState(false);
    const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const draftStateRef = useRef({title: '', subtitle: '', content: '', outlineTree: [] as OutlineNode[]});
    const carryRef = useRef('');
    const workspaceRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const selectionRangeRef = useRef<Range | null>(null);
    const outline = useMemo(() => outlineToMarkdown(outlineTree), [outlineTree]);

    useEffect(() => {
        let active = true;
        window.api.loadWechatArticle().then((draft) => {
            if (!active || !draft) return;
            setTitle(draft.title);
            setSubtitle(draft.subtitle);
            setContent(draft.content);
            setOutlineTree(draft.outlineTree as OutlineNode[]);
            setLastSavedAt(draft.updatedAt || null);
            setHasLoadedDraft(true);
        }).catch(() => setHasLoadedDraft(true));
        return () => { active = false; };
    }, []);

    useEffect(() => {
        draftStateRef.current = {title, subtitle, content, outlineTree};
    }, [content, outlineTree, subtitle, title]);

    const saveDraft = useCallback(async (showMessage = false) => {
        const draft = draftStateRef.current;
        if (!draft.content.trim() && !draft.title.trim() && !draft.subtitle.trim() && !draft.outlineTree.length) return;
        setSaving(true);
        try {
            await window.api.saveWechatArticle(draft);
            const savedAt = new Date().toISOString();
            setLastSavedAt(savedAt);
            if (showMessage) message.success('文章已保存到 workspace/微信公众号');
        } catch (error) {
            if (showMessage) message.error(error instanceof Error ? error.message : '保存失败');
        } finally {
            setSaving(false);
        }
    }, []);

    useEffect(() => {
        if (!hasLoadedDraft) return;
        const snapshotTimer = window.setInterval(() => { void saveDraft(); }, 10_000);
        return () => window.clearInterval(snapshotTimer);
    }, [hasLoadedDraft, saveDraft]);

    useEffect(() => {
        const handleSaveShortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                void saveDraft(true);
            }
        };
        window.addEventListener('keydown', handleSaveShortcut);
        return () => window.removeEventListener('keydown', handleSaveShortcut);
    }, [saveDraft]);

    useEffect(() => {
        const stopDragging = () => document.body.classList.remove('is-resizing');
        window.addEventListener('mouseup', stopDragging);
        return () => window.removeEventListener('mouseup', stopDragging);
    }, []);

    const resizeWorkspace = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        document.body.classList.add('is-resizing');
        setIsDragging(true);
        const move = (moveEvent: MouseEvent) => {
            const bounds = workspaceRef.current?.getBoundingClientRect();
            if (!bounds) return;
            setLeftWidth(Math.max(280, Math.min(bounds.width - 368, moveEvent.clientX - bounds.left)));
        };
        const stop = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', stop);
            document.body.classList.remove('is-resizing');
            setIsDragging(false);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
    };

    const addOutlineNode = (parentId: string | null, level: number) => {
        const node: OutlineNode = {id: `${Date.now()}-${Math.random()}`, level, text: '', children: []};
        if (!parentId) {
            setOutlineTree((previous) => [...previous, node]);
            return;
        }
        setOutlineTree((previous) => updateOutlineNodes(previous, parentId, (parent) => ({...parent, children: [...parent.children, node]})));
    };

    const updateOutlineText = (id: string, text: string) => {
        setOutlineTree((previous) => updateOutlineNodes(previous, id, (node) => ({...node, text})));
    };

    const removeOutlineNode = (id: string) => {
        setOutlineTree((previous) => updateOutlineNodes(previous, id, () => null));
    };



    const createNewArticle = () => {
        setTitle('');
        setSubtitle('');
        setOutlineTree([]);
        setContent('');
        setEditorHtml('');
        editorHtmlRef.current = '';
        setEditingContent(false);
        setBoldMode(false);
        setHasLoadedDraft(true);
    };

    const generate = () => {
        const articleTitle = title.trim();
        if (!articleTitle) {
            message.warning('请先填写文章标题');
            return;
        }
        if (generating) {
            window.api.cancelPython();
            return;
        }

        setContent('');
        setGenerating(true);
        carryRef.current = '';
        const articleSubtitle = subtitle.trim();
        const articleOutline = outline.trim();
        const direction = [
            articleSubtitle ? `副标题（请保留并融入导语）：${articleSubtitle}` : '',
            articleOutline ? `用户拟定的文章脉络（必须严格遵循；可补充细节但不可偏离）：\n${articleOutline}` : '用户未提供文章脉络，请自行规划合理结构。',
        ].filter(Boolean).join('\n\n');
        const prompt = `请以微信公众号资深内容编辑的身份，围绕标题《${articleTitle}》创作一篇可直接发布的中文公众号文章。\n\n${direction}\n\n请补全导语、每个章节的具体论述和结语。语言自然、有洞察，使用 Markdown 排版：一级标题仅使用文章标题，若有副标题则紧随主标题以引用块呈现；正文用二级标题分段，适当使用加粗和列表。不要解释创作过程，不要包含“以下是文章”等前言。文章必须在结语处结束，不要在正文末尾追加面向用户的提问、下一步建议、封面图建议、保存草稿箱建议、发布确认话术或“请随时吩咐”等 AI 对话内容。`;

        window.api.runPython(
            {
                msg: prompt,
                history: [],
                interruptPrevious: false,
                authToken: getStoredToken() ?? undefined,
                apiUrl: import.meta.env.VITE_YOLK_API_URL ?? 'http://localhost:8080',
                logSessionId: `wechat-article-${Date.now()}`,
                isFirstMessage: true,
            },
            (data) => {
                const merged = carryRef.current + data;
                const lines = merged.split('\n');
                carryRef.current = lines.pop() ?? '';
                for (const line of lines) {
                    try {
                        const text = extractText(line.trim());
                        if (text) {
                            setContent((previous) => cleanArticleContent(previous + text));
                        }
                    } catch (error) {
                        message.error(error instanceof Error ? error.message : '生成失败');
                    }
                }
            },
            () => undefined,
            (code) => {
                const tail = carryRef.current.trim();
                if (tail) {
                    try {
                        const text = extractText(tail);
                        if (text) {
                            setContent((previous) => previous + text);
                        }
                    } catch (error) {
                        message.error(error instanceof Error ? error.message : '生成失败');
                    }
                }
                setGenerating(false);
                if (code !== null && code !== 0) {
                    message.error(`生成任务异常结束（退出码 ${code}）`);
                }
            }
        );
    };

    const syncEditorHtml = (html: string) => {
        editorHtmlRef.current = html;
        setContent(html);
    };

    const restoreEditorSelection = () => {
        const range = selectionRangeRef.current;
        if (!range) return;
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    };

    const rememberEditorSelection = () => {
        const selection = window.getSelection();
        const editor = editorRef.current;
        if (!selection?.rangeCount || !editor) return;

        const range = selection.getRangeAt(0);
        if (
            !range.collapsed &&
            editor.contains(range.startContainer) &&
            editor.contains(range.endContainer)
        ) {
            selectionRangeRef.current = range.cloneRange();
        }
    };

    useEffect(() => {
        document.addEventListener('selectionchange', rememberEditorSelection);
        return () => document.removeEventListener('selectionchange', rememberEditorSelection);
    }, []);

    const applyEditorCommand = (command: string, value?: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        restoreEditorSelection();
        document.execCommand(command, false, value);
        rememberEditorSelection();
        syncEditorHtml(editor.innerHTML);
    };

    const toggleBold = () => applyEditorCommand('bold');

    const toggleUnderline = () => applyEditorCommand('underline');

    const changeEditorFontFamily = (value: string) => {
        setFontFamily(value);
        applyEditorCommand('fontName', value);
    };

    const changeEditorTextColor = (value: string) => {
        const editor = editorRef.current;
        const liveSelection = window.getSelection();
        const liveRange = liveSelection?.rangeCount && editor?.contains(liveSelection.anchorNode)
            ? liveSelection.getRangeAt(0).cloneRange()
            : null;
        const range = liveRange ?? selectionRangeRef.current;
        if (!editor || !range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
            message.info('请先在文章中选中需要调整颜色的文字');
            return;
        }

        setTextColor(value);
        setCustomHexColor(value);
        const normalized = value.replace('#', '');
        const red = Number.parseInt(normalized.slice(0, 2), 16);
        const green = Number.parseInt(normalized.slice(2, 4), 16);
        const blue = Number.parseInt(normalized.slice(4, 6), 16);
        setCustomRgbColor(`${red}, ${green}, ${blue}`);
        applyEditorCommand('foreColor', value);
    };

    const applyCustomHexColor = () => {
        const normalized = customHexColor.trim().replace(/^#/, '');
        if (!/^[\da-fA-F]{6}$/.test(normalized)) {
            message.warning('请输入 6 位十六进制颜色，例如 #293548');
            return;
        }
        changeEditorTextColor(`#${normalized}`);
    };

    const applyCustomRgbColor = () => {
        const values = customRgbColor.match(/\d+/g)?.map(Number) ?? [];
        if (values.length !== 3 || values.some((value) => value < 0 || value > 255)) {
            message.warning('请输入 0–255 之间的 RGB 值，例如 41, 53, 72');
            return;
        }
        changeEditorTextColor(`#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`);
    };

    const changeEditorFontSize = (value: number) => {
        const editor = editorRef.current;
        const liveSelection = window.getSelection();
        const liveRange = liveSelection?.rangeCount && editor?.contains(liveSelection.anchorNode)
            ? liveSelection.getRangeAt(0).cloneRange()
            : null;
        const range = liveRange ?? selectionRangeRef.current;
        if (!editor || !range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
            message.info('请先在文章中选中需要调整字号的文字');
            return;
        }

        editor.focus();
        restoreEditorSelection();
        const selectedContent = range.extractContents();
        const span = document.createElement('span');
        span.style.fontSize = `${value}px`;
        span.appendChild(selectedContent);
        range.insertNode(span);

        const selection = window.getSelection();
        const selectedRange = document.createRange();
        selectedRange.selectNodeContents(span);
        selection?.removeAllRanges();
        selection?.addRange(selectedRange);
        selectionRangeRef.current = selectedRange.cloneRange();
        setFontSize(value);
        syncEditorHtml(editor.innerHTML);
    };

    const insertImage = (url: string, caption = '') => {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            message.warning('请输入图片地址');
            return;
        }
        setContent((previous) => `${previous.trim()}\n\n![${caption.trim() || '文章配图'}](${trimmedUrl})\n\n`);
        setImageUrl('');
        setImageCaption('');
        setImagePrompt('');
        setImageModalOpen(false);
        message.success('图片已插入文章');
    };

    const createAiImage = async () => {
        if (!imagePrompt.trim()) {
            message.warning('请描述你想要的配图');
            return;
        }
        setImageLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_YOLK_API_URL ?? 'http://localhost:8088'}/api/ai/image`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', ...(getStoredToken() ? {Authorization: `Bearer ${getStoredToken()}`} : {})},
                body: JSON.stringify({prompt: imagePrompt.trim(), title: title.trim()}),
            });
            const result = await response.json() as {data?: {url?: string}; message?: string};
            if (!response.ok || !result.data?.url) throw new Error(result.message || 'AI 配图生成失败');
            insertImage(result.data.url, imageCaption);
        } catch (error) {
            message.error(error instanceof Error ? error.message : 'AI 配图生成失败');
        } finally {
            setImageLoading(false);
        }
    };

    useEffect(() => {
        if (!editingContent || !content || editorHtmlRef.current) return;
        const html = isRichArticleContent(content) ? content : markdownToHtml(content);
        editorHtmlRef.current = html;
        setEditorHtml(html);
    }, [content, editingContent]);

    const copyContent = async () => {
        if (!content.trim()) return;
        const isRichContent = isRichArticleContent(content);
        const plainText = isRichContent ? htmlToMarkdown(content) : cleanArticleContent(content);
        const html = `<div style="font-family:Arial,'Microsoft YaHei',sans-serif;line-height:1.9;color:#293548">${isRichContent ? content : markdownToHtml(plainText)}</div>`;
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([html], {type: 'text/html'}),
                    'text/plain': new Blob([plainText], {type: 'text/plain'}),
                }),
            ]);
        } catch {
            await navigator.clipboard.writeText(plainText);
        }
        message.success('文章已复制，可直接粘贴到公众号编辑器');
    };

    const renderArticle = (markdown: string) => {
        const cleaned = cleanArticleContent(markdown);
        const displayContent = cleaned || markdown.trim();
        const blocks = displayContent.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
        return blocks.map((block, index) => {
            const lines = block.split('\n');
            const heading = lines[0].match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                const Heading = `h${heading[1].length}` as 'h1' | 'h2' | 'h3';
                return <Heading key={index}>{heading[2].replace(/\s+#+$/, '')}</Heading>;
            }
            if (lines.every((line) => /^[-*]\s+/.test(line))) {
                return <ul key={index}>{lines.map((line) => <li key={line}>{line.replace(/^[-*]\s+/, '')}</li>)}</ul>;
            }
            const image = lines[0].match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (image) return <figure key={index}><img src={image[2]} alt={image[1] || '文章配图'} /><figcaption>{image[1]}</figcaption></figure>;
            return <p key={index}>{block.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => part.startsWith('**') && part.endsWith('**') ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : part)}</p>;
        });
    };

    return (
        <section className="wechat-composer">
            <header className="wechat-composer__header">
                <button type="button" className="wechat-composer__back" onClick={onBack}>
                    <ArrowLeftOutlined/> 返回默认页面
                </button>
                <div>
                    <span className="wechat-composer__eyebrow">AI CONTENT STUDIO</span>
                    <h1>公众号编排</h1>
                    <p>拟定标题，剩下的内容交给 AI 完成。</p>
                </div>
                <div className="wechat-composer__header-actions">
                    <button type="button" className="wechat-composer__new" onClick={createNewArticle}><FileTextOutlined/> 新建</button>
                    <button type="button" className="wechat-composer__save" onClick={() => void saveDraft(true)} disabled={saving}>
                        <CheckOutlined/> {saving ? '保存中…' : '保存'}
                    </button>
                    <div className="wechat-composer__badge"><FileTextOutlined/> 微信公众号文章</div>
                </div>
            </header>

            <div
                ref={workspaceRef}
                className="wechat-composer__workspace"
                style={{gridTemplateColumns: `${leftWidth}px 8px minmax(360px, 1fr)`}}
            >
                <div className="wechat-composer__form">
                    <label htmlFor="article-title">文章标题</label>
                    <input
                        id="article-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && generate()}
                        placeholder="例如：真正拉开人与人差距的，是这 3 种能力"
                        maxLength={80}
                    />
                    <div className="wechat-composer__hint">
                        <span>输入一个清晰、有吸引力的标题</span>
                        <span>{title.length}/80</span>
                    </div>
                    <label htmlFor="article-subtitle">文章副标题 <span>可选</span></label>
                    <input
                        id="article-subtitle"
                        value={subtitle}
                        onChange={(event) => setSubtitle(event.target.value)}
                        placeholder="用一句话说明文章核心观点"
                        maxLength={100}
                    />
                    <div className="wechat-composer__outline-heading">
                        <label htmlFor="article-outline">文章脉络</label>
                        <span>流程图目录</span>
                    </div>
                    <div className="wechat-flow" aria-label="文章脉络流程图" style={{maxHeight: `${flowHeight}px`}}>
                        <div className="wechat-flow__hint">点击节点后的按钮，逐级搭建文章结构，最多支持 H4（文章标题为 H1）。</div>
                        <div className="wechat-flow__roots">
                            {outlineTree.length ? renderOutline(outlineTree, updateOutlineText, addOutlineNode, removeOutlineNode) : null}
                        </div>
                        <button type="button" className="wechat-flow__start" onClick={() => addOutlineNode(null, 1)}>
                            {outlineTree.length ? '+ 创建另一个 H2 二级标题' : '+ 创建 H2 二级标题'}
                        </button>
                    </div>
                    <button type="button" className="wechat-composer__generate" onClick={generate}>
                        {generating ? <ReloadOutlined spin/> : <SendOutlined/>}
                        {generating ? '停止生成' : content ? '重新生成' : 'AI 补全文章'}
                    </button>
                </div>
                <div
                    className={isDragging ? 'wechat-composer__splitter wechat-composer__splitter--dragging' : 'wechat-composer__splitter'}
                    role="separator"
                    aria-label="调整编辑区和预览区宽度"
                    aria-orientation="vertical"
                    onMouseDown={resizeWorkspace}
                />

                <article className="wechat-article">
                    <div className="wechat-article__toolbar">
                        <span>{generating ? '正在为你撰写文章…' : content ? 'AI 已完成文章，可复制到公众号编辑器' : '文章预览'}</span>
                        {lastSavedAt ? <small className="wechat-article__saved">最近保存：{new Date(lastSavedAt).toLocaleTimeString()}</small> : null}
                        {content ? (
                            <div className="wechat-article__actions">
                                <button type="button" onClick={() => { const nextEditing = !editingContent; if (nextEditing) editorHtmlRef.current = ''; setEditingContent(nextEditing); }}>{editingContent ? '完成编辑' : '编辑文章'}</button>
                                <button type="button" onClick={copyContent}><CopyOutlined/> 复制全文</button>
                            </div>
                        ) : null}
                    </div>
                    <div className="wechat-article__canvas">
                        {content ? editingContent ? (
                            <div className="wechat-editor">
                                <div className="wechat-editor__toolbar" role="toolbar" aria-label="文章格式工具栏" onMouseDownCapture={rememberEditorSelection}>
                                    <button type="button" className={boldMode ? 'is-active' : ''} onClick={toggleBold} title="加粗"><BoldOutlined/> 加粗</button>
                                    <button type="button" onClick={toggleUnderline} title="下划线"><UnderlineOutlined/> 下划线</button>
                                    <label><FontSizeOutlined/> 字号 <Select size="small" value={fontSize} onMouseDown={(event) => event.preventDefault()} onChange={changeEditorFontSize} options={[12, 14, 16, 18, 20, 24, 28, 32].map((value) => ({value, label: `${value}px`}))}/></label>
                                    <label>字体 <Select size="small" value={fontFamily} onChange={changeEditorFontFamily} options={[
                                        {value: "'Microsoft YaHei', sans-serif", label: '微软雅黑'},
                                        {value: "SimSun, serif", label: '宋体'},
                                        {value: "KaiTi, serif", label: '楷体'},
                                        {value: "FangSong, serif", label: '仿宋'},
                                        {value: "Arial, sans-serif", label: 'Arial'},
                                    ]}/></label>
                                    <div className="wechat-editor__color">
                                        <button
                                            type="button"
                                            className={isColorPaletteOpen ? 'is-active' : ''}
                                            onClick={() => setIsColorPaletteOpen((open) => !open)}
                                            aria-expanded={isColorPaletteOpen}
                                            aria-controls="wechat-editor-color-palette"
                                        >
                                            <FontColorsOutlined/> 颜色
                                            <span className="wechat-editor__color-preview" style={{backgroundColor: textColor}}/>
                                        </button>
                                        {isColorPaletteOpen ? (
                                            <div id="wechat-editor-color-palette" className="wechat-editor__color-popover" role="dialog" aria-label="选择文字颜色">
                                                <div className="wechat-editor__color-swatches" role="group" aria-label="预设文字颜色">
                                                    {EDITOR_TEXT_COLORS.map((color) => (
                                                        <button
                                                            key={color}
                                                            type="button"
                                                            className={textColor.toLowerCase() === color ? 'is-selected' : ''}
                                                            style={{backgroundColor: color}}
                                                            onClick={() => { changeEditorTextColor(color); setIsColorPaletteOpen(false); }}
                                                            aria-label={`选择颜色 ${color}`}
                                                            aria-pressed={textColor.toLowerCase() === color}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="wechat-editor__custom-colors">
                                                    <label>HEX<input value={customHexColor} onChange={(event) => setCustomHexColor(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applyCustomHexColor()} placeholder="#293548"/></label>
                                                    <button type="button" onClick={applyCustomHexColor}>应用</button>
                                                    <label>RGB<input value={customRgbColor} onChange={(event) => setCustomRgbColor(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applyCustomRgbColor()} placeholder="41, 53, 72"/></label>
                                                    <button type="button" onClick={applyCustomRgbColor}>应用</button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                    <button type="button" onClick={() => setImageModalOpen(true)}><PictureOutlined/> 插入图片</button>
                                </div>
                                <div
                                    ref={editorRef}
                                    onFocus={() => {
                                        if (!editorHtmlRef.current) {
                                            const html = markdownToHtml(content);
                                            editorHtmlRef.current = html;
                                            setEditorHtml(html);
                                        }
                                    }}
                                    className="wechat-editor__surface"
                                    contentEditable
                                    suppressContentEditableWarning
                                    role="textbox"
                                    aria-label="编辑公众号文章正文"
                                    style={{fontFamily}}
                                    dangerouslySetInnerHTML={{__html: editorHtml}}
                                    onMouseUp={rememberEditorSelection}
                                    onKeyUp={rememberEditorSelection}
                                    onSelect={rememberEditorSelection}
                                    onInput={(event) => { rememberEditorSelection(); syncEditorHtml(event.currentTarget.innerHTML); }}
                                />
                                <div className="wechat-editor__hint">像 Word 一样直接编辑：选中文本后点击「加粗」或调整字号，效果会即时显示。</div>
                            </div>
                        ) : (
                            <div
                                className="wechat-article__formatted"
                                aria-label="公众号文章正文预览"
                                {...(isRichArticleContent(content)
                                    ? {dangerouslySetInnerHTML: {__html: content}}
                                    : {children: renderArticle(content)})}
                            />
                        ) : (
                            <div className="wechat-article__empty">
                                <FileTextOutlined/>
                                <strong>等待你的标题</strong>
                                <span>AI 将为你生成完整的公众号文章初稿</span>
                            </div>
                        )}
                    </div>
                </article>
            </div>
            <Modal title="添加文章配图" open={imageModalOpen} onCancel={() => setImageModalOpen(false)} footer={null} destroyOnClose>
                <Tabs activeKey={imageTab} onChange={setImageTab} items={[
                    {key: 'search', label: <><SearchOutlined/> AI 搜索图片</>, children: <div className="wechat-image-panel"><Input placeholder="例如：春日公园里阅读的人，清新自然" value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} /><Input placeholder="图片说明（可选）" value={imageCaption} onChange={(event) => setImageCaption(event.target.value)} /><button type="button" onClick={() => { if (imageUrl.trim()) insertImage(imageUrl, imageCaption); else message.info('搜索能力需要配置图片搜索服务，请先粘贴图片 URL'); }}><SearchOutlined/> 搜索并插入</button></div>},
                    {key: 'generate', label: <><RobotOutlined/> AI 生成图片</>, children: <div className="wechat-image-panel"><Input.TextArea rows={3} placeholder="描述画面、风格和氛围，AI 将为你生成配图" value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} /><Input placeholder="图片说明（可选）" value={imageCaption} onChange={(event) => setImageCaption(event.target.value)} /><button type="button" disabled={imageLoading} onClick={createAiImage}><RobotOutlined/> {imageLoading ? '正在生成…' : '生成并插入'}</button></div>},
                    {key: 'url', label: <><UploadOutlined/> 图片地址</>, children: <div className="wechat-image-panel"><Input placeholder="粘贴图片 URL" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /><Input placeholder="图片说明（可选）" value={imageCaption} onChange={(event) => setImageCaption(event.target.value)} /><button type="button" onClick={() => insertImage(imageUrl, imageCaption)}><UploadOutlined/> 插入图片</button></div>},
                ]}/>
            </Modal>
        </section>
    );
}
