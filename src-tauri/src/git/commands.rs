use git2::{
    ApplyLocation, DiffOptions, Patch, Repository, Signature, Sort, Status, StatusOptions,
};
use std::path::Path;

// ---------- Types ----------

#[derive(serde::Serialize, Clone)]
pub struct GitStatusEntry {
    pub path: String,
    pub status: String,
}

#[derive(serde::Serialize, Clone)]
pub struct DiffLine {
    pub origin: char,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(serde::Serialize, Clone)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub new_start: u32,
    pub old_lines: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(serde::Serialize, Clone)]
pub struct GitFileDiff {
    pub path: String,
    pub hunks: Vec<DiffHunk>,
}

#[derive(serde::Serialize, Clone)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct GitCommitInfo {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parent_oids: Vec<String>,
    pub files_changed: Vec<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct GitStashEntry {
    pub index: usize,
    pub message: String,
    pub oid: String,
}

#[derive(serde::Serialize, Clone)]
pub struct GitConflictEntry {
    pub path: String,
    pub has_ours: bool,
    pub has_theirs: bool,
    pub has_ancestor: bool,
}

// ---------- Commands ----------

#[tauri::command]
pub fn git_is_repo(repo_path: String) -> Result<bool, String> {
    match Repository::open(&repo_path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<Vec<GitStatusEntry>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        // Index (staged) changes
        if s.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED,
        ) {
            let status = if s.contains(Status::INDEX_NEW) {
                "staged_new"
            } else if s.contains(Status::INDEX_MODIFIED) {
                "staged_modified"
            } else if s.contains(Status::INDEX_DELETED) {
                "staged_deleted"
            } else {
                "staged_renamed"
            };
            entries.push(GitStatusEntry {
                path: path.clone(),
                status: status.to_string(),
            });
        }

        // Workdir (unstaged) changes
        if s.intersects(Status::WT_MODIFIED | Status::WT_DELETED | Status::WT_RENAMED) {
            let status = if s.contains(Status::WT_MODIFIED) {
                "modified"
            } else if s.contains(Status::WT_DELETED) {
                "deleted"
            } else {
                "renamed"
            };
            entries.push(GitStatusEntry {
                path: path.clone(),
                status: status.to_string(),
            });
        }

        // Untracked
        if s.contains(Status::WT_NEW) {
            entries.push(GitStatusEntry {
                path: path.clone(),
                status: "untracked".to_string(),
            });
        }

        // Conflicted
        if s.contains(Status::CONFLICTED) {
            entries.push(GitStatusEntry {
                path,
                status: "conflicted".to_string(),
            });
        }
    }

    Ok(entries)
}

#[tauri::command]
pub fn git_stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;

    let abs_path = Path::new(&repo_path).join(&file_path);
    if abs_path.exists() {
        index
            .add_path(Path::new(&file_path))
            .map_err(|e| e.to_string())?;
    } else {
        // File was deleted -- remove from index
        index
            .remove_path(Path::new(&file_path))
            .map_err(|e| e.to_string())?;
    }
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|r| r.peel_to_tree());

    match head {
        Ok(tree) => {
            // HEAD exists: reset index entry to HEAD version
            repo.reset_default(Some(&tree.into_object()), [&file_path])
                .map_err(|e| e.to_string())?;
        }
        Err(_) => {
            // No HEAD (initial commit): remove from index
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index
                .remove_path(Path::new(&file_path))
                .map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let sig = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("Unknown", "unknown@local").unwrap());
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let parents = match repo.head() {
        Ok(head) => vec![head.peel_to_commit().map_err(|e| e.to_string())?],
        Err(_) => vec![],
    };
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)
        .map_err(|e| e.to_string())?;
    Ok(oid.to_string())
}

#[tauri::command]
pub fn git_diff_file(
    repo_path: String,
    file_path: String,
    staged: bool,
) -> Result<GitFileDiff, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(&file_path);

    let diff = if staged {
        let head_tree = repo.head().and_then(|h| h.peel_to_tree()).ok();
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
            .map_err(|e| e.to_string())?
    } else {
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| e.to_string())?
    };

    // Use Patch API to collect hunks and lines (avoids borrow issues with foreach)
    let num_deltas = diff.deltas().len();
    let mut hunks: Vec<DiffHunk> = Vec::new();

    for delta_idx in 0..num_deltas {
        if let Ok(Some(patch)) = Patch::from_diff(&diff, delta_idx) {
            for hunk_idx in 0..patch.num_hunks() {
                if let Ok((hunk, _num_lines_in_hunk)) = patch.hunk(hunk_idx) {
                    let header = String::from_utf8_lossy(hunk.header()).to_string();
                    let mut lines = Vec::new();

                    let num_lines = patch.num_lines_in_hunk(hunk_idx).unwrap_or(0);
                    for line_idx in 0..num_lines {
                        if let Ok(line) = patch.line_in_hunk(hunk_idx, line_idx) {
                            lines.push(DiffLine {
                                origin: line.origin(),
                                content: String::from_utf8_lossy(line.content()).to_string(),
                                old_lineno: line.old_lineno(),
                                new_lineno: line.new_lineno(),
                            });
                        }
                    }

                    hunks.push(DiffHunk {
                        header,
                        old_start: hunk.old_start(),
                        new_start: hunk.new_start(),
                        old_lines: hunk.old_lines(),
                        new_lines: hunk.new_lines(),
                        lines,
                    });
                }
            }
        }
    }

    Ok(GitFileDiff {
        path: file_path,
        hunks,
    })
}

#[tauri::command]
pub fn git_stage_hunk(
    repo_path: String,
    file_path: String,
    hunk_index: usize,
) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(&file_path);

    let diff = repo
        .diff_index_to_workdir(None, Some(&mut diff_opts))
        .map_err(|e| e.to_string())?;

    let mut patch = Patch::from_diff(&diff, 0)
        .map_err(|e| e.to_string())?
        .ok_or("No patch found for file")?;

    let num_hunks = patch.num_hunks();
    if hunk_index >= num_hunks {
        return Err(format!(
            "Hunk index {} out of range (file has {} hunks)",
            hunk_index, num_hunks
        ));
    }

    // Build a partial patch containing only the target hunk
    let full_patch = patch.to_buf().map_err(|e| e.to_string())?;
    let full_text = String::from_utf8_lossy(&full_patch);
    let text_lines: Vec<&str> = full_text.lines().collect();

    let mut patch_buf = Vec::new();

    // Extract diff header (everything before the first @@ line)
    let mut header_end = 0;
    for (i, line) in text_lines.iter().enumerate() {
        if line.starts_with("@@") {
            header_end = i;
            break;
        }
    }

    // Write header
    for line in &text_lines[..header_end] {
        patch_buf.extend_from_slice(line.as_bytes());
        patch_buf.push(b'\n');
    }

    // Find the target hunk (nth @@ section)
    let mut current_hunk = 0;
    let mut in_target = false;
    for line in &text_lines[header_end..] {
        if line.starts_with("@@") {
            if current_hunk == hunk_index {
                in_target = true;
            } else if in_target {
                break;
            }
            current_hunk += 1;
        }
        if in_target {
            patch_buf.extend_from_slice(line.as_bytes());
            patch_buf.push(b'\n');
        }
    }

    let partial_diff = git2::Diff::from_buffer(&patch_buf).map_err(|e| e.to_string())?;
    repo.apply(&partial_diff, ApplyLocation::Index, None)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn git_unstage_hunk(
    repo_path: String,
    file_path: String,
    hunk_index: usize,
) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(&file_path);

    let head_tree = repo.head().and_then(|h| h.peel_to_tree()).ok();

    let diff = repo
        .diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
        .map_err(|e| e.to_string())?;

    let mut patch = Patch::from_diff(&diff, 0)
        .map_err(|e| e.to_string())?
        .ok_or("No patch found for file")?;

    let num_hunks = patch.num_hunks();
    if hunk_index >= num_hunks {
        return Err(format!(
            "Hunk index {} out of range (file has {} hunks)",
            hunk_index, num_hunks
        ));
    }

    // Build reversed partial patch (swap +/- and old/new counts)
    let full_patch = patch.to_buf().map_err(|e| e.to_string())?;
    let full_text = String::from_utf8_lossy(&full_patch);
    let text_lines: Vec<&str> = full_text.lines().collect();

    let mut patch_buf = Vec::new();

    // Extract and reverse diff header (swap a/b paths)
    let mut header_end = 0;
    for (i, line) in text_lines.iter().enumerate() {
        if line.starts_with("@@") {
            header_end = i;
            break;
        }
    }

    // Write header, swapping --- a/ and +++ b/ paths
    for line in &text_lines[..header_end] {
        if line.starts_with("--- a/") {
            patch_buf.extend_from_slice(b"--- b/");
            patch_buf.extend_from_slice(line[6..].as_bytes());
        } else if line.starts_with("+++ b/") {
            patch_buf.extend_from_slice(b"+++ a/");
            patch_buf.extend_from_slice(line[6..].as_bytes());
        } else {
            patch_buf.extend_from_slice(line.as_bytes());
        }
        patch_buf.push(b'\n');
    }

    // Find and reverse the target hunk
    let mut current_hunk = 0;
    let mut in_target = false;
    for line in &text_lines[header_end..] {
        if line.starts_with("@@") {
            if current_hunk == hunk_index {
                in_target = true;
            } else if in_target {
                break;
            }
            current_hunk += 1;
            if in_target {
                // Reverse the hunk header: swap old/new ranges
                let reversed = reverse_hunk_header(line);
                patch_buf.extend_from_slice(reversed.as_bytes());
                patch_buf.push(b'\n');
                continue;
            }
        }
        if in_target {
            // Swap + and - lines
            if line.starts_with('+') {
                patch_buf.push(b'-');
                patch_buf.extend_from_slice(line[1..].as_bytes());
            } else if line.starts_with('-') {
                patch_buf.push(b'+');
                patch_buf.extend_from_slice(line[1..].as_bytes());
            } else {
                patch_buf.extend_from_slice(line.as_bytes());
            }
            patch_buf.push(b'\n');
        }
    }

    let partial_diff = git2::Diff::from_buffer(&patch_buf).map_err(|e| e.to_string())?;
    repo.apply(&partial_diff, ApplyLocation::Index, None)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Reverse a hunk header by swapping old/new range values.
/// "@@ -1,3 +1,5 @@" becomes "@@ -1,5 +1,3 @@"
fn reverse_hunk_header(header: &str) -> String {
    let trimmed = header.trim_start_matches("@@ ").trim_end();
    let parts: Vec<&str> = trimmed
        .split(" @@ ")
        .next()
        .unwrap_or("")
        .split(' ')
        .collect();
    if parts.len() >= 2 {
        let old_part = parts[0]; // -X,Y
        let new_part = parts[1]; // +X,Y
        let reversed_old = format!("-{}", &new_part[1..]);
        let reversed_new = format!("+{}", &old_part[1..]);
        let suffix = if let Some(idx) = header.find(" @@ ") {
            &header[idx + 4..]
        } else {
            ""
        };
        if suffix.is_empty() {
            format!("@@ {} {} @@", reversed_old, reversed_new)
        } else {
            format!("@@ {} {} @@ {}", reversed_old, reversed_new, suffix)
        }
    } else {
        header.to_string()
    }
}

#[tauri::command]
pub fn git_branches(repo_path: String) -> Result<Vec<GitBranch>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let branches = repo.branches(None).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for branch in branches {
        let (branch, branch_type) = branch.map_err(|e| e.to_string())?;
        let name = branch
            .name()
            .map_err(|e| e.to_string())?
            .unwrap_or("")
            .to_string();
        let is_current = branch.is_head();
        let is_remote = branch_type == git2::BranchType::Remote;
        result.push(GitBranch {
            name,
            is_current,
            is_remote,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn git_create_branch(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().map_err(|e| e.to_string())?;
    let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    repo.branch(&name, &commit, false)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_switch_branch(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    repo.set_head(&format!("refs/heads/{}", name))
        .map_err(|e| e.to_string())?;
    repo.checkout_head(Some(
        git2::build::CheckoutBuilder::default().force(),
    ))
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_delete_branch(repo_path: String, name: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut branch = repo
        .find_branch(&name, git2::BranchType::Local)
        .map_err(|e| e.to_string())?;

    if branch.is_head() {
        return Err("Cannot delete the current branch".to_string());
    }

    branch.delete().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_log(
    repo_path: String,
    limit: usize,
    skip: usize,
) -> Result<Vec<GitCommitInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(Sort::TOPOLOGICAL | Sort::TIME)
        .map_err(|e| e.to_string())?;

    let oids: Vec<git2::Oid> = revwalk
        .skip(skip)
        .take(limit)
        .filter_map(|oid| oid.ok())
        .collect();

    let mut commits = Vec::new();
    for oid in oids {
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let oid_str = oid.to_string();
        let short_oid = if oid_str.len() >= 7 {
            oid_str[..7].to_string()
        } else {
            oid_str.clone()
        };

        let message = commit.message().unwrap_or("").to_string();
        let author = commit.author().name().unwrap_or("").to_string();
        let author_email = commit.author().email().unwrap_or("").to_string();
        let timestamp = commit.time().seconds();
        let parent_oids: Vec<String> = commit.parent_ids().map(|p| p.to_string()).collect();
        let files_changed = get_commit_files_changed(&repo, &commit);

        commits.push(GitCommitInfo {
            oid: oid_str,
            short_oid,
            message,
            author,
            author_email,
            timestamp,
            parent_oids,
            files_changed,
        });
    }

    Ok(commits)
}

fn get_commit_files_changed(repo: &Repository, commit: &git2::Commit) -> Vec<String> {
    let commit_tree = match commit.tree() {
        Ok(t) => t,
        Err(_) => return Vec::new(),
    };

    let parent_tree = if commit.parent_count() > 0 {
        commit.parent(0).ok().and_then(|p| p.tree().ok())
    } else {
        None
    };

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)
        .ok();

    match diff {
        Some(d) => d
            .deltas()
            .filter_map(|delta| {
                delta
                    .new_file()
                    .path()
                    .map(|p| p.to_string_lossy().to_string())
            })
            .collect(),
        None => Vec::new(),
    }
}

#[tauri::command]
pub fn git_stash_save(repo_path: String, message: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let sig = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("Unknown", "unknown@local").unwrap());
    repo.stash_save(&sig, &message, None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_stash_list(repo_path: String) -> Result<Vec<GitStashEntry>, String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut stashes = Vec::new();

    repo.stash_foreach(|index, message, oid| {
        stashes.push(GitStashEntry {
            index,
            message: message.to_string(),
            oid: oid.to_string(),
        });
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(stashes)
}

#[tauri::command]
pub fn git_stash_apply(repo_path: String, index: usize) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    repo.stash_apply(index, None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_stash_pop(repo_path: String, index: usize) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    repo.stash_pop(index, None).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_stash_drop(repo_path: String, index: usize) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    repo.stash_drop(index).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_conflicts(repo_path: String) -> Result<Vec<GitConflictEntry>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let index = repo.index().map_err(|e| e.to_string())?;
    let conflicts = index.conflicts().map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for conflict in conflicts {
        let conflict = conflict.map_err(|e| e.to_string())?;
        let path = conflict
            .our
            .as_ref()
            .or(conflict.their.as_ref())
            .or(conflict.ancestor.as_ref())
            .and_then(|entry| std::str::from_utf8(&entry.path).ok())
            .unwrap_or("")
            .to_string();

        entries.push(GitConflictEntry {
            path,
            has_ours: conflict.our.is_some(),
            has_theirs: conflict.their.is_some(),
            has_ancestor: conflict.ancestor.is_some(),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn git_resolve_conflict(
    repo_path: String,
    file_path: String,
    resolution: String,
) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    match resolution.as_str() {
        "ours" => {
            repo.checkout_head(Some(
                git2::build::CheckoutBuilder::default()
                    .force()
                    .path(&file_path),
            ))
            .map_err(|e| e.to_string())?;
        }
        "theirs" => {
            // For "theirs", checkout the MERGE_HEAD version
            let merge_head = repo
                .find_reference("MERGE_HEAD")
                .and_then(|r| r.peel_to_commit())
                .map_err(|e| e.to_string())?;
            let their_tree = merge_head.tree().map_err(|e| e.to_string())?;
            let their_entry = their_tree
                .get_path(Path::new(&file_path))
                .map_err(|e| e.to_string())?;
            let blob = repo
                .find_blob(their_entry.id())
                .map_err(|e| e.to_string())?;
            let full_path = Path::new(&repo_path).join(&file_path);
            std::fs::write(&full_path, blob.content()).map_err(|e| e.to_string())?;
        }
        _ => {
            return Err(format!(
                "Invalid resolution: {}. Use 'ours' or 'theirs'",
                resolution
            ))
        }
    }

    // Mark as resolved by staging
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_path(Path::new(&file_path))
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    Ok(())
}
