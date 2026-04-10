import { create } from "zustand";
import {
  workspacesFileSave,
  workspacesFileLoad,
  type Workspace,
  type WorkspaceProject,
  type WorkspacesFile,
  type CanvasSnapshot,
} from "../lib/ipc";
import { useCanvasStore } from "./canvasStore";
import { useProjectStore } from "./projectStore";
import { serializeCanvas, deserializeCanvas } from "../lib/persistence";

interface WorkspacesState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  createWorkspace: (name?: string) => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  persistActiveSnapshot: () => Promise<void>;
}

function emptySnapshot(): CanvasSnapshot {
  return {
    nodes: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    maxZIndex: 0,
  };
}

function makeWorkspace(
  name: string,
  snapshot?: CanvasSnapshot,
  pileOrder?: string[],
  projects?: WorkspaceProject[],
): Workspace {
  return {
    id: crypto.randomUUID(),
    name,
    snapshot: snapshot ?? emptySnapshot(),
    pileOrder: pileOrder ?? [],
    createdAt: Date.now(),
    projects: projects ?? [],
    activeProjectIndex: 0,
  };
}

function restoreProjectsToStore(projects: WorkspaceProject[], activeIndex: number) {
  useProjectStore.setState({
    projects: projects as WorkspaceProject[],
    activeProjectIndex: Math.min(activeIndex, Math.max(0, projects.length - 1)),
  });
}

export const useWorkspacesStore = create<WorkspacesState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await workspacesFileLoad();

      // Fresh install — create default workspace
      if (raw === null) {
        const ws = makeWorkspace("Workspace 1");
        const file: WorkspacesFile = {
          version: 2,
          activeWorkspaceId: ws.id,
          workspaces: [ws],
        };
        await workspacesFileSave(file);
        set({
          workspaces: file.workspaces,
          activeWorkspaceId: file.activeWorkspaceId,
          hydrated: true,
        });
        useCanvasStore.setState({ hydrated: true });
        restoreProjectsToStore([], 0);
        return;
      }

      // Legacy shape (CanvasSnapshot with no `version` field) — migrate
      const maybeFile = raw as Partial<WorkspacesFile> & Partial<CanvasSnapshot>;
      if (maybeFile.version !== 2) {
        const legacy = raw as unknown as CanvasSnapshot;
        const ws = makeWorkspace("Workspace 1", legacy, []);
        const migrated: WorkspacesFile = {
          version: 2,
          activeWorkspaceId: ws.id,
          workspaces: [ws],
        };
        await workspacesFileSave(migrated);
        console.log("[workspaces] migrated legacy canvas-state.json");
        const restored = deserializeCanvas(ws.snapshot);
        set({
          workspaces: migrated.workspaces,
          activeWorkspaceId: migrated.activeWorkspaceId,
          hydrated: true,
        });
        useCanvasStore.setState({
          nodes: restored.nodes,
          viewport: restored.viewport,
          maxZIndex: restored.maxZIndex,
          pileOrder: ws.pileOrder,
          hydrated: true,
        });
        return;
      }

      // Normal path
      const file = raw as WorkspacesFile;
      let active = file.workspaces.find((w) => w.id === file.activeWorkspaceId);
      if (!active && file.workspaces.length > 0) {
        active = file.workspaces[0];
      }
      if (!active) {
        // File existed but had no workspaces — recover
        const ws = makeWorkspace("Workspace 1");
        const recovered: WorkspacesFile = {
          version: 2,
          activeWorkspaceId: ws.id,
          workspaces: [ws],
        };
        await workspacesFileSave(recovered);
        set({
          workspaces: recovered.workspaces,
          activeWorkspaceId: recovered.activeWorkspaceId,
          hydrated: true,
        });
        useCanvasStore.setState({ hydrated: true });
        return;
      }

      const restored = deserializeCanvas(active.snapshot);
      set({
        workspaces: file.workspaces,
        activeWorkspaceId: active.id,
        hydrated: true,
      });
      useCanvasStore.setState({
        nodes: restored.nodes,
        viewport: restored.viewport,
        maxZIndex: restored.maxZIndex,
        pileOrder: active.pileOrder ?? [],
        bellActiveNodes: new Map(),
        hydrated: true,
      });
      restoreProjectsToStore(active.projects ?? [], active.activeProjectIndex ?? 0);
    } catch (err) {
      console.error("[workspaces] hydrate failed:", err);
      // Fallback: mark canvas hydrated so app doesn't hang on loading screen
      useCanvasStore.setState({ hydrated: true });
      set({ hydrated: true });
    }
  },

  persistActiveSnapshot: async () => {
    const { workspaces, activeWorkspaceId } = get();
    if (!activeWorkspaceId) return;
    const canvasState = useCanvasStore.getState();
    const projectState = useProjectStore.getState();
    const snapshot = serializeCanvas(canvasState);
    const nextWorkspaces = workspaces.map((w) =>
      w.id === activeWorkspaceId
        ? {
            ...w,
            snapshot,
            pileOrder: canvasState.pileOrder,
            projects: projectState.projects as WorkspaceProject[],
            activeProjectIndex: projectState.activeProjectIndex,
          }
        : w,
    );
    set({ workspaces: nextWorkspaces });
    const file: WorkspacesFile = {
      version: 2,
      activeWorkspaceId,
      workspaces: nextWorkspaces,
    };
    try {
      await workspacesFileSave(file);
    } catch (err) {
      console.error("[workspaces] persistActiveSnapshot failed:", err);
    }
  },

  createWorkspace: async (name?: string) => {
    await get().persistActiveSnapshot();
    const { workspaces } = get();
    const ws = makeWorkspace(name ?? `Workspace ${workspaces.length + 1}`);
    const nextWorkspaces = [...workspaces, ws];
    set({ workspaces: nextWorkspaces, activeWorkspaceId: ws.id });

    // Reset canvas to empty
    useCanvasStore.setState({
      nodes: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      maxZIndex: 0,
      pileOrder: [],
      bellActiveNodes: new Map(),
    });

    // Reset projects to empty — new workspace starts clean
    restoreProjectsToStore([], 0);

    const file: WorkspacesFile = {
      version: 2,
      activeWorkspaceId: ws.id,
      workspaces: nextWorkspaces,
    };
    try {
      await workspacesFileSave(file);
    } catch (err) {
      console.error("[workspaces] createWorkspace save failed:", err);
    }
  },

  switchWorkspace: async (id: string) => {
    const { activeWorkspaceId, workspaces } = get();
    if (id === activeWorkspaceId) return;
    await get().persistActiveSnapshot();

    const updated = get().workspaces; // refreshed after persistActiveSnapshot
    const target = updated.find((w) => w.id === id);
    if (!target) {
      console.warn(`[workspaces] switchWorkspace: id not found: ${id}`);
      return;
    }

    const restored = deserializeCanvas(target.snapshot);
    useCanvasStore.setState({
      nodes: restored.nodes,
      viewport: restored.viewport,
      maxZIndex: restored.maxZIndex,
      pileOrder: target.pileOrder ?? [],
      bellActiveNodes: new Map(),
    });

    // Restore this workspace's projects into the project store
    restoreProjectsToStore(target.projects ?? [], target.activeProjectIndex ?? 0);

    set({ activeWorkspaceId: id });

    const file: WorkspacesFile = {
      version: 2,
      activeWorkspaceId: id,
      workspaces: updated,
    };
    try {
      await workspacesFileSave(file);
    } catch (err) {
      console.error("[workspaces] switchWorkspace save failed:", err);
    }
    // Silence unused-var warning for the initial snapshot of workspaces
    void workspaces;
  },

  renameWorkspace: async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Update in-memory state first so subscribers see the new name immediately.
    const { workspaces, activeWorkspaceId } = get();
    const nextWorkspaces = workspaces.map((w) =>
      w.id === id ? { ...w, name: trimmed } : w,
    );
    set({ workspaces: nextWorkspaces });
    // Persist via persistActiveSnapshot so current canvas/projects state is
    // merged in atomically, avoiding a race where a concurrent save would
    // overwrite the rename with stale data.
    await get().persistActiveSnapshot();
    // If somehow there's no active workspace, fall back to writing the file directly.
    if (!activeWorkspaceId) {
      try {
        await workspacesFileSave({
          version: 2,
          activeWorkspaceId: nextWorkspaces[0]?.id ?? "",
          workspaces: nextWorkspaces,
        });
      } catch (err) {
        console.error("[workspaces] renameWorkspace fallback save failed:", err);
      }
    }
  },

  deleteWorkspace: async (id: string) => {
    const { workspaces, activeWorkspaceId } = get();
    if (workspaces.length <= 1) return;

    // If deleting active, switch to the first remaining workspace first
    if (id === activeWorkspaceId) {
      const fallback = workspaces.find((w) => w.id !== id);
      if (fallback) {
        await get().switchWorkspace(fallback.id);
      }
    }

    const nextWorkspaces = get().workspaces.filter((w) => w.id !== id);
    const nextActive = get().activeWorkspaceId ?? nextWorkspaces[0]?.id ?? "";
    set({ workspaces: nextWorkspaces, activeWorkspaceId: nextActive });
    const file: WorkspacesFile = {
      version: 2,
      activeWorkspaceId: nextActive,
      workspaces: nextWorkspaces,
    };
    try {
      await workspacesFileSave(file);
    } catch (err) {
      console.error("[workspaces] deleteWorkspace save failed:", err);
    }
  },
}));
