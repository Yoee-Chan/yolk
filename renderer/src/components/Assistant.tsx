import React from 'react';
import {SearchOutlined, SettingOutlined, CommentOutlined, MenuOutlined, ApiOutlined,LinkOutlined} from '@ant-design/icons';
import {Button, Flex} from 'antd';


type SettingProps = {
    activeItem: string;
    onClickItem: (item: string) => void;
};


const items = [{
    key: 'setting',
    icon: <SettingOutlined/>,
    label: '设置'
},
    {
        key: 'chat',
        icon: <CommentOutlined/>,
        label: '新任务编排'
    },
    {
        key: 'pipelineTask',
        icon: <ApiOutlined/>,
        label: '流水线任务'
    },
    {
        key: "tokenMange",
        icon: <MenuOutlined/>,
        label: '词元流量管理'

    },
    {
        key: 'skill',
        icon: <SearchOutlined/>,
        label: '能力扩展'
    },
    {
        key: 'connection',
        icon: <LinkOutlined />,
        label: '连接器'
    }
]


export default function Assistant({activeItem, onClickItem}: SettingProps) {
    const handleClick = (item: string) => {
        onClickItem(item);
    }

    return (
        <div className="config">
            <div>
                <h3>Yolk 助手 </h3>
            </div>
            <Flex vertical gap="small" style={{width: '100%'}}>
                {
                    items.map((item) => {
                        const isActive = item.key === activeItem;
                        return (
                            <div
                                key={item.key}
                                className={
                                    isActive
                                        ? 'assistant-nav-item assistant-nav-item--active'
                                        : 'assistant-nav-item'
                                }
                            >
                                <Button
                                    icon={item.icon}
                                    type="text"
                                    block
                                    iconPlacement="start"
                                    onClick={() => handleClick(item.key)}
                                    style={{justifyContent: 'flex-start'}}
                                >
                                    {item.label}
                                </Button>
                            </div>
                        );
                    })
                }
            </Flex>
        </div>
    );
}
