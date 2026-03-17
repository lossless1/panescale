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
