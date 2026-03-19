import { invoke, Channel } from "@tauri-apps/api/core";

export type PtyEvent =
  | { event: "data"; data: { bytes: number[] } }
  | { event: "exit"; data: { code: number | null } };

export async function ptySpawn(
  cwd: string,
  cols: number,
  rows: number,
  onEvent: Channel<PtyEvent>,
): Promise<string> {
  return invoke<string>("pty_spawn", { cwd, cols, rows, onEvent });
}

export async function ptyWrite(
  ptyId: string,
  data: Uint8Array,
): Promise<void> {
  return invoke("pty_write", { ptyId, data: Array.from(data) });
}

export async function ptyResize(
  ptyId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("pty_resize", { ptyId, cols, rows });
}

export async function ptyKill(ptyId: string): Promise<void> {
  return invoke("pty_kill", { ptyId });
}

// --- Tmux Session Persistence ---

export async function ptyReattach(
  ptyId: string,
  sessionName: string,
  cols: number,
  rows: number,
  onEvent: Channel<PtyEvent>,
): Promise<void> {
  return invoke("pty_reattach", { ptyId, sessionName, cols, rows, onEvent });
}

export async function ptyTmuxAvailable(): Promise<boolean> {
  return invoke<boolean>("pty_tmux_available");
}

export async function ptyTmuxListSessions(): Promise<string[]> {
  return invoke<string[]>("pty_tmux_list_sessions");
}

export async function ptyTmuxCleanup(activeIds: string[]): Promise<number> {
  return invoke<number>("pty_tmux_cleanup", { activeIds });
}

export interface TmuxInstallProgress {
  stage: "detecting" | "installing" | "done" | "error";
  message: string;
}

export async function ptyEnsureTmux(
  onProgress: (event: TmuxInstallProgress) => void,
): Promise<boolean> {
  const channel = new Channel<TmuxInstallProgress>();
  channel.onmessage = onProgress;
  return invoke<boolean>("pty_ensure_tmux", { onProgress: channel });
}

// --- Content Tile Helpers ---

export type ContentTileType = 'note' | 'image' | 'file-preview';

const BINARY_EXTENSIONS = new Set([
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.wasm', '.bin', '.o', '.obj',
  '.class', '.pyc', '.pyo',
  '.dmg', '.iso', '.img', '.pkg', '.deb', '.rpm', '.msi', '.app',
  '.jar', '.war', '.ear',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.ttf', '.otf', '.woff', '.woff2', '.eot', '.ico',
  '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.flac', '.wav', '.ogg', '.aac',
  '.sqlite', '.db',
]);

export function extensionToTileType(ext: string): ContentTileType | null {
  const lower = ext.toLowerCase();
  if (BINARY_EXTENSIONS.has(lower)) return null;
  if (lower === '.md' || lower === '.mdx') return 'note';
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'].includes(lower)) return 'image';
  return 'file-preview';
}

// --- File System ---

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_ms: number;
  created_ms: number;
}

export async function fsReadDir(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("fs_read_dir", { path });
}

export async function fsCreateFile(path: string): Promise<void> {
  return invoke("fs_create_file", { path });
}

export async function fsCreateDir(path: string): Promise<void> {
  return invoke("fs_create_dir", { path });
}

export async function fsRename(from: string, to: string): Promise<void> {
  return invoke("fs_rename", { from, to });
}

export async function fsDelete(path: string): Promise<void> {
  return invoke("fs_delete", { path });
}

export async function fsMove(from: string, toDir: string): Promise<void> {
  return invoke("fs_move", { from, toDir });
}

// --- State Persistence ---

export interface SerializedNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  zIndex: number;
  data: {
    cwd: string;
    shellType: string;
    customName?: string;
    badgeColor?: string;
    startupCommand?: string;
    regionName?: string;
    regionColor?: string;
    // Content tile fields
    markdownContent?: string;
    filePath?: string;
    fileName?: string;
    // Terminal scrollback persistence
    savedBuffer?: string;
    // WebView fields
    url?: string;
    // SSH fields
    sshConnectionId?: string;
    sshHost?: string;
    sshUser?: string;
  };
}

export interface CanvasSnapshot {
  nodes: SerializedNode[];
  viewport: { x: number; y: number; zoom: number };
  maxZIndex: number;
}

export async function stateSave(snapshot: CanvasSnapshot): Promise<void> {
  return invoke("state_save", { canvas: JSON.stringify(snapshot) });
}

export async function stateLoad(): Promise<CanvasSnapshot | null> {
  const raw = await invoke<string | null>("state_load");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CanvasSnapshot;
  } catch {
    return null;
  }
}

// --- Git ---

export interface GitStatusEntry {
  path: string;
  status:
    | "staged_new"
    | "staged_modified"
    | "staged_deleted"
    | "staged_renamed"
    | "modified"
    | "deleted"
    | "renamed"
    | "untracked"
    | "conflicted";
}

export interface DiffLine {
  origin: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

export interface DiffHunk {
  header: string;
  old_start: number;
  new_start: number;
  old_lines: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface GitFileDiff {
  path: string;
  hunks: DiffHunk[];
}

export interface GitBranch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

export interface GitCommitInfo {
  oid: string;
  short_oid: string;
  message: string;
  author: string;
  author_email: string;
  timestamp: number;
  parent_oids: string[];
  files_changed: string[];
}

export interface GitStashEntry {
  index: number;
  message: string;
  oid: string;
}

export interface GitConflictEntry {
  path: string;
  has_ours: boolean;
  has_theirs: boolean;
  has_ancestor: boolean;
}

export async function gitIsRepo(repoPath: string): Promise<boolean> {
  return invoke<boolean>("git_is_repo", { repoPath });
}

export async function gitStatus(repoPath: string): Promise<GitStatusEntry[]> {
  return invoke<GitStatusEntry[]>("git_status", { repoPath });
}

export async function gitStageFile(
  repoPath: string,
  filePath: string,
): Promise<void> {
  return invoke("git_stage_file", { repoPath, filePath });
}

export async function gitUnstageFile(
  repoPath: string,
  filePath: string,
): Promise<void> {
  return invoke("git_unstage_file", { repoPath, filePath });
}

export async function gitCommit(
  repoPath: string,
  message: string,
): Promise<string> {
  return invoke<string>("git_commit", { repoPath, message });
}

export async function gitDiffFile(
  repoPath: string,
  filePath: string,
  staged: boolean,
): Promise<GitFileDiff> {
  return invoke<GitFileDiff>("git_diff_file", { repoPath, filePath, staged });
}

export async function gitStageHunk(
  repoPath: string,
  filePath: string,
  hunkIndex: number,
): Promise<void> {
  return invoke("git_stage_hunk", { repoPath, filePath, hunkIndex });
}

export async function gitUnstageHunk(
  repoPath: string,
  filePath: string,
  hunkIndex: number,
): Promise<void> {
  return invoke("git_unstage_hunk", { repoPath, filePath, hunkIndex });
}

export async function gitBranches(
  repoPath: string,
): Promise<GitBranch[]> {
  return invoke<GitBranch[]>("git_branches", { repoPath });
}

export async function gitCreateBranch(
  repoPath: string,
  name: string,
): Promise<void> {
  return invoke("git_create_branch", { repoPath, name });
}

export async function gitSwitchBranch(
  repoPath: string,
  name: string,
): Promise<void> {
  return invoke("git_switch_branch", { repoPath, name });
}

export async function gitDeleteBranch(
  repoPath: string,
  name: string,
): Promise<void> {
  return invoke("git_delete_branch", { repoPath, name });
}

export async function gitLog(
  repoPath: string,
  limit: number,
  skip: number,
): Promise<GitCommitInfo[]> {
  return invoke<GitCommitInfo[]>("git_log", { repoPath, limit, skip });
}

export async function gitStashSave(
  repoPath: string,
  message: string,
): Promise<void> {
  return invoke("git_stash_save", { repoPath, message });
}

export async function gitStashList(
  repoPath: string,
): Promise<GitStashEntry[]> {
  return invoke<GitStashEntry[]>("git_stash_list", { repoPath });
}

export async function gitStashApply(
  repoPath: string,
  index: number,
): Promise<void> {
  return invoke("git_stash_apply", { repoPath, index });
}

export async function gitStashPop(
  repoPath: string,
  index: number,
): Promise<void> {
  return invoke("git_stash_pop", { repoPath, index });
}

export async function gitStashDrop(
  repoPath: string,
  index: number,
): Promise<void> {
  return invoke("git_stash_drop", { repoPath, index });
}

export async function gitConflicts(
  repoPath: string,
): Promise<GitConflictEntry[]> {
  return invoke<GitConflictEntry[]>("git_conflicts", { repoPath });
}

export async function gitResolveConflict(
  repoPath: string,
  filePath: string,
  resolution: string,
): Promise<void> {
  return invoke("git_resolve_conflict", { repoPath, filePath, resolution });
}

// --- SSH ---

export type SshEvent =
  | { event: "data"; data: { bytes: number[] } }
  | { event: "exit"; data: { code: number | null } };

export interface SshConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  keyPath?: string;
  group?: string;
}

export interface SshGroup {
  name: string;
  connectionIds: string[];
}

export async function sshConnect(
  connectionId: string,
  password: string | null,
  cols: number,
  rows: number,
  onEvent: Channel<SshEvent>,
): Promise<string> {
  return invoke<string>("ssh_connect", {
    connectionId,
    password,
    cols,
    rows,
    onEvent,
  });
}

export async function sshWrite(
  sessionId: string,
  data: Uint8Array,
): Promise<void> {
  return invoke("ssh_write", { sessionId, data: Array.from(data) });
}

export async function sshResize(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("ssh_resize", { sessionId, cols, rows });
}

export async function sshDisconnect(sessionId: string): Promise<void> {
  return invoke("ssh_disconnect", { sessionId });
}

export async function sshSaveConnections(
  connections: SshConnectionConfig[],
): Promise<void> {
  return invoke("ssh_save_connections", {
    connectionsJson: JSON.stringify(connections),
  });
}

export async function sshLoadConnections(): Promise<SshConnectionConfig[]> {
  const raw = await invoke<string>("ssh_load_connections");
  return JSON.parse(raw);
}
