import React, {useCallback, useEffect, useState} from 'react';
import {
    Button,
    Card,
    Flex,
    Form,
    Input,
    Modal,
    Popconfirm,
    Radio,
    Space,
    Typography,
    message,
} from 'antd';
import {
    DeleteOutlined,
    EditOutlined,
    FolderOpenOutlined,
    PlusOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import {callSetting, SubPathItem, WorkspaceData} from './settingApi';

const {Text} = Typography;

export default function WorkSpaceSetting() {
    const [path, setPath] = useState('');
    const [subPaths, setSubPaths] = useState<SubPathItem[]>([]);
    const [workspaceForm] = Form.useForm();
    const [permForm] = Form.useForm();
    const [isModalWorkSpaceOpen, setIsModalWorkSpaceOpen] = useState(false);
    const [permissionModal, setPermissionModal] = useState<SubPathItem | null>(null);
    const [loading, setLoading] = useState(false);

    const loadPaths = useCallback(async () => {
        const result = await callSetting({
            SettingType: 'workspace',
            cmd: 'search',
        });
        const ws = result as WorkspaceData;
        if (!ws) return;
        setPath(ws.workSpace || '');
        const items: SubPathItem[] = (ws.subPath || []).map((sub) => {
            const parts = sub.subPathName.split(/[\\/]+/);
            return {
                name: parts[parts.length - 1] || sub.subPathName,
                fullPath: sub.subPathName,
                permission: sub.permission,
            };
        });
        setSubPaths(items);
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await loadPaths();
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init().catch(console.error);
    }, [loadPaths]);

    const onEditPath = async (): Promise<void> => {
        const folder = await window.api.selectFolder();
        if (!folder) return;
        try {
            await callSetting({
                SettingType: 'workspace',
                cmd: 'update',
                Param: {workSpace: folder},
            });
            setPath(folder);
            message.success('工作域路径已更新');
            await loadPaths();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '更新失败');
        }
    };

    const handleWorkspaceOk = async (values: { name: string; permission: string }) => {
        try {
            await callSetting({
                SettingType: 'workspace',
                cmd: 'add',
                Param: {path: values.name, permission: values.permission},
            });
            message.success('子目录已添加');
            setIsModalWorkSpaceOpen(false);
            workspaceForm.resetFields();
            await loadPaths();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '添加失败');
        }
    };

    const onDelete = async (item: SubPathItem): Promise<void> => {
        try {
            await callSetting({
                SettingType: 'workspace',
                cmd: 'delete',
                Param: {path: item.fullPath},
            });
            message.success('已删除');
            await loadPaths();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '删除失败');
        }
    };

    const onPermissionSave = async (values: { permission: string }) => {
        if (!permissionModal) return;
        try {
            await callSetting({
                SettingType: 'workspace',
                cmd: 'update',
                Param: {path: permissionModal.fullPath, permission: values.permission},
            });
            message.success('权限已更新');
            setPermissionModal(null);
            await loadPaths();
        } catch (e) {
            message.error(e instanceof Error ? e.message : '更新失败');
        }
    };

    return (
        <Card title="工作域 - WorkSpace" loading={loading}>
            <div style={{marginBottom: 16}}>
                <Text strong>工作域路径：</Text>
                <Text>{path || '（未设置）'}</Text>
                <EditOutlined style={{marginLeft: 8, cursor: 'pointer'}} onClick={onEditPath}/>
            </div>

            <div>
                {subPaths.map((dir) => (
                    <Flex
                        key={dir.fullPath}
                        justify="space-between"
                        align="center"
                        style={{padding: '8px 0', borderBottom: '1px solid #f0f0f0'}}
                    >
                        <Flex align="center" gap={8}>
                            <FolderOpenOutlined/>
                            <Text>{dir.name}</Text>
                        </Flex>
                        <Text type="secondary">
                            {dir.permission === 'rw' ? '读写' : '只读'}
                        </Text>
                        <Space size={16}>
                            <SettingOutlined
                                style={{cursor: 'pointer'}}
                                onClick={() => {
                                    setPermissionModal(dir);
                                    permForm.setFieldsValue({permission: dir.permission});
                                }}
                            />
                            <Popconfirm
                                title="删除子目录"
                                description={`确定从工作域移除「${dir.name}」？`}
                                onConfirm={() => onDelete(dir)}
                                okText="确定"
                                cancelText="取消"
                            >
                                <DeleteOutlined style={{cursor: 'pointer'}}/>
                            </Popconfirm>
                        </Space>
                    </Flex>
                ))}
            </div>

            <Modal
                title="新建子文件夹"
                open={isModalWorkSpaceOpen}
                onOk={() => workspaceForm.validateFields().then(handleWorkspaceOk)}
                onCancel={() => setIsModalWorkSpaceOpen(false)}
            >
                <Form form={workspaceForm} layout="vertical">
                    <Form.Item
                        label="文件夹名称"
                        name="name"
                        rules={[{required: true, message: '请输入文件夹名称'}]}
                    >
                        <Input placeholder="相对于工作域根目录的名称"/>
                    </Form.Item>
                    <Form.Item label="权限" name="permission" initialValue="ro">
                        <Radio.Group>
                            <Radio value="ro">只读</Radio>
                            <Radio value="rw">读写</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="修改权限"
                open={!!permissionModal}
                onOk={() => permForm.validateFields().then(onPermissionSave)}
                onCancel={() => setPermissionModal(null)}
            >
                <Form form={permForm} layout="vertical">
                    <Form.Item label="权限" name="permission" rules={[{required: true}]}>
                        <Radio.Group>
                            <Radio value="ro">只读</Radio>
                            <Radio value="rw">读写</Radio>
                        </Radio.Group>
                    </Form.Item>
                </Form>
            </Modal>

            <Button
                type="dashed"
                block
                icon={<PlusOutlined/>}
                style={{marginTop: 16}}
                onClick={() => setIsModalWorkSpaceOpen(true)}
                disabled={!path}
            >
                新建子目录
            </Button>
        </Card>
    );
}
