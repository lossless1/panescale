import { type ReactNode, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { useCanvasStore } from "../../stores/canvasStore";
import { spawnTerminalAtPosition } from "../../lib/spawnTerminal";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  // Handle macOS menu bar events
  useEffect(() => {
    const listeners = [
      listen("menu-new-terminal", () => {
        const { viewport } = useCanvasStore.getState();
        const position = {
          x: (-viewport.x + window.innerWidth / 2 - 320) / viewport.zoom,
          y: (-viewport.y + window.innerHeight / 2 - 240) / viewport.zoom,
        };
        spawnTerminalAtPosition(position);
      }),
      listen("menu-new-note", () => {
        const { viewport } = useCanvasStore.getState();
        const position = {
          x: (-viewport.x + window.innerWidth / 2 - 200) / viewport.zoom,
          y: (-viewport.y + window.innerHeight / 2 - 150) / viewport.zoom,
        };
        useCanvasStore.getState().addNoteNode(position);
      }),
    ];
    return () => { listeners.forEach((p) => p.then((fn) => fn())); };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        <Sidebar />
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
