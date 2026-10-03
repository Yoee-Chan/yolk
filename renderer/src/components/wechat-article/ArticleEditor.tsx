import React from 'react';
import {AlignCenterOutlined, AlignLeftOutlined, AlignRightOutlined, BoldOutlined, FontColorsOutlined, FontSizeOutlined, LinkOutlined, OrderedListOutlined, PictureOutlined, StrikethroughOutlined, UnorderedListOutlined, UnderlineOutlined} from '@ant-design/icons';
import {Input, Select} from 'antd';
import type {AnnotationMenuPosition} from './types';

const EDITOR_TEXT_COLORS = ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#cc0000', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#660000', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75'];

 type ArticleEditorProps = {
    editorRef: React.RefObject<HTMLDivElement | null>; title: string; subtitle: string; onTitleChange: (value: string) => void; onSubtitleChange: (value: string) => void; editorHtml: string; fontSize: number; fontFamily: string; textColor: string; boldMode: boolean; colorPaletteOpen: boolean; customHexColor: string; customRgbColor: string; annotation: string; selectedText: string; annotationMenu: AnnotationMenuPosition | null; annotationLoading: boolean; onRememberSelection: () => void; onFocus: () => void; onInput: (html: string) => void; onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void; onToggleBold: () => void; onToggleUnderline: () => void; onToggleItalic: () => void; onToggleStrikeThrough: () => void; onApplyBackgroundColor: (value: string) => void; onApplyBlockCommand: (command: 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'insertOrderedList' | 'insertUnorderedList') => void; onInsertLink: () => void; onFontSizeChange: (value: number) => void; onFontFamilyChange: (value: string) => void; onToggleColorPalette: () => void; onTextColorChange: (value: string) => void; onHexColorChange: (value: string) => void; onRgbColorChange: (value: string) => void; onApplyHexColor: () => void; onApplyRgbColor: () => void; onOpenImageModal: () => void; onAnnotationChange: (value: string) => void; onCloseAnnotation: () => void; onAnnotate: () => void;
};

export default function ArticleEditor(props: ArticleEditorProps) {
    const button = (label: string, icon: React.ReactNode, onClick: () => void, title = label) => <button type="button" onClick={onClick} title={title}>{icon} {label}</button>;
    return (
        <div className="wechat-editor">
            <div className="wechat-editor__toolbar" role="toolbar" aria-label="文章格式工具栏" onMouseDownCapture={props.onRememberSelection}>
                <div className="wechat-editor__toolbar-primary">
                    {button('加粗', <BoldOutlined/>, props.onToggleBold)}
                    {button('下划线', <UnderlineOutlined/>, props.onToggleUnderline)}
                    {button('斜体', <span className="wechat-editor__italic-icon">I</span>, props.onToggleItalic)}
                    {button('删除线', <StrikethroughOutlined/>, props.onToggleStrikeThrough)}
                    <div className="wechat-editor__color">
                        <button type="button" className={props.colorPaletteOpen ? 'is-active' : ''} onClick={props.onToggleColorPalette} aria-expanded={props.colorPaletteOpen} aria-controls="wechat-editor-color-palette"><FontColorsOutlined/> 颜色 <span className="wechat-editor__color-preview" style={{backgroundColor: props.textColor}}/></button>
                        {props.colorPaletteOpen ? <div id="wechat-editor-color-palette" className="wechat-editor__color-popover" role="dialog" aria-label="选择文字颜色"><div className="wechat-editor__color-swatches" role="group" aria-label="预设文字颜色">{EDITOR_TEXT_COLORS.map((color) => <button key={color} type="button" className={props.textColor.toLowerCase() === color ? 'is-selected' : ''} style={{backgroundColor: color}} onClick={() => props.onTextColorChange(color)} aria-label={`选择颜色 ${color}`} aria-pressed={props.textColor.toLowerCase() === color}/>)}</div><div className="wechat-editor__custom-colors"><label>HEX<input value={props.customHexColor} onChange={(event) => props.onHexColorChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && props.onApplyHexColor()} placeholder="#293548"/></label><button type="button" onClick={props.onApplyHexColor}>应用</button><label>RGB<input value={props.customRgbColor} onChange={(event) => props.onRgbColorChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && props.onApplyRgbColor()} placeholder="41, 53, 72"/></label><button type="button" onClick={props.onApplyRgbColor}>应用</button></div></div> : null}
                    </div>
                    {button('插入图片', <PictureOutlined/>, props.onOpenImageModal)}
                </div>
                <div className="wechat-editor__toolbar-more">
                    <label><FontSizeOutlined/> 字号 <Select size="small" value={props.fontSize} onMouseDown={(event) => event.preventDefault()} onChange={props.onFontSizeChange} options={[12, 14, 16, 18, 20, 24, 28, 32].map((value) => ({value, label: `${value}px`}))}/></label>
                    <label>字体 <Select size="small" value={props.fontFamily} onChange={props.onFontFamilyChange} options={[{value: "'Microsoft YaHei', sans-serif", label: '微软雅黑'}, {value: 'SimSun, serif', label: '宋体'}, {value: 'KaiTi, serif', label: '楷体'}, {value: 'FangSong, serif', label: '仿宋'}, {value: 'Arial, sans-serif', label: 'Arial'}]}/></label>
                    {button('背景色', <span className="wechat-editor__background-icon"/>, () => props.onApplyBackgroundColor('#fff2cc'))}
                    {button('左对齐', <AlignLeftOutlined/>, () => props.onApplyBlockCommand('justifyLeft'))}{button('居中', <AlignCenterOutlined/>, () => props.onApplyBlockCommand('justifyCenter'))}{button('右对齐', <AlignRightOutlined/>, () => props.onApplyBlockCommand('justifyRight'))}
                    {button('有序列表', <OrderedListOutlined/>, () => props.onApplyBlockCommand('insertOrderedList'))}{button('无序列表', <UnorderedListOutlined/>, () => props.onApplyBlockCommand('insertUnorderedList'))}{button('链接', <LinkOutlined/>, props.onInsertLink)}
                </div>
            </div>
            <div className="wechat-editor__scroll">
            <div className="wechat-editor__document-header"><input aria-label="文章标题" value={props.title} onChange={(event) => props.onTitleChange(event.target.value)} placeholder="请输入文章标题" maxLength={80}/><input aria-label="文章副标题" value={props.subtitle} onChange={(event) => props.onSubtitleChange(event.target.value)} placeholder="添加副标题（可选）" maxLength={100}/></div>
            <div ref={props.editorRef} onFocus={props.onFocus} className="wechat-editor__surface" contentEditable suppressContentEditableWarning role="textbox" aria-label="编辑公众号文章正文" style={{fontFamily: props.fontFamily}} dangerouslySetInnerHTML={{__html: props.editorHtml}} onMouseUp={props.onRememberSelection} onKeyUp={props.onRememberSelection} onSelect={props.onRememberSelection} onContextMenu={props.onContextMenu} onInput={(event) => props.onInput(event.currentTarget.innerHTML)}/>
            <div className="wechat-editor__hint">像 Word 一样直接编辑：选中文本后点击格式按钮；选中文本后右键可用 AI 批注修改。</div>
            {props.annotationMenu ? <div className="wechat-annotation-menu" style={{left: props.annotationMenu.x, top: props.annotationMenu.y}} onMouseDown={(event) => event.stopPropagation()}><div className="wechat-annotation-menu__selection">已选：{props.selectedText.slice(0, 42)}{props.selectedText.length > 42 ? '…' : ''}</div><Input.TextArea rows={3} autoFocus value={props.annotation} onChange={(event) => props.onAnnotationChange(event.target.value)} placeholder="例如：改得更简洁、更有说服力" onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); props.onAnnotate(); } }}/><div className="wechat-annotation-menu__actions"><button type="button" onClick={props.onCloseAnnotation}>取消</button><button type="button" disabled={props.annotationLoading} onClick={props.onAnnotate}>{props.annotationLoading ? '修改中…' : '发送批注'}</button></div></div> : null}
            </div>
        </div>
    );
}
