import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Project {
  path: string;
  name: string;
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
    }),
    {
      name: "excalicode-projects",
      partialize: (state) => ({
        projects: state.projects,
        activeProjectIndex: state.activeProjectIndex,
        viewMode: state.viewMode,
      }),
    },
  ),
);
