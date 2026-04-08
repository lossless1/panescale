import { useState, useCallback } from "react";
import { useGitStore } from "../../../stores/gitStore";
import {
  gitCreateBranch,
  gitSwitchBranch,
  gitDeleteBranch,
} from "../../../lib/ipc";

interface BranchSectionProps {
  repoPath: string;
}

export function BranchSection({ repoPath }: BranchSectionProps) {
  const branches = useGitStore((s) => s.branches);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const refreshBranches = useGitStore((s) => s.refreshBranches);
  const refresh = useGitStore((s) => s.refresh);

  const [collapsed, setCollapsed] = useState(false);
  const [remotesCollapsed, setRemotesCollapsed] = useState(true);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllLocal, setShowAllLocal] = useState(false);
  const [showAllRemote, setShowAllRemote] = useState(false);
  const BRANCH_LIMIT = 8;

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshBranches(repoPath), refresh(repoPath)]);
  }, [repoPath, refreshBranches, refresh]);

  const handleCreate = useCallback(async () => {
    const name = newBranchName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await gitCreateBranch(repoPath, name);
      setNewBranchName("");
      setShowCreateInput(false);
      await refreshAll();
    } catch {
      /* error shown via store */
    } finally {
      setBusy(false);
    }
  }, [repoPath, newBranchName, busy, refreshAll]);

  const handleSwitch = useCallback(
    async (name: string) => {
      if (name === currentBranch || busy) return;
      setBusy(true);
      try {
        await gitSwitchBranch(repoPath, name);
        await refreshAll();
      } catch {
        /* error shown via store */
      } finally {
        setBusy(false);
      }
    },
    [repoPath, currentBranch, busy, refreshAll],
  );

  const handleDelete = useCallback(
    async (name: string) => {
      if (busy) return;
      if (confirmDelete !== name) {
        setConfirmDelete(name);
        return;
      }
      setBusy(true);
      setConfirmDelete(null);
      try {
        await gitDeleteBranch(repoPath, name);
        await refreshAll();
      } catch {
        /* error shown via store */
      } finally {
        setBusy(false);
      }
    },
    [repoPath, busy, confirmDelete, refreshAll],
  );

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header */}
      <div
        style={headerStyle}
        onMouseEnter={(e) => {
          const btn = e.currentTarget.querySelector(
            "[data-create-btn]",
          ) as HTMLElement | null;
          if (btn) btn.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget.querySelector(
            "[data-create-btn]",
          ) as HTMLElement | null;
          if (btn) btn.style.opacity = "0";
        }}
      >
        <span
          onClick={() => setCollapsed(!collapsed)}
          style={{ cursor: "pointer", flex: 1 }}
        >
          {collapsed ? "\u25B6" : "\u25BC"} Branches ({localBranches.length})
        </span>
        <span
          data-create-btn
          onClick={() => setShowCreateInput(!showCreateInput)}
          style={{
            cursor: "pointer",
            opacity: 0,
            transition: "opacity 0.15s",
            fontSize: 14,
            lineHeight: 1,
            padding: "0 2px",
          }}
          title="Create branch"
        >
          +
        </span>
      </div>

      {collapsed ? null : (
        <>
          {/* Current branch indicator */}
          {currentBranch && (
            <div
              style={{
                padding: "2px 8px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent, #8b7cf6)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 10 }}>{"\u2387"}</span>
              {currentBranch}
            </div>
          )}

          {/* Create branch input */}
          {showCreateInput && (
            <div style={{ display: "flex", padding: "2px 8px", gap: 4 }}>
              <input
                autoFocus
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setShowCreateInput(false);
                    setNewBranchName("");
                  }
                }}
                placeholder="new-branch"
                style={inputStyle}
              />
              <button
                onClick={handleCreate}
                disabled={!newBranchName.trim() || busy}
                style={btnStyle}
              >
                +
              </button>
            </div>
          )}

          {/* Local branches */}
          {(showAllLocal ? localBranches : localBranches.slice(0, BRANCH_LIMIT)).map((b) => (
            <div
              key={b.name}
              onClick={() => handleSwitch(b.name)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--bg-secondary)";
                const del = e.currentTarget.querySelector(
                  "[data-del-btn]",
                ) as HTMLElement | null;
                if (del) del.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
                const del = e.currentTarget.querySelector(
                  "[data-del-btn]",
                ) as HTMLElement | null;
                if (del) del.style.opacity = "0";
                if (confirmDelete === b.name) setConfirmDelete(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "4px 8px",
                fontSize: 12,
                cursor: b.is_current ? "default" : "pointer",
                color: b.is_current
                  ? "var(--accent, #8b7cf6)"
                  : "var(--text-primary)",
                fontWeight: b.is_current ? 600 : 400,
              }}
            >
              <span style={{ width: 14, flexShrink: 0, fontSize: 10 }}>
                {b.is_current ? "\u2713" : ""}
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.name}
              </span>
              {!b.is_current && (
                <span
                  data-del-btn
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(b.name);
                  }}
                  style={{
                    opacity: 0,
                    cursor: "pointer",
                    fontSize: 11,
                    color:
                      confirmDelete === b.name
                        ? "var(--text-error, #f44)"
                        : "var(--text-secondary)",
                    transition: "opacity 0.15s",
                    padding: "0 2px",
                  }}
                  title={
                    confirmDelete === b.name
                      ? "Click again to confirm"
                      : "Delete branch"
                  }
                >
                  {confirmDelete === b.name ? "confirm?" : "\u2715"}
                </span>
              )}
            </div>
          ))}

          {/* Show more local branches */}
          {!showAllLocal && localBranches.length > BRANCH_LIMIT && (
            <button
              onClick={() => setShowAllLocal(true)}
              style={{
                display: "block",
                width: "100%",
                padding: "4px 8px",
                fontSize: 11,
                color: "var(--accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Show {localBranches.length - BRANCH_LIMIT} more...
            </button>
          )}
          {showAllLocal && localBranches.length > BRANCH_LIMIT && (
            <button
              onClick={() => setShowAllLocal(false)}
              style={{
                display: "block",
                width: "100%",
                padding: "4px 8px",
                fontSize: 11,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Show less
            </button>
          )}

          {/* Remote branches */}
          {remoteBranches.length > 0 && (
            <>
              <div
                onClick={() => setRemotesCollapsed(!remotesCollapsed)}
                style={{
                  ...headerStyle,
                  fontSize: 10,
                  marginTop: 4,
                  cursor: "pointer",
                }}
              >
                {remotesCollapsed ? "\u25B6" : "\u25BC"} Remote (
                {remoteBranches.length})
              </div>
              {!remotesCollapsed && (
                <>
                  {(showAllRemote ? remoteBranches : remoteBranches.slice(0, BRANCH_LIMIT)).map((b) => (
                    <div
                      key={b.name}
                      style={{
                        padding: "4px 8px 4px 22px",
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.name}
                    </div>
                  ))}
                  {!showAllRemote && remoteBranches.length > BRANCH_LIMIT && (
                    <button
                      onClick={() => setShowAllRemote(true)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "4px 8px 4px 22px",
                        fontSize: 11,
                        color: "var(--accent)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      Show {remoteBranches.length - BRANCH_LIMIT} more...
                    </button>
                  )}
                  {showAllRemote && remoteBranches.length > BRANCH_LIMIT && (
                    <button
                      onClick={() => setShowAllRemote(false)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "4px 8px 4px 22px",
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      Show less
                    </button>
                  )}
                </>
              )}
            </>
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
  display: "flex",
  alignItems: "center",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  color: "var(--text-primary)",
  fontSize: 11,
  padding: "2px 6px",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  color: "var(--text-primary)",
  cursor: "pointer",
  fontSize: 12,
  padding: "2px 8px",
  lineHeight: 1,
};
