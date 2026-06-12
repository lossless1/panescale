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
 * Lay out a group of nodes as wrapping rows starting at cursorY.
 * Returns the y coordinate below the laid-out block.
 */
function layoutGroup(
  members: LayoutNode[],
  cursorY: number,
  opts: { gap: number; padding: number; maxRowWidth: number; defaultW: number; defaultH: number },
  result: Map<string, { x: number; y: number }>,
): number {
  const { gap, padding, maxRowWidth, defaultW, defaultH } = opts;
  let cursorX = padding;
  let rowHeight = 0;

  for (const node of members) {
    const w = (node.style?.width ?? node.measured?.width ?? node.width ?? defaultW) as number;
    const h = (node.style?.height ?? node.measured?.height ?? node.height ?? defaultH) as number;

    if (cursorX > padding && cursorX + w > maxRowWidth) {
      cursorX = padding;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }

    const snappedX = Math.round(cursorX / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(cursorY / GRID_SIZE) * GRID_SIZE;

    result.set(node.id, { x: snappedX, y: snappedY });

    cursorX += w + gap;
    rowHeight = Math.max(rowHeight, h);
  }

  return cursorY + rowHeight;
}

/**
 * Compute a grid-based layout grouped by working directory.
 *
 * Each unique cwd gets its own row block; terminals with the same cwd sit
 * side-by-side and wrap when the row gets too wide. Non-terminal nodes
 * (browser, note, file-preview, image) get one row block per node type so
 * they can be framed as groups too. Positions are snapped to GRID_SIZE
 * multiples. Region nodes are skipped.
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

  // Group terminals by cwd, non-terminals by node type
  const cwdGroups = new Map<string, LayoutNode[]>();
  const typeGroups = new Map<string, LayoutNode[]>();

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
      const key = node.type ?? "other";
      const group = typeGroups.get(key);
      if (group) {
        group.push(node);
      } else {
        typeGroups.set(key, [node]);
      }
    }
  }

  // Sort groups: largest groups first for visual balance
  const sortedGroups = [...cwdGroups.entries()].sort((a, b) => b[1].length - a[1].length);

  const maxRowWidth = Math.max(1200, Math.sqrt(contentNodes.length) * 700);
  const result = new Map<string, { x: number; y: number }>();
  let cursorY = padding;

  // Layout each cwd group as a row block
  for (const [, members] of sortedGroups) {
    cursorY = layoutGroup(
      members,
      cursorY,
      { gap, padding, maxRowWidth, defaultW: 640, defaultH: 480 },
      result,
    ) + rowGap;
  }

  // Layout each non-terminal type as its own row block
  for (const [, members] of typeGroups) {
    cursorY = layoutGroup(
      members,
      cursorY,
      { gap, padding, maxRowWidth, defaultW: 500, defaultH: 400 },
      result,
    ) + rowGap;
  }

  return result;
}
