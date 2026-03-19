import { create } from "zustand";

interface FileDragState {
  /** Currently dragging file data, null when not dragging */
  dragging: { path: string; name: string; ext: string } | null;
  /** Current mouse position during drag */
  mouseX: number;
  mouseY: number;
  startDrag: (file: { path: string; name: string; ext: string }, x: number, y: number) => void;
  updatePosition: (x: number, y: number) => void;
  endDrag: () => void;
}

export const useFileDragStore = create<FileDragState>((set) => ({
  dragging: null,
  mouseX: 0,
  mouseY: 0,
  startDrag: (file, x, y) => set({ dragging: file, mouseX: x, mouseY: y }),
  updatePosition: (x, y) => set({ mouseX: x, mouseY: y }),
  endDrag: () => set({ dragging: null }),
}));
