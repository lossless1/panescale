import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";

export function UpdateChecker() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const update = await check();
        if (update?.available) {
          setUpdateVersion(update.version);
        }
      } catch (err) {
        console.warn("Update check failed:", err);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!updateVersion || dismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#1a1a2e",
        color: "#e0e0e0",
        padding: "10px 18px",
        borderRadius: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 13,
      }}
    >
      <span>Panescale {updateVersion} is available</span>
      <button
        onClick={() =>
          window.open(
            "https://github.com/volodymyrsaakian/excalicode/releases/latest",
            "_blank"
          )
        }
        style={{
          background: "#4a6cf7",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "4px 12px",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Download
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "transparent",
          color: "#888",
          border: "none",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: "0 4px",
        }}
        aria-label="Dismiss update notification"
      >
        x
      </button>
    </div>
  );
}
