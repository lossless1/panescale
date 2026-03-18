---
phase: 05-ssh-content-tiles
plan: 03
subsystem: ui
tags: [ssh, react, xterm, hooks, sidebar, terminal]

requires:
  - phase: 05-ssh-content-tiles/05-01
    provides: SSH backend infrastructure (Rust commands, IPC bindings, sshStore)
provides:
  - useSsh hook for SSH session lifecycle
  - SSH sidebar panel with connection CRUD and group organization
  - SSH-aware TerminalNode with badge display and reconnect on restore
  - SSH terminal data persistence in canvas state
  - addSshTerminalNode canvas store action
affects: []

tech-stack:
  added: []
  patterns:
    - "Dual-hook pattern: usePty + useSsh called unconditionally, dispatched by sshConnectionId"
    - "Restored SSH terminals prompt for reconnect instead of auto-connecting"

key-files:
  created:
    - src/hooks/useSsh.ts
    - src/components/sidebar/SshPanel.tsx
    - src/components/sidebar/SshConnectionForm.tsx
  modified:
    - src/components/sidebar/SidebarTabs.tsx
    - src/components/layout/Sidebar.tsx
    - src/components/canvas/TerminalNode.tsx
    - src/components/canvas/TerminalTitleBar.tsx
    - src/lib/ipc.ts
    - src/lib/persistence.ts
    - src/stores/canvasStore.ts

key-decisions:
  - "Dual-hook unconditional call pattern (usePty + useSsh) to satisfy React hook rules"
  - "window.prompt for SSH password input when key auth fails (consistent with existing UX)"
  - "Restored SSH terminals show reconnect prompt, no auto-reconnect (security, user control)"
  - "Cyan SSH badge in title bar to visually distinguish remote terminals"

patterns-established:
  - "SSH terminal identification via sshConnectionId field in TerminalNodeData"
  - "Group-based connection organization with collapsible sections in sidebar"

requirements-completed: [SSH-01, SSH-02, SSH-03, SSH-04]

duration: 4min
completed: 2026-03-18
---

# Phase 5 Plan 3: SSH UI Integration Summary

**Complete SSH workflow: sidebar connection manager with groups, useSsh hook mirroring usePty, SSH-aware terminal tiles with cyan badge and reconnect-on-restore**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T15:20:10Z
- **Completed:** 2026-03-18T15:24:08Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- useSsh hook with connect/write/resize/disconnect lifecycle mirroring usePty pattern
- SSH sidebar panel with connection CRUD, collapsible group organization, and connect-to-canvas action
- TerminalNode conditionally uses useSsh vs usePty based on sshConnectionId, with SSH badge in title bar
- SSH terminal data (connectionId, host, user) persists in canvas state and survives app restart
- Restored SSH terminals show reconnect prompt instead of auto-connecting

## Task Commits

Each task was committed atomically:

1. **Task 1: useSsh hook and SSH sidebar panel** - `74efb5c` (feat)
2. **Task 2: Extend TerminalNode for SSH and update persistence** - `b44a50f` (feat)

## Files Created/Modified
- `src/hooks/useSsh.ts` - SSH session lifecycle hook (connect, write, resize, disconnect)
- `src/components/sidebar/SshPanel.tsx` - SSH connections tree with groups, connect/edit/delete actions
- `src/components/sidebar/SshConnectionForm.tsx` - Add/edit connection form with file picker for SSH key
- `src/components/sidebar/SidebarTabs.tsx` - Added SSH tab to sidebar
- `src/components/layout/Sidebar.tsx` - Renders SshPanel when SSH tab active
- `src/components/canvas/TerminalNode.tsx` - SSH-aware terminal with dual hook pattern
- `src/components/canvas/TerminalTitleBar.tsx` - Cyan SSH badge and user@host display
- `src/lib/ipc.ts` - SSH fields added to SerializedNode
- `src/lib/persistence.ts` - SSH fields serialized in canvas state
- `src/stores/canvasStore.ts` - addSshTerminalNode action

## Decisions Made
- Dual-hook unconditional call (usePty + useSsh) to satisfy React hook rules, dispatched by sshConnectionId
- window.prompt for SSH password when key auth fails (consistent with existing startup command UX)
- Restored SSH terminals show reconnect prompt instead of auto-connecting (security and user control)
- Cyan (#06b6d4) SSH badge in title bar for visual distinction from local terminals

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added addSshTerminalNode to canvasStore in Task 1**
- **Found during:** Task 1 (SshPanel implementation)
- **Issue:** SshPanel references addSshTerminalNode which was planned for Task 2, causing type error
- **Fix:** Added addSshTerminalNode action to canvasStore as part of Task 1 commit
- **Files modified:** src/stores/canvasStore.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 74efb5c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Moved one store action from Task 2 to Task 1 for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
This is the FINAL PLAN of the entire project. All 5 phases are now complete.
- Complete SSH workflow from connection management to remote terminal tiles
- All 21 plans across 5 phases delivered

---
*Phase: 05-ssh-content-tiles*
*Completed: 2026-03-18*
