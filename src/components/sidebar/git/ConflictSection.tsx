import { useState, useCallback, useEffect } from "react";
import { useGitStore } from "../../../stores/gitStore";
import { gitResolveConflict } from "../../../lib/ipc";

interface ConflictSectionProps {
  repoPath: string;
}

export function ConflictSection({ repoPath }: ConflictSectionProps) {
  const conflicts = useGitStore((s) => s.conflicts);
  const refreshConflicts = useGitStore((s) => s.refreshConflicts);
  const refresh = useGitStore((s) => s.refresh);

  const [busy, setBusy] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  // Show "all resolved" briefly when conflicts go from non-empty to empty
  useEffect(() => {
    if (conflicts.length === 0 && !resolved) return;
    if (conflicts.length === 0 && resolved) {
      const timer = setTimeout(() => setResolved(false), 2000);
      return () => clearTimeout(timer);
    }
    if (conflicts.length > 0) {
      setResolved(false);
    }
  }, [conflicts.length, resolved]);

  const handleResolve = useCallback(
    async (filePath: string, resolution: "ours" | "theirs") => {
      if (busy) return;
      setBusy(filePath);
      try {
        await gitResolveConflict(repoPath, filePath, resolution);
        await Promise.all([refreshConflicts(repoPath), refresh(repoPath)]);
        // If that was the last conflict, show resolved message
        const updated = useGitStore.getState().conflicts;
        if (updated.length === 0) {
          setResolved(true);
        }
      } catch {
        /* error surfaced via store */
      } finally {
        setBusy(null);
      }
    },
    [repoPath, busy, refreshConflicts, refresh],
  );

  // Show brief success message when all conflicts resolved
  if (conflicts.length === 0 && resolved) {
    return (
      <div
        style={{
          padding: "6px 8px",
          fontSize: 11,
          color: "#4caf50",
          fontWeight: 600,
          borderLeft: "3px solid #4caf50",
          marginBottom: 8,
        }}
      >
        All conflicts resolved
      </div>
    );
  }

  // Don't render when no conflicts
  if (conflicts.length === 0) return null;

  return (
    <div style={sectionStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: 14, marginRight: 4 }}>{"\u26A0"}</span>
        Merge Conflicts ({conflicts.length})
      </div>

      {/* Conflict list */}
      {conflicts.map((entry) => {
        const basename = entry.path.split("/").pop() || entry.path;
        const dir = entry.path.includes("/")
          ? entry.path.slice(0, entry.path.lastIndexOf("/") + 1)
          : "";
        const isBusy = busy === entry.path;

        return (
          <div key={entry.path} style={fileItemStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* File path */}
              <div
                style={{
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {dir && (
                  <span style={{ color: "var(--text-secondary)" }}>{dir}</span>
                )}
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {basename}
                </span>
              </div>

              {/* Side indicators */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 10,
                  color: "var(--text-secondary)",
                  marginTop: 2,
                }}
              >
                {entry.has_ours && (
                  <span>
                    <span style={{ color: "#4caf50" }}>{"\u2713"}</span> ours
                  </span>
                )}
                {entry.has_theirs && (
                  <span>
                    <span style={{ color: "#4caf50" }}>{"\u2713"}</span> theirs
                  </span>
                )}
                {entry.has_ancestor && (
                  <span>
                    <span style={{ color: "#4caf50" }}>{"\u2713"}</span> ancestor
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => handleResolve(entry.path, "ours")}
                disabled={isBusy}
                style={resolveBtnStyle}
                title="Accept ours"
              >
                Ours
              </button>
              <button
                onClick={() => handleResolve(entry.path, "theirs")}
                disabled={isBusy}
                style={resolveBtnStyle}
                title="Accept theirs"
              >
                Theirs
              </button>
              <button
                disabled
                style={{ ...resolveBtnStyle, opacity: 0.4, cursor: "not-allowed" }}
                title="Open in terminal editor (v2)"
              >
                Edit
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 8,
  border: "1px solid var(--text-error, #f44)",
  borderRadius: 4,
  padding: "4px 0",
};

const headerStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-error, #f44)",
  padding: "4px 8px",
  display: "flex",
  alignItems: "center",
};

const fileItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  borderTop: "1px solid var(--border)",
};

const resolveBtnStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  color: "var(--text-primary)",
  cursor: "pointer",
  fontSize: 10,
  padding: "2px 8px",
  fontWeight: 600,
};
