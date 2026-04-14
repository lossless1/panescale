import { useEffect, useState } from "react";
import {
  getUnseenChangelog,
  markChangelogSeen,
  type ChangelogEntry,
} from "../../lib/changelog";

const badgeColors: Record<ChangelogEntry["items"][number]["type"], string> = {
  feature: "#4a6cf7",
  fix: "#22c55e",
  improvement: "#f59e0b",
};

export function WhatsNewModal() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    const unseen = getUnseenChangelog();
    if (unseen && unseen.length > 0) {
      setEntries(unseen);
    }
  }, []);

  useEffect(() => {
    if (!entries) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [entries]);

  const handleClose = () => {
    markChangelogSeen();
    setEntries(null);
  };

  if (!entries) return null;

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 18,
            padding: "2px 6px",
            borderRadius: 4,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--text-secondary)";
          }}
        >
          &#x2715;
        </button>

        <h2
          style={{
            fontSize: 18,
            marginBottom: 4,
            marginTop: 0,
            color: "var(--text-primary)",
            fontWeight: 600,
          }}
        >
          What's New in Panescale
        </h2>

        {entries.map((entry) => (
          <div key={entry.version} style={{ marginTop: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                v{entry.version}
              </span>
              <span
                style={{ fontSize: 13, color: "var(--text-secondary)" }}
              >
                {entry.date}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {entry.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#fff",
                      padding: "2px 6px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                      backgroundColor: badgeColors[item.type],
                      flexShrink: 0,
                    }}
                  >
                    {item.type}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
                      marginLeft: 8,
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Got it button */}
        <button
          onClick={handleClose}
          style={{
            width: "100%",
            marginTop: 24,
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "var(--accent)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
