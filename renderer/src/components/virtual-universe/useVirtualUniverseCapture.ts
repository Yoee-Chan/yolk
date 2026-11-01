import { useCallback, useEffect, useRef, useState } from 'react';
import { virtualUniverseApi } from './api';
import type { CameraDevice, PlayerState, PlayerStatus } from './types';

const LOG_PREFIX = '[virtual-universe]';

interface UseVirtualUniverseCaptureResult {
    cameras: CameraDevice[];
    camerasLoading: boolean;
    camerasError: string | null;
    state: PlayerState;
    status: PlayerStatus | null;
    errorMessage: string | null;
    /** 播放器上报的实测帧率（状态事件里携带，非前端计算）。 */
    fps: number;
    /** 当前会话 ID（open 成功后产生）。 */
    sessionId: number | null;
    refreshCameras: () => void;
    start: (deviceIndex?: number | null, fps?: 24 | 30 | 60) => Promise<void>;
    stop: () => Promise<void>;
}

/**
 * 管理虚拟宇宙播放器会话。
 *
 * 新架构：画面在独立原生全屏进程里渲染，前端只维护
 * 「设备列表 + 会话状态」，不再接收任何帧数据。
 * 状态按 sessionId 过滤，避免旧会话残留事件污染当前 UI。
 */
export function useVirtualUniverseCapture(): UseVirtualUniverseCaptureResult {
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [camerasLoading, setCamerasLoading] = useState(false);
    const [camerasError, setCamerasError] = useState<string | null>(null);
    const [state, setState] = useState<PlayerState>('idle');
    const [status, setStatus] = useState<PlayerStatus | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);

    const sessionIdRef = useRef<number | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const disposedRef = useRef(false);

    const refreshCameras = useCallback(() => {
        setCamerasLoading(true);
        setCamerasError(null);
        virtualUniverseApi
            .listCameras()
            .then((list) => {
                if (disposedRef.current) return;
                setCameras(Array.isArray(list) ? list : []);
            })
            .catch((err) => {
                if (disposedRef.current) return;
                console.warn(`${LOG_PREFIX} list cameras failed`, err);
                setCameras([]);
                setCamerasError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
                if (!disposedRef.current) setCamerasLoading(false);
            });
    }, []);

    const ensureSubscribed = useCallback(() => {
        if (unsubscribeRef.current) return;
        unsubscribeRef.current = virtualUniverseApi.subscribeStatus((next) => {
            // 只关心当前会话的状态；旧会话收尾事件直接忽略。
            if (sessionIdRef.current !== null && next.sessionId !== sessionIdRef.current) {
                return;
            }
            setStatus(next);
            setState(next.state);
            if (next.state === 'error') {
                setErrorMessage(next.message ?? '摄像头采集失败');
            } else if (next.state === 'streaming' || next.state === 'starting') {
                setErrorMessage(null);
            }
        });
    }, []);

    const start = useCallback(
        async (deviceIndex?: number | null, fps?: 24 | 30 | 60) => {
            ensureSubscribed();
            setErrorMessage(null);
            setState('starting');
            setStatus(null);
            try {
                const id = await virtualUniverseApi.openVirtualUniverse({
                    deviceIndex: deviceIndex ?? null,
                    fps: fps ?? 30,
                });
                sessionIdRef.current = id;
                setSessionId(id);
            } catch (err) {
                console.warn(`${LOG_PREFIX} open player failed`, err);
                setState('error');
                setErrorMessage(err instanceof Error ? err.message : String(err));
            }
        },
        [ensureSubscribed]
    );

    const stop = useCallback(async () => {
        try {
            await virtualUniverseApi.closeVirtualUniverse();
        } catch (err) {
            console.warn(`${LOG_PREFIX} close player failed`, err);
        }
        // stopped 事件会由 Rust 侧回传；这里先乐观复位，避免 UI 长时间卡住。
        // 若事件稍后到达，会再次确认同一状态，无副作用。
        sessionIdRef.current = null;
        setSessionId(null);
        setState('stopped');
        setStatus(null);
    }, []);

    useEffect(() => {
        disposedRef.current = false;
        refreshCameras();
        ensureSubscribed();
        return () => {
            disposedRef.current = true;
            unsubscribeRef.current?.();
            unsubscribeRef.current = null;
            sessionIdRef.current = null;
            // 页面卸载时关掉播放器，释放摄像头，避免留下孤儿全屏窗口。
            virtualUniverseApi.closeVirtualUniverse().catch(() => {});
        };
    }, [refreshCameras, ensureSubscribed]);

    const fps = status?.fps ?? 0;

    return {
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
    };
}
