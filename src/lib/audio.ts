/**
 * Web Audio API chimes for terminal notifications.
 *
 * Everything is synthesized at runtime — no audio files shipped.
 * Each preset is a small function that takes an AudioContext and schedules tones.
 */

export type ChimeSound =
  | "classic"    // Single short sine bell (original)
  | "two-tone"   // Ascending C6 → E6 (original completion chime)
  | "arpeggio"   // Three-note major arpeggio
  | "soft"       // Low, gentle two-tone
  | "pluck"      // Short percussive pluck
  | "none";      // Silent (disables audio without touching the enabled toggle)

export const CHIME_SOUNDS: { value: ChimeSound; label: string }[] = [
  { value: "classic",   label: "Classic bell" },
  { value: "two-tone",  label: "Two-tone rise" },
  { value: "arpeggio",  label: "Arpeggio" },
  { value: "soft",      label: "Soft knock" },
  { value: "pluck",     label: "Pluck" },
  { value: "none",      label: "None (silent)" },
];

function tone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peakGain = 0.12,
  type: OscillatorType = "sine",
) {
  const t0 = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(peakGain, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration);
}

/** Play a named chime. Silently no-ops if audio is unavailable or `sound === "none"`. */
export function playChime(sound: ChimeSound = "classic"): void {
  if (sound === "none") return;
  try {
    const ctx = new AudioContext();
    switch (sound) {
      case "classic":
        tone(ctx, 880, 0, 0.3, 0.15); // A5 sine bell
        break;
      case "two-tone":
        tone(ctx, 1047, 0, 0.25);     // C6
        tone(ctx, 1319, 0.15, 0.3);   // E6
        break;
      case "arpeggio":
        tone(ctx, 523, 0, 0.2);        // C5
        tone(ctx, 659, 0.12, 0.22);    // E5
        tone(ctx, 784, 0.24, 0.32);    // G5
        break;
      case "soft":
        tone(ctx, 440, 0, 0.35, 0.1, "triangle");
        tone(ctx, 554, 0.18, 0.4, 0.1, "triangle");
        break;
      case "pluck":
        tone(ctx, 1200, 0, 0.15, 0.1, "square");
        break;
    }
  } catch {
    /* Audio not available */
  }
}

// ── Legacy compatibility wrappers ──
// Kept so callers can remain simple; they forward to playChime with the
// user's chosen preset (read from settings by the caller).

/** Plays the classic bell chime. Prefer `playChime(sound)` with a user-chosen preset. */
export function playBellChime(sound: ChimeSound = "classic"): void {
  playChime(sound);
}

/** Plays the two-tone completion chime. Prefer `playChime(sound)` with a user-chosen preset. */
export function playCompletionChime(sound: ChimeSound = "two-tone"): void {
  playChime(sound);
}
