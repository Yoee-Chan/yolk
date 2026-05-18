import React, {useCallback, useEffect, useState} from 'react';
import {
    Alert,
    Button,
    Card,
    Divider,
    Form,
    Input,
    Space,
    Steps,
    Typography,
    message,
} from 'antd';
import {LinkOutlined, LoginOutlined, LogoutOutlined, SaveOutlined} from '@ant-design/icons';
import {callSetting} from './setting/settingApi';

const {Text, Paragraph, Link} = Typography;

const REDIRECT_URI = 'http://localhost:8765/callback';
const ATLASSIAN_DEV_CONSOLE =
    'https://developer.atlassian.com/console/myapps/';

interface JiraStatus {
    site_url: string;
    email: string;
    connected: boolean;
    auth_type?: string;
    default_project_key: string;
    display_name: string;
}

interface OAuthAppStatus {
    configured: boolean;
    client_id: string;
    redirect_uri: string;
    has_client_secret: boolean;
}

type JiraConnectorProps = {
    /** 嵌入连接器详情页时使用，隐藏外层标题卡片样式由父级承担 */
    embedded?: boolean;
};

export default function JiraConnector({embedded = false}: JiraConnectorProps) {
    const [form] = Form.useForm();
    const [appForm] = Form.useForm();
    const [status, setStatus] = useState<JiraStatus | null>(null);
    const [appStatus, setAppStatus] = useState<OAuthAppStatus | null>(null);
    const [loading, setLoading] = useState(false);

    const loadAppStatus = useCallback(async () => {
        const result = await callSetting({
            SettingType: 'jira_connector',
            cmd: 'oauth_app_status',
        });
        const app = result as OAuthAppStatus;
        setAppStatus(app);
        appForm.setFieldsValue({
            client_id: app.client_id || '',
            redirect_uri: app.redirect_uri || REDIRECT_URI,
        });
        return app;
    }, [appForm]);

    const loadStatus = useCallback(async () => {
        try {
            const app = await loadAppStatus();
            const result = await callSetting({
                SettingType: 'jira_connector',
                cmd: 'search',
            });
            const inner = result as JiraStatus;
            setStatus(inner);
            form.setFieldsValue({
                default_project_key: inner.default_project_key || '',
            });
            return app;
        } catch (e) {
            console.error(e);
            return null;
        }
    }, [form, loadAppStatus]);

    useEffect(() => {
        loadStatus().catch(console.error);
    }, [loadStatus]);

    const onSaveOAuthApp = async (values: {
        client_id: string;
        client_secret?: string;
        redirect_uri?: string;
    }) => {
        setLoading(true);
        try {
            const result = await callSetting({
                SettingType: 'jira_connector',
                cmd: 'oauth_app_save',
                Param: {
                    client_id: values.client_id,
                    client_secret: values.client_secret || '',
                    redirect_uri: values.redirect_uri || REDIRECT_URI,
                },
            });
            setAppStatus(result as OAuthAppStatus);
            appForm.setFieldValue('client_secret', '');
            message.success('OAuth 应用配置已保存');
        } catch (e) {
            message.error(e instanceof Error ? e.message : '保存失败');
        } finally {
            setLoading(false);
        }
    };

    const onOAuthLogin = async () => {
        if (!appStatus?.configured) {
            message.warning('请先完成步骤 1～3：保存 Client ID 与 Client Secret');
            return;
        }
        setLoading(true);
        try {
            const default_project_key =
                form.getFieldValue('default_project_key') || '';
            await window.api.jiraOAuthLogin({default_project_key});
            message.success('Jira 登录成功，访问令牌已加密保存在本地');
            await loadStatus();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '登录失败');
        } finally {
            setLoading(false);
        }
    };

    const onTest = async () => {
        setLoading(true);
        try {
            const result = await callSetting({
                SettingType: 'jira_connector',
                cmd: 'test',
            });
            const data =
                typeof result === 'string' ? JSON.parse(result) : result;
            message.success(
                `连接成功：${(data as {displayName?: string}).displayName || 'OK'}`
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
                SettingType: 'jira_connector',
                cmd: 'delete',
            });
            message.info('已断开 Jira 连接器');
            setStatus(null);
            form.resetFields(['default_project_key']);
            await loadStatus();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '断开失败');
        } finally {
            setLoading(false);
        }
    };

    const onSaveDefaultProject = async () => {
        const pk = form.getFieldValue('default_project_key');
        setLoading(true);
        try {
            await callSetting({
                SettingType: 'jira_connector',
                cmd: 'update',
                Param: {default_project_key: pk || ''},
            });
            message.success('默认项目已更新');
            await loadStatus();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '保存失败');
        } finally {
            setLoading(false);
        }
    };

    const stepCurrent = status?.connected
        ? 3
        : appStatus?.configured
          ? 2
          : 0;

    const connectionExtra = status?.connected ? (
        <Text type="success">
            已连接
            {status.display_name ? ` · ${status.display_name}` : ''}
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
                title="按下面步骤操作一次即可；完成后 Agent 即可在 Jira 中创建任务。"
            />

            <Steps
                orientation="vertical"
                size="small"
                current={stepCurrent}
                style={{marginBottom: 24}}
                items={[
                    {
                        title: '在 Atlassian 创建 OAuth 应用',
                        content: (
                            <span>
                                打开{' '}
                                <Link
                                    href={ATLASSIAN_DEV_CONSOLE}
                                    target="_blank"
                                >
                                    Atlassian 开发者控制台
                                </Link>
                                ，创建应用类型选 <Text strong>OAuth 2.0 (3LO)</Text>
                                。在 Permissions 中勾选 Jira 的{' '}
                                <Text code>read:jira-work</Text>、
                                <Text code>write:jira-work</Text> 等权限。
                            </span>
                        ),
                    },
                    {
                        title: '填写回调地址（Callback URL）',
                        content: (
                            <span>
                                在应用设置里将 Callback URL 设为（须完全一致）：
                                <br />
                                <Text code copyable>
                                    {REDIRECT_URI}
                                </Text>
                            </span>
                        ),
                    },
                    {
                        title: '在本页填写 Client ID / Secret 并保存',
                        content: appStatus?.configured
                            ? '已保存 OAuth 应用配置，可修改后重新保存。'
                            : '从开发者控制台复制 Client ID 与 Client Secret 填入下方表单。',
                    },
                    {
                        title: '登录 Jira 并授权',
                        content: status?.connected
                            ? `已登录：${status.email || status.display_name || status.site_url}`
                            : '点击「登录 Jira」，在弹出窗口中用 Atlassian 账户授权。',
                    },
                ]}
            />

            <Card
                type="inner"
                title="步骤 3：OAuth 应用凭证"
                size="small"
                style={{marginBottom: 16}}
            >
                <Form
                    form={appForm}
                    layout="vertical"
                    onFinish={onSaveOAuthApp}
                    initialValues={{redirect_uri: REDIRECT_URI}}
                >
                    <Form.Item
                        label="Client ID"
                        name="client_id"
                        rules={[{required: true, message: '请输入 Client ID'}]}
                    >
                        <Input placeholder="从 Atlassian 开发者控制台复制" />
                    </Form.Item>
                    <Form.Item
                        label="Client Secret"
                        name="client_secret"
                        rules={
                            appStatus?.has_client_secret
                                ? []
                                : [
                                      {
                                          required: true,
                                          message: '请输入 Client Secret',
                                      },
                                  ]
                        }
                        extra={
                            appStatus?.has_client_secret
                                ? '已保存 Secret；若不修改请留空。'
                                : '仅保存在本机，不会上传。'
                        }
                    >
                        <Input.Password placeholder="从 Atlassian 开发者控制台复制" />
                    </Form.Item>
                    <Form.Item
                        label="回调地址（Redirect URI）"
                        name="redirect_uri"
                        rules={[{required: true}]}
                        extra="须与 Atlassian 应用中填写的 Callback URL 一致，一般无需修改。"
                    >
                        <Input readOnly />
                    </Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={loading}
                    >
                        保存 OAuth 配置
                    </Button>
                    {appStatus?.configured && (
                        <Text type="success" style={{marginLeft: 12}}>
                            ✓ 已配置
                        </Text>
                    )}
                </Form>
            </Card>

            <Card type="inner" title="步骤 4：登录与使用" size="small">
                {status?.connected && (
                    <Paragraph>
                        <Text type="secondary">站点：</Text>
                        <Text>{status.site_url || '—'}</Text>
                        <br />
                        <Text type="secondary">账户：</Text>
                        <Text>
                            {status.email || status.display_name || '—'}
                        </Text>
                    </Paragraph>
                )}

                <Form form={form} layout="vertical">
                    <Form.Item
                        label="默认项目键（可选，步骤 5）"
                        name="default_project_key"
                        extra="对话里未指定项目时使用，例如 PROJ"
                    >
                        <Input
                            placeholder="例如 PROJ"
                            style={{maxWidth: 240}}
                        />
                    </Form.Item>

                    <Space wrap>
                        {!status?.connected ? (
                            <Button
                                type="primary"
                                icon={<LoginOutlined />}
                                loading={loading}
                                disabled={!appStatus?.configured}
                                onClick={onOAuthLogin}
                            >
                                登录 Jira
                            </Button>
                        ) : (
                            <>
                                <Button onClick={onTest} loading={loading}>
                                    测试连接
                                </Button>
                                <Button
                                    onClick={onSaveDefaultProject}
                                    loading={loading}
                                >
                                    保存默认项目
                                </Button>
                                <Button
                                    danger
                                    icon={<LogoutOutlined />}
                                    onClick={onDisconnect}
                                    loading={loading}
                                >
                                    断开连接
                                </Button>
                            </>
                        )}
                    </Space>
                    {!appStatus?.configured && !status?.connected && (
                        <Paragraph
                            type="secondary"
                            style={{marginTop: 12, marginBottom: 0}}
                        >
                            请先保存上方的 Client ID / Secret，再点击登录。
                        </Paragraph>
                    )}
                </Form>

                {status?.connected && status.site_url && (
                    <>
                        <Divider style={{margin: '12px 0'}} />
                        <LinkOutlined />{' '}
                        <a
                            href={status.site_url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            打开 Jira 站点
                        </a>
                    </>
                )}
            </Card>
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
        <Card
            title="Jira 连接器"
            className="setting-section"
            extra={connectionExtra}
        >
            {inner}
        </Card>
    );
}
