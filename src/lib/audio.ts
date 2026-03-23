/**
 * Play a short bell chime using the Web Audio API.
 * Used for terminal bell notifications when a background terminal receives \a.
 */
export function playBellChime(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880; // A5 note
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* Audio not available */
  }
}

/**
 * Play a pleasant completion chime (two-tone ascending).
 * Used when a long-running terminal operation finishes.
 */
export function playCompletionChime(): void {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    // First tone: C6
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 1047;
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.12, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc1.start(t);
    osc1.stop(t + 0.25);

    // Second tone: E6 (major third up)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1319;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.12, t + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc2.start(t + 0.15);
    osc2.stop(t + 0.45);
  } catch {
    /* Audio not available */
  }
}
