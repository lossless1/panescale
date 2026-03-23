import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as pathApi from "@tauri-apps/api/path";
import { useSshStore } from "../../stores/sshStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { useProjectStore } from "../../stores/projectStore";
import { sshConnectForBrowsing, sshReadRemoteDir } from "../../lib/ipc";
import type { SshConfigHost, SshConnectionConfig, RemoteFileEntry } from "../../lib/ipc";
import { SshConnectionForm } from "./SshConnectionForm";

// ── Folder Browser sub-component ──

interface FolderBrowserProps {
  sessionId: string;
  hostLabel: string;
  onSelect: (path: string) => void;
  onBack: () => void;
}

function FolderBrowser({ sessionId, hostLabel, onSelect, onBack }: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState("/home");
  const [entries, setEntries] = useState<RemoteFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sshReadRemoteDir(sessionId, dirPath);
      setEntries(result.filter((e) => e.is_dir).sort((a, b) => a.name.localeCompare(b.name)));
      setCurrentPath(dirPath);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadDir(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px" }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-secondary)", padding: "2px", display: "flex",
            borderRadius: 3,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          title="Back to hosts"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{hostLabel}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentPath}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "var(--border)", margin: "0 8px" }} />

      {/* Parent directory button */}
      {currentPath !== "/" && (
        <button
          onClick={() => {
            const parent = currentPath.replace(/\/[^/]+$/, "") || "/";
            loadDir(parent);
          }}
          style={{
            padding: "5px 8px", cursor: "pointer", borderRadius: 6,
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", width: "100%",
            textAlign: "left", color: "var(--text-secondary)", fontSize: 12,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <span style={{ opacity: 0.5 }}>..</span>
        </button>
      )}

      {/* Folder list */}
      {loading ? (
        <div style={{ padding: "12px 8px", fontSize: 12, color: "var(--text-secondary)" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: "12px 8px", fontSize: 12, color: "#ef4444" }}>{error}</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: "12px 8px", fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>No subdirectories</div>
      ) : (
        entries.map((entry) => (
          <button
            key={entry.path}
            onClick={() => loadDir(entry.path)}
            style={{
              padding: "5px 8px", cursor: "pointer", borderRadius: 6,
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: "none", width: "100%",
              textAlign: "left", color: "var(--text-primary)", fontSize: 12,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
              <path d="M2 4h4l1.5 1.5H14v7.5H2V4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            {entry.name}
          </button>
        ))
      )}

      {/* Open this folder button */}
      <div style={{ height: 1, backgroundColor: "var(--border)", margin: "4px 8px" }} />
      <button
        onClick={() => onSelect(currentPath)}
        style={{
          margin: 4, padding: "6px 12px", borderRadius: 6,
          border: "none", cursor: "pointer",
          backgroundColor: "var(--accent)", color: "#fff",
          fontSize: 12, fontWeight: 500, textAlign: "center",
        }}
      >
        Open {currentPath.split("/").pop() || "/"}
      </button>
    </div>
  );
}

// ── Main Dropdown ──

interface SshQuickConnectProps {
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

type View = "list" | "connecting" | "browse";

interface BrowseState {
  sessionId: string;
  hostLabel: string;
  hostInfo: { id: string; host: string; user: string; port?: number; keyPath?: string };
}

export function SshQuickConnect({ onClose, anchorRef }: SshQuickConnectProps) {
  const configHosts = useSshStore((s) => s.configHosts);
  const connections = useSshStore((s) => s.connections);
  const addConnection = useSshStore((s) => s.addConnection);
  const addSshTerminalNode = useCanvasStore((s) => s.addSshTerminalNode);
  const addContentNode = useCanvasStore((s) => s.addContentNode);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<View>("list");
  const [browseState, setBrowseState] = useState<BrowseState | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => { useSshStore.getState().loadConfigHosts(); }, []);

  useLayoutEffect(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    let left = rect.left;
    const top = rect.bottom + 4;
    if (left + 280 > window.innerWidth) left = rect.right - 280;
    setPos({ top, left: Math.max(8, left) });
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Connect to host and show folder browser
  const connectAndBrowse = useCallback(async (
    hostname: string, port: number, user: string,
    keyPath: string | null, hostLabel: string, hostInfo: { id: string; host: string; user: string; port?: number; keyPath?: string },
    password?: string | null,
  ) => {
    setView("connecting");
    setConnectError(null);
    console.log(`[SSH] Connecting to ${user}@${hostname}:${port}, keyPath=${keyPath}, hasPassword=${!!password}`);
    try {
      const sessionId = await sshConnectForBrowsing(hostname, port, user, keyPath, password ?? null);
      console.log(`[SSH] Connected successfully, sessionId=${sessionId}`);
      setBrowseState({ sessionId, hostLabel, hostInfo });
      setView("browse");
    } catch (err) {
      const errStr = String(err);
      console.error(`[SSH] Connection failed:`, errStr);
      // If key auth failed and no password was provided, prompt for password
      if (!password && errStr.toLowerCase().includes("password")) {
        console.log(`[SSH] Key auth failed, prompting for password`);
        const pw = window.prompt(`Enter password for ${user}@${hostname}:`);
        if (pw) {
          try {
            console.log(`[SSH] Retrying with password auth`);
            const sessionId = await sshConnectForBrowsing(hostname, port, user, null, pw);
            console.log(`[SSH] Password auth succeeded, sessionId=${sessionId}`);
            setBrowseState({ sessionId, hostLabel, hostInfo });
            setView("browse");
            return;
          } catch (e2) {
            console.error(`[SSH] Password auth also failed:`, String(e2));
            setConnectError(String(e2));
            setView("list");
            return;
          }
        }
      }
      setConnectError(errStr);
      setView("list");
    }
  }, []);

  const handleConfigHostClick = useCallback((host: SshConfigHost) => {
    const hostname = host.hostname || host.host_alias;
    const user = host.user || "root";
    const port = host.port || 22;
    console.log(`[SSH] Config host click: alias=${host.host_alias}, hostname=${hostname}, user=${user}, port=${port}, identityFile=${host.identity_file}`);
    connectAndBrowse(hostname, port, user, host.identity_file, `${user}@${hostname}`, { id: host.host_alias, host: hostname, user, port, keyPath: host.identity_file ?? undefined });
  }, [connectAndBrowse]);

  const handleSavedConnectionClick = useCallback((conn: SshConnectionConfig) => {
    console.log(`[SSH] Saved connection click: id=${conn.id}, host=${conn.host}, user=${conn.user}, port=${conn.port}, keyPath=${conn.keyPath}, authMode=${conn.authMode}`);
    let pw: string | null = null;
    if (conn.authMode === "password") {
      pw = window.prompt(`Enter password for ${conn.user}@${conn.host}:`);
      if (pw === null) return;
    }
    useSshStore.getState().touchConnection(conn.id);
    // Fall back to SSH config for identity file and port
    let keyPath = conn.keyPath || null;
    let port = conn.port;
    const configHost = configHosts.find((h) => h.host_alias === conn.id || h.hostname === conn.host);
    if (configHost) {
      if (!keyPath && configHost.identity_file) {
        keyPath = configHost.identity_file;
        console.log(`[SSH] Fell back to SSH config identity file: ${keyPath}`);
      }
      if (configHost.port && port === 22) {
        port = configHost.port;
        console.log(`[SSH] Fell back to SSH config port: ${port}`);
      }
    }
    console.log(`[SSH] Resolved keyPath=${keyPath}, port=${port}, hasPassword=${!!pw}`);
    connectAndBrowse(conn.host, port, conn.user, keyPath, `${conn.user}@${conn.host}`, { id: conn.id, host: conn.host, user: conn.user, port, keyPath: keyPath ?? undefined }, pw);
  }, [connectAndBrowse, configHosts]);

  // User selected a folder in the browser
  const handleFolderSelect = useCallback((remotePath: string) => {
    if (!browseState) return;
    const { sessionId, hostInfo } = browseState;

    // Ensure the connection exists in the store so the terminal can find it
    const existingConn = useSshStore.getState().connections.find((c) => c.id === hostInfo.id);
    if (!existingConn) {
      // Save config host as a connection so terminal can look it up by ID
      addConnection({
        id: hostInfo.id,
        name: hostInfo.id,
        host: hostInfo.host,
        port: hostInfo.port ?? 22,
        user: hostInfo.user,
        keyPath: hostInfo.keyPath ?? "",
        group: "",
      });
    }
    useSshStore.getState().touchConnection(hostInfo.id);

    // Spawn terminal tile at viewport center
    const { viewport } = useCanvasStore.getState();
    const position = {
      x: (-viewport.x + window.innerWidth / 2 - 320) / viewport.zoom,
      y: (-viewport.y + window.innerHeight / 2 - 240) / viewport.zoom,
    };
    addSshTerminalNode(position, hostInfo);

    // Set startup command to cd into the selected folder
    const nodes = useCanvasStore.getState().nodes;
    const newNode = nodes[nodes.length - 1];
    if (newNode) {
      useCanvasStore.getState().updateNodeData(newNode.id, { startupCommand: `cd ${remotePath}` });
      useCanvasStore.getState().setPanToNode(newNode.id);
    }

    // Open as remote project
    useProjectStore.getState().openRemoteProject(remotePath, sessionId, browseState.hostLabel);
    onClose();
  }, [browseState, addSshTerminalNode, addConnection, onClose]);

  const handleNewConnectionSave = useCallback((config: SshConnectionConfig) => {
    addConnection(config);
    setShowForm(false);
  }, [addConnection]);

  const handleEditConfig = useCallback(async () => {
    const homeDir = await pathApi.homeDir();
    const configPath = homeDir.endsWith("/") ? `${homeDir}.ssh/config` : `${homeDir}/.ssh/config`;
    // Place at viewport center
    const { viewport } = useCanvasStore.getState();
    const position = {
      x: (-viewport.x + window.innerWidth / 2 - 250) / viewport.zoom,
      y: (-viewport.y + window.innerHeight / 2 - 200) / viewport.zoom,
    };
    addContentNode(position, "file-preview", { path: configPath, name: "config" });
    // Pan camera to the new node
    const nodes = useCanvasStore.getState().nodes;
    const newNode = nodes[nodes.length - 1];
    if (newNode) {
      useCanvasStore.getState().setPanToNode(newNode.id);
    }
    onClose();
  }, [addContentNode, onClose]);

  const hoverIn = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)"; };
  const hoverOut = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; };

  const actionBtnStyle: React.CSSProperties = {
    padding: "6px 8px", cursor: "pointer", borderRadius: 6,
    display: "flex", alignItems: "center", gap: 6,
    background: "transparent", border: "none", width: "100%",
    textAlign: "left", color: "var(--text-secondary)", fontSize: 12,
  };

  const itemStyle: React.CSSProperties = {
    padding: "6px 8px", cursor: "pointer", borderRadius: 6,
    display: "flex", flexDirection: "column", gap: 1,
    background: "transparent", border: "none", width: "100%",
    textAlign: "left", color: "var(--text-primary)", fontSize: 12,
  };

  if (!pos) return null;

  const dropdown = (
    <div
      ref={dropdownRef}
      role="menu"
      style={{
        position: "fixed", top: pos.top, left: pos.left,
        minWidth: 260, maxWidth: 320, maxHeight: "70vh",
        overflowY: "auto", backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border)", borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)", zIndex: 99999, padding: 4,
      }}
    >
      {/* Connecting spinner */}
      {view === "connecting" && (
        <div style={{ padding: "20px 8px", textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
          Connecting...
        </div>
      )}

      {/* Folder browser */}
      {view === "browse" && browseState && (
        <FolderBrowser
          sessionId={browseState.sessionId}
          hostLabel={browseState.hostLabel}
          onSelect={handleFolderSelect}
          onBack={() => setView("list")}
        />
      )}

      {/* Host list (default view) */}
      {view === "list" && (
        <>
          {/* Actions at top */}
          <button role="menuitem" onClick={() => setShowForm(true)} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            New Connection
          </button>
          <button role="menuitem" onClick={handleEditConfig} style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 11.5V14h2.5L12.06 6.44 9.56 3.94 2 11.5zM14.06 4.44l-2.5-2.5-1.5 1.5 2.5 2.5 1.5-1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            Edit SSH Config
          </button>

          <div style={{ height: 1, backgroundColor: "var(--border)", margin: "4px 8px" }} />

          {/* Connection error */}
          {connectError && (
            <div style={{ padding: "6px 8px", fontSize: 11, color: "#ef4444", lineHeight: 1.3 }}>
              Connection failed: {connectError}
            </div>
          )}

          {/* Recent Connections (shown first) */}
          {connections.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", padding: "6px 8px 2px" }}>
                Recently Connected
              </div>
              {[...connections].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)).map((conn) => (
                <button key={conn.id} role="menuitem" style={itemStyle} onClick={() => handleSavedConnectionClick(conn)} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                  <span style={{ fontWeight: 500 }}>{conn.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{conn.user}@{conn.host}</span>
                </button>
              ))}
            </>
          )}

          {/* SSH Config Hosts */}
          {configHosts.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", padding: "6px 8px 2px" }}>
                All Hosts
              </div>
              {configHosts.map((host) => (
                <button key={host.host_alias} role="menuitem" style={itemStyle} onClick={() => handleConfigHostClick(host)} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                  <span style={{ fontWeight: 500 }}>{host.host_alias}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{host.hostname || host.host_alias}</span>
                </button>
              ))}
            </>
          )}

          {/* Empty state */}
          {configHosts.length === 0 && connections.length === 0 && (
            <div style={{ padding: "8px", fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
              No hosts found. Add to ~/.ssh/config or create a new connection.
            </div>
          )}

          {showForm && (
            <SshConnectionForm onSave={handleNewConnectionSave} onCancel={() => setShowForm(false)} />
          )}
        </>
      )}
    </div>
  );

  return createPortal(dropdown, document.body);
}
