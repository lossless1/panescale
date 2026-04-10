---
phase: quick-260410-far
plan: 01
files_modified:
  - src/lib/audio.ts
  - src/stores/settingsStore.ts
  - src/components/canvas/TerminalNode.tsx
  - src/components/layout/SettingsModal.tsx
autonomous: true
---

<objective>
Let users choose a sound preset for the terminal bell and the completion chime from Settings, with an inline "Preview" button so they can hear each preset before committing.
</objective>

<tasks>
- Refactor `src/lib/audio.ts` to a preset-based `playChime(sound)` function with 6 presets: classic, two-tone, arpeggio, soft, pluck, none. Export a `ChimeSound` type and a `CHIME_SOUNDS` label table. Keep `playBellChime` / `playCompletionChime` as thin wrappers so existing callers keep working.
- Add `terminalBellSound` and `completionChimeSound` fields to `settingsStore.ts` (defaults: `classic` and `two-tone`) with setters. Persisted via the existing zustand `persist` middleware.
- Pass the selected presets from `useSettingsStore.getState()` into the two audio calls in `TerminalNode.tsx`.
- Add two new rows to `SettingsModal.tsx` under the Notifications section: each shows a `<select>` of `CHIME_SOUNDS` plus a "Preview" button that calls `playChime`. Completion chime select/preview is disabled when the parent toggle is off. Both selects are disabled from previewing when the preset is `none`.
</tasks>

<verification>
- `npx tsc --noEmit` passes
- Manual: open Settings → Notifications section shows two new dropdowns. Pick different presets, click Preview for each → hear distinct sounds.
- Manual: trigger a terminal bell in the background → hear the chosen bell preset.
- Manual: run a command for > busy-threshold seconds in a background terminal → hear the chosen completion preset when it finishes.
</verification>
