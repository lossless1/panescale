---
phase: 8
slug: enhanced-ssh-connection-integration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), cargo test (Rust) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && cargo test -p panescale` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && cargo test -p panescale`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-T1 | 01 | 1 | SSH-ENH-02, SSH-ENH-03, SSH-ENH-05 | unit | `cargo test -p panescale ssh` | W0 (stubs in task) | pending |
| 08-01-T2 | 01 | 1 | SSH-ENH-02 | type-check | `npx tsc --noEmit --skipLibCheck` | N/A (types only) | pending |
| 08-02-T1 | 02 | 2 | SSH-ENH-01 | type-check | `npx tsc --noEmit --skipLibCheck` | N/A (store ext) | pending |
| 08-02-T2 | 02 | 2 | SSH-ENH-01, SSH-ENH-02, SSH-ENH-05 | type-check | `npx tsc --noEmit --skipLibCheck` | N/A (component) | pending |
| 08-03-T1 | 03 | 2 | SSH-ENH-03, SSH-ENH-04 | type-check | `npx tsc --noEmit --skipLibCheck` | N/A (store ext) | pending |
| 08-03-T2 | 03 | 2 | SSH-ENH-03, SSH-ENH-04 | type-check | `npx tsc --noEmit --skipLibCheck` | N/A (component) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] Test stubs for SSH config parsing (`test_ssh_config_host_serialization` in config.rs, created in 08-01-T1)
- [x] Test stubs for remote directory listing (`test_remote_file_entry_serialization` in commands.rs, created in 08-01-T1)
- [x] Test stubs for ssh_list_config_hosts (`test_ssh_list_config_hosts_returns_ok_when_no_config` in commands.rs, created in 08-01-T1)
- [x] Test stubs for shell_escape (`test_shell_escape_basic`, `test_shell_escape_single_quotes` in commands.rs, created in 08-01-T1)

*Wave 0 stubs are embedded in 08-01 Task 1 action (step 7). No separate Wave 0 plan needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSH connection to real host | SSH connectivity | Requires real SSH server | Connect to a test host via sidebar |
| Remote folder browsing | Remote file system | Requires live SSH session | Browse folders after connection |
| Sidebar SSH button UX | UI interaction | Visual/interactive | Click SSH icon, verify dropdown appears |
| Stale session reconnect | SSH-ENH-04 | Requires app restart cycle | Open remote project, restart app, verify reconnect prompt |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
