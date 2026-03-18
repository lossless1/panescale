import { useEffect, useState } from "react";
import {
  gitDiffFile,
  gitStageHunk,
  gitUnstageHunk,
} from "../../../lib/ipc";
import { useGitStore } from "../../../stores/gitStore";
import type { GitFileDiff } from "../../../lib/ipc";

interface DiffViewerProps {
  repoPath: string;
  filePath: string;
  staged: boolean;
  onClose: () => void;
}

export function DiffViewer({ repoPath, filePath, staged, onClose }: DiffViewerProps) {
  const [diff, setDiff] = useState<GitFileDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyHunk, setBusyHunk] = useState<number | null>(null);
  const refresh = useGitStore((s) => s.refresh);

  const fetchDiff = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await gitDiffFile(repoPath, filePath, staged);
      setDiff(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiff();
  }, [repoPath, filePath, staged]);

  const handleHunkAction = async (hunkIndex: number) => {
    if (busyHunk !== null) return;
    setBusyHunk(hunkIndex);
    try {
      if (staged) {
        await gitUnstageHunk(repoPath, filePath, hunkIndex);
      } else {
        await gitStageHunk(repoPath, filePath, hunkIndex);
      }
      await refresh(repoPath);
      await fetchDiff();
    } catch (err) {
      console.error("Hunk action failed:", err);
    } finally {
      setBusyHunk(null);
    }
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Loading diff...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <span style={{ color: "var(--text-error, #f44)", fontSize: 11 }}>{error}</span>
      </div>
    );
  }

  if (!diff || diff.hunks.length === 0) {
    return (
      <div style={containerStyle}>
        <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>No changes to display</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* File header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 8px",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {filePath}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 14,
            lineHeight: 1,
            padding: "0 2px",
            flexShrink: 0,
          }}
          title="Close diff"
        >
          x
        </button>
      </div>

      {/* Hunks */}
      {diff.hunks.map((hunk, hunkIdx) => (
        <div key={hunkIdx}>
          {/* Hunk header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "2px 8px",
              backgroundColor: "rgba(128, 128, 128, 0.1)",
              fontSize: 10,
              fontFamily: '"SF Mono", "Fira Code", monospace',
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {hunk.header}
            </span>
            <button
              onClick={() => handleHunkAction(hunkIdx)}
              disabled={busyHunk !== null}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 3,
                cursor: busyHunk !== null ? "wait" : "pointer",
                color: "var(--text-secondary)",
                fontSize: 10,
                padding: "1px 6px",
                flexShrink: 0,
                marginLeft: 4,
                opacity: busyHunk !== null ? 0.5 : 1,
              }}
              title={staged ? "Unstage this hunk" : "Stage this hunk"}
            >
              {staged ? "Unstage Hunk" : "Stage Hunk"}
            </button>
          </div>

          {/* Diff lines */}
          {hunk.lines.map((line, lineIdx) => {
            const isAdd = line.origin === "+";
            const isRemove = line.origin === "-";

            return (
              <div
                key={lineIdx}
                style={{
                  display: "flex",
                  fontFamily: '"SF Mono", "Fira Code", monospace',
                  fontSize: 11,
                  lineHeight: "1.4",
                  backgroundColor: isAdd
                    ? "rgba(46, 160, 67, 0.15)"
                    : isRemove
                      ? "rgba(248, 81, 73, 0.15)"
                      : "transparent",
                }}
              >
                {/* Line number gutter */}
                <span
                  style={{
                    width: 32,
                    minWidth: 32,
                    textAlign: "right",
                    paddingRight: 4,
                    color: "var(--text-secondary)",
                    opacity: 0.5,
                    fontSize: 10,
                    userSelect: "none",
                    flexShrink: 0,
                  }}
                >
                  {line.old_lineno ?? ""}
                </span>
                <span
                  style={{
                    width: 32,
                    minWidth: 32,
                    textAlign: "right",
                    paddingRight: 4,
                    color: "var(--text-secondary)",
                    opacity: 0.5,
                    fontSize: 10,
                    userSelect: "none",
                    flexShrink: 0,
                  }}
                >
                  {line.new_lineno ?? ""}
                </span>

                {/* Origin marker */}
                <span
                  style={{
                    width: 12,
                    minWidth: 12,
                    textAlign: "center",
                    color: isAdd ? "#3fb950" : isRemove ? "#f85149" : "var(--text-secondary)",
                    userSelect: "none",
                    flexShrink: 0,
                  }}
                >
                  {line.origin}
                </span>

                {/* Content */}
                <span
                  style={{
                    flex: 1,
                    whiteSpace: "pre",
                    overflow: "hidden",
                    color: isAdd ? "#3fb950" : isRemove ? "#f85149" : "var(--text-primary)",
                  }}
                >
                  {line.content}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxHeight: 400,
  overflowY: "auto",
  overflowX: "hidden",
  border: "1px solid var(--border)",
  borderRadius: 4,
  margin: "4px 0",
};
