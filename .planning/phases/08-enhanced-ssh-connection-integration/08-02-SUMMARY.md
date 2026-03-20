---
phase: 08-enhanced-ssh-connection-integration
plan: 02
subsystem: ui
tags: [react, zustand, ssh, dropdown, sidebar]

requires:
  - phase: 08-enhanced-ssh-connection-integration/01
    provides: SSH backend IPC commands (sshListConfigHosts, sshConnectForBrowsing, sshOpenConfigInEditor)
provides:
  - SshQuickConnect dropdown component for one-click SSH connections
  - sshStore configHosts state and loadConfigHosts action
  - Sidebar restructured with globe button replacing SSH tab
affects: [08-enhanced-ssh-connection-integration/03]

tech-stack:
  added: []
  patterns: [dropdown-dismiss-on-mousedown, globe-button-header-action]

key-files:
  created:
    - src/components/sidebar/SshQuickConnect.tsx
  modified:
    - src/stores/sshStore.ts
    - src/components/sidebar/SidebarTabs.tsx
    - src/components/layout/Sidebar.tsx

key-decisions:
  - "Config hosts loaded fresh on dropdown open via IPC, not persisted in localStorage"
  - "Both config host and saved connection clicks spawn terminal + browsing connection + remote project registration"

patterns-established:
  - "Header action button pattern: icon button in sidebar header with dropdown"
  - "SSH connection flow: addSshTerminalNode -> sshConnectForBrowsing -> openRemoteProject"

requirements-completed: [SSH-ENH-01, SSH-ENH-02, SSH-ENH-05]

duration: 3min
completed: 2026-03-20
---

# Phase 8 Plan 02: SSH Quick Connect Dropdown Summary

**SSH globe button in sidebar header opens quick-connect dropdown with config hosts, saved connections, and browsing-enabled one-click connect**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T22:31:20Z
- **Completed:** 2026-03-20T22:34:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended sshStore with configHosts state and loadConfigHosts async action
- Removed SSH tab from sidebar (3 tabs: Files, Piles, Git)
- Created SshQuickConnect dropdown with config hosts, saved connections, "+ New Connection", and "Edit SSH Config" actions
- Both connection types trigger terminal spawn + browsing session + remote project registration for full file browsing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend sshStore with configHosts** - `a91d185` (feat)
2. **Task 2: Remove SSH tab, add SSH header button, create SshQuickConnect** - `2f78492` (feat)

## Files Created/Modified
- `src/components/sidebar/SshQuickConnect.tsx` - New dropdown component for SSH quick connect
- `src/stores/sshStore.ts` - Added configHosts state and loadConfigHosts action
- `src/components/sidebar/SidebarTabs.tsx` - Removed SSH tab, exported TabId type
- `src/components/layout/Sidebar.tsx` - Globe button in header, removed SshPanel import and rendering

## Decisions Made
- Config hosts loaded fresh on each dropdown open (not persisted) since ~/.ssh/config can change externally
- Both config host and saved connection clicks use the full 3-step flow: spawn terminal, connect for browsing, register remote project

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SshQuickConnect dropdown functional, ready for Plan 03 (RemoteFileTree integration)
- openRemoteProject already available in projectStore (was added by Plan 01)

---
*Phase: 08-enhanced-ssh-connection-integration*
*Completed: 2026-03-20*
