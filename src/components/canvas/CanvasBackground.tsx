import { Background, BackgroundVariant } from "@xyflow/react";

/**
 * Layered dot grid background for the infinite canvas.
 * Minor dots: frequent, small (grid feel)
 * Major dots: sparse, larger (orientation landmarks)
 */
export function CanvasBackground() {
  return (
    <>
      <Background
        id="minor-dots"
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="var(--grid-minor)"
      />
      <Background
        id="major-dots"
        variant={BackgroundVariant.Dots}
        gap={100}
        size={2}
        color="var(--grid-major)"
      />
    </>
  );
}
