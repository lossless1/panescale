import React, { useEffect, useRef, useCallback, useState, Component, type ErrorInfo, type ReactNode } from "react";
import { type NodeProps, type NodeChange, NodeResizer } from "@xyflow/react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
// CanvasAddon disabled — breaks mouse selection inside React Flow's CSS transforms
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

import { playBellChime, playCompletionChime } from "../../lib/audio";
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
  sshPort?: number;
  sshKeyPath?: string;
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
  const [isBusy, setIsBusy] = useState(false);
  const busyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyStartRef = useRef<number>(0);

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
    console.log(`[TerminalNode ${id}] useEffect MOUNT — restored=${!!(data as TerminalNodeData).restored}, ssh=${isSsh}`);

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
      }
    });

    // Activity tracking: detect busy terminals and play completion chime
    // Delay setup to avoid triggering on buffer replay during restore
    const activityTimerId = setTimeout(() => {
      if (disposed) return;
      term.onWriteParsed(() => {
        if (!busyStartRef.current) {
          busyStartRef.current = Date.now();
          setIsBusy(true);
        }
        if (busyTimerRef.current) clearTimeout(busyTimerRef.current);
        busyTimerRef.current = setTimeout(() => {
          const duration = Date.now() - busyStartRef.current;
          busyStartRef.current = 0;
          setIsBusy(false);
          // Notify if busy for threshold and terminal is not focused
          const settings = useSettingsStore.getState();
          if (duration > settings.busyThresholdSeconds * 1000 && useFocusModeStore.getState().activeTerminalId !== id) {
            if (settings.completionChimeEnabled) {
              playCompletionChime();
            }
            // Highlight in sidebar piles tab (stays until user clicks terminal)
            setBellActive(id, true, "info");
            // Badge on dock icon
            import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
              getCurrentWindow().setBadgeLabel("!").catch(() => {});
            });
            // macOS push notification (only when app window is not focused)
            if (settings.notificationsEnabled && !document.hasFocus()) {
              const termData = data as TerminalNodeData;
              const title = termData.customName || termData.sshHost
                ? `${termData.sshUser ?? ""}@${termData.sshHost ?? ""}`
                : `Terminal ${id.slice(0, 6)}`;
              new Notification("Task completed", {
                body: title,
                silent: true,
              });
            }
          }
        }, 2000);
      });
    }, 3000);

    // Use Canvas renderer (faster than DOM, avoids WebGL disposal crashes)
    // Defer both canvas addon loading AND initial fit to next frame so the
    // container has non-zero dimensions and the renderer is fully initialized.
    // Use DOM renderer (not Canvas) — CanvasAddon has broken mouse selection
    // inside CSS-transformed containers (React Flow zoom/pan).
    let disposed = false;
    const rafId = requestAnimationFrame(() => {
      if (disposed || !termRef.current || termRef.current !== term) return;
      try { fitAddon.fit(); } catch { /* renderer not ready yet */ }
    });

    // On restore, React Flow may not have applied node dimensions yet.
    // Re-fit after a short delay to pick up the correct container size.
    const refitTimer = setTimeout(() => {
      if (disposed || !termRef.current || termRef.current !== term) return;
      try {
        fitAddon.fit();
        const resizeFn = isSsh ? ssh.resize : pty.resize;
        resizeFn(term.cols, term.rows);
      } catch { /* ignore */ }
    }, 200);

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
      // SSH terminal — pass direct params so backend doesn't need stored connection
      const sshDirect = nodeData.sshHost && nodeData.sshUser
        ? { host: nodeData.sshHost, port: nodeData.sshPort ?? 22, user: nodeData.sshUser, keyPath: nodeData.sshKeyPath ?? null }
        : undefined;
      console.log(`[SSH Terminal ${id}] nodeData: connectionId=${nodeData.sshConnectionId}, host=${nodeData.sshHost}, port=${nodeData.sshPort}, user=${nodeData.sshUser}, restored=${nodeData.restored}`);
      console.log(`[SSH Terminal ${id}] sshDirect:`, sshDirect);

      if (nodeData.restored) {
        const userHost = `${nodeData.sshUser ?? "user"}@${nodeData.sshHost ?? "host"}`;
        term.write(`\r\nSSH session disconnected. Press Enter to reconnect to ${userHost}...\r\n`);
        const disposable = term.onData(() => {
          disposable.dispose();
          ssh
            .connect(nodeData.sshConnectionId!, null, term.cols, term.rows, term, sshDirect)
            .catch((err: unknown) => {
              const errMsg = err instanceof Error ? err.message : String(err);
              if (errMsg.toLowerCase().includes("password")) {
                const pw = window.prompt(`Enter password for ${userHost}:`);
                if (pw) {
                  ssh.connect(nodeData.sshConnectionId!, pw, term.cols, term.rows, term, sshDirect).catch((e2: unknown) => {
                    term.write(`\r\nSSH reconnect failed: ${e2 instanceof Error ? e2.message : String(e2)}\r\n`);
                  });
                }
              } else {
                term.write(`\r\nSSH reconnect failed: ${errMsg}\r\n`);
              }
            });
        });
      } else {
        ssh
          .connect(nodeData.sshConnectionId, null, term.cols, term.rows, term, sshDirect)
          .then(() => {
            // Send startup command (e.g. cd into selected folder) after SSH connects
            const cmd = nodeData.startupCommand;
            if (cmd) {
              setTimeout(() => ssh.write(cmd + "\n"), 500);
            }
          })
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.toLowerCase().includes("password")) {
              const userHost = `${nodeData.sshUser ?? "user"}@${nodeData.sshHost ?? "host"}`;
              const pw = window.prompt(`Enter password for ${userHost}:`);
              if (pw) {
                ssh.connect(nodeData.sshConnectionId!, pw, term.cols, term.rows, term, sshDirect).catch((e2: unknown) => {
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
        console.log(`[TerminalNode ${id}] restored=true, calling pty.reattach(${sessionName})`);
        pty.reattach(sessionName, term.cols, term.rows, term).catch((e) => {
          console.log(`[TerminalNode ${id}] reattach failed, falling back to spawn:`, e);
          pty.spawn(id, cwd, term.cols, term.rows, term);
        });
      } else {
        console.log(`[TerminalNode ${id}] restored=false, calling pty.spawn(${id}, ${cwd})`);
        pty.spawn(id, cwd, term.cols, term.rows, term).then(() => {
          console.log(`[TerminalNode ${id}] spawn completed`);
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
      clearTimeout(refitTimer);
      clearTimeout(activityTimerId);
      if (busyTimerRef.current) clearTimeout(busyTimerRef.current);
      console.log(`[TerminalNode ${id}] useEffect CLEANUP — pendingKill=${pendingKillRef.current}, ssh=${!!nodeData.sshConnectionId}`);
      if (nodeData.sshConnectionId) {
        ssh.disconnect();
      } else if (pendingKillRef.current) {
        console.log(`[TerminalNode ${id}] calling pty.kill()`);
        pty.kill();
      } else {
        console.log(`[TerminalNode ${id}] calling pty.detach()`);
        pty.detach();
      }
      cancelAnimationFrame(rafId);
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

  // Update terminal font settings in real-time
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontFamily = fontFamily;
      termRef.current.options.fontSize = fontSize;
      // Re-fit after font change to recalculate character dimensions
      if (fitAddonRef.current) {
        try { fitAddonRef.current.fit(); } catch { /* ignore */ }
      }
    }
  }, [fontFamily, fontSize]);

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

  // Fix mouse selection at non-default zoom levels.
  //
  // Root cause: xterm.js computes col = (clientX - rect.left) / cssCellWidth
  //   - (clientX - rect.left) is in screen pixels (SCALED by React Flow CSS transform)
  //   - cssCellWidth is UNSCALED (measured via OffscreenCanvas.measureText)
  //   - Result is off by factor of zoom
  //
  // Fix: monkey-patch MouseService.getCoords to divide pixel offset by zoom
  // BEFORE the cell-width division. This only affects mouse hit-testing, not rendering.
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mouseService = (term as any)._core?._mouseService;
    if (!mouseService || mouseService._patchedGetCoords) return;

    const origGetCoords = mouseService.getCoords.bind(mouseService);
    mouseService._patchedGetCoords = true;

    mouseService.getCoords = function(
      event: { clientX: number; clientY: number },
      element: HTMLElement,
      colCount: number,
      rowCount: number,
      isSelection?: boolean,
    ): [number, number] | undefined {
      const z = zoomRef.current;
      if (z === 1) return origGetCoords(event, element, colCount, rowCount, isSelection);

      // Create a fake event with zoom-corrected coordinates.
      // getBoundingClientRect returns scaled position, clientX is screen-space.
      // The offset (clientX - rect.left) is scaled by zoom.
      // We need it unscaled, so we adjust clientX to compensate.
      const rect = element.getBoundingClientRect();
      const correctedEvent = {
        clientX: rect.left + (event.clientX - rect.left) / z,
        clientY: rect.top + (event.clientY - rect.top) / z,
      };
      return origGetCoords(correctedEvent, element, colCount, rowCount, isSelection);
    };
  }, []);

  // Handle mousedown on terminal container — enter focus mode but don't
  // call term.focus() directly. xterm handles its own focus via mousedown
  // on its internal textarea. Calling focus() here would interfere with
  // selection by resetting xterm's internal mouse state.
  const handleTerminalMouseDown = useCallback(() => {
    enterTerminalMode(id);
    bringToFront(id);
    setBellActive(id, false);
    // Clear dock badge when user interacts with a terminal
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().setBadgeLabel("").catch(() => {});
    });
  }, [id, enterTerminalMode, bringToFront, setBellActive]);

  // Handle close — mark for kill (not detach), then remove the node.
  // The cleanup effect checks pendingKillRef to decide kill vs detach.
  const handleClose = useCallback(() => {
    pendingKillRef.current = true;
    removeNode(id);
  }, [id, removeNode]);

  // Copy/paste keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Auto-enter terminal mode on any key event in the container
      if (!isFocused) {
        enterTerminalMode(id);
        bringToFront(id);
        if (termRef.current) termRef.current.focus();
      }

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
        // Let xterm.js handle paste natively via the browser paste event.
        // Using navigator.clipboard.readText() triggers macOS WebKit paste confirmation dialog.
      }
    },
    [isSsh, pty, ssh, isFocused, enterTerminalMode, bringToFront, id],
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

  // Handle resize from NodeResizer with grid-step snapping
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

      // Check modifier key — Cmd/Ctrl disables snap
      const d3Event = event as { sourceEvent?: MouseEvent };
      const sourceEvent = d3Event?.sourceEvent;
      if (sourceEvent?.ctrlKey || sourceEvent?.metaKey) {
        setSnapLines(null);
        return;
      }

      // Snap edges to grid dots
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
      {isBusy && !isFocused && (
        <style>{`
          @keyframes gradient-spin-${id.replace(/[^a-zA-Z0-9]/g, '')} {
            0% { --gradient-angle: 0deg; }
            100% { --gradient-angle: 360deg; }
          }
          @property --gradient-angle {
            syntax: '<angle>';
            initial-value: 0deg;
            inherits: false;
          }
        `}</style>
      )}
      <NodeResizer
        minWidth={320}
        minHeight={200}
        isVisible={selected}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
        lineStyle={{ borderColor: "var(--accent)" }}
        handleStyle={{ backgroundColor: "var(--accent)", width: 8, height: 8 }}
      />
      {/* Gradient border glow when busy */}
      {isBusy && !isFocused && (
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 10,
            background: "conic-gradient(from var(--gradient-angle), #6366f1, #8b5cf6, #a78bfa, #c4b5fd, #8b5cf6, #6366f1)",
            animation: "gradient-spin-" + id.replace(/[^a-zA-Z0-9]/g, '') + " 3s linear infinite",
            opacity: 0.8,
            zIndex: -1,
          }}
        />
      )}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderRadius: 8,
          overflow: "hidden",
          border: `1px solid ${isFocused ? "var(--accent)" : isBusy ? "transparent" : "var(--border)"}`,
          boxShadow: isFocused
            ? "0 0 0 2px var(--focus-glow)"
            : isBusy
              ? "0 0 12px rgba(99, 102, 241, 0.3)"
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
          onDuplicate={() => {
            const nd = data as TerminalNodeData;
            const nodes = useCanvasStore.getState().nodes;
            const thisNode = nodes.find((n) => n.id === id);
            const pos = thisNode
              ? { x: thisNode.position.x + 40, y: thisNode.position.y + 40 }
              : { x: 100, y: 100 };
            if (nd.sshConnectionId) {
              useCanvasStore.getState().addSshTerminalNode(pos, {
                id: nd.sshConnectionId,
                host: nd.sshHost ?? "",
                user: nd.sshUser ?? "",
                port: nd.sshPort ?? 22,
                keyPath: nd.sshKeyPath ?? undefined,
              });
              const newNodes = useCanvasStore.getState().nodes;
              const newNode = newNodes[newNodes.length - 1];
              if (newNode && nd.startupCommand) {
                useCanvasStore.getState().updateNodeData(newNode.id, { startupCommand: nd.startupCommand });
              }
            } else {
              useCanvasStore.getState().addTerminalNode(pos, cwd);
            }
          }}
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
          onMouseDown={handleTerminalMouseDown}
          onKeyDown={handleKeyDown}
          onWheel={handleWheel}
          onContextMenu={handleTerminalContextMenu}
          style={{
            flex: 1,
            padding: 0,
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
