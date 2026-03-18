import type { GitCommitInfo } from "../../../lib/ipc";

const LANE_COLORS = [
  "#4fc3f7",
  "#81c784",
  "#ffb74d",
  "#f06292",
  "#ba68c8",
  "#4db6ac",
];
const COLUMN_WIDTH = 12;
const CIRCLE_RADIUS = 4;
const STROKE_WIDTH = 2;

export interface CommitNode {
  oid: string;
  parentOids: string[];
  column: number;
  row: number;
  color: string;
}

/**
 * Assign lanes (columns) to commits for a topology graph.
 *
 * Algorithm: maintain a `lanes` array tracking which OID occupies each column.
 * For each commit: find its lane, free it, then reserve lanes for parents.
 */
export function assignLanes(commits: GitCommitInfo[]): CommitNode[] {
  const lanes: (string | null)[] = [];
  const nodes: CommitNode[] = [];

  // Pre-build a lookup of which commits exist in our set
  const commitSet = new Set(commits.map((c) => c.oid));

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];
    // Find which lane this commit was reserved in
    let col = lanes.indexOf(commit.oid);
    if (col === -1) {
      // Not reserved -- assign next free lane
      col = lanes.indexOf(null);
      if (col === -1) {
        col = lanes.length;
        lanes.push(null);
      }
    }

    // Free the lane
    lanes[col] = null;

    const color = LANE_COLORS[col % LANE_COLORS.length];
    nodes.push({
      oid: commit.oid,
      parentOids: commit.parent_oids,
      column: col,
      row,
      color,
    });

    // Reserve lanes for parents
    for (let p = 0; p < commit.parent_oids.length; p++) {
      const parentOid = commit.parent_oids[p];
      if (!commitSet.has(parentOid)) continue;
      // Check if parent is already reserved
      if (lanes.indexOf(parentOid) !== -1) continue;

      if (p === 0) {
        // First parent stays in same column if available
        if (lanes[col] === null) {
          lanes[col] = parentOid;
        } else {
          // Find next free
          const free = lanes.indexOf(null);
          if (free !== -1) {
            lanes[free] = parentOid;
          } else {
            lanes.push(parentOid);
          }
        }
      } else {
        // Merge parents get new columns
        const free = lanes.indexOf(null);
        if (free !== -1) {
          lanes[free] = parentOid;
        } else {
          lanes.push(parentOid);
        }
      }
    }
  }

  return nodes;
}

interface CommitGraphProps {
  nodes: CommitNode[];
  rowHeight: number;
}

export function CommitGraph({ nodes, rowHeight }: CommitGraphProps) {
  if (nodes.length === 0) return null;

  // Build oid -> node lookup
  const oidMap = new Map<string, CommitNode>();
  for (const node of nodes) {
    oidMap.set(node.oid, node);
  }

  // Calculate max column for SVG width
  const maxCol = Math.max(...nodes.map((n) => n.column), 0);
  const svgWidth = (maxCol + 1) * COLUMN_WIDTH + COLUMN_WIDTH;
  const svgHeight = nodes.length * rowHeight;

  const cx = (col: number) => col * COLUMN_WIDTH + COLUMN_WIDTH / 2 + 2;
  const cy = (row: number) => row * rowHeight + rowHeight / 2;

  const paths: React.ReactElement[] = [];
  const circles: React.ReactElement[] = [];

  for (const node of nodes) {
    const x1 = cx(node.column);
    const y1 = cy(node.row);

    // Draw connections to parents
    for (const parentOid of node.parentOids) {
      const parent = oidMap.get(parentOid);
      if (!parent) continue;

      const x2 = cx(parent.column);
      const y2 = cy(parent.row);

      if (node.column === parent.column) {
        // Straight vertical line
        paths.push(
          <line
            key={`${node.oid}-${parentOid}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={node.color}
            strokeWidth={STROKE_WIDTH}
          />,
        );
      } else {
        // Bezier curve for merge
        const midY = (y1 + y2) / 2;
        paths.push(
          <path
            key={`${node.oid}-${parentOid}`}
            d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
            fill="none"
            stroke={node.color}
            strokeWidth={STROKE_WIDTH}
          />,
        );
      }
    }

    // Draw commit circle
    circles.push(
      <circle
        key={`c-${node.oid}`}
        cx={x1}
        cy={y1}
        r={CIRCLE_RADIUS}
        fill={node.color}
      />,
    );
  }

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      style={{ flexShrink: 0, display: "block" }}
    >
      {paths}
      {circles}
    </svg>
  );
}
