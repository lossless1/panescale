import { create } from "zustand";
import {
  gitIsRepo,
  gitStatus,
  gitBranches,
  gitLog,
  gitStashList,
  gitConflicts,
} from "../lib/ipc";
import type {
  GitStatusEntry,
  GitBranch,
  GitCommitInfo,
  GitStashEntry,
  GitConflictEntry,
} from "../lib/ipc";

interface GitState {
  isRepo: boolean;
  entries: GitStatusEntry[];
  branches: GitBranch[];
  currentBranch: string;
  commitLog: GitCommitInfo[];
  stashes: GitStashEntry[];
  conflicts: GitConflictEntry[];
  loading: boolean;
  error: string | null;
  refresh: (repoPath: string) => Promise<void>;
  refreshBranches: (repoPath: string) => Promise<void>;
  refreshLog: (repoPath: string) => Promise<void>;
  refreshStashes: (repoPath: string) => Promise<void>;
  refreshConflicts: (repoPath: string) => Promise<void>;
}

export const useGitStore = create<GitState>()((set) => ({
  isRepo: false,
  entries: [],
  branches: [],
  currentBranch: "",
  commitLog: [],
  stashes: [],
  conflicts: [],
  loading: false,
  error: null,

  refresh: async (repoPath: string) => {
    set({ loading: true, error: null });
    try {
      const isRepo = await gitIsRepo(repoPath);
      if (!isRepo) {
        set({ isRepo: false, entries: [], loading: false });
        return;
      }
      const entries = await gitStatus(repoPath);
      set({ isRepo: true, entries, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  refreshBranches: async (repoPath: string) => {
    try {
      const branches = await gitBranches(repoPath);
      const current = branches.find((b) => b.is_current);
      set({
        branches,
        currentBranch: current?.name ?? "",
      });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  refreshLog: async (repoPath: string) => {
    try {
      const commitLog = await gitLog(repoPath, 50, 0);
      set({ commitLog });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  refreshStashes: async (repoPath: string) => {
    try {
      const stashes = await gitStashList(repoPath);
      set({ stashes });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  refreshConflicts: async (repoPath: string) => {
    try {
      const conflicts = await gitConflicts(repoPath);
      set({ conflicts });
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));
