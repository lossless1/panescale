interface GroupNode {
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

/**
 * Detect groups of terminal nodes sharing the same working directory.
 *
 * Only terminal nodes are considered. Groups with fewer than 2 members
 * are discarded. Returns a Map keyed by cwd string, with arrays of nodes.
 */
export function detectCwdGroups(nodes: GroupNode[]): Map<string, GroupNode[]> {
  const groups = new Map<string, GroupNode[]>();

  for (const node of nodes) {
    if (node.type !== "terminal") continue;

    const cwd = (node.data as Record<string, unknown>).cwd;
    if (!cwd || typeof cwd !== "string") continue;

    const existing = groups.get(cwd);
    if (existing) {
      existing.push(node);
    } else {
      groups.set(cwd, [node]);
    }
  }

  // Remove groups with fewer than 2 members
  for (const [key, members] of groups) {
    if (members.length < 2) {
      groups.delete(key);
    }
  }

  return groups;
}

/**
 * Compute the bounding box for a region that wraps the given member nodes.
 *
 * Includes padding around all sides and a header offset at the top.
 */
export function computeRegionBounds(
  members: GroupNode[],
  padding = 30,
  headerHeight = 44,
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of members) {
    const w = node.style?.width ?? node.measured?.width ?? node.width ?? 640;
    const h = node.style?.height ?? node.measured?.height ?? node.height ?? 480;

    const nx = node.position.x;
    const ny = node.position.y;

    if (nx < minX) minX = nx;
    if (ny < minY) minY = ny;
    if (nx + w > maxX) maxX = nx + w;
    if (ny + h > maxY) maxY = ny + h;
  }

  return {
    x: minX - padding,
    y: minY - padding - headerHeight,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2 + headerHeight,
  };
}
