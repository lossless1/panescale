import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import { useFocusModeStore } from "../../hooks/useFocusMode";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Node } from "@xyflow/react";

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

// ── Sortable pile item ──

interface PileItemProps {
  node: Node;
  isSelected: boolean;
  isActive: boolean;
  isBellActive: boolean;
  bellColor: { bg: string; hover: string };
  isSsh: boolean;
  sshHost?: string;
  sshUser?: string;
  displayName: string;
  cwd: string;
  badgeColor?: string;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDuplicate: () => void;
  onClose: () => void;
}

function SortablePileItem({
  node, isSelected, isActive, isBellActive, bellColor,
  isSsh, displayName, cwd, badgeColor,
  onSelect, onContextMenu, onDuplicate, onClose,
}: PileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "grab",
    userSelect: "none",
    borderRadius: 4,
    ...(isBellActive
      ? { animation: "bell-pulse 1s ease-in-out infinite", backgroundColor: bellColor.bg }
      : (isSelected || isActive)
        ? { backgroundColor: "rgba(255, 255, 255, 0.1)" }
        : {}),
  };

  return (
    <div
      ref={setNodeRef}
      className="pile-row"
      style={style}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={(e) => {
        if (!isSelected && !isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            isBellActive ? bellColor.hover : "var(--bg-secondary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            isBellActive ? bellColor.bg : "transparent";
        }
      }}
      {...attributes}
      {...listeners}
    >
      {/* Badge color dot */}
      {badgeColor && (
        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: badgeColor, flexShrink: 0 }} />
      )}

      {/* Terminal icon */}
      <span
        style={{
          fontSize: isSsh ? 10 : 14,
          color: isSsh ? "var(--accent)" : "var(--text-secondary)",
          flexShrink: 0, width: 18, textAlign: "center",
          fontWeight: isSsh ? 700 : 400,
          letterSpacing: isSsh ? -0.5 : 0,
        }}
      >
        {isSsh ? "SSH" : ">_"}
      </span>

      <div style={{ overflow: "hidden", flex: 1 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
          {displayName}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {truncateCwd(cwd)}
        </div>
      </div>

      {/* Duplicate button */}
      <button
        className="pile-close"
        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
        style={{
          background: "none", border: "none", color: "var(--text-secondary)",
          cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1,
          borderRadius: 3, flexShrink: 0, opacity: 0,
          transition: "opacity 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        title="Duplicate terminal"
      >
        &#x2398;
      </button>

      {/* Close button */}
      <button
        className="pile-close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          background: "none", border: "none", color: "var(--text-secondary)",
          cursor: "pointer", fontSize: 16, padding: "2px 4px", lineHeight: 1,
          borderRadius: 3, flexShrink: 0, opacity: 0,
          transition: "opacity 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        title="Close terminal"
      >
        &#x2715;
      </button>
    </div>
  );
}

// ── Main list ──

export function TerminalList() {
  const nodes = useCanvasStore((s) => s.nodes);
  const setPanToNode = useCanvasStore((s) => s.setPanToNode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const bellActiveNodes = useCanvasStore((s) => s.bellActiveNodes);
  const setBellActive = useCanvasStore((s) => s.setBellActive);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const pileOrder = useCanvasStore((s) => s.pileOrder);
  const setPileOrder = useCanvasStore((s) => s.setPileOrder);
  const activeTerminalId = useFocusModeStore((s) => s.activeTerminalId);
  const enterTerminalMode = useFocusModeStore((s) => s.enterTerminalMode);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTerminalId) setSelectedNodeId(null);
    else if (activeTerminalId !== selectedNodeId) setSelectedNodeId(null);
  }, [activeTerminalId, selectedNodeId]);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [renaming, setRenaming] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const ctxRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    function close(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as globalThis.Node)) setCtxMenu(null);
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

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  const handleRename = useCallback(() => {
    if (!ctxMenu) return;
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

  // Get terminal nodes sorted by custom pile order
  const terminalNodes = useMemo(() => {
    const terminals = nodes.filter((n) => n.type === "terminal");
    if (pileOrder.length === 0) return terminals;
    const orderMap = new Map(pileOrder.map((id, i) => [id, i]));
    return [...terminals].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Infinity;
      const bi = orderMap.get(b.id) ?? Infinity;
      return ai - bi;
    });
  }, [nodes, pileOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const restrictToVertical: Modifier = ({ transform }) => ({
    ...transform,
    x: 0,
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = terminalNodes.map((n) => n.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    setPileOrder(arrayMove(ids, oldIndex, newIndex));
  }, [terminalNodes, setPileOrder]);

  const bellColor = { bg: "rgba(99, 102, 241, 0.15)", hover: "rgba(99, 102, 241, 0.25)" };

  if (terminalNodes.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--text-secondary)" }}>
        No terminals
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <style>{bellPulseKeyframes}</style>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVertical]}>
        <SortableContext items={terminalNodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          {terminalNodes.map((node) => {
            const nodeData = node.data as Record<string, unknown>;
            const customName = nodeData.customName as string | undefined;
            const label = nodeData.label as string | undefined;
            const badgeColor = nodeData.badgeColor as string | undefined;
            const cwd = (nodeData.cwd as string) ?? "~";
            const isSsh = !!nodeData.sshConnectionId;
            const sshHost = nodeData.sshHost as string | undefined;
            const sshUser = nodeData.sshUser as string | undefined;
            const displayName = customName || label || (isSsh ? `${sshUser ?? ""}@${sshHost ?? "ssh"}` : `Terminal ${node.id.slice(0, 6)}`);

            return (
              <SortablePileItem
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isActive={activeTerminalId === node.id}
                isBellActive={bellActiveNodes.has(node.id)}
                bellColor={bellColor}
                isSsh={isSsh}
                sshHost={sshHost}
                sshUser={sshUser}
                displayName={displayName}
                cwd={cwd}
                badgeColor={badgeColor}
                onSelect={() => {
                  if (bellActiveNodes.has(node.id)) {
                    setBellActive(node.id, false);
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
                onDuplicate={() => {
                  const nd = node.data as Record<string, unknown>;
                  const pos = { x: node.position.x + 40, y: node.position.y + 40 };
                  if (nd.sshConnectionId) {
                    useCanvasStore.getState().addSshTerminalNode(pos, {
                      id: nd.sshConnectionId as string,
                      host: (nd.sshHost as string) ?? "",
                      user: (nd.sshUser as string) ?? "",
                      port: (nd.sshPort as number) ?? 22,
                      keyPath: (nd.sshKeyPath as string) ?? undefined,
                    });
                    const newNodes = useCanvasStore.getState().nodes;
                    const newNode = newNodes[newNodes.length - 1];
                    if (newNode && nd.startupCommand) {
                      useCanvasStore.getState().updateNodeData(newNode.id, { startupCommand: nd.startupCommand });
                    }
                  } else {
                    useCanvasStore.getState().addTerminalNode(pos, (nd.cwd as string) ?? "~");
                  }
                }}
                onClose={() => removeNode(node.id)}
              />
            );
          })}
        </SortableContext>
      </DndContext>
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{
            position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999,
            backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.3)", padding: "4px 0", minWidth: 140,
          }}
        >
          {[
            { label: "Rename", action: handleRename },
            { label: "Close", action: handleClose },
          ].map((item) => (
            <div
              key={item.label}
              onClick={item.action}
              style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer", userSelect: "none", borderRadius: 3 }}
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
            position: "fixed", left: renaming.x, top: renaming.y, zIndex: 9999,
            backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.3)", padding: "8px", minWidth: 160,
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
              width: "100%", padding: "4px 6px", fontSize: 13,
              background: "var(--bg-primary)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: 3, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      )}
    </div>
  );
}
