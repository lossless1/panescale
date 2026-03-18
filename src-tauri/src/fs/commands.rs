#[derive(serde::Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified_ms: u64,
    created_ms: u64,
}

#[tauri::command]
pub fn fs_read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();

    for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Filter out hidden files starting with "."
        if name.starts_with('.') {
            continue;
        }

        let metadata = entry.metadata().map_err(|e| e.to_string())?;

        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let created_ms = metadata
            .created()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified_ms,
            created_ms,
        });
    }

    // Sort: folders first, then files, alphabetically within each group
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}
