import { create } from "zustand";
import type { ThemeName } from "../styles/themes";

interface ThemeState {
  theme: ThemeName;
  toggleTheme: () => void;
  setTheme: (theme: ThemeName) => void;
}

function loadPersistedTheme(): ThemeName {
  try {
    const stored = localStorage.getItem("excalicode-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage may not be available
  }
  return "dark";
}

function persistTheme(theme: ThemeName): void {
  try {
    localStorage.setItem("excalicode-theme", theme);
  } catch {
    // ignore
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadPersistedTheme(),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      persistTheme(next);
      return { theme: next };
    }),
  setTheme: (theme: ThemeName) => {
    persistTheme(theme);
    set({ theme });
  },
}));
