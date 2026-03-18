import { useCanvasStore } from "../../stores/canvasStore";

/** Truncate a path to its last 2 segments for display. */
function truncateCwd(cwd: string): string {
  const parts = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  if (parts.length <= 2) return cwd;
  return ".../" + parts.slice(-2).join("/");
}

const bellPulseKeyframes = `
@keyframes bell-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

export function TerminalList() {
  const nodes = useCanvasStore((s) => s.nodes);
  const setPanToNode = useCanvasStore((s) => s.setPanToNode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const bellActiveNodes = useCanvasStore((s) => s.bellActiveNodes);
  const setBellActive = useCanvasStore((s) => s.setBellActive);

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
      <style>{bellPulseKeyframes}</style>
      {terminalNodes.map((node) => {
        const nodeData = node.data as Record<string, unknown>;
        const label = nodeData.label as string | undefined;
        const customName = nodeData.customName as string | undefined;
        const badgeColor = nodeData.badgeColor as string | undefined;
        const cwd = (nodeData.cwd as string) ?? "~";
        const displayName = customName || label || `Terminal ${node.id.slice(0, 6)}`;
        const isBellActive = bellActiveNodes.has(node.id);

        return (
          <div
            key={node.id}
            onClick={() => {
              if (isBellActive) {
                setBellActive(node.id, false);
              }
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
              ...(isBellActive
                ? {
                    animation: "bell-pulse 1s ease-in-out infinite",
                    backgroundColor: badgeColor
                      ? `${badgeColor}26`
                      : "rgba(99, 102, 241, 0.15)",
                  }
                : {}),
            }}
            onMouseEnter={(e) => {
              if (!isBellActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--bg-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isBellActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
              }
            }}
          >
            {/* Badge color dot */}
            {badgeColor && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: badgeColor,
                  flexShrink: 0,
                }}
              />
            )}

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
