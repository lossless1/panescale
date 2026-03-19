# Phase 7: Release Process with GitHub CI/CD - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up GitHub Actions CI/CD for building Panescale on all three platforms (macOS universal, Linux AppImage+deb, Windows MSI+NSIS), triggered by git tags. Publish builds as GitHub Releases. Configure Tauri updater for automatic update checks. No code signing in v1 (unsigned builds).

</domain>

<decisions>
## Implementation Decisions

### Release Strategy
- Triggered by git tags: push `v*.*.*` tag → CI builds all platforms → publishes GitHub Release
- Semantic versioning (v1.0.0, v1.1.0, etc.)
- No manual dispatch needed (tag-only trigger)
- Release notes auto-generated from commit messages between tags

### Platform Targets
- macOS: universal binary (.dmg) — Intel + Apple Silicon in one package
- Linux: AppImage (universal) + .deb (Debian/Ubuntu)
- Windows: MSI installer + NSIS portable installer
- All three platforms built in parallel in the same workflow

### Code Signing
- No signing in v1 — unsigned builds
- macOS: users will see "unidentified developer" warning, must allow in System Preferences
- Windows: no code signing certificate
- Prepare the workflow for future signing (secrets placeholders) but don't require them

### Auto-Update
- Tauri updater enabled — app checks GitHub Releases for new versions on startup
- Shows update prompt to user (not silent install)
- Note: Tauri updater on macOS requires signing for automatic updates — without signing, the updater can detect new versions and link to the download page, but can't apply updates silently
- Endpoint: GitHub Releases API (standard Tauri updater pattern)

### Claude's Discretion
- Exact GitHub Actions workflow structure (job names, runner versions)
- Tauri updater configuration details
- Release note formatting
- Whether to add a CI workflow for PRs (lint, test, build check)
- Caching strategy for Rust/npm dependencies in CI

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Existing Codebase
- `src-tauri/tauri.conf.json` — Tauri config to add updater configuration
- `src-tauri/Cargo.toml` — Rust project config
- `package.json` — npm project config with version
- `src-tauri/icons/` — App icons already generated (Phase 6)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/generate-icons.sh` — Icon generation script from Phase 6
- `src-tauri/tauri.conf.json` — Already configured with productName "Panescale"

### Established Patterns
- Tauri v2 project structure (src-tauri/ + src/)
- npm scripts in package.json (dev, build, tauri, test)

### Integration Points
- `.github/workflows/` — New directory for CI/CD workflows
- `src-tauri/tauri.conf.json` — Add updater plugin config
- `src-tauri/Cargo.toml` — Add tauri-plugin-updater dependency
- `src-tauri/capabilities/default.json` — Add updater permissions

</code_context>

<specifics>
## Specific Ideas

- Keep the workflow simple — one file, parallel platform builds
- Use Tauri's official GitHub Action (tauri-apps/tauri-action) for building
- GitHub Releases as the single distribution channel

</specifics>

<deferred>
## Deferred Ideas

- Code signing (Apple Developer ID + Windows cert) — add when ready to distribute publicly
- Beta/alpha release channels — future enhancement
- Homebrew formula / AUR package / Chocolatey package — future distribution channels
- CI workflow for PR checks (lint, test, build) — nice to have but not release-critical

</deferred>

---

*Phase: 07-release-process-with-github-ci-cd*
*Context gathered: 2026-03-19*
