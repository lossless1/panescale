import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../../stores/projectStore";
import { SidebarTabs } from "../sidebar/SidebarTabs";
import { FileTree } from "../sidebar/FileTree";
import { ChronologicalFeed } from "../sidebar/ChronologicalFeed";
import { TerminalList } from "../sidebar/TerminalList";
import { FuzzySearch } from "../sidebar/FuzzySearch";
import { GitPanel } from "../sidebar/git/GitPanel";
import { SshPanel } from "../sidebar/SshPanel";

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;

export function Sidebar() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [activeTab, setActiveTab] = useState<"files" | "terminals" | "git" | "ssh">("files");
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const activeProject = useProjectStore((s) => s.activeProject());
  const projects = useProjectStore((s) => s.projects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const closeProject = useProjectStore((s) => s.closeProject);
  const viewMode = useProjectStore((s) => s.viewMode);
  const setViewMode = useProjectStore((s) => s.setViewMode);
  const openProject = useProjectStore((s) => s.openProject);
  const [showProjects, setShowProjects] = useState(false);
  const projectsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProjects) return;
    const close = (e: MouseEvent) => {
      if (projectsRef.current && !projectsRef.current.contains(e.target as Node)) {
        setShowProjects(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showProjects]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    const newWidth = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, startWidth.current + delta),
    );
    setWidth(newWidth);
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      openProject(selected);
    }
  }, [openProject]);

  return (
    <div
      onContextMenu={(e) => {
        // Prevent default browser context menu unless a child handles it
        if (!(e.target as HTMLElement).closest("[data-custom-context]")) {
          e.preventDefault();
        }
      }}
      style={{
        width,
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        flexShrink: 0,
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 8px 8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ position: "relative" }} ref={projectsRef}>
          <button
            onClick={() => setShowProjects((v) => !v)}
            style={{
              background: "none",
              border: "none",
              padding: "4px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 4,
              color: "var(--text-primary)",
              maxWidth: 180,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {/* Folder icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
              <path d="M2 4h4l1.5 1.5H14v7.5H2V4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {activeProject ? activeProject.name : "Open Folder"}
            </span>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
              <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {showProjects && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              minWidth: 220,
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              padding: 4,
              zIndex: 9999,
            }}>
              {projects.map((p, i) => {
                const isActive = activeProject?.path === p.path;
                return (
                  <button
                    key={p.path}
                    onClick={() => { setActiveProject(i); setShowProjects(false); }}
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
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Active dot */}
                    <span style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      backgroundColor: isActive ? "var(--accent)" : "transparent",
                      flexShrink: 0,
                    }} />
                    <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.path}
                      </div>
                    </div>
                    {projects.length > 1 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); closeProject(p.path); if (projects.length <= 1) setShowProjects(false); }}
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
                        title="Close project"
                      >
                        &#x2715;
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Divider */}
              <div style={{ height: 1, backgroundColor: "var(--border)", margin: "4px 8px" }} />

              {/* Open folder */}
              <button
                onClick={() => { handleOpenFolder(); setShowProjects(false); }}
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
                Open Folder
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {/* View mode toggle */}
          <button
            onClick={() =>
              setViewMode(viewMode === "tree" ? "feed" : "tree")
            }
            title={
              viewMode === "tree" ? "Chronological feed" : "Tree view"
            }
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              borderRadius: 3,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent";
            }}
          >
            {viewMode === "tree" ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 4.5V8.5L10.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 3h4l1.5 1.5H14v8.5H2V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          {/* Open folder button */}
          <button
            onClick={handleOpenFolder}
            title="Open Folder"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              borderRadius: 3,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <SidebarTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      {activeTab === "files" && viewMode === "tree" && <FileTree />}
      {activeTab === "files" && viewMode === "feed" && <ChronologicalFeed />}
      {activeTab === "terminals" && <TerminalList />}
      {activeTab === "git" && <GitPanel />}
      {activeTab === "ssh" && <SshPanel />}

      {/* Fuzzy search overlay (manages own visibility via Cmd+K) */}
      <FuzzySearch />

      {/* Resize handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "absolute",
          top: 0,
          right: -3,
          bottom: 0,
          width: 6,
          cursor: "col-resize",
          zIndex: 10,
        }}
      />
    </div>
  );
}
