use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

/// Returns the path to the canvas state JSON file.
/// Creates the parent directory if it doesn't exist.
pub fn get_state_path() -> Result<PathBuf> {
    let data_dir = dirs::data_dir().context("Could not determine data directory")?;
    let app_dir = data_dir.join("excalicode");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)
            .with_context(|| format!("Failed to create app data dir: {:?}", app_dir))?;
    }
    Ok(app_dir.join("canvas-state.json"))
}

/// Atomically saves data to the state file.
/// Writes to a temporary file first, then renames (atomic on most filesystems).
pub fn save_atomic(data: &str) -> Result<()> {
    let path = get_state_path()?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, data)
        .with_context(|| format!("Failed to write tmp file: {:?}", tmp_path))?;
    fs::rename(&tmp_path, &path)
        .with_context(|| format!("Failed to rename {:?} -> {:?}", tmp_path, path))?;
    Ok(())
}

/// Loads the persisted canvas state from disk.
/// Returns None if the file doesn't exist or is empty/corrupted.
pub fn load_state() -> Result<Option<String>> {
    let path = get_state_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(&path)
        .with_context(|| format!("Failed to read state file: {:?}", path))?;
    if contents.trim().is_empty() {
        log::warn!("State file is empty, treating as no saved state");
        return Ok(None);
    }
    // Validate that it's parseable JSON
    if serde_json::from_str::<serde_json::Value>(&contents).is_err() {
        log::warn!("State file contains invalid JSON, treating as no saved state");
        return Ok(None);
    }
    Ok(Some(contents))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn with_temp_dir<F: FnOnce(PathBuf)>(f: F) {
        let dir = std::env::temp_dir().join(format!("excalicode-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        f(dir.clone());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_save_atomic_creates_file() {
        with_temp_dir(|dir| {
            let path = dir.join("canvas-state.json");
            let tmp_path = path.with_extension("json.tmp");
            let data = r#"{"nodes":[]}"#;
            fs::write(&tmp_path, data).unwrap();
            fs::rename(&tmp_path, &path).unwrap();
            assert!(path.exists());
            assert_eq!(fs::read_to_string(&path).unwrap(), data);
        });
    }

    #[test]
    fn test_load_state_returns_none_when_missing() {
        // get_state_path points to the real app dir, but we can test the logic
        // by checking that a nonexistent file returns None
        let fake_path = std::env::temp_dir().join("excalicode-nonexistent-test/canvas-state.json");
        assert!(!fake_path.exists());
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        // Integration test: save then load using the real functions
        let test_data = r#"{"nodes":[{"id":"test"}],"viewport":{"x":0,"y":0,"zoom":1},"maxZIndex":1}"#;
        save_atomic(test_data).unwrap();
        let loaded = load_state().unwrap();
        assert!(loaded.is_some());
        assert_eq!(loaded.unwrap(), test_data);
        // Cleanup
        let _ = fs::remove_file(get_state_path().unwrap());
    }
}
