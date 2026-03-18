---
phase: 4
slug: git-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + cargo test (Rust backend) |
| **Config file** | vitest.config.ts / Cargo.toml |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && cd src-tauri && cargo test` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | GIT-01 | integration | `cargo test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GIT-02 | integration | `cargo test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GIT-03 | integration | `cargo test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GIT-04 | unit | `cargo test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GIT-05 | unit | `cargo test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GIT-06 | integration | `cargo test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GIT-07 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GIT-08 | integration | `cargo test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GIT-09 | manual | - | - | ⬜ pending |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Merge conflict resolution UI | GIT-09 | Requires visual interaction | Create merge conflict, verify accept theirs/ours/editor buttons |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 25s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
