import { useState, useCallback } from "react";
import { useGitStore } from "../../../stores/gitStore";
import {
  gitStashSave,
  gitStashApply,
  gitStashPop,
  gitStashDrop,
} from "../../../lib/ipc";

interface StashSectionProps {
  repoPath: string;
}

export function StashSection({ repoPath }: StashSectionProps) {
  const stashes = useGitStore((s) => s.stashes);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const refreshStashes = useGitStore((s) => s.refreshStashes);
  const refresh = useGitStore((s) => s.refresh);

  const [collapsed, setCollapsed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshStashes(repoPath), refresh(repoPath)]);
  }, [repoPath, refreshStashes, refresh]);

  const handleSave = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const msg = message.trim() || `WIP on ${currentBranch || "unknown"}`;
      await gitStashSave(repoPath, msg);
      setMessage("");
      await refreshAll();
    } catch {
      /* error surfaced via store */
    } finally {
      setBusy(false);
    }
  }, [repoPath, message, currentBranch, busy, refreshAll]);

  const handleApply = useCallback(
    async (index: number) => {
      if (busy) return;
      setBusy(true);
      try {
        await gitStashApply(repoPath, index);
        await refreshAll();
      } catch {
        /* error surfaced via store */
      } finally {
        setBusy(false);
      }
    },
    [repoPath, busy, refreshAll],
  );

  const handlePop = useCallback(
    async (index: number) => {
      if (busy) return;
      setBusy(true);
      try {
        await gitStashPop(repoPath, index);
        await refreshAll();
      } catch {
        /* error surfaced via store */
      } finally {
        setBusy(false);
      }
    },
    [repoPath, busy, refreshAll],
  );

  const handleDrop = useCallback(
    async (index: number) => {
      if (busy) return;
      const ok = window.confirm(
        `Drop stash@{${index}}? This cannot be undone.`,
      );
      if (!ok) return;
      setBusy(true);
      try {
        await gitStashDrop(repoPath, index);
        await refreshAll();
      } catch {
        /* error surfaced via store */
      } finally {
        setBusy(false);
      }
    },
    [repoPath, busy, refreshAll],
  );

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={headerStyle}
      >
        {collapsed ? "\u25B6" : "\u25BC"} Stashes ({stashes.length})
      </div>

      {!collapsed && (
        <>
          {/* Stash save input */}
          <div style={{ display: "flex", gap: 4, padding: "4px 0" }}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="Stash message (optional)"
              style={inputStyle}
            />
            <button
              onClick={handleSave}
              disabled={busy}
              style={btnStyle}
            >
              Stash
            </button>
          </div>

          {/* Stash list */}
          {stashes.length === 0 ? (
            <div
              style={{
                padding: "4px 0",
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              No stashes
            </div>
          ) : (
            stashes.map((entry) => (
              <div
                key={`${entry.index}-${entry.oid}`}
                style={stashItemStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "var(--bg-secondary)";
                  const actions = e.currentTarget.querySelector(
                    "[data-stash-actions]",
                  ) as HTMLElement | null;
                  if (actions) actions.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "transparent";
                  const actions = e.currentTarget.querySelector(
                    "[data-stash-actions]",
                  ) as HTMLElement | null;
                  if (actions) actions.style.opacity = "0";
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        color: "var(--accent, #8b7cf6)",
                        flexShrink: 0,
                      }}
                    >
                      stash@{"{"}
                      {entry.index}
                      {"}"}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        color: "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    >
                      {entry.oid.slice(0, 7)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontStyle: "italic",
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.message}
                  </div>
                </div>

                {/* Action buttons */}
                <div
                  data-stash-actions
                  style={{
                    display: "flex",
                    gap: 2,
                    opacity: 0,
                    transition: "opacity 0.15s",
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApply(entry.index);
                    }}
                    disabled={busy}
                    style={actionBtnStyle}
                    title="Apply (keep stash)"
                  >
                    Apply
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePop(entry.index);
                    }}
                    disabled={busy}
                    style={actionBtnStyle}
                    title="Pop (apply + remove)"
                  >
                    Pop
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDrop(entry.index);
                    }}
                    disabled={busy}
                    style={{ ...actionBtnStyle, color: "var(--text-error, #f44)" }}
                    title="Drop (discard)"
                  >
                    Drop
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-secondary)",
  marginTop: 12,
  marginBottom: 4,
  paddingBottom: 4,
  borderBottom: "1px solid var(--border)",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  color: "var(--text-primary)",
  fontSize: 11,
  padding: "4px 6px",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  color: "var(--text-primary)",
  cursor: "pointer",
  fontSize: 11,
  padding: "4px 8px",
  fontWeight: 600,
};

const stashItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 8px",
  fontSize: 12,
};

const actionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 3,
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 10,
  padding: "1px 6px",
};
