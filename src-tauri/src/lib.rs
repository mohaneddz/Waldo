#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use anyhow::Context;
use base64::{engine::general_purpose, Engine};
use lazy_static::lazy_static;
use std::{
    fs::{self, File},
    net::TcpStream,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread::sleep,
    time::{Duration, Instant},
};
use tauri::Manager;

lazy_static! {
    static ref SERVER_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
}

const BACKEND_ADDR: &str = "127.0.0.1:8000";
const EXE_NAME: &str = "appx86_64-pc-windows-msvc.exe";

/// Finds the directory containing the native backend executable.
/// Only looks for the native exe; if not found, returns an error.
fn backend_dir(app: &tauri::AppHandle) -> anyhow::Result<PathBuf> {
    // Bundled resources: <resource_dir>/models/
    let resource_dir = app
        .path()
        .resource_dir()
        .context("Failed to get resource_dir from Tauri")?
        .join("models");

    if resource_dir.join(EXE_NAME).exists() {
        println!(
            "Using bundled resources directory for backend (native exe found): {:?}",
            &resource_dir
        );
        return Ok(resource_dir);
    }

    // Development path: three levels up from current exe, then /models
    let exe_path = std::env::current_exe().context("Failed to get current executable path")?;
    let dev_path = exe_path
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .map(|p| p.join("models"))
        .context("Failed to construct development path to 'models' directory")?;

    if dev_path.join(EXE_NAME).exists() {
        println!(
            "Using development models directory (native exe found): {:?}",
            &dev_path
        );
        return Ok(dev_path);
    }

    anyhow::bail!(
        "Native backend executable not found. Checked:\n  - Bundled Resources: {:?}\n  - Development Path: {:?}",
        &resource_dir,
        &dev_path
    )
}

/// Returns the full path to the native backend executable, or an error if not found.
fn get_backend_executable_path(app: &tauri::AppHandle) -> anyhow::Result<PathBuf> {
    let dir = backend_dir(app)?;
    let exe_path = dir.join(EXE_NAME);

    if exe_path.exists() {
        println!("Resolved native backend executable at: {:?}", &exe_path);
        Ok(exe_path)
    } else {
        anyhow::bail!("Native backend executable not found at expected path: {:?}", exe_path);
    }
}

fn wait_for_port(addr: &str, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect(addr).is_ok() {
            println!("Backend is now available on {}", addr);
            return true;
        }
        sleep(Duration::from_millis(200));
    }
    println!("Timeout reached waiting for backend on {}", addr);
    false
}

#[cfg(windows)]
fn kill_process_tree(pid: u32) {
    println!("Attempting to kill process tree for PID: {}", pid);
    // Best-effort; ignore errors but log them
    if let Err(e) = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
    {
        eprintln!("taskkill failed: {:?}", e);
    }
}

#[cfg(not(windows))]
fn kill_process_tree(pid: u32) {
    println!("Attempting to kill process with PID: {}", pid);
    if let Err(e) = Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status()
    {
        eprintln!("kill failed: {:?}", e);
    }
}

/// Spawns the native backend executable found in /models (no python fallback).
fn spawn_backend(app: &tauri::AppHandle) -> anyhow::Result<Child> {
    let dir = backend_dir(app)?;
    println!("Backend directory resolved to: {:?}", &dir);

    let exe_path = dir.join(EXE_NAME);
    if !exe_path.exists() {
        anyhow::bail!(
            "Expected native backend executable at {:?} but it was not found.",
            exe_path
        );
    }

    // Configure logging for debug builds (writes stdout/stderr to app_log_dir)
    let (stdout_log, stderr_log) = if cfg!(debug_assertions) {
        let log_dir = app.path().app_log_dir().context("Failed to get application log directory")?;
        if !log_dir.exists() {
            fs::create_dir_all(&log_dir)?;
        }
        let stdout_path = log_dir.join("backend-stdout.log");
        let stderr_path = log_dir.join("backend-stderr.log");

        println!("Backend logs will be written to:");
        println!("  stdout: {:?}", &stdout_path);
        println!("  stderr: {:?}", &stderr_path);

        let stdout_file = File::create(stdout_path).context("Failed to create stdout log file")?;
        let stderr_file = File::create(stderr_path).context("Failed to create stderr log file")?;

        (Stdio::from(stdout_file), Stdio::from(stderr_file))
    } else {
        (Stdio::null(), Stdio::null())
    };

    // Launch the native executable directly
    let mut cmd = Command::new(&exe_path);
    cmd.current_dir(&dir)
        .stdin(Stdio::null())
        .stdout(stdout_log)
        .stderr(stderr_log);

    #[cfg(all(windows, not(debug_assertions)))]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    println!("Spawning backend native executable with command: {:?}", cmd);
    cmd.spawn().context("failed to spawn native backend executable")
}

#[tauri::command]
fn read_img(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let encoded = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", encoded))
}

#[tauri::command]
fn restart_server(app: tauri::AppHandle) -> bool {
    println!("Restarting server...");
    let mut server_process = SERVER_PROCESS.lock().unwrap();

    if let Some(mut process) = server_process.take() {
        println!("Found existing server process. Terminating it now.");
        let pid = process.id();
        kill_process_tree(pid);
        let _ = process.wait();
        println!("Old process terminated.");
    }

    match spawn_backend(&app) {
        Ok(child) => {
            println!("Backend process spawned with PID: {}", child.id());
            if wait_for_port(BACKEND_ADDR, Duration::from_secs(60)) {
                println!("Backend started successfully.");
                *server_process = Some(child);
                true
            } else {
                println!("Backend failed to start within the timeout.");
                let mut failed_child = child;
                let pid = failed_child.id();
                kill_process_tree(pid);
                let _ = failed_child.wait();
                false
            }
        }
        Err(e) => {
            eprintln!("Failed to spawn backend: {:?}", e);
            false
        }
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
        // Ensure backend is terminated if a window is closed or app exits
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let mut server_process = SERVER_PROCESS.lock().unwrap();
                if let Some(mut process) = server_process.take() {
                    let pid = process.id();
                    kill_process_tree(pid);
                    let _ = process.wait();
                    println!("Backend process terminated on window close (PID: {}).", pid);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_img,
            restart_server,
        ])
        .setup(|app| {
            restart_server(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
