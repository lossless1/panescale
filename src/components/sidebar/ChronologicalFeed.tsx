import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { fsReadDir, type FileEntry } from "../../lib/ipc";

interface GroupedFiles {
  label: string;
  files: FileEntry[];
}

function relativeTime(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

function relativePath(filePath: string, rootPath: string): string {
  if (filePath.startsWith(rootPath)) {
    const rel = filePath.slice(rootPath.length).replace(/^[\\/]/, "");
    // Truncate long paths
    if (rel.length > 40) {
      return "..." + rel.slice(rel.length - 37);
    }
    return rel;
  }
  return filePath;
}

function groupByDate(files: FileEntry[]): GroupedFiles[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const today: FileEntry[] = [];
  const yesterday: FileEntry[] = [];
  const thisWeek: FileEntry[] = [];
  const older: FileEntry[] = [];

  for (const file of files) {
    if (file.modified_ms >= todayStart) {
      today.push(file);
    } else if (file.modified_ms >= yesterdayStart) {
      yesterday.push(file);
    } else if (file.modified_ms >= weekStart) {
      thisWeek.push(file);
    } else {
      older.push(file);
    }
  }

  const groups: GroupedFiles[] = [];
  if (today.length > 0) groups.push({ label: "Today", files: today });
  if (yesterday.length > 0)
    groups.push({ label: "Yesterday", files: yesterday });
  if (thisWeek.length > 0)
    groups.push({ label: "This Week", files: thisWeek });
  if (older.length > 0) groups.push({ label: "Older", files: older });

  return groups;
}

// Directories to skip during recursive traversal
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  ".next",
  "__pycache__",
  ".cache",
]);

export function ChronologicalFeed() {
  const activeProject = useProjectStore((s) => s.activeProject());
  const [allFiles, setAllFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const collectFiles = useCallback(async (rootPath: string) => {
    setLoading(true);
    const files: FileEntry[] = [];
    const queue = [rootPath];

    while (queue.length > 0) {
      const dirPath = queue.shift()!;
      try {
        const entries = await fsReadDir(dirPath);
        for (const entry of entries) {
          if (entry.is_dir) {
            if (!SKIP_DIRS.has(entry.name)) {
              queue.push(entry.path);
            }
          } else {
            files.push(entry);
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    // Sort by modified date, newest first
    files.sort((a, b) => b.modified_ms - a.modified_ms);
    setAllFiles(files);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!activeProject) {
      setAllFiles([]);
      return;
    }
    collectFiles(activeProject.path);
  }, [activeProject?.path, collectFiles]);

  if (!activeProject) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        No folder open
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        Scanning files...
      </div>
    );
  }

  const groups = groupByDate(allFiles);

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {groups.map((group) => (
        <div key={group.label}>
          <div
            style={{
              padding: "8px 8px 4px",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
            }}
          >
            {group.label}
          </div>
          {group.files.map((file) => (
            <div
              key={file.path}
              style={{
                padding: "4px 8px",
                fontSize: 13,
                cursor: "default",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--bg-secondary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
              }}
            >
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--text-primary)",
                }}
              >
                {file.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "60%",
                  }}
                >
                  {relativePath(file.path, activeProject.path)}
                </span>
                <span style={{ flexShrink: 0 }}>
                  {relativeTime(file.modified_ms)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
      {groups.length === 0 && (
        <div
          style={{
            padding: 16,
            fontSize: 13,
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          No files found
        </div>
      )}
    </div>
  );
}
