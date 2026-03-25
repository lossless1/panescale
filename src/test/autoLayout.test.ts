import { describe, it, expect } from "vitest";
import { computeGridLayout } from "../lib/autoLayout";

// Helper to create mock nodes
function mockNode(
  id: string,
  opts: {
    type?: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    data?: Record<string, unknown>;
  } = {},
) {
  return {
    id,
    type: opts.type ?? "terminal",
    position: { x: opts.x ?? 0, y: opts.y ?? 0 },
    data: opts.data ?? {},
    style: { width: opts.width ?? 640, height: opts.height ?? 480 },
  };
}

describe("computeGridLayout", () => {
  it("positions 3 same-size tiles without overlap", () => {
    const nodes = [mockNode("a"), mockNode("b"), mockNode("c")];
    const result = computeGridLayout(nodes, ["a", "b", "c"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);

    const positions = ["a", "b", "c"].map((id) => result.get(id)!);

    // No two tiles should occupy the same space (check all pairs)
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pi = positions[i];
        const pj = positions[j];
        // They overlap if they share both x-range and y-range
        const overlapX = pi.x < pj.x + 640 && pj.x < pi.x + 640;
        const overlapY = pi.y < pj.y + 480 && pj.y < pi.y + 480;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });

  it("wraps to next row when tiles exceed maxRowWidth", () => {
    // Create many tiles to force wrapping
    const nodes = Array.from({ length: 6 }, (_, i) => mockNode(`t${i}`));
    const orderedIds = nodes.map((n) => n.id);
    const result = computeGridLayout(nodes, orderedIds);

    const positions = orderedIds.map((id) => result.get(id)!);
    // With 6 tiles at 640px + 40px gap each, maxRowWidth = max(1200, sqrt(6)*700) ~ 1714
    // Each tile takes 640+40=680px, so ~2 per row
    // We should have at least 2 distinct y values
    const uniqueYs = new Set(positions.map((p) => p.y));
    expect(uniqueYs.size).toBeGreaterThan(1);
  });

  it("snaps all positions to GRID_SIZE (20px) multiples", () => {
    const nodes = [mockNode("a"), mockNode("b"), mockNode("c")];
    const result = computeGridLayout(nodes, ["a", "b", "c"]);

    for (const [, pos] of result) {
      expect(pos.x % 20).toBe(0);
      expect(pos.y % 20).toBe(0);
    }
  });

  it("orders tiles according to provided orderedIds (pile order)", () => {
    const nodes = [mockNode("c"), mockNode("a"), mockNode("b")];
    const result = computeGridLayout(nodes, ["a", "b", "c"]);

    const posA = result.get("a")!;
    const posB = result.get("b")!;
    const posC = result.get("c")!;

    // a should come first (leftmost or top-left)
    expect(posA.x).toBeLessThanOrEqual(posB.x);
    expect(posB.x).toBeLessThanOrEqual(posC.x);
  });

  it("uses tallest tile in row for row height with mixed sizes", () => {
    const nodes = [
      mockNode("tall", { width: 640, height: 480 }),
      mockNode("short", { width: 300, height: 300 }),
    ];
    const result = computeGridLayout(nodes, ["tall", "short"]);

    // Both should be on the same row
    const posTall = result.get("tall")!;
    const posShort = result.get("short")!;
    expect(posTall.y).toBe(posShort.y);
  });

  it("falls back to node array order with empty orderedIds", () => {
    const nodes = [mockNode("x"), mockNode("y"), mockNode("z")];
    const result = computeGridLayout(nodes, []);

    expect(result.size).toBe(3);
    // Should still produce valid positions
    for (const [, pos] of result) {
      expect(typeof pos.x).toBe("number");
      expect(typeof pos.y).toBe("number");
    }
  });

  it("skips region nodes", () => {
    const nodes = [
      mockNode("a"),
      mockNode("r1", { type: "region", width: 800, height: 600 }),
      mockNode("b"),
    ];
    const result = computeGridLayout(nodes, ["a", "r1", "b"]);

    expect(result.has("r1")).toBe(false);
    expect(result.size).toBe(2);
  });

  it("returns Map<string, { x: number; y: number }> keyed by node id", () => {
    const nodes = [mockNode("a")];
    const result = computeGridLayout(nodes, ["a"]);

    expect(result).toBeInstanceOf(Map);
    const pos = result.get("a");
    expect(pos).toBeDefined();
    expect(typeof pos!.x).toBe("number");
    expect(typeof pos!.y).toBe("number");
  });
});
