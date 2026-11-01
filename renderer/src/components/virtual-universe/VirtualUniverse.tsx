import { useMemo, useState } from 'react';
import { Button, Segmented, Tag } from 'antd';
import {
    CameraOutlined,
    ExpandOutlined,
    GlobalOutlined,
    RobotOutlined,
    StopOutlined,
} from '@ant-design/icons';
import CaptureViewport from './CaptureViewport';
import CameraPickerModal from './CameraPickerModal';
import { useVirtualUniverseCapture } from './useVirtualUniverseCapture';
import './virtual-universe.css';

const SCAN_STEPS = [
    {
        title: '选择摄像头',
        desc: '第一阶段接入设备摄像头，把现实画面送入虚拟宇宙采集管线。',
    },
    {
        title: '全屏扫描物品 / 人物',
        desc: '原生播放器逐帧采集并全屏呈现，延迟恒定 1~2 帧，为后续三维重建与语义理解做准备。',
    },
    {
        title: '生成 AI 形象',
        desc: '把扫描结果沉淀为 AI 形象资产，与 AI agent 能力联动。',
    },
];

/**
 * 虚拟宇宙页面（第一阶段：摄像头接入 + 原生全屏采集）。
 *
 * 页面即入口：挂载后立即弹出摄像头选择框，确认后拉起
 * 独立原生全屏播放器（src-tauri/src/vu_player.rs）。
 * 画面完全不出播放器进程，主窗口只呈现会话状态。
 */
export default function VirtualUniverse() {
    const {
        cameras,
        camerasLoading,
        camerasError,
        state,
        status,
        errorMessage,
        fps,
        sessionId,
        refreshCameras,
        start,
        stop,
    } = useVirtualUniverseCapture();

    // 进入页面即弹框选设备；取消后停留在空态，可再次点击进入。
    const [pickerOpen, setPickerOpen] = useState(true);
    const [activeDeviceName, setActiveDeviceName] = useState<string | null>(null);
    const [targetFps, setTargetFps] = useState<24 | 30 | 60>(60);

    const statusTag = useMemo(() => {
        switch (state) {
            case 'streaming':
                return <Tag color="success">全屏采集中</Tag>;
            case 'starting':
                return <Tag color="processing">连接中</Tag>;
            case 'error':
                return <Tag color="error">采集失败</Tag>;
            case 'stopped':
            case 'idle':
            default:
                return <Tag>未连接</Tag>;
        }
    }, [state]);

    const activeStep = state === 'streaming' ? 1 : 0;

    const handleConfirm = (deviceIndex: number | null) => {
        setPickerOpen(false);
        const name =
            deviceIndex === null
                ? cameras[0]?.name ?? '系统默认摄像头'
                : cameras.find((d) => d.index === deviceIndex)?.name ?? '系统默认摄像头';
        setActiveDeviceName(name);
        void start(deviceIndex, targetFps);
    };

    const handleSwitchDevice = () => {
        setPickerOpen(true);
    };

    const handleStop = () => {
        void stop();
    };

    const handleRetry = () => {
        setPickerOpen(true);
    };

    return (
        <div className="vu-page">
            <header className="vu-header">
                <div className="vu-header__left">
                    <span className="vu-header__logo">
                        <GlobalOutlined />
                    </span>
                    <div>
                        <h2 className="vu-header__title">虚拟宇宙</h2>
                        <p className="vu-header__subtitle">
                            第一阶段 · 摄像头采集 —— 为“AI agent × 虚拟宇宙”打底
                        </p>
                    </div>
                </div>
                <div className="vu-header__right">
                    {statusTag}
                    {state === 'streaming' && status?.width != null && (
                        <span className="vu-stat">
                            {status.width}×{status.height} · {fps} fps · 原生全屏
                            {sessionId != null ? ` · #${sessionId}` : ''}
                        </span>
                    )}
                    <Segmented<24 | 30 | 60>
                        value={targetFps}
                        onChange={setTargetFps}
                        options={[
                            { label: '24 fps', value: 24 },
                            { label: '30 fps', value: 30 },
                            { label: '60 fps', value: 60 },
                        ]}
                        size="small"
                    />
                    <Button
                        icon={<CameraOutlined />}
                        onClick={handleSwitchDevice}
                        className="vu-header__btn"
                    >
                        切换设备
                    </Button>
                    {(state === 'streaming' || state === 'starting') && (
                        <Button icon={<StopOutlined />} danger onClick={handleStop}>
                            停止采集
                        </Button>
                    )}
                </div>
            </header>

            <div className="vu-body">
                <section className="vu-stage" aria-label="摄像头采集状态">
                    <CaptureViewport
                        state={state}
                        status={status}
                        deviceName={activeDeviceName}
                        errorMessage={errorMessage}
                        onEnter={handleRetry}
                        onStop={handleStop}
                        onRetry={handleRetry}
                        onRefreshCameras={refreshCameras}
                    />
                    <div className="vu-stage__bar">
                        <span>
                            {activeDeviceName ? `设备：${activeDeviceName}` : '设备：未选择'}
                            {state === 'streaming' ? ' · 画面在全屏窗口中' : ''}
                        </span>
                        <span className="vu-stage__bar-right">
                            <RobotOutlined /> 第二阶段将接入 AI 扫描重建
                        </span>
                    </div>
                </section>

                <aside className="vu-side" aria-label="采集说明">
                    <div className="vu-card">
                        <h3 className="vu-card__title">扫描管线（第一阶段）</h3>
                        <ol className="vu-steps">
                            {SCAN_STEPS.map((step, index) => (
                                <li
                                    key={step.title}
                                    className={
                                        index === activeStep
                                            ? 'vu-steps__item vu-steps__item--active'
                                            : 'vu-steps__item'
                                    }
                                >
                                    <span className="vu-steps__index">{index + 1}</span>
                                    <div>
                                        <p className="vu-steps__name">{step.title}</p>
                                        <p className="vu-steps__desc">{step.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <div className="vu-card">
                        <h3 className="vu-card__title">渲染架构</h3>
                        <p className="vu-card__text">
                            采集与渲染都在独立原生全屏进程里完成：
                            摄像头 RGBA 缓冲直接 blit 进窗口，无 JPEG
                            编码、无 base64、无 IPC
                            往返。主窗口只订阅轻量状态事件。
                            后续 AI 推理直接插进播放器帧循环，前端无需改动。
                        </p>
                    </div>
                    {state === 'streaming' && (
                        <div className="vu-card vu-card--accent">
                            <h3 className="vu-card__title">
                                <ExpandOutlined /> 全屏操作指引
                            </h3>
                            <p className="vu-card__text">
                                按 ESC 或点击全屏右上角 EXIT
                                退出采集；直接关掉全屏窗口也会同步回主界面状态。
                            </p>
                        </div>
                    )}
                </aside>
            </div>

            <CameraPickerModal
                open={pickerOpen}
                cameras={cameras}
                loading={camerasLoading}
                error={camerasError}
                onRefresh={refreshCameras}
                onCancel={() => setPickerOpen(false)}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
