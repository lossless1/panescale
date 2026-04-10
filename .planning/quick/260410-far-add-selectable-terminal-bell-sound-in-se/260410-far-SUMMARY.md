---
quick_id: 260410-far
slug: add-selectable-terminal-bell-sound-in-se
date: 2026-04-10
status: complete
---

# Selectable Terminal Sounds

## What was built

Six chime presets, each synthesized with the Web Audio API at runtime (no audio files shipped). Users pick their preferred sound for:

1. **Terminal bell** — played when a background terminal emits a bell signal
2. **Completion chime** — played when a long-running background command finishes

Each selector in Settings > Notifications has an inline "Preview" button so users can hear a preset before committing. The `none` preset silences that channel without touching the master toggle.

## Presets

| Name | Description |
|------|-------------|
| Classic bell | Single A5 sine tone, 0.3s decay (the original bell) |
| Two-tone rise | Ascending C6 → E6 (the original completion chime) |
| Arpeggio | Three-note C-major arpeggio |
| Soft knock | Gentle low triangle-wave two-tone |
| Pluck | Short percussive square-wave pluck |
| None (silent) | No sound |

## Files modified

- `src/lib/audio.ts` — rewritten around a preset-based `playChime(sound)` API with a reusable `tone()` helper. `playBellChime`/`playCompletionChime` kept as thin wrappers.
- `src/stores/settingsStore.ts` — added `terminalBellSound` + `completionChimeSound` fields and setters.
- `src/components/canvas/TerminalNode.tsx` — pass the user's chosen presets into the two chime calls.
- `src/components/layout/SettingsModal.tsx` — two new rows under Notifications with a select + Preview button each. Completion row auto-disables when the master toggle is off.

## Key decisions

- **Synthesis over audio files** — keeps the bundle tiny and avoids Tauri asset plumbing.
- **`none` preset** instead of a separate per-channel enable toggle — simpler UX, and it lets users silence just the bell while keeping the completion chime.
- **Preview button** next to each select so users don't have to trigger a real bell event to hear a preset.

## Verification

- `npx tsc --noEmit` passes
