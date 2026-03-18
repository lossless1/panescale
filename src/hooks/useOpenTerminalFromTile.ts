import { useCallback } from "react";
import { useCanvasStore } from "../stores/canvasStore";
import { useProjectStore } from "../stores/projectStore";

/**
 * Hook that returns a callback to spawn a terminal tile adjacent to a content tile.
 * The terminal opens in the file's parent directory (or active project dir as fallback).
 */
export function useOpenTerminalFromTile(nodeId: string) {
  return useCallback(
    (filePath: string | undefined) => {
      const state = useCanvasStore.getState();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      // Extract parent directory from file path
      let cwd: string;
      if (filePath) {
        // Handle both Unix and Windows path separators
        const lastSep = Math.max(
          filePath.lastIndexOf("/"),
          filePath.lastIndexOf("\\"),
        );
        cwd = lastSep > 0 ? filePath.substring(0, lastSep) : filePath;
      } else {
        cwd =
          useProjectStore.getState().activeProject()?.path ?? "~";
      }

      // Spawn position: offset to the right of the source tile
      const tileWidth = (node.style?.width as number) ?? 640;
      const spawnPosition = {
        x: node.position.x + tileWidth + 40,
        y: node.position.y,
      };

      state.addTerminalNode(spawnPosition, cwd);
    },
    [nodeId],
  );
}
