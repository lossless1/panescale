import { useCallback, useEffect, useState } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import { fsReadDir, type FileEntry } from "../../lib/ipc";
import { FileTreeItem } from "./FileTreeItem";
import { ContextMenu } from "./ContextMenu";

interface ProjectFileTreeProps {
  projectPath: string;
  /** Extra left padding applied to items (so nested project contents align past the project row chevron) */
  baseDepth?: number;
}

/**
 * File tree rooted at a specific project path. Each instance maintains its
 * own expanded/collapsed state and directory content cache, so multiple
 * projects can be browsed independently in the sidebar.
 */
export function ProjectFileTree({ projectPath, baseDepth = 1 }: ProjectFileTreeProps) {
  const addTerminalNode = useCanvasStore((s) => s.addTerminalNode);

  const handleOpenInTerminal = useCallback(
    (dirPath: string) => {
      const position = { x: 100, y: 100 };
      addTerminalNode(position, dirPath);
    },
    [addTerminalNode],
  );

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Map<string, FileEntry[]>>(new Map());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry | null;
    parentPath: string;
  } | null>(null);

  useEffect(() => {
    setExpandedDirs(new Set());
    setDirContents(new Map());
    fsReadDir(projectPath).then((entries) => {
      setDirContents(new Map([[projectPath, entries]]));
    });
  }, [projectPath]);

  const toggleDir = useCallback(
    async (path: string) => {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
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

  const refreshDir = useCallback((path: string) => {
    fsReadDir(path).then((entries) => {
      setDirContents((prev) => new Map(prev).set(path, entries));
    });
  }, []);

  const handleRightClick = useCallback(
    (event: React.MouseEvent, entry: FileEntry) => {
      event.preventDefault();
      const parentPath = entry.path.substring(0, entry.path.lastIndexOf("/"));
      setContextMenu({ x: event.clientX, y: event.clientY, entry, parentPath });
    },
    [],
  );

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

  const visibleEntries = buildVisibleEntries(projectPath, baseDepth);

  return (
    <>
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
            if (contextMenu.entry?.is_dir) {
              refreshDir(contextMenu.entry.path);
            }
          }}
          onOpenInTerminal={handleOpenInTerminal}
        />
      )}
    </>
  );
}
