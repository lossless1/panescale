import { useCallback, useRef, type WheelEvent } from "react";
import {
  ReactFlow,
  useReactFlow,
  useOnViewportChange,
  type ViewportHelperFunctionOptions,
  type Viewport,
  type NodeTypes,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvasStore } from "../../stores/canvasStore";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useEscapeToCanvas } from "../../hooks/useFocusMode";
import { CanvasBackground } from "./CanvasBackground";
import { TerminalNode } from "./TerminalNode";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.0;
const RUBBER_BAND_DURATION = 150;

const nodeTypes: NodeTypes = {
  terminal: TerminalNode,
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
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const addTerminalNode = useCanvasStore((s) => s.addTerminalNode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);

  const reactFlow = useReactFlow();
  const spaceHeldRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcuts();
  useRubberBandEffect();
  useEscapeToCanvas();

  // Cmd/Ctrl+scroll = zoom
  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const opts: ViewportHelperFunctionOptions = { duration: 50 };
        if (e.deltaY < 0) {
          reactFlow.zoomIn(opts);
        } else {
          reactFlow.zoomOut(opts);
        }
      }
    },
    [reactFlow],
  );

  // Space key tracking for grab cursor
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space" && !e.repeat) {
      spaceHeldRef.current = true;
      wrapperRef.current?.classList.add("canvas-grab");
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

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      setViewport(viewport);
    },
    [setViewport],
  );

  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const cwd = "~"; // Default cwd; PTY backend resolves home directory
      addTerminalNode(position, cwd);
    },
    [reactFlow, addTerminalNode],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      bringToFront(node.id);
    },
    [bringToFront],
  );

  return (
    <div
      ref={handleWrapperRef}
      onWheel={handleWheel}
      style={{ width: "100%", height: "100%" }}
    >
      <style>{`
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
        selectionOnDrag={false}
        fitView={false}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        onMoveEnd={handleMoveEnd}
        onPaneClick={undefined}
        onDoubleClick={handlePaneDoubleClick}
        onNodeClick={handleNodeClick}
        proOptions={{ hideAttribution: true }}
      >
        <CanvasBackground />
      </ReactFlow>
    </div>
  );
}

export function Canvas() {
  return <CanvasInner />;
}
