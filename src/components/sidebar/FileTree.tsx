import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../../stores/projectStore";
import { fsReadDir, type FileEntry } from "../../lib/ipc";
import { FileTreeItem } from "./FileTreeItem";

export function FileTree() {
  const activeProject = useProjectStore((s) => s.activeProject());
  const projects = useProjectStore((s) => s.projects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const openProject = useProjectStore((s) => s.openProject);

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Map<string, FileEntry[]>>(
    new Map(),
  );

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
      {/* Project selector for multiple projects */}
      {projects.length > 1 && (
        <div
          style={{
            padding: "4px 8px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <select
            value={useProjectStore.getState().activeProjectIndex}
            onChange={(e) => setActiveProject(Number(e.target.value))}
            style={{
              width: "100%",
              fontSize: 12,
              padding: "2px 4px",
              background: "var(--bg-sidebar)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 3,
            }}
          >
            {projects.map((p, i) => (
              <option key={p.path} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {visibleEntries.map(({ entry, depth }) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          depth={depth}
          expanded={expandedDirs.has(entry.path)}
          onToggle={toggleDir}
        />
      ))}
    </div>
  );
}
