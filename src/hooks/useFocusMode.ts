import { create } from "zustand";
import { useEffect } from "react";

type FocusMode = "canvas" | "terminal";

interface FocusState {
  mode: FocusMode;
  activeTerminalId: string | null;
  enterTerminalMode: (terminalId: string) => void;
  exitToCanvasMode: () => void;
}

export const useFocusModeStore = create<FocusState>((set) => ({
  mode: "canvas",
  activeTerminalId: null,

  enterTerminalMode: (terminalId: string) =>
    set({ mode: "terminal", activeTerminalId: terminalId }),

  exitToCanvasMode: () =>
    set({ mode: "canvas", activeTerminalId: null }),
}));

/**
 * Hook that registers the global Escape key handler for exiting terminal mode.
 * Should be used once in a top-level component (App or Canvas).
 */
export function useEscapeToCanvas(): void {
  const exitToCanvasMode = useFocusModeStore((s) => s.exitToCanvasMode);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "Escape" &&
        useFocusModeStore.getState().mode === "terminal"
      ) {
        e.stopPropagation();
        exitToCanvasMode();
      }
    }

    // Capture phase so we intercept before other handlers
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [exitToCanvasMode]);
}

export function useFocusMode() {
  return useFocusModeStore();
}
