import { ThemeToggle } from "../theme/ThemeToggle";

export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 32,
        backgroundColor: "var(--bg-titlebar)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        userSelect: "none",
        WebkitUserSelect: "none",
        position: "relative",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        paddingLeft: 78,
      }}
    >
      <span
        data-tauri-drag-region
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          color: "var(--text-secondary)",
          fontSize: 12,
          fontWeight: 500,
          pointerEvents: "none",
        }}
      >
        Panescale
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginLeft: "auto",
          marginRight: 8,
        }}
      >
        <ThemeToggle />
      </div>
    </div>
  );
}
