---
created: 2026-03-18T08:00:00.000Z
title: Native browser tile support on canvas
area: ui
files:
  - src/components/canvas/Canvas.tsx
  - src/stores/canvasStore.ts
---

## Problem

Currently the canvas supports terminal tiles and (in Phase 5) content tiles (notes, images, file previews). There's no way to embed a web browser view on the canvas. Users may want to view docs, API references, or web apps alongside their terminal sessions.

Note: This was listed as an anti-feature in initial research (Collaborator issue #17 requested it too). The concern was security and complexity. However, Tauri v2 supports multiple webviews natively, which could make this more feasible than in Electron.

## Solution

Add a "Browser" tile type to the canvas that renders a Tauri webview. Key considerations:
- Tauri v2 multi-webview API for embedding web content
- URL bar in the tile title area
- Navigation controls (back, forward, refresh)
- Security: sandbox the webview, restrict access to local filesystem
- Consider whether to use Tauri's built-in webview or an iframe approach

This is a v2+ feature — currently listed under CANV-V2-02 in requirements. Could become its own phase.
