use std::{
    collections::HashMap,
    path::PathBuf,
    process::Stdio,
    sync::{Arc, Mutex},
};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::Mutex as AsyncMutex,
};

use crate::agent_paths::{repo_root, stream_binary_path};

pub struct AgentState {
    pub child: AsyncMutex<Option<Child>>,
    pub stdin: AsyncMutex<Option<ChildStdin>>,
}

impl Default for AgentState {
    fn default() -> Self {
        Self { child: AsyncMutex::new(None), stdin: AsyncMutex::new(None) }
    }
}

pub fn child_env() -> HashMap<String, String> {
    let mut env: HashMap<String, String> = std::env::vars().collect();
    env.insert("PYTHONIOENCODING".into(), "utf-8".into());
    env.insert("PYTHONUTF8".into(), "1".into());
    env
}

/// Electron 旧逻辑：开发期 `python agent-controller/agent_stream.py`，
/// 打包后 `resources/agent_stream.exe`，cwd 统一为项目根。
/// Tauri dev 的 cwd 可能是 `src-tauri`，这里显式解析仓库根，避免相对路径失效。
fn stream_command(app: &AppHandle) -> (String, Vec<String>, Option<PathBuf>) {
    if let Some(root) = repo_root(Some(app)) {
        let script = root.join("agent-controller").join("agent_stream.py");
        if script.exists() {
            return (
                python_program(),
                vec![script.to_string_lossy().to_string()],
                Some(root),
            );
        }
    }
    (
        stream_binary_path(app).to_string_lossy().to_string(),
        vec![],
        repo_root(Some(app)),
    )
}

pub fn python_program() -> String {
    static CHOSEN: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    CHOSEN
        .get_or_init(|| {
            // 1. 显式指定优先（可用 YOLK_PYTHON 指向装了项目依赖的解释器）。
            if let Ok(custom) = std::env::var("YOLK_PYTHON") {
                if !custom.trim().is_empty() {
                    return custom;
                }
            }
            // 2. 仓库内虚拟环境。
            if let Some(exe) = repo_root(None).and_then(|r| {
                [
                    r.join(".venv").join("Scripts").join("python.exe"),
                    r.join("venv").join("Scripts").join("python.exe"),
                ]
                .into_iter()
                .find(|p| p.exists())
            }) {
                return exe.to_string_lossy().to_string();
            }
            // 3. PATH 候选中挑能导入项目关键依赖的（conda base 常见缺 tiktoken）。
            let candidates = ["python", "python3", "py"];
            if let Some(found) = candidates.iter().copied().find(|p| python_has_dependencies(p)) {
                return found.to_string();
            }
            // 4. 兜底：只要存在就用第一个。
            for candidate in candidates {
                if which_candidate(candidate) {
                    return candidate.to_string();
                }
            }
            "python".to_string()
        })
        .clone()
}

/// 验证解释器可导入 `agent_stream` 启动所需的代表性依赖。
fn python_has_dependencies(program: &str) -> bool {
    let mut cmd = std::process::Command::new(program);
    cmd.args(["-c", "import tiktoken, openai, httpx"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    crate::process_util::hide_console_std(&mut cmd);
    cmd.status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn which_candidate(program: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("where");
        cmd.arg(program).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null());
        crate::process_util::hide_console_std(&mut cmd);
        cmd.output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("which")
            .arg(program)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

async fn ensure_stream_child(app: &AppHandle, state: &Arc<AgentState>) -> Result<(), String> {
    let mut child = state.child.lock().await;
    // 预热阶段子进程可能已经崩溃（依赖缺失等），必须探测存活，否则会向死进程的
    // stdin 写入导致“发消息没反应”。
    if let Some(existing) = child.as_mut() {
        match existing.try_wait() {
            Ok(None) => return Ok(()),
            _ => {
                // 已退出：清理后再重启。
                *child = None;
                *state.stdin.lock().await = None;
            }
        }
    }
    let (program, args, cwd) = stream_command(app);
    // 打包后 program 是资源目录下的 sidecar exe；若路径不存在，spawn 只会报
    // “系统找不到指定的文件 (os error 2)”，这里补上实际尝试的路径便于排查。
    let mut cmd = Command::new(&program);
    cmd.args(args)
        .kill_on_drop(true)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .envs(child_env());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    crate::process_util::hide_console_tokio(&mut cmd);
    let mut spawned = cmd.spawn().map_err(|e| format!("Failed to spawn agent ({program}): {e}"))?;
    let stdout = spawned.stdout.take().ok_or("missing agent stdout")?;
    let stderr = spawned.stderr.take().ok_or("missing agent stderr")?;
    let stdin = spawned.stdin.take().ok_or("missing agent stdin")?;
    *state.stdin.lock().await = Some(stdin);
    let app_stream = app.clone();
    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_stream.emit("agent-controller-stream", line);
        }
        // stdout 关闭说明子进程已退出：通知前端复位 busy 并解绑监听器。
        let _ = app_stream.emit("agent-controller-exit", serde_json::Value::Null);
    });
    let app_err = app.clone();
    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit("agent-controller-error", line);
        }
    });
    *child = Some(spawned);
    Ok(())
}

/// 启动预热：把常驻的 agent_stream 子进程先拉起来，让 `browser_use` / `manus`
/// 等重型依赖在软件启动阶段完成导入；同时跑一次只读的 agent_tools 调用预热
/// 其一次性进程的启动开销。全部后台执行，失败只上报错误事件，不阻塞启动。
pub fn warmup(app: AppHandle) {
    let app_stream = app.clone();
    tauri::async_runtime::spawn(async move {
        let state = app_stream.state::<Arc<AgentState>>().inner().clone();
        if let Err(e) = ensure_stream_child(&app_stream, &state).await {
            let _ = app_stream.emit("agent-controller-error", format!("预热 agent_stream 失败：{e}"));
        }
    });
    tauri::async_runtime::spawn(async move {
        crate::commands::warmup_agent_tools(&app).await;
    });
}

#[tauri::command]
pub async fn run_agent_controller(app: AppHandle, state: State<'_, Arc<AgentState>>, args: Value) -> Result<(), String> {
    if args.get("interruptPrevious").and_then(|v| v.as_bool()).unwrap_or(false) {
        let _ = cancel_agent_controller(state.clone()).await;
        // 旧 Electron interruptPrevious 语义：杀掉旧进程后重建。
    }
    ensure_stream_child(&app, state.inner()).await?;
    let payload = serde_json::json!({
        "event": "run",
        "msg": args.get("msg").and_then(|v| v.as_str()).unwrap_or(""),
        "history": args.get("history").cloned().unwrap_or(Value::Array(vec![])),
        "authToken": args.get("authToken"), "apiUrl": args.get("apiUrl"),
        "logSessionId": args.get("logSessionId"), "taskId": args.get("taskId"),
        "isFirstMessage": args.get("isFirstMessage").and_then(|v| v.as_bool()).unwrap_or(false),
        // 流水线「立即执行」由用户点击即视为确认，跳过规划确认弹窗，直接进 Agent。
        "skipPlan": args.get("skipPlan").and_then(|v| v.as_bool()).unwrap_or(false),
        "pipelineId": args.get("pipelineId"),
    });
    let mut line = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    line.push('\n');
    let mut stdin = state.stdin.lock().await;
    if let Some(stdin) = stdin.as_mut() {
        stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
        stdin.flush().await.map_err(|e| e.to_string())?;
        Ok(())
    } else { Err("agent stdin unavailable".into()) }
}

#[tauri::command]
pub async fn cancel_agent_controller(state: State<'_, Arc<AgentState>>) -> Result<(), String> {
    let mut child = state.child.lock().await;
    if let Some(c) = child.as_mut() { let _ = c.kill().await; }
    *child = None;
    *state.stdin.lock().await = None;
    Ok(())
}

#[tauri::command]
pub async fn agent_controller_input(app: AppHandle, state: State<'_, Arc<AgentState>>, data: Value) -> Result<(), String> {
    let _ = app.emit("agent-controller-input-echo", serde_json::to_string(&data).unwrap_or_default());
    let mut line = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    line.push('\n');
    let mut stdin = state.stdin.lock().await;
    if let Some(stdin) = stdin.as_mut() {
        stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
        stdin.flush().await.map_err(|e| e.to_string())?;
        Ok(())
    } else { Err("agent not running".into()) }
}

#[allow(dead_code)]
pub fn app_data_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}

pub fn workspace_root_fallback(_app: &AppHandle) -> PathBuf {
    // 与旧 Electron 保持一致：优先读 agent-controller/llm_config/workspace.json，
    // 失败才回退到「文档/workspace」。
    configured_workspace_root().unwrap_or_else(|| {
        _app.path()
            .document_dir()
            .map(|d| d.join("workspace"))
            .unwrap_or_else(|_| PathBuf::from("workspace"))
    })
}

fn configured_workspace_root() -> Option<PathBuf> {
    let root = repo_root(None)?;
    let text = std::fs::read_to_string(root.join("agent-controller").join("llm_config").join("workspace.json")).ok()?;
    let parsed: Value = serde_json::from_str(&text).ok()?;
    let ws = parsed.get("workSpace").and_then(|v| v.as_str())?.trim();
    if ws.is_empty() {
        return None;
    }
    Some(PathBuf::from(shellexpand_tilde(ws)))
}

fn shellexpand_tilde(input: &str) -> String {
    if let Some(rest) = input.strip_prefix("~/").or_else(|| input.strip_prefix("~\\")) {
        if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            return format!("{home}/{rest}");
        }
    }
    input.to_string()
}

pub fn workspace_root(state: &Mutex<PathBuf>) -> PathBuf {
    state.lock().map(|p| p.clone()).unwrap_or_else(|_| PathBuf::from("workspace"))
}
