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
    "--bg-primary": "#0d0d0d",
    "--bg-secondary": "#141414",
    "--bg-titlebar": "#0a0a0a",
    "--bg-sidebar": "#111111",
    "--bg-terminal": "#000000",
    "--text-primary": "#e0e0e0",
    "--text-secondary": "#777777",
    "--border": "#222222",
    "--accent": "#6366f1",
    "--focus-glow": "rgba(99, 102, 241, 0.4)",
    "--grid-minor": "#1a1a1a",
    "--grid-major": "#252525",
  },
  light: {
    "--bg-primary": "#ffffff",
    "--bg-secondary": "#f5f5f7",
    "--bg-titlebar": "#e8e8ec",
    "--bg-sidebar": "#f0f0f4",
    "--bg-terminal": "#ffffff",
    "--text-primary": "#1a1a2e",
    "--text-secondary": "#666688",
    "--border": "#d0d0e0",
    "--accent": "#4f46e5",
    "--focus-glow": "rgba(79, 70, 229, 0.3)",
    "--grid-minor": "#e8e8ec",
    "--grid-major": "#d0d0e0",
  },
};
