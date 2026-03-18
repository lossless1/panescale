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

export function extensionToTileType(ext: string): ContentTileType {
  const lower = ext.toLowerCase();
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
