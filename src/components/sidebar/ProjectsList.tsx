import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../../stores/projectStore";
import { ProjectFileTree } from "./ProjectFileTree";

/**
 * List of all open projects, each as a collapsible section with its own
 * file tree. Replaces the old single-active-project FileTree view.
 */
export function ProjectsList() {
  const projects = useProjectStore((s) => s.projects);
  const activeProject = useProjectStore((s) => s.activeProject());
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const closeProject = useProjectStore((s) => s.closeProject);
  const openProject = useProjectStore((s) => s.openProject);

  // Expanded state per project path — by default expand the active project only.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (activeProject) set.add(activeProject.path);
    return set;
  });

  const toggleExpanded = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      openProject(selected as string);
      setExpanded((prev) => new Set(prev).add(selected as string));
    }
  }, [openProject]);

  if (projects.length === 0) {
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
          No projects open
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

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {projects.map((project, index) => {
        const isExpanded = expanded.has(project.path);
        const isActive = activeProject?.path === project.path;
        return (
          <div key={project.path}>
            {/* Project header row */}
            <div
              onClick={() => {
                toggleExpanded(project.path);
                if (!isActive) setActiveProject(index);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 8px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                userSelect: "none",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                borderRadius: 4,
                margin: "0 4px",
                transition: "background-color 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                const closeBtn = e.currentTarget.querySelector("[data-project-close]") as HTMLElement | null;
                if (closeBtn) closeBtn.style.opacity = "0.6";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                const closeBtn = e.currentTarget.querySelector("[data-project-close]") as HTMLElement | null;
                if (closeBtn) closeBtn.style.opacity = "0";
              }}
            >
              {/* Chevron */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  transition: "transform 0.15s",
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  flexShrink: 0,
                }}
              >
                <path
                  d="M6 4l4 4-4 4"
                  stroke="var(--text-secondary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Active indicator dot */}
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  backgroundColor: isActive ? "var(--accent)" : "transparent",
                  flexShrink: 0,
                }}
              />

              {/* Project name */}
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  fontSize: 11,
                }}
              >
                {project.name}
                {project.isRemote && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 9,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 6,
                      backgroundColor: "var(--accent)",
                      color: "#fff",
                      verticalAlign: "middle",
                    }}
                  >
                    SSH
                  </span>
                )}
              </span>

              {/* Close project button (shown on hover) */}
              <span
                data-project-close
                onClick={(e) => {
                  e.stopPropagation();
                  closeProject(project.path);
                }}
                style={{
                  opacity: 0,
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "0 2px",
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
                title="Close project"
              >
                &#x2715;
              </span>
            </div>

            {/* Project file tree (only when expanded) */}
            {isExpanded && !project.isRemote && (
              <ProjectFileTree projectPath={project.path} baseDepth={1} />
            )}
            {isExpanded && project.isRemote && (
              <div style={{ padding: "4px 24px", fontSize: 11, color: "var(--text-secondary)" }}>
                Select this project to browse remote files
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
