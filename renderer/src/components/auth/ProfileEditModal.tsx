import React, {useEffect, useState} from 'react';
import {Modal, Form, Input, Button, Avatar, Upload, Tabs, message} from 'antd';
import {UserOutlined, UploadOutlined} from '@ant-design/icons';
import type {UploadProps} from 'antd';
import {useAuth} from '../../context/AuthContext';

type ProfileEditModalProps = {
    open: boolean;
    onClose: () => void;
};

const MAX_AVATAR_BYTES = 200 * 1024;

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
            if (file.size > MAX_AVATAR_BYTES) {
                message.error('Image must be under 200KB');
                return Upload.LIST_IGNORE;
            }
            const reader = new FileReader();
            reader.onload = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
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
            message.success('Profile updated');
            onClose();
        } catch (e) {
            message.error(e instanceof Error ? e.message : 'Update failed');
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
            message.error('New passwords do not match');
            return;
        }
        setSubmitting(true);
        try {
            await updatePassword(values.oldPassword, values.newPassword);
            message.success('Password updated');
            passwordForm.resetFields();
        } catch (e) {
            message.error(e instanceof Error ? e.message : 'Update failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title="Edit Profile"
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
                        label: 'Profile',
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
                                            Change Avatar
                                        </Button>
                                    </Upload>
                                </div>
                                <Form.Item
                                    name="nickname"
                                    label="Display Name"
                                    rules={[{required: true, message: 'Required'}]}
                                >
                                    <Input maxLength={64} />
                                </Form.Item>
                                <Button type="primary" htmlType="submit" block loading={submitting}>
                                    Save
                                </Button>
                            </Form>
                        ),
                    },
                    {
                        key: 'password',
                        label: 'Password',
                        children: (
                            <Form
                                form={passwordForm}
                                layout="vertical"
                                onFinish={savePassword}
                            >
                                <Form.Item
                                    name="oldPassword"
                                    label="Current Password"
                                    rules={[{required: true}]}
                                >
                                    <Input.Password />
                                </Form.Item>
                                <Form.Item
                                    name="newPassword"
                                    label="New Password"
                                    rules={[
                                        {required: true},
                                        {min: 6, message: 'At least 6 characters'},
                                    ]}
                                >
                                    <Input.Password />
                                </Form.Item>
                                <Form.Item
                                    name="confirm"
                                    label="Confirm New Password"
                                    rules={[{required: true}]}
                                >
                                    <Input.Password />
                                </Form.Item>
                                <Button type="primary" htmlType="submit" block loading={submitting}>
                                    Update Password
                                </Button>
                            </Form>
                        ),
                    },
                ]}
            />
        </Modal>
    );
}
