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
  const [projectDropdown, setProjectDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectDropdown) return;
    function close(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdown(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [projectDropdown]);

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
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            onClick={() => setProjectDropdown((v) => !v)}
            style={{
              background: "none",
              border: "none",
              padding: "2px 4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-primary)",
              maxWidth: 160,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeProject ? activeProject.name : "NO PROJECT"}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
              <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {projectDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 4,
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                padding: "4px 0",
                minWidth: 200,
                zIndex: 9999,
              }}
            >
              {projects.map((p, i) => (
                <div
                  key={p.path}
                  onClick={() => { setActiveProject(i); setProjectDropdown(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                    color: activeProject?.path === p.path ? "var(--accent)" : "var(--text-primary)",
                    fontWeight: activeProject?.path === p.path ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = activeProject?.path === p.path ? "var(--accent)" : "var(--text-primary)"; }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontSize: 10, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.path}</div>
                  </div>
                  {projects.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); closeProject(p.path); if (projects.length <= 1) setProjectDropdown(false); }}
                      style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "0 4px", fontSize: 14, opacity: 0.5 }}
                      title="Close project"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              <div style={{ height: 1, backgroundColor: "var(--border)", margin: "4px 8px" }} />
              <div
                onClick={() => { handleOpenFolder(); setProjectDropdown(false); }}
                style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
              >
                Open Folder...
              </div>
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
