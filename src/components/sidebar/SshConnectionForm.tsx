import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { SshConnectionConfig } from "../../lib/ipc";

interface SshConnectionFormProps {
  onSave: (config: SshConnectionConfig) => void;
  onCancel: () => void;
  editingConnection?: SshConnectionConfig;
}

export function SshConnectionForm({
  onSave,
  onCancel,
  editingConnection,
}: SshConnectionFormProps) {
  const [name, setName] = useState(editingConnection?.name ?? "");
  const [host, setHost] = useState(editingConnection?.host ?? "");
  const [port, setPort] = useState(editingConnection?.port ?? 22);
  const [user, setUser] = useState(editingConnection?.user ?? "");
  const [authMode, setAuthMode] = useState<"key" | "password">(editingConnection?.keyPath ? "key" : "key");
  const [keyPath, setKeyPath] = useState(editingConnection?.keyPath ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleBrowseKey = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "SSH Keys", extensions: ["pem", "pub", "key", "*"] }],
    });
    if (selected) {
      setKeyPath(selected as string);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!host.trim()) {
      setError("Host is required");
      return;
    }
    if (!user.trim()) {
      setError("Username is required");
      return;
    }
    if (port < 1 || port > 65535) {
      setError("Port must be 1-65535");
      return;
    }

    onSave({
      id: editingConnection?.id ?? crypto.randomUUID(),
      name: name.trim(),
      host: host.trim(),
      port,
      user: user.trim(),
      keyPath: authMode === "key" && keyPath.trim() ? keyPath.trim() : undefined,
      authMode,
    });
  }, [name, host, port, user, keyPath, password, authMode, editingConnection, onSave]);

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: "var(--text-secondary)",
    marginBottom: 2,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "4px 8px",
    fontSize: 12,
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-sidebar)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
          width: 280,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          {editingConnection ? "Edit Connection" : "New SSH Connection"}
        </div>

        {error && (
          <div style={{ fontSize: 11, color: "#ef4444" }}>{error}</div>
        )}

        <div>
          <div style={labelStyle}>Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Server"
            style={inputStyle}
          />
        </div>

        <div>
          <div style={labelStyle}>Host</div>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="example.com"
            style={inputStyle}
          />
        </div>

        <div>
          <div style={labelStyle}>Port</div>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value, 10) || 22)}
            min={1}
            max={65535}
            style={inputStyle}
          />
        </div>

        <div>
          <div style={labelStyle}>Username</div>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="root"
            style={inputStyle}
          />
        </div>

        <div>
          <div style={{ ...labelStyle, display: "flex", gap: 8 }}>
            <span
              onClick={() => setAuthMode("key")}
              style={{
                cursor: "pointer",
                color: authMode === "key" ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: authMode === "key" ? 600 : 400,
              }}
            >
              Key File
            </span>
            <span style={{ color: "var(--border)" }}>|</span>
            <span
              onClick={() => setAuthMode("password")}
              style={{
                cursor: "pointer",
                color: authMode === "password" ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: authMode === "password" ? 600 : 400,
              }}
            >
              Password
            </span>
          </div>
          {authMode === "key" ? (
            <div style={{ display: "flex", gap: 4 }}>
              <input
                value={keyPath}
                onChange={(e) => setKeyPath(e.target.value)}
                placeholder="~/.ssh/id_rsa (optional)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleBrowseKey}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Browse
              </button>
            </div>
          ) : (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={inputStyle}
            />
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              background: "none",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
