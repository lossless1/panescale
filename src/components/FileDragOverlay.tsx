import { useEffect } from "react";
import { useFileDragStore } from "../stores/fileDragStore";

/**
 * Renders a floating ghost label during custom file drag.
 * Listens for mousemove/mouseup at the document level.
 */
export function FileDragOverlay() {
  const dragging = useFileDragStore((s) => s.dragging);
  const mouseX = useFileDragStore((s) => s.mouseX);
  const mouseY = useFileDragStore((s) => s.mouseY);
  const updatePosition = useFileDragStore((s) => s.updatePosition);
  const endDrag = useFileDragStore((s) => s.endDrag);

  useEffect(() => {
    if (!dragging) return;

    function onMouseMove(e: MouseEvent) {
      updatePosition(e.clientX, e.clientY);
    }

    function onMouseUp() {
      endDrag();
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, updatePosition, endDrag]);

  if (!dragging) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: mouseX + 12,
        top: mouseY - 8,
        zIndex: 99999,
        pointerEvents: "none",
        background: "var(--accent)",
        color: "#fff",
        padding: "3px 10px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        whiteSpace: "nowrap",
      }}
    >
      {dragging.name}
    </div>
  );
}
