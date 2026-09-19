import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeftOutlined, CheckOutlined, CopyOutlined, FileTextOutlined, UploadOutlined} from '@ant-design/icons';
import {message} from 'antd';
import {AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun} from 'docx';
import {getStoredToken} from '../api/cloudApi';
import ArticleEditor from './wechat-article/ArticleEditor';
import ArticlePreview from './wechat-article/ArticlePreview';
import ArticleSidebar from './wechat-article/ArticleSidebar';
import ImageInsertModal from './wechat-article/ImageInsertModal';
import {cleanArticleContent, extractText, htmlToMarkdown, isRichArticleContent, markdownToHtml, outlineFromHtml, outlineToMarkdown, removeImportedNoise, updateOutlineNodes} from './wechat-article/articleUtils';
import type {AnnotationMenuPosition, OutlineNode} from './wechat-article/types';
import '../css/WeChatArticleComposer.css';

type WeChatArticleComposerProps = {
    onBack: () => void;
};

export default function WeChatArticleComposer({onBack}: WeChatArticleComposerProps) {
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [outlineTree, setOutlineTree] = useState<OutlineNode[]>([]);
    const [content, setContent] = useState('');
    const [editingContent, setEditingContent] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [leftWidth, setLeftWidth] = useState(264);
    const [isDragging, setIsDragging] = useState(false);
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
    const [annotation, setAnnotation] = useState('');
    const [selectedText, setSelectedText] = useState('');
    const [annotationMenu, setAnnotationMenu] = useState<AnnotationMenuPosition | null>(null);
    const [annotationLoading, setAnnotationLoading] = useState(false);
    const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
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
            await window.api.saveWechatArticle({...draft, updatedAt: new Date().toISOString()});
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



    const importWordDocument = async () => {
        setImporting(true);
        try {
            const imported = await window.api.importWechatDocx();
            if (!imported) return;
            const root = document.createElement('div');
            root.innerHTML = imported.html;
            const firstHeading = root.querySelector('h1, h2, h3');
            const importedTitle = firstHeading?.textContent?.trim() || imported.fileName.replace(/\.docx$/i, '');
            if (firstHeading?.tagName === 'H1') firstHeading.remove();
            const html = removeImportedNoise(root.innerHTML);
            setTitle(importedTitle);
            setSubtitle('');
            setOutlineTree(outlineFromHtml(html));
            setContent(html);
            editorHtmlRef.current = html;
            setEditorHtml(html);
            setEditingContent(true);
            message.success(`已导入 Word 文档：${imported.fileName}`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : 'Word 文档导入失败');
        } finally {
            setImporting(false);
        }
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
            setSelectedText(selection.toString());
        }
    };

    const openAnnotationMenu = (event: React.MouseEvent<HTMLDivElement>) => {
        rememberEditorSelection();
        const selection = window.getSelection();
        const text = selection?.toString().trim() ?? '';
        if (!text || !selectionRangeRef.current) {
            setAnnotationMenu(null);
            return;
        }
        event.preventDefault();
        setSelectedText(text);
        setAnnotationMenu({x: event.clientX, y: event.clientY});
    };

    const replaceSelectedText = (replacement: string) => {
        const editor = editorRef.current;
        const range = selectionRangeRef.current;
        if (!editor || !range || !replacement.trim()) return false;
        editor.focus();
        range.deleteContents();
        range.insertNode(document.createTextNode(replacement.trim()));
        syncEditorHtml(editor.innerHTML);
        selectionRangeRef.current = null;
        setSelectedText('');
        setAnnotationMenu(null);
        return true;
    };

    const annotateSelectedText = async () => {
        const selected = selectedText.trim();
        const instruction = annotation.trim();
        if (!selected || !instruction) {
            message.warning('请先选中文本并填写批注');
            return;
        }
        setAnnotationLoading(true);
        try {
            const result = await window.api.annotateWechatArticle({
                selectedText: selected,
                annotation: instruction,
                articleTitle: title.trim(),
                articleContent: htmlToMarkdown(editorRef.current?.innerHTML ?? content),
                authToken: getStoredToken() ?? undefined,
                apiUrl: import.meta.env.VITE_YOLK_API_URL ?? 'http://localhost:8080',
            });
            const replacement = result.replacement
                .replace(/^```(?:text|markdown)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .replace(/^\s*(?:替换文本|修改后文本|最终文本)\s*[:：]\s*/i, '')
                .trim();
            if (!replacement || replacement.includes('[系统]') || replacement.includes('正在评估是否需要权限')) {
                throw new Error('批注模型返回了无效内容，请重试');
            }
            replaceSelectedText(replacement);
            setAnnotation('');
            message.success('已根据批注更新选中文本');
        } catch (error) {
            message.error(error instanceof Error ? error.message : '批注修改失败');
        } finally {
            setAnnotationLoading(false);
        }
    };

    useEffect(() => {
        document.addEventListener('selectionchange', rememberEditorSelection);
        return () => document.removeEventListener('selectionchange', rememberEditorSelection);
    }, []);

    const applyEditorCommand = (command: 'bold' | 'underline' | 'fontName' | 'foreColor', value?: string) => {
        const editor = editorRef.current;
        const range = selectionRangeRef.current;
        if (!editor || !range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
            message.info('请先在文章中选中需要调整格式的文字');
            return;
        }

        editor.focus();
        restoreEditorSelection();
        const wrapper = command === 'bold'
            ? document.createElement('strong')
            : command === 'underline'
                ? document.createElement('u')
                : document.createElement('span');
        if (command === 'fontName') wrapper.style.fontFamily = value ?? fontFamily;
        if (command === 'foreColor') wrapper.style.color = value ?? textColor;
        wrapper.appendChild(range.extractContents());
        range.insertNode(wrapper);

        const selectedRange = document.createRange();
        selectedRange.selectNodeContents(wrapper);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(selectedRange);
        selectionRangeRef.current = selectedRange.cloneRange();
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

    const exportDocx = async () => {
        const source = isRichArticleContent(content) ? content : markdownToHtml(content);
        const root = document.createElement('div');
        root.innerHTML = source;
        const paragraphs: Paragraph[] = [];
        const addInline = (node: Node, formatting: {bold?: boolean; underline?: boolean} = {}): TextRun[] => Array.from(node.childNodes).flatMap((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                return [new TextRun({
                    text: child.textContent ?? '',
                    font: 'Microsoft YaHei',
                    size: 28,
                    bold: formatting.bold,
                    underline: formatting.underline ? {} : undefined,
                })];
            }
            if (child.nodeType !== Node.ELEMENT_NODE) return [];
            const element = child as HTMLElement;
            return addInline(element, {
                bold: formatting.bold || element.tagName === 'STRONG' || element.tagName === 'B',
                underline: formatting.underline || element.tagName === 'U',
            });
        });
        Array.from(root.children).forEach((element) => {
            const node = element as HTMLElement;
            const text = node.textContent?.trim() ?? '';
            if (!text && node.tagName !== 'IMG') return;
            const heading = /^H([1-3])$/.test(node.tagName) ? Number(node.tagName.slice(1)) : 0;
            const runs = addInline(node);
            paragraphs.push(new Paragraph({
                children: runs,
                heading: heading === 1 ? HeadingLevel.HEADING_1 : heading === 2 ? HeadingLevel.HEADING_2 : heading === 3 ? HeadingLevel.HEADING_3 : undefined,
                alignment: heading === 1 ? AlignmentType.CENTER : undefined,
                spacing: {line: 360, after: heading ? 240 : 180},
                style: heading ? undefined : 'Normal',
            }));
        });
        const doc = new Document({styles: {default: {document: {run: {font: 'Microsoft YaHei', size: 28}, paragraph: {spacing: {line: 360}}}}}, sections: [{children: paragraphs}]});
        const blob = await Packer.toBlob(doc);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${title.trim() || '微信公众号文章'}.docx`;
        link.click();
        URL.revokeObjectURL(link.href);
        message.success('Word 兼容 DOCX 已导出');
    };

    const copyContent = async () => {
        if (!content.trim()) return;
        const isRichContent = isRichArticleContent(content);
        const plainText = isRichContent ? htmlToMarkdown(content) : cleanArticleContent(content);
        const copyRoot = document.createElement('div');
        copyRoot.innerHTML = isRichContent ? content : markdownToHtml(plainText);
        copyRoot.style.cssText = "max-width:100%; box-sizing:border-box; font-family:Arial,'Microsoft YaHei',sans-serif; line-height:1.9; color:#293548; overflow-wrap:anywhere; word-break:break-word";
        copyRoot.querySelectorAll('img').forEach((image) => {
            image.removeAttribute('width');
            image.removeAttribute('height');
            image.style.cssText = 'display:block; width:auto; max-width:100%; height:auto; margin:22px auto;';
        });
        copyRoot.querySelectorAll('table').forEach((table) => {
            table.style.cssText = 'width:100%; max-width:100%; box-sizing:border-box; border-collapse:collapse;';
        });
        const html = copyRoot.outerHTML;
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
                    <button type="button" className="wechat-composer__new" onClick={() => void importWordDocument()} disabled={importing}><UploadOutlined/> {importing ? '导入中…' : '导入 Word'}</button>
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
                <ArticleSidebar
                    title={title}
                    subtitle={subtitle}
                    outlineTree={outlineTree}
                    generating={generating}
                    hasContent={Boolean(content)}
                    onTitleChange={setTitle}
                    onSubtitleChange={setSubtitle}
                    onOutlineChange={updateOutlineText}
                    onOutlineAdd={addOutlineNode}
                    onOutlineRemove={removeOutlineNode}
                    onGenerate={generate}
                />
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
                                <button type="button" onClick={exportDocx}><FileTextOutlined/> 导出 Word</button>
                                <button type="button" onClick={copyContent}><CopyOutlined/> 复制全文</button>
                            </div>
                        ) : null}
                    </div>
                    <div className="wechat-article__canvas">
                        {content && editingContent ? (
                            <ArticleEditor
                                editorRef={editorRef}
                                editorHtml={editorHtml}
                                fontSize={fontSize}
                                fontFamily={fontFamily}
                                textColor={textColor}
                                boldMode={boldMode}
                                colorPaletteOpen={isColorPaletteOpen}
                                customHexColor={customHexColor}
                                customRgbColor={customRgbColor}
                                annotation={annotation}
                                selectedText={selectedText}
                                annotationMenu={annotationMenu}
                                annotationLoading={annotationLoading}
                                onRememberSelection={rememberEditorSelection}
                                onFocus={() => {
                                    if (!editorHtmlRef.current) {
                                        const html = markdownToHtml(content);
                                        editorHtmlRef.current = html;
                                        setEditorHtml(html);
                                    }
                                }}
                                onInput={(html) => { rememberEditorSelection(); syncEditorHtml(html); }}
                                onContextMenu={openAnnotationMenu}
                                onToggleBold={toggleBold}
                                onToggleUnderline={toggleUnderline}
                                onFontSizeChange={changeEditorFontSize}
                                onFontFamilyChange={changeEditorFontFamily}
                                onToggleColorPalette={() => setIsColorPaletteOpen((open) => !open)}
                                onTextColorChange={(color) => { changeEditorTextColor(color); setIsColorPaletteOpen(false); }}
                                onHexColorChange={setCustomHexColor}
                                onRgbColorChange={setCustomRgbColor}
                                onApplyHexColor={applyCustomHexColor}
                                onApplyRgbColor={applyCustomRgbColor}
                                onOpenImageModal={() => setImageModalOpen(true)}
                                onAnnotationChange={setAnnotation}
                                onCloseAnnotation={() => setAnnotationMenu(null)}
                                onAnnotate={() => void annotateSelectedText()}
                            />
                        ) : <ArticlePreview content={content}/>}
                    </div>
                </article>
            </div>
            <ImageInsertModal
                open={imageModalOpen}
                activeTab={imageTab}
                imageUrl={imageUrl}
                caption={imageCaption}
                prompt={imagePrompt}
                loading={imageLoading}
                onClose={() => setImageModalOpen(false)}
                onTabChange={setImageTab}
                onImageUrlChange={setImageUrl}
                onCaptionChange={setImageCaption}
                onPromptChange={setImagePrompt}
                onInsert={insertImage}
                onSearchInsert={() => {
                    if (imageUrl.trim()) insertImage(imageUrl, imageCaption);
                    else message.info('搜索能力需要配置图片搜索服务，请先粘贴图片 URL');
                }}
                onGenerate={() => void createAiImage()}
            />
        </section>
    );
}
