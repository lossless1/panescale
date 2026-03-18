export const GRID_SIZE = 20; // 20px grid spacing (matches background dot gap)
export const SNAP_THRESHOLD = 10; // Magnetic range in pixels

/**
 * Magnetic snap: returns nearest grid line if within threshold, otherwise the original value.
 */
export function magneticSnap(
  value: number,
  gridSize = GRID_SIZE,
  threshold = SNAP_THRESHOLD,
): number {
  const nearest = Math.round(value / gridSize) * gridSize;
  const distance = Math.abs(value - nearest);
  return distance <= threshold ? nearest : value;
}

/**
 * Snap both position axes. Returns { x, y, snappedX, snappedY } where
 * snappedX/snappedY are booleans indicating if snap occurred on that axis.
 */
export function magneticSnapPosition(
  x: number,
  y: number,
  gridSize = GRID_SIZE,
  threshold = SNAP_THRESHOLD,
): { x: number; y: number; snappedX: boolean; snappedY: boolean } {
  const snappedXVal = magneticSnap(x, gridSize, threshold);
  const snappedYVal = magneticSnap(y, gridSize, threshold);
  return {
    x: snappedXVal,
    y: snappedYVal,
    snappedX: snappedXVal !== x,
    snappedY: snappedYVal !== y,
  };
}

/**
 * Snap a size (width or height) so the far edge aligns to a grid point.
 * Given origin position and size, snap the far edge (origin + size) to grid,
 * then return the adjusted size.
 */
export function magneticSnapSize(
  origin: number,
  size: number,
  gridSize = GRID_SIZE,
  threshold = SNAP_THRESHOLD,
): { size: number; snapped: boolean } {
  const farEdge = origin + size;
  const snappedEdge = magneticSnap(farEdge, gridSize, threshold);
  return {
    size: snappedEdge - origin,
    snapped: snappedEdge !== farEdge,
  };
}
