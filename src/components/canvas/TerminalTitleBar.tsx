import React from "react";

interface TerminalTitleBarProps {
  cwd: string;
  shellType: string;
  processTitle?: string;
  onClose: () => void;
  onMinimize?: () => void;
}

function truncateCwd(cwd: string, maxLen = 40): string {
  if (cwd.length <= maxLen) return cwd;
  return "..." + cwd.slice(cwd.length - maxLen + 3);
}

export const TerminalTitleBar = React.memo(function TerminalTitleBar({
  cwd,
  shellType,
  processTitle,
  onClose,
  onMinimize,
}: TerminalTitleBarProps) {
  return (
    <div
      className="drag-handle"
      style={{
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--bg-titlebar)",
        color: "var(--text-secondary)",
        borderBottom: "1px solid var(--border)",
        padding: "0 8px",
        fontSize: 12,
        userSelect: "none",
        cursor: "grab",
        flexShrink: 0,
      }}
    >
      {/* Left: shell type */}
      <span style={{ fontWeight: 600, minWidth: 40 }}>{shellType}</span>

      {/* Center: cwd */}
      <span
        style={{
          flex: 1,
          textAlign: "center",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          margin: "0 8px",
        }}
        title={cwd}
      >
        {processTitle ? (
          <>
            <strong>{processTitle}</strong>
            <span style={{ color: "var(--text-secondary)" }}>{" - "}{truncateCwd(cwd)}</span>
          </>
        ) : (
          truncateCwd(cwd)
        )}
      </span>

      {/* Right: buttons */}
      <div style={{ display: "flex", gap: 4 }}>
        {onMinimize && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 14,
              padding: "0 4px",
              lineHeight: 1,
            }}
            title="Minimize"
          >
            &#x2013;
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 14,
            padding: "0 4px",
            lineHeight: 1,
          }}
          title="Close terminal"
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.color = "var(--text-secondary)";
          }}
        >
          &#x2715;
        </button>
      </div>
    </div>
  );
});
