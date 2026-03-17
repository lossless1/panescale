/// Detect the user's default shell for the current platform.
///
/// - On Unix: reads `$SHELL` env var, validates path exists, falls back to `/bin/bash`
/// - On Windows: checks for PowerShell 7 (`pwsh.exe`), then `powershell.exe`, then `cmd.exe`
pub fn detect_default_shell() -> String {
    #[cfg(unix)]
    {
        if let Ok(shell) = std::env::var("SHELL") {
            if !shell.is_empty() && std::path::Path::new(&shell).exists() {
                return shell;
            }
        }
        // Fallback: try common shells
        for fallback in &["/bin/bash", "/bin/sh"] {
            if std::path::Path::new(fallback).exists() {
                return fallback.to_string();
            }
        }
        "/bin/sh".to_string()
    }

    #[cfg(windows)]
    {
        // Check for PowerShell 7 (pwsh.exe) first
        if let Ok(output) = std::process::Command::new("where").arg("pwsh.exe").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout);
                let path = path.trim();
                if !path.is_empty() {
                    return path.lines().next().unwrap_or("pwsh.exe").to_string();
                }
            }
        }
        // Fallback to Windows PowerShell
        if let Ok(system_root) = std::env::var("SystemRoot") {
            let ps_path = format!(
                "{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                system_root
            );
            if std::path::Path::new(&ps_path).exists() {
                return ps_path;
            }
        }
        // Last resort: cmd.exe
        if let Ok(system_root) = std::env::var("SystemRoot") {
            return format!("{}\\System32\\cmd.exe", system_root);
        }
        "cmd.exe".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_default_shell_returns_nonempty() {
        let shell = detect_default_shell();
        assert!(!shell.is_empty(), "Shell path should not be empty");
    }

    #[test]
    fn test_detect_default_shell_path_exists() {
        let shell = detect_default_shell();
        assert!(
            std::path::Path::new(&shell).exists(),
            "Shell path '{}' should exist on the system",
            shell
        );
    }
}
