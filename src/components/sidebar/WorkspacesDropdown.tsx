import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspacesStore } from "../../stores/workspacesStore";

interface WorkspacesDropdownProps {
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const DROPDOWN_WIDTH = 260;

export function WorkspacesDropdown({ onClose, anchorRef }: WorkspacesDropdownProps) {
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspacesStore((s) => s.activeWorkspaceId);
  const createWorkspace = useWorkspacesStore((s) => s.createWorkspace);
  const switchWorkspace = useWorkspacesStore((s) => s.switchWorkspace);
  const renameWorkspace = useWorkspacesStore((s) => s.renameWorkspace);
  const deleteWorkspace = useWorkspacesStore((s) => s.deleteWorkspace);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    let left = rect.left;
    const top = rect.bottom + 4;
    if (left + DROPDOWN_WIDTH > window.innerWidth) {
      left = rect.right - DROPDOWN_WIDTH;
    }
    setPos({ top, left: Math.max(8, left) });
  }, [anchorRef]);

  // Close on outside click (exclude the anchor so clicking it re-toggles)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        !(anchorRef.current && anchorRef.current.contains(target))
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (renamingId) {
          setRenamingId(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, renamingId]);

  if (!pos) return null;

  const dropdown = (
    <div
      ref={dropdownRef}
      className="nodrag nowheel nopan"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: DROPDOWN_WIDTH,
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        padding: 4,
        zIndex: 10000,
      }}
    >
      {workspaces.map((w) => {
        const isActive = w.id === activeWorkspaceId;
        const isRenaming = renamingId === w.id;

        const commitRename = () => {
          const trimmed = renameValue.trim();
          if (trimmed && trimmed !== w.name) renameWorkspace(w.id, trimmed);
          setRenamingId(null);
        };
        const cancelRename = () => setRenamingId(null);

        return (
          <div
            key={w.id}
            role="button"
            onClick={() => {
              if (isRenaming) return;
              switchWorkspace(w.id);
              onClose();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              textAlign: "left",
              background: isActive ? "var(--bg-secondary)" : "transparent",
              color: "var(--text-primary)",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              backgroundColor: isActive ? "var(--accent)" : "transparent",
              flexShrink: 0,
            }} />

            <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") cancelRename();
                  }}
                  onBlur={commitRename}
                  style={{
                    width: "100%",
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    padding: "2px 6px",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--accent)",
                    borderRadius: 3,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <div style={{
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {w.name}
                </div>
              )}
            </div>

            {!isRenaming && (
              <span
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(w.name);
                  setRenamingId(w.id);
                }}
                style={{
                  opacity: 0.4,
                  cursor: "pointer",
                  padding: "2px 4px",
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 3,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "0.4";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                title="Rename workspace"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M12 2l2 2-8 8-3 1 1-3 8-8z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}

            {workspaces.length > 1 && !isRenaming && (
              <span
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); deleteWorkspace(w.id); }}
                style={{
                  opacity: 0.3,
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "0 2px",
                  flexShrink: 0,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.3"; }}
                title="Delete workspace"
              >
                &#x2715;
              </span>
            )}
          </div>
        );
      })}

      <div style={{ height: 1, backgroundColor: "var(--border)", margin: "4px 8px" }} />

      <button
        onClick={async () => { await createWorkspace(); onClose(); }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          textAlign: "left",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: 12,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
          <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        New Workspace
      </button>
    </div>
  );

  return createPortal(dropdown, document.body);
}
