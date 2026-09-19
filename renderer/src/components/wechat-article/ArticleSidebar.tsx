import React from 'react';
import {ReloadOutlined, SendOutlined} from '@ant-design/icons';
import OutlineEditor from './OutlineEditor';
import type {OutlineNode} from './types';

type ArticleSidebarProps = {
    title: string;
    subtitle: string;
    outlineTree: OutlineNode[];
    generating: boolean;
    hasContent: boolean;
    onTitleChange: (value: string) => void;
    onSubtitleChange: (value: string) => void;
    onOutlineChange: (id: string, text: string) => void;
    onOutlineAdd: (parentId: string | null, level: number) => void;
    onOutlineRemove: (id: string) => void;
    onGenerate: () => void;
};

export default function ArticleSidebar({
    title,
    subtitle,
    outlineTree,
    generating,
    hasContent,
    onTitleChange,
    onSubtitleChange,
    onOutlineChange,
    onOutlineAdd,
    onOutlineRemove,
    onGenerate,
}: ArticleSidebarProps) {
    return (
        <aside className="wechat-composer__form" aria-label="文章设置与目录">
            <label htmlFor="article-title">文章标题</label>
            <input
                id="article-title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onGenerate()}
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
                onChange={(event) => onSubtitleChange(event.target.value)}
                placeholder="用一句话说明文章核心观点"
                maxLength={100}
            />

            <div className="wechat-composer__outline-heading">
                <span>文章脉络</span>
                <span>流程图目录</span>
            </div>
            <OutlineEditor
                nodes={outlineTree}
                onChange={onOutlineChange}
                onAdd={onOutlineAdd}
                onRemove={onOutlineRemove}
            />

            <button type="button" className="wechat-composer__generate" onClick={onGenerate}>
                {generating ? <ReloadOutlined spin/> : <SendOutlined/>}
                {generating ? '停止生成' : hasContent ? '重新生成' : 'AI 补全文章'}
            </button>
        </aside>
    );
}
