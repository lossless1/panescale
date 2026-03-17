import { describe, it } from "vitest";

describe("persistence", () => {
  describe("serializeCanvas", () => {
    it.todo("extracts nodes and viewport from canvas state");
  });

  describe("deserializeCanvas", () => {
    it.todo("restores canvasStore-compatible state from snapshot");
  });

  describe("forceSave", () => {
    it.todo("clears pending debounce and saves immediately");
  });

  describe("initPersistence", () => {
    it.todo("subscribes to canvasStore changes");
  });

  describe("canvasStore integration", () => {
    it.todo("addTerminalNode triggers immediate save");
    it.todo("removeNode triggers immediate save");
  });
});
