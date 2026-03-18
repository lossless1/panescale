import React, { useCallback, useEffect, useRef, useState } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { marked } from "marked";
import { useCanvasStore } from "../../stores/canvasStore";
import { useOpenTerminalFromTile } from "../../hooks/useOpenTerminalFromTile";

type NoteNodeData = {
  markdownContent: string;
  isPreview: boolean;
};

function NoteNodeInner({ id, data, selected }: NodeProps) {
  const { markdownContent = "", isPreview = false } =
    data as unknown as NoteNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const openTerminal = useOpenTerminalFromTile(id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [renderedHtml, setRenderedHtml] = useState("");

  // Render markdown when in preview mode
  useEffect(() => {
    if (isPreview) {
      const html = marked.parse(markdownContent, { async: false }) as string;
      setRenderedHtml(html);
    }
  }, [isPreview, markdownContent]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (!isPreview && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isPreview]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { markdownContent: e.target.value });
    },
    [id, updateNodeData],
  );

  const togglePreview = useCallback(() => {
    updateNodeData(id, { isPreview: !isPreview });
  }, [id, isPreview, updateNodeData]);

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
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
          onDoubleClick={() => openTerminal(undefined)}
          title="Double-click to open terminal here"
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
          <span style={{ fontWeight: 600 }}>Note</span>
          <button
            className="nodrag"
            onClick={togglePreview}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 11,
              padding: "2px 8px",
              lineHeight: 1.4,
            }}
          >
            {isPreview ? "Edit" : "Preview"}
          </button>
        </div>
        <div
          className="nodrag nowheel nopan"
          style={{
            flex: 1,
            overflow: "auto",
          }}
        >
          {isPreview ? (
            <div
              className="note-markdown-preview"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
              style={{
                padding: 12,
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--text-primary)",
                wordBreak: "break-word",
              }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              value={markdownContent}
              onChange={handleContentChange}
              placeholder="Write markdown here..."
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                outline: "none",
                resize: "none",
                background: "transparent",
                color: "var(--text-primary)",
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 13,
                lineHeight: 1.6,
                padding: 12,
                boxSizing: "border-box",
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

export const NoteNode = React.memo(NoteNodeInner);
