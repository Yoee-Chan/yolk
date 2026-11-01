/** 虚拟宇宙 — 前端类型定义（与 Rust 侧序列化结构一一对应）。 */

export interface CameraDevice {
    index: number;
    name: string;
}

/** 原生播放器状态：idle=前端初始 / starting=正在拉起 / streaming=运行中 / stopped=已退出 / error=失败 */
export type PlayerState = 'idle' | 'starting' | 'streaming' | 'stopped' | 'error';

export interface PlayerStatus {
    sessionId: number;
    state: PlayerState;
    message: string | null;
    width: number | null;
    height: number | null;
    /** 播放器实测帧率 */
    fps: number | null;
}

export interface OpenUniverseOptions {
    /** 不传表示使用系统默认摄像头 */
    deviceIndex?: number | null;
    /** 只接受 24 / 60（Rust 侧会校验回落，默认 30） */
    fps?: 24 | 30 | 60;
    /** 画面宽度上限，控制 4K 全屏下的 CPU 开销，默认 1280 */
    maxWidth?: number;
}
