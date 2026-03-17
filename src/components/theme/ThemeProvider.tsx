import { useEffect, type ReactNode } from "react";
import { useThemeStore } from "../../stores/themeStore";
import { themes } from "../../styles/themes";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const vars = themes[theme];
    const root = document.documentElement;
    for (const [prop, value] of Object.entries(vars)) {
      root.style.setProperty(prop, value);
    }
  }, [theme]);

  return <>{children}</>;
}
