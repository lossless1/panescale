import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { modKeyCode } from "../lib/platform";

/**
 * Global keyboard shortcut handler for canvas zoom controls.
 * Captures Cmd/Ctrl +/- for zoom in/out and Cmd/Ctrl+0 for fit view.
 * Uses capture phase to intercept before browser zoom.
 */
export function useKeyboardShortcuts() {
  const reactFlow = useReactFlow();
  const modProp = modKeyCode();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e[modProp]) return;

      switch (e.key) {
        case "=":
        case "+":
          e.preventDefault();
          e.stopPropagation();
          reactFlow.zoomIn({ duration: 200 });
          break;
        case "-":
          e.preventDefault();
          e.stopPropagation();
          reactFlow.zoomOut({ duration: 200 });
          break;
        case "0":
          e.preventDefault();
          e.stopPropagation();
          reactFlow.fitView({ duration: 300 });
          break;
      }
    };

    // Use capture phase to intercept before browser default zoom
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [reactFlow, modProp]);
}
