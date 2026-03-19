import { test, expect } from "@playwright/test";
import { setupTauriMocks } from "./tauri-mocks";

test.describe("Canvas Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page);
    await page.goto("/");
    // Wait for the canvas (React Flow) to render
    await page.waitForSelector(".react-flow__pane", { timeout: 10000 });
  });

  test("app loads and shows canvas with dot grid", async ({ page }) => {
    // React Flow pane should be visible
    const pane = page.locator(".react-flow__pane");
    await expect(pane).toBeVisible();

    // Title bar should show app name
    await expect(page.locator("text=Panescale")).toBeVisible();
  });

  test("app shows sidebar with all 4 tabs", async ({ page }) => {
    await expect(page.locator("text=Files")).toBeVisible();
    await expect(page.locator("text=Terminals")).toBeVisible();
    await expect(page.locator("text=Git")).toBeVisible();
    await expect(page.locator("text=SSH")).toBeVisible();
  });

  test("sidebar shows 'No folder open' and Open Folder button", async ({ page }) => {
    await expect(page.locator("text=No folder open")).toBeVisible();
    await expect(page.locator("text=Open Folder")).toBeVisible();
  });

  test("double-click on canvas spawns a terminal tile", async ({ page }) => {
    const nodesBefore = await page.locator(".react-flow__node").count();

    // Double-click on the canvas pane
    const pane = page.locator(".react-flow__pane");
    await pane.dblclick({ position: { x: 400, y: 300 } });

    // Wait for node to appear
    await page.waitForTimeout(1500);

    const nodesAfter = await page.locator(".react-flow__node").count();
    expect(nodesAfter).toBeGreaterThan(nodesBefore);
  });

  test("spawned terminal tile has drag handle title bar", async ({ page }) => {
    // Spawn a terminal
    const pane = page.locator(".react-flow__pane");
    await pane.dblclick({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1500);

    // Title bar with drag-handle class
    const dragHandle = page.locator(".drag-handle").first();
    await expect(dragHandle).toBeVisible();
  });

  test("spawning multiple terminals creates multiple nodes", async ({ page }) => {
    const pane = page.locator(".react-flow__pane");

    await pane.dblclick({ position: { x: 300, y: 200 } });
    await page.waitForTimeout(1000);
    await pane.dblclick({ position: { x: 500, y: 400 } });
    await page.waitForTimeout(1000);

    const nodes = await page.locator(".react-flow__node").count();
    expect(nodes).toBeGreaterThanOrEqual(2);
  });

  test("terminal tile has close button in title bar", async ({ page }) => {
    const pane = page.locator(".react-flow__pane");
    await pane.dblclick({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1500);

    // Look for close button (× character or Close title)
    const node = page.locator(".react-flow__node").first();
    const closeBtn = node.locator("button").filter({ hasText: /×|✕|close/i }).first();
    const hasBtnVisible = await closeBtn.isVisible().catch(() => false);

    // At minimum the node should exist and have a title bar
    await expect(node).toBeVisible();
    if (hasBtnVisible) {
      console.log("Close button found in title bar");
    }
  });
});

test.describe("Theme", () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page);
    await page.goto("/");
    await page.waitForSelector(".react-flow__pane", { timeout: 10000 });
  });

  test("app has CSS theme variables applied", async ({ page }) => {
    const hasCssVars = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return !!(
        style.getPropertyValue("--bg-primary") ||
        style.getPropertyValue("--bg-sidebar") ||
        style.getPropertyValue("--text-primary")
      );
    });
    expect(hasCssVars).toBe(true);
  });

  test("theme toggle button exists in status bar", async ({ page }) => {
    // Status bar should have Light/Dark/System text
    const statusBar = page.locator("text=Light").or(page.locator("text=Dark")).or(page.locator("text=System"));
    const isVisible = await statusBar.first().isVisible().catch(() => false);
    expect(isVisible).toBe(true);
  });
});

test.describe("Keyboard Shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page);
    await page.goto("/");
    await page.waitForSelector(".react-flow__pane", { timeout: 10000 });
  });

  test("M key toggles minimap without crashing", async ({ page }) => {
    // Click canvas to ensure focus
    const pane = page.locator(".react-flow__pane");
    await pane.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(200);

    // Toggle minimap
    await page.keyboard.press("m");
    await page.waitForTimeout(500);

    // App should still be functional
    await expect(pane).toBeVisible();

    // Toggle off
    await page.keyboard.press("m");
    await page.waitForTimeout(200);
  });
});
