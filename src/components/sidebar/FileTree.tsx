import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../../stores/projectStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { fsReadDir, type FileEntry } from "../../lib/ipc";
import { FileTreeItem } from "./FileTreeItem";
import { ContextMenu } from "./ContextMenu";

export function FileTree() {
  const activeProject = useProjectStore((s) => s.activeProject());
  const openProject = useProjectStore((s) => s.openProject);
  const addTerminalNode = useCanvasStore((s) => s.addTerminalNode);

  const handleOpenInTerminal = useCallback(
    (dirPath: string) => {
      // Spawn a new terminal tile at center of current viewport
      const position = { x: 100, y: 100 };
      addTerminalNode(position, dirPath);
    },
    [addTerminalNode],
  );

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Map<string, FileEntry[]>>(
    new Map(),
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry | null;
    parentPath: string;
  } | null>(null);

  // Load root directory when active project changes
  useEffect(() => {
    if (!activeProject) return;
    setExpandedDirs(new Set());
    setDirContents(new Map());

    fsReadDir(activeProject.path).then((entries) => {
      setDirContents(new Map([[activeProject.path, entries]]));
    });
  }, [activeProject?.path]);

  const toggleDir = useCallback(
    async (path: string) => {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          // Load directory contents if not cached
          if (!dirContents.has(path)) {
            fsReadDir(path).then((entries) => {
              setDirContents((prev) => new Map(prev).set(path, entries));
            });
          }
        }
        return next;
      });
    },
    [dirContents],
  );

  const refreshDir = useCallback(
    (path: string) => {
      fsReadDir(path).then((entries) => {
        setDirContents((prev) => new Map(prev).set(path, entries));
      });
    },
    [],
  );

  const handleRightClick = useCallback(
    (event: React.MouseEvent, entry: FileEntry) => {
      event.preventDefault();
      // Determine the parent path for this entry
      const parentPath = entry.path.substring(
        0,
        entry.path.lastIndexOf("/"),
      );
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        entry,
        parentPath,
      });
    },
    [],
  );

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      openProject(selected);
    }
  }, [openProject]);

  if (!activeProject) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          No folder open
        </div>
        <button
          onClick={handleOpenFolder}
          style={{
            padding: "6px 16px",
            fontSize: 13,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Open Folder
        </button>
      </div>
    );
  }

  // Build flat list of visible entries
  function buildVisibleEntries(
    parentPath: string,
    depth: number,
  ): { entry: FileEntry; depth: number }[] {
    const items: { entry: FileEntry; depth: number }[] = [];
    const entries = dirContents.get(parentPath);
    if (!entries) return items;

    for (const entry of entries) {
      items.push({ entry, depth });
      if (entry.is_dir && expandedDirs.has(entry.path)) {
        items.push(...buildVisibleEntries(entry.path, depth + 1));
      }
    }
    return items;
  }

  const visibleEntries = buildVisibleEntries(activeProject.path, 0);

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {visibleEntries.map(({ entry, depth }) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          depth={depth}
          expanded={expandedDirs.has(entry.path)}
          onToggle={toggleDir}
          onRightClick={handleRightClick}
        />
      ))}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          parentPath={contextMenu.parentPath}
          onClose={() => setContextMenu(null)}
          onRefresh={() => {
            refreshDir(contextMenu.parentPath);
            // Also refresh the entry's own path if it was a directory
            if (contextMenu.entry?.is_dir) {
              refreshDir(contextMenu.entry.path);
            }
          }}
          onOpenInTerminal={handleOpenInTerminal}
        />
      )}
    </div>
  );
}
