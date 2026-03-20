import React, { useEffect, useRef, useCallback, useState, Component, type ErrorInfo, type ReactNode } from "react";
import { type NodeProps, type NodeChange, NodeResizer } from "@xyflow/react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

import { usePty } from "../../hooks/usePty";
import { useSsh } from "../../hooks/useSsh";
import { useFocusModeStore } from "../../hooks/useFocusMode";
import { useCanvasStore } from "../../stores/canvasStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { terminalSchemes } from "../../lib/terminalSchemes";
import { modKeyCode } from "../../lib/platform";
import { magneticSnapSize } from "../../lib/gridSnap";
import { TerminalTitleBar } from "./TerminalTitleBar";

import { playBellChime } from "../../lib/audio";
import { registerTerminal, unregisterTerminal } from "../../lib/terminalBufferRegistry";

type TerminalNodeData = {
  cwd: string;
  shellType: string;
  restored?: boolean;
  customName?: string;
  badgeColor?: string;
  startupCommand?: string;
  savedBuffer?: string;
  // SSH extensions
  sshConnectionId?: string;
  sshHost?: string;
  sshUser?: string;
};

const TerminalNodeInner = function TerminalNodeInner({ id, data, selected }: NodeProps) {
  const { cwd, shellType, customName, badgeColor, startupCommand, sshConnectionId, sshHost, sshUser } = data as TerminalNodeData;
  const isSsh = !!sshConnectionId;

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  // Track whether the user explicitly closed the tile (kill tmux session)
  // vs component unmounting for other reasons (detach to preserve session)
  const pendingKillRef = useRef(false);
  const pty = usePty();
  const ssh = useSsh();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [processTitle, setProcessTitle] = useState("");

  const activeTerminalId = useFocusModeStore((s) => s.activeTerminalId);
  const enterTerminalMode = useFocusModeStore((s) => s.enterTerminalMode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const setSnapLines = useCanvasStore((s) => s.setSnapLines);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setBellActive = useCanvasStore((s) => s.setBellActive);
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

    // Search addon
    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    // Clickable URLs
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      event.preventDefault();
      window.open(uri, "_blank");
    });
    term.loadAddon(webLinksAddon);

    // Track process title from escape sequences
    term.onTitleChange((title) => {
      setProcessTitle(title);
    });

    // Bell notification: chime + sidebar pulse when terminal is not focused
    term.onBell(() => {
      if (useFocusModeStore.getState().activeTerminalId !== id) {
        setBellActive(id, true);
        playBellChime();
        setTimeout(() => setBellActive(id, false), 5000);
      }
    });

    // Use Canvas renderer (faster than DOM, avoids WebGL disposal crashes)
    // Defer both canvas addon loading AND initial fit to next frame so the
    // container has non-zero dimensions and the renderer is fully initialized.
    let canvasAddon: CanvasAddon | null = null;
    let disposed = false;
    const rafId = requestAnimationFrame(() => {
      if (disposed || !termRef.current || termRef.current !== term) return;
      try {
        canvasAddon = new CanvasAddon();
        term.loadAddon(canvasAddon);
      } catch {
        // Canvas not available, DOM renderer is fine
        canvasAddon = null;
      }
      try { fitAddon.fit(); } catch { /* renderer not ready yet */ }
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    registerTerminal(id, term);

    // Replay saved buffer content on restore (before spawning new shell)
    const nodeData = data as TerminalNodeData;
    if (nodeData.restored && nodeData.savedBuffer) {
      term.write(nodeData.savedBuffer + "\r\n");
    }

    // Spawn PTY or connect SSH
    if (nodeData.sshConnectionId) {
      // SSH terminal
      if (nodeData.restored) {
        // Restored SSH terminal: show reconnect prompt instead of auto-connecting
        const userHost = `${nodeData.sshUser ?? "user"}@${nodeData.sshHost ?? "host"}`;
        term.write(`\r\nSSH session disconnected. Press Enter to reconnect to ${userHost}...\r\n`);
        const disposable = term.onData(() => {
          disposable.dispose();
          ssh
            .connect(nodeData.sshConnectionId!, null, term.cols, term.rows, term)
            .catch((err: unknown) => {
              const errMsg = err instanceof Error ? err.message : String(err);
              // If password required, prompt and retry
              if (errMsg.toLowerCase().includes("password")) {
                const pw = window.prompt(`Enter password for ${userHost}:`);
                if (pw) {
                  ssh.connect(nodeData.sshConnectionId!, pw, term.cols, term.rows, term).catch((e2: unknown) => {
                    term.write(`\r\nSSH reconnect failed: ${e2 instanceof Error ? e2.message : String(e2)}\r\n`);
                  });
                }
              } else {
                term.write(`\r\nSSH reconnect failed: ${errMsg}\r\n`);
              }
            });
        });
      } else {
        // Fresh SSH terminal
        ssh
          .connect(nodeData.sshConnectionId, null, term.cols, term.rows, term)
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.toLowerCase().includes("password")) {
              const userHost = `${nodeData.sshUser ?? "user"}@${nodeData.sshHost ?? "host"}`;
              const pw = window.prompt(`Enter password for ${userHost}:`);
              if (pw) {
                ssh.connect(nodeData.sshConnectionId!, pw, term.cols, term.rows, term).catch((e2: unknown) => {
                  term.write(`\r\nSSH connect failed: ${e2 instanceof Error ? e2.message : String(e2)}\r\n`);
                });
              }
            } else {
              term.write(`\r\nSSH connect failed: ${errMsg}\r\n`);
            }
          });
      }
    } else {
      // Local PTY terminal
      if (nodeData.restored) {
        // Try to reattach to existing tmux session
        const sessionName = `exc-${id}`;
        pty.reattach(sessionName, term.cols, term.rows, term).catch(() => {
          // Session gone -- fall back to fresh spawn
          pty.spawn(cwd, term.cols, term.rows, term);
        });
      } else {
        pty.spawn(cwd, term.cols, term.rows, term).then(() => {
          const cmd = nodeData.startupCommand;
          if (cmd) {
            setTimeout(() => {
              pty.write(cmd + "\n");
            }, 300);
          }
        });
      }
    }

    return () => {
      disposed = true;
      if (nodeData.sshConnectionId) {
        ssh.disconnect();
      } else if (pendingKillRef.current) {
        // User explicitly closed the tile — kill the tmux session
        pty.kill();
      } else {
        // Component unmounting for other reasons (StrictMode, app quit) — detach to preserve session
        pty.detach();
      }
      cancelAnimationFrame(rafId);
      // Dispose canvas addon before terminal to avoid render-after-dispose errors
      if (canvasAddon) {
        try { canvasAddon.dispose(); } catch { /* already disposed */ }
        canvasAddon = null;
      }
      unregisterTerminal(id);
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
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
          const resizeFn = isSsh ? ssh.resize : pty.resize;
          resizeFn(termRef.current.cols, termRef.current.rows);
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

  // Handle close — mark for kill (not detach), then remove the node.
  // The cleanup effect checks pendingKillRef to decide kill vs detach.
  const handleClose = useCallback(() => {
    pendingKillRef.current = true;
    removeNode(id);
  }, [id, removeNode]);

  // Copy/paste keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const modProp = modKeyCode();
      if (!e[modProp]) return;

      const term = termRef.current;
      if (!term) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen(true);
      } else if (e.key === "c" || e.key === "C") {
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
          if (text) {
            if (isSsh && ssh.isAlive) {
              ssh.write(text);
            } else if (!isSsh && pty.isAlive) {
              pty.write(text);
            }
          }
        });
      }
    },
    [isSsh, pty, ssh],
  );

  // Context menu on terminal body for setting startup command
  const handleTerminalContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const value = window.prompt(
        "Startup command (runs on restore):",
        startupCommand || "",
      );
      if (value !== null) {
        updateNodeData(id, { startupCommand: value.trim() || undefined });
      }
    },
    [id, startupCommand, updateNodeData],
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
          const resizeFn = isSsh ? ssh.resize : pty.resize;
          resizeFn(termRef.current.cols, termRef.current.rows);
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
          processTitle={processTitle}
          customName={customName}
          badgeColor={badgeColor}
          sshHost={sshHost}
          sshUser={sshUser}
          onClose={handleClose}
          onRename={(name) => updateNodeData(id, { customName: name || undefined })}
          onBadgeColorChange={(color) => updateNodeData(id, { badgeColor: color })}
        />
        {searchOpen && (
          <div className="nodrag nowheel nopan" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "var(--bg-titlebar)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); searchAddonRef.current?.findNext(e.target.value); }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); searchAddonRef.current?.clearDecorations(); }
                else if (e.key === "Enter" && e.shiftKey) { searchAddonRef.current?.findPrevious(searchQuery); }
                else if (e.key === "Enter") { searchAddonRef.current?.findNext(searchQuery); }
              }}
              placeholder="Search..."
              style={{ flex: 1, background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", fontSize: 12, outline: "none" }}
            />
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(""); searchAddonRef.current?.clearDecorations(); }}
              style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, padding: "0 4px" }}
            >
              &#x2715;
            </button>
          </div>
        )}
        {/* Terminal container - nodrag/nowheel/nopan prevent canvas interactions */}
        <div
          ref={containerRef}
          className="nodrag nowheel nopan"
          onClick={handleTerminalClick}
          onKeyDown={handleKeyDown}
          onWheel={handleWheel}
          onContextMenu={handleTerminalContextMenu}
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

class TerminalErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Terminal crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            background: "var(--bg-terminal)",
            borderRadius: 8,
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            fontSize: 13,
            padding: 20,
          }}
        >
          <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>Terminal crashed</div>
          <div style={{ textAlign: "center", maxWidth: 280, lineHeight: 1.4 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={this.props.onClose}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              padding: "6px 16px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TerminalNodeWithBoundary = function TerminalNodeWithBoundary(props: NodeProps) {
  const removeNode = useCanvasStore((s) => s.removeNode);
  const handleClose = useCallback(() => removeNode(props.id), [props.id, removeNode]);

  return (
    <TerminalErrorBoundary onClose={handleClose}>
      <TerminalNodeInner {...props} />
    </TerminalErrorBoundary>
  );
};

export const TerminalNode = React.memo(TerminalNodeWithBoundary);
