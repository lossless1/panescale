import React, { useCallback, useEffect, useRef, useState } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { marked, Renderer } from "marked";
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { Highlighter } from "shiki";
import { useCanvasStore } from "../../stores/canvasStore";
import { useProjectStore } from "../../stores/projectStore";
import { useThemeStore } from "../../stores/themeStore";
import { useOpenTerminalFromTile } from "../../hooks/useOpenTerminalFromTile";
import { getHighlighter, loadedLangs } from "../../lib/shikiHighlighter";

// Extract code block languages from markdown content
function extractCodeLanguages(markdown: string): string[] {
  const regex = /```(\w+)/g;
  const langs: string[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    if (match[1] && !langs.includes(match[1])) {
      langs.push(match[1]);
    }
  }
  return langs;
}

// Create a custom marked renderer for syntax-highlighted code blocks
function createCodeRenderer(highlighter: Highlighter | null, theme: "one-dark-pro" | "github-light"): Renderer {
  const renderer = new Renderer();
  // Override link renderer to prevent target="_blank" -- links are intercepted by onClick handler
  renderer.link = ({ href, text }: { href: string; text: string }) => {
    const escaped = (href ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return `<a href="${escaped}">${text}</a>`;
  };
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const language = lang || "text";
    if (highlighter && loadedLangs.has(language)) {
      return highlighter.codeToHtml(text, { lang: language, theme });
    }
    // Fallback to plain code block with HTML escaping
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<pre><code class="language-${language}">${escaped}</code></pre>`;
  };
  return renderer;
}

type NoteNodeData = {
  markdownContent: string;
  isPreview: boolean;
  filePath?: string;
  fileName?: string;
};

function NoteNodeInner({ id, data, selected }: NodeProps) {
  const { markdownContent = "", isPreview = false, filePath, fileName } =
    data as unknown as NoteNodeData;
  const isFileBacked = !!filePath;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addWebViewNode = useCanvasStore((s) => s.addWebViewNode);
  const activeProject = useProjectStore((s) => s.activeProject());
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const openTerminal = useOpenTerminalFromTile(id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [renderedHtml, setRenderedHtml] = useState("");
  const [fileLoaded, setFileLoaded] = useState(false);
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  // Load highlighter on mount
  useEffect(() => {
    let cancelled = false;
    getHighlighter("text").then((hl) => {
      if (!cancelled) setHighlighter(hl);
    });
    return () => { cancelled = true; };
  }, []);

  // Load file content for file-backed notes
  useEffect(() => {
    if (!filePath || fileLoaded) return;
    readTextFile(filePath)
      .then((text) => {
        updateNodeData(id, { markdownContent: text, isPreview: true });
        setFileLoaded(true);
      })
      .catch((err) => {
        updateNodeData(id, { markdownContent: `Failed to load: ${err}`, isPreview: true });
        setFileLoaded(true);
      });
  }, [filePath, fileLoaded, id, updateNodeData]);

  // Render markdown with syntax highlighting when in preview mode
  useEffect(() => {
    if (!isPreview && !(isFileBacked && !fileLoaded)) return;

    let cancelled = false;
    const shikiTheme = resolvedTheme === "light" ? "github-light" : "one-dark-pro";

    // Extract languages from markdown and ensure they're loaded
    const langs = extractCodeLanguages(markdownContent);
    const loadPromises = langs.map((lang) => getHighlighter(lang));

    Promise.all(loadPromises)
      .then(() => {
        if (cancelled) return;
        const renderer = createCodeRenderer(highlighter, shikiTheme);
        const html = marked.parse(markdownContent, { renderer, async: false }) as string;
        setRenderedHtml(html);
      })
      .catch(() => {
        // Fallback to plain markdown on error
        if (!cancelled) {
          const html = marked.parse(markdownContent, { async: false }) as string;
          setRenderedHtml(html);
        }
      });

    return () => { cancelled = true; };
  }, [isPreview, isFileBacked, fileLoaded, markdownContent, highlighter, resolvedTheme]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (!isPreview && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isPreview]);

  // Compute display name
  const displayName = fileName
    ? (activeProject?.path && filePath?.startsWith(activeProject.path)
        ? filePath.slice(activeProject.path.length + 1)
        : fileName)
    : "Note";

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { markdownContent: e.target.value });
    },
    [id, updateNodeData],
  );

  const togglePreview = useCallback(() => {
    updateNodeData(id, { isPreview: !isPreview });
  }, [id, isPreview, updateNodeData]);

  const handlePreviewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      // Only intercept http/https links (not anchors or relative paths)
      if (!href.startsWith("http://") && !href.startsWith("https://")) return;

      e.preventDefault();
      e.stopPropagation();

      // Get the NoteNode's position to place WebView nearby
      const nodes = useCanvasStore.getState().nodes;
      const thisNode = nodes.find((n) => n.id === id);
      const nodeWidth = (thisNode?.style?.width as number) ?? 300;
      const position = {
        x: (thisNode?.position.x ?? 0) + nodeWidth + 20,
        y: thisNode?.position.y ?? 0,
      };

      addWebViewNode(position, href);
    },
    [id, addWebViewNode],
  );

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
          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isFileBacked && (
              <span style={{ color: "#519aba", marginRight: 6, fontSize: 10, fontWeight: 700 }}>M</span>
            )}
            {displayName}
          </span>
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
              className="prose note-markdown-preview"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
              onClick={handlePreviewClick}
              style={{
                padding: 12,
                fontSize: 13,
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
