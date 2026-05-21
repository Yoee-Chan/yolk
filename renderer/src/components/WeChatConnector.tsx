import React, {useCallback, useEffect, useState} from 'react';
import {
    Alert,
    Button,
    Card,
    Form,
    Input,
    Space,
    Typography,
    message,
} from 'antd';
import {LogoutOutlined, SaveOutlined} from '@ant-design/icons';
import {callSetting} from './setting/settingApi';

const {Text, Paragraph} = Typography;

const DEFAULT_API_BASE = 'https://api.weixin.qq.com';

interface WeChatStatus {
    account_name: string;
    app_id: string;
    connected: boolean;
    api_base_url: string;
    default_author: string;
    has_app_secret: boolean;
}

type WeChatConnectorProps = {
    embedded?: boolean;
};

export default function WeChatConnector({embedded = false}: WeChatConnectorProps) {
    const [form] = Form.useForm();
    const [status, setStatus] = useState<WeChatStatus | null>(null);
    const [loading, setLoading] = useState(false);

    const loadStatus = useCallback(async () => {
        try {
            const result = await callSetting({
                SettingType: 'wechat_connector',
                cmd: 'search',
            });
            const inner = result as WeChatStatus;
            setStatus(inner);
            form.setFieldsValue({
                account_name: inner.account_name || '',
                app_id: inner.app_id || '',
                api_base_url: inner.api_base_url || DEFAULT_API_BASE,
                default_author: inner.default_author || '',
            });
            return inner;
        } catch (e) {
            console.error(e);
            return null;
        }
    }, [form]);

    useEffect(() => {
        loadStatus().catch(console.error);
    }, [loadStatus]);

    const onSave = async (values: {
        account_name?: string;
        app_id: string;
        app_secret?: string;
        api_base_url?: string;
        default_author?: string;
    }) => {
        setLoading(true);
        try {
            if (status?.connected) {
                await callSetting({
                    SettingType: 'wechat_connector',
                    cmd: 'update',
                    Param: {
                        account_name: values.account_name || '',
                        api_base_url: values.api_base_url || DEFAULT_API_BASE,
                        default_author: values.default_author || '',
                        ...(values.app_secret ? {app_secret: values.app_secret} : {}),
                    },
                });
                message.success('配置已更新');
            } else {
                if (!values.app_secret?.trim()) {
                    message.warning('首次保存请填写 AppSecret');
                    return;
                }
                await callSetting({
                    SettingType: 'wechat_connector',
                    cmd: 'add',
                    Param: {
                        account_name: values.account_name || '',
                        app_id: values.app_id,
                        app_secret: values.app_secret,
                        api_base_url: values.api_base_url || DEFAULT_API_BASE,
                        default_author: values.default_author || '',
                    },
                });
                message.success('微信公众号连接器已保存，凭据已加密存储在本机');
            }
            form.setFieldValue('app_secret', '');
            await loadStatus();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '保存失败');
        } finally {
            setLoading(false);
        }
    };

    const onTest = async () => {
        const values = form.getFieldsValue();
        setLoading(true);
        try {
            const param: Record<string, string> = {};
            if (values.app_id) param.app_id = values.app_id;
            if (values.app_secret) param.app_secret = values.app_secret;
            if (values.api_base_url) param.api_base_url = values.api_base_url;
            if (values.account_name) param.account_name = values.account_name;

            const result = await callSetting({
                SettingType: 'wechat_connector',
                cmd: 'test',
                Param: Object.keys(param).length ? param : undefined,
            });
            const data =
                typeof result === 'string' ? JSON.parse(result) : result;
            message.success(
                `连接成功${(data as {account_name?: string}).account_name ? `：${(data as {account_name?: string}).account_name}` : ''}`
            );
        } catch (e) {
            message.error(e instanceof Error ? e.message : '连接测试失败');
        } finally {
            setLoading(false);
        }
    };

    const onDisconnect = async () => {
        setLoading(true);
        try {
            await callSetting({
                SettingType: 'wechat_connector',
                cmd: 'delete',
            });
            message.info('已清除微信公众号连接器配置');
            setStatus(null);
            form.resetFields();
            await loadStatus();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '清除失败');
        } finally {
            setLoading(false);
        }
    };

    const connectionExtra = status?.connected ? (
        <Text type="success">
            已连接
            {status.account_name ? ` · ${status.account_name}` : ''}
        </Text>
    ) : (
        <Text type="secondary">未连接</Text>
    );

    const inner = (
        <>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                title="填写 AppID 与 AppSecret 后保存。直连微信需配置 IP 白名单；若使用自建代理，将 API 基址改为代理地址即可。"
            />

            <Form form={form} layout="vertical" onFinish={onSave}>
                <Form.Item
                    label="公众号名称（展示用）"
                    name="account_name"
                >
                    <Input placeholder="例如：我的品牌号" />
                </Form.Item>
                <Form.Item
                    label="AppID"
                    name="app_id"
                    rules={[{required: true, message: '请输入 AppID'}]}
                >
                    <Input placeholder="微信公众平台 → 开发 → 基本配置" />
                </Form.Item>
                <Form.Item
                    label="AppSecret"
                    name="app_secret"
                    rules={
                        status?.has_app_secret
                            ? []
                            : [{required: true, message: '请输入 AppSecret'}]
                    }
                    extra={
                        status?.has_app_secret
                            ? '已保存 Secret；若不修改请留空。'
                            : '仅保存在本机，不会上传。'
                    }
                >
                    <Input.Password placeholder="AppSecret" />
                </Form.Item>
                <Form.Item
                    label="API 基址（代理转发）"
                    name="api_base_url"
                    rules={[{required: true}]}
                    extra="直连微信填 https://api.weixin.qq.com；使用服务器代理时填代理根地址，例如 https://your-server.com/wechat"
                >
                    <Input placeholder={DEFAULT_API_BASE} />
                </Form.Item>
                <Form.Item
                    label="默认作者（可选）"
                    name="default_author"
                    extra="对话未指定作者时使用"
                >
                    <Input placeholder="作者名" style={{maxWidth: 280}} />
                </Form.Item>

                <Space wrap>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={loading}
                    >
                        {status?.connected ? '更新配置' : '保存并连接'}
                    </Button>
                    <Button onClick={onTest} loading={loading}>
                        测试连接
                    </Button>
                    {status?.connected && (
                        <Button
                            danger
                            icon={<LogoutOutlined />}
                            onClick={onDisconnect}
                            loading={loading}
                        >
                            清除配置
                        </Button>
                    )}
                </Space>
            </Form>

            {status?.connected && (
                <Paragraph type="secondary" style={{marginTop: 16, marginBottom: 0}}>
                    已配置 AppID：<Text code>{status.app_id}</Text>
                </Paragraph>
            )}
        </>
    );

    if (embedded) {
        return (
            <Card
                className="setting-section"
                extra={connectionExtra}
                styles={{body: {paddingTop: 0}}}
            >
                {inner}
            </Card>
        );
    }

    return (
        <Card title="微信公众号连接器" className="setting-section" extra={connectionExtra}>
            {inner}
        </Card>
    );
}
