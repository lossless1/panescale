import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SshConnectionConfig, SshGroup, SshConfigHost } from "../lib/ipc";
import { sshLoadConnections, sshSaveConnections, sshListConfigHosts } from "../lib/ipc";

interface ActiveSession {
  connectionId: string;
  nodeId: string;
}

interface SshState {
  connections: SshConnectionConfig[];
  groups: SshGroup[];
  activeSessions: Record<string, ActiveSession>;
  configHosts: SshConfigHost[];

  // Config hosts
  loadConfigHosts: () => Promise<void>;

  // Connection CRUD
  addConnection: (conn: Omit<SshConnectionConfig, "id"> & { id?: string }) => void;
  updateConnection: (id: string, updates: Partial<SshConnectionConfig>) => void;
  removeConnection: (id: string) => void;
  touchConnection: (id: string) => void;

  // Group management
  addGroup: (name: string) => void;
  removeGroup: (name: string) => void;
  addConnectionToGroup: (groupName: string, connectionId: string) => void;
  removeConnectionFromGroup: (groupName: string, connectionId: string) => void;

  // Active session tracking
  setActiveSession: (sessionId: string, connectionId: string, nodeId: string) => void;
  removeActiveSession: (sessionId: string) => void;

  // Backend sync
  syncFromBackend: () => Promise<void>;
}

function generateId(): string {
  return crypto.randomUUID();
}

/** Save connections to the Rust backend (fire-and-forget). */
function saveToBackend(connections: SshConnectionConfig[]) {
  sshSaveConnections(connections).catch((err) => {
    console.error("Failed to save SSH connections:", err);
  });
}

export const useSshStore = create<SshState>()(
  persist(
    (set) => ({
      connections: [],
      groups: [],
      activeSessions: {},
      configHosts: [],

      addConnection: (conn) => {
        const full: SshConnectionConfig = {
          ...conn,
          id: conn.id || generateId(),
          lastUsedAt: Date.now(),
        };
        set((state) => {
          const next = [...state.connections, full];
          saveToBackend(next);
          return { connections: next };
        });
      },

      updateConnection: (id, updates) => {
        set((state) => {
          const next = state.connections.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          );
          saveToBackend(next);
          return { connections: next };
        });
      },

      removeConnection: (id) => {
        set((state) => {
          const next = state.connections.filter((c) => c.id !== id);
          const groups = state.groups.map((g) => ({
            ...g,
            connectionIds: g.connectionIds.filter((cid) => cid !== id),
          }));
          saveToBackend(next);
          return { connections: next, groups };
        });
      },

      touchConnection: (id) => {
        set((state) => {
          const next = state.connections.map((c) =>
            c.id === id ? { ...c, lastUsedAt: Date.now() } : c,
          );
          saveToBackend(next);
          return { connections: next };
        });
      },

      addGroup: (name) => {
        set((state) => {
          if (state.groups.some((g) => g.name === name)) return state;
          return { groups: [...state.groups, { name, connectionIds: [] }] };
        });
      },

      removeGroup: (name) => {
        set((state) => ({
          groups: state.groups.filter((g) => g.name !== name),
        }));
      },

      addConnectionToGroup: (groupName, connectionId) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.name === groupName && !g.connectionIds.includes(connectionId)
              ? { ...g, connectionIds: [...g.connectionIds, connectionId] }
              : g,
          ),
        }));
      },

      removeConnectionFromGroup: (groupName, connectionId) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.name === groupName
              ? {
                  ...g,
                  connectionIds: g.connectionIds.filter(
                    (cid) => cid !== connectionId,
                  ),
                }
              : g,
          ),
        }));
      },

      setActiveSession: (sessionId, connectionId, nodeId) => {
        set((state) => ({
          activeSessions: {
            ...state.activeSessions,
            [sessionId]: { connectionId, nodeId },
          },
        }));
      },

      removeActiveSession: (sessionId) => {
        set((state) => {
          const { [sessionId]: _, ...rest } = state.activeSessions;
          return { activeSessions: rest };
        });
      },

      loadConfigHosts: async () => {
        try {
          const hosts = await sshListConfigHosts();
          set({ configHosts: hosts });
        } catch (err) {
          console.error("Failed to load SSH config hosts:", err);
          set({ configHosts: [] });
        }
      },

      syncFromBackend: async () => {
        try {
          const loaded = await sshLoadConnections();
          if (loaded && loaded.length > 0) {
            set({ connections: loaded });
          }
        } catch (err) {
          console.error("Failed to load SSH connections from backend:", err);
        }
      },
    }),
    {
      name: "ssh-connections",
      partialize: (state) => ({
        connections: state.connections,
        groups: state.groups,
      }),
    },
  ),
);
