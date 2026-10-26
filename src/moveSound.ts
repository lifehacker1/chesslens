let audio: AudioContext | undefined;
/** A short, quiet wooden click, created only after a replay interaction. */
export function playMoveSound(enabled: boolean, boundary = false) {
  if (!enabled) return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
    const tone = audio.createOscillator(),
      gain = audio.createGain(),
      now = audio.currentTime;
    tone.type = "triangle";
    tone.frequency.setValueAtTime(boundary ? 300 : 520, now);
    tone.frequency.exponentialRampToValueAtTime(160, now + 0.04);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    tone.connect(gain);
    gain.connect(audio.destination);
    tone.onended = () => {
      tone.disconnect();
      gain.disconnect();
    };
    tone.start();
    tone.stop(now + 0.05);
  } catch {
    /* Playback remains usable when audio is unavailable. */
  }
}
