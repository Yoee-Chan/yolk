use std::{path::PathBuf, sync::Mutex};
use serde_json::Value;
use tauri::AppHandle;
use tokio::{fs, io::AsyncWriteExt, process::Command};
use crate::agent::{child_env, python_program, workspace_root, workspace_root_fallback};
use crate::agent_paths::{dev_docx_converter_cjs, docx_converter_path, repo_root, tools_binary_path};

#[tauri::command]
pub async fn select_folder(app: AppHandle) -> Result<Option<String>, String> {
    let handle = app.clone();
    let picked = tokio::task::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;
        handle.dialog().file().blocking_pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(picked.map(|p| p.to_string()))
}

pub(crate) fn current_workspace_root(app: &AppHandle, ws: &tauri::State<'_, Mutex<PathBuf>>) -> PathBuf {
    let custom = ws.lock().map(|p| !p.as_os_str().is_empty()).unwrap_or(false);
    if custom {
        workspace_root(ws)
    } else {
        workspace_root_fallback(app)
    }
}

/// 只负责选文件并回传原始字节：DOCX → Markdown 的解析交给前端（jszip + xmldom），
/// 从而不必依赖用户机器上装有 Node.js。base64 由 Rust 侧编码，避免前端再引依赖。
#[tauri::command]
pub async fn pick_docx_file(app: AppHandle) -> Result<Option<Value>, String> {
    let handle = app.clone();
    let picked = tokio::task::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;
        handle.dialog().file().add_filter("Word 文档", &["docx"]).blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let path = match picked { Some(p) => p.to_string(), None => return Ok(None) };
    let bytes = fs::read(&path).await.map_err(|e| format!("读取 Word 文档失败：{e}"))?;
    let file_name = PathBuf::from(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "document.docx".into());
    Ok(Some(serde_json::json!({
        "fileName": file_name,
        "base64": base64_encode(&bytes),
    })))
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[(n >> 18) as usize & 63] as char);
        out.push(TABLE[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { TABLE[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[n as usize & 63] as char } else { '=' });
    }
    out
}

#[tauri::command]
pub async fn load_wechat_article(app: AppHandle, ws: tauri::State<'_, Mutex<PathBuf>>) -> Result<Option<Value>, String> {
    let root = current_workspace_root(&app, &ws);
    let path = root.join("微信公众号").join("最近文章.json");
    match fs::read_to_string(path).await {
        Ok(text) => Ok(Some(serde_json::from_str(&text).map_err(|e| e.to_string())?)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn save_wechat_article(app: AppHandle, ws: tauri::State<'_, Mutex<PathBuf>>, article: Value) -> Result<bool, String> {
    let root = current_workspace_root(&app, &ws);
    let dir = root.join("微信公众号");
    fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    let draft = serde_json::json!({
        "title": article.get("title").and_then(|v| v.as_str()).unwrap_or(""),
        "subtitle": article.get("subtitle").and_then(|v| v.as_str()).unwrap_or(""),
        "content": article.get("content").and_then(|v| v.as_str()).unwrap_or(""),
        "outlineTree": article.get("outlineTree").cloned().unwrap_or(Value::Array(vec![])),
        "updatedAt": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    });
    fs::write(dir.join("最近文章.json"), serde_json::to_string_pretty(&draft).map_err(|e| e.to_string())?).await.map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn import_wechat_docx(app: AppHandle, ws: tauri::State<'_, Mutex<PathBuf>>) -> Result<Option<Value>, String> {
    let handle = app.clone();
    let picked = tokio::task::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;
        handle.dialog().file().add_filter("Word 文档", &["docx"]).blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let path = match picked { Some(p) => p.to_string(), None => return Ok(None) };

    // 与旧 Electron 一致：转换产物落到 `<workspace>/微信公众号/imports/...`。
    let wechat_dir = current_workspace_root(&app, &ws).join("微信公众号");
    fs::create_dir_all(&wechat_dir).await.map_err(|e| e.to_string())?;

    let mut converter = docx_converter_path(&app);
    if !converter.exists() {
        if let Some(dev) = dev_docx_converter_cjs(Some(&app)) {
            converter = dev;
        }
    }
    if !converter.exists() {
        return Err("找不到 DOCX 转换器；请先运行 npm run build:docx-converter".into());
    }

    let is_cjs = converter.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("cjs")).unwrap_or(false);
    let output = if is_cjs {
        let node = which_program(&["node", "node.exe"])
            .ok_or_else(|| "需要安装 Node.js 才能导入 Word 文档（也可将 docx_converter.exe 放到安装目录 resources/binaries 下）".to_string())?;
        let mut cmd = Command::new(node);
        cmd.arg(&converter)
            .arg(&path)
            .current_dir(&wechat_dir)
            .envs(child_env());
        crate::process_util::hide_console_tokio(&mut cmd);
        cmd.output().await.map_err(|e| e.to_string())?
    } else {
        let mut cmd = Command::new(&converter);
        cmd.arg(&path)
            .current_dir(&wechat_dir)
            .envs(child_env());
        crate::process_util::hide_console_tokio(&mut cmd);
        cmd.output().await.map_err(|e| e.to_string())?
    };
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() { "Word 文档转换失败".into() } else { detail });
    }
    let value: Value = serde_json::from_slice(&output.stdout).map_err(|e| {
        // 转换器约定只把结果 JSON 写到 stdout；解析失败时把两端输出带出来便于定位。
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        format!(
            "Word 文档转换输出解析失败：{e}\nstdout: {}\nstderr: {}",
            stdout.chars().take(300).collect::<String>(),
            stderr.chars().take(300).collect::<String>()
        )
    })?;
    if value.get("error").and_then(|v| v.as_str()).is_some() {
        return Err(value.get("error").and_then(|v| v.as_str()).unwrap_or("Word 文档转换失败").to_string());
    }
    Ok(Some(value))
}

#[tauri::command]
pub async fn annotate_wechat_article(app: AppHandle, request: Value) -> Result<Value, String> {
    let selected = request.get("selectedText").and_then(|v| v.as_str()).unwrap_or("").trim();
    let annotation = request.get("annotation").and_then(|v| v.as_str()).unwrap_or("").trim();
    if selected.is_empty() || annotation.is_empty() {
        return Err("选中文本和批注不能为空".into());
    }
    // 旧 Electron：优先用前端传入的 token/url，缺失时回退读 local-llm-engine/config/config.toml。
    let (base_url, api_key, model) = annotation_credentials(Some(&app), &request)?;
    // 与旧 Electron 保持一致的提示词约束，避免模型输出解释/系统消息污染正文。
    let prompt = format!(
        "请根据用户批注改写选中的原文。\n只输出最终替换文本；禁止输出解释、前缀、引号、Markdown、系统消息、权限提示、执行计划或工具调用。\n\n文章标题：{}\n\n文章上下文：{}\n\n选中的原文：{}\n\n用户批注：{}",
        request.get("articleTitle").and_then(|v| v.as_str()).unwrap_or(""),
        request.get("articleContent").and_then(|v| v.as_str()).unwrap_or(""),
        selected,
        annotation
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.post(format!("{base_url}/chat/completions"))
        .header("Content-Type", "application/json")
        .bearer_auth(api_key)
        .json(&serde_json::json!({"model": model,
            "messages": [{"role":"system","content":"你是一个只负责返回文本替换结果的中文编辑器。"},{"role":"user","content":prompt}],
            "temperature": 0.2, "max_tokens": 2048, "stream": false}))
        .send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let body_text = resp.text().await.map_err(|e| e.to_string())?;
    let payload: Value = serde_json::from_str(&body_text)
        .map_err(|_| format!("批注模型返回非 JSON 响应（{status}）：{}", body_text.chars().take(200).collect::<String>()))?;
    if !status.is_success() {
        let msg = payload.get("error").and_then(|v| v.get("message")).and_then(|v| v.as_str())
            .or_else(|| payload.get("error").and_then(|v| v.as_str()))
            .unwrap_or("批注模型请求失败");
        return Err(format!("{msg}（{status}）"));
    }
    let replacement = payload.pointer("/choices/0/message/content").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    if replacement.is_empty() { return Err("批注模型没有返回替换内容".into()); }
    Ok(serde_json::json!({"replacement": replacement}))
}

fn annotation_credentials(app: Option<&AppHandle>, request: &Value) -> Result<(String, String, String), String> {
    let mut base_url = request.get("apiUrl").and_then(|v| v.as_str()).unwrap_or("").trim().trim_end_matches('/').to_string();
    let mut api_key = request.get("authToken").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let mut model = request.get("model").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    if base_url.is_empty() || api_key.is_empty() || model.is_empty() {
        if let Some((f_base, f_key, f_model)) = read_engine_llm_config(app) {
            if base_url.is_empty() { base_url = f_base; }
            if api_key.is_empty() { api_key = f_key; }
            if model.is_empty() { model = f_model; }
        }
    }
    if model.is_empty() { model = "qwen-plus".into(); }
    if base_url.is_empty() || api_key.is_empty() {
        return Err("批注模型配置不完整，请检查 local-llm-engine/config/config.toml".into());
    }
    Ok((base_url, api_key, model))
}

fn read_engine_llm_config(app: Option<&AppHandle>) -> Option<(String, String, String)> {
    let root = repo_root(app)?;
    let text = std::fs::read_to_string(root.join("local-llm-engine").join("config").join("config.toml")).ok()?;
    // 与旧 Electron 相同的最小 TOML 解析：只读 [llm] 段的 base_url/api_key/model。
    let section = text.split("[llm]").nth(1).and_then(|s| s.split('[').next().map(|v| v.to_string())).unwrap_or(text);
    let read = |key: &str| -> String {
        for line in section.lines() {
            let t = line.trim();
            if t.starts_with(key) {
                if let Some(eq) = t.find('=') {
                    let v = t[eq + 1..].trim().trim_matches(|c| c == '"' || c == '\'').trim().to_string();
                    // 去掉行尾注释
                    return v.split('#').next().unwrap_or("").trim().trim_matches(|c| c == '"' || c == '\'').to_string();
                }
            }
        }
        String::new()
    };
    let base = read("base_url").trim_end_matches('/').to_string();
    let key = read("api_key");
    let model = read("model");
    if base.is_empty() || key.is_empty() { return None; }
    Some((base, key, model))
}

#[tauri::command]
pub async fn llm_setting(app: AppHandle, param: String) -> Result<String, String> {
    call_agent_tools(&app, &param).await
}

#[tauri::command]
pub async fn jira_oauth_login(app: AppHandle, options: Value) -> Result<Value, String> {
    let key = options.get("default_project_key").and_then(|v| v.as_str()).unwrap_or("");
    let start_out = call_agent_tools(&app, &serde_json::json!({"SettingType":"jira_connector","cmd":"oauth_start","Param":{"default_project_key":key}}).to_string()).await?;
    let start: Value = parse_tools_output(&start_out)?;
    let url = start.get("authorize_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let redirect = start.get("redirect_uri").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let original_state = start.get("state").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if url.is_empty() { return Err("Jira OAuth start failed".into()); }

    // 与旧 Electron 对齐：起本地回调接收 code，而不是只打开浏览器就报错返回。
    let (port, path) = parse_redirect(&redirect);
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await.map_err(|e| format!("本地回调端口 {port} 被占用：{e}"))?;
    open_browser(&url);

    let (code, state, oauth_error) = wait_for_oauth_callback(listener, &path).await?;
    if let Some(err) = oauth_error {
        return Err(err);
    }
    let code = code.unwrap_or_default();
    if code.is_empty() {
        return Err("OAuth 未返回 code".into());
    }
    let finish_out = call_agent_tools(&app, &serde_json::json!({
        "SettingType": "jira_connector",
        "cmd": "oauth_finish",
        "Param": {"code": code, "state": if state.is_empty() { original_state } else { state }, "default_project_key": key}
    }).to_string()).await?;
    parse_tools_output(&finish_out)
}

fn parse_redirect(redirect: &str) -> (u16, String) {
    let mut port: u16 = 8765;
    let mut path = "/callback".to_string();
    if let Some(after) = redirect.split("://").nth(1) {
        let after_path = after.find('/').map(|i| after[i..].to_string()).unwrap_or_default();
        if !after_path.is_empty() {
            path = after_path.split(['?', '#']).next().unwrap_or("/callback").to_string();
            if path.is_empty() { path = "/callback".to_string(); }
        }
        let host_part = after.split('/').next().unwrap_or("");
        if let Some(idx) = host_part.rfind(':') {
            if let Ok(p) = host_part[idx + 1..].parse::<u16>() {
                port = p;
            }
        }
    }
    (port, path)
}

fn open_browser(url: &str) {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "start", "", url]);
        crate::process_util::hide_console_std(&mut cmd);
        let _ = cmd.spawn();
    }
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

async fn wait_for_oauth_callback(listener: tokio::net::TcpListener, expect_path: &str) -> Result<(Option<String>, String, Option<String>), String> {
    use tokio::io::AsyncReadExt;
    let accept = listener.accept();
    let timeout = tokio::time::timeout(std::time::Duration::from_secs(5 * 60), accept).await.map_err(|_| "Jira 登录超时，请重试".to_string())?;
    let (mut stream, _) = timeout.map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; 8192];
    let n = tokio::time::timeout(std::time::Duration::from_secs(30), stream.read(&mut buf)).await.map_err(|_| "读取 OAuth 回调超时".to_string())?.map_err(|e| e.to_string())?;
    let req = String::from_utf8_lossy(&buf[..n]).to_string();
    let first_line = req.lines().next().unwrap_or("");
    let target = first_line.split_whitespace().nth(1).unwrap_or("/");
    let (path, query) = match target.find('?') {
        Some(i) => (target[..i].to_string(), target[i + 1..].to_string()),
        None => (target.to_string(), String::new()),
    };
    let params = parse_query(&query);
    let code = params.get("code").cloned();
    let state = params.get("state").cloned().unwrap_or_default();
    let error = params.get("error").cloned();
    let ok = path == *expect_path && (code.is_some() || error.is_some());
    // 回调页与旧 Electron 一致的中文提示。
    let body = if ok && code.is_some() {
        "<!DOCTYPE html><html><body style=\"font-family:sans-serif;text-align:center;padding:48px\"><h2>✓ Jira 登录成功</h2><p>可以关闭此窗口并返回 Yolk助手。</p></body></html>"
    } else {
        "<!DOCTYPE html><html><body style=\"font-family:sans-serif;text-align:center;padding:48px\"><h2>登录失败</h2><p>未收到授权码，请重试。</p></body></html>"
    };
    let resp = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
    let _ = stream.write_all(resp.as_bytes()).await;
    let _ = stream.shutdown().await;
    if !ok {
        return Ok((None, state, Some("OAuth 未返回 code".into())));
    }
    if let Some(e) = error {
        return Ok((None, state, Some(e)));
    }
    Ok((code, state, None))
}

fn parse_query(query: &str) -> std::collections::HashMap<String, String> {
    let mut out = std::collections::HashMap::new();
    for pair in query.split('&') {
        if pair.is_empty() { continue; }
        let (k, v) = match pair.find('=') {
            Some(i) => (pair[..i].to_string(), pair[i + 1..].to_string()),
            None => (pair.to_string(), String::new()),
        };
        out.insert(url_decode(&k), url_decode(&v));
    }
    out
}

fn url_decode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => { out.push(' '); i += 1; }
            b'%' if i + 2 < bytes.len() => {
                if let (Some(h), Some(l)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                    out.push((h * 16 + l) as char);
                    i += 3;
                } else { out.push('%'); i += 1; }
            }
            b => { out.push(b as char); i += 1; }
        }
    }
    out
}

fn hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

async fn call_agent_tools(app: &AppHandle, param: &str) -> Result<String, String> {
    // 与旧 Electron 一致：开发期 `python agent-controller/agent_tools.py`，
    // 打包后 `resources/agent_tools.exe`，cwd 统一为项目根。
    // 之前直接用相对路径 `agent-controller/agent_tools.py`，而 Tauri dev 的 cwd
    // 是 `src-tauri`，导致 spawn ENOENT；且 stdin 写完不关，
    // `agent_tools.py` 的 `sys.stdin.read()` 永远等不到 EOF，这就是设置页更新失败的原因。
    let root = repo_root(Some(app));
    let script = root.as_ref().map(|r| r.join("agent-controller").join("agent_tools.py"));
    let use_script = script.as_ref().map(|p| p.exists()).unwrap_or(false);
    let (program, args, cwd): (String, Vec<String>, Option<PathBuf>) = if use_script {
        (python_program(), vec![script.unwrap().to_string_lossy().to_string()], root)
    } else {
        (tools_binary_path(app).to_string_lossy().to_string(), vec![], root)
    };
    let mut child_cmd = Command::new(program);
    child_cmd
        .args(args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .envs(child_env())
        .current_dir(cwd.clone().unwrap_or_else(|| PathBuf::from(".")));
    crate::process_util::hide_console_tokio(&mut child_cmd);
    let mut child = child_cmd
        .spawn()
        .map_err(|e| format!("启动 agent_tools 失败：{e}"))?;
    // agent_tools.py 用 sys.stdin.read() 读整段输入，必须写完就 shutdown，否则子进程挂起。
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(format!("{param}\n").as_bytes()).await.map_err(|e| e.to_string())?;
        stdin.shutdown().await.map_err(|e| e.to_string())?;
    }
    let out = child.wait_with_output().await.map_err(|e| e.to_string())?;
    if !out.status.success() {
        let detail = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if detail.is_empty() { format!("agent_tools 异常退出（{}）", out.status) } else { detail });
    }
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    if stdout.trim().is_empty() {
        let detail = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if detail.is_empty() { "agent_tools 返回为空".into() } else { detail });
    }
    Ok(stdout)
}

/// 启动预热：跑一次只读的 `skill/search`，让 `agent_tools` 的解析器与依赖模块
/// 进入系统文件缓存，后续设置页 / Jira 登录等一次性调用会更快。
pub async fn warmup_agent_tools(app: &AppHandle) {
    let payload = serde_json::json!({"SettingType": "skill", "cmd": "search", "Param": {}}).to_string();
    let _ = call_agent_tools(app, &payload).await;
}

fn which_program(candidates: &[&str]) -> Option<String> {
    for c in candidates {
        #[cfg(target_os = "windows")]
        let ok = {
            let mut cmd = std::process::Command::new("where");
            cmd.arg(c).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null());
            crate::process_util::hide_console_std(&mut cmd);
            cmd.output().map(|o| o.status.success()).unwrap_or(false)
        };
        #[cfg(not(target_os = "windows"))]
        let ok = std::process::Command::new("which").arg(c).output().map(|o| o.status.success()).unwrap_or(false);
        if ok { return Some(c.to_string()); }
    }
    None
}

fn parse_tools_output(output: &str) -> Result<Value, String> {
    let parsed: Value = serde_json::from_str(output).map_err(|e| e.to_string())?;
    if parsed.get("type").and_then(|v| v.as_str()) == Some("command_error") {
        return Err(parsed.get("error").and_then(|v| v.as_str()).unwrap_or("agent_tools 执行失败").to_string());
    }
    parsed.get("result").cloned().ok_or_else(|| "agent_tools 返回为空".to_string())
}
