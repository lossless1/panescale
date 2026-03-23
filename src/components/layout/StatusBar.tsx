import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { SettingsModal } from "./SettingsModal";

export function StatusBar() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Open settings from macOS menu bar (Panescale > Preferences)
  useEffect(() => {
    const unlisten = listen("open-settings", () => setSettingsOpen(true));
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  return (
    <>
      <div
        style={{
          height: 24,
          backgroundColor: "var(--bg-primary)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
          paddingRight: 12,
          fontSize: 11,
          color: "var(--text-secondary)",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: "0 4px",
            fontSize: 18,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          &#x2699;
        </button>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
