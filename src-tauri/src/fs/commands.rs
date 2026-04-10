#[derive(serde::Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified_ms: u64,
    created_ms: u64,
    gitignored: bool,
}

#[tauri::command]
pub fn fs_read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();

    // Try to discover a git repo to check gitignore status
    let repo = git2::Repository::discover(&path).ok();

    for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Filter out system/meta dotfiles that are never useful to show
        if name == ".DS_Store" || name == ".Thumbs.db" {
            continue;
        }

        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let entry_path = entry.path();

        // Check if the file is gitignored (also treats .git folder as ignored)
        let gitignored = if name == ".git" {
            true
        } else {
            repo.as_ref()
                .and_then(|r| r.status_should_ignore(&entry_path).ok())
                .unwrap_or(false)
        };

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
            path: entry_path.to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified_ms,
            created_ms,
            gitignored,
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

#[tauri::command]
pub fn fs_create_file(path: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::File::create(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn fs_create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn fs_rename(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn fs_delete(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())?;
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn fs_move(from: String, to_dir: String) -> Result<(), String> {
    let from_path = std::path::Path::new(&from);
    let file_name = from_path
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?;
    let dest = std::path::Path::new(&to_dir).join(file_name);

    // Try rename first (fast, same filesystem)
    match std::fs::rename(&from, &dest) {
        Ok(()) => Ok(()),
        Err(_) => {
            // Fallback: copy then delete (cross-filesystem)
            if from_path.is_dir() {
                copy_dir_recursive(from_path, &dest)?;
                std::fs::remove_dir_all(from_path).map_err(|e| e.to_string())?;
            } else {
                std::fs::copy(&from, &dest).map_err(|e| e.to_string())?;
                std::fs::remove_file(&from).map_err(|e| e.to_string())?;
            }
            Ok(())
        }
    }
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
