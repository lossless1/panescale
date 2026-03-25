import { GRID_SIZE } from "./gridSnap";

interface LayoutNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any;
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
}

interface GridLayoutOptions {
  gap?: number;
  padding?: number;
  rowGap?: number;
}

/**
 * Compute a grid-based layout grouped by working directory.
 *
 * Each unique cwd gets its own row. Terminals with the same cwd sit side-by-side.
 * Non-terminal nodes (browser, note, file-preview, image) go in a final row.
 * Positions are snapped to GRID_SIZE multiples. Region nodes are skipped.
 */
export function computeGridLayout(
  nodes: LayoutNode[],
  orderedIds: string[],
  options?: GridLayoutOptions,
): Map<string, { x: number; y: number }> {
  const gap = options?.gap ?? 40;
  const padding = options?.padding ?? 40;
  const rowGap = options?.rowGap ?? 60;

  // Filter out region nodes
  const contentNodes = nodes.filter((n) => n.type !== "region");

  // Sort by orderedIds position; nodes not in orderedIds go to end
  const idOrder = new Map(orderedIds.map((id, i) => [id, i]));
  const sorted = [...contentNodes].sort((a, b) => {
    const aIdx = idOrder.get(a.id) ?? Infinity;
    const bIdx = idOrder.get(b.id) ?? Infinity;
    return aIdx - bIdx;
  });

  // Group terminals by cwd, keep non-terminals separate
  const cwdGroups = new Map<string, LayoutNode[]>();
  const nonTerminals: LayoutNode[] = [];

  for (const node of sorted) {
    if (node.type === "terminal") {
      const cwd = (node.data?.cwd as string) ?? "~";
      const group = cwdGroups.get(cwd);
      if (group) {
        group.push(node);
      } else {
        cwdGroups.set(cwd, [node]);
      }
    } else {
      nonTerminals.push(node);
    }
  }

  // Sort groups: largest groups first for visual balance
  const sortedGroups = [...cwdGroups.entries()].sort((a, b) => b[1].length - a[1].length);

  const result = new Map<string, { x: number; y: number }>();
  let cursorY = padding;

  // Layout each cwd group as a row
  for (const [, members] of sortedGroups) {
    let cursorX = padding;
    let rowHeight = 0;

    for (const node of members) {
      const w = (node.style?.width ?? node.measured?.width ?? node.width ?? 640) as number;
      const h = (node.style?.height ?? node.measured?.height ?? node.height ?? 480) as number;

      const snappedX = Math.round(cursorX / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round(cursorY / GRID_SIZE) * GRID_SIZE;

      result.set(node.id, { x: snappedX, y: snappedY });

      cursorX += w + gap;
      rowHeight = Math.max(rowHeight, h);
    }

    cursorY += rowHeight + rowGap;
  }

  // Layout non-terminal nodes in a final row
  if (nonTerminals.length > 0) {
    let cursorX = padding;
    let rowHeight = 0;

    for (const node of nonTerminals) {
      const w = (node.style?.width ?? node.measured?.width ?? node.width ?? 500) as number;
      const h = (node.style?.height ?? node.measured?.height ?? node.height ?? 400) as number;

      const snappedX = Math.round(cursorX / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round(cursorY / GRID_SIZE) * GRID_SIZE;

      result.set(node.id, { x: snappedX, y: snappedY });

      cursorX += w + gap;
      rowHeight = Math.max(rowHeight, h);
    }
  }

  return result;
}
