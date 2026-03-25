import { useState, useCallback, useEffect, useRef, type WheelEvent } from "react";
import {
  ReactFlow,
  MiniMap,
  useReactFlow,
  useOnViewportChange,
  type Viewport,
  type NodeTypes,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvasStore } from "../../stores/canvasStore";
import { spawnTerminalAtPosition } from "../../lib/spawnTerminal";
import { useFileDragStore } from "../../stores/fileDragStore";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useEscapeToCanvas } from "../../hooks/useFocusMode";
import { magneticSnapPosition } from "../../lib/gridSnap";
import { findAlignmentGuides, type AlignmentGuide } from "../../lib/alignmentSnap";
import { extensionToTileType } from "../../lib/ipc";
import { CanvasBackground } from "./CanvasBackground";
import { SnapLines } from "./SnapLines";
import { AlignmentGuides } from "./AlignmentGuides";
import { TerminalNode } from "./TerminalNode";
import { NoteNode } from "./NoteNode";
import { ImageNode } from "./ImageNode";
import { FilePreviewNode } from "./FilePreviewNode";
import { RegionNode } from "./RegionNode";
import { WebViewNode } from "./WebViewNode";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1; // Snap zoom in 10% increments (aligned to grid dot spacing)
const RUBBER_BAND_DURATION = 150;

const REGION_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4"];

const nodeTypes: NodeTypes = {
  terminal: TerminalNode,
  note: NoteNode,
  image: ImageNode,
  'file-preview': FilePreviewNode,
  region: RegionNode,
  webview: WebViewNode,
};

/**
 * Rubber-band zoom effect: subtle bounce when hitting zoom limits.
 */
function useRubberBandEffect() {
  const atLimitRef = useRef<"min" | "max" | null>(null);
  const animatingRef = useRef(false);

  useOnViewportChange({
    onChange: useCallback((viewport: Viewport) => {
      if (animatingRef.current) return;

      const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
      if (!el) return;

      let hitLimit: "min" | "max" | null = null;
      if (viewport.zoom <= MIN_ZOOM) hitLimit = "min";
      else if (viewport.zoom >= MAX_ZOOM) hitLimit = "max";

      if (hitLimit && hitLimit !== atLimitRef.current) {
        atLimitRef.current = hitLimit;
        animatingRef.current = true;

        // Overshoot scale
        const overshoot = hitLimit === "min" ? 0.97 : 1.03;
        const savedTransform = el.style.transform;

        el.style.transition = "none";
        el.style.transform = `${savedTransform} scale(${overshoot})`;

        requestAnimationFrame(() => {
          el.style.transition = `transform ${RUBBER_BAND_DURATION}ms ease-out`;
          el.style.transform = savedTransform;

          setTimeout(() => {
            el.style.transition = "";
            animatingRef.current = false;
          }, RUBBER_BAND_DURATION);
        });
      } else if (!hitLimit) {
        atLimitRef.current = null;
      }
    }, []),
  });
}

function CanvasInner() {
  const nodes = useCanvasStore((s) => s.nodes);
  const storedViewport = useCanvasStore((s) => s.viewport);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const addContentNode = useCanvasStore((s) => s.addContentNode);
  const addRegion = useCanvasStore((s) => s.addRegion);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const snapLines = useCanvasStore((s) => s.snapLines);
  const setSnapLines = useCanvasStore((s) => s.setSnapLines);
  const panToNodeId = useCanvasStore((s) => s.panToNodeId);
  const setPanToNode = useCanvasStore((s) => s.setPanToNode);
  const beautifyLayout = useCanvasStore((s) => s.beautifyLayout);
  const autoGroupByCwd = useCanvasStore((s) => s.autoGroupByCwd);
  const removeNode = useCanvasStore((s) => s.removeNode);

  const reactFlow = useReactFlow();
  const spaceHeldRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [alignGuides, setAlignGuides] = useState<AlignmentGuide[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);

  // Region group drag: track initial positions of contained nodes when region drag starts
  const regionDragRef = useRef<{
    regionId: string;
    startPos: { x: number; y: number };
    containedPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  useKeyboardShortcuts();
  useRubberBandEffect();
  useEscapeToCanvas();

  // Pan to a node when panToNodeId is set (triggered by sidebar TerminalList)
  useEffect(() => {
    if (!panToNodeId) return;
    const node = nodes.find((n) => n.id === panToNodeId);
    if (node) {
      const nodeWidth = (node.style?.width as number) ?? 640;
      const nodeHeight = (node.style?.height as number) ?? 480;
      reactFlow.setCenter(
        node.position.x + nodeWidth / 2,
        node.position.y + nodeHeight / 2,
        { zoom: 1, duration: 300 },
      );
      bringToFront(node.id);
    }
    setPanToNode(null);
  }, [panToNodeId, nodes, reactFlow, bringToFront, setPanToNode]);

  // Region group drag: capture initial positions on drag start
  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "region") {
        const rw = (node.style?.width as number) ?? 400;
        const rh = (node.style?.height as number) ?? 300;
        const rx = node.position.x;
        const ry = node.position.y;

        const contained = new Map<string, { x: number; y: number }>();
        for (const n of nodes) {
          if (n.id === node.id || n.type === "region") continue;
          const nx = n.position.x;
          const ny = n.position.y;
          if (nx >= rx && ny >= ry && nx < rx + rw && ny < ry + rh) {
            contained.set(n.id, { x: nx, y: ny });
          }
        }
        regionDragRef.current = {
          regionId: node.id,
          startPos: { x: rx, y: ry },
          containedPositions: contained,
        };
      } else {
        regionDragRef.current = null;
      }
    },
    [nodes],
  );

  // Magnetic snap on drag: snap node position to grid within threshold
  const handleNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Region group drag: move contained tiles by same delta
      if (node.type === "region" && regionDragRef.current && regionDragRef.current.regionId === node.id) {
        const dx = node.position.x - regionDragRef.current.startPos.x;
        const dy = node.position.y - regionDragRef.current.startPos.y;
        const changes: NodeChange[] = [];
        for (const [id, pos] of regionDragRef.current.containedPositions) {
          changes.push({
            type: "position",
            id,
            position: { x: pos.x + dx, y: pos.y + dy },
            dragging: true,
          });
        }
        if (changes.length > 0) {
          onNodesChange(changes);
        }
        return;
      }

      // Cmd/Ctrl held: free positioning, no snap
      if (event.ctrlKey || event.metaKey) {
        setSnapLines(null);
        return;
      }

      const { x, y, snappedX, snappedY } = magneticSnapPosition(
        node.position.x,
        node.position.y,
      );

      if (snappedX || snappedY) {
        const changes: NodeChange[] = [
          {
            type: "position",
            id: node.id,
            position: { x, y },
            dragging: true,
          },
        ];
        onNodesChange(changes);
      }

      setSnapLines({
        x: snappedX ? x : null,
        y: snappedY ? y : null,
      });

      // Find alignment guides against other nodes
      const guides = findAlignmentGuides(node, nodes);
      setAlignGuides(guides);
    },
    [onNodesChange, setSnapLines, nodes],
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSnapLines(null);
      setAlignGuides([]);
      regionDragRef.current = null;

      // Auto-dissolve: if a non-region node was dragged, check if any region now has < 2 contained nodes
      if (node.type !== "region") {
        const currentNodes = useCanvasStore.getState().nodes;
        for (const rn of currentNodes) {
          if (rn.type !== "region") continue;
          const rx = rn.position.x;
          const ry = rn.position.y;
          const rw = (rn.style?.width as number) ?? 400;
          const rh = (rn.style?.height as number) ?? 300;
          let containedCount = 0;
          for (const cn of currentNodes) {
            if (cn.id === rn.id || cn.type === "region") continue;
            if (
              cn.position.x >= rx &&
              cn.position.y >= ry &&
              cn.position.x < rx + rw &&
              cn.position.y < ry + rh
            ) {
              containedCount++;
            }
          }
          if (containedCount < 2) {
            removeNode(rn.id);
          }
        }
      }
    },
    [setSnapLines, removeNode],
  );

  // Cmd/Ctrl+scroll = stepped zoom (snap to ZOOM_STEP increments)
  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const currentZoom = reactFlow.getZoom();
        const direction = e.deltaY < 0 ? 1 : -1;
        // Snap to next step boundary
        const nextZoom = Math.round((currentZoom + direction * ZOOM_STEP) / ZOOM_STEP) * ZOOM_STEP;
        const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
        reactFlow.zoomTo(clamped, { duration: 50 });
      }
    },
    [reactFlow],
  );

  // Space key tracking for grab cursor + minimap toggle
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space" && !e.repeat) {
      spaceHeldRef.current = true;
      wrapperRef.current?.classList.add("canvas-grab");
    }
    // 'm' key toggles minimap (skip if typing in input/textarea)
    if (
      e.key === "m" &&
      !e.repeat &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      document.activeElement?.tagName !== "INPUT" &&
      document.activeElement?.tagName !== "TEXTAREA"
    ) {
      setMinimapVisible((v) => !v);
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space") {
      spaceHeldRef.current = false;
      wrapperRef.current?.classList.remove("canvas-grab");
    }
  }, []);

  // Register space key listeners
  const handleWrapperRef = useCallback(
    (el: HTMLDivElement | null) => {
      // Clean up previous
      if (wrapperRef.current) {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("keyup", handleKeyUp);
      }
      wrapperRef.current = el;
      if (el) {
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
      }
    },
    [handleKeyDown, handleKeyUp],
  );

  const handleMove = useCallback(
    (_event: unknown, viewport: Viewport) => {
      setViewport(viewport);
    },
    [setViewport],
  );

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      setViewport(viewport);
    },
    [setViewport],
  );

  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // Only spawn terminal when double-clicking on the empty pane background,
      // not on existing nodes/tiles or their children
      const target = event.target as HTMLElement;
      if (target.closest(".react-flow__node")) return;
      const isPane =
        target.classList.contains("react-flow__pane") ||
        target.classList.contains("react-flow__background");
      if (!isPane) return;

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      spawnTerminalAtPosition(position);
    },
    [reactFlow],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      bringToFront(node.id);
    },
    [bringToFront],
  );

  // Context menu on canvas right-click
  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const selectedNodes = nodes.filter((n) => n.selected && n.type !== "region");
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        hasSelection: selectedNodes.length >= 2,
      });
    },
    [nodes],
  );

  const handleContextMenuNewTerminal = useCallback(() => {
    if (!contextMenu) return;
    const position = reactFlow.screenToFlowPosition({
      x: contextMenu.x,
      y: contextMenu.y,
    });
    spawnTerminalAtPosition(position);
    setContextMenu(null);
  }, [contextMenu, reactFlow]);

  const handleContextMenuNewBrowser = useCallback(() => {
    if (!contextMenu) return;
    const position = reactFlow.screenToFlowPosition({
      x: contextMenu.x,
      y: contextMenu.y,
    });
    useCanvasStore.getState().addWebViewNode(position, "");
    setContextMenu(null);
  }, [contextMenu, reactFlow]);

  const handleBeautify = useCallback(() => {
    beautifyLayout();
    setContextMenu(null);
  }, [beautifyLayout]);

  const handleAutoGroupByCwd = useCallback(() => {
    autoGroupByCwd();
    setContextMenu(null);
  }, [autoGroupByCwd]);

  const handleGroupAsRegion = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected && n.type !== "region");
    if (selectedNodes.length < 2) return;

    // Calculate bounding box of selected nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of selectedNodes) {
      const w = (n.style?.width as number) ?? (n.measured?.width as number) ?? 640;
      const h = (n.style?.height as number) ?? (n.measured?.height as number) ?? 480;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    const padding = 20;
    const name = window.prompt("Region name:", "Region") || "Region";
    const color = REGION_COLORS[Math.floor(Math.random() * REGION_COLORS.length)];
    addRegion(
      { x: minX - padding, y: minY - padding - 32 }, // 32px for header
      { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 + 32 },
      name,
      color,
    );
    setContextMenu(null);
  }, [nodes, addRegion]);

  // Close context menu on click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [contextMenu]);

  // Custom file drag: listen for mouseup on the canvas wrapper while a file is being dragged
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    function onMouseUp(e: MouseEvent) {
      const { dragging, endDrag } = useFileDragStore.getState();
      if (!dragging) return;
      // File was dropped on the canvas
      const position = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const tileType = extensionToTileType(dragging.ext);
      if (!tileType) { endDrag(); return; } // Binary files are silently ignored
      addContentNode(position, tileType, dragging);
      endDrag();
    }

    el.addEventListener("mouseup", onMouseUp);
    return () => el.removeEventListener("mouseup", onMouseUp);
  }, [reactFlow, addContentNode]);

  return (
    <div
      ref={handleWrapperRef}
      onWheel={handleWheel}
      style={{ width: "100%", height: "100%" }}
    >
      <style>{`
        .react-flow__pane {
          cursor: default !important;
        }
        .react-flow__node {
          cursor: default !important;
        }
        .canvas-grab .react-flow__pane {
          cursor: grab !important;
        }
        .canvas-grab .react-flow__pane:active {
          cursor: grabbing !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        panOnScroll={true}
        panOnDrag={[0, 1]}
        zoomOnScroll={false}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        fitView={false}
        defaultViewport={storedViewport}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        onPaneClick={undefined}
        onDoubleClick={handlePaneDoubleClick}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onPaneContextMenu={handlePaneContextMenu}
        proOptions={{ hideAttribution: true }}
      >
        <CanvasBackground />
        <SnapLines snapLines={snapLines} />
        <AlignmentGuides guides={alignGuides} />
        {minimapVisible && (
          <MiniMap
            position="bottom-right"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
            maskColor="rgba(0, 0, 0, 0.3)"
            nodeColor={(node) => {
              const badgeColor = (node.data as Record<string, unknown>)
                ?.badgeColor as string | undefined;
              if (badgeColor) return badgeColor;
              if (node.type === "region") return "transparent";
              return "var(--accent)";
            }}
            pannable
            zoomable
          />
        )}
      </ReactFlow>
      {/* Layout toolbar — joined icon buttons */}
      <div style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        zIndex: 1000,
        display: "flex",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}>
        <button
          onClick={handleAutoGroupByCwd}
          title="Auto-group terminals by directory"
          style={{
            background: "none",
            border: "none",
            borderRight: "1px solid var(--border)",
            padding: "8px 10px",
            cursor: "pointer",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-primary)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </button>
        <button
          onClick={handleBeautify}
          title="Auto-arrange all tiles"
          style={{
            background: "none",
            border: "none",
            padding: "8px 10px",
            cursor: "pointer",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-primary)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 3h12M2 6.5h8M2 10h10M2 13.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 10000,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            padding: "4px 0",
            minWidth: 160,
          }}
        >
          <button
            onClick={handleContextMenuNewTerminal}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              color: "var(--text-primary)",
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = "var(--accent)";
              (e.target as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "none";
              (e.target as HTMLElement).style.color = "var(--text-primary)";
            }}
          >
            New Terminal
          </button>
          <button
            onClick={handleContextMenuNewBrowser}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              color: "var(--text-primary)",
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = "var(--accent)";
              (e.target as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "none";
              (e.target as HTMLElement).style.color = "var(--text-primary)";
            }}
          >
            New Browser
          </button>
          <hr style={{ margin: "4px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          <button
            onClick={handleBeautify}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              color: "var(--text-primary)",
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = "var(--accent)";
              (e.target as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "none";
              (e.target as HTMLElement).style.color = "var(--text-primary)";
            }}
          >
            Beautify Layout
          </button>
          <button
            onClick={handleAutoGroupByCwd}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              color: "var(--text-primary)",
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = "var(--accent)";
              (e.target as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "none";
              (e.target as HTMLElement).style.color = "var(--text-primary)";
            }}
          >
            Auto-group by Directory
          </button>
          {contextMenu.hasSelection && (
            <button
              onClick={handleGroupAsRegion}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                color: "var(--text-primary)",
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = "var(--accent)";
                (e.target as HTMLElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = "none";
                (e.target as HTMLElement).style.color = "var(--text-primary)";
              }}
            >
              Group as Region
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Canvas() {
  return <CanvasInner />;
}
