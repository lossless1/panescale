use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use russh::keys::key::PrivateKeyWithHashAlg;
use russh::{ChannelMsg, Disconnect};
use tauri::ipc::Channel;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use super::config::SshConnectionStore;

/// Events streamed from an SSH session to the frontend via Tauri Channel.
/// Matches PtyEvent shape so the frontend can use the same handler pattern.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum SshEvent {
    Data { bytes: Vec<u8> },
    Exit { code: Option<u32> },
}

/// A running SSH session.
/// The channel is split: read_half goes to the reader task, write_half is kept
/// for data/resize operations via the Handle.
pub struct SshSession {
    handle: russh::client::Handle<SshHandler>,
    channel_id: russh::ChannelId,
    write_half: russh::ChannelWriteHalf<russh::client::Msg>,
    reader_task: Option<JoinHandle<()>>,
}

/// Minimal SSH client handler. Accepts all host keys (trust-on-first-use).
#[derive(Clone)]
pub struct SshHandler;

impl russh::client::Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Accept all host keys (TOFU model -- suitable for dev/personal use)
        Ok(true)
    }
}

/// Manages multiple SSH sessions identified by string IDs.
pub struct SshManager {
    sessions: Arc<Mutex<HashMap<String, SshSession>>>,
    config_store: Arc<Mutex<SshConnectionStore>>,
}

impl SshManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            config_store: Arc::new(Mutex::new(SshConnectionStore::load())),
        }
    }

    /// Get the config store for connection CRUD.
    pub async fn get_config_store(&self) -> tokio::sync::MutexGuard<'_, SshConnectionStore> {
        self.config_store.lock().await
    }

    /// Connect to an SSH server and start streaming data to the Tauri channel.
    pub async fn connect(
        &self,
        session_id: String,
        host: String,
        port: u16,
        user: String,
        key_path: Option<String>,
        password: Option<String>,
        cols: u32,
        rows: u32,
        channel: Channel<SshEvent>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let config = Arc::new(russh::client::Config {
            inactivity_timeout: Some(Duration::from_secs(30)),
            ..Default::default()
        });

        // Connect with a timeout
        let mut session = tokio::time::timeout(
            Duration::from_secs(10),
            russh::client::connect(config, (host.as_str(), port), SshHandler),
        )
        .await
        .map_err(|_| "SSH connection timed out")?
        .map_err(|e| format!("SSH connection failed: {}", e))?;

        // Authenticate: try key first, then password
        let mut authenticated = false;

        if let Some(ref kp) = key_path {
            match russh::keys::load_secret_key(kp, password.as_deref()) {
                Ok(key) => {
                    let best_hash = session
                        .best_supported_rsa_hash()
                        .await
                        .ok()
                        .flatten()
                        .flatten();
                    let key_with_alg =
                        PrivateKeyWithHashAlg::new(Arc::new(key), best_hash);
                    match session.authenticate_publickey(&user, key_with_alg).await {
                        Ok(result) if result.success() => authenticated = true,
                        Ok(_) => { /* key auth failed, try password below */ }
                        Err(_) => { /* key auth error, try password below */ }
                    }
                }
                Err(_) => { /* Failed to load key, try password below */ }
            }
        }

        if !authenticated {
            if let Some(ref pw) = password {
                let auth_result = session
                    .authenticate_password(&user, pw)
                    .await
                    .map_err(|e| format!("Password auth error: {}", e))?;
                if !auth_result.success() {
                    return Err("Authentication failed".into());
                }
            } else {
                return Err("Authentication failed: no valid key or password provided".into());
            }
        }

        // Open a channel with PTY
        let ch = session
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open SSH channel: {}", e))?;

        let channel_id = ch.id();

        // Split channel into read and write halves.
        // Read half goes to the reader task, write half is kept for data/resize.
        let (mut read_half, write_half) = ch.split();

        write_half
            .request_pty(false, "xterm-256color", cols, rows, 0, 0, &[])
            .await
            .map_err(|e| format!("Failed to request PTY: {}", e))?;

        write_half
            .request_shell(true)
            .await
            .map_err(|e| format!("Failed to request shell: {}", e))?;

        // Spawn a tokio reader task (russh is async, unlike PTY which uses std::thread)
        let reader_task = tokio::spawn(async move {
            loop {
                match read_half.wait().await {
                    Some(ChannelMsg::Data { ref data }) => {
                        let _ = channel.send(SshEvent::Data {
                            bytes: data.to_vec(),
                        });
                    }
                    Some(ChannelMsg::ExitStatus { exit_status }) => {
                        let _ = channel.send(SshEvent::Exit {
                            code: Some(exit_status),
                        });
                        break;
                    }
                    Some(ChannelMsg::Eof) | None => {
                        let _ = channel.send(SshEvent::Exit { code: None });
                        break;
                    }
                    _ => {}
                }
            }
        });

        let ssh_session = SshSession {
            handle: session,
            channel_id,
            write_half,
            reader_task: Some(reader_task),
        };

        self.sessions.lock().await.insert(session_id, ssh_session);

        Ok(())
    }

    /// Execute a command on a remote host via a new exec channel.
    /// Opens the channel while holding the lock, then drops the lock before reading output.
    pub async fn exec_command(
        &self,
        session_id: &str,
        command: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let ch = {
            let sessions = self.sessions.lock().await;
            let session = sessions.get(session_id)
                .ok_or_else(|| format!("Session '{}' not found", session_id))?;
            session.handle.channel_open_session().await?
        }; // Lock dropped here before reading output

        let (mut read_half, write_half) = ch.split();
        write_half.exec(true, command).await?;

        let mut output = Vec::new();
        loop {
            match read_half.wait().await {
                Some(ChannelMsg::Data { ref data }) => output.extend_from_slice(data),
                Some(ChannelMsg::Eof) | None => break,
                _ => {}
            }
        }
        Ok(String::from_utf8_lossy(&output).to_string())
    }

    /// Connect for file browsing only (no PTY, no terminal tile).
    /// Authenticates and stores the Handle for later exec commands.
    pub async fn connect_browsing(
        &self,
        session_id: String,
        host: String,
        port: u16,
        user: String,
        key_path: Option<String>,
        password: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let config = Arc::new(russh::client::Config {
            inactivity_timeout: Some(Duration::from_secs(30)),
            ..Default::default()
        });

        let mut session = tokio::time::timeout(
            Duration::from_secs(10),
            russh::client::connect(config, (host.as_str(), port), SshHandler),
        )
        .await
        .map_err(|_| "SSH connection timed out")?
        .map_err(|e| format!("SSH connection failed: {}", e))?;

        // Auth cascade: key first, then password (same pattern as connect())
        let mut authenticated = false;
        if let Some(ref kp) = key_path {
            match russh::keys::load_secret_key(kp, password.as_deref()) {
                Ok(key) => {
                    let best_hash = session.best_supported_rsa_hash().await.ok().flatten().flatten();
                    let key_with_alg = PrivateKeyWithHashAlg::new(Arc::new(key), best_hash);
                    match session.authenticate_publickey(&user, key_with_alg).await {
                        Ok(result) if result.success() => authenticated = true,
                        _ => {}
                    }
                }
                Err(_) => {}
            }
        }
        if !authenticated {
            if let Some(ref pw) = password {
                let auth_result = session.authenticate_password(&user, pw).await
                    .map_err(|e| format!("Password auth error: {}", e))?;
                if !auth_result.success() {
                    return Err("Authentication failed".into());
                }
            } else {
                return Err("Authentication failed: no valid key or password provided".into());
            }
        }

        // Store a browsing-only session (no PTY channel, no reader task)
        // Open a session channel just to have valid types, but don't request PTY.
        let ch = session.channel_open_session().await
            .map_err(|e| format!("Failed to open channel: {}", e))?;
        let channel_id = ch.id();
        let (_read_half, write_half) = ch.split();

        let ssh_session = SshSession {
            handle: session,
            channel_id,
            write_half,
            reader_task: None, // No reader for browsing sessions
        };

        self.sessions.lock().await.insert(session_id, ssh_session);
        Ok(())
    }

    /// Write data to an active SSH session.
    pub async fn write(
        &self,
        session_id: &str,
        data: &[u8],
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("SSH session '{}' not found", session_id))?;
        session
            .handle
            .data(session.channel_id, bytes::Bytes::from(data.to_vec()))
            .await
            .map_err(|e| format!("SSH write failed: {:?}", e))?;
        Ok(())
    }

    /// Resize the remote PTY.
    pub async fn resize(
        &self,
        session_id: &str,
        cols: u32,
        rows: u32,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("SSH session '{}' not found", session_id))?;
        session
            .write_half
            .window_change(cols, rows, 0, 0)
            .await
            .map_err(|e| format!("SSH resize failed: {}", e))?;
        Ok(())
    }

    /// Disconnect an SSH session and clean up.
    pub async fn disconnect(
        &self,
        session_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut sessions = self.sessions.lock().await;
        let mut session = sessions
            .remove(session_id)
            .ok_or_else(|| format!("SSH session '{}' not found", session_id))?;

        // Abort the reader task
        if let Some(task) = session.reader_task.take() {
            task.abort();
        }

        // Disconnect the SSH session
        let _ = session
            .handle
            .disconnect(Disconnect::ByApplication, "User disconnected", "en")
            .await;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssh_event_serializes_data() {
        let event = SshEvent::Data {
            bytes: vec![72, 101, 108, 108, 111],
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"event\":\"data\""));
        assert!(json.contains("\"bytes\""));
    }

    #[test]
    fn test_ssh_event_serializes_exit() {
        let event = SshEvent::Exit { code: Some(0) };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"event\":\"exit\""));
        assert!(json.contains("\"code\":0"));
    }

    #[test]
    fn test_ssh_event_serializes_exit_null() {
        let event = SshEvent::Exit { code: None };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"code\":null"));
    }

    #[tokio::test]
    async fn test_ssh_manager_new() {
        let manager = SshManager::new();
        let sessions = manager.sessions.lock().await;
        assert!(sessions.is_empty());
    }
}
