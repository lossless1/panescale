import React, { useEffect, useRef, useCallback } from "react";
import { type NodeProps, type NodeChange, NodeResizer } from "@xyflow/react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

import { usePty } from "../../hooks/usePty";
import { useFocusModeStore } from "../../hooks/useFocusMode";
import { useCanvasStore } from "../../stores/canvasStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { terminalSchemes } from "../../lib/terminalSchemes";
import { modKeyCode } from "../../lib/platform";
import { magneticSnapSize } from "../../lib/gridSnap";
import { TerminalTitleBar } from "./TerminalTitleBar";

type TerminalNodeData = {
  cwd: string;
  shellType: string;
  restored?: boolean;
};

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
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const setSnapLines = useCanvasStore((s) => s.setSnapLines);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const scrollback = useSettingsStore((s) => s.scrollback);
  const colorScheme = useSettingsStore((s) => s.colorScheme);

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
      theme: terminalSchemes[colorScheme],
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

  // Update terminal color scheme when it changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = terminalSchemes[colorScheme];
    }
  }, [colorScheme]);

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

  // Handle resize from NodeResizer with magnetic snap
  const handleResize = useCallback(
    (event: unknown, params: { x: number; y: number; width: number; height: number }) => {
      // Fit terminal to new size
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit();
          pty.resize(termRef.current.cols, termRef.current.rows);
        } catch {
          // ignore
        }
      }

      // Check modifier key from the D3 drag event's sourceEvent
      const d3Event = event as { sourceEvent?: MouseEvent };
      const sourceEvent = d3Event?.sourceEvent;
      if (sourceEvent?.ctrlKey || sourceEvent?.metaKey) {
        setSnapLines(null);
        return;
      }

      // Snap width (right edge = x + width) and height (bottom edge = y + height)
      const { size: snappedWidth, snapped: snappedW } = magneticSnapSize(params.x, params.width);
      const { size: snappedHeight, snapped: snappedH } = magneticSnapSize(params.y, params.height);

      if (snappedW || snappedH) {
        const changes: NodeChange[] = [
          {
            type: "dimensions",
            id,
            dimensions: {
              width: snappedW ? snappedWidth : params.width,
              height: snappedH ? snappedHeight : params.height,
            },
            resizing: true,
          },
        ];
        onNodesChange(changes);
      }

      setSnapLines({
        x: snappedW ? params.x + snappedWidth : null,
        y: snappedH ? params.y + snappedHeight : null,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, onNodesChange, setSnapLines],
  );

  const handleResizeEnd = useCallback(() => {
    setSnapLines(null);
  }, [setSnapLines]);

  return (
    <>
      <NodeResizer
        minWidth={320}
        minHeight={200}
        isVisible={selected}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
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
