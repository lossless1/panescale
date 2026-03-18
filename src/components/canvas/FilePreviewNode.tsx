import React, { useEffect, useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { readTextFile } from "@tauri-apps/plugin-fs";

type FilePreviewNodeData = {
  filePath: string;
  fileName: string;
};

function FilePreviewNodeInner({ data }: NodeProps) {
  const { filePath, fileName } = data as unknown as FilePreviewNodeData;
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
          overflow: "auto",
          padding: 8,
        }}
      >
        {error ? (
          <span
            style={{
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            Failed to load file: {error}
          </span>
        ) : (
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.5,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              color: "var(--text-primary)",
              whiteSpace: "pre",
              tabSize: 2,
            }}
          >
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

export const FilePreviewNode = React.memo(FilePreviewNodeInner);
