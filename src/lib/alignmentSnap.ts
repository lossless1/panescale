import type { Node } from "@xyflow/react";

export interface AlignmentGuide {
  type: "vertical" | "horizontal";
  position: number; // flow coordinate
}

const ALIGNMENT_THRESHOLD = 8; // pixels in flow coords

/**
 * Find alignment guides for a dragged node against all other nodes.
 * Checks left, center, right edges (vertical) and top, center, bottom edges (horizontal).
 */
export function findAlignmentGuides(
  draggedNode: Node,
  allNodes: Node[],
): AlignmentGuide[] {
  const guides: AlignmentGuide[] = [];
  const dw =
    (draggedNode.style?.width as number) ??
    (draggedNode.measured?.width as number) ??
    640;
  const dh =
    (draggedNode.style?.height as number) ??
    (draggedNode.measured?.height as number) ??
    480;
  const dx = draggedNode.position.x;
  const dy = draggedNode.position.y;
  const dCx = dx + dw / 2;
  const dCy = dy + dh / 2;
  const dRight = dx + dw;
  const dBottom = dy + dh;

  for (const node of allNodes) {
    if (node.id === draggedNode.id) continue;
    if (node.type === "region") continue; // Don't snap to regions

    const nw =
      (node.style?.width as number) ??
      (node.measured?.width as number) ??
      640;
    const nh =
      (node.style?.height as number) ??
      (node.measured?.height as number) ??
      480;
    const nx = node.position.x;
    const ny = node.position.y;
    const nCx = nx + nw / 2;
    const nCy = ny + nh / 2;
    const nRight = nx + nw;
    const nBottom = ny + nh;

    // Vertical guides (x-axis alignment)
    if (Math.abs(dx - nx) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "vertical", position: nx }); // left-left
    if (Math.abs(dRight - nRight) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "vertical", position: nRight }); // right-right
    if (Math.abs(dx - nRight) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "vertical", position: nRight }); // left-right
    if (Math.abs(dRight - nx) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "vertical", position: nx }); // right-left
    if (Math.abs(dCx - nCx) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "vertical", position: nCx }); // center-center

    // Horizontal guides (y-axis alignment)
    if (Math.abs(dy - ny) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "horizontal", position: ny }); // top-top
    if (Math.abs(dBottom - nBottom) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "horizontal", position: nBottom }); // bottom-bottom
    if (Math.abs(dy - nBottom) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "horizontal", position: nBottom }); // top-bottom
    if (Math.abs(dBottom - ny) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "horizontal", position: ny }); // bottom-top
    if (Math.abs(dCy - nCy) < ALIGNMENT_THRESHOLD)
      guides.push({ type: "horizontal", position: nCy }); // center-center
  }

  // Deduplicate by type+position (round to avoid float duplicates)
  const seen = new Set<string>();
  return guides.filter((g) => {
    const key = `${g.type}-${Math.round(g.position)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
