import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useFocusModeStore } from "../../hooks/useFocusMode";
import { useCanvasStore } from "../../stores/canvasStore";
import { useProjectStore } from "../../stores/projectStore";
import { GitPanel } from "../sidebar/git/GitPanel";

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 240;
const MAX_WIDTH = 520;

export function RightSidebar() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("right-sidebar-collapsed") === "true");
  const [hoverReveal, setHoverReveal] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Detect git repo path from focused terminal's cwd, fall back to active project
  const activeTerminalId = useFocusModeStore((s) => s.activeTerminalId);
  const activeProject = useProjectStore((s) => s.activeProject());

  // Use a selector that only extracts the cwd string, avoiding re-renders from unrelated node changes
  const terminalCwd = useCanvasStore((s) => {
    if (!activeTerminalId) return null;
    const node = s.nodes.find((n) => n.id === activeTerminalId);
    if (!node) return null;
    return ((node.data as Record<string, unknown>).cwd as string) ?? null;
  });

  const gitRepoPath = useMemo(() => {
    return terminalCwd || activeProject?.path || null;
  }, [terminalCwd, activeProject?.path]);

  // Debug: log why RightSidebar re-renders
  const renderCount = useRef(0);
  const prevState = useRef({ activeTerminalId, terminalCwd, gitRepoPath, collapsed, hoverReveal, width });
  useEffect(() => {
    renderCount.current++;
    const prev = prevState.current;
    const changes: string[] = [];
    if (prev.activeTerminalId !== activeTerminalId) changes.push(`activeTerminalId: ${prev.activeTerminalId} → ${activeTerminalId}`);
    if (prev.terminalCwd !== terminalCwd) changes.push(`terminalCwd: ${prev.terminalCwd} → ${terminalCwd}`);
    if (prev.gitRepoPath !== gitRepoPath) changes.push(`gitRepoPath: ${prev.gitRepoPath} → ${gitRepoPath}`);
    if (prev.collapsed !== collapsed) changes.push(`collapsed: ${prev.collapsed} → ${collapsed}`);
    if (prev.hoverReveal !== hoverReveal) changes.push(`hoverReveal: ${prev.hoverReveal} → ${hoverReveal}`);
    if (prev.width !== width) changes.push(`width: ${prev.width} → ${width}`);
    if (changes.length > 0) {
      console.log(`[RightSidebar] render #${renderCount.current}:`, changes.join(", "));
    } else {
      console.log(`[RightSidebar] render #${renderCount.current}: no tracked state changed (parent re-render)`);
    }
    prevState.current = { activeTerminalId, terminalCwd, gitRepoPath, collapsed, hoverReveal, width };
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("right-sidebar-collapsed", String(next));
      setHoverReveal(false);
      return next;
    });
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
    const delta = startX.current - e.clientX; // reversed for right side
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
    setWidth(newWidth);
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Detect fullscreen
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

  // Collapsed: show toggle button + thin hover zone on right edge
  if (collapsed && !hoverReveal) {
    return (
      <>
        {/* Toggle icon — fixed at top-right */}
        <button
          onClick={toggleCollapsed}
          title="Show git panel"
          style={{
            position: "fixed",
            top: isFullscreen ? 6 : 5,
            right: 8,
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
            <line x1="10.5" y1="2.5" x2="10.5" y2="13.5" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
        {/* Thin hover zone on right edge */}
        <div
          onMouseEnter={() => setHoverReveal(true)}
          style={{
            width: 8,
            height: "100%",
            backgroundColor: "transparent",
            flexShrink: 0,
          }}
        />
      </>
    );
  }

  return (
    <div
      onMouseLeave={() => { if (collapsed) setHoverReveal(false); }}
      style={{
        width,
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
        backgroundColor: "var(--bg-sidebar)",
        borderLeft: collapsed ? "none" : "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: collapsed ? "absolute" : "relative",
        right: collapsed ? 8 : 0,
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
      {/* Toggle button — fixed at top-right */}
      <div style={{
        position: "fixed",
        top: isFullscreen ? 6 : 5,
        right: 8,
        zIndex: 9999,
      }}>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Pin git panel" : "Collapse git panel"}
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
            <line x1="10.5" y1="2.5" x2="10.5" y2="13.5" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
      </div>

      {/* Header */}
      <div
        data-tauri-drag-region
        style={{
          padding: "8px 12px",
          paddingTop: collapsed ? 8 : 14,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          Git
        </span>
        {gitRepoPath && (
          <span style={{
            fontSize: 10,
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}>
            {gitRepoPath.replace(/[\\/]+$/, "").split(/[\\/]/).pop()}
          </span>
        )}
      </div>

      {/* Git content */}
      {gitRepoPath ? (
        <GitPanel overrideRepoPath={gitRepoPath} />
      ) : (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center" }}>
            Click a terminal to show its git status
          </span>
        </div>
      )}

      {/* Resize handle — left edge */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "absolute",
          top: 0,
          left: -3,
          bottom: 0,
          width: 6,
          cursor: "col-resize",
          zIndex: 10,
        }}
      />
    </div>
  );
}
