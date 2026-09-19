import React from 'react';
import {RobotOutlined, SearchOutlined, UploadOutlined} from '@ant-design/icons';
import {Input, Modal, Tabs} from 'antd';

type ImageInsertModalProps = {
    open: boolean;
    activeTab: string;
    imageUrl: string;
    caption: string;
    prompt: string;
    loading: boolean;
    onClose: () => void;
    onTabChange: (tab: string) => void;
    onImageUrlChange: (value: string) => void;
    onCaptionChange: (value: string) => void;
    onPromptChange: (value: string) => void;
    onInsert: (url: string, caption: string) => void;
    onSearchInsert: () => void;
    onGenerate: () => void;
};

export default function ImageInsertModal(props: ImageInsertModalProps) {
    const captionInput = <Input placeholder="图片说明（可选）" value={props.caption} onChange={(event) => props.onCaptionChange(event.target.value)}/>;
    return (
        <Modal title="添加文章配图" open={props.open} onCancel={props.onClose} footer={null} destroyOnClose>
            <Tabs activeKey={props.activeTab} onChange={props.onTabChange} items={[
                {key: 'search', label: <><SearchOutlined/> AI 搜索图片</>, children: <div className="wechat-image-panel"><Input placeholder="例如：春日公园里阅读的人，清新自然" value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)}/>{captionInput}<button type="button" onClick={props.onSearchInsert}><SearchOutlined/> 搜索并插入</button></div>},
                {key: 'generate', label: <><RobotOutlined/> AI 生成图片</>, children: <div className="wechat-image-panel"><Input.TextArea rows={3} placeholder="描述画面、风格和氛围，AI 将为你生成配图" value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)}/>{captionInput}<button type="button" disabled={props.loading} onClick={props.onGenerate}><RobotOutlined/> {props.loading ? '正在生成…' : '生成并插入'}</button></div>},
                {key: 'url', label: <><UploadOutlined/> 图片地址</>, children: <div className="wechat-image-panel"><Input placeholder="粘贴图片 URL" value={props.imageUrl} onChange={(event) => props.onImageUrlChange(event.target.value)}/>{captionInput}<button type="button" onClick={() => props.onInsert(props.imageUrl, props.caption)}><UploadOutlined/> 插入图片</button></div>},
            ]}/>
        </Modal>
    );
}
