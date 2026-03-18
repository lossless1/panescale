import { useState, useCallback } from "react";
import { useSshStore } from "../../stores/sshStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { SshConnectionForm } from "./SshConnectionForm";
import type { SshConnectionConfig } from "../../lib/ipc";

export function SshPanel() {
  const connections = useSshStore((s) => s.connections);
  const groups = useSshStore((s) => s.groups);
  const addConnection = useSshStore((s) => s.addConnection);
  const updateConnection = useSshStore((s) => s.updateConnection);
  const removeConnection = useSshStore((s) => s.removeConnection);
  const addGroup = useSshStore((s) => s.addGroup);
  const removeGroup = useSshStore((s) => s.removeGroup);
  const addConnectionToGroup = useSshStore((s) => s.addConnectionToGroup);
  const removeConnectionFromGroup = useSshStore((s) => s.removeConnectionFromGroup);
  const addSshTerminalNode = useCanvasStore((s) => s.addSshTerminalNode);

  const [showForm, setShowForm] = useState(false);
  const [editingConn, setEditingConn] = useState<SshConnectionConfig | undefined>();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleConnect = useCallback(
    (conn: SshConnectionConfig) => {
      // Center of viewport for new nodes
      const viewport = useCanvasStore.getState().viewport;
      const x = -viewport.x + 200;
      const y = -viewport.y + 100;
      addSshTerminalNode({ x, y }, { id: conn.id, host: conn.host, user: conn.user });
    },
    [addSshTerminalNode],
  );

  const handleSave = useCallback(
    (config: SshConnectionConfig) => {
      if (editingConn) {
        updateConnection(config.id, config);
      } else {
        addConnection(config);
      }
      setShowForm(false);
      setEditingConn(undefined);
    },
    [editingConn, addConnection, updateConnection],
  );

  const handleEdit = useCallback((conn: SshConnectionConfig) => {
    setEditingConn(conn);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      removeConnection(id);
    },
    [removeConnection],
  );

  const handleAddGroup = useCallback(() => {
    const name = window.prompt("Group name:");
    if (name && name.trim()) {
      addGroup(name.trim());
    }
  }, [addGroup]);

  // Determine which connections are grouped vs ungrouped
  const groupedIds = new Set(groups.flatMap((g) => g.connectionIds));
  const ungrouped = connections.filter((c) => !groupedIds.has(c.id));

  const buttonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px 4px",
    fontSize: 12,
    color: "var(--text-secondary)",
    borderRadius: 3,
  };

  const renderConnection = (conn: SshConnectionConfig, groupName?: string) => (
    <div
      key={conn.id}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 8px",
        fontSize: 12,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div
          style={{
            fontWeight: 500,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {conn.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {conn.user}@{conn.host}:{conn.port}
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {/* Group assign select */}
        {groups.length > 0 && (
          <select
            value={groupName ?? ""}
            onChange={(e) => {
              const newGroup = e.target.value;
              // Remove from current group
              if (groupName) {
                removeConnectionFromGroup(groupName, conn.id);
              }
              // Add to new group
              if (newGroup) {
                addConnectionToGroup(newGroup, conn.id);
              }
            }}
            title="Assign to group"
            style={{
              fontSize: 10,
              padding: "1px 2px",
              background: "var(--bg-primary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              maxWidth: 60,
            }}
          >
            <option value="">--</option>
            {groups.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>
        )}
        <button onClick={() => handleConnect(conn)} style={buttonStyle} title="Connect">
          &#x25B6;
        </button>
        <button onClick={() => handleEdit(conn)} style={buttonStyle} title="Edit">
          &#x270E;
        </button>
        <button onClick={() => handleDelete(conn.id)} style={buttonStyle} title="Delete">
          &#x2715;
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "8px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => {
            setEditingConn(undefined);
            setShowForm(true);
          }}
          style={{
            flex: 1,
            padding: "4px 8px",
            fontSize: 11,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          + Connection
        </button>
        <button
          onClick={handleAddGroup}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          + Group
        </button>
      </div>

      {/* Groups */}
      {groups.map((group) => {
        const groupConns = connections.filter((c) =>
          group.connectionIds.includes(c.id),
        );
        const collapsed = collapsedGroups.has(group.name);
        return (
          <div key={group.name}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 8px",
                background: "var(--bg-secondary)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-primary)",
                userSelect: "none",
              }}
              onClick={() => toggleGroup(group.name)}
            >
              <span>
                {collapsed ? "\u25B8" : "\u25BE"} {group.name} ({groupConns.length})
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeGroup(group.name);
                }}
                style={{
                  ...buttonStyle,
                  fontSize: 10,
                }}
                title="Remove group"
              >
                &#x2715;
              </button>
            </div>
            {!collapsed &&
              groupConns.map((c) => renderConnection(c, group.name))}
          </div>
        );
      })}

      {/* Ungrouped connections */}
      {ungrouped.length > 0 && groups.length > 0 && (
        <div
          style={{
            padding: "4px 8px",
            background: "var(--bg-secondary)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-secondary)",
          }}
        >
          Ungrouped
        </div>
      )}
      {ungrouped.map((c) => renderConnection(c))}

      {/* Empty state */}
      {connections.length === 0 && (
        <div
          style={{
            padding: 16,
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          No SSH connections yet.
          <br />
          Click "+ Connection" to add one.
        </div>
      )}

      {/* Connection form modal */}
      {showForm && (
        <SshConnectionForm
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingConn(undefined);
          }}
          editingConnection={editingConn}
        />
      )}
    </div>
  );
}
