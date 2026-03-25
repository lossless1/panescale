import { describe, it, expect } from "vitest";
import { detectCwdGroups, computeRegionBounds } from "../lib/grouping";

function mockNode(
  id: string,
  opts: {
    type?: string;
    cwd?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } = {},
) {
  return {
    id,
    type: opts.type ?? "terminal",
    position: { x: opts.x ?? 0, y: opts.y ?? 0 },
    data: { cwd: opts.cwd } as Record<string, unknown>,
    style: { width: opts.width ?? 640, height: opts.height ?? 480 },
  };
}

describe("detectCwdGroups", () => {
  it("groups 2+ terminals sharing the same cwd", () => {
    const nodes = [
      mockNode("a", { cwd: "/foo" }),
      mockNode("b", { cwd: "/foo" }),
      mockNode("c", { cwd: "/bar" }),
    ];
    const groups = detectCwdGroups(nodes);

    expect(groups).toBeInstanceOf(Map);
    expect(groups.size).toBe(1);
    expect(groups.has("/foo")).toBe(true);
    expect(groups.get("/foo")!.length).toBe(2);
    expect(groups.get("/foo")!.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("ignores non-terminal nodes (notes, images, regions)", () => {
    const nodes = [
      mockNode("a", { type: "terminal", cwd: "/foo" }),
      mockNode("b", { type: "note", cwd: "/foo" }),
      mockNode("c", { type: "region", cwd: "/foo" }),
      mockNode("d", { type: "terminal", cwd: "/foo" }),
    ];
    const groups = detectCwdGroups(nodes);

    expect(groups.size).toBe(1);
    expect(groups.get("/foo")!.length).toBe(2);
    expect(groups.get("/foo")!.map((n) => n.id).sort()).toEqual(["a", "d"]);
  });

  it("excludes groups with only 1 terminal (minimum 2 to form a group)", () => {
    const nodes = [
      mockNode("a", { cwd: "/foo" }),
      mockNode("b", { cwd: "/bar" }),
      mockNode("c", { cwd: "/baz" }),
    ];
    const groups = detectCwdGroups(nodes);

    expect(groups.size).toBe(0);
  });

  it("handles terminals with no cwd gracefully (skips them)", () => {
    const nodes = [
      mockNode("a", { cwd: "/foo" }),
      mockNode("b", {}), // no cwd
      mockNode("c", { cwd: "/foo" }),
    ];
    const groups = detectCwdGroups(nodes);

    expect(groups.size).toBe(1);
    expect(groups.get("/foo")!.length).toBe(2);
  });
});

describe("computeRegionBounds", () => {
  it("calculates correct bounding box with default padding and headerHeight", () => {
    const members = [
      mockNode("a", { x: 100, y: 100, width: 640, height: 480 }),
      mockNode("b", { x: 800, y: 100, width: 640, height: 480 }),
    ];
    const bounds = computeRegionBounds(members);

    // Default padding=20, headerHeight=32
    // minX=100, minY=100, maxX=800+640=1440, maxY=100+480=580
    expect(bounds.x).toBe(100 - 20); // 80
    expect(bounds.y).toBe(100 - 20 - 32); // 48
    expect(bounds.width).toBe(1440 - 100 + 20 * 2); // 1380
    expect(bounds.height).toBe(580 - 100 + 20 * 2 + 32); // 552
  });

  it("supports configurable padding and headerHeight", () => {
    const members = [
      mockNode("a", { x: 0, y: 0, width: 100, height: 100 }),
    ];
    const bounds = computeRegionBounds(members, 10, 40);

    // minX=0, minY=0, maxX=100, maxY=100
    expect(bounds.x).toBe(0 - 10); // -10
    expect(bounds.y).toBe(0 - 10 - 40); // -50
    expect(bounds.width).toBe(100 - 0 + 10 * 2); // 120
    expect(bounds.height).toBe(100 - 0 + 10 * 2 + 40); // 140
  });
});
