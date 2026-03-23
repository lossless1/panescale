import React, { useState, useRef, useEffect, useCallback } from "react";

const BADGE_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

interface TerminalTitleBarProps {
  cwd: string;
  shellType: string;
  processTitle?: string;
  customName?: string;
  badgeColor?: string;
  sshHost?: string;
  sshUser?: string;
  onClose: () => void;
  onDuplicate?: () => void;
  onMinimize?: () => void;
  onRename?: (name: string) => void;
  onBadgeColorChange?: (color: string | undefined) => void;
}

function truncateCwd(cwd: string, maxLen = 40): string {
  if (cwd.length <= maxLen) return cwd;
  return "..." + cwd.slice(cwd.length - maxLen + 3);
}

export const TerminalTitleBar = React.memo(function TerminalTitleBar({
  cwd,
  shellType,
  processTitle,
  customName,
  badgeColor,
  sshHost,
  sshUser,
  onClose,
  onDuplicate,
  onMinimize,
  onRename,
  onBadgeColorChange,
}: TerminalTitleBarProps) {
  const isSsh = !!sshHost;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close color picker on click outside or Escape
  useEffect(() => {
    if (!showColorPicker) return;

    const handleClick = (e: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target as HTMLElement)
      ) {
        setShowColorPicker(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowColorPicker(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showColorPicker]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    onRename?.(trimmed);
    setEditing(false);
  }, [editValue, onRename]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(customName || "");
      setEditing(true);
    },
    [customName],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onBadgeColorChange) {
        setShowColorPicker(true);
      }
    },
    [onBadgeColorChange],
  );

  const sshLabel = isSsh ? `${sshUser ?? "user"}@${sshHost}` : "";
  const displayText = customName
    ? customName
    : isSsh
      ? sshLabel
      : processTitle
        ? processTitle
        : truncateCwd(cwd);

  const titleHint = customName
    ? isSsh ? `${customName} - ${sshLabel}` : `${customName} - ${cwd}`
    : isSsh ? sshLabel : cwd;

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
        position: "relative",
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Left: SSH badge / badge color dot + shell type */}
      <span style={{ fontWeight: 600, minWidth: 40, display: "flex", alignItems: "center", gap: 4 }}>
        {isSsh && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#fff",
              backgroundColor: "#06b6d4",
              borderRadius: 3,
              padding: "1px 4px",
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}
          >
            SSH
          </span>
        )}
        {badgeColor && !isSsh && (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: badgeColor,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
        )}
        {shellType}
      </span>

      {/* Center: custom name or cwd (double-click to edit) */}
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          className="nodrag nowheel nopan"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              commitRename();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          onBlur={commitRename}
          style={{
            flex: 1,
            textAlign: "center",
            background: "transparent",
            color: "var(--text-primary)",
            border: "none",
            borderBottom: "1px solid var(--accent)",
            outline: "none",
            fontSize: 12,
            fontFamily: "inherit",
            margin: "0 8px",
            padding: 0,
          }}
        />
      ) : (
        <span
          onDoubleClick={handleDoubleClick}
          style={{
            flex: 1,
            textAlign: "center",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            margin: "0 8px",
            cursor: "text",
          }}
          title={titleHint}
        >
          {customName ? (
            <strong>{displayText}</strong>
          ) : processTitle ? (
            <>
              <strong>{processTitle}</strong>
              <span style={{ color: "var(--text-secondary)" }}>
                {" - "}
                {truncateCwd(cwd)}
              </span>
            </>
          ) : (
            displayText
          )}
        </span>
      )}

      {/* Right: buttons */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {onDuplicate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 15,
              padding: "0 4px",
              lineHeight: 1,
            }}
            title="Duplicate terminal"
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "var(--text-secondary)";
            }}
          >
            &#x2398;
          </button>
        )}
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

      {/* Badge color picker dropdown */}
      {showColorPicker && (
        <div
          ref={colorPickerRef}
          className="nodrag nowheel nopan"
          style={{
            position: "absolute",
            top: 34,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 8px",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 100,
          }}
        >
          {BADGE_COLORS.map((color) => (
            <button
              key={color}
              onClick={(e) => {
                e.stopPropagation();
                onBadgeColorChange?.(color);
                setShowColorPicker(false);
              }}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: color,
                border:
                  badgeColor === color
                    ? "2px solid var(--text-primary)"
                    : "2px solid transparent",
                cursor: "pointer",
                padding: 0,
              }}
              title={color}
            />
          ))}
          {/* Clear button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBadgeColorChange?.(undefined);
              setShowColorPicker(false);
            }}
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              color: "var(--text-secondary)",
              lineHeight: 1,
            }}
            title="Clear badge color"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
});
