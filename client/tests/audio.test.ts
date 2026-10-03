import { afterAll, expect, test } from 'bun:test';
import { unlockAudio, playAudioCue, startWheelMotion, setAudioMuted, stopAllAudio } from '../src/utils/audio';
const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const nodes: FakeNode[] = [];
class Param {
  value = 0;
  targets: number[] = [];
  setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {}
  cancelScheduledValues() {} setTargetAtTime(value: number) { this.targets.push(value); }
}
class FakeNode {
  gain = new Param(); frequency = new Param(); Q = new Param(); delayTime = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  type = ''; buffer: unknown; loop = false; onended: (() => void) | null = null;
  disconnected = false; stopped = false;
  constructor() { nodes.push(this); }
  connect() {} disconnect() { this.disconnected = true; }
  start() {} stop() { this.stopped = true; }
}
class FakeContext {
  state = 'running'; currentTime = 0; sampleRate = 100;
  destination = new FakeNode();
  createGain() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createDelay() { return new FakeNode(); }
  createOscillator() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  createBuffer() { return { getChannelData: () => new Float32Array(100) }; }
  async resume() { this.state = 'running'; }
}
const documentState = { hidden: false };
Object.defineProperty(globalThis, 'document', { configurable: true, value: documentState });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: FakeContext } });
afterAll(() => {
  stopAllAudio();
  if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow); else Reflect.deleteProperty(globalThis, 'window');
  if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument); else Reflect.deleteProperty(globalThis, 'document');
});
test('state cues never create or queue a locked audio context', () => {
  playAudioCue('correct'); expect(nodes.length).toBe(0);
});
test('unsupported and failed context creation do not interrupt gameplay', () => {
  (window as unknown as { AudioContext: unknown }).AudioContext = undefined;
  expect(() => unlockAudio()).not.toThrow(); expect(() => playAudioCue('victory')).not.toThrow();
  (window as unknown as { AudioContext: unknown }).AudioContext = class { constructor() { throw new Error('unavailable'); } };
  expect(() => unlockAudio()).not.toThrow();
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
});
test('mute immediately stops and disconnects voices, including scheduled turn notes', () => {
  unlockAudio(); const baseline = nodes.length;
  playAudioCue('victory'); playAudioCue('turn', 0, .65); startWheelMotion(5000);
  expect(nodes.length).toBeGreaterThan(baseline);
  setAudioMuted(true);
  expect(nodes.slice(baseline).every(node => node.disconnected)).toBe(true);
  const mutedCount = nodes.length; playAudioCue('correct'); expect(nodes.length).toBe(mutedCount);
  setAudioMuted(false);
});
test('hidden pages drop cues and wheel cancellation remains safe to repeat', () => {
  documentState.hidden = true; const count = nodes.length;
  playAudioCue('crown'); expect(nodes.length).toBe(count);
  documentState.hidden = false;
  const baseline = nodes.length; const motion = startWheelMotion(5000);
  motion.update(.5); motion(); motion(); motion.update(.8);
  expect(nodes.slice(baseline).every(node => node.disconnected)).toBe(true);
});
test('finished effects release their sources and processing nodes', async () => {
  const baseline = nodes.length; playAudioCue('button');
  await new Promise(resolve => setTimeout(resolve, 350));
  expect(nodes.slice(baseline).every(node => node.disconnected)).toBe(true);
});

test('wheel textures follow animation speed through the tail and ignore updates after cancellation', () => {
  const baseline = nodes.length;
  const motion = startWheelMotion(5000);
  const gains = nodes.slice(baseline).filter(node => node.gain.targets.length > 0);
  expect(gains.length).toBe(2);
  const startingLevels = gains.map(node => node.gain.targets.at(-1)!);
  motion.update(.5);
  gains.forEach((node, i) => expect(node.gain.targets.at(-1)).toBeCloseTo(startingLevels[i] * Math.sqrt(.125), 6));
  motion.update(1);
  gains.forEach(node => expect(node.gain.targets.at(-1)).toBe(0));
  motion(); const counts = gains.map(node => node.gain.targets.length);
  motion.update(0);
  gains.forEach((node, i) => expect(node.gain.targets.length).toBe(counts[i]));
  expect(nodes.slice(baseline).every(node => node.disconnected)).toBe(true);
});

test('slower angular speed lowers the motion texture level and filter frequency', () => {
  const measure = (speed: number) => {
    const baseline = nodes.length;
    const motion = startWheelMotion(6400, speed);
    const levels = nodes.slice(baseline).filter(node => node.gain.targets.length).map(node => node.gain.targets[0]);
    const frequencies = nodes.slice(baseline).filter(node => node.frequency.targets.length).map(node => node.frequency.targets[0]);
    motion(); return { levels, frequencies };
  };
  const fast = measure(1); const slow = measure(.5);
  expect(slow.levels.length).toBeGreaterThan(0);
  slow.levels.forEach((level, i) => expect(level).toBeLessThan(fast.levels[i]));
  slow.frequencies.forEach((frequency, i) => expect(frequency).toBeLessThan(fast.frequencies[i]));
});
