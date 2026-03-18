# Phase 4: Git UI - Research

**Researched:** 2026-03-18
**Domain:** Git operations via git2 crate (Rust) + React sidebar UI
**Confidence:** HIGH

## Summary

Phase 4 adds a complete git workflow UI as a third sidebar tab. The backend uses the `git2` crate (v0.20.x, libgit2 bindings) for all git operations -- status, staging, commits, diffs, branches, log, stash, and merge conflict detection. The frontend renders status panels, inline diffs, an SVG commit graph, and branch/stash management, all following the established Tauri IPC + Zustand store + sidebar component patterns already in the codebase.

The most technically complex aspects are: (1) hunk-level staging via `Repository::apply()` with `ApplyLocation::Index`, (2) SVG commit graph topology rendering with lane assignment, and (3) efficient polling/refresh of git status. All git2 APIs needed are confirmed available in v0.20.4. The codebase already has clean patterns for IPC wrappers, sidebar tabs, context menus, and Zustand stores that this phase extends.

**Primary recommendation:** Add `git2 = "0.20"` to Cargo.toml, create a `src-tauri/src/git/` module following the `fs/` pattern (commands.rs + mod.rs), and build the frontend as `src/components/sidebar/git/` components with a dedicated `gitStore.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Git UI lives as a third sidebar tab alongside Files and Terminals (in SidebarTabs)
- Status panel organizes files in three grouped sections: Staged, Unstaged, Untracked (VS Code style)
- Stage/unstage via hover +/- icon click on each file (VS Code pattern)
- Inline (unified) diff format -- single column with red/green lines
- Diff expands in-place within the sidebar when clicking a changed file
- Hunk-level staging supported -- users can stage/unstage individual changed sections within a file
- Graphical lines + dots for branch topology -- colored SVG lines connecting commits (GitKraken/GitLens style)
- Commit log lives in the git sidebar tab as a scrollable section below status panel
- Click a commit to expand inline -- shows message, author, date, and list of changed files

### Claude's Discretion
- Merge conflict resolution UI design
- Commit message input placement and multiline support
- Branch list UI (dropdown, list, or panel)
- Stash list UI and management flow
- Exact SVG graph rendering approach
- Auto-refresh interval for git status polling
- Keyboard shortcuts for git operations

### Deferred Ideas (OUT OF SCOPE)
- Full three-way merge editor -- v2 feature (GIT-V2 territory)
- Interactive rebase UI -- already tracked as GIT-V2-01
- Cherry-pick with visual selection -- already tracked as GIT-V2-02
- Blame view for files -- already tracked as GIT-V2-03
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GIT-01 | Sidebar shows git status panel with staged, unstaged, and untracked files | `Repository::statuses()` returns StatusEntries with flags for index/workdir status; map to three groups |
| GIT-02 | User can stage and unstage individual files from the git panel | `Index::add_path()` for staging, `Index::remove_path()` + reset to HEAD for unstaging |
| GIT-03 | User can write a commit message and commit staged changes | `Repository::commit()` with tree from index, parent from HEAD |
| GIT-04 | User can view diffs for changed files (inline or side-by-side) | `diff_index_to_workdir()` for unstaged, `diff_tree_to_index()` for staged; `Diff::foreach()` for hunks+lines |
| GIT-05 | User can see a list of branches and current branch indicator | `Repository::branches()` iterator + `Repository::head()` for current |
| GIT-06 | User can create, switch, and delete branches | `Repository::branch()`, `Repository::set_head()` + checkout, `Branch::delete()` |
| GIT-07 | User can view commit log with branch topology graph | `Repository::revwalk()` with TOPOLOGICAL sort + parent_ids for graph; SVG rendering on frontend |
| GIT-08 | User can stash changes and manage stashes | `stash_save()`, `stash_foreach()`, `stash_apply()`, `stash_pop()`, `stash_drop()` |
| GIT-09 | User can resolve merge conflicts through a dedicated UI | `Repository::index().conflicts()` lists conflicted files; per-file accept theirs/ours/open in editor |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| git2 | 0.20.4 | All git operations (Rust backend) | Official libgit2 Rust bindings, maintained by rust-lang org. Covers status, diff, commit, branch, log, stash, merge. Bundles libgit2 source -- no system dependency. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| serde / serde_json | 1.x | Serialize git data structs for IPC | Already in Cargo.toml; use for all git command responses |
| zustand | 5.0.12 | Git store (frontend state) | Already in project; new gitStore.ts for status, branches, log state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| git2 | gitoxide (gix) | Pre-1.0, API breaks every 4 weeks, incomplete features |
| git2 | shell out to `git` CLI | Requires git installed, fragile output parsing |
| Custom SVG graph | @gitgraph/react | Last updated 2020, limited customization, adds dependency for simple SVG rendering |

**Installation:**
```toml
# Add to src-tauri/Cargo.toml [dependencies]
git2 = "0.20"
```

No new frontend npm packages needed -- SVG rendering is plain React + SVG elements.

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/
  git/
    mod.rs           # pub mod commands; GitManager state
    commands.rs      # #[tauri::command] functions for all git ops
src/
  components/sidebar/git/
    GitPanel.tsx     # Main container: status + commit + log sections
    StatusSection.tsx    # Staged/Unstaged/Untracked file groups
    FileChangeItem.tsx   # Single file row with +/- stage icons
    DiffViewer.tsx       # Inline unified diff with hunk actions
    CommitSection.tsx    # Message input + commit button
    BranchSection.tsx    # Branch list, create, switch, delete
    CommitLog.tsx        # Scrollable commit log with SVG graph
    CommitLogItem.tsx    # Expandable commit row
    CommitGraph.tsx      # SVG graph lines + dots renderer
    StashSection.tsx     # Stash list and management
    ConflictSection.tsx  # Merge conflict file list + resolution actions
  stores/
    gitStore.ts      # Zustand store for git state
  lib/
    ipc.ts           # Add git IPC wrappers (extend existing file)
```

### Pattern 1: Git Tauri Commands (follow existing fs/commands.rs pattern)
**What:** Each git operation is a `#[tauri::command]` function accessing a git2 Repository
**When to use:** All git backend operations
**Example:**
```rust
// src-tauri/src/git/commands.rs
use git2::{Repository, StatusOptions};

#[derive(serde::Serialize)]
pub struct GitStatusEntry {
    path: String,
    status: String,  // "staged_new" | "staged_modified" | "staged_deleted" | "modified" | "deleted" | "untracked" | "conflicted"
}

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<Vec<GitStatusEntry>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    // Map each entry to GitStatusEntry with appropriate status string
    // ...
    Ok(entries)
}
```

### Pattern 2: IPC Wrappers (extend existing src/lib/ipc.ts)
**What:** Typed async wrappers calling `invoke()` for each git command
**When to use:** All frontend-to-backend git communication
**Example:**
```typescript
// Add to src/lib/ipc.ts
export interface GitStatusEntry {
  path: string;
  status: "staged_new" | "staged_modified" | "staged_deleted" | "modified" | "deleted" | "untracked" | "conflicted";
}

export async function gitStatus(repoPath: string): Promise<GitStatusEntry[]> {
  return invoke<GitStatusEntry[]>("git_status", { repoPath });
}
```

### Pattern 3: Zustand Git Store
**What:** Centralized git state with polling refresh
**When to use:** Reactive UI updates when git state changes
**Example:**
```typescript
// src/stores/gitStore.ts
interface GitState {
  entries: GitStatusEntry[];
  branches: GitBranch[];
  currentBranch: string;
  commitLog: GitCommit[];
  stashes: GitStash[];
  loading: boolean;
  refresh: (repoPath: string) => Promise<void>;
}
```

### Pattern 4: SVG Commit Graph Rendering
**What:** Lane-based column assignment for commit topology
**When to use:** GIT-07 commit log visualization
**Algorithm:**
1. Receive commits in topological order from backend (each with parent OIDs)
2. Assign columns/lanes: HEAD starts at column 0, new branches get next available column
3. For each commit, track which column it occupies
4. When a commit has multiple parents (merge), draw curve from parent column to commit column
5. Render SVG circles for commits, vertical lines for same-column connections, Bezier curves for cross-column merges

### Anti-Patterns to Avoid
- **Opening Repository per-call:** Open `Repository::open()` in each command call (repos are cheap to open in git2, and keeping them in state causes lifetime issues with Tauri's async commands)
- **Blocking the main thread with large diffs:** Use pagination for commit log (load 50 at a time) and lazy-load diffs only when user clicks a file
- **Polling too frequently:** 2-second interval is reasonable; debounce after user operations (stage/commit/etc. trigger immediate refresh)
- **Storing full diff content in Zustand store:** Only store status entries; fetch diff on-demand when user clicks a file

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git status parsing | Custom file watcher + git CLI parsing | `Repository::statuses()` | Handles all status flags including renames, typechanges, submodules |
| Diff generation | Custom line-by-line file comparison | `Diff::foreach()` with hunk/line callbacks | Handles binary files, renames, mode changes, encoding |
| Hunk-level staging | Manual index manipulation line by line | `Repository::apply()` with `ApplyLocation::Index` | Correct handling of context lines, offsets, edge cases |
| Branch topology graph data | Manual parent-child traversal | `Revwalk` with `TOPOLOGICAL` sort + `commit.parent_ids()` | Handles octopus merges, orphan branches, grafts |
| Merge conflict detection | File-level content comparison | `Repository::index().conflicts()` | Returns ours/theirs/ancestor entries correctly |

**Key insight:** git2 wraps libgit2 which handles every edge case in the git object model. Hand-rolling any git logic will miss rename detection, submodule handling, binary file detection, and encoding issues.

## Common Pitfalls

### Pitfall 1: Index Write-Back After Staging
**What goes wrong:** Stage a file via `index.add_path()` but changes don't persist
**Why it happens:** git2 Index is in-memory; must call `index.write()` to flush to disk
**How to avoid:** Always call `index.write()` after any index mutation
**Warning signs:** Staging works but status doesn't update

### Pitfall 2: Unstaging Files Requires HEAD Tree Reset
**What goes wrong:** Using `index.remove_path()` to unstage deletes the file from the index entirely (including from the last commit)
**Why it happens:** `remove_path` is for untracking, not unstaging
**How to avoid:** To unstage, read the entry from HEAD's tree and write it back to the index: `index.add(&head_tree_entry)`. For new files (not in HEAD), `index.remove_path()` is correct.
**Warning signs:** Unstaging a modified file shows it as deleted in next status

### Pitfall 3: Signature Resolution for Commits
**What goes wrong:** `Repository::signature()` fails if user.name/user.email not configured in .gitconfig
**Why it happens:** git2 reads from git config, which may not exist
**How to avoid:** Try `repo.signature()` first, fall back to `Signature::now("Unknown", "unknown@local")` or prompt user
**Warning signs:** Commit command fails with "config value not found"

### Pitfall 4: Branch Checkout vs. Set Head
**What goes wrong:** Switching branches only updates HEAD ref but working directory doesn't change
**Why it happens:** `set_head()` updates the symbolic ref but doesn't touch the worktree
**How to avoid:** After `set_head()`, call `repo.checkout_head(Some(&mut CheckoutBuilder::default().force()))` to update working directory
**Warning signs:** Branch indicator changes but files don't

### Pitfall 5: Hunk-Level Staging Complexity
**What goes wrong:** Constructing a partial diff for a single hunk is non-trivial
**Why it happens:** `Repository::apply()` takes a full `Diff` object, not individual hunks
**How to avoid:** Construct a patch string containing only the target hunk (with correct headers and context), convert to Diff via `Diff::from_buffer()`, then apply with `ApplyLocation::Index`
**Warning signs:** Wrong lines staged, context line offsets incorrect

### Pitfall 6: Stash Index is Positional
**What goes wrong:** Stash operations use a size_t index (0-based), not an ID
**Why it happens:** git stash is a reflog-based stack; indices shift when items are dropped
**How to avoid:** Always refresh stash list after any stash operation; never cache stash indices
**Warning signs:** Wrong stash applied/dropped after a previous drop

## Code Examples

### Git Status with Grouped Categories
```rust
// Source: git2 docs + libgit2 status flags
use git2::{Repository, StatusOptions, Status};

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<Vec<GitStatusEntry>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        // Index (staged) changes
        if s.intersects(Status::INDEX_NEW | Status::INDEX_MODIFIED | Status::INDEX_DELETED | Status::INDEX_RENAMED) {
            entries.push(GitStatusEntry {
                path: path.clone(),
                status: if s.contains(Status::INDEX_NEW) { "staged_new" }
                        else if s.contains(Status::INDEX_MODIFIED) { "staged_modified" }
                        else if s.contains(Status::INDEX_DELETED) { "staged_deleted" }
                        else { "staged_renamed" }.to_string(),
            });
        }
        // Workdir (unstaged) changes
        if s.intersects(Status::WT_MODIFIED | Status::WT_DELETED | Status::WT_RENAMED) {
            entries.push(GitStatusEntry {
                path: path.clone(),
                status: if s.contains(Status::WT_MODIFIED) { "modified" }
                        else if s.contains(Status::WT_DELETED) { "deleted" }
                        else { "renamed" }.to_string(),
            });
        }
        // Untracked
        if s.contains(Status::WT_NEW) {
            entries.push(GitStatusEntry { path, status: "untracked".to_string() });
        }
        // Conflicted
        if s.contains(Status::CONFLICTED) {
            entries.push(GitStatusEntry { path, status: "conflicted".to_string() });
        }
    }
    Ok(entries)
}
```

### Stage a File
```rust
#[tauri::command]
pub fn git_stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_path(std::path::Path::new(&file_path)).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}
```

### Unstage a File (Correct Approach)
```rust
use git2::{Repository, ObjectType};

#[tauri::command]
pub fn git_unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().and_then(|r| r.peel_to_tree());
    let mut index = repo.index().map_err(|e| e.to_string())?;

    match head {
        Ok(tree) => {
            // File exists in HEAD: reset index entry to HEAD version
            repo.reset_default(Some(&tree.into_object()), [&file_path])
                .map_err(|e| e.to_string())?;
        }
        Err(_) => {
            // No HEAD (initial commit) or file not in HEAD: remove from index
            index.remove_path(std::path::Path::new(&file_path))
                .map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
```

### Create a Commit
```rust
#[tauri::command]
pub fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let sig = repo.signature().map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let parents = match repo.head() {
        Ok(head) => vec![head.peel_to_commit().map_err(|e| e.to_string())?],
        Err(_) => vec![], // Initial commit
    };
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    let oid = repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)
        .map_err(|e| e.to_string())?;
    Ok(oid.to_string())
}
```

### Get Diff for a File (Unified Format)
```rust
#[derive(serde::Serialize)]
pub struct DiffHunk {
    header: String,
    old_start: u32,
    new_start: u32,
    old_lines: u32,
    new_lines: u32,
    lines: Vec<DiffLine>,
}

#[derive(serde::Serialize)]
pub struct DiffLine {
    origin: char,  // '+', '-', ' '
    content: String,
    old_lineno: Option<u32>,
    new_lineno: Option<u32>,
}

// Collect hunks+lines via Diff::foreach() callbacks
// Return Vec<DiffHunk> serialized to frontend
```

### Hunk-Level Staging via apply()
```rust
use git2::{Diff, ApplyLocation, ApplyOptions};

#[tauri::command]
pub fn git_stage_hunk(repo_path: String, file_path: String, hunk_index: usize) -> Result<(), String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    // Get the full diff for this file (workdir vs index)
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(&file_path);
    let diff = repo.diff_index_to_workdir(None, Some(&mut opts))
        .map_err(|e| e.to_string())?;

    // Build a patch containing only the target hunk
    // Use Diff::foreach to extract the specific hunk, reconstruct patch text,
    // then Diff::from_buffer() to create a single-hunk diff
    let patch = git2::Patch::from_diff(&diff, 0).map_err(|e| e.to_string())?
        .ok_or("No patch found")?;

    // Extract specific hunk, build partial patch buffer
    // ... (construct patch bytes with only the target hunk)

    let partial_diff = Diff::from_buffer(&patch_bytes).map_err(|e| e.to_string())?;
    repo.apply(&partial_diff, ApplyLocation::Index, None)
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

### Commit Log with Parent Info (for Graph)
```rust
#[derive(serde::Serialize)]
pub struct GitCommitInfo {
    oid: String,
    short_oid: String,
    message: String,
    author: String,
    author_email: String,
    timestamp: i64,
    parent_oids: Vec<String>,
}

#[tauri::command]
pub fn git_log(repo_path: String, limit: usize, skip: usize) -> Result<Vec<GitCommitInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| e.to_string())?;

    let commits: Vec<GitCommitInfo> = revwalk
        .skip(skip)
        .take(limit)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| {
            let commit = repo.find_commit(oid).ok()?;
            Some(GitCommitInfo {
                oid: oid.to_string(),
                short_oid: oid.to_string()[..7].to_string(),
                message: commit.message().unwrap_or("").to_string(),
                author: commit.author().name().unwrap_or("").to_string(),
                author_email: commit.author().email().unwrap_or("").to_string(),
                timestamp: commit.time().seconds(),
                parent_oids: commit.parent_ids().map(|p| p.to_string()).collect(),
            })
        })
        .collect();

    Ok(commits)
}
```

### SVG Graph Lane Assignment (Frontend)
```typescript
// Algorithm for assigning columns to commits
interface CommitNode {
  oid: string;
  parentOids: string[];
  column: number;
  row: number;
  color: string;
}

function assignLanes(commits: GitCommitInfo[]): CommitNode[] {
  const lanes: (string | null)[] = []; // lane[col] = oid occupying that lane
  const nodes: CommitNode[] = [];
  const colors = ["#4fc3f7", "#81c784", "#ffb74d", "#f06292", "#ba68c8", "#4db6ac"];

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];
    // Find which lane this commit should occupy
    let col = lanes.indexOf(commit.oid);
    if (col === -1) {
      // New branch: assign next available lane
      col = lanes.indexOf(null);
      if (col === -1) col = lanes.length;
    }

    // Place commit
    lanes[col] = null; // Free this lane

    // Reserve lanes for parents
    for (let i = 0; i < commit.parentOids.length; i++) {
      const parentOid = commit.parentOids[i];
      if (!lanes.includes(parentOid)) {
        if (i === 0) {
          lanes[col] = parentOid; // First parent continues in same lane
        } else {
          // Merge parent: find next free lane
          const freeLane = lanes.indexOf(null);
          if (freeLane !== -1) lanes[freeLane] = parentOid;
          else lanes.push(parentOid);
        }
      }
    }

    nodes.push({
      oid: commit.oid,
      parentOids: commit.parentOids,
      column: col,
      row,
      color: colors[col % colors.length],
    });
  }
  return nodes;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gitoxide (gix) unstable | git2 0.20.x stable | Ongoing | gix still pre-1.0; git2 remains the safe choice for production |
| Shell out to `git` CLI | git2 native library | N/A | No system git dependency, structured API, better error handling |
| WebGL-based graph rendering | Simple SVG circles + paths | N/A | SVG is sufficient for sidebar-width graphs; no WebGL overhead |

**Deprecated/outdated:**
- git2 versions before 0.18: Missing `apply()` method needed for hunk-level staging
- libgit2sharp partial staging issues (GitHub issues #195, #1847): These are C# binding issues, not applicable to Rust git2

## Open Questions

1. **Large repository performance for status polling**
   - What we know: git2 status is fast for small-medium repos, but large monorepos (100k+ files) can be slow
   - What's unclear: Exact threshold where 2-second polling becomes problematic
   - Recommendation: Start with 2-second polling, add "refreshing..." indicator, consider filesystem watcher (tauri-plugin-fs watch) as optimization later

2. **Patch construction for hunk-level staging**
   - What we know: `Repository::apply()` with `ApplyLocation::Index` works; `Diff::from_buffer()` can parse patch text
   - What's unclear: Exact patch header format needed for single-hunk extraction from multi-hunk files
   - Recommendation: Use `Patch::from_diff()` to get the full patch, reconstruct with only target hunk headers, test thoroughly with edge cases (no trailing newline, binary neighbors)

3. **Commit graph pagination**
   - What we know: Revwalk supports skip/take pattern for pagination
   - What's unclear: How to handle graph lane continuity across paginated loads
   - Recommendation: Load 50 commits initially, append on scroll; carry lane state forward between pages

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom) for frontend, cargo test for Rust |
| Config file | `vitest.config.ts` (exists), `Cargo.toml` for Rust tests |
| Quick run command | `npm run test` / `cd src-tauri && cargo test` |
| Full suite command | `npm run test && cd src-tauri && cargo test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GIT-01 | Status entries grouped by staged/unstaged/untracked | unit (Rust) | `cd src-tauri && cargo test git::commands::test_status -- --nocapture` | No - Wave 0 |
| GIT-02 | Stage/unstage file updates index | unit (Rust) | `cd src-tauri && cargo test git::commands::test_stage -- --nocapture` | No - Wave 0 |
| GIT-03 | Commit creates new commit object | unit (Rust) | `cd src-tauri && cargo test git::commands::test_commit -- --nocapture` | No - Wave 0 |
| GIT-04 | Diff returns hunks and lines | unit (Rust) | `cd src-tauri && cargo test git::commands::test_diff -- --nocapture` | No - Wave 0 |
| GIT-05 | Branch list includes current indicator | unit (Rust) | `cd src-tauri && cargo test git::commands::test_branches -- --nocapture` | No - Wave 0 |
| GIT-06 | Create/switch/delete branch | unit (Rust) | `cd src-tauri && cargo test git::commands::test_branch_ops -- --nocapture` | No - Wave 0 |
| GIT-07 | Commit log returns parent OIDs for graph | unit (Rust) | `cd src-tauri && cargo test git::commands::test_log -- --nocapture` | No - Wave 0 |
| GIT-08 | Stash save/apply/pop/drop | unit (Rust) | `cd src-tauri && cargo test git::commands::test_stash -- --nocapture` | No - Wave 0 |
| GIT-09 | Conflict detection returns conflicted files | unit (Rust) | `cd src-tauri && cargo test git::commands::test_conflicts -- --nocapture` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd src-tauri && cargo test git`
- **Per wave merge:** `npm run test && cd src-tauri && cargo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/git/commands.rs` -- Rust unit tests using git2 with temp repos (`tempdir` crate)
- [ ] `src/test/git-store.test.ts` -- Frontend store logic tests (mock IPC)
- [ ] `src/test/commit-graph.test.ts` -- Lane assignment algorithm tests (pure logic, no IPC)

## Sources

### Primary (HIGH confidence)
- [git2-rs GitHub](https://github.com/rust-lang/git2-rs) - Repository, API examples
- [git2 docs.rs](https://docs.rs/git2/0.20.4/git2/) - Full API reference for Repository, Diff, Index, Revwalk, Stash
- [ApplyLocation enum](https://docs.rs/git2/latest/git2/enum.ApplyLocation.html) - Index/WorkDir/Both variants
- [git2-rs examples/log.rs](https://github.com/rust-lang/git2-rs/blob/master/examples/log.rs) - Revwalk with topological sort, parent access, diff

### Secondary (MEDIUM confidence)
- [DoltHub commit graph blog](https://www.dolthub.com/blog/2024-08-07-drawing-a-commit-graph/) - SVG graph rendering algorithm, lane assignment, Bezier curves
- [Rust forum: handling hunks in git2-rs](https://users.rust-lang.org/t/handling-deltas-patches-hunks-from-index-in-git2-rs/122427/2) - Diff::from_buffer + apply pattern for hunk staging

### Tertiary (LOW confidence)
- [react-commits-graph](https://github.com/jsdf/react-commits-graph) - Reference for React SVG graph rendering (older, but pattern is valid)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - git2 0.20.4 verified on docs.rs, well-documented API
- Architecture: HIGH - Follows established codebase patterns (fs/commands.rs, ipc.ts, stores)
- Pitfalls: HIGH - Known issues documented in git2-rs issues and libgit2 docs
- SVG graph rendering: MEDIUM - Algorithm is well-understood but custom implementation needed
- Hunk-level staging: MEDIUM - API exists (apply + ApplyLocation::Index) but patch construction requires care

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain, git2 API changes rarely)
