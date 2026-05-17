import React, {useCallback, useEffect, useState} from 'react';
import {Button, Card, Flex, Form, Input, Select, Typography, message} from 'antd';
import {callSetting, MCPConfig} from './settingApi';

const {Text} = Typography;

export default function McpServerSetting() {
    const [mcpForm] = Form.useForm();
    const [formVisible, setFormVisible] = useState(false);
    const [config, setConfig] = useState<MCPConfig>({mcpServers: {}});
    const [loading, setLoading] = useState(false);

    const loadMcp = useCallback(async () => {
        const result = await callSetting({SettingType: 'mcp', cmd: 'search'});
        const cfg = result as MCPConfig;
        setConfig({mcpServers: cfg?.mcpServers || {}});
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await loadMcp();
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init().catch(console.error);
    }, [loadMcp]);

    const handleAddServer = async (values: { name: string; type: string; url: string }) => {
        try {
            await callSetting({
                SettingType: 'mcp',
                cmd: 'add',
                Param: {name: values.name, type: values.type, url: values.url},
            });
            message.success('MCP 服务器已添加');
            setFormVisible(false);
            mcpForm.resetFields();
            await loadMcp();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '添加失败');
        }
    };

    const handleDeleteServer = async (name: string) => {
        try {
            await callSetting({
                SettingType: 'mcp',
                cmd: 'delete',
                Param: {name},
            });
            message.success('已删除');
            await loadMcp();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '删除失败');
        }
    };

    return (
        <Card title="MCP 服务器配置" className="setting-section" loading={loading}>
            {Object.entries(config.mcpServers).map(([name, server]) => (
                <Flex
                    key={name}
                    justify="space-between"
                    align="center"
                    style={{padding: '8px 0', borderBottom: '1px solid #f0f0f0'}}
                >
                    <Flex align="center" gap={8} wrap="wrap">
                        <Text strong>{name}</Text>
                        <Text type="secondary">类型: {server.type}</Text>
                        <Text type="secondary">URL: {server.url}</Text>
                    </Flex>
                    <Button danger size="small" onClick={() => handleDeleteServer(name)}>
                        删除
                    </Button>
                </Flex>
            ))}

            <Button
                type="primary"
                style={{marginTop: 16}}
                onClick={() => setFormVisible(!formVisible)}
            >
                {formVisible ? '取消新增' : '新增服务器'}
            </Button>

            {formVisible && (
                <Form
                    form={mcpForm}
                    layout="vertical"
                    style={{marginTop: 16}}
                    onFinish={handleAddServer}
                >
                    <Form.Item
                        label="服务器名称"
                        name="name"
                        rules={[{required: true, message: '请输入服务器名称'}]}
                    >
                        <Input/>
                    </Form.Item>
                    <Form.Item
                        label="类型"
                        name="type"
                        initialValue="sse"
                        rules={[{required: true, message: '请选择类型'}]}
                    >
                        <Select
                            options={[
                                {value: 'sse', label: 'sse'},
                                {value: 'stdio', label: 'stdio'},
                                {value: 'ws', label: 'ws'},
                            ]}
                        />
                    </Form.Item>
                    <Form.Item
                        label="URL"
                        name="url"
                        rules={[{required: true, message: '请输入服务器 URL'}]}
                    >
                        <Input placeholder="http://localhost:8000/sse"/>
                    </Form.Item>
                    <Button type="primary" htmlType="submit">
                        保存
                    </Button>
                </Form>
            )}
        </Card>
    );
}
