import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import {
  sshReadRemoteDir,
  sshConnectForBrowsing,
  sshDisconnect,
  type RemoteFileEntry,
} from "../../lib/ipc";

function extractRemotePath(displayPath: string): string {
  const colonIdx = displayPath.indexOf(":");
  if (colonIdx < 0) return displayPath;
  return displayPath.substring(colonIdx + 1);
}

/** Map file extensions to simple text icons with colors — same as local FileTreeItem */
function fileIcon(name: string): { icon: string; color: string } {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  switch (ext) {
    case "ts": case "tsx": return { icon: "TS", color: "#3178c6" };
    case "js": case "jsx": return { icon: "JS", color: "#f0db4f" };
    case "json": return { icon: "{}", color: "#a0a0a0" };
    case "md": case "mdx": return { icon: "M", color: "#519aba" };
    case "css": case "scss": return { icon: "#", color: "#563d7c" };
    case "html": return { icon: "<>", color: "#e34c26" };
    case "rs": return { icon: "Rs", color: "#dea584" };
    case "toml": return { icon: "T", color: "#9c4221" };
    case "yml": case "yaml": return { icon: "Y", color: "#cb171e" };
    case "py": return { icon: "Py", color: "#3572A5" };
    case "go": return { icon: "Go", color: "#00ADD8" };
    case "sh": case "bash": case "zsh": return { icon: "$", color: "#89e051" };
    case "png": case "jpg": case "jpeg": case "gif": case "svg": case "webp":
      return { icon: "Im", color: "#a0a0a0" };
    case "lock": return { icon: "Lk", color: "#666" };
    default: return { icon: "\u2022", color: "var(--text-secondary)" };
  }
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}
    >
      <path d="M6 4l4 4-4 4" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FolderIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      {expanded ? (
        <path d="M1.5 3.5A1 1 0 012.5 2.5h3.172a1 1 0 01.707.293L7.5 3.914a1 1 0 00.707.293H13.5a1 1 0 011 1V5H3l-1.5 7V3.5z M3 5h11.5l-1.5 7.5h-10L1.5 5H3z" fill="#dcb67a"/>
      ) : (
        <path d="M1.5 3.5A1 1 0 012.5 2.5h3.172a1 1 0 01.707.293L7.5 3.914a1 1 0 00.707.293H13.5a1 1 0 011 1v7a1 1 0 01-1 1h-12a1 1 0 01-1-1v-8z" fill="#dcb67a"/>
      )}
    </svg>
  );
}

export function RemoteFileTree() {
  const activeProject = useProjectStore((s) => s.activeProject());
  const closeProject = useProjectStore((s) => s.closeProject);

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Map<string, RemoteFileEntry[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remotePath = activeProject ? extractRemotePath(activeProject.path) : "";

  useEffect(() => {
    if (!activeProject?.isRemote || !activeProject?.sshSessionId) {
      setError("Not connected. Click 'Reconnect' to establish SSH session.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const sessionId = activeProject.sshSessionId;
    const rPath = extractRemotePath(activeProject.path);

    sshReadRemoteDir(sessionId, rPath)
      .then((entries) => {
        setDirContents(new Map([[rPath, entries]]));
        setExpandedDirs(new Set([rPath]));
        setLoading(false);
      })
      .catch((err) => {
        setError(`Connection lost: ${err}. `);
        setLoading(false);
      });
  }, [activeProject?.path, activeProject?.sshSessionId]);

  const toggleDir = useCallback(
    async (dirPath: string) => {
      if (expandedDirs.has(dirPath)) {
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          next.delete(dirPath);
          return next;
        });
        return;
      }

      if (!activeProject?.sshSessionId) return;

      if (!dirContents.has(dirPath)) {
        try {
          const entries = await sshReadRemoteDir(activeProject.sshSessionId, dirPath);
          setDirContents((prev) => new Map(prev).set(dirPath, entries));
        } catch (err) {
          setError(`Failed to read directory: ${err}`);
          return;
        }
      }

      setExpandedDirs((prev) => new Set(prev).add(dirPath));
    },
    [expandedDirs, dirContents, activeProject?.sshSessionId],
  );

  const handleReconnect = useCallback(async () => {
    if (!activeProject?.isRemote || !activeProject?.sshHost) return;

    setLoading(true);
    setError(null);

    try {
      const [user, host] = activeProject.sshHost.split("@");
      const sessionId = await sshConnectForBrowsing(host, 22, user, null, null);
      const rPath = extractRemotePath(activeProject.path);
      useProjectStore.getState().openRemoteProject(rPath, sessionId, activeProject.sshHost);
    } catch (err) {
      setError(`Reconnection failed: ${err}`);
      setLoading(false);
    }
  }, [activeProject?.isRemote, activeProject?.sshHost, activeProject?.path]);

  const handleDisconnect = useCallback(async () => {
    if (!activeProject) return;
    if (activeProject.sshSessionId) {
      try { await sshDisconnect(activeProject.sshSessionId); } catch {}
    }
    closeProject(activeProject.path);
  }, [activeProject, closeProject]);

  function renderEntries(entries: RemoteFileEntry[] | undefined, depth: number) {
    if (!entries || entries.length === 0) {
      return (
        <div style={{ padding: "3px 8px", paddingLeft: 8 + depth * 16, fontSize: 13, fontStyle: "italic", color: "var(--text-secondary)" }}>
          Empty directory
        </div>
      );
    }

    const sorted = [...entries].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((entry) => {
      const isExpanded = expandedDirs.has(entry.path);
      const paddingLeft = 8 + depth * 16;
      const icon = entry.is_dir ? null : fileIcon(entry.name);

      return (
        <div key={entry.path}>
          <div
            onClick={entry.is_dir ? () => toggleDir(entry.path) : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              paddingLeft,
              paddingRight: 8,
              paddingTop: 3,
              paddingBottom: 3,
              fontSize: 13,
              cursor: entry.is_dir ? "pointer" : "default",
              userSelect: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {entry.is_dir ? (
              <>
                <ChevronIcon expanded={isExpanded} />
                <FolderIcon expanded={isExpanded} />
              </>
            ) : (
              <>
                <span style={{ width: 16, flexShrink: 0 }} />
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 16, fontSize: 9, fontWeight: 700, color: icon!.color, flexShrink: 0,
                }}>
                  {icon!.icon}
                </span>
              </>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
              {entry.name}
            </span>
          </div>
          {entry.is_dir && isExpanded && renderEntries(dirContents.get(entry.path), depth + 1)}
        </div>
      );
    });
  }

  const rootEntries = dirContents.get(remotePath);

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {/* Remote project header */}
      <div style={{
        padding: "4px 8px", fontSize: 11, color: "var(--text-secondary)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {activeProject?.sshHost} : {remotePath}
        </span>
        <button
          onClick={handleDisconnect}
          title={`Disconnect from ${activeProject?.sshHost}`}
          style={{
            background: "none", border: "none", color: "var(--text-secondary)",
            cursor: "pointer", padding: "2px 4px", fontSize: 12, flexShrink: 0,
          }}
        >
          &#x2715;
        </button>
      </div>

      {/* Accent left border for remote distinction */}
      <div style={{ borderLeft: "3px solid rgba(99, 102, 241, 0.4)", minHeight: "100%" }}>
        {loading && (
          <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
            Loading remote files...
          </div>
        )}
        {error && (
          <div style={{ padding: 16, fontSize: 12, color: "#ef4444" }}>
            {error}{" "}
            <span onClick={handleReconnect} style={{ cursor: "pointer", textDecoration: "underline" }}>
              Reconnect?
            </span>
          </div>
        )}
        {!loading && !error && renderEntries(rootEntries, 0)}
      </div>
    </div>
  );
}
