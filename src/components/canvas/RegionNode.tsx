import React, { useState, useCallback } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { useCanvasStore } from "../../stores/canvasStore";

type RegionNodeData = {
  regionName: string;
  regionColor: string;
};

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

  const handleDoubleClick = useCallback(() => {
    setEditing(true);
    setEditValue(regionName || "");
  }, [regionName]);

  const handleRenameSubmit = useCallback(() => {
    updateNodeData(id, { regionName: editValue.trim() || "Region" });
    setEditing(false);
  }, [id, editValue, updateNodeData]);

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
            <span>{regionName || "Region"}</span>
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
    </>
  );
};

export const RegionNode = React.memo(RegionNodeInner);
