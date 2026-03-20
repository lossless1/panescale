---
status: awaiting_human_verify
trigger: "User reports tmux isolation not working properly - terminal shows '27' exit code, xterm renderer errors"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: Two issues: (1) xterm renderer error from fit() timing, (2) "27" is just user's zsh prompt, not tmux leaking
test: Applied fix -- moved fitAddon.fit() into rAF callback after CanvasAddon loads, wrapped in try-catch
expecting: Renderer error should no longer occur; "27" is cosmetic and unrelated
next_action: Request human verification that renderer errors are gone and tmux isolation is working

## Symptoms

expected: Terminals render and work transparently with no tmux UI visible - no status bar, no prefix key interference
actual: Terminal shows "27" exit code indicator in bottom-left, xterm.js renderer error "this._renderer.value.dimensions" x5, though terminals are functional with working shells
errors: TypeError: undefined is not an object (evaluating 'this._renderer.value.dimensions') at RenderService.ts:50
reproduction: Open the app, observe terminal tiles
started: After tmux isolation feature was implemented

## Eliminated

## Evidence

- timestamp: 2026-03-20T00:10:00Z
  checked: tmux set-option -g prefix None behavior
  found: tmux accepts "None" as prefix value without error, effectively disabling prefix key
  implication: prefix key hiding works correctly

- timestamp: 2026-03-20T00:12:00Z
  checked: tmux server configuration (status off, prefix None, etc.)
  found: All options accepted and applied. No panescale tmux server currently running (app not open).
  implication: configure_server() logic is correct

- timestamp: 2026-03-20T00:15:00Z
  checked: tmux attach-session exit code for nonexistent session
  found: Returns exit code 1, not 27
  implication: The "27" shown in terminal is NOT from tmux attach failure

- timestamp: 2026-03-20T00:18:00Z
  checked: Source of "27 ⏎" in terminal
  found: 27 with ⏎ symbol is a standard zsh prompt element (Powerlevel10k/oh-my-zsh) showing previous command exit code. 27 = ESC (0x1B). This is NOT tmux UI leaking.
  implication: The "27" is cosmetic, from user's shell prompt config, not our tmux integration

- timestamp: 2026-03-20T00:20:00Z
  checked: xterm.js renderer error location
  found: fitAddon.fit() on TerminalNode.tsx line 126 was called synchronously after term.open() but before the browser laid out the container element. Container may have zero dimensions at this point.
  implication: Moving fit() into the requestAnimationFrame callback (after CanvasAddon loads) fixes the timing issue

## Resolution

root_cause: fitAddon.fit() was called synchronously after term.open() but before the browser had laid out the container element (zero dimensions), AND before the CanvasAddon renderer swap completed. The "27 ⏎" in the terminal is the user's zsh prompt showing a previous command's exit code (27 = ESC), not tmux UI leaking.
fix: Moved fitAddon.fit() into the requestAnimationFrame callback alongside CanvasAddon loading, wrapped in try-catch. This ensures the container has non-zero dimensions and the renderer is fully initialized before fit() runs.
verification: TypeScript compiles clean. Need human verification that console errors are gone.
files_changed: [src/components/canvas/TerminalNode.tsx]
