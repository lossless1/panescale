---
phase: 2
slug: sidebar-session-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + cargo test (Rust backend) |
| **Config file** | vitest.config.ts / Cargo.toml |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && cd src-tauri && cargo test` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SIDE-01 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | SIDE-02 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | SIDE-03 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | SIDE-04 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SIDE-05 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | SIDE-06 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SIDE-07 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | SIDE-08 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SIDE-09 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | PERS-02 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | THEM-02 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | THEM-03 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | THEM-04 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | CANV-04 | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/sidebar.test.ts` — stubs for SIDE-04, SIDE-06, SIDE-08
- [ ] `src/test/theme.test.ts` — stubs for THEM-02, THEM-03 (extend existing)
- [ ] `src/test/grid-snap.test.ts` — stubs for CANV-04
- [ ] `src-tauri/src/pty/tests.rs` — extend with tmux session tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File tree renders from folder | SIDE-01 | Requires real filesystem | Open folder, verify tree appears |
| Folder expand/collapse | SIDE-02 | Visual interaction | Click folders, verify toggle |
| Open folder dialog | SIDE-03 | Requires OS dialog | Click open folder, select dir |
| File operations | SIDE-05 | Requires real filesystem | Create, rename, delete files |
| Drag file to canvas | SIDE-07 | Visual drag interaction | Drag .md file, verify note tile |
| Click sidebar terminal pans canvas | SIDE-09 | Visual interaction | Click terminal entry, verify pan |
| Tmux session persistence | PERS-02 | Requires running tmux | Close app, reopen, verify terminal |
| Rounded corners on macOS | THEM-04 | Visual/platform test | Check window corners are rounded |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
