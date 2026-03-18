import React, { useCallback, useState } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useCanvasStore } from "../../stores/canvasStore";
import { useOpenTerminalFromTile } from "../../hooks/useOpenTerminalFromTile";

type ImageNodeData = {
  filePath: string;
  fileName: string;
};

function ImageNodeInner({ id, data, selected }: NodeProps) {
  const { filePath, fileName } = data as unknown as ImageNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const openTerminal = useOpenTerminalFromTile(id);
  const [isDragOver, setIsDragOver] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const assetUrl = filePath ? convertFileSrc(filePath) : null;
  const displayUrl = objectUrl || assetUrl;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      // Check if it's an image file
      if (!file.type.startsWith("image/")) return;

      // On Tauri, dragged files from Finder may have a path property
      const fileWithPath = file as File & { path?: string };
      if (fileWithPath.path) {
        updateNodeData(id, {
          filePath: fileWithPath.path,
          fileName: file.name,
        });
      } else {
        // Fallback: create an object URL for display
        const url = URL.createObjectURL(file);
        setObjectUrl(url);
        updateNodeData(id, { fileName: file.name });
      }
    },
    [id, updateNodeData],
  );

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineStyle={{ borderColor: "var(--accent)" }}
        handleStyle={{
          backgroundColor: "var(--accent)",
          width: 8,
          height: 8,
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          background: "var(--bg-primary)",
        }}
      >
        <div
          className="drag-handle"
          onDoubleClick={() => openTerminal(filePath)}
          title="Double-click to open terminal here"
          style={{
            height: 32,
            display: "flex",
            alignItems: "center",
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
          <span style={{ fontWeight: 600 }}>{fileName || "Image"}</span>
        </div>
        <div
          className="nodrag nowheel nopan"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: 4,
            position: "relative",
          }}
        >
          {/* Drop zone overlay */}
          {isDragOver && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(var(--accent-rgb, 99, 102, 241), 0.15)",
                border: "2px dashed var(--accent)",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <span
                style={{
                  color: "var(--accent)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Drop image
              </span>
            </div>
          )}
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={fileName}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                color: "var(--text-secondary)",
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 32, opacity: 0.5 }}>&#128444;</span>
              <span>Drag an image here</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const ImageNode = React.memo(ImageNodeInner);
