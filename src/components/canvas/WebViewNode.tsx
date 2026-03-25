import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { useCanvasStore } from "../../stores/canvasStore";
import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { open as shellOpen } from "@tauri-apps/plugin-shell";

type WebViewNodeData = {
  url: string;
};

// ── URL History (persisted in localStorage) ──

const HISTORY_KEY = "panescale-browser-history";
const MAX_HISTORY = 50;

function getUrlHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch { return []; }
}

function addToUrlHistory(url: string) {
  const history = getUrlHistory().filter((u) => u !== url);
  history.unshift(url);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ── URL Suggestions Dropdown ──

function UrlSuggestions({
  query,
  onSelect,
  visible,
}: {
  query: string;
  onSelect: (url: string) => void;
  visible: boolean;
}) {
  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    const lower = query.toLowerCase();
    return getUrlHistory()
      .filter((u) => u.toLowerCase().includes(lower))
      .slice(0, 6);
  }, [query]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 6,
        right: 6,
        zIndex: 100,
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        maxHeight: 200,
        overflowY: "auto",
      }}
    >
      {suggestions.map((url) => (
        <div
          key={url}
          onMouseDown={(e) => { e.preventDefault(); onSelect(url); }}
          style={{
            padding: "6px 10px",
            fontSize: 12,
            cursor: "pointer",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--text-primary)",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-secondary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          {url}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──

function WebViewNodeInner({ id, data, selected }: NodeProps) {
  const { url = "" } = data as unknown as WebViewNodeData;
  const removeNode = useCanvasStore((s) => s.removeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [urlInput, setUrlInput] = useState(url);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [status, setStatus] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<Webview | null>(null);
  const counterRef = useRef(0);

  const lastUrlRef = useRef(url);
  if (url !== lastUrlRef.current) {
    lastUrlRef.current = url;
    setUrlInput(url);
    setCurrentUrl(url);
  }

  const syncPosition = useCallback(() => {
    const el = placeholderRef.current;
    const wv = webviewRef.current;
    if (!el || !wv) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    wv.setPosition(new LogicalPosition(Math.round(rect.left), Math.round(rect.top))).catch(() => {});
    wv.setSize(new LogicalSize(Math.round(rect.width), Math.round(rect.height))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUrl) { setStatus(""); return; }
    let disposed = false;

    const create = async () => {
      if (webviewRef.current) {
        try { await webviewRef.current.close(); } catch { /* ignore */ }
        webviewRef.current = null;
      }
      if (disposed) return;

      const label = `bv${++counterRef.current}`;
      const el = placeholderRef.current;
      const rect = el?.getBoundingClientRect();
      setStatus("Loading...");

      try {
        const win = getCurrentWindow();
        const wv = new Webview(win, label, {
          url: currentUrl,
          x: rect ? Math.round(rect.left) : 100,
          y: rect ? Math.round(rect.top) : 100,
          width: rect ? Math.round(rect.width) : 400,
          height: rect ? Math.round(rect.height) : 300,
          javascriptDisabled: false,
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        });

        wv.once("tauri://created", () => setStatus(""));
        wv.once("tauri://error", (e) => {
          console.error("[WebView] Error:", e);
          setStatus("Error loading page");
        });

        await new Promise((r) => setTimeout(r, 300));

        if (disposed) { wv.close().catch(() => {}); return; }

        webviewRef.current = wv;
        wv.setFocus().catch(() => {});
        syncPosition();

        // Add to history
        addToUrlHistory(currentUrl);
        setStatus("");
      } catch (err) {
        console.error("[WebView] Failed:", err);
        setStatus(`Failed: ${err}`);
      }
    };

    create();
    return () => {
      disposed = true;
      if (webviewRef.current) {
        webviewRef.current.close().catch(() => {});
        webviewRef.current = null;
      }
    };
  }, [currentUrl, syncPosition]);

  // RAF position sync + zoom
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;
    let rafId: number;
    let lastLeft = 0, lastTop = 0, lastWidth = 0, lastHeight = 0, lastZoom = 0;

    const tick = () => {
      const wv = webviewRef.current;
      if (wv && el) {
        const rect = el.getBoundingClientRect();
        const left = Math.round(rect.left);
        const top = Math.round(rect.top);
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        const zoom = useCanvasStore.getState().viewport.zoom;

        if (left !== lastLeft || top !== lastTop || width !== lastWidth || height !== lastHeight) {
          lastLeft = left; lastTop = top; lastWidth = width; lastHeight = height;
          if (width > 0 && height > 0) {
            wv.setPosition(new LogicalPosition(left, top)).catch(() => {});
            wv.setSize(new LogicalSize(width, height)).catch(() => {});
          }
        }
        if (zoom !== lastZoom) {
          lastZoom = zoom;
          wv.setZoom(zoom).catch(() => {});
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => () => {
    if (webviewRef.current) { webviewRef.current.close().catch(() => {}); }
  }, []);

  const navigateTo = useCallback((newUrl: string) => {
    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
      newUrl = "https://" + newUrl;
    }
    setCurrentUrl(newUrl);
    setUrlInput(newUrl);
    updateNodeData(id, { url: newUrl });
    setShowSuggestions(false);
  }, [id, updateNodeData]);

  const handleUrlSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        navigateTo(urlInput.trim());
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    [urlInput, navigateTo],
  );

  const handleRefresh = useCallback(() => {
    const prev = currentUrl;
    setCurrentUrl("");
    requestAnimationFrame(() => setCurrentUrl(prev));
  }, [currentUrl]);

  const handleOpenExternal = useCallback(() => {
    if (currentUrl) shellOpen(currentUrl).catch(() => {});
  }, [currentUrl]);

  const handleClose = useCallback(() => removeNode(id), [id, removeNode]);

  const hostname = (() => {
    try { return currentUrl ? new URL(currentUrl).hostname : "Browser"; }
    catch { return "Browser"; }
  })();

  return (
    <>
      <NodeResizer
        minWidth={300}
        minHeight={200}
        isVisible={selected}
        lineStyle={{ borderColor: "var(--accent)" }}
        handleStyle={{ backgroundColor: "var(--accent)", width: 8, height: 8 }}
      />
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)", background: "var(--bg-primary)",
      }}>
        {/* Drag handle */}
        <div className="drag-handle" style={{
          height: 28, display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--bg-titlebar)", color: "var(--text-secondary)", padding: "0 8px",
          fontSize: 11, userSelect: "none", cursor: "grab", flexShrink: 0,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2 8h12M8 2c1.5 1.5 2.5 3.5 2.5 6s-1 4.5-2.5 6M8 2c-1.5 1.5-2.5 3.5-2.5 6s1 4.5 2.5 6" stroke="currentColor" strokeWidth="1"/>
            </svg>
            <span style={{ fontWeight: 600, opacity: 0.7 }}>{hostname}</span>
          </span>
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            <button className="nodrag" onClick={handleOpenExternal} title="Open in system browser"
              style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, padding: "2px 4px", lineHeight: 1, borderRadius: 3 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
            >&#x2197;</button>
            <button className="nodrag" onClick={handleClose} title="Close"
              style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1, borderRadius: 3 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
            >&times;</button>
          </div>
        </div>

        {/* URL bar with suggestions */}
        <div className="nodrag" style={{
          display: "flex", alignItems: "center", gap: 4, padding: "4px 6px",
          background: "var(--bg-titlebar)", borderBottom: "1px solid var(--border)",
          flexShrink: 0, position: "relative",
        }}>
          <button onClick={handleRefresh} title="Reload"
            style={{
              background: "none", border: "none", color: "var(--text-secondary)",
              cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1, borderRadius: 3,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
          >
            &#x21bb;
          </button>
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setShowSuggestions(true); }}
            onKeyDown={handleUrlSubmit}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search or enter URL..."
            style={{
              flex: 1, background: "var(--bg-primary)", border: "1px solid var(--border)",
              borderRadius: 6, color: "var(--text-primary)", fontSize: 12, padding: "4px 10px",
              height: 26, outline: "none", minWidth: 0,
            }}
          />
          <UrlSuggestions query={urlInput} onSelect={navigateTo} visible={showSuggestions} />
        </div>

        {/* Placeholder */}
        <div ref={placeholderRef} className="nodrag nowheel nopan" style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent",
        }}>
          {status && (
            <span style={{ color: "var(--text-secondary)", fontSize: 11, opacity: 0.6 }}>{status}</span>
          )}
          {!currentUrl && !status && (
            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Enter a URL and press Enter</span>
          )}
        </div>
      </div>
    </>
  );
}

export const WebViewNode = React.memo(WebViewNodeInner);
