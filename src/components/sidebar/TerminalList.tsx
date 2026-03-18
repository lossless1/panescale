import { useCanvasStore } from "../../stores/canvasStore";

/** Truncate a path to its last 2 segments for display. */
function truncateCwd(cwd: string): string {
  const parts = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  if (parts.length <= 2) return cwd;
  return ".../" + parts.slice(-2).join("/");
}

export function TerminalList() {
  const nodes = useCanvasStore((s) => s.nodes);
  const setPanToNode = useCanvasStore((s) => s.setPanToNode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);

  const terminalNodes = nodes.filter((n) => n.type === "terminal");

  if (terminalNodes.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        No terminals
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {terminalNodes.map((node) => {
        const label =
          (node.data as Record<string, unknown>).label as string | undefined;
        const cwd =
          ((node.data as Record<string, unknown>).cwd as string) ?? "~";
        const displayName = label || `Terminal ${node.id.slice(0, 6)}`;

        return (
          <div
            key={node.id}
            onClick={() => {
              setPanToNode(node.id);
              bringToFront(node.id);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent";
            }}
          >
            {/* Terminal icon */}
            <span
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                flexShrink: 0,
                width: 18,
                textAlign: "center",
              }}
            >
              {">_"}
            </span>

            <div style={{ overflow: "hidden", flex: 1 }}>
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--text-primary)",
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {truncateCwd(cwd)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
