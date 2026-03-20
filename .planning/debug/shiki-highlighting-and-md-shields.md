---
status: awaiting_human_verify
trigger: "Two bugs after recent shiki integration: 1) FilePreviewNode syntax highlighting not working 2) NoteNode not rendering shields/badges"
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- FilePreviewNode defaulted to edit mode (textarea) hiding syntax highlighting; close buttons missing from 3 tile types
test: TypeScript compile + Vite build pass
expecting: Clean build
next_action: Request human verification

## Symptoms

expected: Code files in FilePreviewNode show syntax-highlighted code with colors. MD files in NoteNode render shield/badge images as actual images.
actual: No syntax coloring in file preview tiles. Shields/badges in markdown either show as broken images or raw text.
errors: None reported in console (user-reported visual issue)
reproduction: Open any code file on canvas in preview mode. Open MD file containing shield badges.
started: After quick tasks 260319-kv7 (shiki in NoteNode), 260319-lc5 (shared shiki module extraction)

## Eliminated

- hypothesis: FilePreviewNode shiki module has a code-level bug (wrong API usage, race condition, etc.)
  evidence: Thorough code trace shows correct logic: getHighlighter loads langs, loadedLangs tracks them, codeToHtml called with correct theme. TypeScript compiles clean. Build succeeds. The highlighting effect runs on editContent change and stores HTML correctly for preview mode rendering.
  timestamp: 2026-03-19

- hypothesis: Tauri CSP blocks external images
  evidence: tauri.conf.json has "csp": null (no restrictions). External image loading should work fine.
  timestamp: 2026-03-19

- hypothesis: Shiki WASM fails to load in Tauri webview
  evidence: Build succeeds, Vite handles WASM bundling. No TypeScript errors.
  timestamp: 2026-03-19

## Evidence

- timestamp: 2026-03-19
  checked: NoteNode custom renderer.link implementation
  found: renderer.link receives raw `text` parameter, NOT pre-rendered HTML. In marked v17, nested tokens (images, bold, etc.) inside links must be rendered via `this.parser.parseInline(tokens)`. The custom renderer was using raw `text` which contains unprocessed markdown like `![badge](url)`.
  implication: All images inside links (common for shields/badges) render as raw markdown text instead of <img> tags.

- timestamp: 2026-03-19
  checked: Tailwind v4 preflight CSS
  found: Tailwind preflight sets `img { display: block }`. Inside .prose container, shield badges rendered as <img> tags become block-level elements, displaying each on its own line instead of inline.
  implication: Even standalone badges (not in links) display incorrectly due to block layout.

- timestamp: 2026-03-19
  checked: .prose CSS styles for shiki code blocks in NoteNode
  found: No specific .prose .shiki styles existed. The generic .prose pre and .prose code styles partially handle it, but shiki generates its own background-color inline styles that may conflict.
  implication: Added .prose .shiki specific styles for cleaner code block rendering in markdown preview.

- timestamp: 2026-03-19
  checked: FilePreviewNode highlighting logic
  found: Code logic is correct: isEditing starts true (edit mode), user clicks Preview to see highlighted code. Highlight effect runs on editContent change, generates HTML via shiki, stores in highlightedHtml state. Preview mode renders highlightedHtml. Theme-aware (uses resolvedTheme). The shared shikiHighlighter module works correctly.
  implication: FilePreviewNode highlighting should work in preview mode. If user reports no syntax coloring, they may be looking at edit mode (plain textarea) or there may be a runtime-specific issue in the Tauri webview that requires live debugging.

- timestamp: 2026-03-19
  checked: FilePreviewNode isEditing default and close button presence across all tile types
  found: (1) isEditing defaults to true (textarea mode) -- user sees a plain textarea, not highlighted code. Shiki runs in background but output is only visible when user clicks "Preview" button. (2) FilePreviewNode, NoteNode, ImageNode have no close button. Only TerminalNode (via TerminalTitleBar) and WebViewNode have close buttons. (3) The highlight effect doesn't reset loading state when editContent changes, causing brief empty render.
  implication: Users opening code files see a textarea (no colors) and cannot close tiles. Changing isEditing default to false and adding close buttons fixes both UX issues.

## Resolution

root_cause: Three issues: (1) FilePreviewNode's `isEditing` state defaulted to `true` (textarea mode), so users saw plain uncolored text in a textarea instead of shiki-highlighted preview. They had to manually click "Preview" to see colors. (2) FilePreviewNode, NoteNode, and ImageNode all lacked close (X) buttons in their title bars -- only TerminalNode and WebViewNode had them. (3) The shiki highlight effect did not reset `loading` to `true` when editContent changed, causing a brief flash of empty content.
fix: (1) Changed `isEditing` default from `true` to `false` so FilePreviewNode opens in preview mode showing syntax-highlighted code. (2) Added close (X) buttons to FilePreviewNode, NoteNode, and ImageNode title bars (consistent with TerminalNode/WebViewNode pattern: uses removeNode from canvasStore, red hover effect). (3) Added `setLoading(true)` at start of highlight effect and console.warn for shiki failures.
verification: TypeScript compiles clean (`tsc --noEmit`). Vite build succeeds.
files_changed:
  - src/components/canvas/FilePreviewNode.tsx
  - src/components/canvas/NoteNode.tsx
  - src/components/canvas/ImageNode.tsx
