import { useState, useCallback, useEffect, useRef } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import { useFocusModeStore } from "../../hooks/useFocusMode";

/** Truncate a path to its last 2 segments for display. */
function truncateCwd(cwd: string): string {
  const parts = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  if (parts.length <= 2) return cwd;
  return ".../" + parts.slice(-2).join("/");
}

const bellPulseKeyframes = `
@keyframes bell-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.pile-row:hover .pile-close { opacity: 1 !important; }
`;

export function TerminalList() {
  const nodes = useCanvasStore((s) => s.nodes);
  const setPanToNode = useCanvasStore((s) => s.setPanToNode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const bellActiveNodes = useCanvasStore((s) => s.bellActiveNodes);
  const setBellActive = useCanvasStore((s) => s.setBellActive);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const activeTerminalId = useFocusModeStore((s) => s.activeTerminalId);
  const enterTerminalMode = useFocusModeStore((s) => s.enterTerminalMode);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Sync selection with active terminal — clear stale sidebar selection
  useEffect(() => {
    if (!activeTerminalId) {
      setSelectedNodeId(null);
    } else if (activeTerminalId !== selectedNodeId) {
      setSelectedNodeId(null);
    }
  }, [activeTerminalId, selectedNodeId]);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [renaming, setRenaming] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const ctxRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    function close(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setCtxMenu(null);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [ctxMenu]);

  // Focus rename input when it opens
  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  const handleRename = useCallback(() => {
    if (!ctxMenu) return;
    // Get current name for the input
    const node = nodes.find((n) => n.id === ctxMenu.nodeId);
    const currentName = (node?.data as Record<string, unknown>)?.customName as string || "";
    setRenameValue(currentName);
    setRenaming({ nodeId: ctxMenu.nodeId, x: ctxMenu.x, y: ctxMenu.y });
    setCtxMenu(null);
  }, [ctxMenu, nodes]);

  const submitRename = useCallback(() => {
    if (!renaming) return;
    updateNodeData(renaming.nodeId, { customName: renameValue.trim() || undefined });
    setRenaming(null);
  }, [renaming, renameValue, updateNodeData]);

  const handleClose = useCallback(() => {
    if (!ctxMenu) return;
    removeNode(ctxMenu.nodeId);
    setCtxMenu(null);
  }, [ctxMenu, removeNode]);

  const terminalNodes = nodes.filter((n) => n.type === "terminal");

  if (terminalNodes.length === 0) {
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
        No terminals
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <style>{bellPulseKeyframes}</style>
      {terminalNodes.map((node) => {
        const nodeData = node.data as Record<string, unknown>;
        const label = nodeData.label as string | undefined;
        const customName = nodeData.customName as string | undefined;
        const badgeColor = nodeData.badgeColor as string | undefined;
        const cwd = (nodeData.cwd as string) ?? "~";
        const isSsh = !!nodeData.sshConnectionId;
        const sshHost = nodeData.sshHost as string | undefined;
        const sshUser = nodeData.sshUser as string | undefined;
        const displayName = customName || label || (isSsh ? `${sshUser ?? ""}@${sshHost ?? "ssh"}` : `Terminal ${node.id.slice(0, 6)}`);
        const isBellActive = bellActiveNodes.has(node.id);
        const bellColor = { bg: "rgba(99, 102, 241, 0.15)", hover: "rgba(99, 102, 241, 0.25)" };

        return (
          <div
            key={node.id}
            className="pile-row"
            onClick={() => {
              if (isBellActive) {
                setBellActive(node.id, false);
                // Clear dock badge
                import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
                  getCurrentWindow().setBadgeLabel("").catch(() => {});
                });
              }
              setSelectedNodeId(node.id);
              setPanToNode(node.id);
              bringToFront(node.id);
              enterTerminalMode(node.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
              userSelect: "none",
              borderRadius: 4,
              ...(isBellActive
                ? {
                    animation: "bell-pulse 1s ease-in-out infinite",
                    backgroundColor: bellColor.bg,
                  }
                : (selectedNodeId === node.id || activeTerminalId === node.id)
                  ? {
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                    }
                  : {}),
            }}
            onMouseEnter={(e) => {
              const isActive = selectedNodeId === node.id || activeTerminalId === node.id;
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  isBellActive ? bellColor.hover : "var(--bg-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              const isActive = selectedNodeId === node.id || activeTerminalId === node.id;
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  isBellActive ? bellColor.bg : "transparent";
              }
            }}
          >
            {/* Badge color dot */}
            {badgeColor && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: badgeColor,
                  flexShrink: 0,
                }}
              />
            )}

            {/* Terminal icon */}
            <span
              style={{
                fontSize: isSsh ? 10 : 14,
                color: isSsh ? "var(--accent)" : "var(--text-secondary)",
                flexShrink: 0,
                width: 18,
                textAlign: "center",
                fontWeight: isSsh ? 700 : 400,
                letterSpacing: isSsh ? -0.5 : 0,
              }}
            >
              {isSsh ? "SSH" : ">_"}
            </span>

            <div style={{ overflow: "hidden", flex: 1 }}>
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--text-primary)",
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {truncateCwd(cwd)}
              </div>
            </div>

            {/* Close button */}
            <button
              className="pile-close"
              onClick={(e) => {
                e.stopPropagation();
                removeNode(node.id);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 16,
                padding: "2px 4px",
                lineHeight: 1,
                borderRadius: 3,
                flexShrink: 0,
                opacity: 0,
                transition: "opacity 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              }}
              title="Close terminal"
            >
              &#x2715;
            </button>
          </div>
        );
      })}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{
            position: "fixed",
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 9999,
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            padding: "4px 0",
            minWidth: 140,
          }}
        >
          {[
            { label: "Rename", action: handleRename },
            { label: "Close", action: handleClose },
          ].map((item) => (
            <div
              key={item.label}
              onClick={item.action}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
                userSelect: "none",
                borderRadius: 3,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)";
                (e.currentTarget as HTMLElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
      {renaming && (
        <div
          style={{
            position: "fixed",
            left: renaming.x,
            top: renaming.y,
            zIndex: 9999,
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            padding: "8px",
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
            Rename terminal:
          </div>
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") setRenaming(null);
            }}
            onBlur={() => setRenaming(null)}
            style={{
              width: "100%",
              padding: "4px 6px",
              fontSize: 13,
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}
    </div>
  );
}
