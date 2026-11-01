//! 流水线任务的本地持久化。
//!
//! 与「微信公众号」草稿一致，落盘在工作区根目录下的 `流水线任务/pipelines.json`，
//! 用户可以直接打开这个文件查看/备份/手改流水线定义与执行记录。

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde_json::Value;
use tauri::AppHandle;
use tokio::fs;

use crate::commands::current_workspace_root;

pub const STORE_DIR: &str = "流水线任务";
pub const STORE_FILE: &str = "pipelines.json";

pub fn store_path(root: &Path) -> PathBuf {
    root.join(STORE_DIR).join(STORE_FILE)
}

#[tauri::command]
pub async fn load_pipeline_store(
    app: AppHandle,
    ws: tauri::State<'_, Mutex<PathBuf>>,
) -> Result<Option<Value>, String> {
    let path = store_path(&current_workspace_root(&app, &ws));
    match fs::read_to_string(&path).await {
        Ok(text) => {
            let value: Value = serde_json::from_str(&text)
                .map_err(|e| format!("{} 解析失败：{e}", path.display()))?;
            Ok(Some(value))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("读取 {} 失败：{e}", path.display())),
    }
}

#[tauri::command]
pub async fn save_pipeline_store(
    app: AppHandle,
    ws: tauri::State<'_, Mutex<PathBuf>>,
    store: Value,
) -> Result<String, String> {
    let path = store_path(&current_workspace_root(&app, &ws));
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)
            .await
            .map_err(|e| format!("创建 {} 失败：{e}", dir.display()))?;
    }
    // 前端已经维护 updatedAt，这里只在缺失时补一个，避免覆盖前端的语义字段。
    let mut payload = store;
    if payload.get("updatedAt").and_then(|v| v.as_str()).is_none() {
        if let Some(obj) = payload.as_object_mut() {
            obj.insert(
                "updatedAt".into(),
                Value::String(chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)),
            );
        }
    }
    let text = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    fs::write(&path, text)
        .await
        .map_err(|e| format!("写入 {} 失败：{e}", path.display()))?;
    Ok(path.to_string_lossy().to_string())
}
