import { useState } from "react";
import type { GitStatusEntry } from "../../../lib/ipc";
import { gitStageFile, gitUnstageFile } from "../../../lib/ipc";

interface FileChangeItemProps {
  entry: GitStatusEntry;
  repoPath: string;
  staged: boolean;
  onToggle: () => void;
  onClick: () => void;
  selected: boolean;
}

function statusBadge(status: GitStatusEntry["status"]): { label: string; color: string } {
  switch (status) {
    case "staged_new":
    case "untracked":
      return { label: "A", color: status.startsWith("staged") ? "#4caf50" : "#9e9e9e" };
    case "staged_modified":
    case "modified":
      return { label: "M", color: status.startsWith("staged") ? "#4caf50" : "#ffa726" };
    case "staged_deleted":
    case "deleted":
      return { label: "D", color: status.startsWith("staged") ? "#4caf50" : "#ffa726" };
    case "staged_renamed":
    case "renamed":
      return { label: "R", color: status.startsWith("staged") ? "#4caf50" : "#ffa726" };
    case "conflicted":
      return { label: "!", color: "#f44336" };
    default:
      return { label: "?", color: "#9e9e9e" };
  }
}

function basename(path: string): string {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function FileChangeItem({
  entry,
  repoPath,
  staged,
  onToggle,
  onClick,
  selected,
}: FileChangeItemProps) {
  const [hovered, setHovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const badge = statusBadge(entry.status);

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (staged) {
        await gitUnstageFile(repoPath, entry.path);
      } else {
        await gitStageFile(repoPath, entry.path);
      }
      onToggle();
    } catch (err) {
      console.error("Stage/unstage failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    const fullPath = repoPath.endsWith("/") ? repoPath + entry.path : repoPath + "/" + entry.path;
    e.dataTransfer.setData("application/excalicode-file", JSON.stringify({
      path: fullPath,
      name: basename(entry.path),
    }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        fontSize: 12,
        cursor: "pointer",
        userSelect: "none",
        backgroundColor: selected
          ? "rgba(139, 124, 246, 0.12)"
          : hovered
            ? "var(--bg-secondary)"
            : "transparent",
        borderRadius: 3,
      }}
    >
      {/* File name */}
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "var(--text-primary)",
        }}
        title={entry.path}
      >
        {basename(entry.path)}
      </span>

      {/* Status badge */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: badge.color,
          flexShrink: 0,
          width: 14,
          textAlign: "center",
        }}
      >
        {badge.label}
      </span>

      {/* Stage/unstage action button */}
      <button
        onClick={handleAction}
        disabled={busy}
        style={{
          visibility: hovered || selected ? "visible" : "hidden",
          background: "none",
          border: "none",
          cursor: busy ? "wait" : "pointer",
          color: "var(--text-secondary)",
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1,
          padding: "0 2px",
          flexShrink: 0,
          opacity: busy ? 0.5 : 1,
        }}
        title={staged ? "Unstage file" : "Stage file"}
      >
        {staged ? "\u2212" : "+"}
      </button>
    </div>
  );
}
