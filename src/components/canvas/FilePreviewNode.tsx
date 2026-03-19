import React, { useEffect, useState, useRef, useCallback } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useOpenTerminalFromTile } from "../../hooks/useOpenTerminalFromTile";
import { useCanvasStore } from "../../stores/canvasStore";
import { useProjectStore } from "../../stores/projectStore";
import { useThemeStore } from "../../stores/themeStore";
import { detectLanguage } from "../../lib/shikiHighlighter";
import { CodeEditor } from "./CodeEditor";
import "../../styles/codemirror.css";

type FilePreviewNodeData = {
  filePath: string;
  fileName: string;
};

/** File icon for tile header */
function tileFileIcon(name: string): { icon: string; color: string } {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  switch (ext) {
    case "ts": case "tsx": return { icon: "TS", color: "#3178c6" };
    case "js": case "jsx": return { icon: "JS", color: "#f0db4f" };
    case "json": return { icon: "{}", color: "#a0a0a0" };
    case "md": case "mdx": return { icon: "M", color: "#519aba" };
    case "css": case "scss": return { icon: "#", color: "#563d7c" };
    case "html": return { icon: "<>", color: "#e34c26" };
    case "rs": return { icon: "Rs", color: "#dea584" };
    case "toml": return { icon: "T", color: "#9c4221" };
    case "yml": case "yaml": return { icon: "Y", color: "#cb171e" };
    default: return { icon: "\u2022", color: "#888" };
  }
}

function FilePreviewNodeInner({ id, data, selected }: NodeProps) {
  const { filePath, fileName } = data as unknown as FilePreviewNodeData;
  const openTerminal = useOpenTerminalFromTile(id);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const activeProject = useProjectStore((s) => s.activeProject());
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  // Compute relative path from project root
  const relativePath = activeProject?.path && filePath.startsWith(activeProject.path)
    ? filePath.slice(activeProject.path.length + 1)
    : fileName;
  const [content, setContent] = useState<string>("");
  const [editContent, setEditContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(true);

  const dirty = editContent !== content;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load file content
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    readTextFile(filePath)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setEditContent(text);
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Save handler
  const handleSave = useCallback(async () => {
    try {
      await writeTextFile(filePath, editContent);
      setContent(editContent);
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }, [filePath, editContent]);

  const handleClose = useCallback(() => {
    removeNode(id);
  }, [id, removeNode]);


  return (
    <>
      <NodeResizer
        minWidth={250}
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
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: tileFileIcon(fileName).color,
              marginRight: 6,
              minWidth: 16,
              textAlign: "center",
            }}
          >
            {tileFileIcon(fileName).icon}
          </span>
          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{relativePath}</span>
          {dirty && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
                marginLeft: 6,
                flexShrink: 0,
              }}
              title="Unsaved changes"
            />
          )}
          <span
            style={{
              marginLeft: 8,
              opacity: 0.5,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            {detectLanguage(fileName)}
          </span>
          <span style={{ flex: 1 }} />
          <button
            className="nodrag"
            onClick={handleClose}
            title="Close"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 14,
              padding: "0 4px",
              marginLeft: 4,
              lineHeight: 1,
              borderRadius: 3,
              flexShrink: 0,
            }}
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
        <div
          className="nodrag nowheel nopan"
          style={{
            flex: 1,
            overflow: "auto",
            padding: 0,
          }}
        >
          {error ? (
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: 13,
                padding: 12,
                display: "block",
              }}
            >
              Failed to load file: {error}
            </span>
          ) : !loaded ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-secondary)",
                fontSize: 13,
              }}
            >
              Loading...
            </div>
          ) : (
            <CodeEditor
              value={editContent}
              onChange={setEditContent}
              onSave={handleSave}
              language={detectLanguage(fileName)}
              theme={resolvedTheme === "light" ? "light" : "dark"}
            />
          )}
        </div>
      </div>
    </>
  );
}

export const FilePreviewNode = React.memo(FilePreviewNodeInner);
