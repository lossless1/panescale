import { create } from "zustand";

interface SettingsState {
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setScrollback: (scrollback: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
  fontSize: 14,
  scrollback: 1000,

  setFontFamily: (fontFamily) => set({ fontFamily }),
  setFontSize: (fontSize) => set({ fontSize }),
  setScrollback: (scrollback) => set({ scrollback }),
}));
