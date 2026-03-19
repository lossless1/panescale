import { useCanvasStore } from "../stores/canvasStore";
import { stateSave, type CanvasSnapshot, type SerializedNode } from "./ipc";
import { captureAllBuffers } from "./terminalBufferRegistry";
import type { Node } from "@xyflow/react";

const DEBOUNCE_MS = 500;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

/**
 * Serialize the current canvas state into a persistable snapshot.
 * Strips React Flow internal state and ephemeral data (like ptyId).
 */
export function serializeCanvas(state: {
  nodes: Node[];
  viewport: { x: number; y: number; zoom: number };
  maxZIndex: number;
}): CanvasSnapshot {
  // Capture terminal scrollback buffers before serializing
  const buffers = captureAllBuffers();

  const nodes: SerializedNode[] = state.nodes.map((n) => ({
    id: n.id,
    type: n.type ?? "terminal",
    position: { x: n.position.x, y: n.position.y },
    width: (n.style?.width as number) ?? (n.measured?.width as number) ?? 640,
    height: (n.style?.height as number) ?? (n.measured?.height as number) ?? 480,
    zIndex: n.zIndex ?? 0,
    data: {
      cwd: (n.data as Record<string, unknown>).cwd as string,
      shellType: (n.data as Record<string, unknown>).shellType as string,
      customName: (n.data as Record<string, unknown>).customName as string | undefined,
      badgeColor: (n.data as Record<string, unknown>).badgeColor as string | undefined,
      startupCommand: (n.data as Record<string, unknown>).startupCommand as string | undefined,
      regionName: (n.data as Record<string, unknown>).regionName as string | undefined,
      regionColor: (n.data as Record<string, unknown>).regionColor as string | undefined,
      // Content tile fields
      markdownContent: (n.data as Record<string, unknown>).markdownContent as string | undefined,
      filePath: (n.data as Record<string, unknown>).filePath as string | undefined,
      fileName: (n.data as Record<string, unknown>).fileName as string | undefined,
      // Scrollback buffer for terminal persistence
      savedBuffer: buffers.get(n.id),
      // SSH fields
      sshConnectionId: (n.data as Record<string, unknown>).sshConnectionId as string | undefined,
      sshHost: (n.data as Record<string, unknown>).sshHost as string | undefined,
      sshUser: (n.data as Record<string, unknown>).sshUser as string | undefined,
    },
  }));
  return {
    nodes,
    viewport: state.viewport,
    maxZIndex: state.maxZIndex,
  };
}

/**
 * Convert a persisted snapshot back into canvasStore-compatible state.
 * Marks each node with `restored: true` so TerminalNode can detect and respawn PTY.
 */
export function deserializeCanvas(snapshot: CanvasSnapshot): {
  nodes: Node[];
  viewport: { x: number; y: number; zoom: number };
  maxZIndex: number;
} {
  const nodes: Node[] = snapshot.nodes.map((sn) => {
    const nodeType = sn.type ?? "terminal";
    const isRegion = nodeType === "region";
    const isTerminal = nodeType === "terminal";
    return {
      id: sn.id,
      type: nodeType,
      position: { x: sn.position.x, y: sn.position.y },
      data: {
        ...sn.data,
        ...(isTerminal ? { restored: true } : {}),
      },
      dragHandle: isRegion ? ".region-drag-handle" : ".drag-handle",
      style: { width: sn.width, height: sn.height },
      zIndex: sn.zIndex,
    };
  });
  return {
    nodes,
    viewport: snapshot.viewport,
    maxZIndex: snapshot.maxZIndex,
  };
}

/**
 * Saves the current canvas state immediately. Clears any pending debounce.
 */
export function forceSave(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const state = useCanvasStore.getState();
  const snapshot = serializeCanvas(state);
  return stateSave(snapshot).catch((err) => {
    console.error("Failed to save canvas state:", err);
  });
}

/**
 * Starts a Zustand subscription that auto-saves canvas state with 500ms debounce.
 */
export function initPersistence(): void {
  if (unsubscribe) return; // Already initialized

  unsubscribe = useCanvasStore.subscribe(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const state = useCanvasStore.getState();
      const snapshot = serializeCanvas(state);
      stateSave(snapshot).catch((err) => {
        console.error("Failed to auto-save canvas state:", err);
      });
    }, DEBOUNCE_MS);
  });
}
