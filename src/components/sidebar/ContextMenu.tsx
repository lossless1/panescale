import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { FileEntry } from "../../lib/ipc";
import {
  fsCreateFile,
  fsCreateDir,
  fsRename,
  fsDelete,
  fsMove,
} from "../../lib/ipc";
import { useProjectStore } from "../../stores/projectStore";

interface ContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry | null;
  parentPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

type MenuMode = "menu" | "new-file" | "new-folder" | "rename" | "confirm-delete";

export function ContextMenu({
  x,
  y,
  entry,
  parentPath,
  onClose,
  onRefresh,
}: ContextMenuProps) {
  const [mode, setMode] = useState<MenuMode>("menu");
  const [inputValue, setInputValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeProject = useProjectStore((s) => s.activeProject());

  // Close on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Focus input when switching to input mode
  useEffect(() => {
    if (mode !== "menu" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [mode]);

  const basePath = entry?.is_dir ? entry.path : parentPath;

  const handleNewFile = useCallback(() => {
    setInputValue("");
    setMode("new-file");
  }, []);

  const handleNewFolder = useCallback(() => {
    setInputValue("");
    setMode("new-folder");
  }, []);

  const handleRename = useCallback(() => {
    if (!entry) return;
    setInputValue(entry.name);
    setMode("rename");
  }, [entry]);

  const handleDelete = useCallback(() => {
    setMode("confirm-delete");
  }, []);

  const handleMoveTo = useCallback(async () => {
    if (!entry) return;
    const selected = await open({
      directory: true,
      defaultPath: activeProject?.path,
    });
    if (selected) {
      await fsMove(entry.path, selected);
      onRefresh();
    }
    onClose();
  }, [entry, activeProject, onRefresh, onClose]);

  const handleInputSubmit = useCallback(async () => {
    const name = inputValue.trim();
    if (!name) return;

    try {
      if (mode === "new-file") {
        await fsCreateFile(basePath + "/" + name);
      } else if (mode === "new-folder") {
        await fsCreateDir(basePath + "/" + name);
      } else if (mode === "rename" && entry) {
        await fsRename(entry.path, parentPath + "/" + name);
      }
      onRefresh();
    } catch (err) {
      console.error("File operation failed:", err);
    }
    onClose();
  }, [mode, inputValue, basePath, parentPath, entry, onRefresh, onClose]);

  const handleConfirmDelete = useCallback(async () => {
    if (!entry) return;
    try {
      await fsDelete(entry.path);
      onRefresh();
    } catch (err) {
      console.error("Delete failed:", err);
    }
    onClose();
  }, [entry, onRefresh, onClose]);

  const menuItemStyle: React.CSSProperties = {
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    borderRadius: 3,
  };

  // Build menu items based on entry type
  const menuItems: { label: string; action: () => void }[] = [];

  if (!entry || entry.is_dir) {
    menuItems.push({ label: "New File", action: handleNewFile });
    menuItems.push({ label: "New Folder", action: handleNewFolder });
  }
  if (entry) {
    menuItems.push({ label: "Rename", action: handleRename });
    menuItems.push({ label: "Move to...", action: handleMoveTo });
    menuItems.push({ label: "Delete", action: handleDelete });
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 9999,
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        padding: "4px 0",
        minWidth: 160,
      }}
    >
      {mode === "menu" &&
        menuItems.map((item) => (
          <div
            key={item.label}
            onClick={item.action}
            style={menuItemStyle}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--accent)";
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent";
              (e.currentTarget as HTMLElement).style.color =
                "var(--text-primary)";
            }}
          >
            {item.label}
          </div>
        ))}

      {(mode === "new-file" || mode === "new-folder" || mode === "rename") && (
        <div style={{ padding: "6px 8px" }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
            {mode === "new-file"
              ? "New file name:"
              : mode === "new-folder"
                ? "New folder name:"
                : "Rename to:"}
          </div>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInputSubmit();
              if (e.key === "Escape") onClose();
            }}
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

      {mode === "confirm-delete" && (
        <div style={{ padding: "6px 8px" }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
            Delete {entry?.name}?
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleConfirmDelete}
              style={{
                flex: 1,
                padding: "4px 8px",
                fontSize: 12,
                background: "#e53935",
                color: "#fff",
                border: "none",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "4px 8px",
                fontSize: 12,
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
