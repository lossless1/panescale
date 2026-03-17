---
phase: 1
slug: canvas-terminal-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + cargo test (Rust backend) |
| **Config file** | vitest.config.ts / Cargo.toml |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && cd src-tauri && cargo test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CANV-01 | integration | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CANV-02 | integration | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CANV-03 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TERM-01 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | TERM-02 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | TERM-03 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | TERM-04 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | TERM-05 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | TERM-07 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | TERM-08 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | TERM-14 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TERM-15 | integration | `cd src-tauri && cargo test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PERS-01 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PERS-03 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PLAT-01 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | PLAT-02 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PLAT-03 | manual | - | - | ⬜ pending |
| TBD | TBD | TBD | THEM-01 | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test framework setup
- [ ] `src/__tests__/canvas.test.tsx` — stubs for CANV-01, CANV-02, CANV-03
- [ ] `src/__tests__/persistence.test.ts` — stubs for PERS-01, PERS-03
- [ ] `src/__tests__/theme.test.ts` — stubs for THEM-01
- [ ] `src-tauri/src/tests/` — Rust test module for PTY and shell detection

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Terminal spawns on double-click | TERM-01 | Requires Tauri webview + PTY | Double-click empty canvas, verify terminal appears |
| Terminal opens in project dir | TERM-02 | Requires running shell | Check `pwd` output in spawned terminal |
| Drag terminal by title bar | TERM-03 | Visual/interaction test | Drag tile, verify position changes |
| Resize via handles | TERM-04 | Visual/interaction test | Drag corners/edges, verify terminal resizes |
| Copy/paste in terminal | TERM-05 | Requires clipboard + PTY | Select text, Cmd+C, Cmd+V |
| Z-index on click | TERM-07 | Visual layering test | Click behind-tile, verify it comes to front |
| Close terminal | TERM-08 | Requires PTY cleanup | Click close, verify tile removed and process killed |
| Cross-platform builds | PLAT-01 | Requires CI on 3 platforms | Build on macOS, Linux, Windows |
| Native window chrome | PLAT-03 | Visual per-platform test | Verify custom title bar renders correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
