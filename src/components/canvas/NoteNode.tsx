import React, { useEffect, useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { readTextFile } from "@tauri-apps/plugin-fs";

type NoteNodeData = {
  filePath: string;
  fileName: string;
};

function NoteNodeInner({ data }: NodeProps) {
  const { filePath, fileName } = data as unknown as NoteNodeData;
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readTextFile(filePath)
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

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
          padding: 12,
          overflow: "auto",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {error ? (
          <span style={{ color: "var(--text-secondary)" }}>
            Failed to load file: {error}
          </span>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

export const NoteNode = React.memo(NoteNodeInner);
