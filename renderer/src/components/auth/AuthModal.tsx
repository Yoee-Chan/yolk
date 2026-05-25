import React, {useState} from 'react';
import {Modal, Tabs, Form, Input, Button, message} from 'antd';
import {UserOutlined} from '@ant-design/icons';
import {useAuth} from '../../context/AuthContext';
import '../../css/auth.css';

type AuthModalProps = {
    open: boolean;
    onClose: () => void;
};

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function AuthModalTitle() {
    return (
        <div className="auth-modal__header">
            <div className="auth-modal__icon">
                <UserOutlined />
            </div>
            <AuthModalTitleText />
        </div>
    );
}

function AuthModalTitleText() {
    return (
        <div>
            <div className="auth-modal__title">欢迎使用 Yolk</div>
            <div className="auth-modal__subtitle">登录或注册以同步你的数据</div>
        </div>
    );
}

export default function AuthModal({open, onClose}: AuthModalProps) {
    const {login, registerEmail, registerPhone} = useAuth();
    const [tab, setTab] = useState('login');
    const [submitting, setSubmitting] = useState(false);
    const [loginForm] = Form.useForm();
    const [emailRegForm] = Form.useForm();
    const [phoneRegForm] = Form.useForm();

    const handleLogin = async (values: {account: string; password: string}) => {
        setSubmitting(true);
        try {
            await login(values.account.trim(), values.password);
            message.success('登录成功');
            loginForm.resetFields();
            onClose();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '登录失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEmailRegister = async (values: {
        email: string;
        password: string;
        confirm: string;
        nickname?: string;
    }) => {
        if (values.password !== values.confirm) {
            message.error('两次输入的密码不一致');
            return;
        }
        setSubmitting(true);
        try {
            await registerEmail(values.email.trim(), values.password, values.nickname?.trim());
            message.success('账户创建成功');
            emailRegForm.resetFields();
            onClose();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '注册失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePhoneRegister = async (values: {
        phone: string;
        password: string;
        confirm: string;
        nickname?: string;
    }) => {
        if (values.password !== values.confirm) {
            message.error('两次输入的密码不一致');
            return;
        }
        setSubmitting(true);
        try {
            await registerPhone(values.phone.trim(), values.password, values.nickname?.trim());
            message.success('账户创建成功');
            phoneRegForm.resetFields();
            onClose();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '注册失败');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={<AuthModalTitle />}
            open={open}
            onCancel={onClose}
            footer={null}
            width={440}
            destroyOnHidden
            className="auth-modal"
            centered
        >
            <Tabs
                activeKey={tab}
                onChange={setTab}
                className="auth-modal__tabs"
                items={[
                    {
                        key: 'login',
                        label: '登录',
                        children: (
                            <Form form={loginForm} layout="vertical" onFinish={handleLogin} className="auth-form">
                                <Form.Item
                                    name="account"
                                    label="邮箱或手机号"
                                    rules={[
                                        {required: true, message: '请输入邮箱或手机号'},
                                        {
                                            validator: (_, v) => {
                                                const s = (v || '').trim();
                                                if (!s) return Promise.resolve();
                                                if (EMAIL_RE.test(s) || PHONE_RE.test(s)) {
                                                    return Promise.resolve();
                                                }
                                                return Promise.reject(
                                                    new Error('请输入有效的邮箱或手机号')
                                                );
                                            },
                                        },
                                    ]}
                                >
                                    <Input placeholder="请输入邮箱或手机号" size="large" />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    label="密码"
                                    rules={[{required: true, message: '请输入密码'}]}
                                >
                                    <Input.Password placeholder="请输入密码" size="large" />
                                </Form.Item>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    loading={submitting}
                                    size="large"
                                    className="auth-submit-btn"
                                >
                                    登录
                                </Button>
                            </Form>
                        ),
                    },
                    {
                        key: 'register-email',
                        label: '邮箱注册',
                        children: (
                            <Form
                                form={emailRegForm}
                                layout="vertical"
                                onFinish={handleEmailRegister}
                                className="auth-form"
                            >
                                <Form.Item
                                    name="email"
                                    label="邮箱"
                                    rules={[
                                        {required: true, message: '请输入邮箱'},
                                        {pattern: EMAIL_RE, message: '邮箱格式不正确'},
                                    ]}
                                >
                                    <Input placeholder="name@example.com" size="large" />
                                </Form.Item>
                                <Form.Item name="nickname" label="昵称（选填）">
                                    <Input maxLength={64} placeholder="设置你的昵称" size="large" />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    label="密码"
                                    rules={[
                                        {required: true, message: '请输入密码'},
                                        {min: 6, message: '密码至少 6 个字符'},
                                    ]}
                                >
                                    <Input.Password placeholder="设置登录密码" size="large" />
                                </Form.Item>
                                <Form.Item
                                    name="confirm"
                                    label="确认密码"
                                    rules={[{required: true, message: '请再次输入密码'}]}
                                >
                                    <Input.Password placeholder="再次输入密码" size="large" />
                                </Form.Item>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    loading={submitting}
                                    size="large"
                                    className="auth-submit-btn"
                                >
                                    创建账户
                                </Button>
                            </Form>
                        ),
                    },
                    {
                        key: 'register-phone',
                        label: '手机号注册',
                        children: (
                            <Form
                                form={phoneRegForm}
                                layout="vertical"
                                onFinish={handlePhoneRegister}
                                className="auth-form"
                            >
                                <Form.Item
                                    name="phone"
                                    label="手机号"
                                    rules={[
                                        {required: true, message: '请输入手机号'},
                                        {pattern: PHONE_RE, message: '手机号格式不正确'},
                                    ]}
                                >
                                    <Input placeholder="13800138000" maxLength={11} size="large" />
                                </Form.Item>
                                <Form.Item name="nickname" label="昵称（选填）">
                                    <Input maxLength={64} placeholder="设置你的昵称" size="large" />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    label="密码"
                                    rules={[
                                        {required: true, message: '请输入密码'},
                                        {min: 6, message: '密码至少 6 个字符'},
                                    ]}
                                >
                                    <Input.Password placeholder="设置登录密码" size="large" />
                                </Form.Item>
                                <Form.Item
                                    name="confirm"
                                    label="确认密码"
                                    rules={[{required: true, message: '请再次输入密码'}]}
                                >
                                    <Input.Password placeholder="再次输入密码" size="large" />
                                </Form.Item>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    loading={submitting}
                                    size="large"
                                    className="auth-submit-btn"
                                >
                                    创建账户
                                </Button>
                            </Form>
                        ),
                    },
                ]}
            />
        </Modal>
    );
}
