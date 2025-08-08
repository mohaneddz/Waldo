use base64::engine::general_purpose;
use base64::engine::Engine;
use lazy_static::lazy_static;
use std::fs;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread::sleep;
use std::time::{Duration, Instant};
use tauri::path::BaseDirectory;
use tauri::Manager;

lazy_static! {
    static ref SERVER_PROCESS: Mutex<Option<std::process::Child>> = Mutex::new(None);
}

fn backend_dir() -> Option<PathBuf> {
    let check = |candidate: PathBuf| {
        if candidate.join("app.py").exists() {
            return Some(candidate);
        }
        None
    };

    // Try exe-derived locations
    if let Ok(exe) = std::env::current_exe() {
        if let Some(mut dir) = exe.parent().map(|p| p.to_path_buf()) {
            for _ in 0..3 {
                if let Some(parent) = dir.parent() {
                    dir = parent.to_path_buf();
                }
            }
            let backend_candidate = dir.join("backend");
            if let Some(found) = check(backend_candidate) {
                return Some(found);
            }
            let src_models_candidate = dir.join("src-tauri").join("models");
            if let Some(found) = check(src_models_candidate) {
                return Some(found);
            }
        }
    }

    // Try current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let backend_candidate = cwd.join("backend");
        if let Some(found) = check(backend_candidate) {
            return Some(found);
        }
        let src_models_candidate = cwd.join("src-tauri").join("models");
        if let Some(found) = check(src_models_candidate) {
            return Some(found);
        }
    }

    None
}

fn wait_for_port(addr: &str, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect(addr).is_ok() {
            return true;
        }
        sleep(Duration::from_millis(200));
    }
    false
}

#[cfg(windows)]
fn kill_process_tree(pid: u32) {
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .and_then(|mut c| c.wait());
}

#[cfg(not(windows))]
fn kill_process_tree(_pid: u32) {}

const BACKEND_ADDR: &str = "127.0.0.1:8000";

/// Check if conda is available, without showing any terminal window (Windows-safe)
#[cfg(windows)]
fn conda_available() -> bool {
    use std::os::windows::process::CommandExt;
    Command::new("conda")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map(|mut child| child.wait().map(|s| s.success()).unwrap_or(false))
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn conda_available() -> bool {
    Command::new("conda")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|mut child| child.wait().map(|s| s.success()).unwrap_or(false))
        .unwrap_or(false)
}

fn spawn_backend(_app: &tauri::AppHandle) -> std::io::Result<Child> {
    let Some(dir) = backend_dir() else {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "backend directory not found",
        ));
    };

    let use_conda = conda_available();

    let mut cmd = if use_conda {
        let mut c = Command::new("conda");
        c.args(["run", "-n", "waldo", "python", "app.py"]);
        c
    } else {
        let mut c = Command::new("python");
        c.args(["app.py"]);
        c
    };

    cmd.current_dir(&dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.spawn()
}

#[tauri::command]
fn read_img(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let encoded = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", encoded))
}

#[tauri::command]
fn launch_backend(app: tauri::AppHandle) -> bool {
    let mut server_process = SERVER_PROCESS.lock().unwrap();
    if server_process.is_some() {
        return true;
    }
    match spawn_backend(&app) {
        Ok(mut child) => {
            let pid = child.id();
            if wait_for_port(BACKEND_ADDR, Duration::from_secs(20)) {
                *server_process = Some(child);
                true
            } else {
                let _ = child.kill();
                #[cfg(windows)]
                {
                    kill_process_tree(pid);
                }
                let _ = child.wait();
                false
            }
        }
        Err(_) => false,
    }
}

#[tauri::command]
fn restart_server(app: tauri::AppHandle) -> bool {
    let mut server_process = SERVER_PROCESS.lock().unwrap();

    if let Some(mut process) = server_process.take() {
        let pid = process.id();
        let _ = process.kill();
        #[cfg(windows)]
        {
            kill_process_tree(pid);
        }
        let _ = process.wait();
    }

    match spawn_backend(&app) {
        Ok(mut child) => {
            let pid = child.id();
            if wait_for_port(BACKEND_ADDR, Duration::from_secs(20)) {
                *server_process = Some(child);
                true
            } else {
                let _ = child.kill();
                #[cfg(windows)]
                {
                    kill_process_tree(pid);
                }
                let _ = child.wait();
                false
            }
        }
        Err(_) => false,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_img,
            launch_backend,
            restart_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
