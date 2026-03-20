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

export function RemoteFileTree() {
  const activeProject = useProjectStore((s) => s.activeProject());
  const closeProject = useProjectStore((s) => s.closeProject);

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Map<string, RemoteFileEntry[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remotePath = activeProject ? extractRemotePath(activeProject.path) : "";

  // Load root directory when active project changes
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

      // Load children if not cached
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

      const { openRemoteProject } = useProjectStore.getState();
      const rPath = extractRemotePath(activeProject.path);
      openRemoteProject(rPath, sessionId, activeProject.sshHost);
      // The useEffect will re-fire because sshSessionId changed
    } catch (err) {
      setError(`Reconnection failed: ${err}`);
      setLoading(false);
    }
  }, [activeProject?.isRemote, activeProject?.sshHost, activeProject?.path]);

  const handleDisconnect = useCallback(async () => {
    if (!activeProject) return;
    if (activeProject.sshSessionId) {
      try {
        await sshDisconnect(activeProject.sshSessionId);
      } catch {
        // Ignore disconnect errors (session may already be gone)
      }
    }
    closeProject(activeProject.path);
  }, [activeProject, closeProject]);

  function renderEntries(entries: RemoteFileEntry[] | undefined, depth: number) {
    if (!entries || entries.length === 0) {
      return (
        <div
          style={{
            padding: "4px 8px",
            paddingLeft: depth * 16 + 8,
            fontSize: 12,
            fontStyle: "italic",
            color: "var(--text-secondary)",
          }}
        >
          Empty directory
        </div>
      );
    }

    // Sort: directories first, then alphabetically
    const sorted = [...entries].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((entry) => {
      const isExpanded = expandedDirs.has(entry.path);
      return (
        <div key={entry.path}>
          <div
            onClick={entry.is_dir ? () => toggleDir(entry.path) : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              paddingLeft: depth * 16 + 8,
              fontSize: 12,
              color: "var(--text-primary)",
              cursor: entry.is_dir ? "pointer" : "default",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {entry.is_dir ? (
              <span style={{ fontSize: 10, width: 12, textAlign: "center", flexShrink: 0 }}>
                {isExpanded ? "\u25BE" : "\u25B8"}
              </span>
            ) : (
              <span style={{ width: 12, flexShrink: 0 }} />
            )}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
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
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Remote project header bar */}
      <div
        style={{
          padding: "4px 8px",
          fontSize: 10,
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Remote: {activeProject?.sshHost}:{remotePath}
        </span>
        <button
          onClick={handleDisconnect}
          title={`Disconnect from ${activeProject?.sshHost}`}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: "2px 4px",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          &#x2715;
        </button>
      </div>

      {/* 3px left accent border per UI-SPEC */}
      <div style={{ borderLeft: "3px solid rgba(99, 102, 241, 0.4)", minHeight: "100%" }}>
        {loading && (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ display: "inline-block", animation: "spin 800ms linear infinite" }}>
              &#x21BB;
            </span>{" "}
            Loading remote files...
          </div>
        )}
        {error && (
          <div style={{ padding: 16, fontSize: 12, color: "#ef4444" }}>
            {error}{" "}
            <span
              onClick={handleReconnect}
              style={{ cursor: "pointer", textDecoration: "underline" }}
            >
              Reconnect?
            </span>
          </div>
        )}
        {!loading && !error && renderEntries(rootEntries, 0)}
      </div>
    </div>
  );
}
