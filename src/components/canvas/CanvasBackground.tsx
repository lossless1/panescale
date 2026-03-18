import { Background, BackgroundVariant, useViewport } from "@xyflow/react";

/**
 * Layered dot grid background for the infinite canvas.
 * Minor dots: frequent, small (grid feel)
 * Major dots: sparse, larger (orientation landmarks)
 *
 * Dot sizes scale inversely with zoom so they remain visible
 * even at minimum zoom (0.1x).
 */
export function CanvasBackground() {
  const { zoom } = useViewport();

  return (
    <>
      <Background
        id="minor-dots"
        variant={BackgroundVariant.Dots}
        gap={20}
        size={Math.max(1, 1.2 / zoom)}
        color="var(--grid-minor)"
      />
      <Background
        id="major-dots"
        variant={BackgroundVariant.Dots}
        gap={100}
        size={Math.max(2, 2.5 / zoom)}
        color="var(--grid-major)"
      />
    </>
  );
}
