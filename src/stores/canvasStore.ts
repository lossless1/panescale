import { create } from "zustand";
import {
  type Node,
  type Viewport,
  type NodeChange,
  applyNodeChanges,
} from "@xyflow/react";

interface CanvasState {
  nodes: Node[];
  viewport: Viewport;
  maxZIndex: number;
  onNodesChange: (changes: NodeChange[]) => void;
  addTerminalNode: (position: { x: number; y: number }, ptyId: string, cwd: string) => void;
  removeNode: (id: string) => void;
  bringToFront: (id: string) => void;
  setViewport: (viewport: Viewport) => void;
}

let nodeIdCounter = 0;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  maxZIndex: 0,

  onNodesChange: (changes: NodeChange[]) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  addTerminalNode: (position, ptyId, cwd) => {
    const newZIndex = get().maxZIndex + 1;
    nodeIdCounter += 1;
    const id = `terminal-${nodeIdCounter}`;
    const newNode: Node = {
      id,
      type: "terminal",
      position,
      data: { ptyId, cwd },
      dragHandle: ".drag-handle",
      style: { width: 640, height: 480 },
      zIndex: newZIndex,
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      maxZIndex: newZIndex,
    }));
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
    }));
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
}));
