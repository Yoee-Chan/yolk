import React from 'react';
import type {OutlineNode} from './types';

type OutlineEditorProps = {
    nodes: OutlineNode[];
    onChange: (id: string, text: string) => void;
    onAdd: (parentId: string | null, level: number) => void;
    onRemove: (id: string) => void;
};

function OutlineItems({nodes, onChange, onAdd, onRemove}: OutlineEditorProps) {
    return nodes.map((node) => (
        <li key={node.id} className={`wechat-flow__item wechat-flow__item--h${node.level + 1}`}>
            <div className="wechat-flow__card">
                <span className="wechat-outline__marker">H{node.level + 1}</span>
                <input value={node.text} onChange={(event) => onChange(node.id, event.target.value)} placeholder="输入标题" aria-label={`H${node.level + 1} 标题`}/>
                {node.level < 3 ? <button type="button" className="wechat-flow__add" onClick={() => onAdd(node.id, node.level + 1)}>+ H{node.level + 2}</button> : null}
                <button type="button" className="wechat-flow__remove" onClick={() => onRemove(node.id)} aria-label="删除标题">×</button>
            </div>
            {node.children.length ? <div className="wechat-flow__children"><OutlineItems nodes={node.children} onChange={onChange} onAdd={onAdd} onRemove={onRemove}/></div> : null}
        </li>
    ));
}

export default function OutlineEditor(props: OutlineEditorProps) {
    return (
        <div className="wechat-flow" aria-label="文章脉络流程图">
            <div className="wechat-flow__hint">点击节点后的按钮，逐级搭建文章结构，最多支持 H4（文章标题为 H1）。</div>
            <div className="wechat-flow__roots">
                {props.nodes.length ? <OutlineItems {...props}/> : null}
            </div>
            <button type="button" className="wechat-flow__start" onClick={() => props.onAdd(null, 1)}>
                {props.nodes.length ? '+ 创建另一个 H2 二级标题' : '+ 创建 H2 二级标题'}
            </button>
        </div>
    );
}
