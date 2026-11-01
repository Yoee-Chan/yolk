import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Empty, Modal, Spin } from 'antd';
import { CameraOutlined, ReloadOutlined, VideoCameraOutlined } from '@ant-design/icons';
import type { CameraDevice } from './types';

interface CameraPickerModalProps {
    open: boolean;
    cameras: CameraDevice[];
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onCancel: () => void;
    /** 传 null 表示使用系统默认摄像头 */
    onConfirm: (deviceIndex: number | null) => void;
}

const DEFAULT_DEVICE_VALUE = 'default';

/**
 * 虚拟宇宙入口弹框：让用户选择摄像头设备。
 * 第一阶段允许直接使用系统默认设备，下拉当前只做信息展示 + 默认项。
 */
export default function CameraPickerModal({
    open,
    cameras,
    loading,
    error,
    onRefresh,
    onCancel,
    onConfirm,
}: CameraPickerModalProps) {
    const [selected, setSelected] = useState<string>(DEFAULT_DEVICE_VALUE);

    useEffect(() => {
        if (open) setSelected(DEFAULT_DEVICE_VALUE);
    }, [open]);

    const defaultDeviceName = useMemo(
        () => (cameras.length > 0 ? cameras[0].name : '系统默认摄像头'),
        [cameras]
    );

    const handleOk = () => {
        const deviceIndex = selected === DEFAULT_DEVICE_VALUE ? null : Number(selected);
        onConfirm(deviceIndex);
    };

    return (
        <Modal
            open={open}
            title={
                <span className="vu-picker__title">
                    <VideoCameraOutlined /> 进入虚拟宇宙
                </span>
            }
            okText="开始扫描"
            cancelText="取消"
            onOk={handleOk}
            onCancel={onCancel}
            destroyOnHidden
            width={440}
            className="vu-picker"
        >
            <p className="vu-picker__hint">
                选择用于扫描的摄像头设备。设备画面将接入虚拟宇宙，用于把现实中的物品或人物
                采集为 AI 形象。
            </p>

            {error && (
                <Alert
                    type="warning"
                    showIcon
                    className="vu-picker__alert"
                    message="读取摄像头列表失败"
                    description={error}
                />
            )}

            <div className="vu-picker__list" role="radiogroup" aria-label="摄像头设备">
                <button
                    type="button"
                    role="radio"
                    aria-checked={selected === DEFAULT_DEVICE_VALUE}
                    className={
                        selected === DEFAULT_DEVICE_VALUE
                            ? 'vu-device-option vu-device-option--active'
                            : 'vu-device-option'
                    }
                    onClick={() => setSelected(DEFAULT_DEVICE_VALUE)}
                >
                    <span className="vu-device-option__icon">
                        <CameraOutlined />
                    </span>
                    <span className="vu-device-option__meta">
                        <span className="vu-device-option__name">系统默认摄像头</span>
                        <span className="vu-device-option__desc">{defaultDeviceName}</span>
                    </span>
                </button>

                {loading ? (
                    <div className="vu-picker__loading">
                        <Spin size="small" /> 正在读取设备列表…
                    </div>
                ) : cameras.length === 0 ? (
                    <Empty
                        className="vu-picker__empty"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="未检测到额外摄像头，将使用系统默认设备"
                    />
                ) : (
                    cameras.map((device) => {
                        const value = String(device.index);
                        const active = selected === value;
                        return (
                            <button
                                key={device.index}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                className={
                                    active
                                        ? 'vu-device-option vu-device-option--active'
                                        : 'vu-device-option'
                                }
                                onClick={() => setSelected(value)}
                            >
                                <span className="vu-device-option__icon">
                                    <CameraOutlined />
                                </span>
                                <span className="vu-device-option__meta">
                                    <span className="vu-device-option__name">{device.name}</span>
                                    <span className="vu-device-option__desc">
                                        设备 #{device.index + 1}
                                    </span>
                                </span>
                            </button>
                        );
                    })
                )}
            </div>

            <button type="button" className="vu-picker__refresh" onClick={onRefresh}>
                <ReloadOutlined /> 重新检测设备
            </button>
        </Modal>
    );
}
