import { useCallback } from "react";
import { isMac } from "../../lib/platform";
import { ThemeToggle } from "../theme/ThemeToggle";

async function getAppWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

function WindowControls({ position }: { position: "left" | "right" }) {
  const handleClose = useCallback(async () => {
    const win = await getAppWindow();
    await win.close();
  }, []);

  const handleMinimize = useCallback(async () => {
    const win = await getAppWindow();
    await win.minimize();
  }, []);

  const handleMaximize = useCallback(async () => {
    const win = await getAppWindow();
    await win.toggleMaximize();
  }, []);

  const buttonBase: React.CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    padding: 0,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        order: position === "left" ? -1 : 1,
        [position === "left" ? "marginLeft" : "marginRight"]: 12,
      }}
    >
      <button
        onClick={handleClose}
        style={{ ...buttonBase, backgroundColor: "#ff5f57" }}
        aria-label="Close"
      />
      <button
        onClick={handleMinimize}
        style={{ ...buttonBase, backgroundColor: "#febc2e" }}
        aria-label="Minimize"
      />
      <button
        onClick={handleMaximize}
        style={{ ...buttonBase, backgroundColor: "#28c840" }}
        aria-label="Maximize"
      />
    </div>
  );
}

export function TitleBar() {
  const controlsPosition = isMac() ? "left" : "right";

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 32,
        backgroundColor: "var(--bg-titlebar)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        userSelect: "none",
        WebkitUserSelect: "none",
        position: "relative",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <WindowControls position={controlsPosition} />
      <span
        data-tauri-drag-region
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          color: "var(--text-secondary)",
          fontSize: 12,
          fontWeight: 500,
          pointerEvents: "none",
        }}
      >
        Panescale
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginRight: controlsPosition === "right" ? 0 : 8,
          marginLeft: controlsPosition === "left" ? 0 : 8,
          order: controlsPosition === "right" ? -1 : 1,
        }}
      >
        <ThemeToggle />
      </div>
    </div>
  );
}
