use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn first_existing(candidates: Vec<PathBuf>, fallback: PathBuf) -> PathBuf {
    for c in candidates {
        if c.exists() {
            return c;
        }
    }
    fallback
}

/// 仓库根目录：开发时 `tauri dev` 的 cwd 可能是项目根，也可能是 `src-tauri`，
/// 打包后则回退到可执行文件/资源目录附近。统一向上查找
/// `agent-controller/agent_tools.py` 标记，避免相对路径解析失败。
pub fn repo_root(app: Option<&AppHandle>) -> Option<PathBuf> {
    let mut seeds: Vec<PathBuf> = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        seeds.push(cwd);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            seeds.push(dir.to_path_buf());
        }
    }
    if let Some(app) = app {
        if let Ok(dir) = app.path().resource_dir() {
            seeds.push(dir.clone());
            if let Some(parent) = dir.parent() {
                seeds.push(parent.to_path_buf());
            }
        }
    }
    for seed in seeds {
        let mut cur = Some(seed.as_path());
        for _ in 0..6 {
            if let Some(dir) = cur {
                if dir.join("agent-controller").join("agent_tools.py").exists() {
                    return Some(dir.to_path_buf());
                }
                cur = dir.parent();
            } else {
                break;
            }
        }
    }
    None
}

fn resource_candidates(app: &AppHandle, names: &[&str]) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        for name in names {
            out.push(dir.join("binaries").join(name));
            out.push(dir.join(name));
        }
    }
    out
}

#[allow(dead_code)]
pub fn resource_candidate(app: &AppHandle, name: &str) -> PathBuf {
    let fallback = resource_candidates(app, &[name])
        .into_iter()
        .next()
        .unwrap_or_else(|| PathBuf::from(name));
    fallback
}

fn exe_names(base: &str) -> Vec<String> {
    let stem = base.trim_end_matches(".exe");
    let mut names = vec![base.to_string()];
    #[cfg(target_os = "windows")]
    {
        // stage-binaries 会把 sidecar 重命名为 target-triple 后缀（如
        // agent_stream-x86_64-pc-windows-msvc.exe），后缀加在 stem 之后而不是
        // 整个文件名之后，否则打包后永远找不到可执行文件。
        names.push(format!("{stem}-x86_64-pc-windows-msvc.exe"));
        names.push(format!("{stem}-aarch64-pc-windows-msvc.exe"));
    }
    #[cfg(not(target_os = "windows"))]
    {
        names.push(format!("{stem}-x86_64-unknown-linux-gnu"));
        names.push(format!("{stem}-aarch64-apple-darwin"));
        names.push(stem.to_string());
    }
    names
}

#[allow(dead_code)]
pub fn stream_binary_path(app: &AppHandle) -> PathBuf {
    let names = exe_names("agent_stream.exe");
    let refs: Vec<&str> = names.iter().map(|s| s.as_str()).collect();
    let candidates = resource_candidates(app, &refs);
    let fallback = candidates
        .first()
        .cloned()
        .unwrap_or_else(|| PathBuf::from("agent_stream.exe"));
    first_existing(candidates, fallback)
}

pub fn tools_binary_path(app: &AppHandle) -> PathBuf {
    let names = exe_names("agent_tools.exe");
    let refs: Vec<&str> = names.iter().map(|s| s.as_str()).collect();
    let candidates = resource_candidates(app, &refs);
    let fallback = candidates
        .first()
        .cloned()
        .unwrap_or_else(|| PathBuf::from("agent_tools.exe"));
    first_existing(candidates, fallback)
}

/// DOCX 转换器：生产包优先使用打包的 node 脚本，
/// 兼容历史命名。调用方优先尝试 `.cjs`（用 node 运行），
/// 找不到时再尝试 exe。
pub fn docx_converter_path(app: &AppHandle) -> PathBuf {
    let names = [
        "docx-converter.cjs",
        "docx_converter.cjs",
        "docx_converter.exe",
        "docx-converter.exe",
    ];
    let candidates = resource_candidates(app, &names);
    let fallback = candidates
        .first()
        .cloned()
        .unwrap_or_else(|| PathBuf::from("docx-converter.cjs"));
    first_existing(candidates, fallback)
}

/// 开发期仓库内的转换器脚本（`vite build` 产物）。
#[allow(dead_code)]
pub fn dev_docx_converter_cjs(app: Option<&AppHandle>) -> Option<PathBuf> {
    let root = repo_root(app)?;
    for rel in ["dist-docx/docx-converter.cjs", "src-tauri/binaries/docx-converter.cjs"] {
        let p = root.join(rel);
        if p.exists() {
            return Some(p);
        }
    }
    None
}
