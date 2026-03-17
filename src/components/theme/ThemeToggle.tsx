import { useThemeStore } from "../../stores/themeStore";

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      style={{
        background: "none",
        border: "none",
        color: "var(--text-secondary)",
        cursor: "pointer",
        padding: "2px 8px",
        fontSize: "14px",
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
      }}
    >
      {theme === "dark" ? "\u2600" : "\u263D"}
    </button>
  );
}
