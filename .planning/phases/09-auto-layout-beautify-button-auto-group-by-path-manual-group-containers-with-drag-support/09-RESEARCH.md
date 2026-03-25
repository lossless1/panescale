# Phase 9: Auto-layout beautify button, auto-group by path, manual group containers with drag support - Research

**Researched:** 2026-03-25
**Domain:** Canvas layout algorithms, React Flow v12 sub-flows/grouping, spatial organization
**Confidence:** HIGH

## Summary

Phase 9 adds three interconnected spatial organization features to the Panescale canvas: (1) an auto-layout "beautify" button that arranges all tiles neatly, (2) automatic grouping of terminals sharing the same working directory, and (3) manual group container creation with group-drag support and auto-dissolution. The existing codebase already has a working RegionNode component with group-drag behavior (move contained tiles when dragging a region), providing a solid foundation to build upon.

The critical architectural decision is whether to use React Flow v12's built-in `parentId` sub-flow system or continue with the current "spatial containment" approach (where regions detect overlapping nodes by bounding-box intersection). The `parentId` approach gives free parent-child movement but requires coordinate transforms (children use relative positions) and careful array ordering. The spatial containment approach already works in the codebase and is simpler for "auto-ungroup on move out" semantics. **Recommendation: Extend the existing spatial containment approach** rather than migrating to `parentId`, since it already handles the core use case and avoids a coordinate-system migration.

**Primary recommendation:** Use a simple grid-packing layout algorithm (no external library needed), extend the existing RegionNode with `groupId` data semantics, and add a "Beautify" toolbar button that computes optimal tile positions respecting Piles tab ordering.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | 12.10.1 | Canvas framework (already installed) | Project's existing canvas foundation |
| zustand | 5.0.12 | State management (already installed) | Project's existing state management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | - | Layout algorithm is simple grid-packing | Custom ~80 lines of code, no dependency needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom grid layout | dagre / elkjs | Overkill -- these are graph layout libs for DAG/tree structures; Panescale has unconnected rectangular tiles, not a graph |
| Custom grid layout | d3-hierarchy | Same issue -- designed for hierarchical data, not free-form tile arrangement |
| Spatial containment grouping | React Flow `parentId` sub-flows | `parentId` gives auto-follow on parent drag for free, but requires coordinate migration (children use relative coords), array ordering constraints, and makes "ungroup on move out" harder |

**No new packages needed.** All features can be built with existing dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    autoLayout.ts          # Beautify layout algorithm (grid-packing)
    grouping.ts            # Auto-group by cwd logic, group container management
  components/
    canvas/
      Canvas.tsx           # Add beautify button, auto-group trigger
      RegionNode.tsx       # Extended with groupId semantics (minor changes)
      BeautifyButton.tsx   # Floating toolbar button (or context menu entry)
  stores/
    canvasStore.ts         # New actions: beautifyLayout, autoGroupByCwd, createGroup, dissolveGroup
```

### Pattern 1: Grid-Packing Layout Algorithm
**What:** Arrange all tiles in a compact grid respecting Piles tab ordering. Tiles maintain their current sizes but get new positions.
**When to use:** When user clicks "Beautify" / auto-arrange button.
**Example:**
```typescript
// src/lib/autoLayout.ts
import { type Node } from "@xyflow/react";
import { GRID_SIZE } from "./gridSnap";

interface LayoutOptions {
  gap: number;        // spacing between tiles (default: 40)
  columns?: number;   // auto-calculated if not provided
  padding: number;    // top-left offset (default: 40)
}

export function computeGridLayout(
  nodes: Node[],
  orderedIds: string[],  // from pileOrder
  options: LayoutOptions = { gap: 40, padding: 40 }
): Map<string, { x: number; y: number }> {
  const { gap, padding } = options;
  const positions = new Map<string, { x: number; y: number }>();

  // Separate regions from content nodes
  const contentNodes = nodes.filter(n => n.type !== "region");
  const orderedNodes = sortByPileOrder(contentNodes, orderedIds);

  // Simple row-based packing: place tiles left-to-right, wrap when exceeding max width
  const maxRowWidth = Math.max(
    1200,
    Math.sqrt(orderedNodes.length) * 700
  );
  let x = padding;
  let y = padding;
  let rowHeight = 0;

  for (const node of orderedNodes) {
    const w = (node.style?.width as number) ?? 640;
    const h = (node.style?.height as number) ?? 480;

    if (x + w > maxRowWidth && x > padding) {
      // Wrap to next row
      x = padding;
      y += rowHeight + gap;
      rowHeight = 0;
    }

    // Snap to grid
    const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;
    positions.set(node.id, { x: snappedX, y: snappedY });

    x += w + gap;
    rowHeight = Math.max(rowHeight, h);
  }

  return positions;
}
```

### Pattern 2: Auto-Group by CWD
**What:** Scan all terminal nodes, find clusters sharing the same `cwd`, and create/update region containers around them.
**When to use:** Triggered by a button or automatically after beautify.
**Example:**
```typescript
// src/lib/grouping.ts
import { type Node } from "@xyflow/react";

export function detectCwdGroups(nodes: Node[]): Map<string, Node[]> {
  const groups = new Map<string, Node[]>();
  for (const node of nodes) {
    if (node.type !== "terminal") continue;
    const cwd = (node.data as Record<string, unknown>).cwd as string;
    if (!cwd) continue;
    const existing = groups.get(cwd) || [];
    existing.push(node);
    groups.set(cwd, existing);
  }
  // Only return groups with 2+ terminals
  for (const [cwd, members] of groups) {
    if (members.length < 2) groups.delete(cwd);
  }
  return groups;
}

export function computeRegionBounds(
  members: Node[],
  padding = 20,
  headerHeight = 32
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of members) {
    const w = (n.style?.width as number) ?? 640;
    const h = (n.style?.height as number) ?? 480;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  return {
    x: minX - padding,
    y: minY - padding - headerHeight,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2 + headerHeight,
  };
}
```

### Pattern 3: Spatial Containment Group Drag (Already Exists)
**What:** The existing `handleNodeDragStart` / `handleNodeDrag` in Canvas.tsx already captures initial positions of nodes contained within a region's bounding box and moves them by the same delta. This is the group-drag pattern.
**When to use:** No changes needed to the existing pattern. It already works for region group drag.

### Pattern 4: Auto-Dissolve on Move-Out
**What:** When a child tile is dragged outside its containing region, check if the region has fewer than 2 remaining children. If so, dissolve (remove) the region.
**When to use:** In `handleNodeDragStop` callback.
**Example:**
```typescript
// In Canvas.tsx handleNodeDragStop
const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
  setSnapLines(null);
  setAlignGuides([]);

  // Check if any region now has < 2 contained nodes
  if (node.type !== "region") {
    const regions = nodes.filter(n => n.type === "region");
    for (const region of regions) {
      const rw = (region.style?.width as number) ?? 400;
      const rh = (region.style?.height as number) ?? 300;
      const rx = region.position.x;
      const ry = region.position.y;

      let containedCount = 0;
      for (const n of nodes) {
        if (n.id === region.id || n.type === "region") continue;
        if (n.position.x >= rx && n.position.y >= ry &&
            n.position.x < rx + rw && n.position.y < ry + rh) {
          containedCount++;
        }
      }
      if (containedCount < 2) {
        removeNode(region.id);
      }
    }
  }

  regionDragRef.current = null;
}, [setSnapLines, nodes, removeNode]);
```

### Anti-Patterns to Avoid
- **Using `parentId` for grouping:** Requires converting all child positions from absolute to relative coordinates, breaks existing persistence format, and makes "ungroup on drag out" significantly harder since React Flow auto-constrains children to parent bounds with `extent: 'parent'`.
- **External layout libraries for non-graph layouts:** dagre/elkjs are designed for connected graph layouts. Panescale tiles are independent rectangles -- a simple grid-pack is more appropriate and avoids a 200KB+ dependency.
- **Computing groups on every render:** Group detection should only run on explicit user action (button click), not reactively on every node change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grid snapping | Custom grid math | Existing `magneticSnapPosition` in `gridSnap.ts` | Already handles grid alignment perfectly |
| Drag-and-drop reorder | Custom DnD | Existing `@dnd-kit` in TerminalList | Pile order already managed |
| Region group drag | New group drag system | Existing `regionDragRef` pattern in Canvas.tsx | Already works -- just extend it |

**Key insight:** Most of the infrastructure for this phase already exists. The region system, group-drag, bounding-box containment, and grid snapping are all in place. The new work is primarily: (1) a layout algorithm function, (2) a cwd-grouping detection function, (3) UI buttons/triggers, and (4) auto-dissolve logic.

## Common Pitfalls

### Pitfall 1: Layout Algorithm Ignoring Tile Sizes
**What goes wrong:** Treating all tiles as same-size produces overlapping layouts because terminals, notes, webviews, and file previews all have different dimensions.
**Why it happens:** Simplified grid assumes uniform tile size.
**How to avoid:** Use actual `node.style.width` / `node.style.height` for each tile when computing positions. Use row-based packing where row height = tallest tile in that row.
**Warning signs:** Overlapping tiles after beautify.

### Pitfall 2: Losing CWD Data for Auto-Grouping
**What goes wrong:** Terminal `cwd` in node data is the initial spawn directory, not the current working directory. User may have `cd`'d elsewhere.
**Why it happens:** The `cwd` field is set at spawn time and never updated. Process title comes from terminal escape sequences but is the process name, not the directory.
**How to avoid:** Document that auto-group uses the *initial spawn directory* (which is reasonable since it represents the project context). If tmux is available, could query `pane_current_path` for live cwd, but this is an enhancement, not a requirement.
**Warning signs:** Groups that don't match user's mental model of "same directory."

### Pitfall 3: Region Bounding Box vs Node Position
**What goes wrong:** The containment check uses `node.position.x` (top-left corner) but doesn't account for the node's full area. A tile whose top-left is outside the region but whose body overlaps is considered "not contained."
**Why it happens:** The existing check `nx >= rx && ny >= ry && nx < rx + rw && ny < ry + rh` only checks the top-left corner.
**How to avoid:** This is actually the correct behavior for group-drag (it matches how users think about "is this tile in the region?"). Keep it as-is but document the semantics.

### Pitfall 4: Beautify Destroying Manual Arrangements
**What goes wrong:** User has carefully arranged tiles and accidentally clicks beautify, losing their layout.
**Why it happens:** No undo mechanism.
**How to avoid:** Store the previous positions before beautify so the action can be reversed. At minimum, use `window.confirm("Rearrange all tiles? This will change their positions.")` as a guard. Better: store pre-beautify state and add an "Undo beautify" option.
**Warning signs:** User frustration, feature avoidance.

### Pitfall 5: Infinite Loop in Auto-Dissolve
**What goes wrong:** Dissolving a region triggers a node change, which triggers auto-dissolve check again.
**Why it happens:** If dissolve logic runs reactively on every node change.
**How to avoid:** Only run dissolve check in `handleNodeDragStop` (which fires once per drag operation), not in `onNodesChange`.

## Code Examples

### Beautify Button UI
```typescript
// Floating button in Canvas, above the canvas area
<button
  onClick={() => {
    if (!window.confirm("Rearrange all tiles on the canvas?")) return;
    const { nodes, pileOrder } = useCanvasStore.getState();
    const positions = computeGridLayout(nodes, pileOrder);
    const changes: NodeChange[] = [];
    for (const [id, pos] of positions) {
      changes.push({ type: "position", id, position: pos, dragging: false });
    }
    useCanvasStore.getState().onNodesChange(changes);
    forceSave();
  }}
  title="Auto-arrange tiles"
  style={{
    position: "absolute", bottom: 16, right: 16, zIndex: 1000,
    background: "var(--bg-secondary)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "8px 16px", cursor: "pointer",
    color: "var(--text-primary)", fontSize: 13,
  }}
>
  Beautify
</button>
```

### Auto-Group by CWD Integration
```typescript
// canvasStore action
autoGroupByCwd: () => {
  const state = get();
  const cwdGroups = detectCwdGroups(state.nodes);

  // Remove existing auto-generated regions (tagged with autoGroup: true)
  const manualNodes = state.nodes.filter(n =>
    n.type !== "region" || !(n.data as Record<string, unknown>).autoGroup
  );

  const newRegions: Node[] = [];
  for (const [cwd, members] of cwdGroups) {
    const bounds = computeRegionBounds(members);
    const dirName = cwd.split(/[\\/]/).pop() || cwd;
    newRegions.push({
      id: crypto.randomUUID(),
      type: "region",
      position: { x: bounds.x, y: bounds.y },
      data: { regionName: dirName, regionColor: REGION_COLORS[newRegions.length % REGION_COLORS.length], autoGroup: true },
      dragHandle: ".region-drag-handle",
      style: { width: bounds.width, height: bounds.height },
      zIndex: -1,
    });
  }

  set({ nodes: [...manualNodes, ...newRegions] });
  forceSave();
},
```

### Context Menu Extension for Manual Grouping
```typescript
// Already partially exists in Canvas.tsx handleGroupAsRegion
// Enhancement: also add "Auto-group by directory" option
{contextMenu && (
  <div style={contextMenuStyle}>
    <button onClick={handleContextMenuNewTerminal}>New Terminal</button>
    <button onClick={handleContextMenuNewBrowser}>New Browser</button>
    <hr style={{ margin: "4px 0", border: "none", borderTop: "1px solid var(--border)" }} />
    {contextMenu.hasSelection && (
      <button onClick={handleGroupAsRegion}>Group as Region</button>
    )}
    <button onClick={handleAutoGroupByCwd}>Auto-group by Directory</button>
    <button onClick={handleBeautify}>Beautify Layout</button>
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `parentNode` property | `parentId` property | React Flow v12 (2024) | Renamed for clarity, same behavior |
| Manual position tracking for group drag | Existing `regionDragRef` pattern | Phase 3 implementation | Already works, just extend |
| No layout algorithm | Grid-packing with pile order | Phase 9 (new) | First auto-layout capability |

**Deprecated/outdated:**
- `node.parentNode`: Renamed to `node.parentId` in React Flow v12. The project does NOT currently use either -- it uses spatial containment instead.

## Open Questions

1. **Should beautify preserve regions or recreate them?**
   - What we know: Beautify rearranges tile positions. Existing regions will no longer contain their tiles after positions change.
   - What's unclear: Should beautify also remove all regions and optionally re-create via auto-group, or try to keep regions and move their contents together?
   - Recommendation: Beautify should remove auto-generated regions (tagged with `autoGroup: true`) but preserve manual regions. After beautify, offer to run auto-group.

2. **Should auto-group run automatically after beautify?**
   - What we know: After beautify, tiles with same cwd will be adjacent (because pile order groups them).
   - What's unclear: User expectation -- auto-group silently or ask?
   - Recommendation: Add a "Beautify & Group" combined action plus separate buttons.

3. **Live CWD tracking for better grouping**
   - What we know: Terminal `cwd` is set at spawn time. Tmux's `pane_current_path` could provide live cwd.
   - What's unclear: Performance impact of querying tmux for all terminals.
   - Recommendation: Use spawn-time cwd for v1. Live cwd tracking is a future enhancement.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | vitest.config.ts |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYOUT-01 | Beautify computes grid positions without overlap | unit | `npx vitest run src/test/autoLayout.test.ts -t "grid layout"` | No - Wave 0 |
| LAYOUT-02 | Beautify respects pile order | unit | `npx vitest run src/test/autoLayout.test.ts -t "pile order"` | No - Wave 0 |
| GROUP-01 | detectCwdGroups finds terminals with same cwd | unit | `npx vitest run src/test/grouping.test.ts -t "cwd groups"` | No - Wave 0 |
| GROUP-02 | computeRegionBounds calculates correct bounding box | unit | `npx vitest run src/test/grouping.test.ts -t "region bounds"` | No - Wave 0 |
| GROUP-03 | Auto-dissolve removes region when < 2 children | unit | `npx vitest run src/test/grouping.test.ts -t "dissolve"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/test/autoLayout.test.ts` -- covers LAYOUT-01, LAYOUT-02
- [ ] `src/test/grouping.test.ts` -- covers GROUP-01, GROUP-02, GROUP-03

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/stores/canvasStore.ts`, `src/components/canvas/Canvas.tsx`, `src/components/canvas/RegionNode.tsx`, `src/lib/persistence.ts`, `src/lib/gridSnap.ts`
- [React Flow Sub Flows docs](https://reactflow.dev/learn/layouting/sub-flows) - parentId behavior, coordinate systems
- [React Flow Selection Grouping example](https://reactflow.dev/examples/grouping/selection-grouping) - dynamic grouping patterns
- [React Flow Auto Layout overview](https://reactflow.dev/learn/layouting/layouting) - layout algorithm options

### Secondary (MEDIUM confidence)
- [React Flow v12 migration guide](https://reactflow.dev/learn/troubleshooting/migrate-to-v12) - parentNode -> parentId rename
- [React Flow dagre example](https://reactflow.dev/examples/layout/dagre) - confirmed dagre is for graph DAGs, not free-form tiles

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing
- Architecture: HIGH - extending well-understood existing patterns (RegionNode, group-drag, grid snap)
- Pitfalls: HIGH - identified from direct codebase analysis and understanding of data flow
- Layout algorithm: MEDIUM - grid-packing is straightforward but edge cases (very different tile sizes) need testing

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- no external dependency changes expected)
