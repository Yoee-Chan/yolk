import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { CameraDevice, OpenUniverseOptions, PlayerStatus } from './types';

/**
 * 虚拟宇宙 — 主控端桥接层。
 *
 * 新架构里图像数据完全不出播放器进程，前端只做三件事：
 * 枚举设备、发起/关闭播放器、订阅播放器状态。
 * 旧的帧事件（virtual-universe-frame）已彻底移除。
 */

const EVENT_STATUS = 'virtual-universe-status';

export const virtualUniverseApi = {
    /** 枚举本机摄像头。Rust 侧失败时返回空数组。 */
    listCameras(): Promise<CameraDevice[]> {
        return invoke<CameraDevice[]>('list_cameras');
    },

    /**
     * 拉起原生全屏播放器进程，返回会话 ID。
     * 画面在独立进程里渲染，状态通过事件回传。
     *
     * 注意：Tauri 命令按 Rust 形参名匹配（snake_case），
     * 必须传 device_index / max_width，否则 Rust 侧收不到会回落默认值。
     */
    openVirtualUniverse(options: OpenUniverseOptions = {}): Promise<number> {
        return invoke<number>('open_virtual_universe', {
            device_index: options.deviceIndex ?? null,
            fps: options.fps ?? null,
            max_width: options.maxWidth ?? null,
        });
    },

    /** 关闭正在运行的虚拟宇宙窗口。 */
    closeVirtualUniverse(): Promise<void> {
        return invoke('close_virtual_universe');
    },

    /** 订阅播放器状态事件，返回取消订阅函数。 */
    subscribeStatus(onStatus: (status: PlayerStatus) => void): () => void {
        let disposed = false;
        const unlisteners: UnlistenFn[] = [];

        listen<PlayerStatus>(EVENT_STATUS, (e) => {
            if (!disposed) onStatus(e.payload);
        }).then((un) => {
            if (disposed) un();
            else unlisteners.push(un);
        });

        return () => {
            disposed = true;
            unlisteners.forEach((un) => un());
            unlisteners.length = 0;
        };
    },
};
