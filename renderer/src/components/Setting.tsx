import React, {useState} from 'react';
import {Card, Typography, Button, Flex, Space, Input, Select, Form, Slider, Radio} from 'antd';
import {
    EditOutlined,
    DeleteOutlined,
    FolderOpenOutlined,
    SettingOutlined,
    PlusOutlined
} from '@ant-design/icons';
import '../css/Setting.css';

const {Text} = Typography;

interface MCPServer {
    type: string;
    url: string;
}

interface MCPConfig {
    mcpServers: Record<string, MCPServer>;
}

interface ProviderConfig {
    provider: string;
    model: string;
    base_url: string;
    api_key: string;
    max_tokens: number;
    temperature: number;
}

export default function Setting() {
    // ====== 事件函数（带类型） ======
    const onEditWorkspace = (): void => {
        console.log("edit workspace");
    };

    const onEditPath = (): void => {
        console.log("edit path");
    };

    const onRename = (dir: string): void => {
        console.log("rename", dir);
    };

    const onPermission = (dir: string): void => {
        console.log("permission", dir);
    };

    const onDelete = (dir: string): void => {
        console.log("delete", dir);
    };

    const onCreate = (): void => {
        console.log("create new directory");
    };

    const path: string = "/Users/chan/workspace";
    const directories: string[] = ["src", "config", "plugins", "logs"];

    // ====== MCP 配置状态 ======
    const [config, setConfig] = useState<MCPConfig>({
        mcpServers: {
            server1: {
                type: "sse",
                url: "http://localhost:8000/sse"
            }
        }
    });
    const [formVisible, setFormVisible] = useState(false);
    const [form] = Form.useForm();

    const handleAddServer = (values: { name: string; type: string; url: string }) => {
        setConfig(prev => ({
            mcpServers: {
                ...prev.mcpServers,
                [values.name]: {
                    type: values.type,
                    url: values.url
                }
            }
        }));
        setFormVisible(false);
        form.resetFields();
    };

    const handleDeleteServer = (name: string) => {
        const newServers = {...config.mcpServers};
        delete newServers[name];
        setConfig({mcpServers: newServers});
    };
    // ====== 服务商配置状态 ======
    const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
        provider: "openai",
        model: "qwen-plus",
        base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        api_key: "",
        max_tokens: 8192,
        temperature: 0.7,
    });
    const protocolOptions = [
        {value: 'sse', label: 'sse'},
        {value: 'ws', label: 'ws'},
        {value: 'http', label: 'http'},
    ];

    const handleSave = (values: ProviderConfig) => {
        setProviderConfig(values);
        console.log("保存配置:", values);
    };
    //=======风险等级配置===========
    const [riskLevel, setRiskLevel] = useState<number>(5); // 默认中级 (medium)
    const [confirmStrategy, setConfirmStrategy] = useState<string>("high");

    return (
        <div className="setting">
            {/*工作域 - WorkSpace*/}
            <div>
                <Card title="工作域 - WorkSpace">
                    {/* 路径展示 */}
                    <div style={{marginBottom: 16}}>
                        <Text strong>工作域路径：</Text>
                        <Text>{path}</Text>
                        <EditOutlined
                            style={{marginLeft: 8}}
                            onClick={onEditPath}
                        />
                    </div>

                    <div>
                        {directories.map((dir) => (
                            <Flex
                                key={dir}
                                justify="space-between"
                                align="center"
                                style={{
                                    padding: '8px 0',
                                    borderBottom: '1px solid #f0f0f0',
                                }}
                            >
                                {/* 左侧：图标 + 名称 */}
                                <Flex align="center" gap={8}>
                                    <FolderOpenOutlined/>
                                    <Text>{dir}</Text>
                                </Flex>

                                {/* 右侧：操作按钮 */}
                                <Space size={16}>
                                    <EditOutlined onClick={() => onRename(dir)}/>
                                    <SettingOutlined onClick={() => onPermission(dir)}/>
                                    <DeleteOutlined onClick={() => onDelete(dir)}/>
                                </Space>
                            </Flex>
                        ))}
                    </div>

                    {/* 创建新目录 */}
                    <Button
                        type="dashed"
                        block
                        icon={<PlusOutlined/>}
                        style={{marginTop: 16}}
                        onClick={onCreate}
                    >
                        新建子目录
                    </Button>
                </Card>
            </div>

            {/* MCP 服务器配置 Card */}
            <div style={{marginTop: 24}}>
                <Card title="MCP 服务器配置">
                    {Object.entries(config.mcpServers).map(([name, server]) => (
                        <Flex
                            key={name}
                            justify="space-between"
                            align="center"
                            style={{
                                padding: '8px 0',
                                borderBottom: '1px solid #f0f0f0',
                            }}
                        >
                            <Flex align="center" gap={8}>
                                <Text strong>{name}</Text>
                                <Text>类型: {server.type}</Text>
                                <Text>URL: {server.url}</Text>
                            </Flex>
                            <Button
                                danger
                                size="small"
                                onClick={() => handleDeleteServer(name)}
                            >
                                删除
                            </Button>
                        </Flex>
                    ))}

                    <Button
                        type="primary"
                        style={{marginTop: 16}}
                        onClick={() => setFormVisible(!formVisible)}
                    >
                        {formVisible ? "取消新增" : "新增服务器"}
                    </Button>

                    {formVisible && (
                        <Form
                            form={form}
                            layout="vertical"
                            style={{marginTop: 16}}
                            onFinish={handleAddServer}
                        >
                            <Form.Item
                                label="服务器名称"
                                name="name"
                                rules={[{required: true, message: "请输入服务器名称"}]}
                            >
                                <Input/>
                            </Form.Item>
                            <Form.Item
                                label="类型"
                                name="type"
                                rules={[{required: true, message: "请选择类型"}]}
                            >
                                <Select options={[
                                    {value: "sse", label: "sse"},
                                    {value: "ws", label: "ws"},
                                    {value: "http", label: "http"},
                                ]}>

                                </Select>
                            </Form.Item>
                            <Form.Item
                                label="URL"
                                name="url"
                                rules={[{required: true, message: "请输入服务器 URL"}]}
                            >
                                <Input/>
                            </Form.Item>
                            <Button type="primary" htmlType="submit">
                                保存
                            </Button>
                        </Form>
                    )}

                </Card>
            </div>
            {/*LLM 服务商*/}
            <div style={{marginTop: 24}}>
                <Card title="LLM/Vision 服务商配置">
                    <Form
                        form={form}
                        layout="vertical"
                        initialValues={providerConfig}
                        onFinish={handleSave}
                    >
                        <Form.Item label="Provider" name="provider">
                            <Select options={protocolOptions}/>
                        </Form.Item>

                        <Form.Item label="Model" name="model">
                            <Input/>
                        </Form.Item>

                        <Form.Item label="Base URL" name="base_url">
                            <Input/>
                        </Form.Item>

                        <Form.Item label="API Key" name="api_key">
                            <Input.Password/>
                        </Form.Item>

                        <Form.Item label="Max Tokens" name="max_tokens">
                            <Slider min={512} max={32768} step={512}/>
                        </Form.Item>

                        <Form.Item label="Temperature" name="temperature">
                            <Slider min={0} max={1} step={0.1}/>
                        </Form.Item>

                        <Button type="primary" htmlType="submit">
                            保存配置
                        </Button>
                    </Form>
                </Card>
            </div>
            {/* 风险等级*/}
            <Card title="风险等级配置" style={{marginTop: 24}}>
                {/* 风险等级滑块 */}
                <div style={{marginBottom: 24}}>
                    <Text strong>风险等级：</Text>
                    <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={riskLevel}
                        onChange={setRiskLevel}
                        marks={{
                            1: "更灵活",
                            5: "模糊",
                            10: "精确"
                        }}
                    />
                    <Text>当前等级: {riskLevel}</Text>
                </div>

                {/* 确认策略选择 */}
                <div>
                    <Text strong>动作确认策略：</Text>
                    <Radio.Group
                        onChange={(e) => setConfirmStrategy(e.target.value)}
                        value={confirmStrategy}
                        style={{marginTop: 12}}
                    >
                        <Space>
                            <Radio value="all">每个动作都确认</Radio>
                            <Radio value="high">只有高风险动作确认</Radio>
                            <Radio value="llm">LLM 自己决定什么时候问人类</Radio>
                        </Space>
                    </Radio.Group>
                </div>
            </Card>
        </div>
    );
}
