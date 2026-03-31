import React from 'react';
import {SearchOutlined, SettingOutlined, CommentOutlined, MenuOutlined, ApiOutlined} from '@ant-design/icons';
import {Button, Flex} from 'antd';


type SettingProps = {
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
        key: 'found',
        icon: <SearchOutlined/>,
        label: '发现'
    }]


export default function Assistant({onClickItem}: SettingProps) {
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
                    items.map((item, i) => (
                        <Button key={i} icon={item.icon} type="text" iconPlacement="start"
                                onClick={() => handleClick(item.key)}
                                style={{justifyContent: 'flex-start'}}>
                            {item.label}
                        </Button>)
                    )
                }
            </Flex>
        </div>
    );
}
