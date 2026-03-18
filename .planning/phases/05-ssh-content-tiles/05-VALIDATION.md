---
phase: 5
slug: ssh-content-tiles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 5 — Validation Strategy

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
| TBD | 05-01 | 1 | SSH-01 | unit | `cargo test` | ❌ W0 | ⬜ pending |
| TBD | 05-01 | 1 | SSH-02 | unit | `cargo test` | ❌ W0 | ⬜ pending |
| TBD | 05-02 | 1 | CONT-01 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | 05-02 | 1 | CONT-03 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | 05-03 | 2 | SSH-03 | manual | - | - | ⬜ pending |
| TBD | 05-03 | 2 | SSH-04 | manual | - | - | ⬜ pending |
| TBD | 05-02 | 1 | CONT-02 | manual | - | - | ⬜ pending |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSH terminal spawn on canvas | SSH-03 | Requires live SSH server | Connect to SSH host, verify terminal tile appears |
| Remote terminal identical to local | SSH-04 | Visual + interaction | Resize, drag, search, badge — all should work |
| Image drag from filesystem | CONT-02 | Requires OS drag-and-drop | Drag .png from Finder onto canvas |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
