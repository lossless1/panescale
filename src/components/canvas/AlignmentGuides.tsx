import { useStore, useViewport } from "@xyflow/react";
import type { AlignmentGuide } from "../../lib/alignmentSnap";

interface AlignmentGuidesProps {
  guides: AlignmentGuide[];
}

export function AlignmentGuides({ guides }: AlignmentGuidesProps) {
  const viewport = useViewport();
  const { width: containerWidth, height: containerHeight } = useStore(
    (s) => ({ width: s.width, height: s.height }),
  );

  if (guides.length === 0) return null;

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
        zIndex: 999,
        overflow: "hidden",
      }}
    >
      {guides.map((g, i) =>
        g.type === "vertical" ? (
          <div
            key={`v-${i}`}
            style={{
              position: "absolute",
              left: toScreenX(g.position),
              top: 0,
              width: 1,
              height: "100%",
              borderLeft: "1px solid var(--accent)",
              opacity: 0.7,
              pointerEvents: "none",
            }}
          />
        ) : (
          <div
            key={`h-${i}`}
            style={{
              position: "absolute",
              top: toScreenY(g.position),
              left: 0,
              height: 1,
              width: "100%",
              borderTop: "1px solid var(--accent)",
              opacity: 0.7,
              pointerEvents: "none",
            }}
          />
        ),
      )}
    </div>
  );
}
