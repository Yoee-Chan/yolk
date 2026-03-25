import React from 'react';
import {SearchOutlined} from '@ant-design/icons';
import {Button, Flex} from 'antd';

export interface ConfigState {
    safetyLevel: string;
    provider: string;
    model: string;
}

interface ConfigProps {
    config: ConfigState;
    setConfig: (config: ConfigState) => void;
}


const items = [{
    key: 'setting',
    icon: <SearchOutlined/>,
    label: '设置'
},
    {
        key: 'prod',
        icon: <SearchOutlined/>,
        label: '任务编排'
    },
    {
        key: 'found',
        icon: <SearchOutlined/>,
        label: '发现'
    }]
const handleClick = (item: string) => {
    console.log("item", item)
}

export default function Setting({config, setConfig}: ConfigProps) {
    return (
        <div className="config">
            <div>
                <h3>Yolk Assistant </h3>
            </div>

            <Flex vertical gap="small" style={{width: '100%'}}>

                {
                    items.map(item => (
                        <Button icon={item.icon} type="text" iconPlacement="start" onClick={() => handleClick(item.key)}
                                style={{justifyContent: 'flex-start'}}>
                            {item.label}
                        </Button>)
                    )
                }


            </Flex>


        </div>
    );
}
