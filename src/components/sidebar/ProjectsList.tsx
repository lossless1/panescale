import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProjectStore } from "../../stores/projectStore";
import { ProjectFileTree } from "./ProjectFileTree";

interface Project {
  path: string;
  name: string;
  isRemote?: boolean;
}

interface SortableProjectRowProps {
  project: Project;
  index: number;
  isActive: boolean;
  isExpanded: boolean;
  onToggleExpanded: (path: string) => void;
  onSetActive: (index: number) => void;
  onClose: (path: string) => void;
}

function SortableProjectRow({
  project,
  index,
  isActive,
  isExpanded,
  onToggleExpanded,
  onSetActive,
  onClose,
}: SortableProjectRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.path });

  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={rowStyle}>
      {/* Project header row */}
      <div
        onClick={() => {
          onToggleExpanded(project.path);
          if (!isActive) onSetActive(index);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 8px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "grab",
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
        {...attributes}
        {...listeners}
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
            onClose(project.path);
          }}
          // Suppress dnd-kit drag when interacting with close button
          onPointerDown={(e) => e.stopPropagation()}
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
}

/**
 * List of all open projects, each as a collapsible section with its own
 * file tree. Supports drag-and-drop reordering.
 */
export function ProjectsList() {
  const projects = useProjectStore((s) => s.projects);
  const activeProject = useProjectStore((s) => s.activeProject());
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const closeProject = useProjectStore((s) => s.closeProject);
  const openProject = useProjectStore((s) => s.openProject);
  const reorderProjects = useProjectStore((s) => s.reorderProjects);

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

  // Require 5px drag distance before starting a drag so clicks still toggle expansion
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const restrictToVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      reorderProjects(active.id as string, over.id as string);
    },
    [reorderProjects],
  );

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVertical]}
      >
        <SortableContext
          items={projects.map((p) => p.path)}
          strategy={verticalListSortingStrategy}
        >
          {projects.map((project, index) => (
            <SortableProjectRow
              key={project.path}
              project={project}
              index={index}
              isActive={activeProject?.path === project.path}
              isExpanded={expanded.has(project.path)}
              onToggleExpanded={toggleExpanded}
              onSetActive={setActiveProject}
              onClose={closeProject}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
