import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Project {
  path: string;
  name: string;
  isRemote?: boolean;
  sshSessionId?: string;
  sshHost?: string;
}

interface ProjectState {
  projects: Project[];
  activeProjectIndex: number;
  viewMode: "tree" | "feed";
  openProject: (path: string) => void;
  closeProject: (path: string) => void;
  setActiveProject: (index: number) => void;
  setViewMode: (mode: "tree" | "feed") => void;
  activeProject: () => Project | null;
  openRemoteProject: (remotePath: string, sshSessionId: string, sshHost: string) => void;
  reorderProjects: (fromPath: string, toPath: string) => void;
}

function basename(path: string): string {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectIndex: 0,
      viewMode: "tree",

      openProject: (path: string) => {
        const { projects } = get();
        const existingIndex = projects.findIndex((p) => p.path === path);
        if (existingIndex >= 0) {
          set({ activeProjectIndex: existingIndex });
          return;
        }
        const newProject: Project = { path, name: basename(path) };
        set({
          projects: [...projects, newProject],
          activeProjectIndex: projects.length,
        });
      },

      openRemoteProject: (remotePath: string, sshSessionId: string, sshHost: string) => {
        const { projects } = get();
        const displayPath = `${sshHost}:${remotePath}`;
        const existingIndex = projects.findIndex((p) => p.path === displayPath);
        if (existingIndex >= 0) {
          // Update the sshSessionId in case of reconnection, then activate
          const updated = [...projects];
          updated[existingIndex] = { ...updated[existingIndex], sshSessionId };
          set({ projects: updated, activeProjectIndex: existingIndex });
          return;
        }
        const newProject: Project = {
          path: displayPath,
          name: basename(remotePath),
          isRemote: true,
          sshSessionId,
          sshHost,
        };
        set({
          projects: [...projects, newProject],
          activeProjectIndex: projects.length,
        });
      },

      closeProject: (path: string) => {
        const { projects, activeProjectIndex } = get();
        const index = projects.findIndex((p) => p.path === path);
        if (index < 0) return;
        const newProjects = projects.filter((_, i) => i !== index);
        let newIndex = activeProjectIndex;
        if (index < activeProjectIndex) {
          newIndex = activeProjectIndex - 1;
        } else if (index === activeProjectIndex) {
          newIndex = Math.min(activeProjectIndex, newProjects.length - 1);
        }
        set({
          projects: newProjects,
          activeProjectIndex: Math.max(0, newIndex),
        });
      },

      setActiveProject: (index: number) => {
        set({ activeProjectIndex: index });
      },

      setViewMode: (mode: "tree" | "feed") => {
        set({ viewMode: mode });
      },

      activeProject: () => {
        const { projects, activeProjectIndex } = get();
        return projects[activeProjectIndex] ?? null;
      },

      reorderProjects: (fromPath: string, toPath: string) => {
        const { projects, activeProjectIndex } = get();
        const fromIdx = projects.findIndex((p) => p.path === fromPath);
        const toIdx = projects.findIndex((p) => p.path === toPath);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
        const next = [...projects];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        // Keep the active project pointing at the same project after reorder
        const activePath = projects[activeProjectIndex]?.path;
        const newActiveIndex = activePath
          ? next.findIndex((p) => p.path === activePath)
          : activeProjectIndex;
        set({ projects: next, activeProjectIndex: Math.max(0, newActiveIndex) });
      },
    }),
    {
      name: "panescale-projects",
      partialize: (state) => ({
        projects: state.projects,
        activeProjectIndex: state.activeProjectIndex,
        viewMode: state.viewMode,
      }),
    },
  ),
);
