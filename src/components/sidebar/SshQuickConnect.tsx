import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as path from "@tauri-apps/api/path";
import { useSshStore } from "../../stores/sshStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { useProjectStore } from "../../stores/projectStore";
import { sshConnectForBrowsing } from "../../lib/ipc";
import type { SshConfigHost, SshConnectionConfig } from "../../lib/ipc";
import { SshConnectionForm } from "./SshConnectionForm";

interface SshQuickConnectProps {
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function SshQuickConnect({ onClose, anchorRef }: SshQuickConnectProps) {
  const configHosts = useSshStore((s) => s.configHosts);
  const connections = useSshStore((s) => s.connections);
  const addConnection = useSshStore((s) => s.addConnection);
  const addSshTerminalNode = useCanvasStore((s) => s.addSshTerminalNode);
  const addContentNode = useCanvasStore((s) => s.addContentNode);
  const [showForm, setShowForm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    useSshStore.getState().loadConfigHosts();
  }, []);

  // Use useLayoutEffect to calculate position before paint — prevents flash at (0,0)
  useLayoutEffect(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    let left = rect.left;
    const top = rect.bottom + 4;
    if (left + 280 > window.innerWidth) {
      left = rect.right - 280;
    }
    setPos({ top, left: Math.max(8, left) });
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleConfigHostClick = useCallback(
    async (host: SshConfigHost) => {
      try {
        const hostname = host.hostname || host.host_alias;
        const user = host.user || "root";
        const port = host.port || 22;

        addSshTerminalNode(
          { x: 100, y: 100 },
          { id: host.host_alias, host: hostname, user },
        );

        const sessionId = await sshConnectForBrowsing(hostname, port, user, host.identity_file, null);
        useProjectStore.getState().openRemoteProject(`/home/${user}`, sessionId, `${user}@${hostname}`);
        onClose();
      } catch (err) {
        console.error("Failed to connect to config host:", err);
      }
    },
    [addSshTerminalNode, onClose],
  );

  const handleSavedConnectionClick = useCallback(
    async (conn: SshConnectionConfig) => {
      try {
        addSshTerminalNode(
          { x: 100, y: 100 },
          { id: conn.id, host: conn.host, user: conn.user },
        );

        const sessionId = await sshConnectForBrowsing(conn.host, conn.port, conn.user, conn.keyPath || null, null);
        useProjectStore.getState().openRemoteProject(`/home/${conn.user}`, sessionId, `${conn.user}@${conn.host}`);
        onClose();
      } catch (err) {
        console.error("Failed to connect to saved connection:", err);
      }
    },
    [addSshTerminalNode, onClose],
  );

  const handleNewConnectionSave = useCallback(
    (config: SshConnectionConfig) => {
      addConnection(config);
      setShowForm(false);
    },
    [addConnection],
  );

  const handleEditConfig = useCallback(async () => {
    // Open SSH config as a file tile on the canvas
    const homeDir = await path.homeDir();
    const configPath = `${homeDir}.ssh/config`;
    const viewport = useCanvasStore.getState().viewport;
    const position = {
      x: (-viewport.x + 200) / viewport.zoom,
      y: (-viewport.y + 200) / viewport.zoom,
    };
    addContentNode(position, "file-preview", { path: configPath, name: "config" });
    onClose();
  }, [addContentNode, onClose]);

  const actionBtnStyle: React.CSSProperties = {
    padding: "6px 8px",
    cursor: "pointer",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    width: "100%",
    textAlign: "left",
    color: "var(--text-secondary)",
    fontSize: 12,
  };

  const itemStyle: React.CSSProperties = {
    padding: "6px 8px",
    cursor: "pointer",
    borderRadius: 6,
    display: "flex",
    flexDirection: "column",
    gap: 1,
    background: "transparent",
    border: "none",
    width: "100%",
    textAlign: "left",
    color: "var(--text-primary)",
    fontSize: 12,
  };

  const hoverIn = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)";
  };
  const hoverOut = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
  };

  // Don't render until position is calculated
  if (!pos) return null;

  const dropdown = (
    <div
      ref={dropdownRef}
      role="menu"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        minWidth: 260,
        maxWidth: 320,
        maxHeight: "70vh",
        overflowY: "auto",
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 99999,
        padding: 4,
      }}
    >
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

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "var(--border)", margin: "4px 8px" }} />

      {/* SSH Config Hosts */}
      {configHosts.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", padding: "6px 8px 2px" }}>
            SSH Config
          </div>
          {configHosts.map((host) => (
            <button key={host.host_alias} role="menuitem" style={itemStyle} onClick={() => handleConfigHostClick(host)} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
              <span style={{ fontWeight: 500 }}>{host.host_alias}</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {host.hostname || host.host_alias}
              </span>
            </button>
          ))}
        </>
      )}

      {/* Saved Connections */}
      {connections.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", padding: "6px 8px 2px" }}>
            Saved
          </div>
          {connections.map((conn) => (
            <button key={conn.id} role="menuitem" style={itemStyle} onClick={() => handleSavedConnectionClick(conn)} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
              <span style={{ fontWeight: 500 }}>{conn.name}</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {conn.user}@{conn.host}
              </span>
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

      {/* New Connection Form */}
      {showForm && (
        <SshConnectionForm
          onSave={handleNewConnectionSave}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );

  return createPortal(dropdown, document.body);
}
