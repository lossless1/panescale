import { useEffect, useRef, useState } from "react";
import { useGitStore } from "../../../stores/gitStore";
import { useProjectStore } from "../../../stores/projectStore";
import { CommitSection } from "./CommitSection";
import { StatusSection } from "./StatusSection";
import { DiffViewer } from "./DiffViewer";
import { BranchSection } from "./BranchSection";
import { CommitLog } from "./CommitLog";
import { StashSection } from "./StashSection";
import { ConflictSection } from "./ConflictSection";

interface SelectedFile {
  path: string;
  staged: boolean;
}

interface GitPanelProps {
  overrideRepoPath?: string;
}

export function GitPanel({ overrideRepoPath }: GitPanelProps = {}) {
  const activeProject = useProjectStore((s) => s.activeProject());
  const {
    isRepo,
    entries,
    currentBranch,
    loading,
    error,
    refresh,
    refreshBranches,
    refreshLog,
    refreshStashes,
    refreshConflicts,
  } = useGitStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);

  const repoPathToUse = overrideRepoPath || activeProject?.path;

  // Debug: log re-renders
  const renderCount = useRef(0);
  const prevState = useRef({ repoPathToUse, isRepo, entriesLen: entries.length, currentBranch, loading, error });
  useEffect(() => {
    renderCount.current++;
    const prev = prevState.current;
    const changes: string[] = [];
    if (prev.repoPathToUse !== repoPathToUse) changes.push(`repoPath: ${prev.repoPathToUse} → ${repoPathToUse}`);
    if (prev.isRepo !== isRepo) changes.push(`isRepo: ${prev.isRepo} → ${isRepo}`);
    if (prev.entriesLen !== entries.length) changes.push(`entries: ${prev.entriesLen} → ${entries.length}`);
    if (prev.currentBranch !== currentBranch) changes.push(`branch: ${prev.currentBranch} → ${currentBranch}`);
    if (prev.loading !== loading) changes.push(`loading: ${prev.loading} → ${loading}`);
    if (prev.error !== error) changes.push(`error: ${prev.error} → ${error}`);
    if (changes.length > 0) {
      console.log(`[GitPanel] render #${renderCount.current}:`, changes.join(", "));
    }
    prevState.current = { repoPathToUse, isRepo, entriesLen: entries.length, currentBranch, loading, error };
  });

  useEffect(() => {
    if (!repoPathToUse) return;
    const path = repoPathToUse;

    // Full refresh on mount and project change
    refresh(path);
    refreshBranches(path);
    refreshLog(path);
    refreshStashes(path);
    refreshConflicts(path);

    // Lightweight 2-second polling for status only
    intervalRef.current = setInterval(() => {
      refresh(path);
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [repoPathToUse, refresh, refreshBranches, refreshLog, refreshStashes, refreshConflicts]);

  // Clear selected file if it disappears from entries
  useEffect(() => {
    if (selectedFile && !entries.some((e) => e.path === selectedFile.path)) {
      setSelectedFile(null);
    }
  }, [entries, selectedFile]);

  // Reset error dismissed state when error changes
  useEffect(() => {
    setErrorDismissed(false);
  }, [error]);

  const handleFileClick = (path: string, staged: boolean) => {
    if (selectedFile?.path === path && selectedFile?.staged === staged) {
      setSelectedFile(null);
    } else {
      setSelectedFile({ path, staged });
    }
  };

  if (!repoPathToUse) {
    return (
      <div style={centeredStyle}>
        <span style={mutedStyle}>No project open</span>
      </div>
    );
  }

  if (loading && entries.length === 0) {
    return (
      <div style={centeredStyle}>
        <span style={mutedStyle}>Loading...</span>
      </div>
    );
  }

  if (!isRepo) {
    return (
      <div style={centeredStyle}>
        <span style={mutedStyle}>Not a git repository</span>
      </div>
    );
  }

  const repoPath = repoPathToUse;

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      {/* Error banner */}
      {error && !errorDismissed && (
        <div style={errorBannerStyle}>
          <span style={{ flex: 1, color: "var(--text-error, #f44)", fontSize: 11 }}>
            {error}
          </span>
          <button
            onClick={() => setErrorDismissed(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 14,
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            x
          </button>
        </div>
      )}

      {/* Current branch header */}
      {currentBranch && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 14 }}>{"\u2387"}</span>
          <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>
            {currentBranch}
          </span>
        </div>
      )}

      {/* Conflict section -- top for visibility */}
      <ConflictSection repoPath={repoPath} />

      {/* Commit section */}
      <CommitSection repoPath={repoPath} />

      {/* Status section */}
      <StatusSection
        repoPath={repoPath}
        onFileClick={handleFileClick}
        selectedFile={selectedFile?.path ?? null}
      />

      {/* Diff viewer */}
      {selectedFile && (
        <DiffViewer
          repoPath={repoPath}
          filePath={selectedFile.path}
          staged={selectedFile.staged}
          onClose={() => setSelectedFile(null)}
        />
      )}

      {/* Branches */}
      <BranchSection repoPath={repoPath} />

      {/* Stashes */}
      <StashSection repoPath={repoPath} />

      {/* Commit log with SVG graph -- at bottom (longest section) */}
      <CommitLog repoPath={repoPath} />
    </div>
  );
}

const centeredStyle: React.CSSProperties = {
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

const errorBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  marginBottom: 8,
  background: "rgba(248, 81, 73, 0.1)",
  border: "1px solid var(--text-error, #f44)",
  borderRadius: 4,
};
