import { useState } from "react";

const HOTKEYS = [
  { key: "Double-click canvas", action: "Spawn terminal" },
  { key: "Cmd/Ctrl + K", action: "Fuzzy file search" },
  { key: "Cmd/Ctrl + F", action: "Search in terminal" },
  { key: "Cmd/Ctrl + =/-", action: "Zoom in/out" },
  { key: "Cmd/Ctrl + 0", action: "Fit all tiles" },
  { key: "M", action: "Toggle minimap" },
  { key: "Escape", action: "Exit terminal focus" },
  { key: "Space + drag", action: "Pan canvas" },
  { key: "Shift + scroll", action: "Pan over terminal" },
  { key: "Cmd/Ctrl + Enter", action: "Git commit" },
];

export function TitleBar() {
  const [showHotkeys, setShowHotkeys] = useState(false);

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 38,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        userSelect: "none",
        WebkitUserSelect: "none",
        position: "relative",
        flexShrink: 0,
        paddingLeft: 78,
        paddingRight: 12,
      }}
    >
      {/* Right side: hotkey legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div
          style={{ position: "relative", display: "inline-flex" }}
          onMouseEnter={() => setShowHotkeys(true)}
          onMouseLeave={() => setShowHotkeys(false)}
        >
          <button
            title="Keyboard shortcuts"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "2px 6px",
              fontSize: 14,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              borderRadius: 4,
            }}
          >
            ?
          </button>
          {showHotkeys && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 0",
                zIndex: 9999,
                minWidth: 260,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <div
                style={{
                  padding: "4px 12px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Keyboard Shortcuts
              </div>
              {HOTKEYS.map((h) => (
                <div
                  key={h.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 12px",
                    fontSize: 12,
                    color: "var(--text-primary)",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {h.action}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--text-primary)",
                      backgroundColor: "var(--bg-primary)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                    }}
                  >
                    {h.key}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
