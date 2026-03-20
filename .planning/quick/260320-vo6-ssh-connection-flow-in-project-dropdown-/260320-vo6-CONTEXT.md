# Quick Task 260320-vo6: SSH Connection Flow in Project Dropdown - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Task Boundary

Remove the + button from the sidebar header. Add "Connect SSH" to the project dropdown popover. Flow: click Connect SSH → SSH modal → connect → folder picker → add remote project to dropdown.

</domain>

<decisions>
## Implementation Decisions

### SSH Modal Layout
- Single modal with two sections:
  - Top: clickable list of ~/.ssh/config hosts
  - Bottom: manual entry form (host, port, user, key) with "or connect manually" divider
  - One Connect button at the bottom

### Remote Folder Picker
- Interactive tree browser after SSH connects
  - Expandable/collapsible folder tree
  - Click folder to select, confirm with Open button
  - Shows user@host at the top

### Remote Project Indicator
- Color tint: accent-colored left border or background tint on remote project rows in the dropdown
- Distinguishes remote from local projects visually

### Other
- SSH tab remains in sidebar for managing saved connections
- The + (plus/Open Folder) button in header is removed — "Open Folder" stays in the dropdown instead

</decisions>

<specifics>
## Specific Ideas

- The project already has SSH infrastructure (russh, SshPanel, sshStore)
- SSH config parsing planned for Phase 8 but not yet built — this task needs ssh2-config crate or raw parsing
- Remote folder listing can use SSH exec channels (`ls -1pA`)
- projectStore needs a `isRemote` field and SSH connection metadata

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
