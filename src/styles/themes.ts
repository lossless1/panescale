/**
 * Theme definitions for Panescale.
 * Each theme is a map of CSS custom property names to values.
 */

export type ResolvedTheme = "dark" | "light";

/** @deprecated Use ResolvedTheme instead */
export type ThemeName = ResolvedTheme;

export type ThemeVariables = Record<string, string>;

export const themes: Record<ResolvedTheme, ThemeVariables> = {
  dark: {
    "--bg-primary": "#1a1a2e",
    "--bg-secondary": "#16213e",
    "--bg-titlebar": "#0f0f23",
    "--bg-sidebar": "#12122a",
    "--bg-terminal": "#0d0d1a",
    "--text-primary": "#e0e0e0",
    "--text-secondary": "#8888aa",
    "--border": "#2a2a4a",
    "--accent": "#6366f1",
    "--focus-glow": "rgba(99, 102, 241, 0.4)",
    "--grid-minor": "#1f1f3a",
    "--grid-major": "#2a2a4a",
  },
  light: {
    "--bg-primary": "#ffffff",
    "--bg-secondary": "#f5f5f7",
    "--bg-titlebar": "#e8e8ec",
    "--bg-sidebar": "#f0f0f4",
    "--bg-terminal": "#1e1e2e", // terminal stays dark
    "--text-primary": "#1a1a2e",
    "--text-secondary": "#666688",
    "--border": "#d0d0e0",
    "--accent": "#4f46e5",
    "--focus-glow": "rgba(79, 70, 229, 0.3)",
    "--grid-minor": "#e8e8ec",
    "--grid-major": "#d0d0e0",
  },
};
