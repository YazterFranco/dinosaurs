// Efectos de sonido sintetizados con Web Audio (sin archivos externos).
let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }

function ac() {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, dur, type = 'sine', vol = 0.15, when = 0, slideTo = null) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, vol = 0.2, filterFreq = 800, when = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  tap: () => tone(660, 0.06, 'triangle', 0.08),
  ok: () => { tone(523, 0.1, 'triangle', 0.12); tone(784, 0.14, 'triangle', 0.12, 0.08); },
  no: () => tone(220, 0.18, 'square', 0.06, 0, 160),
  coin: () => { tone(988, 0.07, 'square', 0.06); tone(1318, 0.12, 'square', 0.06, 0.06); },
  dig: () => noise(0.12, 0.25, 900),
  brush: () => noise(0.18, 0.1, 2500),
  bone: () => { tone(392, 0.1, 'triangle', 0.12); tone(523, 0.1, 'triangle', 0.12, 0.08); tone(659, 0.2, 'triangle', 0.12, 0.16); },
  hatch: () => { noise(0.08, 0.2, 3000); tone(1200, 0.08, 'sine', 0.1, 0.12, 1800); tone(1400, 0.1, 'sine', 0.1, 0.24, 2000); },
  roar: (big = true) => {
    tone(big ? 110 : 330, 0.6, 'sawtooth', 0.12, 0, big ? 60 : 180);
    noise(0.5, 0.18, big ? 400 : 1500);
  },
  chirp: () => { tone(1500, 0.06, 'sine', 0.08, 0, 2200); tone(1700, 0.06, 'sine', 0.08, 0.08, 2400); },
  level: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, i * 0.1)),
  chest: () => { noise(0.25, 0.2, 600); [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.05, 0.2 + i * 0.06)); },
  collect: () => { tone(880, 0.06, 'triangle', 0.1); tone(1320, 0.1, 'triangle', 0.1, 0.05); },
};
