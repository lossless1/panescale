import React, { useEffect, useState, useRef } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { type Highlighter, createHighlighter } from "shiki";

type FilePreviewNodeData = {
  filePath: string;
  fileName: string;
};

// Extension to language mapping
const EXT_LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rs: "rust",
  go: "go",
  rb: "ruby",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",
  kt: "kotlin",
  md: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  xml: "xml",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  ps1: "powershell",
  dockerfile: "dockerfile",
  makefile: "makefile",
  lua: "lua",
  vim: "viml",
  graphql: "graphql",
  php: "php",
  dart: "dart",
  r: "r",
  zig: "zig",
};

function detectLanguage(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2) return "text";
  const ext = parts[parts.length - 1].toLowerCase();
  return EXT_LANG_MAP[ext] || "text";
}

// Module-level highlighter cache
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();

async function getHighlighter(lang: string): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["one-dark-pro", "github-light"],
      langs: lang !== "text" ? [lang] : [],
    });
    if (lang !== "text") loadedLangs.add(lang);
  }

  const hl = await highlighterPromise;

  // Dynamically load language if not yet loaded
  if (lang !== "text" && !loadedLangs.has(lang)) {
    try {
      await hl.loadLanguage(lang as Parameters<typeof hl.loadLanguage>[0]);
      loadedLangs.add(lang);
    } catch {
      // Language not available, will fall back to text
    }
  }

  return hl;
}

function FilePreviewNodeInner({ data, selected }: NodeProps) {
  const { filePath, fileName } = data as unknown as FilePreviewNodeData;
  const [content, setContent] = useState<string>("");
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

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
        if (!cancelled) setContent(text);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Highlight content with shiki
  useEffect(() => {
    if (!content) {
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
        const html = hl.codeToHtml(content, {
          lang: effectiveLang,
          theme: "one-dark-pro",
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
  }, [content, fileName]);

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
          <span
            style={{
              marginLeft: 8,
              opacity: 0.5,
              fontSize: 11,
            }}
          >
            {detectLanguage(fileName)}
          </span>
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
