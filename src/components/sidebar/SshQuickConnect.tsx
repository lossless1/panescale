import { useEffect, useRef, useState, useCallback } from "react";
import { useSshStore } from "../../stores/sshStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { useProjectStore } from "../../stores/projectStore";
import { sshConnectForBrowsing, sshOpenConfigInEditor } from "../../lib/ipc";
import type { SshConfigHost, SshConnectionConfig } from "../../lib/ipc";
import { SshConnectionForm } from "./SshConnectionForm";

interface SshQuickConnectProps {
  onClose: () => void;
}

export function SshQuickConnect({ onClose }: SshQuickConnectProps) {
  const configHosts = useSshStore((s) => s.configHosts);
  const connections = useSshStore((s) => s.connections);
  const addConnection = useSshStore((s) => s.addConnection);
  const addSshTerminalNode = useCanvasStore((s) => s.addSshTerminalNode);
  const [showForm, setShowForm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load config hosts on mount
  useEffect(() => {
    useSshStore.getState().loadConfigHosts();
  }, []);

  // Dismiss on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
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

        // 1. Spawn terminal tile on canvas
        addSshTerminalNode(
          { x: 100, y: 100 },
          { id: host.host_alias, host: hostname, user },
        );

        // 2. Connect for file browsing (separate session, no PTY)
        const sessionId = await sshConnectForBrowsing(
          hostname,
          port,
          user,
          host.identity_file,
          null,
        );

        // 3. Register remote project so Files tab shows RemoteFileTree
        const { openRemoteProject } = useProjectStore.getState();
        openRemoteProject(`/home/${user}`, sessionId, `${user}@${hostname}`);

        onClose();
      } catch (err) {
        console.error("Failed to connect to config host:", err);
        // If browsing connection fails, terminal may still work -- don't block
      }
    },
    [addSshTerminalNode, onClose],
  );

  const handleSavedConnectionClick = useCallback(
    async (conn: SshConnectionConfig) => {
      try {
        // 1. Spawn terminal tile on canvas
        addSshTerminalNode(
          { x: 100, y: 100 },
          { id: conn.id, host: conn.host, user: conn.user },
        );

        // 2. Connect for file browsing (separate session, no PTY)
        const sessionId = await sshConnectForBrowsing(
          conn.host,
          conn.port,
          conn.user,
          conn.keyPath || null,
          null,
        );

        // 3. Register remote project so Files tab shows RemoteFileTree
        const { openRemoteProject } = useProjectStore.getState();
        openRemoteProject(
          `/home/${conn.user}`,
          sessionId,
          `${conn.user}@${conn.host}`,
        );

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

  const handleEditConfig = useCallback(() => {
    sshOpenConfigInEditor().catch((err) => {
      console.error("Failed to open SSH config in editor:", err);
    });
    onClose();
  }, [onClose]);

  const isEmpty = configHosts.length === 0 && connections.length === 0;

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-secondary)",
    padding: "8px 8px 4px",
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

  return (
    <div
      ref={dropdownRef}
      role="menu"
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: 4,
        minWidth: 240,
        maxWidth: 320,
        maxHeight: "70vh",
        overflowY: "auto",
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 9999,
        padding: 4,
      }}
    >
      {isEmpty ? (
        <div
          style={{
            padding: "12px 8px",
            fontSize: 12,
            color: "var(--text-secondary)",
            fontStyle: "italic",
            lineHeight: 1.4,
          }}
        >
          No SSH connections yet. Add hosts to ~/.ssh/config or click '+ New
          Connection' to get started.
        </div>
      ) : (
        <>
          {/* SSH Config Hosts */}
          <div style={sectionHeaderStyle}>SSH Config Hosts</div>
          {configHosts.length === 0 ? (
            <div
              style={{
                padding: "4px 8px 8px",
                fontSize: 12,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              No SSH Config Hosts
              <br />
              <span style={{ fontSize: 11 }}>
                Add hosts to ~/.ssh/config or create a connection below.
              </span>
            </div>
          ) : (
            configHosts.map((host) => (
              <button
                key={host.host_alias}
                role="menuitem"
                style={itemStyle}
                onClick={() => handleConfigHostClick(host)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline =
                    "2px solid var(--accent)";
                  e.currentTarget.style.outlineOffset = "1px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "inherit",
                  }}
                >
                  {host.host_alias}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--text-secondary)",
                  }}
                >
                  ({host.hostname || host.host_alias})
                </span>
              </button>
            ))
          )}

          {/* Saved Connections */}
          <div style={sectionHeaderStyle}>Saved Connections</div>
          {connections.length === 0 ? (
            <div
              style={{
                padding: "4px 8px 8px",
                fontSize: 12,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              No Saved Connections
              <br />
              <span style={{ fontSize: 11 }}>
                Click '+ New Connection' to add one.
              </span>
            </div>
          ) : (
            connections.map((conn) => (
              <button
                key={conn.id}
                role="menuitem"
                style={itemStyle}
                onClick={() => handleSavedConnectionClick(conn)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline =
                    "2px solid var(--accent)";
                  e.currentTarget.style.outlineOffset = "1px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "inherit",
                  }}
                >
                  {conn.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--text-secondary)",
                  }}
                >
                  ({conn.user}@{conn.host})
                </span>
              </button>
            ))
          )}
        </>
      )}

      {/* Divider */}
      <div
        style={{
          height: 1,
          backgroundColor: "var(--border)",
          margin: "4px 8px",
        }}
      />

      {/* Actions */}
      <button
        role="menuitem"
        onClick={() => setShowForm(true)}
        style={{
          ...itemStyle,
          flexDirection: "row",
          gap: 6,
          alignItems: "center",
          color: "var(--text-primary)",
          fontSize: 12,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--bg-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = "2px solid var(--accent)";
          e.currentTarget.style.outlineOffset = "1px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = "none";
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M8 3V13M3 8H13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        + New Connection...
      </button>

      <button
        role="menuitem"
        onClick={handleEditConfig}
        style={{
          ...itemStyle,
          flexDirection: "row",
          gap: 6,
          alignItems: "center",
          color: "var(--text-primary)",
          fontSize: 12,
          marginBottom: 4,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--bg-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = "2px solid var(--accent)";
          e.currentTarget.style.outlineOffset = "1px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = "none";
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M2 11.5V14h2.5L12.06 6.44 9.56 3.94 2 11.5zM14.06 4.44l-2.5-2.5-1.5 1.5 2.5 2.5 1.5-1.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        Edit SSH Config
      </button>

      {/* New Connection Form overlay */}
      {showForm && (
        <SshConnectionForm
          onSave={handleNewConnectionSave}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
