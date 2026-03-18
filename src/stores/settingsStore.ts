import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TerminalSchemeName } from "../lib/terminalSchemes";

interface SettingsState {
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  colorScheme: TerminalSchemeName;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setScrollback: (scrollback: number) => void;
  setColorScheme: (scheme: TerminalSchemeName) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
      fontSize: 14,
      scrollback: 1000,
      colorScheme: "one-dark" as TerminalSchemeName,

      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setScrollback: (scrollback) => set({ scrollback }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
    }),
    {
      name: "excalicode-settings",
    },
  ),
);
