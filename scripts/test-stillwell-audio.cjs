const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../experiences/stillwell/index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const timers = new Map();
const events = {};
const nodes = new Map();
let id = 0;
let suspends = 0;
let cancels = 0;
let spoken = [];
let buffers = [];
const param = () => ({ value: 0, cancelScheduledValues() {}, cancelAndHoldAtTime() {}, setValueAtTime(v) { this.value = v; }, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime(v, t) { this.ramp = [v, t]; } });
const node = () => ({ gain: param(), frequency: param(), Q: param(), detune: param(), threshold: param(), ratio: param(), connect(target) { this.target = target; }, disconnect() { this.disconnected = true; }, start() {}, stop() { this.stopped = true; } });
class Context {
  constructor() { this.currentTime = 10; this.sampleRate = 1000; this.destination = {}; }
  createGain() { return node(); }
  createDynamicsCompressor() { return node(); }
  createOscillator() { return node(); }
  createBufferSource() { return node(); }
  createBiquadFilter() { return node(); }
  createBuffer(channels, size) { const data = new Float32Array(size); buffers.push(data); return { getChannelData: () => data }; }
  async resume() {}
  async suspend() { suspends++; }
}
function element(key) {
  if (!nodes.has(key)) nodes.set(key, { style: { setProperty() {} }, classList: { toggle() {} }, dataset: {}, setAttribute() {}, addEventListener(type, fn) { events[key + ':' + type] = fn; }, getBoundingClientRect: () => ({ top: 10000 }), offsetHeight: 1000, focus() {} });
  return nodes.get(key);
}
const sandbox = {
  console, Float32Array,
  document: { body: element('body'), documentElement: { style: {}, scrollHeight: 10000 }, hidden: false, querySelector: element, querySelectorAll: () => [], addEventListener(type, fn) { events[type] = fn; } },
  window: { AudioContext: Context, innerHeight: 800, scrollY: 0, matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, scrollTo() {}, location: {}, speechSynthesis: { getVoices: () => [{}], cancel() { cancels++; }, speak(u) { spoken.push(u); } } },
  SpeechSynthesisUtterance: function(text) { this.text = text; },
  setTimeout(fn, ms) { timers.set(++id, { fn, ms }); return id; }, clearTimeout(id) { timers.delete(id); },
  setInterval() { return 1; }, clearInterval() {}, requestAnimationFrame() {},
};
vm.createContext(sandbox);
vm.runInContext(script.replace('      })();', 'globalThis.test={setPhase,resetExperience,beat,knock,scheduleWhisper,createAudio,get audio(){return audio},get shots(){return oneShots}};})();'), sandbox);
const api = sandbox.test;
const click = () => events['#sound-toggle:click']();
const fire = ms => { for (const [key, timer] of [...timers]) if (timer.ms === ms) { timers.delete(key); timer.fn(); } };
(async () => {
  assert.equal(api.audio, null);
  await click();
  await click();
  assert.equal(suspends, 0);
  assert.deepEqual(api.audio.master.gain.ramp, [0, 10.2]);
  const staleFade = [...timers.values()].find(t => t.ms === 220).fn;
  await click(); staleFade();
  assert.equal(suspends, 0);
  await click(); fire(220); assert.equal(suspends, 1);
  console.log('PASS mute fades for 200ms before suspend; rapid unmute invalidates stale suspend');
  await click();
  api.setPhase(3); assert.equal(api.shots.size, 3);
  const shots = [...api.shots]; api.setPhase(2);
  assert.equal(api.shots.size, 0); assert(shots.every(s => s.osc.stopped && s.gain.disconnected));
  api.beat(); assert.equal(api.shots.size, 2);
  api.resetExperience(); assert.equal(api.shots.size, 0);
  api.knock(3); const ended = [...api.shots][0]; ended.osc.onended(); assert(!api.shots.has(ended));
  api.resetExperience(); api.resetExperience();
  console.log('PASS one-shots stop on phase retreat/reset and clean up on end; empty reset is safe');
  api.setPhase(3); fire(2600); assert.equal(spoken.length, 1);
  const before = cancels; api.setPhase(2); assert(cancels > before);
  api.setPhase(3); api.setPhase(2); fire(2600); assert.equal(spoken.length, 1);
  console.log('PASS backward scroll cancels speaking and pending whispers');
  api.setPhase(3); sandbox.document.hidden = true; events.visibilitychange();
  assert.equal(suspends, 1); fire(220); assert.equal(suspends, 2);
  sandbox.document.hidden = false; events.visibilitychange(); fire(2600); assert.equal(spoken.length, 2);
  sandbox.document.hidden = true; events.visibilitychange();
  const hideFade = [...timers.values()].find(t => t.ms === 220).fn;
  sandbox.document.hidden = false; events.visibilitychange(); hideFade(); assert.equal(suspends, 2);
  console.log('PASS tab hide fades before suspend; return reschedules interrupted whisper and cancels stale suspension');
  const data = buffers[0];
  assert(Math.abs(data[0] - data[data.length - 1]) <= .071);
  assert(data.every(Number.isFinite));
  assert.match(script, /raw\[data.length\+i\]\*\(1-mix\)\+raw\[i\]\*mix/);
  console.log('PASS brown-noise seam uses adjacent continuation samples with a 100ms crossfade');
  sandbox.window.speechSynthesis.getVoices = () => [];
  api.resetExperience(); api.setPhase(3); fire(2600);
  const fallback = [...api.shots].find(s => s.filter);
  assert(fallback); assert.equal(fallback.phase, 3);
  assert.equal(fallback.filter.type, 'bandpass'); assert.equal(fallback.gain.target, api.audio.master);
  api.setPhase(2); assert(fallback.osc.stopped && fallback.filter.disconnected); assert(!api.shots.has(fallback));
  console.log('PASS zero voices plays band-passed whisper fallback through master; retreat stops and disconnects it');
  sandbox.window.speechSynthesis.getVoices = () => [{}];
  api.setPhase(3); fire(2600);
  const utterance = spoken.at(-1); utterance.onerror({ error: 'synthesis-failed' });
  assert.equal([...api.shots].filter(s => s.filter).length, 1);
  utterance.onerror({ error: 'synthesis-failed' });
  assert.equal([...api.shots].filter(s => s.filter).length, 1);
  api.resetExperience(); assert.equal(api.shots.size, 0);
  utterance.onerror({ error: 'synthesis-failed' }); assert.equal(api.shots.size, 0);
  console.log('PASS synthesis error plays one fallback; reset cleans it up and stale errors cannot restart it');
  await click(); sandbox.window.AudioContext = undefined;
  delete sandbox.window.speechSynthesis;
  api.scheduleWhisper(3);
  assert.throws(() => api.createAudio(), /Audio is not supported/);
  console.log('PASS missing speech/audio APIs are handled without uncaught errors');
})().catch(error => { console.error(error); process.exitCode = 1; });
