import React, { useEffect, useState, useRef, useCallback } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useOpenTerminalFromTile } from "../../hooks/useOpenTerminalFromTile";
import { useProjectStore } from "../../stores/projectStore";
import { useThemeStore } from "../../stores/themeStore";
import { getHighlighter, loadedLangs, detectLanguage } from "../../lib/shikiHighlighter";

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
  const activeProject = useProjectStore((s) => s.activeProject());
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  // Compute relative path from project root
  const relativePath = activeProject?.path && filePath.startsWith(activeProject.path)
    ? filePath.slice(activeProject.path.length + 1)
    : fileName;
  const [content, setContent] = useState<string>("");
  const [editContent, setEditContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(true);
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    readTextFile(filePath)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setEditContent(text);
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

  // Highlight content with shiki (uses editContent so preview reflects current edits)
  useEffect(() => {
    if (!editContent) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const lang = detectLanguage(fileName);

    getHighlighter(lang)
      .then((hl) => {
        if (cancelled) return;
        // Use the detected language, fall back to "text" if not loaded
        const effectiveLang = loadedLangs.has(lang) ? lang : "text";
        const html = hl.codeToHtml(editContent, {
          lang: effectiveLang,
          theme: resolvedTheme === "light" ? "github-light" : "one-dark-pro",
        });
        if (!cancelled) {
          setHighlightedHtml(html);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlightedHtml("");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editContent, fileName, resolvedTheme]);

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
            onClick={() => setIsEditing((v) => !v)}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 4,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {isEditing ? "Preview" : "Edit"}
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
          ) : loading ? (
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
          ) : isEditing ? (
            <textarea
              className="nodrag nowheel nopan"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              spellCheck={false}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                resize: "none",
                padding: 8,
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: 12,
                lineHeight: 1.5,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                tabSize: 2,
                whiteSpace: "pre",
                overflow: "auto",
                outline: "none",
              }}
            />
          ) : highlightedHtml ? (
            <div
              className="shiki-container"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                overflow: "auto",
                height: "100%",
              }}
            />
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
                padding: 8,
              }}
            >
              <code>{content}</code>
            </pre>
          )}
        </div>
      </div>
    </>
  );
}

export const FilePreviewNode = React.memo(FilePreviewNodeInner);
