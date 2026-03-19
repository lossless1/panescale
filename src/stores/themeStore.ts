import { create } from "zustand";
import type { ResolvedTheme } from "../styles/themes";
import { defaultSchemeForTheme } from "../lib/terminalSchemes";

export type ThemePreference = "system" | "dark" | "light";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? getSystemTheme() : pref;
}

function loadPersistedPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem("panescale-theme-pref");
    if (stored === "system" || stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    // localStorage may not be available
  }
  return "system";
}

function persistPreference(pref: ThemePreference): void {
  try {
    localStorage.setItem("panescale-theme-pref", pref);
  } catch {
    // ignore
  }
}

interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  /** @deprecated Use resolvedTheme instead */
  theme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  /** @deprecated Use setPreference instead */
  toggleTheme: () => void;
  /** @deprecated Use setPreference instead */
  setTheme: (t: ResolvedTheme) => void;
}

const initialPreference = loadPersistedPreference();
const initialResolved = resolveTheme(initialPreference);

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  resolvedTheme: initialResolved,
  theme: initialResolved, // backward-compat alias

  setPreference: (pref: ThemePreference) => {
    persistPreference(pref);
    const resolved = resolveTheme(pref);
    set({ preference: pref, resolvedTheme: resolved, theme: resolved });
  },

  // Backward compatibility -- cycles System -> Dark -> Light -> System
  toggleTheme: () => {
    const { preference } = get();
    const next: ThemePreference =
      preference === "system"
        ? "dark"
        : preference === "dark"
          ? "light"
          : "system";
    get().setPreference(next);
  },

  setTheme: (t: ResolvedTheme) => {
    get().setPreference(t);
  },
}));

// Listen for system theme changes and update resolvedTheme when preference is "system"
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
mediaQuery.addEventListener("change", () => {
  const { preference } = useThemeStore.getState();
  if (preference === "system") {
    const resolved = getSystemTheme();
    useThemeStore.setState({ resolvedTheme: resolved, theme: resolved });
  }
});

// Auto-switch terminal color scheme when app theme changes
useThemeStore.subscribe((state, prevState) => {
  if (state.resolvedTheme !== prevState.resolvedTheme) {
    // Lazy import to avoid circular dependency
    import("./settingsStore").then(({ useSettingsStore }) => {
      useSettingsStore.getState().setColorScheme(defaultSchemeForTheme(state.resolvedTheme));
    });
  }
});
