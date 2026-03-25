import { GRID_SIZE } from "./gridSnap";

interface LayoutNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  style?: { width?: number; height?: number; [key: string]: unknown };
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
}

interface GridLayoutOptions {
  gap?: number;
  padding?: number;
}

/**
 * Compute a grid-based layout for canvas nodes.
 *
 * Places tiles left-to-right in rows, wrapping when the row exceeds maxRowWidth.
 * Positions are snapped to GRID_SIZE multiples. Region nodes are skipped.
 * Tiles are ordered according to orderedIds (pile order); nodes not in orderedIds
 * are appended at the end in their original array order.
 */
export function computeGridLayout(
  nodes: LayoutNode[],
  orderedIds: string[],
  options?: GridLayoutOptions,
): Map<string, { x: number; y: number }> {
  const gap = options?.gap ?? 40;
  const padding = options?.padding ?? 40;

  // Filter out region nodes
  const contentNodes = nodes.filter((n) => n.type !== "region");

  // Sort by orderedIds position; nodes not in orderedIds go to end
  const idOrder = new Map(orderedIds.map((id, i) => [id, i]));
  const sorted = [...contentNodes].sort((a, b) => {
    const aIdx = idOrder.get(a.id) ?? Infinity;
    const bIdx = idOrder.get(b.id) ?? Infinity;
    return aIdx - bIdx;
  });

  // Calculate maxRowWidth based on node count
  const maxRowWidth = Math.max(1200, Math.sqrt(sorted.length) * 700);

  const result = new Map<string, { x: number; y: number }>();

  let cursorX = padding;
  let cursorY = padding;
  let rowHeight = 0;

  for (const node of sorted) {
    const w = node.style?.width ?? node.measured?.width ?? node.width ?? 640;
    const h = node.style?.height ?? node.measured?.height ?? node.height ?? 480;

    // Wrap to next row if this tile would exceed maxRowWidth
    if (cursorX + w > maxRowWidth && cursorX > padding) {
      cursorX = padding;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }

    // Snap position to grid
    const snappedX = Math.round(cursorX / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(cursorY / GRID_SIZE) * GRID_SIZE;

    result.set(node.id, { x: snappedX, y: snappedY });

    // Advance cursor
    cursorX += w + gap;
    rowHeight = Math.max(rowHeight, h);
  }

  return result;
}
