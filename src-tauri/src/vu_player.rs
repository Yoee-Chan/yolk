//! 虚拟宇宙 —— 原生全屏播放器（独立进程）。
//!
//! 这是整个方案里唯一接触像素的地方，设计目标只有三个：
//! 1. **稳定帧率**：不做任何逐帧编码（无 JPEG/H.264）、不做 IPC 往返；
//!    摄像头解码出的 RGB 直接缩放后 blit 进窗口缓冲，帧率由设备与 CPU blit 决定，
//!    而不是由「编码耗时 + 序列化耗时 + JS 解码耗时」决定。
//! 2. **低延迟**：渲染循环永远只取「最新一帧」（latest-frame slot）。
//!    渲染跟不上采集时直接丢弃旧帧而不是排队，延迟恒定在 1~2 帧，
//!    不会像 Canvas 方案那样越积越多。
//! 3. **为 GPU/NPU 留位**：`FrameSlot` 就是未来插入推理节点的位置。
//!    采集线程 → FrameSlot → 渲染线程的两端保持不变，中间插入什么计算都不影响两端。
//!
//! 60fps 优化说明（管线其他部分结构不变，仅替换热点路径）：
//! - 采集线程复用同一块 RGB 缓冲逐帧解码，零逐帧分配；
//! - RGB24 直接入槽（砍掉 RGBA 的逐像素 alpha 展开与 1/4 内存流量）；
//! - 缩放用预计算的「列/行偏移 LUT + 分块多线程」，热点内循环无除法、无分支；
//! - 渲染结果直写 surface 缓冲（省一次整屏 memcpy）；无新帧/无动画时跳过 present。
//!
//! 交互：进入即全屏加载界面（类似游戏 loading），随后切换为画面；
//! 右上角有 EXIT 按钮，按 ESC 也可退出；退出时完整释放摄像头。

use std::{
    num::NonZeroU32,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use nokhwa::{
    pixel_format::RgbFormat,
    utils::{ApiBackend, CameraFormat, FrameFormat, RequestedFormat, RequestedFormatType},
    Camera,
};
use winit::{
    application::ApplicationHandler,
    dpi::PhysicalSize,
    event::{ElementState, MouseButton, WindowEvent},
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    keyboard::{Key, NamedKey},
    window::{CursorIcon, Fullscreen, Window, WindowId},
};

use crate::virtual_universe::PlayerStatus;

// ---------------------------------------------------------------- 启动参数

#[derive(Debug, Clone, Copy)]
pub struct PlayerOptions {
    pub device_index: Option<u32>,
    pub fps: u32,
    pub max_width: u32,
}

/// 解析 `--virtual-universe-player --fps 60 --max-width 1920 --device 0`。
pub fn parse_options() -> PlayerOptions {
    let mut device_index = None;
    let mut fps = 60u32;
    let mut max_width = 1920u32;

    let mut args = std::env::args().skip(1);
    while let Some(flag) = args.next() {
        let value = args.next().unwrap_or_default();
        match flag.as_str() {
            "--device" => device_index = value.parse::<u32>().ok(),
            "--fps" => fps = value.parse::<u32>().unwrap_or(60).clamp(1, 240),
            "--max-width" => max_width = value.parse::<u32>().unwrap_or(1920).clamp(320, 3840),
            _ => {}
        }
    }
    PlayerOptions {
        device_index,
        fps,
        max_width,
    }
}

// ---------------------------------------------------------------- 状态上报

/// 通过 stdout 回报状态；主进程会把它转成 Tauri 事件展示在 Yolk 界面上。
fn report(status: PlayerStatus) {
    if let Ok(json) = serde_json::to_string(&status) {
        use std::io::Write;
        println!("vu-status {json}");
        let _ = std::io::stdout().flush();
    }
}

// ---------------------------------------------------------------- 帧槽

/// 一帧 RGB 画面（RGB24，长度 = width * height * 3）。
struct RawFrame {
    width: u32,
    height: u32,
    rgb: Vec<u8>,
}

/// 采集线程与渲染线程之间只保留「最新一帧」。
///
/// 采集快于渲染时新帧直接覆盖旧帧——旧帧已经过时，排队只会增加延迟。
/// 这是把延迟从「随时间累积」压到「恒定 1~2 帧」的关键。
///
/// `publish` 返回被替换下来的旧帧，供采集线程回收复用缓冲，稳态零分配。
struct FrameSlot {
    frame: Mutex<Option<RawFrame>>,
    seq: Mutex<u64>,
}

impl FrameSlot {
    fn new() -> Self {
        Self {
            frame: Mutex::new(None),
            seq: Mutex::new(0),
        }
    }

    fn publish(&self, frame: RawFrame) -> Option<RawFrame> {
        let replaced = self.frame.lock().ok().and_then(|mut guard| guard.replace(frame));
        if let Ok(mut guard) = self.seq.lock() {
            *guard += 1;
        }
        replaced
    }

    fn take_latest(&self) -> Option<RawFrame> {
        self.frame.lock().ok().and_then(|mut guard| guard.take())
    }

    fn peek_seq(&self) -> u64 {
        self.seq.lock().map(|g| *g).unwrap_or(0)
    }
}

// ---------------------------------------------------------------- 采集线程

/// 16:9 标准分辨率阶梯。
///
/// nokhwa 的 `Closest` 是按「距离」挑选设备格式的：请求一个设备根本没有的
/// 非标分辨率（比如 `1280x1080`）很可能被匹配到一档又大又慢的格式，
/// 解码耗时直接把采集帧率拖垮。所以只请求标准分辨率，让匹配稳定命中
/// 1080p60 / 720p60 这类设备原生支持的档位。
fn resolution_ladder(max_width: u32) -> Vec<(u32, u32)> {
    const LADDER: [(u32, u32); 4] = [(1920, 1080), (1280, 720), (960, 540), (640, 480)];
    let mut out: Vec<(u32, u32)> = LADDER
        .into_iter()
        .filter(|(w, _)| *w <= max_width)
        .collect();
    if out.is_empty() {
        out.push((640, 480));
    }
    out
}

fn open_camera(options: PlayerOptions) -> Result<Camera, String> {
    let devices = nokhwa::query(ApiBackend::Auto).map_err(|e| format!("枚举摄像头失败：{e}"))?;
    let picked = match options.device_index {
        Some(index) => devices
            .into_iter()
            .nth(index as usize)
            .ok_or_else(|| "指定的摄像头设备不存在".to_string())?,
        None => devices
            .into_iter()
            .next()
            .ok_or_else(|| "没有检测到可用的摄像头设备".to_string())?,
    };
    let camera_index = picked.index().clone();

    // Format 优先级：MJPEG（USB 带宽占用最低，最容易让设备稳定跑满目标帧率）
    // 其次 YUYV / NV12 无压缩格式；最后让设备自选。
    // 每档只请求 16:9 标准分辨率（见 resolution_ladder 注释），任一档命中即用。
    let ladder = resolution_ladder(options.max_width);
    let mut attempts: Vec<RequestedFormatType> = Vec::with_capacity(ladder.len() * 3 + 1);
    for format in [FrameFormat::MJPEG, FrameFormat::YUYV, FrameFormat::NV12] {
        for (w, h) in &ladder {
            attempts.push(RequestedFormatType::Closest(CameraFormat::new_from(
                *w,
                *h,
                format,
                options.fps,
            )));
        }
    }
    // 兜底：让设备按默认格式打开，再按需降频展示。
    attempts.push(RequestedFormatType::None);

    let mut last_err: Option<String> = None;
    for requested_type in attempts.drain(..) {
        let requested = RequestedFormat::new::<RgbFormat>(requested_type);
        match Camera::new(camera_index.clone(), requested) {
            Ok(camera) => return Ok(camera),
            Err(err) => last_err = Some(err.to_string()),
        }
    }

    Err(friendly_camera_error(
        last_err.unwrap_or_else(|| "未知错误".to_string()),
    ))
}

fn friendly_camera_error(raw: String) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("access") || lower.contains("permission") || lower.contains("denied") {
        "无法访问摄像头：请在系统隐私设置中允许本程序使用摄像头".into()
    } else if lower.contains("not found") || lower.contains("no device") {
        "没有检测到可用的摄像头设备".into()
    } else if lower.contains("fulfill requested format") {
        "该摄像头不提供可用的画面格式（已尝试 MJPEG / YUYV / NV12 与设备默认格式）".into()
    } else {
        format!("打开摄像头失败：{raw}")
    }
}

/// 采集线程：读帧 → 解码 RGB → 写入帧槽。
///
/// `camera.frame()` 是阻塞读取，天然由设备的实际采集节奏驱动，
/// 不需要 sleep 节流，也不会出现「攒帧后突发推送」的抖动。
///
/// 性能要点：
/// - 直接解码为 RGB24（比 RGBA 少 1/4 内存流量，少一遍 alpha 展开）；
/// - 解码目标缓冲来自上一轮被替换下来的旧帧，稳态下每帧零分配。
fn run_capture(
    options: PlayerOptions,
    slot: Arc<FrameSlot>,
    stop: Arc<AtomicBool>,
) -> Result<(), String> {
    let mut camera = open_camera(options)?;

    // 流只开一次；每帧重复 open_stream 会重置 MF 采集纪元，导致读帧抖动甚至失败。
    camera
        .open_stream()
        .map_err(|e| format!("打开摄像头视频流失败：{e}"))?;

    // 实际协商到的格式（分辨率/帧率以此为准，是诊断帧率的第一手信息）。
    let negotiated = camera.camera_format();
    report(PlayerStatus {
        state: "starting".into(),
        message: Some(format!(
            "camera {}x{}@{}",
            negotiated.width(),
            negotiated.height(),
            negotiated.frame_rate()
        )),
        width: None,
        height: None,
        fps: None,
    });

    let mut announced = false;
    let mut spare: Option<RawFrame> = None;
    let mut window_start = Instant::now();
    let mut window_frames = 0u32;
    // 单帧解码连续失败的次数：偶发坏帧直接丢弃；持续失败才按致命错误上报，
    // 避免因为一帧坏数据把整个会话掐掉。
    let mut consecutive_decode_errors = 0u32;

    while !stop.load(Ordering::SeqCst) {
        let frame = match camera.frame() {
            Ok(frame) => frame,
            Err(_) => {
                // 单帧失败通常是设备瞬时异常；轻量退避后继续，不中断整条流。
                thread::sleep(Duration::from_millis(5));
                continue;
            }
        };

        let resolution = frame.resolution();
        let (width, height) = (resolution.width_x, resolution.height_y);
        let expected = (width as usize) * (height as usize) * 3;

        let mut recycled = match spare.take() {
            Some(mut f)
                if f.width == width && f.height == height && f.rgb.len() == expected =>
            {
                f.rgb.clear();
                f.rgb.resize(expected, 0);
                f.rgb
            }
            _ => vec![0u8; expected],
        };

        match frame.decode_image_to_buffer::<RgbFormat>(&mut recycled) {
            Ok(()) => consecutive_decode_errors = 0,
            Err(err) => {
                consecutive_decode_errors += 1;
                spare = Some(RawFrame {
                    width,
                    height,
                    rgb: recycled,
                });
                if consecutive_decode_errors >= 30 {
                    return Err(format!("解码摄像头帧持续失败：{err}"));
                }
                continue;
            }
        }

        if !announced {
            announced = true;
            report(PlayerStatus {
                state: "streaming".into(),
                message: None,
                width: Some(width),
                height: Some(height),
                fps: None,
            });
        }

        if let Some(replaced) = slot.publish(RawFrame {
            width,
            height,
            rgb: recycled,
        }) {
            spare = Some(replaced);
        }

        window_frames += 1;
        if window_start.elapsed() >= Duration::from_secs(1) {
            report(PlayerStatus {
                state: "streaming".into(),
                message: None,
                width: Some(width),
                height: Some(height),
                fps: Some(window_frames),
            });
            window_start = Instant::now();
            window_frames = 0;
        }
    }

    // camera 随栈帧析构，把设备完整交还系统。
    Ok(())
}

// ---------------------------------------------------------------- 软件画布

/// 画布视图：对一片 `u32` 缓冲的 2D 读写封装。
///
/// 画布既可以是一块自持 `Vec<u32>`（首帧前、错误页），也可以直接借用
/// softbuffer 的绘制缓冲——后者省掉「自持画布 → surface」的整屏 memcpy，
/// 在 4K 下大约 33MB/帧的内存流量。
struct CanvasView<'a> {
    width: u32,
    height: u32,
    /// 0x00RRGGBB
    pixels: &'a mut [u32],
}

impl<'a> CanvasView<'a> {
    fn new(width: u32, height: u32, pixels: &'a mut [u32]) -> Self {
        Self {
            width,
            height,
            pixels,
        }
    }

    fn put(&mut self, x: i32, y: i32, color: u32) {
        if x < 0 || y < 0 || x >= self.width as i32 || y >= self.height as i32 {
            return;
        }
        self.pixels[y as usize * self.width as usize + x as usize] = color;
    }

    fn fill_rect(&mut self, x: i32, y: i32, w: u32, h: u32, color: u32) {
        let x0 = x.max(0);
        let y0 = y.max(0);
        let x1 = (x + w as i32).min(self.width as i32);
        let y1 = (y + h as i32).min(self.height as i32);
        if x0 >= x1 || y0 >= y1 {
            return;
        }
        let stride = self.width as usize;
        let row_len = (x1 - x0) as usize;
        for row in y0..y1 {
            let base = row as usize * stride + x0 as usize;
            self.pixels[base..base + row_len].fill(color);
        }
    }

    fn clear(&mut self, color: u32) {
        self.pixels.fill(color);
    }

    fn text_centered(&mut self, text: &str, y: i32, scale: u32, color: u32) {
        let width = text_width(text, scale) as i32;
        self.text(text, (self.width as i32 - width) / 2, y, scale, color);
    }

    fn text(&mut self, text: &str, x: i32, y: i32, scale: u32, color: u32) {
        let mut cursor = x;
        for ch in text.chars() {
            if let Some(glyph) = glyph_for(ch) {
                for (row, bits) in glyph.iter().enumerate() {
                    for col in 0..5 {
                        if bits & (1 << (4 - col)) != 0 {
                            self.fill_rect(
                                cursor + col as i32 * scale as i32,
                                y + row as i32 * scale as i32,
                                scale,
                                scale,
                                color,
                            );
                        }
                    }
                }
            }
            cursor += 6 * scale as i32;
        }
    }
}

fn text_width(text: &str, scale: u32) -> u32 {
    (text.chars().count() as u32) * 6 * scale
}

/// 5x7 点阵字体（ASCII 子集）。只为 loading / HUD 文案服务，避免引入字体依赖。
fn glyph_for(ch: char) -> Option<&'static [u8; 7]> {
    const A: [u8; 7] = [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001];
    const B: [u8; 7] = [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110];
    const C: [u8; 7] = [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110];
    const D: [u8; 7] = [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110];
    const E: [u8; 7] = [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111];
    const F: [u8; 7] = [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000];
    const G: [u8; 7] = [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111];
    const H: [u8; 7] = [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001];
    const I: [u8; 7] = [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111];
    const J: [u8; 7] = [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100];
    const K: [u8; 7] = [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001];
    const L: [u8; 7] = [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111];
    const M: [u8; 7] = [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001];
    const N: [u8; 7] = [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001];
    const O: [u8; 7] = [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110];
    const P: [u8; 7] = [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000];
    const Q: [u8; 7] = [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101];
    const R: [u8; 7] = [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001];
    const S: [u8; 7] = [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110];
    const T: [u8; 7] = [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100];
    const U: [u8; 7] = [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110];
    const V: [u8; 7] = [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100];
    const W: [u8; 7] = [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001];
    const X: [u8; 7] = [0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b01010, 0b10001];
    const Y: [u8; 7] = [0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100];
    const Z: [u8; 7] = [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111];
    const D0: [u8; 7] = [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110];
    const D1: [u8; 7] = [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110];
    const D2: [u8; 7] = [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111];
    const D3: [u8; 7] = [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110];
    const D4: [u8; 7] = [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010];
    const D5: [u8; 7] = [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110];
    const D6: [u8; 7] = [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110];
    const D7: [u8; 7] = [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000];
    const D8: [u8; 7] = [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110];
    const D9: [u8; 7] = [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100];
    const SPACE: [u8; 7] = [0; 7];
    const DOT: [u8; 7] = [0, 0, 0, 0, 0, 0b01100, 0b01100];
    const COLON: [u8; 7] = [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0];
    const DASH: [u8; 7] = [0, 0, 0, 0b11111, 0, 0, 0];
    const SLASH: [u8; 7] = [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000];
    const LPAREN: [u8; 7] = [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010];
    const RPAREN: [u8; 7] = [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000];
    const BANG: [u8; 7] = [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100];
    const PERCENT: [u8; 7] = [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011];
    const GT: [u8; 7] = [0b01000, 0b00100, 0b00010, 0b00001, 0b00010, 0b00100, 0b01000];

    Some(match ch.to_ascii_uppercase() {
        'A' => &A,
        'B' => &B,
        'C' => &C,
        'D' => &D,
        'E' => &E,
        'F' => &F,
        'G' => &G,
        'H' => &H,
        'I' => &I,
        'J' => &J,
        'K' => &K,
        'L' => &L,
        'M' => &M,
        'N' => &N,
        'O' => &O,
        'P' => &P,
        'Q' => &Q,
        'R' => &R,
        'S' => &S,
        'T' => &T,
        'U' => &U,
        'V' => &V,
        'W' => &W,
        'X' => &X,
        'Y' => &Y,
        'Z' => &Z,
        '0' => &D0,
        '1' => &D1,
        '2' => &D2,
        '3' => &D3,
        '4' => &D4,
        '5' => &D5,
        '6' => &D6,
        '7' => &D7,
        '8' => &D8,
        '9' => &D9,
        ' ' => &SPACE,
        '.' => &DOT,
        ':' => &COLON,
        '-' => &DASH,
        '/' => &SLASH,
        '(' => &LPAREN,
        ')' => &RPAREN,
        '!' => &BANG,
        '%' => &PERCENT,
        '>' => &GT,
        _ => return None,
    })
}

// ---------------------------------------------------------------- 缩放计划

/// 一次「源尺寸 → 目标尺寸」映射的预计算结果。
///
/// 旧实现在热点内循环里逐像素做整数除法求源坐标（4K 下每帧约 830 万次除法，
/// 单核根本跑不满帧率）。这里把映射烘焙成两个一次数组：`cols` 记录每个目标列
/// 对应的源字节偏移（含水平镜像），`rows` 记录每个目标行对应的源行起始偏移。
/// 热点循环只剩查表 + 读写，零除法、零分支预测压力。
struct ScalePlan {
    src_w: u32,
    src_h: u32,
    dst_w: u32,
    dst_h: u32,
    off_x: u32,
    off_y: u32,
    /// 长度 dst_w：cols[dx] = 镜像后的源像素列 × 3（RGB 字节偏移）。
    cols: Vec<usize>,
    /// 长度 dst_h：rows[dy] = 源行起始字节偏移。
    rows: Vec<usize>,
}

impl ScalePlan {
    /// 等比 contain + 居中 + 水平镜像。
    fn build(src_w: u32, src_h: u32, win_w: u32, win_h: u32) -> Option<Self> {
        if src_w == 0 || src_h == 0 || win_w == 0 || win_h == 0 {
            return None;
        }
        let scale = (win_w as f32 / src_w as f32).min(win_h as f32 / src_h as f32);
        let dst_w = ((src_w as f32 * scale).round() as u32).clamp(1, win_w);
        let dst_h = ((src_h as f32 * scale).round() as u32).clamp(1, win_h);
        let off_x = (win_w - dst_w) / 2;
        let off_y = (win_h - dst_h) / 2;

        let (src_wu, src_hu) = (src_w as usize, src_h as usize);
        let (dst_wu, dst_hu) = (dst_w as usize, dst_h as usize);
        let src_stride = src_wu * 3;

        let mut cols = Vec::with_capacity(dst_wu);
        for dx in 0..dst_wu {
            let sx = (dst_wu - 1 - dx) * src_wu / dst_wu;
            cols.push(sx * 3);
        }
        let mut rows = Vec::with_capacity(dst_hu);
        for dy in 0..dst_hu {
            rows.push(dy * src_hu / dst_hu * src_stride);
        }

        Some(Self {
            src_w,
            src_h,
            dst_w,
            dst_h,
            off_x,
            off_y,
            cols,
            rows,
        })
    }

    fn matches(&self, src_w: u32, src_h: u32) -> bool {
        self.src_w == src_w && self.src_h == src_h
    }
}

/// 把 RGB24 源按 plan 写入 u32 目标（含镜像与 contain 居中）。
///
/// 按行块切分后用 `thread::scope` 并行：每块拿互不相交的可变行区间，
/// 不需要跨线程同步。工作线程数按 CPU 与行数自适应，避免小画面下
/// 「线程开销 > 计算收益」的倒挂。
fn blit_scaled_parallel(dst: &mut [u32], win_w: u32, src: &[u8], plan: &ScalePlan) {
    let rows = plan.dst_h as usize;
    if rows == 0 {
        return;
    }
    let max_workers = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .clamp(1, 16);
    let workers = max_workers.min(rows).max(1);
    let win_wu = win_w as usize;
    let total_rows = dst.len() / win_wu.max(1);
    let chunk = total_rows.div_ceil(workers).max(1);
    let off_x = plan.off_x as usize;
    let dst_w = plan.dst_w as usize;
    let off_y = plan.off_y as usize;
    let band_end = off_y + rows;

    thread::scope(|scope| {
        // 整屏按行块切分；完全落在视频行带之外的块直接跳过（黑边不动）。
        for (block, rows_slice) in dst.chunks_mut(chunk * win_wu).enumerate() {
            let band_start = block * chunk;
            if band_start + chunk <= off_y || band_start >= band_end {
                continue;
            }
            // 块可能骑在黑边上：跳过块内属于黑边的前几行，再从视频第 0 行开始写。
            let start_local = off_y.saturating_sub(band_start);
            let src = &src[..];
            let cols = &plan.cols[..];
            let row_offs = &plan.rows[..];
            scope.spawn(move || {
                for (local, dst_row_full) in
                    rows_slice.chunks_mut(win_wu).enumerate().skip(start_local)
                {
                    let dy = band_start + local - off_y;
                    if dy >= rows {
                        break;
                    }
                    let src_row = row_offs[dy];
                    let dst_row = &mut dst_row_full[off_x..off_x + dst_w];
                    for (dx, pixel) in dst_row.iter_mut().enumerate() {
                        let si = src_row + cols[dx];
                        // RGB24 → 0x00RRGGBB。
                        *pixel = ((src[si] as u32) << 16)
                            | ((src[si + 1] as u32) << 8)
                            | (src[si + 2] as u32);
                    }
                }
            });
        }
    });
}

// ---------------------------------------------------------------- 播放器

type Surface = softbuffer::Surface<Arc<Window>, Arc<Window>>;

struct Player {
    options: PlayerOptions,
    slot: Arc<FrameSlot>,
    stop: Arc<AtomicBool>,
    /// 采集线程的致命错误，渲染循环轮询后切换到错误页。
    capture_error: Arc<Mutex<Option<String>>>,
    window: Option<Arc<Window>>,
    surface: Option<Surface>,
    /// 上一次成功对齐的表面尺寸（softbuffer 不暴露查询接口，这里自行记录）。
    surface_size: Option<(u32, u32)>,
    canvas_w: u32,
    canvas_h: u32,
    /// 缓存的缩放计划；源/窗口尺寸变化时重建。
    plan: Option<ScalePlan>,
    /// 记录上一次绘制视频时的几何（窗口尺寸），窗口变化时重清黑边。
    plan_win: Option<(u32, u32)>,
    last_seq: u64,
    /// loading 界面的动画基准时刻。
    started_at: Instant,
    error: Option<String>,
    close_hover: bool,
    close_rect: (i32, i32, i32, i32),
    cursor_pos: (f64, f64),
    render_fps: u32,
    fps_window: Instant,
    frames_in_window: u32,
    /// 是否已经有帧上屏（用于从 loading 切到视频）。
    streaming: bool,
    /// 无新帧/无动画时为 false，跳过整屏 present（4K 下一次 BitBlt 并不便宜）。
    needs_present: bool,
    /// 悬停/尺寸变化后强制重绘一次 Chrome（按钮），即使视频无新帧。
    chrome_dirty: bool,
}

impl Player {
    fn new(
        options: PlayerOptions,
        slot: Arc<FrameSlot>,
        stop: Arc<AtomicBool>,
        capture_error: Arc<Mutex<Option<String>>>,
    ) -> Self {
        Self {
            options,
            slot,
            stop,
            capture_error,
            window: None,
            surface: None,
            surface_size: None,
            canvas_w: 1280,
            canvas_h: 720,
            plan: None,
            plan_win: None,
            last_seq: 0,
            started_at: Instant::now(),
            error: None,
            close_hover: false,
            close_rect: (0, 0, 0, 0),
            cursor_pos: (0.0, 0.0),
            render_fps: 0,
            fps_window: Instant::now(),
            frames_in_window: 0,
            streaming: false,
            needs_present: true,
            chrome_dirty: false,
        }
    }

    fn update_close_rect(&mut self) {
        let w = self.canvas_w as i32;
        let btn_w = 104i32;
        let btn_h = 44i32;
        let margin = 24i32;
        let next = (w - btn_w - margin, margin, btn_w, btn_h);
        if next != self.close_rect {
            self.close_rect = next;
            self.needs_present = true;
        }
    }

    fn draw_close_button(canvas: &mut CanvasView<'_>, rect: (i32, i32, i32, i32), hover: bool) {
        let (x, y, w, h) = rect;
        let (bg, border) = if hover {
            (0x00D93F3F, 0x00FFFFFF)
        } else {
            (0x00241B1B, 0x00808080)
        };
        canvas.fill_rect(x, y, w as u32, h as u32, bg);
        for i in 0..w {
            canvas.put(x + i, y, border);
            canvas.put(x + i, y + h - 1, border);
        }
        for i in 0..h {
            canvas.put(x, y + i, border);
            canvas.put(x + w - 1, y + i, border);
        }
        let label = "EXIT";
        let tw = text_width(label, 3) as i32;
        let th = 7 * 3;
        canvas.text(label, x + (w - tw) / 2, y + (h - th) / 2, 3, 0x00FFFFFF);
    }

    fn draw_loading(canvas: &mut CanvasView<'_>, started_at: Instant) {
        let elapsed = started_at.elapsed().as_secs_f32();
        let cx = (canvas.width / 2) as i32;
        let cy = (canvas.height / 2) as i32;

        canvas.text_centered("YOLK VIRTUAL UNIVERSE", cy - 130, 4, 0x00E8EAF6);
        canvas.text_centered("ENTERING...", cy - 70, 2, 0x0099A0C0);

        // 旋转弧形进度圈：纯像素绘制，成本可忽略。
        let radius = 48i32;
        let thickness = 7i32;
        let spin = elapsed * 3.0;
        for step in 0..72 {
            let angle = spin + step as f32 * (std::f32::consts::TAU / 72.0);
            let fade = 1.0 - step as f32 / 72.0;
            let r = (0x80 + (0x7F as f32 * fade) as u32).min(0xFF);
            let g = (0x60 + (0x9F as f32 * fade) as u32).min(0xFF);
            let b = (0xE8 + (0x17 as f32 * fade) as u32).min(0xFF);
            let color = (r << 16) | (g << 8) | b;
            for ring in radius - thickness..radius {
                let x = cx + (angle.cos() * ring as f32) as i32;
                let y = cy + (angle.sin() * ring as f32) as i32;
                canvas.put(x, y, color);
            }
        }

        canvas.text_centered("PRESS ESC TO EXIT", cy + 110, 2, 0x00707A96);
    }

    fn draw_error(canvas: &mut CanvasView<'_>, message: Option<&str>) {
        let cy = (canvas.height / 2) as i32;
        canvas.text_centered("CAMERA UNAVAILABLE", cy - 60, 3, 0x00FCA5A5);
        canvas.text_centered("PRESS ESC TO EXIT", cy + 10, 2, 0x00707A96);

        // 点阵字体只有 ASCII；中文原因通过状态事件显示在 Yolk 主窗口里。
        if let Some(message) = message {
            let ascii: String = message
                .chars()
                .filter(|c| c.is_ascii_graphic() || *c == ' ')
                .take(64)
                .collect();
            if !ascii.trim().is_empty() {
                canvas.text_centered(&ascii, cy + 50, 2, 0x0094A3B8);
            }
        }
    }

    fn draw_hud(canvas: &mut CanvasView<'_>, render_fps: u32, target_fps: u32) {
        let info = format!("{render_fps} FPS / TARGET {target_fps} FPS");
        canvas.text(&info, 24, 24, 2, 0x00C7D2FE);
    }

    /// 获取（或重建）surface，并保证尺寸与画布一致。
    /// 返回 false 表示本轮无法呈现（下一帧会重试）。
    fn ensure_surface(&mut self) -> bool {
        let Some(window) = self.window.clone() else {
            return false;
        };
        let (Some(w), Some(h)) = (
            NonZeroU32::new(self.canvas_w.max(1)),
            NonZeroU32::new(self.canvas_h.max(1)),
        ) else {
            return false;
        };

        if self.surface.is_none() {
            match softbuffer::Context::new(window.clone()) {
                Ok(context) => match softbuffer::Surface::new(&context, window.clone()) {
                    Ok(surface) => {
                        self.surface = Some(surface);
                        // softbuffer 0.4 不暴露表面尺寸：新表面先记为未知，交由下面的
                        // resize 路径统一成画布尺寸。
                        self.surface_size = None;
                    }
                    Err(err) => {
                        self.error = Some(format!("创建渲染表面失败：{err}"));
                        return false;
                    }
                },
                Err(err) => {
                    self.error = Some(format!("初始化渲染上下文失败：{err}"));
                    return false;
                }
            }
        }

        let surface = self.surface.as_mut().unwrap();
        // 尺寸不同就 resize；失败说明表面已失效，下一帧重建即可。
        if self.surface_size != Some((w.get(), h.get())) {
            if surface.resize(w, h).is_err() {
                self.surface = None;
                return false;
            }
            self.surface_size = Some((w.get(), h.get()));
        }
        true
    }

    /// 把缓冲区内容上屏。调用方保证只在画面确实变化时调用。
    fn present_buffer(&mut self, pixels: &[u32]) {
        let Some(surface) = self.surface.as_mut() else {
            return;
        };
        let rendered = (|| -> Result<(), String> {
            let mut buffer = surface
                .buffer_mut()
                .map_err(|err| format!("获取绘制缓冲失败：{err:?}"))?;
            if buffer.len() == pixels.len() {
                buffer.copy_from_slice(pixels);
                buffer.present().map_err(|err| format!("呈现画面失败：{err:?}"))
            } else {
                // 尺寸刚变，buffer 还没跟上：下一帧重对齐，避免越界。
                Ok(())
            }
        })();

        if rendered.is_err() {
            // 设备/表面丢失属于可恢复情况：丢弃后下一帧重建。
            self.surface = None;
        }
    }

    /// 无新视频帧时只重绘 EXIT 按钮区（局部 damage 上屏，成本可忽略）。
    fn repaint_close_button(&mut self) {
        if !self.ensure_surface() {
            return;
        }
        let Some(surface) = self.surface.as_mut() else {
            return;
        };
        let rendered = (|| -> Result<(), String> {
            let mut buffer = surface
                .buffer_mut()
                .map_err(|err| format!("获取绘制缓冲失败：{err:?}"))?;
            let expected = (self.canvas_w as usize) * (self.canvas_h as usize);
            if buffer.len() != expected {
                return Ok(());
            }
            {
                let mut canvas = CanvasView::new(self.canvas_w, self.canvas_h, &mut buffer);
                Self::draw_close_button(&mut canvas, self.close_rect, self.close_hover);
            }
            let (x, y, w, h) = self.close_rect;
            let rect = softbuffer::Rect {
                x: x.max(0) as u32,
                y: y.max(0) as u32,
                width: NonZeroU32::new((w as u32).max(1)).unwrap(),
                height: NonZeroU32::new((h as u32).max(1)).unwrap(),
            };
            buffer
                .present_with_damage(&[rect])
                .map_err(|err| format!("呈现画面失败：{err:?}"))
        })();

        if rendered.is_err() {
            self.surface = None;
        }
    }

    /// 有新帧时：清黑边 → 并行缩放视频 → 叠 HUD/按钮 → 上屏。
    fn render_video_frame(&mut self, frame: RawFrame) {
        if !self.ensure_surface() {
            return;
        }

        // 几何变化（窗口尺寸/源尺寸）时重建缩放计划并重清黑边；
        // 几何不变时黑边内容保持不动，本轮只重写视频矩形区域。
        let geometry_changed = self.plan_win != Some((self.canvas_w, self.canvas_h))
            || !self
                .plan
                .as_ref()
                .is_some_and(|p| p.matches(frame.width, frame.height));
        if geometry_changed || self.plan.is_none() {
            self.plan = ScalePlan::build(frame.width, frame.height, self.canvas_w, self.canvas_h);
            self.plan_win = Some((self.canvas_w, self.canvas_h));
        }
        let Some(plan) = self.plan.as_ref() else {
            return;
        };
        if plan.dst_w == 0 || plan.dst_h == 0 {
            return;
        }

        let Some(surface) = self.surface.as_mut() else {
            return;
        };
        let rendered = (|| -> Result<(), String> {
            let mut buffer = surface
                .buffer_mut()
                .map_err(|err| format!("获取绘制缓冲失败：{err:?}"))?;
            let expected = (self.canvas_w as usize) * (self.canvas_h as usize);
            if buffer.len() != expected {
                return Ok(());
            }
            // 直写 surface 缓冲：省一次「自持画布 → surface」的整屏 memcpy。
            let mut canvas = CanvasView::new(self.canvas_w, self.canvas_h, &mut buffer);
            if geometry_changed {
                canvas.clear(0x00070B16);
            }
            // 借用拆分：缩放写入视频矩形，HUD/按钮走 CanvasView。
            let (pixels, plan_ref) = (&mut canvas.pixels, &*plan);
            blit_scaled_parallel(pixels, self.canvas_w, &frame.rgb, plan_ref);
            Self::draw_hud(&mut canvas, self.render_fps, self.options.fps);
            Self::draw_close_button(&mut canvas, self.close_rect, self.close_hover);
            buffer.present().map_err(|err| format!("呈现画面失败：{err:?}"))
        })();

        if rendered.is_err() {
            self.surface = None;
            return;
        }

        if !self.streaming {
            self.streaming = true;
            self.started_at = Instant::now();
        }
        self.frames_in_window += 1;
        self.needs_present = false;
    }

    /// loading / 错误页：全屏重绘（低频场景，直接走自持缓冲再上屏）。
    fn render_fullscreen_page(&mut self, is_error: bool) {
        if !self.ensure_surface() {
            return;
        }
        let expected = (self.canvas_w as usize) * (self.canvas_h as usize);
        let mut owned = vec![0u32; expected];
        {
            let mut canvas = CanvasView::new(self.canvas_w, self.canvas_h, &mut owned);
            if is_error {
                canvas.clear(0x001A0B0B);
                Self::draw_error(&mut canvas, self.error.as_deref());
            } else {
                canvas.clear(0x00070B16);
                Self::draw_loading(&mut canvas, self.started_at);
            }
            Self::draw_close_button(&mut canvas, self.close_rect, self.close_hover);
        }
        self.present_buffer(&owned);
        self.needs_present = false;
    }

    fn render(&mut self) {
        // 采集侧致命错误优先上屏。
        if self.error.is_none() {
            if let Ok(mut guard) = self.capture_error.lock() {
                if let Some(message) = guard.take() {
                    self.error = Some(message);
                    self.needs_present = true;
                    report(PlayerStatus {
                        state: "error".into(),
                        message: Some(self.error.clone().unwrap_or_default()),
                        width: None,
                        height: None,
                        fps: None,
                    });
                }
            }
        }

        if self.error.is_some() {
            // 错误页是静态的：只呈现一次，之后不再烧 CPU。
            if self.needs_present {
                self.render_fullscreen_page(true);
            }
            return;
        }

        // 只在有新帧时重新缩放绘制；无新帧时跳过一切工作，连 present 都省掉。
        let seq = self.slot.peek_seq();
        let new_frame = seq != self.last_seq;
        if new_frame {
            self.last_seq = seq;
            if let Some(frame) = self.slot.take_latest() {
                self.update_close_rect();
                self.render_video_frame(frame);
                self.chrome_dirty = false;
            }
        } else if !self.streaming {
            // loading 动画需要持续刷新，但 30fps 足够，没必要跟目标帧率。
            self.update_close_rect();
            self.render_fullscreen_page(false);
        } else if self.chrome_dirty {
            // 视频无新帧但按钮悬停态变了：只重绘右上按钮区并上屏，避免全屏缩放。
            self.update_close_rect();
            self.repaint_close_button();
            self.chrome_dirty = false;
        }
        // streaming 且无新帧、按钮也没变化：画面与 HUD 都没变化，直接跳过 present。

        if self.fps_window.elapsed() >= Duration::from_secs(1) {
            self.render_fps = self.frames_in_window;
            self.frames_in_window = 0;
            self.fps_window = Instant::now();
        }
    }

    fn request_exit(&self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

impl Drop for Player {
    fn drop(&mut self) {
        report(PlayerStatus {
            state: "stopped".into(),
            message: None,
            width: None,
            height: None,
            fps: None,
        });
    }
}

impl ApplicationHandler for Player {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        let attributes = Window::default_attributes()
            .with_title("Yolk 虚拟宇宙")
            .with_inner_size(PhysicalSize::new(1280, 720))
            // 无边框 + Borderless 全屏 = 游戏式全屏观感。
            .with_decorations(false)
            .with_fullscreen(Some(Fullscreen::Borderless(None)));
        let window = match event_loop.create_window(attributes) {
            Ok(window) => Arc::new(window),
            Err(err) => {
                self.error = Some(format!("创建全屏窗口失败：{err}"));
                event_loop.exit();
                return;
            }
        };
        window.set_cursor(CursorIcon::Default);
        let size = window.inner_size();
        self.canvas_w = size.width.max(1);
        self.canvas_h = size.height.max(1);
        self.plan = None;
        self.plan_win = None;
        self.needs_present = true;
        self.window = Some(window);
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        _window_id: WindowId,
        event: WindowEvent,
    ) {
        match event {
            WindowEvent::CloseRequested => {
                self.request_exit();
                event_loop.exit();
            }
            WindowEvent::Resized(size) => {
                self.canvas_w = size.width.max(1);
                self.canvas_h = size.height.max(1);
                self.surface_size = None;
                self.plan = None;
                self.plan_win = None;
                self.needs_present = true;
                self.chrome_dirty = true;
            }
            WindowEvent::KeyboardInput { event, .. } => {
                if event.state == ElementState::Pressed
                    && matches!(event.logical_key, Key::Named(NamedKey::Escape))
                {
                    self.request_exit();
                    event_loop.exit();
                }
            }
            WindowEvent::CursorMoved { position, .. } => {
                self.cursor_pos = (position.x, position.y);
                let (x, y) = (position.x as i32, position.y as i32);
                let (bx, by, bw, bh) = self.close_rect;
                let inside = x >= bx && x < bx + bw && y >= by && y < by + bh;
                if inside != self.close_hover {
                    self.close_hover = inside;
                    self.needs_present = true;
                    self.chrome_dirty = true;
                    if let Some(window) = self.window.clone() {
                        window.set_cursor(if inside {
                            CursorIcon::Pointer
                        } else {
                            CursorIcon::Default
                        });
                    }
                }
            }
            WindowEvent::MouseInput {
                state: ElementState::Pressed,
                button: MouseButton::Left,
                ..
            } => {
                let (x, y) = (self.cursor_pos.0 as i32, self.cursor_pos.1 as i32);
                let (bx, by, bw, bh) = self.close_rect;
                if x >= bx && x < bx + bw && y >= by && y < by + bh {
                    self.request_exit();
                    event_loop.exit();
                }
            }
            WindowEvent::RedrawRequested => {
                self.render();
            }
            _ => {}
        }
    }

    fn about_to_wait(&mut self, event_loop: &ActiveEventLoop) {
        if self.stop.load(Ordering::SeqCst) {
            event_loop.exit();
            return;
        }
        // 主动按目标帧率驱动渲染，而不是 Poll 空转烧 CPU。
        // render() 内部有脏标记门控：无新帧/无动画时直接跳过 present，
        // 所以这里保持固定节拍唤醒即可，空转成本只是一次 seq 检查。
        self.render();
        let interval = Duration::from_micros(1_000_000 / u64::from(self.options.fps.max(1)));
        event_loop.set_control_flow(ControlFlow::WaitUntil(Instant::now() + interval));
    }
}

// ---------------------------------------------------------------- 入口

/// 播放器进程主函数。
pub fn run(options: PlayerOptions) -> bool {
    let slot = Arc::new(FrameSlot::new());
    let stop = Arc::new(AtomicBool::new(false));
    let capture_error = Arc::new(Mutex::new(None::<String>));

    report(PlayerStatus {
        state: "starting".into(),
        message: None,
        width: None,
        height: None,
        fps: None,
    });

    // 采集线程与窗口事件循环并行：窗口先出 loading，等首帧到达后切视频。
    let mut capture_thread = None;
    {
        let slot = slot.clone();
        let stop = stop.clone();
        let error_cell = capture_error.clone();
        if let Ok(handle) = thread::Builder::new()
            .name("vu-capture".into())
            .spawn(move || {
                if let Err(message) = run_capture(options, slot, stop) {
                    if let Ok(mut guard) = error_cell.lock() {
                        *guard = Some(message);
                    }
                }
            })
        {
            capture_thread = Some(handle);
        }
    }

    let event_loop = match EventLoop::new() {
        Ok(event_loop) => event_loop,
        Err(err) => {
            eprintln!("创建事件循环失败：{err}");
            return false;
        }
    };

    {
        let mut player = Player::new(options, slot, stop.clone(), capture_error);
        if let Err(err) = event_loop.run_app(&mut player) {
            eprintln!("事件循环异常退出：{err}");
        }
        // player 在此析构：Drop 里会上报 stopped。
    }

    // 等采集线程收尾，确保摄像头句柄已释放再退出进程。
    stop.store(true, Ordering::SeqCst);
    if let Some(handle) = capture_thread {
        let _ = handle.join();
    }
    true
}
