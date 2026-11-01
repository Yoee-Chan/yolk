//! 虚拟宇宙 —— 主控端：设备枚举 + 启动/关闭原生全屏播放器进程。
//!
//! 架构说明（相比旧版的关键变化）：
//! - 旧版把摄像头帧在 Rust 里 JPEG 编码 → base64 → Tauri 事件 → 前端 `<img>` 解码 → Canvas。
//!   这条链路每帧要付出编码 + base64 膨胀(约 +33%) + JSON 序列化 + JS 解码的开销，
//!   实测只能跑到 5 fps，并且排队延迟会持续累积。
//! - 现在帧完全不出进程：Yolk 主进程只做「设备选择 + 启动/关闭」，
//!   真正的采集与渲染都在独立的原生全屏进程（见 `vu_player.rs`）里完成，
//!   帧从摄像头缓冲区直接 blit 到窗口，无编解码、无 IPC 往返。
//! - 主进程与播放器之间只有一条极轻量的 stdout 状态流（`vu-status` 前缀的行），
//!   用于把「连接中 / 运行中 / 错误 / 已退出」回传给前端 UI 显示。
//!
//! 未来接入 GPU/NPU 推理时，只需要在 `vu_player.rs` 的帧循环里插入计算节点，
//! 主控端与前端交互层不需要任何改动。

use std::{
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

use nokhwa::utils::ApiBackend;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

pub const EVENT_STATUS: &str = "virtual-universe-status";
/// 播放器向主进程约定的 stdout 协议前缀。
const PLAYER_STATUS_PREFIX: &str = "vu-status ";
/// 启动参数：出现该参数时，进程直接进入播放器模式（不启动 Tauri）。
pub const PLAYER_FLAG: &str = "--virtual-universe-player";
/// 启动参数：摄像头设备索引（或 `default`）。
const ARG_DEVICE: &str = "--device";
/// 启动参数：目标帧率（24 / 60）。
const ARG_FPS: &str = "--fps";
/// 启动参数：画面宽度上限（控制 4K 全屏下的 CPU 缩放开销）。
const ARG_WIDTH: &str = "--max-width";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraDevice {
    pub index: u32,
    pub name: String,
}

/// 播放器进程回报的状态行（与 `PlayerStatus` 字段一致，复用同一个结构避免定义漂移）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStatus {
    /// starting | streaming | error | stopped
    pub state: String,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    #[serde(default)]
    pub fps: Option<u32>,
}

/// 推送给前端的状态事件，比 `PlayerStatus` 多一个会话号。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusEvent {
    pub session_id: u64,
    pub state: String,
    pub message: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<u32>,
}

/// 会话编号：每次启动递增，便于前端丢弃旧会话的残留状态。
static SESSION_SEQ: AtomicU64 = AtomicU64::new(1);

/// 全局退出信号：主进程关闭播放器时置位，播放器每帧检查并自行退出。
static PLAYER_STOP: AtomicBool = AtomicBool::new(false);

struct ActivePlayer {
    session_id: u64,
    child: Child,
}

/// 播放器进程句柄所在的状态对象。用 `Arc` 包裹，这样后台监控线程可以安全持有。
#[derive(Default)]
pub struct VirtualUniverseState {
    active: Mutex<Option<ActivePlayer>>,
}

impl VirtualUniverseState {
    /// 停止当前播放器并回收进程。可从任意线程调用。
    fn stop_active(self: &Arc<Self>) {
        let active = {
            let Ok(mut guard) = self.active.lock() else {
                return;
            };
            match guard.take() {
                Some(active) => active,
                None => return,
            }
        };

        let session_id = active.session_id;
        PLAYER_STOP.store(true, Ordering::SeqCst);
        let mut child = active.child;
        // 先给播放器一点时间走完自己的清理流程（关闭摄像头 / 释放设备），超时再 kill。
        let deadline = std::time::Instant::now() + Duration::from_millis(2000);
        loop {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) => {
                    if std::time::Instant::now() >= deadline {
                        let _ = child.kill();
                        let _ = child.wait();
                        break;
                    }
                    thread::sleep(Duration::from_millis(20));
                }
                Err(_) => break,
            }
        }

        emit_status(
            session_id,
            &PlayerStatus {
                state: "stopped".into(),
                message: None,
                width: None,
                height: None,
                fps: None,
            },
        );
    }
}

/// 主进程持有的 AppHandle —— 仅用于状态事件广播，不参与任何图像数据通路。
static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);

pub fn set_app_handle(app: &AppHandle) {
    if let Ok(mut guard) = APP_HANDLE.lock() {
        *guard = Some(app.clone());
    }
}

fn app_handle() -> Option<AppHandle> {
    APP_HANDLE.lock().ok().and_then(|guard| guard.clone())
}

fn emit_status(session_id: u64, status: &PlayerStatus) {
    let Some(handle) = app_handle() else {
        return;
    };
    let _ = handle.emit(
        EVENT_STATUS,
        StatusEvent {
            session_id,
            state: status.state.clone(),
            message: status.message.clone(),
            width: status.width,
            height: status.height,
            fps: status.fps,
        },
    );
}

/// 枚举本机可用的摄像头设备。失败时返回空列表而不是报错，
/// 让前端能以“无设备”的空态呈现而不是弹错误。
#[tauri::command]
pub fn list_cameras() -> Vec<CameraDevice> {
    match nokhwa::query(ApiBackend::Auto) {
        Ok(devices) => devices
            .into_iter()
            .enumerate()
            .map(|(index, info)| CameraDevice {
                index: index as u32,
                name: info.human_name(),
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// 启动原生全屏播放器进程。
///
/// `device_index` 为空表示系统默认摄像头；`fps` 只接受 24 / 60（其他值回落到 30）。
/// 命令立即返回会话 ID，播放器状态通过 `virtual-universe-status` 事件回传。
#[tauri::command]
pub fn open_virtual_universe(
    app: AppHandle,
    device_index: Option<u32>,
    fps: Option<u32>,
    max_width: Option<u32>,
) -> Result<u64, String> {
    set_app_handle(&app);
    let state = app.state::<Arc<VirtualUniverseState>>().inner().clone();
    // 同一时刻只允许一个播放器：先收掉旧的。
    state.stop_active();

    PLAYER_STOP.store(false, Ordering::SeqCst);

    let session_id = SESSION_SEQ.fetch_add(1, Ordering::SeqCst);
    let target_fps = match fps.unwrap_or(30) {
        24 => 24,
        60 => 60,
        _ => 30,
    };
    let target_width = max_width.unwrap_or(1280).clamp(320, 3840);

    let exe = std::env::current_exe().map_err(|e| format!("无法定位程序路径：{e}"))?;
    let device_arg = match device_index {
        Some(index) => index.to_string(),
        None => "default".to_string(),
    };
    let child = Command::new(exe)
        .arg(PLAYER_FLAG)
        .arg(ARG_FPS)
        .arg(target_fps.to_string())
        .arg(ARG_WIDTH)
        .arg(target_width.to_string())
        .arg(ARG_DEVICE)
        .arg(device_arg)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("启动虚拟宇宙进程失败：{e}"))?;
    let mut child = child;

    // 读取播放器 stdout 的状态行，转成 Tauri 事件给前端。
    if let Some(stdout) = child.stdout.take() {
        thread::Builder::new()
            .name("vu-status-reader".into())
            .spawn(move || {
                use std::io::BufRead;
                let reader = std::io::BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    let Some(json) = line.trim().strip_prefix(PLAYER_STATUS_PREFIX) else {
                        continue;
                    };
                    let Ok(status) = serde_json::from_str::<PlayerStatus>(json) else {
                        continue;
                    };
                    let is_final = status.state == "stopped";
                    emit_status(session_id, &status);
                    if is_final {
                        break;
                    }
                }
            })
            .ok();
    }

    // 监控进程生命周期：用户直接关掉全屏窗口时，把状态同步回主窗口。
    {
        let state = state.clone();
        thread::Builder::new()
            .name("vu-process-watch".into())
            .spawn(move || {
                loop {
                    thread::sleep(Duration::from_millis(250));
                    let mut guard = match state.active.lock() {
                        Ok(g) => g,
                        Err(_) => return,
                    };
                    let Some(active) = guard.as_mut() else {
                        // 已被 stop_active 收走，监控结束。
                        return;
                    };
                    if active.session_id != session_id {
                        return;
                    }
                    match active.child.try_wait() {
                        Ok(Some(_)) => {
                            *guard = None;
                            drop(guard);
                            // 主动关闭时 stop_active 已发过 stopped，避免重复。
                            if !PLAYER_STOP.load(Ordering::SeqCst) {
                                emit_status(
                                    session_id,
                                    &PlayerStatus {
                                        state: "stopped".into(),
                                        message: None,
                                        width: None,
                                        height: None,
                                        fps: None,
                                    },
                                );
                            }
                            return;
                        }
                        Ok(None) => {}
                        Err(_) => return,
                    }
                }
            })
            .ok();
    }

    {
        let mut guard = state.active.lock().map_err(|e| e.to_string())?;
        *guard = Some(ActivePlayer {
            session_id,
            child,
        });
    }

    emit_status(
        session_id,
        &PlayerStatus {
            state: "starting".into(),
            message: None,
            width: None,
            height: None,
            fps: None,
        },
    );

    Ok(session_id)
}

/// 关闭正在运行的虚拟宇宙窗口（等价于在播放器里点「退出」）。
#[tauri::command]
pub fn close_virtual_universe(app: AppHandle) {
    app.state::<Arc<VirtualUniverseState>>()
        .inner()
        .clone()
        .stop_active();
}

/// 主进程退出前确保播放器进程被回收，避免留下孤儿全屏窗口。
pub fn shutdown(app: &AppHandle) {
    if let Some(state) = app.try_state::<Arc<VirtualUniverseState>>() {
        state.inner().clone().stop_active();
    }
}