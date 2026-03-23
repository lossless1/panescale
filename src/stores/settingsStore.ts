import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TerminalSchemeName } from "../lib/terminalSchemes";

export type Language = "en" | "uk" | "de" | "fr" | "es" | "ja" | "zh";

interface SettingsState {
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  colorScheme: TerminalSchemeName;
  launchAtLogin: boolean;
  language: Language;
  notificationsEnabled: boolean;
  completionChimeEnabled: boolean;
  busyThresholdSeconds: number;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setScrollback: (scrollback: number) => void;
  setColorScheme: (scheme: TerminalSchemeName) => void;
  setLaunchAtLogin: (enabled: boolean) => void;
  setLanguage: (lang: Language) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setCompletionChimeEnabled: (enabled: boolean) => void;
  setBusyThresholdSeconds: (seconds: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
      fontSize: 14,
      scrollback: 5000,
      colorScheme: "one-dark" as TerminalSchemeName,
      launchAtLogin: false,
      language: "en" as Language,
      notificationsEnabled: true,
      completionChimeEnabled: true,
      busyThresholdSeconds: 5,

      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setScrollback: (scrollback) => set({ scrollback }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setLaunchAtLogin: (launchAtLogin) => set({ launchAtLogin }),
      setLanguage: (language) => set({ language }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setCompletionChimeEnabled: (completionChimeEnabled) => set({ completionChimeEnabled }),
      setBusyThresholdSeconds: (busyThresholdSeconds) => set({ busyThresholdSeconds }),
    }),
    {
      name: "panescale-settings",
    },
  ),
);
