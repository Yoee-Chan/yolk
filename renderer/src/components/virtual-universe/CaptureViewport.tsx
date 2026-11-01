import React from 'react';
import { Button, Spin } from 'antd';
import {
    CameraOutlined,
    ExpandOutlined,
    ReloadOutlined,
    StopOutlined,
} from '@ant-design/icons';
import type { PlayerState, PlayerStatus } from './types';

interface CaptureViewportProps {
    state: PlayerState;
    status: PlayerStatus | null;
    deviceName: string | null;
    errorMessage: string | null;
    onEnter: () => void;
    onStop: () => void;
    onRetry: () => void;
    onRefreshCameras: () => void;
}

/**
 * 虚拟宇宙舞台视口。
 *
 * 新架构下画面在独立原生全屏进程里渲染（零拷贝 blit），
 * 主窗口不再做任何逐帧绘制，这里只承担「状态呈现 + 入口操作」：
 * - idle / stopped：空态 + 进入按钮
 * - starting：连接中
 * - streaming：全屏运行中提示（分辨率 / 帧率 / 退出指引）
 * - error：失败原因 + 重试
 */
export default function CaptureViewport({
    state,
    status,
    deviceName,
    errorMessage,
    onEnter,
    onStop,
    onRetry,
    onRefreshCameras,
}: CaptureViewportProps) {
    return (
        <div className="vu-viewport">
            <div className="vu-viewport__overlay">
                {(state === 'idle' || state === 'stopped') && (
                    <div className="vu-empty">
                        <CameraOutlined className="vu-empty__icon" />
                        <p className="vu-empty__text">摄像头尚未接入</p>
                        {deviceName && (
                            <p className="vu-empty__sub">上次设备：{deviceName}</p>
                        )}
                        <Button type="primary" icon={<CameraOutlined />} onClick={onEnter}>
                            选择摄像头进入
                        </Button>
                    </div>
                )}

                {state === 'starting' && (
                    <div className="vu-empty">
                        <Spin size="large" />
                        <p className="vu-empty__text">
                            正在连接{deviceName ? `「${deviceName}」` : '摄像头'}…
                        </p>
                        <p className="vu-empty__sub">
                            正在拉起原生全屏播放器，首次连接可能弹出系统摄像头权限授权
                        </p>
                    </div>
                )}

                {state === 'streaming' && (
                    <div className="vu-live">
                        <div className="vu-live__badge">
                            <span className="vu-live__dot" />
                            全屏采集中
                        </div>
                        <p className="vu-live__title">画面已在独立全屏窗口中呈现</p>
                        <p className="vu-live__sub">
                            {deviceName ? `设备：${deviceName}` : '设备：系统默认摄像头'}
                            {status?.width != null && status?.height != null
                                ? ` · ${status.width}×${status.height}`
                                : ''}
                            {status?.fps != null ? ` · ${status.fps} fps` : ''}
                        </p>
                        <p className="vu-live__hint">
                            按 <kbd>ESC</kbd> 或点击全屏右上角 EXIT 即可退出，
                            也可点击下方按钮从主窗口关闭。
                        </p>
                        <div className="vu-live__actions">
                            <Button icon={<ExpandOutlined />} onClick={onEnter}>
                                切换设备 / 重进
                            </Button>
                            <Button danger icon={<StopOutlined />} onClick={onStop}>
                                关闭全屏采集
                            </Button>
                        </div>
                    </div>
                )}

                {state === 'error' && (
                    <div className="vu-empty">
                        <p className="vu-empty__text vu-empty__text--error">
                            {errorMessage ?? '摄像头采集失败'}
                        </p>
                        <p className="vu-empty__sub">
                            {deviceName ? `设备：${deviceName}` : '可换个设备或降低帧率后重试'}
                        </p>
                        <div className="vu-empty__actions">
                            <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
                                重新选择设备
                            </Button>
                            <Button onClick={onRefreshCameras}>重新检测设备</Button>
                        </div>
                    </div>
                )}

                {state === 'streaming' && (
                    <div className="vu-hud" aria-hidden="true">
                        <span className="vu-corner vu-corner--tl" />
                        <span className="vu-corner vu-corner--tr" />
                        <span className="vu-corner vu-corner--bl" />
                        <span className="vu-corner vu-corner--br" />
                        <span className="vu-scanline" />
                    </div>
                )}
            </div>
        </div>
    );
}
