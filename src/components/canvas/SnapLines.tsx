import { useStore, useViewport } from "@xyflow/react";

export interface SnapLinePositions {
  x: number | null;
  y: number | null;
}

interface SnapLinesProps {
  snapLines: SnapLinePositions | null;
}

/**
 * Visual snap guide line overlay.
 * Renders accent-colored dashed lines at snap positions during drag/resize.
 * Lines are rendered in screen space, converted from flow coordinates.
 */
export function SnapLines({ snapLines }: SnapLinesProps) {
  const viewport = useViewport();
  const { width: containerWidth, height: containerHeight } = useStore(
    (s) => ({ width: s.width, height: s.height }),
  );

  if (!snapLines) return null;
  if (snapLines.x === null && snapLines.y === null) return null;

  // Convert flow coordinate to screen coordinate
  const toScreenX = (flowX: number) => flowX * viewport.zoom + viewport.x;
  const toScreenY = (flowY: number) => flowY * viewport.zoom + viewport.y;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        pointerEvents: "none",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {snapLines.x !== null && (
        <div
          style={{
            position: "absolute",
            left: toScreenX(snapLines.x),
            top: 0,
            width: 1,
            height: "100%",
            borderLeft: "1px dashed var(--accent)",
            pointerEvents: "none",
          }}
        />
      )}
      {snapLines.y !== null && (
        <div
          style={{
            position: "absolute",
            top: toScreenY(snapLines.y),
            left: 0,
            height: 1,
            width: "100%",
            borderTop: "1px dashed var(--accent)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
