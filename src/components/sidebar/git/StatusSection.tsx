import { useState } from "react";
import { useGitStore } from "../../../stores/gitStore";
import { gitStageFile, gitUnstageFile } from "../../../lib/ipc";
import { FileChangeItem } from "./FileChangeItem";
import type { GitStatusEntry } from "../../../lib/ipc";

interface StatusSectionProps {
  repoPath: string;
  onFileClick: (path: string, staged: boolean) => void;
  selectedFile: string | null;
}

function FileGroup({
  title,
  entries,
  repoPath,
  staged,
  bulkAction,
  onBulkAction,
  onFileClick,
  selectedFile,
  onToggle,
}: {
  title: string;
  entries: GitStatusEntry[];
  repoPath: string;
  staged: boolean;
  bulkAction: string;
  onBulkAction: () => void;
  onFileClick: (path: string, staged: boolean) => void;
  selectedFile: string | null;
  onToggle: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Group header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          cursor: "pointer",
          userSelect: "none",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-secondary)",
        }}
      >
        <span onClick={() => setCollapsed(!collapsed)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, width: 12, textAlign: "center" }}>
            {collapsed ? "\u25B6" : "\u25BC"}
          </span>
          {title} ({entries.length})
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBulkAction();
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 10,
            padding: "1px 4px",
            borderRadius: 3,
          }}
          title={bulkAction}
        >
          {bulkAction}
        </button>
      </div>

      {/* File list */}
      {!collapsed &&
        entries.map((entry) => (
          <FileChangeItem
            key={entry.path + entry.status}
            entry={entry}
            repoPath={repoPath}
            staged={staged}
            onToggle={onToggle}
            onClick={() => onFileClick(entry.path, staged)}
            selected={selectedFile === entry.path}
          />
        ))}
    </div>
  );
}

export function StatusSection({ repoPath, onFileClick, selectedFile }: StatusSectionProps) {
  const entries = useGitStore((s) => s.entries);
  const refresh = useGitStore((s) => s.refresh);

  const staged = entries.filter((e) => e.status.startsWith("staged_"));
  const unstaged = entries.filter(
    (e) => e.status === "modified" || e.status === "deleted" || e.status === "renamed",
  );
  const untracked = entries.filter((e) => e.status === "untracked");

  const handleRefresh = () => refresh(repoPath);

  const handleStageAll = async (fileEntries: GitStatusEntry[]) => {
    for (const entry of fileEntries) {
      await gitStageFile(repoPath, entry.path);
    }
    handleRefresh();
  };

  const handleUnstageAll = async (fileEntries: GitStatusEntry[]) => {
    for (const entry of fileEntries) {
      await gitUnstageFile(repoPath, entry.path);
    }
    handleRefresh();
  };

  if (entries.length === 0) {
    return (
      <div style={{ padding: "8px", fontSize: 12, color: "var(--text-secondary)" }}>
        Working tree clean
      </div>
    );
  }

  return (
    <div>
      <FileGroup
        title="Staged Changes"
        entries={staged}
        repoPath={repoPath}
        staged={true}
        bulkAction="Unstage All"
        onBulkAction={() => handleUnstageAll(staged)}
        onFileClick={onFileClick}
        selectedFile={selectedFile}
        onToggle={handleRefresh}
      />
      <FileGroup
        title="Changes"
        entries={unstaged}
        repoPath={repoPath}
        staged={false}
        bulkAction="Stage All"
        onBulkAction={() => handleStageAll(unstaged)}
        onFileClick={onFileClick}
        selectedFile={selectedFile}
        onToggle={handleRefresh}
      />
      <FileGroup
        title="Untracked Files"
        entries={untracked}
        repoPath={repoPath}
        staged={false}
        bulkAction="Stage All"
        onBulkAction={() => handleStageAll(untracked)}
        onFileClick={onFileClick}
        selectedFile={selectedFile}
        onToggle={handleRefresh}
      />
    </div>
  );
}
