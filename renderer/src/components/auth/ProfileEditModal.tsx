import React, {useEffect, useState} from 'react';
import {Modal, Form, Input, Button, Avatar, Upload, Tabs, message} from 'antd';
import {UserOutlined, UploadOutlined} from '@ant-design/icons';
import type {UploadProps} from 'antd';
import {useAuth} from '../../context/AuthContext';
import {fileToAvatarDataUrl, MAX_AVATAR_FILE_BYTES} from '../../utils/avatarImage';

type ProfileEditModalProps = {
    open: boolean;
    onClose: () => void;
};

export default function ProfileEditModal({open, onClose}: ProfileEditModalProps) {
    const {user, updateProfile, updatePassword} = useAuth();
    const [profileForm] = Form.useForm();
    const [passwordForm] = Form.useForm();
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open && user) {
            profileForm.setFieldsValue({nickname: user.nickname});
            setAvatarPreview(user.avatarUrl);
        }
    }, [open, user, profileForm]);

    const uploadProps: UploadProps = {
        showUploadList: false,
        accept: 'image/*',
        beforeUpload: (file) => {
            if (file.size > MAX_AVATAR_FILE_BYTES) {
                message.error('头像图片不能超过 2M');
                return Upload.LIST_IGNORE;
            }
            void fileToAvatarDataUrl(file)
                .then(setAvatarPreview)
                .catch((e) => {
                    message.error(e instanceof Error ? e.message : '图片处理失败');
                });
            return false;
        },
    };

    const saveProfile = async (values: {nickname: string}) => {
        setSubmitting(true);
        try {
            await updateProfile({
                nickname: values.nickname.trim(),
                avatarUrl: avatarPreview,
            });
            message.success('资料已保存');
            onClose();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '保存失败');
        } finally {
            setSubmitting(false);
        }
    };

    const savePassword = async (values: {
        oldPassword: string;
        newPassword: string;
        confirm: string;
    }) => {
        if (values.newPassword !== values.confirm) {
            message.error('两次输入的新密码不一致');
            return;
        }
        setSubmitting(true);
        try {
            await updatePassword(values.oldPassword, values.newPassword);
            message.success('密码已更新');
            passwordForm.resetFields();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '更新失败');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title="编辑资料"
            open={open}
            onCancel={onClose}
            footer={null}
            width={440}
            destroyOnHidden
            className="auth-modal"
        >
            <Tabs
                items={[
                    {
                        key: 'profile',
                        label: '资料',
                        children: (
                            <Form form={profileForm} layout="vertical" onFinish={saveProfile}>
                                <div className="profile-edit-avatar">
                                    <Avatar
                                        size={72}
                                        src={avatarPreview || undefined}
                                        icon={<UserOutlined />}
                                    />
                                    <Upload {...uploadProps}>
                                        <Button icon={<UploadOutlined />} size="small">
                                            更换头像
                                        </Button>
                                    </Upload>
                                </div>
                                <Form.Item
                                    name="nickname"
                                    label="显示名称"
                                    rules={[{required: true, message: '请输入显示名称'}]}
                                >
                                    <Input maxLength={64} />
                                </Form.Item>
                                <Button type="primary" htmlType="submit" block loading={submitting}>
                                    保存
                                </Button>
                            </Form>
                        ),
                    },
                    {
                        key: 'password',
                        label: '密码',
                        children: (
                            <Form
                                form={passwordForm}
                                layout="vertical"
                                onFinish={savePassword}
                            >
                                <Form.Item
                                    name="oldPassword"
                                    label="当前密码"
                                    rules={[{required: true, message: '请输入当前密码'}]}
                                >
                                    <Input.Password placeholder="请输入当前密码" />
                                </Form.Item>
                                <Form.Item
                                    name="newPassword"
                                    label="新密码"
                                    rules={[
                                        {required: true, message: '请输入新密码'},
                                        {min: 6, message: '密码至少 6 位'},
                                    ]}
                                >
                                    <Input.Password placeholder="请输入新密码" />
                                </Form.Item>
                                <Form.Item
                                    name="confirm"
                                    label="确认新密码"
                                    rules={[{required: true, message: '请再次输入新密码'}]}
                                >
                                    <Input.Password placeholder="请再次输入新密码" />
                                </Form.Item>
                                <Button type="primary" htmlType="submit" block loading={submitting}>
                                    更新密码
                                </Button>
                            </Form>
                        ),
                    },
                ]}
            />
        </Modal>
    );
}
