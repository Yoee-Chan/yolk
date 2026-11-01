//! Windows 打包后主程序是 `windows_subsystem = "windows"`（无控制台），
//! 而 agent_stream / agent_tools / node / python 等子进程都是控制台程序：
//! 不显式要求隐藏，Windows 会给每个子进程弹出一个黑色控制台窗口。
//! dev 模式下父进程本身带控制台，子进程直接挂靠所以从不弹窗。
//!
//! 统一在这里给所有子进程加 `CREATE_NO_WINDOW`。
//! 该标志会创建“存在但不可见”的控制台，子进程再派生的控制台程序会继承它，
//! 因此 Python 工具里 spawn 的进程同样不会弹窗。

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// 隐藏 std::process::Command 子进程的控制台窗口。
pub fn hide_console_std(cmd: &mut std::process::Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = cmd;
    }
}

/// 隐藏 tokio::process::Command 子进程的控制台窗口。
pub fn hide_console_tokio(cmd: &mut tokio::process::Command) {
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = cmd;
    }
}
