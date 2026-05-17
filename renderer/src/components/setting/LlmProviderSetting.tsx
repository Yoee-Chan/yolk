import React, {useCallback, useEffect, useState} from 'react';
import {Button, Card, Form, Input, Select, Slider, message} from 'antd';
import {SaveOutlined} from '@ant-design/icons';
import {callSetting, ProviderConfig, providerOptions} from './settingApi';

const defaultProviderConfig: ProviderConfig = {
    provider: 'openai',
    model: '',
    base_url: '',
    api_key: '',
    max_tokens: 8192,
    temperature: 0.7,
};

export default function LlmProviderSetting() {
    const [providerForm] = Form.useForm();
    const [providerConfig, setProviderConfig] = useState<ProviderConfig>(defaultProviderConfig);
    const [loading, setLoading] = useState(false);

    const loadProvider = useCallback(async () => {
        const result = await callSetting({SettingType: 'llm_provider', cmd: 'search'});
        const cfg = result as ProviderConfig;
        if (cfg) {
            setProviderConfig(cfg);
            providerForm.setFieldsValue(cfg);
        }
    }, [providerForm]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await loadProvider();
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init().catch(console.error);
    }, [loadProvider]);

    const handleSaveProvider = async (values: ProviderConfig) => {
        try {
            await callSetting({
                SettingType: 'llm_provider',
                cmd: 'update',
                Param: values as unknown as Record<string, string | number>,
            });
            setProviderConfig(values);
            message.success('LLM 配置已保存（已同步至 config.toml）');
        } catch (e) {
            message.error(e instanceof Error ? e.message : '保存失败');
        }
    };

    return (
        <Card title="LLM/Vision 服务商配置" className="setting-section" loading={loading}>
            <Form
                form={providerForm}
                layout="vertical"
                initialValues={providerConfig}
                onFinish={handleSaveProvider}
            >
                <Form.Item label="Provider" name="provider">
                    <Select options={providerOptions}/>
                </Form.Item>
                <Form.Item label="Model" name="model" rules={[{required: true}]}>
                    <Input placeholder="例如 qwen-plus"/>
                </Form.Item>
                <Form.Item label="Base URL" name="base_url" rules={[{required: true}]}>
                    <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"/>
                </Form.Item>
                <Form.Item label="API Key" name="api_key">
                    <Input.Password placeholder="留空则保持原密钥"/>
                </Form.Item>
                <Form.Item label="Max Tokens" name="max_tokens">
                    <Slider min={512} max={32768} step={512}/>
                </Form.Item>
                <Form.Item label="Temperature" name="temperature">
                    <Slider min={0} max={1} step={0.1}/>
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined/>}>
                    保存配置
                </Button>
            </Form>
        </Card>
    );
}
