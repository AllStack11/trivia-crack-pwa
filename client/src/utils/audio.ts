import { triggerHaptic } from '../hooks/usePWA';

export { triggerHaptic };

let audioCtx: AudioContext | null = null;
let isMuted = false;

// Check localStorage for mute preference
if (typeof window !== 'undefined') {
  try {
    isMuted = localStorage.getItem('trivia_clash_muted') === 'true';
  } catch {
    isMuted = false;
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    if ('AudioContext' in window && window.AudioContext) {
      audioCtx = new window.AudioContext();
    } else if ('webkitAudioContext' in window) {
      const webkitCtx = (window as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new webkitCtx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioMuted(): boolean {
  return isMuted;
}

export function setAudioMuted(muted: boolean): void {
  isMuted = muted;
  try {
    localStorage.setItem('trivia_clash_muted', muted ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Wheel peg tick sound
 */
export function playWheelTick(pitchOffset: number = 0): void {
  triggerHaptic('light');
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(400 + pitchOffset * 40, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.04);
}

/**
 * Button tap sound
 */
export function playButtonPop(): void {
  triggerHaptic('selection');
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(260, now + 0.06);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

/**
 * Correct answer celebratory chime (C5 -> E5 -> G5 -> C6)
 */
export function playCorrectChime(): void {
  triggerHaptic('success');
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  const start = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const noteStart = start + idx * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteStart);

    gain.gain.setValueAtTime(0.18, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 0.28);
  });
}

/**
 * Incorrect answer buzzer
 */
export function playIncorrectBuzzer(): void {
  triggerHaptic('error');
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(140, start);
  osc.frequency.linearRampToValueAtTime(80, start + 0.35);

  gain.gain.setValueAtTime(0.18, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + 0.35);
}

/**
 * Crown achievement & victory fanfare
 */
export function playFanfare(): void {
  triggerHaptic('heavy');
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  // Brassy triumph: G4, C5, E5, G5 sustained chord
  const chord = [392.0, 523.25, 659.25, 783.99];

  chord.forEach((freq, idx) => {
    const noteStart = start + idx * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = idx === chord.length - 1 ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, noteStart);

    gain.gain.setValueAtTime(0.12, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 0.7);
  });
}
