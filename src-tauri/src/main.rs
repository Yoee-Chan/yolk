#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agent;
mod agent_paths;
mod commands;
mod pipeline;
mod process_util;
mod virtual_universe;
mod vu_player;

use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

fn main() {
    // 播放器模式：成为独立的原生全屏进程，只做采集 + 原生渲染，不启动 Tauri。
    if std::env::args().any(|arg| arg == virtual_universe::PLAYER_FLAG) {
        let options = vu_player::parse_options();
        let ok = vu_player::run(options);
        std::process::exit(if ok { 0 } else { 1 });
    }

    let agent_state: Arc<agent::AgentState> = Arc::new(agent::AgentState::default());
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(agent_state)
        .manage(Mutex::new(PathBuf::new()))
        .manage(Arc::new(virtual_universe::VirtualUniverseState::default()))
        .setup(|app| {
            agent::warmup(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            agent::run_agent_controller,
            agent::cancel_agent_controller,
            agent::agent_controller_input,
            commands::select_folder,
            commands::load_wechat_article,
            commands::save_wechat_article,
            commands::import_wechat_docx,
            commands::pick_docx_file,
            commands::annotate_wechat_article,
            commands::llm_setting,
            commands::jira_oauth_login,
            pipeline::load_pipeline_store,
            pipeline::save_pipeline_store,
            virtual_universe::list_cameras,
            virtual_universe::open_virtual_universe,
            virtual_universe::close_virtual_universe,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");
    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            // 主窗口退出前回收播放器进程，避免留下孤儿全屏窗口。
            virtual_universe::shutdown(app_handle);
        }
    });
}
