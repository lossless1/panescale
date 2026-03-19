import React, { useCallback, useRef, useState } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { useCanvasStore } from "../../stores/canvasStore";

type WebViewNodeData = {
  url: string;
};

function WebViewNodeInner({ id, data, selected }: NodeProps) {
  const { url = "" } = data as unknown as WebViewNodeData;
  const removeNode = useCanvasStore((s) => s.removeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [urlInput, setUrlInput] = useState(url);
  const [iframeSrc, setIframeSrc] = useState(url);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync urlInput when url prop changes (e.g. from persistence)
  const lastUrlRef = useRef(url);
  if (url !== lastUrlRef.current) {
    lastUrlRef.current = url;
    setUrlInput(url);
    setIframeSrc(url);
  }

  const handleUrlSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        let newUrl = urlInput.trim();
        if (newUrl && !newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
          newUrl = "https://" + newUrl;
        }
        setIframeSrc(newUrl);
        updateNodeData(id, { url: newUrl });
      }
    },
    [id, urlInput, updateNodeData],
  );

  const handleRefresh = useCallback(() => {
    // Force iframe reload by toggling src
    const current = iframeSrc;
    setIframeSrc("");
    requestAnimationFrame(() => setIframeSrc(current));
  }, [iframeSrc]);

  const handleOpenExternal = useCallback(() => {
    if (iframeSrc) {
      window.open(iframeSrc, "_blank");
    }
  }, [iframeSrc]);

  const handleClose = useCallback(() => {
    removeNode(id);
  }, [id, removeNode]);

  return (
    <>
      <NodeResizer
        minWidth={300}
        minHeight={250}
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
        {/* Title bar */}
        <div
          className="drag-handle"
          style={{
            height: 32,
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "var(--bg-titlebar)",
            color: "var(--text-secondary)",
            borderBottom: "1px solid var(--border)",
            padding: "0 6px",
            fontSize: 12,
            userSelect: "none",
            cursor: "grab",
            flexShrink: 0,
          }}
        >
          {/* Navigation buttons */}
          <button
            className="nodrag"
            onClick={handleRefresh}
            title="Refresh"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 13,
              padding: "2px 4px",
              lineHeight: 1,
              borderRadius: 3,
            }}
          >
            &#x21bb;
          </button>

          {/* URL bar */}
          <input
            className="nodrag"
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleUrlSubmit}
            placeholder="Enter URL..."
            style={{
              flex: 1,
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-primary)",
              fontSize: 11,
              padding: "2px 6px",
              height: 22,
              outline: "none",
              minWidth: 0,
            }}
          />

          {/* Open externally */}
          <button
            className="nodrag"
            onClick={handleOpenExternal}
            title="Open in browser"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 11,
              padding: "2px 4px",
              lineHeight: 1,
              borderRadius: 3,
            }}
          >
            &#x2197;
          </button>

          {/* Close button */}
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
              padding: "2px 4px",
              lineHeight: 1,
              borderRadius: 3,
            }}
          >
            &times;
          </button>
        </div>

        {/* Iframe body */}
        <div
          className="nodrag nowheel nopan"
          style={{
            flex: 1,
            overflow: "hidden",
          }}
        >
          {iframeSrc ? (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="WebView"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                fontSize: 13,
              }}
            >
              Enter a URL above and press Enter
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const WebViewNode = React.memo(WebViewNodeInner);
