import React from 'react';
import {FileTextOutlined} from '@ant-design/icons';
import {cleanArticleContent, isRichArticleContent} from './articleUtils';

type ArticlePreviewProps = {
    content: string;
};

function renderMarkdown(markdown: string) {
    const cleaned = cleanArticleContent(markdown);
    const displayContent = cleaned || markdown.trim();
    return displayContent.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean).map((block, index) => {
        const lines = block.split('\n');
        const heading = lines[0].match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            const Heading = `h${heading[1].length}` as 'h1' | 'h2' | 'h3';
            return <Heading key={index}>{heading[2].replace(/\s+#+$/, '')}</Heading>;
        }
        if (lines.every((line) => /^[-*]\s+/.test(line))) {
            return <ul key={index}>{lines.map((line, lineIndex) => <li key={`${lineIndex}-${line}`}>{line.replace(/^[-*]\s+/, '')}</li>)}</ul>;
        }
        const image = lines[0].match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (image) return <figure key={index}><img src={image[2]} alt={image[1] || '文章配图'}/><figcaption>{image[1]}</figcaption></figure>;
        return <p key={index}>{block.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => part.startsWith('**') && part.endsWith('**') ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : part)}</p>;
    });
}

export default function ArticlePreview({content}: ArticlePreviewProps) {
    if (!content) {
        return <div className="wechat-article__empty"><FileTextOutlined/><strong>等待你的标题</strong><span>AI 将为你生成完整的公众号文章初稿</span></div>;
    }
    return (
        <div
            className="wechat-article__formatted"
            aria-label="公众号文章正文预览"
            {...(isRichArticleContent(content) ? {dangerouslySetInnerHTML: {__html: content}} : {children: renderMarkdown(content)})}
        />
    );
}
