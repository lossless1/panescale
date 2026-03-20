---
status: awaiting_human_verify
trigger: "When switching projects via sidebar dropdown from project A to project B, newly spawned terminals still open with project A's root path instead of project B's."
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - handlePaneDoubleClick had stale closure over projectPath
test: Added projectPath to useCallback dependency array
expecting: New terminals spawned via double-click now use current active project path
next_action: Awaiting human verification

## Symptoms

expected: After switching to project B in the sidebar dropdown, newly opened terminals should start in project B's root directory.
actual: New terminals still open in project A's root path after switching to project B.
errors: No error messages — functional bug where CWD doesn't update.
reproduction: 1) Open app with project A active. 2) Open a terminal — opens at project A path. 3) Switch to project B via sidebar dropdown. 4) Open a new terminal — still opens at project A path.
started: Likely always been this way.

## Eliminated

## Evidence

- timestamp: 2026-03-19
  checked: Canvas.tsx line 100 - projectPath derivation
  found: projectPath is reactively derived from useProjectStore via s.projects[s.activeProjectIndex]?.path - this is correct
  implication: The reactive value itself updates correctly when project changes

- timestamp: 2026-03-19
  checked: Canvas.tsx line 302-321 - handlePaneDoubleClick callback
  found: useCallback dependency array was [reactFlow, addTerminalNode] - MISSING projectPath
  implication: Stale closure - projectPath captured at first render, never updated when project changes

- timestamp: 2026-03-19
  checked: Canvas.tsx line 344-352 - handleContextMenuNewTerminal callback
  found: This callback correctly includes projectPath in its dependency array
  implication: Context menu "New Terminal" would work correctly, but double-click would not

- timestamp: 2026-03-19
  checked: useOpenTerminalFromTile.ts - alternative spawn path
  found: Uses useProjectStore.getState() which always gets latest state
  implication: Only the double-click spawn path in Canvas.tsx was affected

- timestamp: 2026-03-19
  checked: TypeScript compilation after fix
  found: npx tsc --noEmit passes with zero errors
  implication: Fix is type-safe

## Resolution

root_cause: Stale closure in handlePaneDoubleClick - the useCallback dependency array was missing projectPath, so the callback captured the initial projectPath value and never updated when the user switched projects via the sidebar dropdown.
fix: Added projectPath to the useCallback dependency array on line 320 of Canvas.tsx, changing [reactFlow, addTerminalNode] to [reactFlow, addTerminalNode, projectPath].
verification: TypeScript compilation passes. Awaiting human verification of runtime behavior.
files_changed: [src/components/canvas/Canvas.tsx]
