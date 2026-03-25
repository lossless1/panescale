export function StatusBar() {
  return (
    <div
      style={{
        height: 24,
        backgroundColor: "var(--bg-primary)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 12,
        fontSize: 11,
        color: "var(--text-secondary)",
        flexShrink: 0,
        userSelect: "none",
      }}
    />
  );
}
