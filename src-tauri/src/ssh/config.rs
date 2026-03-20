use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// A saved SSH connection configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    pub user: String,
    pub key_path: Option<String>,
    pub group: Option<String>,
}

fn default_port() -> u16 {
    22
}

/// A named group of SSH connection IDs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshGroup {
    pub name: String,
    pub connections: Vec<String>,
}

/// Persistent store for SSH connections and groups.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SshConnectionStore {
    pub connections: Vec<SshConnection>,
    pub groups: Vec<SshGroup>,
}

impl SshConnectionStore {
    /// Path to the SSH connections JSON file in the app data directory.
    fn config_path() -> Option<PathBuf> {
        dirs::data_dir().map(|d| d.join("panescale").join("ssh_connections.json"))
    }

    /// Load connections from disk. Returns default (empty) store if file doesn't exist.
    pub fn load() -> Self {
        let Some(path) = Self::config_path() else {
            return Self::default();
        };
        if !path.exists() {
            return Self::default();
        }
        match fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    /// Save connections to disk.
    pub fn save(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let Some(path) = Self::config_path() else {
            return Err("Could not determine app data directory".into());
        };
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&path, content)?;
        Ok(())
    }

    /// Find a connection by ID.
    pub fn get_connection(&self, id: &str) -> Option<&SshConnection> {
        self.connections.iter().find(|c| c.id == id)
    }
}

/// A host entry parsed from ~/.ssh/config.
#[derive(Debug, Clone, serde::Serialize)]
pub struct SshConfigHost {
    pub host_alias: String,
    pub hostname: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub identity_file: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssh_connection_serializes() {
        let conn = SshConnection {
            id: "test-id".into(),
            name: "My Server".into(),
            host: "example.com".into(),
            port: 22,
            user: "admin".into(),
            key_path: Some("/home/admin/.ssh/id_rsa".into()),
            group: Some("production".into()),
        };
        let json = serde_json::to_string(&conn).unwrap();
        assert!(json.contains("example.com"));
        let deserialized: SshConnection = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.host, "example.com");
    }

    #[test]
    fn test_ssh_group_serializes() {
        let group = SshGroup {
            name: "production".into(),
            connections: vec!["conn-1".into(), "conn-2".into()],
        };
        let json = serde_json::to_string(&group).unwrap();
        assert!(json.contains("production"));
    }

    #[test]
    fn test_ssh_config_host_serialization() {
        let host = SshConfigHost {
            host_alias: "myserver".to_string(),
            hostname: Some("192.168.1.1".to_string()),
            user: Some("admin".to_string()),
            port: Some(22),
            identity_file: Some("/home/user/.ssh/id_rsa".to_string()),
        };
        let json = serde_json::to_string(&host).unwrap();
        assert!(json.contains("\"host_alias\":\"myserver\""));
        assert!(json.contains("\"hostname\":\"192.168.1.1\""));
    }

    #[test]
    fn test_default_port() {
        let json = r#"{"id":"1","name":"test","host":"h","user":"u","key_path":null,"group":null}"#;
        let conn: SshConnection = serde_json::from_str(json).unwrap();
        assert_eq!(conn.port, 22);
    }
}
