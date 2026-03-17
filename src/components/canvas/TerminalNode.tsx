import React, { useEffect, useRef, useCallback } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

import { usePty } from "../../hooks/usePty";
import { useFocusModeStore } from "../../hooks/useFocusMode";
import { useCanvasStore } from "../../stores/canvasStore";
import { useThemeStore } from "../../stores/themeStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { modKeyCode } from "../../lib/platform";
import { TerminalTitleBar } from "./TerminalTitleBar";

type TerminalNodeData = {
  cwd: string;
  shellType: string;
  restored?: boolean;
};

/**
 * Build an xterm ITheme from CSS custom properties.
 */
function buildXtermTheme(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  const get = (v: string) => style.getPropertyValue(v).trim();

  return {
    background: get("--bg-terminal") || "#0d0d1a",
    foreground: get("--text-primary") || "#e0e0e0",
    cursor: get("--accent") || "#6366f1",
    cursorAccent: get("--bg-terminal") || "#0d0d1a",
    selectionBackground: get("--focus-glow") || "rgba(99, 102, 241, 0.4)",
  };
}

const TerminalNodeInner = function TerminalNodeInner({ id, data, selected }: NodeProps) {
  const { cwd, shellType } = data as TerminalNodeData;

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const pty = usePty();

  const activeTerminalId = useFocusModeStore((s) => s.activeTerminalId);
  const enterTerminalMode = useFocusModeStore((s) => s.enterTerminalMode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const theme = useThemeStore((s) => s.theme);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const scrollback = useSettingsStore((s) => s.scrollback);

  const isFocused = activeTerminalId === id;

  // Initialize xterm.js and spawn PTY
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      fontFamily,
      fontSize,
      scrollback,
      cursorBlink: true,
      theme: buildXtermTheme(),
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(el);

    // Try WebGL renderer, fall back to DOM
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch {
      // WebGL not available, DOM renderer is fine
    }

    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Spawn PTY
    pty.spawn(cwd, term.cols, term.rows, term);

    return () => {
      pty.kill();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update theme when it changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = buildXtermTheme();
    }
  }, [theme]);

  // Focus/blur terminal based on focus mode
  useEffect(() => {
    if (isFocused && termRef.current) {
      termRef.current.focus();
    } else if (!isFocused && termRef.current) {
      termRef.current.blur();
    }
  }, [isFocused]);

  // ResizeObserver for fit recalculation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          pty.resize(termRef.current.cols, termRef.current.rows);
        } catch {
          // Terminal may not be fully initialized yet
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle click on terminal container
  const handleTerminalClick = useCallback(() => {
    enterTerminalMode(id);
    bringToFront(id);
    if (termRef.current) {
      termRef.current.focus();
    }
  }, [id, enterTerminalMode, bringToFront]);

  // Handle close
  const handleClose = useCallback(() => {
    pty.kill();
    removeNode(id);
  }, [id, pty, removeNode]);

  // Copy/paste keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const modProp = modKeyCode();
      if (!e[modProp]) return;

      const term = termRef.current;
      if (!term) return;

      if (e.key === "c" || e.key === "C") {
        const selection = term.getSelection();
        if (selection) {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(selection);
        }
        // If no selection, let it pass through to PTY as SIGINT (default xterm behavior)
      } else if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.readText().then((text) => {
          if (text && pty.isAlive) {
            pty.write(text);
          }
        });
      }
    },
    [pty],
  );

  // Scroll handler: shift+scroll = pan canvas, regular scroll = terminal scrollback
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.shiftKey) {
      // Allow propagation to React Flow for canvas panning
      return;
    }
    // Stop propagation so canvas doesn't zoom/pan
    e.stopPropagation();
  }, []);

  // Handle resize from NodeResizer
  const handleResize = useCallback(() => {
    if (fitAddonRef.current && termRef.current) {
      try {
        fitAddonRef.current.fit();
        pty.resize(termRef.current.cols, termRef.current.rows);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <NodeResizer
        minWidth={320}
        minHeight={200}
        isVisible={selected}
        onResize={handleResize}
        lineStyle={{ borderColor: "var(--accent)" }}
        handleStyle={{ backgroundColor: "var(--accent)", width: 8, height: 8 }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderRadius: 8,
          overflow: "hidden",
          border: `1px solid ${isFocused ? "var(--accent)" : "var(--border)"}`,
          boxShadow: isFocused
            ? "0 0 0 2px var(--focus-glow)"
            : "0 2px 8px rgba(0,0,0,0.3)",
          background: "var(--bg-terminal)",
        }}
      >
        <TerminalTitleBar
          cwd={cwd}
          shellType={shellType}
          onClose={handleClose}
        />
        {/* Terminal container - nodrag/nowheel/nopan prevent canvas interactions */}
        <div
          ref={containerRef}
          className="nodrag nowheel nopan"
          onClick={handleTerminalClick}
          onKeyDown={handleKeyDown}
          onWheel={handleWheel}
          style={{
            flex: 1,
            padding: 4,
            overflow: "hidden",
          }}
        />
      </div>
    </>
  );
};

export const TerminalNode = React.memo(TerminalNodeInner);
