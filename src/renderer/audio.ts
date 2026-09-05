let context: AudioContext | undefined;
export function tone(chain: number, volume: number) {
  try {
    context ??= new AudioContext();
    void context.resume();
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      now = context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(180 * Math.pow(1.12, Math.min(chain, 12)), now);
    gain.gain.setValueAtTime(volume * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.23);
  } catch {
    /* Audio is optional on unsupported devices. */
  }
}
