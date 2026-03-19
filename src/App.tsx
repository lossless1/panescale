import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { AppShell } from "./components/layout/AppShell";
import { Canvas } from "./components/canvas/Canvas";
import { useCanvasStore } from "./stores/canvasStore";
import { initPersistence, forceSave } from "./lib/persistence";
import { getCurrentWindow } from "@tauri-apps/api/window";
// import { UpdateChecker } from "./components/UpdateChecker"; // Disabled until updater signing keys are configured
import { FileDragOverlay } from "./components/FileDragOverlay";

function App() {
  const hydrated = useCanvasStore((s) => s.hydrated);
  const loadFromDisk = useCanvasStore((s) => s.loadFromDisk);

  useEffect(() => {
    // Restore persisted canvas state, then start auto-save
    loadFromDisk().then(() => {
      initPersistence();
    });

    // Force save on window close
    const unlisten = getCurrentWindow().onCloseRequested(async () => {
      await forceSave();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadFromDisk]);

  if (!hydrated) {
    return (
      <ThemeProvider>
        <AppShell>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Loading workspace...
          </div>
        </AppShell>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      {/* <UpdateChecker /> */}
      <FileDragOverlay />
      <AppShell>
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
      </AppShell>
    </ThemeProvider>
  );
}

export default App;
