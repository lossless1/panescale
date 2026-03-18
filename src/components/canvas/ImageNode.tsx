import React from "react";
import { type NodeProps } from "@xyflow/react";
import { convertFileSrc } from "@tauri-apps/api/core";

type ImageNodeData = {
  filePath: string;
  fileName: string;
};

function ImageNodeInner({ data }: NodeProps) {
  const { filePath, fileName } = data as unknown as ImageNodeData;
  const assetUrl = convertFileSrc(filePath);

  return (
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
        <span style={{ fontWeight: 600 }}>{fileName}</span>
      </div>
      <div
        className="nodrag nowheel nopan"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: 4,
        }}
      >
        <img
          src={assetUrl}
          alt={fileName}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
}

export const ImageNode = React.memo(ImageNodeInner);
