import { triggerHaptic } from '../hooks/usePWA';
export { triggerHaptic };

export type AudioCue = 'button' | 'tick' | 'landing' | 'crownLanding' | 'reveal' | 'countdown' | 'correct' | 'incorrect' | 'timeout' | 'crown' | 'steal' | 'turn' | 'victory' | 'defeat';
export type CancelAudio = () => void;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const voices = new Set<CancelAudio>();
let muted = false;
try { muted = typeof localStorage !== 'undefined' && localStorage.getItem('trivia_clash_muted') === 'true'; } catch { /* Storage is optional. */ }

export function stopAllAudio(): void {
  for (const stop of [...voices]) stop();
}

// Only gestures create/resume the context. State updates never queue locked audio.
export function unlockAudio(): void {
  if (typeof window === 'undefined' || document.hidden || muted) return;
  try {
    if (!ctx || ctx.state === 'closed') {
      const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return;
      ctx = new Constructor();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 16;
      compressor.ratio.value = 5;
      compressor.attack.value = .003;
      compressor.release.value = .18;
      master = ctx.createGain();
      master.gain.value = .55;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  } catch { ctx = null; master = null; noise = null; }
}

export function installAudioLifecycle(): CancelAudio {
  if (typeof document === 'undefined') return () => {};
  const gesture = () => unlockAudio();
  const visibility = () => { if (document.hidden) stopAllAudio(); };
  document.addEventListener('pointerdown', gesture, true);
  document.addEventListener('keydown', gesture, true);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', stopAllAudio);
  return () => {
    document.removeEventListener('pointerdown', gesture, true);
    document.removeEventListener('keydown', gesture, true);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', stopAllAudio);
    stopAllAudio();
  };
}

export function isAudioMuted(): boolean { return muted; }
export function setAudioMuted(value: boolean): void {
  muted = value;
  if (muted) stopAllAudio(); else unlockAudio();
  try { localStorage.setItem('trivia_clash_muted', String(value)); } catch { /* Storage is optional. */ }
}

interface Voice {
  tone: (frequency: number, offset: number, duration: number, level: number, type?: OscillatorType, endFrequency?: number, attack?: number) => void;
  hit: (offset: number, duration: number, level: number, frequency: number, endFrequency?: number, attack?: number) => void;
  stop: CancelAudio;
  texture: (duration: number, level: number, frequency: number) => (speed: number) => void;
}

function voice(duration: number, spacious = false, delay = 0): Voice | null {
  if (muted || typeof document === 'undefined' || document.hidden || !ctx || ctx.state !== 'running' || !master) return null;
  // Bound rapid peg clicks and repeated input without cutting off celebrations.
  if (voices.size >= 24) return null;
  const context = ctx;
  const start = context.currentTime + delay;
  const bus = context.createGain();
  const nodes: AudioNode[] = [bus];
  const sources: AudioScheduledSourceNode[] = [];
  bus.connect(master);
  if (spacious) {
    // Two short, feed-forward reflections: a light room tail without a feedback loop.
    for (const [delaySeconds, level] of [[.067, .19], [.113, .11]]) {
      const delay = context.createDelay(.2);
      const wet = context.createGain();
      const lowpass = context.createBiquadFilter();
      delay.delayTime.value = delaySeconds;
      wet.gain.value = level;
      lowpass.type = 'lowpass'; lowpass.frequency.value = 4200;
      bus.connect(delay); delay.connect(lowpass); lowpass.connect(wet); wet.connect(master);
      nodes.push(delay, wet, lowpass);
    }
  }
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    bus.gain.cancelScheduledValues(context.currentTime);
    bus.gain.value = 0;
    for (const source of sources) { try { source.stop(); } catch { /* Already ended. */ } }
    for (const node of nodes) node.disconnect();
    voices.delete(stop);
  };
  const timer = setTimeout(stop, (duration + delay + (spacious ? .15 : .02)) * 1000);
  voices.add(stop);
  const envelope = (source: AudioScheduledSourceNode, offset: number, length: number, level: number, filter?: BiquadFilterNode, attack = .012) => {
    const gain = context.createGain();
    const at = start + offset;
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + Math.min(attack, length / 4));
    gain.gain.exponentialRampToValueAtTime(.0001, at + length);
    if (filter) { source.connect(filter); filter.connect(gain); nodes.push(filter); }
    else source.connect(gain);
    gain.connect(bus);
    nodes.push(gain, source); sources.push(source);
    source.start(at); source.stop(at + length);
    source.onended = () => { source.disconnect(); gain.disconnect(); filter?.disconnect(); };
  };
  return {
    stop,
    texture(length, level, frequency) {
      const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
      const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = .55;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, start);
      source.connect(filter); filter.connect(gain); gain.connect(bus);
      nodes.push(source, filter, gain); sources.push(source);
      source.start(start); source.stop(start + length);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      return (speed) => {
        if (stopped) return;
        gain.gain.setTargetAtTime(level * Math.sqrt(speed), context.currentTime, .035);
        filter.frequency.setTargetAtTime(frequency * (.28 + .72 * speed), context.currentTime, .045);
      };
    },
    tone(frequency, offset, length, level, type = 'sine', endFrequency = frequency, attack = .012) {
      if (stopped) return;
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start + offset);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + offset + length);
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = type === 'sawtooth' ? 2600 : 9000;
      envelope(osc, offset, length, level, filter, attack);
    },
    hit(offset, length, level, frequency, endFrequency = frequency, attack = .012) {
      if (stopped || !noise) return;
      const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
      const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = .8;
      filter.frequency.setValueAtTime(frequency, start + offset);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + offset + length);
      envelope(source, offset, length, level, filter, attack);
    },
  };
}

export function playAudioCue(cue: AudioCue, variation = 0, delay = 0): CancelAudio {
  try {
    const big = ['victory', 'crown', 'steal'].includes(cue);
    const v = voice(big ? 2.2 : cue === 'tick' || cue === 'button' ? .07 : 1.1, big || ['correct', 'reveal', 'landing', 'crownLanding'].includes(cue), delay);
    if (!v) return () => {};
    const bell = (frequency: number, at: number, length = .42, level = .12) => {
      v.tone(frequency, at, length, level);
      v.tone(frequency * 2.003, at, length * .6, level * .32);
      v.tone(frequency * .997, at, length, level * .25, 'triangle');
    };
    if (cue === 'button') {
      // A dry fingertip snap and a short, warm body; no cartoon pitch dive.
      const tint = 1 + (Math.random() - .5) * .035;
      v.hit(0, .012, .075, 1900 * tint, 1450, .001);
      v.tone(310 * tint, .002, .046, .085, 'sine', 275, .002);
      v.tone(780 * tint, 0, .019, .026, 'sine', 720, .001);
    } else if (cue === 'tick') {
      const speed = Math.max(0, Math.min(1, variation));
      const tint = 1 + (Math.random() - .5) * .055;
      const weight = 1 - speed * .28;
      // Flapper contact, wooden body, then a tiny elastic rebound.
      v.hit(0, .014, .10 * weight, (1750 + speed * 650) * tint, 1250, .001);
      v.tone(460 * tint, .001, .037, .072 * weight, 'sine', 390, .0015);
      v.tone(1240 * tint, 0, .022, .023 * weight, 'sine', 1180, .001);
      v.hit(.018, .009, .022 * weight, 1100 * tint, 800, .001);
    } else if (cue === 'countdown') {
      const urgency = Math.max(1, Math.min(5, variation));
      v.tone(520 + (5 - urgency) * 75, 0, .11, .09, 'triangle'); v.hit(0, .035, .045, 1900);
      if (urgency <= 2) v.tone(780, .13, .07, .065);
    } else if (cue === 'incorrect' || cue === 'timeout' || cue === 'defeat') {
      v.tone(cue === 'timeout' ? 440 : 220, 0, .45, .15, 'triangle', 110);
      v.tone(164.81, .12, .5, .085, 'sine', 82.4);
      v.hit(0, .16, .09, 650, 180);
      if (cue === 'timeout') { v.tone(880, 0, .07, .08); v.tone(660, .12, .08, .07); }
      if (cue === 'defeat') bell(196, .35, .65, .07);
    } else if (big) {
      if (cue === 'steal') v.hit(0, .45, .17, 300, 5500);
      const offset = cue === 'steal' ? .22 : 0;
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, offset + i * .11, .7, .12));
      [130.81, 196, 261.63].forEach((f) => v.tone(f, offset + .32, .85, .055, 'sawtooth'));
      v.tone(110, offset, .25, .22, 'sine', 48); v.hit(offset, .12, .15, 2200);
      if (cue === 'victory') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f) => bell(f, 1, .95, .065));
        v.hit(.85, .65, .085, 6500, 3500); v.tone(98, .9, .3, .17, 'sine', 45);
      }
    } else {
      const notes = cue === 'correct' ? [523.25, 659.25, 783.99, 1046.5]
        : cue === 'turn' ? [392, 659.25]
        : cue === 'reveal' ? [392, 523.25]
        : cue === 'crownLanding' ? [659.25, 783.99, 1046.5] : [523.25, 783.99];
      notes.forEach((f, i) => bell(f, i * .075, .4, cue === 'reveal' ? .065 : .11));
      v.hit(0, .13, .065, 2800, 800); v.tone(130.81, 0, .22, .09, 'sine', 65.4);
    }
    return v.stop;
  } catch { stopAllAudio(); return () => {}; }
}

export function startWheelMotion(durationMs: number, peakSpeed = 1): CancelAudio & { update: (progress: number) => void } {
  const silent = Object.assign(() => {}, { update: (_progress: number) => {} });
  try {
    const v = voice(durationMs / 1000);
    if (!v) return silent;
    // Continuous air and bearing textures stay present until the animation slows them.
    const air = v.texture(durationMs / 1000, .075, 2200);
    const bearing = v.texture(durationMs / 1000, .035, 420);
    v.hit(0, .14, .045, 850, 1600, .01);
    const update = (progress: number) => {
      const bounded = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 1;
      const scale = Number.isFinite(peakSpeed) ? Math.max(0, Math.min(1, peakSpeed)) : 0;
      const speed = scale * Math.pow(1 - bounded, 3); // Derivative of the wheel's quartic ease-out.
      air(speed); bearing(speed);
    };
    update(0);
    return Object.assign(v.stop, { update });
  } catch { stopAllAudio(); return silent; }
}

export function playWheelTick(speed = 0, delay = 0): void { triggerHaptic('light'); playAudioCue('tick', speed, delay); }
export function playButtonPop(): void { unlockAudio(); triggerHaptic('selection'); playAudioCue('button'); }
export function playCorrectChime(): void { triggerHaptic('success'); playAudioCue('correct'); }
export function playIncorrectBuzzer(): void { triggerHaptic('error'); playAudioCue('incorrect'); }
export function playFanfare(): void { triggerHaptic('heavy'); playAudioCue('victory'); }
