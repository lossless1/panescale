import { useCanvasStore } from "../stores/canvasStore";
import { stateSave, type CanvasSnapshot, type SerializedNode } from "./ipc";
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
  const nodes: SerializedNode[] = state.nodes.map((n) => ({
    id: n.id,
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
  const nodes: Node[] = snapshot.nodes.map((sn) => ({
    id: sn.id,
    type: "terminal",
    position: { x: sn.position.x, y: sn.position.y },
    data: {
      cwd: sn.data.cwd,
      shellType: sn.data.shellType,
      restored: true,
      customName: sn.data.customName,
      badgeColor: sn.data.badgeColor,
      startupCommand: sn.data.startupCommand,
    },
    dragHandle: ".drag-handle",
    style: { width: sn.width, height: sn.height },
    zIndex: sn.zIndex,
  }));
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
