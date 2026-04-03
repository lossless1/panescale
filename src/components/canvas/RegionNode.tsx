import React, { useState, useCallback, useEffect, useRef } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { useCanvasStore } from "../../stores/canvasStore";

type RegionNodeData = {
  regionName: string;
  regionColor: string;
};

const PRESET_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
  "#ef4444", "#f97316", "#f59e0b", "#22c55e",
  "#06b6d4", "#14b8a6", "#64748b", "#1e293b",
];

function ColorPickerMenu({
  currentColor,
  position,
  onSelect,
  onClose,
}: {
  currentColor: string;
  position: { x: number; y: number };
  onSelect: (color: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="nodrag nowheel nopan"
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 10000,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        padding: 8,
        width: 160,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>
        Container Color
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 8 }}>
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onSelect(color)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: color === currentColor ? "2px solid #fff" : "2px solid transparent",
              background: color,
              cursor: "pointer",
              outline: color === currentColor ? `2px solid ${color}` : "none",
              outlineOffset: 1,
            }}
          />
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <input
          ref={inputRef}
          type="color"
          value={currentColor}
          onChange={(e) => onSelect(e.target.value)}
          style={{
            width: 28,
            height: 28,
            padding: 0,
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            background: "none",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Custom...</span>
      </div>
    </div>
  );
}

function ContextMenu({
  position,
  onRename,
  onChangeColor,
  onDelete,
  onClose,
}: {
  position: { x: number; y: number };
  onRename: () => void;
  onChangeColor: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    color: "var(--text-primary)",
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
  };

  const handleHoverIn = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.background = "var(--accent)";
    (e.currentTarget as HTMLElement).style.color = "#fff";
  };
  const handleHoverOut = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.background = "none";
    (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
  };

  return (
    <div
      ref={ref}
      className="nodrag nowheel nopan"
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 10000,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        padding: "4px 0",
        minWidth: 140,
      }}
    >
      <button style={itemStyle} onClick={onRename} onMouseEnter={handleHoverIn} onMouseLeave={handleHoverOut}>
        Rename
      </button>
      <button style={itemStyle} onClick={onChangeColor} onMouseEnter={handleHoverIn} onMouseLeave={handleHoverOut}>
        Change Color
      </button>
      <hr style={{ margin: "4px 0", border: "none", borderTop: "1px solid var(--border)" }} />
      <button
        style={{ ...itemStyle }}
        onClick={onDelete}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#ef4444"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
        onMouseLeave={handleHoverOut}
      >
        Delete Container
      </button>
    </div>
  );
}

const RegionNodeInner = function RegionNodeInner({
  id,
  data,
  selected,
}: NodeProps) {
  const { regionName, regionColor } = data as RegionNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [colorPicker, setColorPicker] = useState<{ x: number; y: number } | null>(null);

  const handleDoubleClick = useCallback(() => {
    setEditing(true);
    setEditValue(regionName || "Container");
  }, [regionName]);

  const handleRenameSubmit = useCallback(() => {
    updateNodeData(id, { regionName: editValue.trim() || "Container" });
    setEditing(false);
  }, [id, editValue, updateNodeData]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleColorSelect = useCallback((color: string) => {
    updateNodeData(id, { regionColor: color });
    setColorPicker(null);
  }, [id, updateNodeData]);

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineStyle={{ borderColor: regionColor }}
        handleStyle={{ backgroundColor: regionColor, width: 8, height: 8 }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderRadius: 8,
          overflow: "hidden",
          border: `1px solid ${regionColor}40`,
        }}
      >
        {/* Header */}
        <div
          className="region-drag-handle"
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: regionColor,
            color: "#fff",
            padding: "0 10px",
            fontSize: 12,
            fontWeight: 600,
            userSelect: "none",
            cursor: "grab",
            flexShrink: 0,
          }}
        >
          {editing ? (
            <input
              autoFocus
              className="nodrag nowheel nopan"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={handleRenameSubmit}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 12,
                outline: "none",
              }}
            />
          ) : (
            <span>{regionName || "Container"}</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeNode(id);
            }}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: 14,
              padding: "0 4px",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "rgba(255,255,255,0.7)";
            }}
          >
            &#x2715;
          </button>
        </div>
        {/* Body fill */}
        <div
          style={{ flex: 1, background: `${regionColor}1a`, pointerEvents: "none" }}
        />
      </div>
      {ctxMenu && (
        <ContextMenu
          position={ctxMenu}
          onRename={() => {
            setCtxMenu(null);
            handleDoubleClick();
          }}
          onChangeColor={() => {
            const pos = ctxMenu;
            setCtxMenu(null);
            setColorPicker(pos);
          }}
          onDelete={() => {
            setCtxMenu(null);
            removeNode(id);
          }}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {colorPicker && (
        <ColorPickerMenu
          currentColor={regionColor}
          position={colorPicker}
          onSelect={handleColorSelect}
          onClose={() => setColorPicker(null)}
        />
      )}
    </>
  );
};

export const RegionNode = React.memo(RegionNodeInner);
