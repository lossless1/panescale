---
status: awaiting_human_verify
trigger: "GitHub Actions release workflow fails when pushing a version tag"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Code at v0.1.0 tag had Rust compile errors; current main compiles clean
test: cargo check at tag vs main
expecting: New tag from current main should build successfully in CI
next_action: User needs to push changes, delete old tag/release, create new tag, and verify CI passes

## Symptoms

expected: Pushing a version tag triggers GitHub Actions, builds the Tauri app for all platforms, and creates a GitHub release with artifacts.
actual: The GitHub Actions CI fails during the release process. All three platform builds fail at the tauri-apps/tauri-action step.
errors: macOS: "Command npm run tauri build -- --target universal-apple-darwin failed with exit code 1". Linux/Windows: "No artifacts were found."
reproduction: Push a version tag like v0.1.0.
started: Release workflow was set up in Phase 07-02. First release attempt v0.1.0 failed.

## Eliminated

- hypothesis: Workflow YAML configuration is wrong (triggers, permissions, job structure)
  evidence: Workflow structure is correct. All three jobs proceed through checkout, npm ci, etc., and only fail at the tauri build step itself.
  timestamp: 2026-03-20

- hypothesis: TypeScript/frontend build fails
  evidence: npx tsc --noEmit succeeds with no errors
  timestamp: 2026-03-20

- hypothesis: Version mismatch between package.json, Cargo.toml, tauri.conf.json
  evidence: All three files have version 0.1.0
  timestamp: 2026-03-20

- hypothesis: aws-lc-sys / NASM missing on Windows CI
  evidence: aws-lc-sys 0.38.0 ships prebuilt NASM objects; cmake is preinstalled on all runner images
  timestamp: 2026-03-20

## Evidence

- timestamp: 2026-03-20
  checked: GitHub Actions run 23291764963 (v0.1.0 tag push)
  found: All three platform jobs (macOS, Linux, Windows) fail at "Run tauri-apps/tauri-action@v0" step
  implication: The Rust/Tauri build itself fails, not the workflow configuration

- timestamp: 2026-03-20
  checked: cargo check at tag v0.1.0 commit (a7c902f)
  found: Compile error - "no method named `detach` found for struct `tauri::State<'_, PtyManager>`" in src/pty/commands.rs:62
  implication: The Rust code at the tagged commit does not compile - this is the root cause

- timestamp: 2026-03-20
  checked: Current main branch compilation
  found: Main compiles successfully (only warnings about unused functions). The detach method now exists and commands.rs no longer calls state.detach() directly.
  implication: The compile error has been fixed on main since the tag was created

- timestamp: 2026-03-20
  checked: Cargo.lock at tag v0.1.0
  found: Cargo.lock was NOT tracked in git at the tag. It was added later.
  implication: CI at the tag resolved deps from scratch (minor risk), but now Cargo.lock is tracked so future builds are deterministic

- timestamp: 2026-03-20
  checked: publish job gh CLI auth
  found: Used GITHUB_TOKEN env var name, but gh CLI prefers GH_TOKEN
  implication: Minor fix applied - changed env var to GH_TOKEN for the publish job

## Resolution

root_cause: The Rust code at tag v0.1.0 (commit a7c902f) had a compile error: `state.detach(&pty_id)` was called in pty/commands.rs but PtyManager had no `detach` method at that commit. This prevented the Tauri build from completing on all three platforms. The code has since been fixed on main.
fix: 1) The compile error is already fixed on main (detach method was added to PtyManager, and the command routing was corrected). 2) Changed publish job env var from GITHUB_TOKEN to GH_TOKEN for proper gh CLI auth. 3) Cargo.lock is now tracked in git for deterministic builds. User needs to delete the old v0.1.0 tag/release and push a new tag from current main.
verification: cargo check passes on main with only warnings. TypeScript compiles clean.
files_changed: [.github/workflows/release.yml]
