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
    "--bg-primary": "#0c0b0f",
    "--bg-secondary": "#16141c",
    "--bg-titlebar": "#0a090d",
    "--bg-sidebar": "#110f16",
    "--bg-terminal": "#000000",
    "--text-primary": "#e2dff0",
    "--text-secondary": "#7a7490",
    "--border": "#251f35",
    "--accent": "#8b7cf6",
    "--accent-hover": "#9d90f8",
    "--focus-glow": "rgba(139, 124, 246, 0.35)",
    "--grid-minor": "#1a1720",
    "--grid-major": "#252030",
  },
  light: {
    "--bg-primary": "#fefeff",
    "--bg-secondary": "#f5f3fa",
    "--bg-titlebar": "#eae7f2",
    "--bg-sidebar": "#f0eef6",
    "--bg-terminal": "#ffffff",
    "--text-primary": "#1a1630",
    "--text-secondary": "#6b6488",
    "--border": "#d4cfe5",
    "--accent": "#7c6ce0",
    "--accent-hover": "#6b59d4",
    "--focus-glow": "rgba(124, 108, 224, 0.3)",
    "--grid-minor": "#eae7f2",
    "--grid-major": "#d4cfe5",
  },
};
