import { create } from "zustand";
import {
  type Node,
  type Viewport,
  type NodeChange,
  applyNodeChanges,
} from "@xyflow/react";
import { stateLoad, type ContentTileType } from "../lib/ipc";
import { deserializeCanvas, forceSave } from "../lib/persistence";

export interface SnapLinePositions {
  x: number | null;
  y: number | null;
}

interface CanvasState {
  nodes: Node[];
  viewport: Viewport;
  maxZIndex: number;
  hydrated: boolean;
  snapLines: SnapLinePositions | null;
  panToNodeId: string | null;
  bellActiveNodes: Set<string>;
  onNodesChange: (changes: NodeChange[]) => void;
  updateNodeData: (id: string, dataUpdate: Record<string, unknown>) => void;
  setBellActive: (id: string, active: boolean) => void;
  addTerminalNode: (position: { x: number; y: number }, cwd: string) => void;
  addContentNode: (position: { x: number; y: number }, tileType: ContentTileType, fileData: { path: string; name: string }) => void;
  addNoteNode: (position: { x: number; y: number }) => void;
  addRegion: (position: { x: number; y: number }, size: { width: number; height: number }, name: string, color: string) => void;
  removeNode: (id: string) => void;
  bringToFront: (id: string) => void;
  setViewport: (viewport: Viewport) => void;
  setSnapLines: (snapLines: SnapLinePositions | null) => void;
  setPanToNode: (id: string | null) => void;
  loadFromDisk: () => Promise<void>;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  maxZIndex: 0,
  hydrated: false,
  snapLines: null,
  panToNodeId: null,
  bellActiveNodes: new Set<string>(),

  updateNodeData: (id, dataUpdate) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...(n.data as Record<string, unknown>), ...dataUpdate } }
          : n,
      ),
    }));
    forceSave();
  },

  setBellActive: (id, active) => {
    set((state) => {
      const next = new Set(state.bellActiveNodes);
      if (active) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return { bellActiveNodes: next };
    });
  },

  onNodesChange: (changes: NodeChange[]) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  addTerminalNode: (position, cwd) => {
    const newZIndex = get().maxZIndex + 1;
    const id = crypto.randomUUID();
    const newNode: Node = {
      id,
      type: "terminal",
      position,
      data: { cwd, shellType: "shell" },
      dragHandle: ".drag-handle",
      style: { width: 640, height: 480 },
      zIndex: newZIndex,
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      maxZIndex: newZIndex,
    }));
    // Immediate save on tile create (PERS-03)
    forceSave();
  },

  addContentNode: (position, tileType, fileData) => {
    const newZIndex = get().maxZIndex + 1;
    const id = crypto.randomUUID();
    const sizes: Record<ContentTileType, { width: number; height: number }> = {
      'note': { width: 400, height: 300 },
      'image': { width: 400, height: 300 },
      'file-preview': { width: 500, height: 400 },
    };
    const newNode: Node = {
      id,
      type: tileType,
      position,
      data: { filePath: fileData.path, fileName: fileData.name },
      dragHandle: '.drag-handle',
      style: sizes[tileType],
      zIndex: newZIndex,
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      maxZIndex: newZIndex,
    }));
    forceSave();
  },

  addNoteNode: (position) => {
    const newZIndex = get().maxZIndex + 1;
    const id = crypto.randomUUID();
    const newNode: Node = {
      id,
      type: "note",
      position,
      data: { markdownContent: "", fileName: "Note" },
      dragHandle: ".drag-handle",
      style: { width: 300, height: 300 },
      zIndex: newZIndex,
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      maxZIndex: newZIndex,
    }));
    forceSave();
  },

  addRegion: (position, size, name, color) => {
    const id = crypto.randomUUID();
    const newNode: Node = {
      id,
      type: "region",
      position,
      data: { regionName: name, regionColor: color },
      dragHandle: ".region-drag-handle",
      style: { width: size.width, height: size.height },
      zIndex: -1,
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
    forceSave();
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
    }));
    // Immediate save on tile close (PERS-03)
    forceSave();
  },

  bringToFront: (id) => {
    const newZIndex = get().maxZIndex + 1;
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, zIndex: newZIndex } : n,
      ),
      maxZIndex: newZIndex,
    }));
  },

  setViewport: (viewport) => {
    set({ viewport });
  },

  setSnapLines: (snapLines) => {
    set({ snapLines });
  },

  setPanToNode: (id) => {
    set({ panToNodeId: id });
  },

  loadFromDisk: async () => {
    try {
      const snapshot = await stateLoad();
      if (snapshot) {
        const restored = deserializeCanvas(snapshot);
        set({
          nodes: restored.nodes,
          viewport: restored.viewport,
          maxZIndex: restored.maxZIndex,
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch (err) {
      console.error("Failed to load canvas state from disk:", err);
      set({ hydrated: true });
    }
  },
}));
