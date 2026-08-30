import React from 'react';
import {
    SearchOutlined,
    SettingOutlined,
    CommentOutlined,
    MenuOutlined,
    ApiOutlined,
    LinkOutlined,
    LayoutOutlined,
    WechatOutlined,
} from '@ant-design/icons';
import {SHOW_PIPELINE_TASK, SHOW_TOKEN_MANAGE} from '../config/featureFlags';

const yolkLogo = '/yolk-logo.png';

type SettingProps = {
    activeItem: string;
    onClickItem: (item: string) => void;
};

const items = [
    {key: 'chat', icon: <CommentOutlined/>, label: '新任务编排'},
    {key: 'wechatArticle', icon: <WechatOutlined/>, label: '公众号编排'},
    {key: 'pipelineTask', icon: <ApiOutlined/>, label: '流水线任务'},
    {key: 'tokenMange', icon: <MenuOutlined/>, label: '词元流量管理'},
    {key: 'skill', icon: <SearchOutlined/>, label: '能力扩展'},
    {key: 'connection', icon: <LinkOutlined/>, label: '连接器'},
    {key: 'setting', icon: <SettingOutlined/>, label: '设置'},
];

export default function Assistant({activeItem, onClickItem}: SettingProps) {
    return (
        <div className="sidebar-top">
            <div className="sidebar-header">
                <h2 className="sidebar-title">
                    <img
                        src={yolkLogo}
                        alt=""
                        className="sidebar-title__logo"
                        width={26}
                        height={26}
                        draggable={false}
                    />
                    <span>Yolk助手</span>
                </h2>
                <button
                    type="button"
                    className="sidebar-collapse-btn"
                    aria-label="收起侧边栏"
                >
                    <LayoutOutlined/>
                </button>
            </div>
            <nav className="sidebar-nav" aria-label="主导航">
                {items
                    .filter(
                        (item) =>
                            (item.key !== 'tokenMange' || SHOW_TOKEN_MANAGE) &&
                            (item.key !== 'pipelineTask' || SHOW_PIPELINE_TASK)
                    )
                    .map((item) => {
                    const isActive = item.key === activeItem;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            className={
                                isActive
                                    ? 'sidebar-nav-item sidebar-nav-item--active'
                                    : 'sidebar-nav-item'
                            }
                            onClick={() => onClickItem(item.key)}
                        >
                            <span className="sidebar-nav-item__icon">{item.icon}</span>
                            <span className="sidebar-nav-item__label">{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
