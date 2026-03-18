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

// --- State Persistence ---

export interface SerializedNode {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  zIndex: number;
  data: {
    cwd: string;
    shellType: string;
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
