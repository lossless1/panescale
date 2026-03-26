import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import * as path from "@tauri-apps/api/path";
import { useProjectStore } from "../../stores/projectStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { extensionToTileType } from "../../lib/ipc";
import { SidebarTabs } from "../sidebar/SidebarTabs";
import { FileTree } from "../sidebar/FileTree";
import { ChronologicalFeed } from "../sidebar/ChronologicalFeed";
import { TerminalList } from "../sidebar/TerminalList";
import { FuzzySearch } from "../sidebar/FuzzySearch";
import { GitPanel } from "../sidebar/git/GitPanel";
import { SshQuickConnect } from "../sidebar/SshQuickConnect";
import { RemoteFileTree } from "../sidebar/RemoteFileTree";
import { SettingsModal } from "./SettingsModal";

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 220;
const MAX_WIDTH = 520;

export function Sidebar() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [hoverReveal, setHoverReveal] = useState(false);
  const [activeTab, setActiveTab] = useState<"files" | "terminals" | "git">("files");
  const [sshDropdownOpen, setSshDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sshButtonRef = useRef<HTMLDivElement>(null);
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

  // Open settings from macOS menu bar (Panescale > Preferences)
  useEffect(() => {
    const unlisten = listen("open-settings", () => setSettingsOpen(true));
    return () => { unlisten.then((fn) => fn()); };
  }, []);

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

  // Open a file as a tile on the canvas (used by FuzzySearch and file tree)
  const handleOpenFile = useCallback(async (filePath: string) => {
    const ext = "." + filePath.split(".").pop();
    const tileType = extensionToTileType(ext);
    if (!tileType) return; // Binary file — skip

    const fileName = await path.basename(filePath);
    const viewport = useCanvasStore.getState().viewport;
    const position = {
      x: (-viewport.x + 200) / viewport.zoom,
      y: (-viewport.y + 200) / viewport.zoom,
    };
    useCanvasStore.getState().addContentNode(position, tileType, { path: filePath, name: fileName });
  }, []);

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

  // Detect if window is in fullscreen (no traffic lights)
  // macOS native fullscreen doesn't trigger document.fullscreenElement,
  // so we check window dimensions vs screen dimensions
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const check = () => {
      const fs = !!document.fullscreenElement ||
        (window.innerWidth === screen.width && window.innerHeight === screen.height);
      setIsFullscreen(fs);
    };
    check();
    window.addEventListener("resize", check);
    document.addEventListener("fullscreenchange", check);
    return () => {
      window.removeEventListener("resize", check);
      document.removeEventListener("fullscreenchange", check);
    };
  }, []);

  // When collapsed: fixed toggle icon at window level + thin hover zone
  if (collapsed && !hoverReveal) {
    return (
      <>
        {/* Toggle icon — fixed at window level, near traffic lights or top-left if fullscreen */}
        <button
          onClick={() => setCollapsed(false)}
          title="Show sidebar"
          style={{
            position: "fixed",
            top: isFullscreen ? 6 : 5,
            left: isFullscreen ? 6 : 80,
            zIndex: 9999,
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
            padding: "2px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            opacity: 0.7,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="5.5" y1="2.5" x2="5.5" y2="13.5" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
        {/* Thin hover zone on left edge — hover to reveal floating sidebar */}
        <div
          onMouseEnter={() => setHoverReveal(true)}
          style={{
            width: 8,
            height: "100%",
            backgroundColor: "transparent",
            flexShrink: 0,
          }}
        />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    );
  }

  return (
    <div
      onContextMenu={(e) => {
        if (!(e.target as HTMLElement).closest("[data-custom-context]")) {
          e.preventDefault();
        }
      }}
      onMouseLeave={() => { if (collapsed) setHoverReveal(false); }}
      style={{
        width,
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
        backgroundColor: "var(--bg-sidebar)",
        borderRight: collapsed ? "none" : "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: collapsed ? "absolute" : "relative",
        left: collapsed ? 8 : 0,
        top: collapsed ? 36 : 0,
        bottom: collapsed ? 8 : 0,
        zIndex: collapsed ? 9998 : undefined,
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: collapsed ? 12 : 0,
        border: collapsed ? "1px solid var(--border)" : undefined,
        boxShadow: collapsed ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Sidebar toggle — fixed at window level near traffic lights */}
      <div style={{
        position: "fixed",
        top: isFullscreen ? 6 : 5,
        left: isFullscreen ? 6 : 80,
        zIndex: 9999,
      }}>
        <button
          onClick={() => {
            if (collapsed) {
              // Floating → dock it
              setCollapsed(false);
              setHoverReveal(false);
            } else {
              // Docked → collapse
              setCollapsed(true);
              setHoverReveal(false);
            }
          }}
          title={collapsed ? "Pin sidebar" : "Collapse sidebar"}
          style={{
            background: "none", border: "none", color: "#888",
            cursor: "pointer", padding: "2px", borderRadius: 4, display: "flex",
            alignItems: "center", opacity: 0.7,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="5.5" y1="2.5" x2="5.5" y2="13.5" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
      </div>

      {/* Header — draggable for window movement, padded for macOS traffic lights */}
      <div
        data-tauri-drag-region
        style={{
          padding: "8px 8px 8px 16px",
          paddingTop: collapsed ? 8 : 40,
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
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
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
              minWidth: 300,
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
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "var(--bg-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
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
                      <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                        {p.name}
                        {p.isRemote && (
                          <span style={{
                            fontSize: 9,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 8,
                            backgroundColor: "var(--accent)",
                            color: "#fff",
                            flexShrink: 0,
                          }}>
                            SSH
                          </span>
                        )}
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
        {/* Header actions */}
        <div style={{ display: "flex", gap: 2, flexShrink: 0, alignItems: "center" }}>
          {/* SSH quick connect button */}
          <div style={{ position: "relative" }} ref={sshButtonRef}>
            <button
              onClick={() => setSshDropdownOpen((v) => !v)}
              title="SSH Connections"
              aria-label="SSH Connections"
              aria-expanded={sshDropdownOpen}
              style={{
                background: sshDropdownOpen ? "var(--bg-secondary)" : "none",
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
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)";
              }}
              onMouseLeave={(e) => {
                if (!sshDropdownOpen) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M1.5 8h13M8 1.5c-2 2-2 5 0 6.5s2 4.5 0 6.5M8 1.5c2 2 2 5 0 6.5s-2 4.5 0 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {sshDropdownOpen && (
              <SshQuickConnect onClose={() => setSshDropdownOpen(false)} anchorRef={sshButtonRef} />
            )}
          </div>

          {/* Open folder button */}
          <button
            onClick={handleOpenFolder}
            title="Open Folder"
            aria-label="Open Folder"
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
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <SidebarTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      {activeTab === "files" && (
        <>
          {/* View mode toggle: Tree / Recent */}
          <div style={{
            display: "flex",
            padding: "4px 8px",
            gap: 2,
            flexShrink: 0,
          }}>
            <button
              onClick={() => setViewMode("tree")}
              style={{
                flex: 1,
                padding: "3px 0",
                fontSize: 11,
                fontWeight: viewMode === "tree" ? 500 : 400,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                background: viewMode === "tree" ? "var(--bg-secondary)" : "transparent",
                color: viewMode === "tree" ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode("feed")}
              style={{
                flex: 1,
                padding: "3px 0",
                fontSize: 11,
                fontWeight: viewMode === "feed" ? 500 : 400,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                background: viewMode === "feed" ? "var(--bg-secondary)" : "transparent",
                color: viewMode === "feed" ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              Recent
            </button>
          </div>
          {viewMode === "tree" ? (
            activeProject?.isRemote ? <RemoteFileTree /> : <FileTree />
          ) : <ChronologicalFeed />}
        </>
      )}
      {activeTab === "terminals" && <TerminalList />}
      {activeTab === "git" && <GitPanel />}

      {/* Fuzzy search overlay (manages own visibility via Cmd+K) */}
      <FuzzySearch onNavigateToFile={handleOpenFile} />

      {/* Bottom bar: Settings + Collapse */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border)",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <button
          onClick={() => setSettingsOpen(true)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            fontSize: 12,
            color: "var(--text-secondary)",
            background: "none",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M13.5 8a5.5 5.5 0 01-.4 2.1l1.2 1.2a.5.5 0 010 .7l-1 1a.5.5 0 01-.7 0l-1.2-1.2A5.5 5.5 0 018 13.5a5.5 5.5 0 01-2.1-.4L4.7 14.3a.5.5 0 01-.7 0l-1-1a.5.5 0 010-.7l1.2-1.2A5.5 5.5 0 012.5 8c0-.7.1-1.4.4-2.1L1.7 4.7a.5.5 0 010-.7l1-1a.5.5 0 01.7 0l1.2 1.2A5.5 5.5 0 018 2.5c.7 0 1.4.1 2.1.4l1.2-1.2a.5.5 0 01.7 0l1 1a.5.5 0 010 .7l-1.2 1.2c.3.7.4 1.4.4 2.1z" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
          Settings
        </button>
      </div>

      {/* Settings modal */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

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
