import { useEffect, useState, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useSettingsStore } from "../../stores/settingsStore";

type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string }
  | { status: "downloading"; version: string; progress: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };

export function UpdateToast() {
  const autoUpdate = useSettingsStore((s) => s.autoUpdate);
  const skippedVersion = useSettingsStore((s) => s.skippedVersion);
  const setSkippedVersion = useSettingsStore((s) => s.setSkippedVersion);
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [dismissed, setDismissed] = useState(false);

  // Check for updates on mount and every 30 minutes
  useEffect(() => {
    if (!autoUpdate) return;

    const checkForUpdate = async () => {
      try {
        console.log("[Update] Checking for updates...");
        const update = await check().catch(() => null);
        console.log("[Update] Check result:", update ? `v${update.version} available` : "up to date or check failed");
        if (update) {
          const version = update.version;
          if (version === skippedVersion) {
            console.log("[Update] Skipping version:", version);
            return;
          }
          setState({ status: "available", version });
          setDismissed(false);
        }
      } catch (err) {
        console.error("[Update] Check failed:", err);
      }
    };

    // Delay first check by 5 seconds
    const initialTimer = setTimeout(checkForUpdate, 5000);
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [autoUpdate, skippedVersion]);

  const handleInstall = useCallback(async () => {
    if (state.status !== "available") return;
    const version = state.version;
    setState({ status: "downloading", version, progress: 0 });

    try {
      const update = await check();
      if (!update) {
        setState({ status: "error", message: "Update no longer available" });
        return;
      }

      let downloaded = 0;
      let total = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          total = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
          setState({ status: "downloading", version, progress });
        } else if (event.event === "Finished") {
          setState({ status: "ready", version });
        }
      });

      setState({ status: "ready", version });
    } catch (err) {
      console.error("[Update] Install failed:", err);
      setState({ status: "error", message: String(err) });
    }
  }, [state]);

  const handleRelaunch = useCallback(async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error("[Update] Relaunch failed:", err);
    }
  }, []);

  const handleSkip = useCallback(() => {
    if (state.status === "available") {
      setSkippedVersion(state.version);
    }
    setState({ status: "idle" });
    setDismissed(true);
  }, [state, setSkippedVersion]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (state.status === "idle" || dismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 99999,
        width: 320,
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        padding: 16,
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {state.status === "available" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                Update available
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                Version {state.version} is ready to install
              </div>
            </div>
            <button
              onClick={handleDismiss}
              style={{
                background: "none", border: "none", color: "var(--text-secondary)",
                cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleInstall}
              style={{
                flex: 1, padding: "6px 12px", borderRadius: 6, border: "none",
                backgroundColor: "var(--accent)", color: "#fff", cursor: "pointer",
                fontSize: 12, fontWeight: 500,
              }}
            >
              Install & Restart
            </button>
            <button
              onClick={handleSkip}
              style={{
                padding: "6px 12px", borderRadius: 6,
                border: "1px solid var(--border)", backgroundColor: "transparent",
                color: "var(--text-secondary)", cursor: "pointer", fontSize: 12,
              }}
            >
              Skip
            </button>
          </div>
        </>
      )}

      {state.status === "downloading" && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            Downloading v{state.version}...
          </div>
          <div style={{
            height: 6, backgroundColor: "var(--bg-primary)", borderRadius: 3, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${state.progress}%`, backgroundColor: "var(--accent)",
              borderRadius: 3, transition: "width 0.2s ease",
            }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
            {state.progress}%
          </div>
        </>
      )}

      {state.status === "ready" && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            Update ready — restart to apply
          </div>
          <button
            onClick={handleRelaunch}
            style={{
              width: "100%", padding: "6px 12px", borderRadius: 6, border: "none",
              backgroundColor: "#22c55e", color: "#fff", cursor: "pointer",
              fontSize: 12, fontWeight: 500,
            }}
          >
            Restart now
          </button>
        </>
      )}

      {state.status === "error" && (
        <>
          <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 4 }}>
            Update failed
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>
            {state.message}
          </div>
          <button
            onClick={handleDismiss}
            style={{
              padding: "6px 12px", borderRadius: 6,
              border: "1px solid var(--border)", backgroundColor: "transparent",
              color: "var(--text-secondary)", cursor: "pointer", fontSize: 12,
            }}
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
