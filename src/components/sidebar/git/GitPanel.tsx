import { useEffect, useRef } from "react";
import { useGitStore } from "../../../stores/gitStore";
import { useProjectStore } from "../../../stores/projectStore";

export function GitPanel() {
  const activeProject = useProjectStore((s) => s.activeProject());
  const {
    isRepo,
    entries,
    branches,
    currentBranch,
    commitLog,
    stashes,
    conflicts,
    loading,
    error,
    refresh,
    refreshBranches,
    refreshLog,
    refreshStashes,
    refreshConflicts,
  } = useGitStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeProject?.path) return;
    const path = activeProject.path;

    refresh(path);
    refreshBranches(path);
    refreshLog(path);
    refreshStashes(path);
    refreshConflicts(path);

    intervalRef.current = setInterval(() => {
      refresh(path);
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeProject?.path, refresh, refreshBranches, refreshLog, refreshStashes, refreshConflicts]);

  if (!activeProject) {
    return (
      <div style={sectionStyle}>
        <span style={mutedStyle}>No project open</span>
      </div>
    );
  }

  if (loading && entries.length === 0) {
    return (
      <div style={sectionStyle}>
        <span style={mutedStyle}>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={sectionStyle}>
        <span style={{ color: "var(--text-error, #f44)", fontSize: 12 }}>
          {error}
        </span>
      </div>
    );
  }

  if (!isRepo) {
    return (
      <div style={sectionStyle}>
        <span style={mutedStyle}>Not a git repository</span>
      </div>
    );
  }

  const staged = entries.filter((e) => e.status.startsWith("staged_"));
  const unstaged = entries.filter(
    (e) =>
      e.status === "modified" ||
      e.status === "deleted" ||
      e.status === "renamed",
  );
  const untracked = entries.filter((e) => e.status === "untracked");
  const conflicted = entries.filter((e) => e.status === "conflicted");

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      {/* Current branch */}
      {currentBranch && (
        <div style={{ marginBottom: 12 }}>
          <span style={mutedStyle}>Branch: </span>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {currentBranch}
          </span>
        </div>
      )}

      {/* Status */}
      <div style={headerStyle}>
        Status ({entries.length})
      </div>
      {staged.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={mutedStyle}>Staged: {staged.length}</span>
        </div>
      )}
      {unstaged.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={mutedStyle}>Unstaged: {unstaged.length}</span>
        </div>
      )}
      {untracked.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={mutedStyle}>Untracked: {untracked.length}</span>
        </div>
      )}
      {conflicted.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: "var(--text-error, #f44)" }}>
            Conflicts: {conflicted.length}
          </span>
        </div>
      )}
      {entries.length === 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={mutedStyle}>Working tree clean</span>
        </div>
      )}

      {/* Branches */}
      <div style={headerStyle}>
        Branches ({branches.length})
      </div>

      {/* Log */}
      <div style={headerStyle}>
        Log ({commitLog.length})
      </div>

      {/* Stashes */}
      <div style={headerStyle}>
        Stashes ({stashes.length})
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div style={headerStyle}>
          Conflicts ({conflicts.length})
        </div>
      )}
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const mutedStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 12,
};

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
};
