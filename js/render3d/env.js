// Escenario 3D del visor: cielo con nubes, horizonte, suelo del hábitat con
// relieve y charcos, rocas y plantas del Mesozoico (helechos, colas de
// caballo, cícadas; casi no existía el pasto). Todo procedural, sin archivos.
// El escenario gira con el animal, como un diorama sobre una mesa giratoria.

import { cssToRgb } from './textures.js';
import { BIOMES } from '../data/world.js';

const toLin = (rgb) => rgb.map((c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
const hex = (h) => toLin(cssToRgb(h));
const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const mul3 = (a, k) => a.map((v) => v * k);
const lum = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ------------------------------------------------------------ aspecto

// Cielo según la hora; cada bioma lo tiñe un poco con sus colores.
const SKY = {
  dia: { zenith: '#2f78d0', horizon: '#c4dff5', cloud: [1.75, 1.75, 1.78], k: 1.5, tint: 0.22 },
  amanecer: { zenith: '#6c93cf', horizon: '#f8c7a0', cloud: [1.7, 1.25, 1.05], k: 1.35, tint: 0.14 },
  atardecer: { zenith: '#45508f', horizon: '#f2975a', cloud: [1.8, 1.0, 0.7], k: 1.3, tint: 0.1 },
  noche: { zenith: '#050a1c', horizon: '#1a284c', cloud: [0.2, 0.25, 0.36], k: 1.0, tint: 0.06 },
};

// Qué hay en cada hábitat. Cantidades cerca del animal; lejos se duplican.
const HABITAT = {
  bosque: { earth: '#5f4f37', cover: 0.52, wet: 0.2, ridge: 1, cloud: 0.55, props: { fern: 15, horsetail: 5, cycad: 3, rock: 4, pebble: 8 } },
  llanura: { earth: '#927a4e', cover: 0.5, wet: 0.05, ridge: 0.45, cloud: 0.5, props: { fern: 8, horsetail: 3, cycad: 2, rock: 4, pebble: 10 } },
  pantano: { earth: '#48442f', cover: 0.55, wet: 0.7, water: 0.44, ridge: 0.8, cloud: 0.7, props: { fern: 9, horsetail: 13, cycad: 1, rock: 3, pebble: 8 } },
  desierto: { earth: '#c08a52', cover: 0, wet: 0, ripple: 1, ridge: 0.3, cloud: 0.22, props: { rock: 6, pebble: 12, bush: 7 } },
  costa: { earth: '#d6c08e', cover: 0, wet: 0.35, sea: 1, ridge: 0.25, cloud: 0.5, props: { rock: 5, pebble: 12, fern: 3, cycad: 1 } },
  mar: { earth: '#b9ad84', cover: 0, wet: 0, ripple: 0.5, ridge: 0, cloud: 0, props: { rock: 7, pebble: 20, kelp: 12 } },
};

/**
 * Colores y parámetros del escenario (todo en color lineal). `light` es la
 * luz del motor para esa hora (dirección y color del sol).
 */
export function envLook(biomeId, phase, light, opts = {}) {
  const under = !!opts.underwater;
  const b = BIOMES[biomeId] || BIOMES.llanura;
  const hab = HABITAT[under ? 'mar' : biomeId] || HABITAT.llanura;
  const s = SKY[phase] || SKY.dia;
  let zenith = mul3(mix3(hex(s.zenith), hex(b.cielo[0]), s.tint * 0.6), s.k);
  let horizon = mul3(mix3(hex(s.horizon), hex(b.cielo[1]), s.tint), s.k);
  const night = phase === 'noche';
  const dim = night ? 0.3 : phase === 'dia' ? 1 : 0.86;
  // Los colores del bioma son de interfaz (muy vivos): en el suelo se apagan.
  const dull = (c, k, v) => { const l = lum(c); return c.map((x) => (l + (x - l) * k) * v); };
  let soilA = dull(hex(b.suelo[0]), 0.62, 0.8); let soilB = dull(hex(b.suelo[1]), 0.6, 0.72);
  let earth = hex(hab.earth);
  // El horizonte no tiene luz propia: de noche y al atardecer se oscurece.
  const dusk = night ? 0.1 : phase === 'dia' ? 1 : phase === 'atardecer' ? 0.5 : 0.7;
  let far = mix3(mul3(hex(b.lejos), dusk), horizon, 0.5);
  let near = mix3(mul3(hex(b.cerca), 0.75 * dusk), horizon, 0.22);
  let water = hex(b.agua || '#5a8f9a');
  let fog = mul3(mix3(horizon, far, 0.6), 0.82);
  if (under) {
    const deep = night ? [0.004, 0.02, 0.05] : [0.01, 0.1, 0.2];
    const shallow = night ? [0.02, 0.07, 0.13] : [0.1, 0.42, 0.55];
    zenith = shallow; horizon = mix3(deep, shallow, 0.35); fog = horizon;
    soilA = hex('#cbbf94'); soilB = hex('#a99f78'); earth = hex(hab.earth);
    far = horizon; near = horizon;
  }
  const soilAvg = mix3(mix3(soilA, soilB, 0.5), earth, 1 - hab.cover * 0.6);
  // Luz ambiente: la del motor, teñida por este cielo y este suelo.
  const skyMix = mix3(zenith, horizon, 0.45);
  const skyAmb = mix3(light.sky, mul3(skyMix, lum(light.sky) / Math.max(0.02, lum(skyMix))), under ? 0.8 : 0.5);
  const bounce = mul3(soilAvg, (lum(light.ground) / Math.max(0.02, lum(soilAvg))));
  const groundAmb = mix3(light.ground, bounce, 0.6);
  return {
    biome: biomeId, phase, under, night, hab, dim,
    zenith, horizon, fog, soilA, soilB, earth, far, near, water,
    cloudCol: s.cloud, cloud: hab.cloud, ridge: hab.ridge,
    skyAmb, groundAmb,
    foliage: dull(mix3(hex(b.cerca), hex(b.suelo[0]), 0.45), 0.8, 0.95),
  };
}

// ------------------------------------------------------------ texturas de ruido

function lattice(cells, rnd) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i += 1) g[i] = rnd();
  return g;
}
/** Ruido de valor que se repite sin costura (para usarlo en mosaico). */
function tileNoise(size, cells, rnd, out, gain) {
  const g = lattice(cells, rnd);
  const k = cells / size;
  for (let y = 0; y < size; y += 1) {
    const fy = y * k; const y0 = Math.floor(fy); const ty = fy - y0; const sy = ty * ty * (3 - 2 * ty);
    const r0 = (y0 % cells) * cells; const r1 = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < size; x += 1) {
      const fx = x * k; const x0 = Math.floor(fx); const tx = fx - x0; const sx = tx * tx * (3 - 2 * tx);
      const c0 = x0 % cells; const c1 = (x0 + 1) % cells;
      const a = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * sx;
      const b = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * sx;
      out[y * size + x] += (a + (b - a) * sy) * gain;
    }
  }
}
function fbmTile(size, cells, octaves, rnd, gain = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1; let total = 0; let c = cells;
  for (let o = 0; o < octaves && c <= size / 2; o += 1) { tileNoise(size, c, rnd, out, amp); total += amp; amp *= gain; c *= 2; }
  let mn = Infinity; let mx = -Infinity;
  for (let i = 0; i < out.length; i += 1) { out[i] /= total; if (out[i] < mn) mn = out[i]; if (out[i] > mx) mx = out[i]; }
  const d = mx - mn || 1;
  for (let i = 0; i < out.length; i += 1) out[i] = (out[i] - mn) / d;
  return out;
}

/** R: nubes y manchas · G: ruido medio · B: grano fino · A: ruido muy grande. */
let noiseMemo = null;
export function noiseTexture(size = 256, seed = 11) {
  if (noiseMemo && size === 256 && seed === 11) return noiseMemo;
  const rnd = rng(seed);
  const ch = [fbmTile(size, 4, 5, rnd, 0.55), fbmTile(size, 8, 4, rnd), fbmTile(size, 32, 3, rnd), fbmTile(size, 2, 6, rnd, 0.6)];
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) for (let c = 0; c < 4; c += 1) data[i * 4 + c] = Math.round(ch[c][i] * 255);
  const out = { w: size, h: size, data };
  if (size === 256 && seed === 11) noiseMemo = out;
  return out;
}

/** Relieve del suelo. R: altura · G, B: pendiente en x e y · A: grano. */
let reliefMemo = null;
export function reliefTexture(size = 256, seed = 23) {
  if (reliefMemo && size === 256 && seed === 23) return reliefMemo;
  const rnd = rng(seed);
  const h = fbmTile(size, 6, 5, rnd, 0.58);
  const peb = fbmTile(size, 24, 2, rnd);
  const grain = fbmTile(size, 48, 2, rnd);
  // Piedritas: realza las crestas del ruido fino.
  for (let i = 0; i < h.length; i += 1) h[i] = h[i] * 0.72 + sstep(0.55, 0.8, peb[i]) * 0.28;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const dx = h[y * size + ((x + 1) % size)] - h[y * size + ((x + size - 1) % size)];
      const dy = h[((y + 1) % size) * size + x] - h[((y + size - 1) % size) * size + x];
      data[i * 4] = Math.round(h[i] * 255);
      data[i * 4 + 1] = Math.round(clamp(0.5 + dx * 6, 0, 1) * 255);
      data[i * 4 + 2] = Math.round(clamp(0.5 + dy * 6, 0, 1) * 255);
      data[i * 4 + 3] = Math.round(grain[i] * 255);
    }
  }
  const out = { w: size, h: size, data };
  if (size === 256 && seed === 23) reliefMemo = out;
  return out;
}

// ------------------------------------------------------------ geometría

function vnoise3(x, y, z) {
  const h = (i, j, k) => { const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); };
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z);
  const s = (t) => t * t * (3 - 2 * t);
  const tx = s(x - xi); const ty = s(y - yi); const tz = s(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), tx), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), tx), ty),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), tx), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), tx), ty), tz);
}

const ICO = new Map();
function icosphere(sub) {
  if (ICO.has(sub)) return ICO.get(sub);
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  v = v.map((p) => { const l = Math.hypot(...p); return p.map((c) => c / l); });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s += 1) {
    const mid = new Map();
    const m = (a, b) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (mid.has(key)) return mid.get(key);
      const p = [0, 1, 2].map((k) => (v[a][k] + v[b][k]) / 2);
      const l = Math.hypot(...p);
      v.push(p.map((c) => c / l));
      mid.set(key, v.length - 1);
      return v.length - 1;
    };
    const nf = [];
    for (const [a, b, c] of f) { const ab = m(a, b); const bc = m(b, c); const ca = m(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  const out = { v, f };
  ICO.set(sub, out);
  return out;
}

class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.n = 0; }
  vert(p, n, c, sway = 0) {
    this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(c[0], c[1], c[2], sway);
    this.n += 1;
    return this.n - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
}

function addRock(B, cx, cz, size, rnd, base, moss) {
  const { v, f } = icosphere(size > 0 && B.detail ? 2 : 1);
  const sx = 0.8 + rnd() * 0.6; const sy = 0.45 + rnd() * 0.4; const sz = 0.75 + rnd() * 0.55;
  const rot = rnd() * Math.PI * 2; const off = rnd() * 100;
  const cr = Math.cos(rot); const sr = Math.sin(rot);
  const pts = v.map((p) => {
    const rid = Math.abs(vnoise3(p[0] * 2.3 + off, p[1] * 2.3 + off, p[2] * 2.3) - 0.5) * 2;
    const n = 0.7 + 0.42 * vnoise3(p[0] * 1.5 + off, p[1] * 1.5, p[2] * 1.5) + 0.26 * (1 - rid) ** 2 + 0.1 * vnoise3(p[0] * 5, p[1] * 5 + off, p[2] * 5);
    const x = p[0] * n * sx * size; const y = p[1] * n * sy * size + size * sy * 0.32; const z = p[2] * n * sz * size;
    return [cx + x * cr - z * sr, y, cz + x * sr + z * cr];
  });
  const nor = pts.map(() => [0, 0, 0]);
  for (const [a, b, c] of f) {
    const u = [0, 1, 2].map((k) => pts[b][k] - pts[a][k]); const w = [0, 1, 2].map((k) => pts[c][k] - pts[a][k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const i of [a, b, c]) { nor[i][0] += n[0]; nor[i][1] += n[1]; nor[i][2] += n[2]; }
  }
  const tone = 0.8 + rnd() * 0.35;
  const first = B.n;
  pts.forEach((p, i) => {
    const l = Math.hypot(...nor[i]) || 1;
    const n = nor[i].map((c) => c / l);
    const ao = 0.5 + 0.5 * sstep(0, size * sy * 0.55, p[1]);
    const sp = 0.86 + 0.28 * vnoise3(p[0] * 0.9 + off, p[1] * 0.9, p[2] * 0.9);
    let c = base.map((ch) => ch * tone * sp * ao);
    if (moss) { const m = sstep(0.35, 0.8, n[1]) * sstep(0.4, 0.62, vnoise3(p[0] * 0.5 + off, 3, p[2] * 0.5)); c = mix3(c, mul3(moss, 0.9 * ao), m * 0.8); }
    B.vert(p, n, c, 0);
  });
  for (const [a, b, c] of f) B.tri(first + a, first + b, first + c);
}

/** Una fronda: nervio curvo con folíolos en diente de sierra a cada lado. */
function addFrond(B, base, ang, len, elev, droop, width, c0, c1, swayK, segs) {
  const dx = Math.cos(ang); const dz = Math.sin(ang);
  const rib = [];
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    const r = len * t * Math.cos(elev) * (1 - 0.12 * t);
    rib.push([base[0] + dx * r, base[1] + len * (Math.sin(elev) * t - droop * t * t), base[2] + dz * r]);
  }
  for (let i = 0; i < segs; i += 1) {
    const t = (i + 0.5) / segs;
    const w = width * Math.sin(Math.PI * Math.min(1, t * 0.96 + 0.04)) ** 0.6 * (1 - 0.25 * t);
    const a = rib[i]; const b = rib[i + 1];
    const col = mix3(c0, c1, t);
    const colTip = mul3(col, 1.12);
    for (const s of [-1, 1]) {
      const tip = [
        (a[0] + b[0]) / 2 - dz * s * w + (b[0] - a[0]) * 0.55,
        (a[1] + b[1]) / 2 - w * 0.22 + (b[1] - a[1]) * 0.55,
        (a[2] + b[2]) / 2 + dx * s * w + (b[2] - a[2]) * 0.55,
      ];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const v = [tip[0] - a[0], tip[1] - a[1], tip[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(...n) || 1;
      n = n.map((c) => c / l);
      if (n[1] < 0) n = n.map((c) => -c);
      // Normal suavizada hacia arriba: las hojas no se ven como papel doblado.
      n = [n[0] * 0.6, n[1] * 0.6 + 0.4, n[2] * 0.6];
      const sw = swayK * len;
      const i0 = B.vert(a, n, col, (i / segs) ** 2 * sw);
      const i1 = B.vert(b, n, col, ((i + 1) / segs) ** 2 * sw);
      const i2 = B.vert(tip, n, colTip, t * t * sw * 1.15);
      B.tri(i0, i1, i2);
    }
  }
}

function addFern(B, x, z, h, rnd, green, lod) {
  const n = lod ? 5 + Math.floor(rnd() * 3) : 8 + Math.floor(rnd() * 4);
  const a0 = rnd() * 6.28;
  const hue = 0.8 + rnd() * 0.45;
  const c0 = mul3(green, 0.5 * hue); const c1 = [green[0] * 1.25 * hue, green[1] * 1.3 * hue, green[2] * 0.9 * hue];
  for (let i = 0; i < n; i += 1) {
    const len = h * (1.15 + rnd() * 0.6);
    addFrond(B, [x, 0, z], a0 + (i / n) * 6.283 + rnd() * 0.5, len, 0.5 + rnd() * 0.75, 0.45 + rnd() * 0.4, len * (0.15 + rnd() * 0.05), c0, c1, 0.05, lod ? 5 : 9);
  }
}

function addTube(B, a, b, r0, r1, col0, col1, sides, sw0 = 0, sw1 = 0) {
  const first = B.n;
  for (let k = 0; k <= 1; k += 1) {
    const p = k ? b : a; const r = k ? r1 : r0; const c = k ? col1 : col0;
    for (let s = 0; s < sides; s += 1) {
      const an = (s / sides) * 6.283;
      const n = [Math.cos(an), 0.15, Math.sin(an)];
      B.vert([p[0] + n[0] * r, p[1], p[2] + n[2] * r], n, mul3(c, 0.78 + 0.22 * Math.max(0, n[0] * 0.5 + 0.5)), k ? sw1 : sw0);
    }
  }
  for (let s = 0; s < sides; s += 1) {
    const s1 = (s + 1) % sides;
    B.tri(first + s, first + sides + s, first + s1);
    B.tri(first + s1, first + sides + s, first + sides + s1);
  }
}

function addCycad(B, x, z, h, rnd, green, lod) {
  const th = h * (0.3 + rnd() * 0.25); const tr = h * (0.1 + rnd() * 0.04);
  const bark = [0.12, 0.085, 0.05];
  addTube(B, [x, 0, z], [x, th * 0.55, z], tr * 1.15, tr, mul3(bark, 0.7), bark, lod ? 5 : 8);
  addTube(B, [x, th * 0.55, z], [x, th, z], tr, tr * 0.8, bark, mul3(bark, 1.25), lod ? 5 : 8);
  const n = lod ? 7 : 12 + Math.floor(rnd() * 5);
  const c0 = mul3(green, 0.38); const c1 = [green[0] * 0.85, green[1] * 1.05, green[2] * 0.7];
  for (let i = 0; i < n; i += 1) {
    const len = h * (0.8 + rnd() * 0.35);
    addFrond(B, [x, th * 0.96, z], (i / n) * 6.283 + rnd() * 0.4, len, 0.15 + rnd() * 0.85, 0.3 + rnd() * 0.3, len * 0.085, c0, c1, 0.035, lod ? 5 : 10);
  }
}

function addHorsetails(B, x, z, h, rnd, green, lod) {
  const stalks = lod ? 4 : 6 + Math.floor(rnd() * 6);
  const col = [green[0] * 0.9, green[1] * 1.2, green[2] * 0.6];
  for (let s = 0; s < stalks; s += 1) {
    const sx = x + (rnd() - 0.5) * h * 0.7; const sz = z + (rnd() - 0.5) * h * 0.7;
    const hh = h * (0.6 + rnd() * 0.6); const r = hh * 0.016;
    const lean = [(rnd() - 0.5) * hh * 0.12, 0, (rnd() - 0.5) * hh * 0.12];
    const top = [sx + lean[0], hh, sz + lean[2]];
    addTube(B, [sx, 0, sz], top, r, r * 0.4, mul3(col, 0.55), col, 4, 0, hh * 0.05);
    const whorls = lod ? 4 : 7;
    for (let w = 1; w <= whorls; w += 1) {
      const t = w / (whorls + 1);
      const c = [sx + lean[0] * t, hh * t, sz + lean[2] * t];
      const nl = hh * 0.2 * (1 - t * 0.55);
      const k = lod ? 4 : 6;
      const a0 = rnd() * 6.28;
      for (let j = 0; j < k; j += 1) {
        const an = a0 + (j / k) * 6.283;
        const d = [Math.cos(an), Math.sin(an)];
        const tip = [c[0] + d[0] * nl, c[1] + nl * 0.55, c[2] + d[1] * nl];
        const n = [d[0] * 0.3, 0.9, d[1] * 0.3];
        const sw = t * t * hh * 0.05;
        const cc = mul3(col, 0.8 + 0.4 * t);
        const i0 = B.vert([c[0] - d[1] * r * 1.6, c[1], c[2] + d[0] * r * 1.6], n, cc, sw);
        const i1 = B.vert([c[0] + d[1] * r * 1.6, c[1], c[2] - d[0] * r * 1.6], n, cc, sw);
        const i2 = B.vert(tip, n, mul3(cc, 1.15), sw * 1.2);
        B.tri(i0, i1, i2);
      }
    }
  }
}

function addBush(B, x, z, h, rnd) {
  const twigs = 9 + Math.floor(rnd() * 6);
  const col = [0.3, 0.2, 0.1];
  for (let i = 0; i < twigs; i += 1) {
    const an = rnd() * 6.283; const el = 0.4 + rnd() * 0.9; const len = h * (0.6 + rnd() * 0.6);
    const d = [Math.cos(an) * Math.cos(el), Math.sin(el), Math.sin(an) * Math.cos(el)];
    const tip = [x + d[0] * len, d[1] * len, z + d[2] * len];
    addTube(B, [x, 0, z], tip, len * 0.022, len * 0.006, mul3(col, 0.7), mul3(col, 1.3), 3, 0, len * 0.03);
    for (let j = 0; j < 2; j += 1) {
      const t = 0.45 + rnd() * 0.35;
      const p = [x + d[0] * len * t, d[1] * len * t, z + d[2] * len * t];
      const a2 = an + (rnd() - 0.5) * 1.8;
      const tip2 = [p[0] + Math.cos(a2) * len * 0.35, p[1] + len * 0.3, p[2] + Math.sin(a2) * len * 0.35];
      addTube(B, p, tip2, len * 0.012, len * 0.004, col, mul3(col, 1.4), 3, len * 0.02, len * 0.04);
    }
  }
}

function addKelp(B, x, z, h, rnd) {
  const blades = 3 + Math.floor(rnd() * 3);
  for (let b = 0; b < blades; b += 1) {
    const bx = x + (rnd() - 0.5) * h * 0.12; const bz = z + (rnd() - 0.5) * h * 0.12;
    const hh = h * (0.6 + rnd() * 0.5); const w = hh * 0.035; const an = rnd() * 6.283; const ph = rnd() * 6;
    const d = [Math.cos(an), Math.sin(an)];
    const segs = 8; let prev = null;
    for (let i = 0; i <= segs; i += 1) {
      const t = i / segs;
      const wob = Math.sin(t * 5 + ph) * hh * 0.05;
      const c = [bx + d[1] * wob, hh * t, bz - d[0] * wob];
      const ww = w * (1 - t * 0.6);
      const col = [0.05 + 0.05 * t, 0.16 + 0.12 * t, 0.07];
      const n = [d[1] * 0.5, 0.5, -d[0] * 0.5];
      const i0 = B.vert([c[0] - d[0] * ww, c[1], c[2] - d[1] * ww], n, col, t * t * hh * 0.16);
      const i1 = B.vert([c[0] + d[0] * ww, c[1], c[2] + d[1] * ww], n, col, t * t * hh * 0.16);
      if (prev) { B.tri(prev[0], prev[1], i0); B.tri(prev[1], i1, i0); }
      prev = [i0, i1];
    }
  }
}

/**
 * Rocas y plantas alrededor del animal, en el espacio del modelo.
 * info = { center:[x,z], half:[a,b] semiejes del cuerpo, height, upm (unidades
 * por metro), camDist }. Cerca del animal todo es bajo para no taparlo; más
 * allá de la cámara las plantas tienen su tamaño real.
 */
export function buildProps(look, info, seed) {
  const rnd = rng(seed);
  const B = new Batch();
  const { center, half, height, upm, camDist } = info;
  const hab = look.hab;
  const rockCol = mix3([0.2, 0.19, 0.17], look.earth, 0.35);
  const moss = hab.wet > 0.15 && !look.under ? mul3(look.foliage, 1.1) : null;
  const green = look.foliage;
  const nearMax = camDist * 0.72;
  const farMin = camDist * 1.4; const farMax = camDist * 5.5;
  const inBody = (x, z, pad) => ((x - center[0]) / (half[0] * pad)) ** 2 + ((z - center[1]) / (half[1] * pad)) ** 2 < 1;
  const maxH = (r) => height * (0.2 + 0.26 * sstep(Math.max(half[0], half[1]), nearMax, r));
  const taken = [];
  const spot = (far, pad, sizeUnits) => {
    for (let tries = 0; tries < 24; tries += 1) {
      const an = rnd() * 6.283;
      const r = far ? farMin + (farMax - farMin) * rnd() ** 1.6 : Math.max(half[1], 2) + (nearMax - Math.max(half[1], 2)) * rnd() ** 0.8;
      const x = center[0] + Math.cos(an) * r; const z = center[1] + Math.sin(an) * r;
      if (!far && inBody(x, z, pad)) continue;
      if (taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < (t[2] + sizeUnits) * 0.6)) continue;
      taken.push([x, z, sizeUnits]);
      return [x, z, Math.hypot(x - center[0], z - center[1])];
    }
    return null;
  };
  const make = (kind, count, far) => {
    for (let i = 0; i < count; i += 1) {
      // Tamaños reales en metros.
      const m = kind === 'rock' ? 0.25 + rnd() ** 2 * 1.1 : kind === 'pebble' ? 0.04 + rnd() * 0.09 : kind === 'fern' ? 0.45 + rnd() * 0.5
        : kind === 'horsetail' ? 0.7 + rnd() * 0.8 : kind === 'cycad' ? 1.3 + rnd() * 1.2 : kind === 'kelp' ? 2 + rnd() * 3 : 0.5 + rnd() * 0.5;
      let size = m * upm;
      const p = spot(far, kind === 'pebble' ? 1.02 : 1.2, kind === 'pebble' ? 0 : size);
      if (!p) continue;
      if (!far && kind !== 'pebble') size = Math.min(size, maxH(p[2]) * (kind === 'rock' ? 0.5 : kind === 'kelp' ? 2.4 : 1));
      if (far) {
        // Lejos tienen su tamaño real, pero sin tapar el encuadre ni invadir
        // el círculo por donde pasa la cámara al girar.
        if (kind === 'rock') size *= 1.5;
        size = Math.min(size, height * (kind === 'rock' ? 1.1 : kind === 'cycad' || kind === 'kelp' ? 3.2 : 2.2), (p[2] - camDist * 1.2) / (kind === 'rock' ? 1.5 : 2));
        if (size < height * 0.02) continue;
      }
      const lod = far;
      B.detail = !far;
      if (kind === 'rock') addRock(B, p[0], p[1], size, rnd, rockCol, moss);
      else if (kind === 'pebble') addRock(B, p[0], p[1], Math.max(size, height * 0.006), rnd, mix3(rockCol, look.earth, 0.3), null);
      else if (kind === 'fern') addFern(B, p[0], p[1], size, rnd, green, lod);
      else if (kind === 'horsetail') addHorsetails(B, p[0], p[1], size, rnd, green, lod);
      else if (kind === 'cycad') addCycad(B, p[0], p[1], size, rnd, green, lod);
      else if (kind === 'bush') addBush(B, p[0], p[1], size, rnd);
      else if (kind === 'kelp') addKelp(B, p[0], p[1], size, rnd);
    }
  };
  for (const [kind, n] of Object.entries(hab.props)) {
    make(kind, n, false);
    if (kind !== 'pebble') make(kind, Math.round(n * 2.4), true);
  }
  return B;
}

// ------------------------------------------------------------ sombreadores

// Cielo compartido: lo usan el fondo, los reflejos del agua y la bruma.
export const SKY_GLSL = `
uniform vec3 uZenith, uHorizon, uSunDir, uSunCol;
vec3 skyBase(vec3 d){
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uHorizon, uZenith, pow(h, 0.36));
  float sd = max(dot(normalize(vec3(d.x, max(d.y, 0.0), d.z)), uSunDir), 0.0);
  c += uSunCol*(pow(sd, 6.0)*0.1 + pow(sd, 40.0)*0.22);
  return c;
}`;

export const FINISH_GLSL = `
uniform float uHdr, uExposure;
vec3 aces(vec3 x){ x *= 0.6; return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
vec4 finish(vec3 col, float a){
  col *= uExposure;
  if (uHdr > 0.5) return vec4(col, a);
  return vec4(pow(aces(col), vec3(1.0/2.2)), a);
}`;

const SHADOW_GLSL = `
uniform sampler2DShadow uShadow; uniform float uUseShadow;
float shadowAt(vec4 lp){
  if (uUseShadow < 0.5) return 1.0;
  vec3 p = lp.xyz/lp.w*0.5+0.5;
  if (p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0||p.z>1.0) return 1.0;
  vec2 tx = 1.0/vec2(textureSize(uShadow,0));
  float s = 0.0;
  for (int i=-2;i<=2;i++) for (int j=-2;j<=2;j++) s += texture(uShadow, vec3(p.xy + vec2(float(i),float(j))*tx*1.5, p.z - 0.002));
  s /= 25.0;
  // La sombra se desvanece hacia el borde de su mapa.
  vec2 e = smoothstep(vec2(0.0), vec2(0.06), p.xy)*(1.0 - smoothstep(vec2(0.94), vec2(1.0), p.xy));
  return mix(1.0, s, e.x*e.y);
}`;

const SKY_VS = `#version 300 es
precision highp float;
out vec2 vNdc;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2))*2.0 - 1.0;
  vNdc = p; gl_Position = vec4(p, 1.0, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform mat4 uInvVP;
uniform vec3 uCam, uFar, uNear, uCloudCol, uFogCol;
uniform sampler2D uNoise;
uniform vec4 uSkyP;  // x = giro, y = tiempo, z = nubes, w = sierras del horizonte
uniform vec4 uSkyQ;  // x = noche, y = bajo el agua, z = dentado (coníferas)
${SKY_GLSL}
${FINISH_GLSL}
out vec4 outColor;
void main(){
  vec4 w = uInvVP*vec4(vNdc, 1.0, 1.0);
  vec3 d = normalize(w.xyz/w.w - uCam);
  vec3 c = skyBase(d);
  float az = atan(d.z, d.x) + uSkyP.x;
  float u = az/6.2831853;
  if (uSkyQ.y > 0.5) {
    // Bajo el agua: claridad arriba y rayos de luz que bajan.
    float up = clamp(d.y*0.5 + 0.5, 0.0, 1.0);
    c = mix(uHorizon*0.45, uZenith, pow(up, 1.6));
    float ray = texture(uNoise, vec2(u*6.0 + d.y*0.35, uSkyP.y*0.012)).r;
    c += uZenith*smoothstep(0.5, 0.85, ray)*smoothstep(-0.1, 0.7, d.y)*0.55;
    outColor = finish(c, 1.0);
    return;
  }
  // Estrellas y luna
  if (uSkyQ.x > 0.5) {
    vec2 sp = vec2(u*40.0, d.y*14.0);
    vec2 cell = floor(sp); vec2 f = fract(sp) - 0.5;
    float rnd = fract(sin(dot(cell, vec2(127.1, 311.7)))*43758.5453);
    vec2 off = vec2(fract(rnd*7.3), fract(rnd*13.7)) - 0.5;
    float star = smoothstep(0.09, 0.0, length(f - off*0.7))*step(0.72, rnd);
    c += vec3(0.8, 0.86, 1.0)*star*(0.35 + rnd)*smoothstep(0.02, 0.3, d.y);
    vec3 md = normalize(vec3(-0.52, 0.4, -0.76));
    float m = dot(d, md);
    c += vec3(1.0, 0.98, 0.9)*(smoothstep(0.9988, 0.9993, m)*2.6 + pow(max(m, 0.0), 900.0)*0.5 + pow(max(m, 0.0), 40.0)*0.08);
  }
  // Nubes: una capa plana vista en perspectiva.
  if (uSkyP.z > 0.0 && d.y > 0.0) {
    vec2 cp = d.xz/(d.y + 0.11);
    float ca = cos(uSkyP.x), sa = sin(uSkyP.x);
    cp = vec2(ca*cp.x - sa*cp.y, sa*cp.x + ca*cp.y)*0.16 + vec2(uSkyP.y*0.004, 0.0);
    float n = texture(uNoise, cp).r*0.62 + texture(uNoise, cp*2.7 + 0.3).g*0.38;
    float cover = smoothstep(1.0 - uSkyP.z*0.5, 1.22 - uSkyP.z*0.45, n + 0.42);
    float lit = 0.62 + 0.5*smoothstep(0.45, 0.85, n);
    c = mix(c, mix(uHorizon, uCloudCol*lit, smoothstep(0.02, 0.22, d.y)), cover*smoothstep(0.03, 0.16, d.y)*0.92);
  }
  // Horizonte: sierras lejanas y una línea de vegetación más cercana.
  if (uSkyP.w > 0.0) {
    float px = fwidth(d.y)*1.2;
    float r1 = (0.012 + 0.075*texture(uNoise, vec2(u*2.0, 0.21)).r)*uSkyP.w;
    c = mix(c, mix(uFar, uHorizon, 0.35), smoothstep(r1 + px, r1 - px, d.y)*0.92);
    float t2 = texture(uNoise, vec2(u*7.0, 0.63)).g;
    float spikes = texture(uNoise, vec2(u*90.0, 0.4)).b;
    float r2 = (0.004 + 0.034*t2 + uSkyQ.z*0.022*spikes*smoothstep(0.3, 0.6, t2))*uSkyP.w;
    c = mix(c, uNear, smoothstep(r2 + px, r2 - px, d.y)*0.95);
  }
  // Bajo el horizonte, la bruma con la que se funde el suelo.
  c = mix(c, uFogCol, smoothstep(0.004, -0.02, d.y));
  outColor = finish(c, 1.0);
}`;

const TERRAIN_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uModel, uView, uProj, uLightVP;
out vec3 vLocal; out vec3 vWorld; out vec4 vLight;
void main(){
  vLocal = aPos;
  vec4 wp = uModel*vec4(aPos, 1.0);
  vWorld = wp.xyz;
  vLight = uLightVP*wp;
  gl_Position = uProj*uView*wp;
}`;

const TERRAIN_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vLocal; in vec3 vWorld; in vec4 vLight;
uniform sampler2D uNoise, uRelief;
uniform vec3 uCam, uKeyDir, uKeyCol, uSkyAmb, uSoilA, uSoilB, uEarth, uFogCol, uWaterCol;
uniform vec4 uBlob;    // centro xz (mundo) y semiejes de la sombra de contacto
uniform vec4 uTerr;    // x = metros por unidad, y = cobertura vegetal, z = nivel de agua, w = humedad
uniform vec4 uTerr2;   // x = bruma desde, y = bruma hasta, z = modo (0 tierra, 1 mar, 2 submarino), w = tiempo
uniform vec4 uTerr3;   // x = ondas de duna, y = radio seco bajo el animal, z = cos giro, w = sin giro
uniform vec2 uCenter;  // centro del animal en el espacio del modelo
${SKY_GLSL}
${FINISH_GLSL}
${SHADOW_GLSL}
out vec4 outColor;
void main(){
  vec2 p = (vLocal.xz - uCenter)*uTerr.x;   // metros
  float dist = length(vWorld - uCam);
  vec4 nA = texture(uNoise, p*0.021);
  vec4 nB = texture(uNoise, p*0.11 + 0.37);
  vec4 r1 = texture(uRelief, p*0.42);
  vec4 r2 = texture(uRelief, p*0.085 + 0.21);
  vec4 r3 = texture(uRelief, p*1.9 + 0.5);
  // Relieve: pendientes de tres escalas (piedritas, terrones, ondulación).
  float far = smoothstep(uTerr2.x*0.4, uTerr2.y*0.5, dist);
  vec4 r4 = texture(uRelief, p*6.3 + 0.13);
  float close = 1.0 - smoothstep(uTerr2.x*0.15, uTerr2.x*0.9, dist);
  vec2 g = (r1.gb - 0.5)*0.75 + (r2.gb - 0.5)*0.7 + (r3.gb - 0.5)*0.8*(1.0 - far) + (r4.gb - 0.5)*0.6*close;
  float h = r1.r*0.4 + r2.r*0.25 + r3.r*0.2 + r4.r*0.15;
  if (uTerr3.x > 0.0) {
    // Ondas de arena que deja el viento.
    float ph = p.x*5.5 + p.y*1.6 + nB.r*5.0;
    g.x += cos(ph)*0.5*uTerr3.x*(1.0 - far); h += sin(ph)*0.08*uTerr3.x;
  }
  // Color: tierra desnuda con manchas de musgo y hojarasca.
  float cov = smoothstep(0.5 - uTerr.y*0.42, 0.66 - uTerr.y*0.32, nA.r*0.55 + nB.g*0.45)*step(0.001, uTerr.y);
  vec3 green = mix(uSoilB, uSoilA, nB.r);
  green = mix(green, green*vec3(1.25, 1.12, 0.6), smoothstep(0.45, 0.7, nA.g)*0.5);
  vec3 bare = mix(uEarth*0.82, uEarth*1.12, nB.g);
  if (uTerr.y < 0.001) bare = mix(uSoilB, uSoilA, nA.r*0.6 + nB.g*0.4);
  vec3 alb = mix(bare, green*(0.72 + 0.4*r3.a), cov);
  alb *= mix(0.6, 1.14, h)*(0.82 + 0.36*r3.a)*(0.9 + 0.2*r4.a*close);
  // Hojarasca y piedritas: motas claras y oscuras.
  alb = mix(alb, uEarth*1.5, smoothstep(0.72, 0.8, r4.a)*0.35*close);
  alb = mix(alb, alb*0.45, smoothstep(0.7, 0.78, r3.r*0.5 + r4.r*0.5)*0.5);
  // Agua: charcos (pantano) o el mar detrás de la playa (costa).
  float lvl = nA.a*0.6 + nA.g*0.4;
  float water = 0.0; float wet = uTerr.w*0.35; float foam = 0.0;
  float dry = smoothstep(uTerr3.y*0.8, uTerr3.y*1.5, length(p));
  if (uTerr2.z > 0.5 && uTerr2.z < 1.5) {
    float shore = -p.y - uTerr3.y*1.9 + (nB.r - 0.5)*5.0 + sin(uTerr2.w*0.5 + p.x*0.12)*0.5;
    water = smoothstep(0.0, 1.6, shore);
    wet = max(wet, smoothstep(-6.0, 0.0, shore)*0.9);
    foam = smoothstep(0.0, 0.5, shore)*(1.0 - smoothstep(0.5, 2.6, shore))*smoothstep(0.4, 0.6, texture(uNoise, p*0.35 + vec2(0.0, uTerr2.w*0.03)).g);
  } else if (uTerr.z > 0.0) {
    water = smoothstep(uTerr.z, uTerr.z - 0.035, lvl)*dry;
    wet = max(wet, smoothstep(uTerr.z + 0.14, uTerr.z, lvl)*dry);
  }
  alb *= mix(1.0, 0.58, wet);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  N.xz = vec2(uTerr3.z*N.x + uTerr3.w*N.z, -uTerr3.w*N.x + uTerr3.z*N.z);
  vec3 V = normalize(uCam - vWorld);
  vec3 L = normalize(uKeyDir);
  float sh = shadowAt(vLight);
  vec2 bd = (vWorld.xz - uBlob.xy)/uBlob.zw;
  float ao = 1.0 - 0.5*exp(-dot(bd, bd)*1.8);
  float ndl = max(dot(N, L), 0.0);
  float key = ndl*sh;
  if (uTerr2.z > 1.5) {
    // Cáusticas: la luz del sol enfocada por las olas.
    vec2 cp = p*0.12;
    float c1 = texture(uNoise, cp + vec2(uTerr2.w*0.02, uTerr2.w*0.013)).g;
    float c2 = texture(uNoise, cp*1.7 - vec2(uTerr2.w*0.017, uTerr2.w*0.008)).r;
    key *= 0.55 + 2.2*pow(max(0.0, 1.0 - abs(c1 - c2)*2.2), 6.0);
  }
  vec3 col = alb*(uKeyCol*key + uSkyAmb*ao*mix(0.8, 1.0, sh));
  // Brillo de la tierra mojada.
  vec3 H = normalize(L + V);
  col += uKeyCol*pow(max(dot(N, H), 0.0), 60.0)*wet*0.45*sh*ndl;
  if (water > 0.0) {
    vec2 rp = p*0.9 + vec2(uTerr2.w*0.05, uTerr2.w*0.03);
    vec2 rip = (texture(uRelief, rp).gb - 0.5)*0.16 + (texture(uRelief, p*0.3 - vec2(uTerr2.w*0.02)).gb - 0.5)*0.12;
    vec3 Nw = normalize(vec3(rip.x, 1.0, rip.y));
    vec3 R = reflect(-V, Nw);
    float F = 0.03 + 0.97*pow(1.0 - max(dot(Nw, V), 0.0), 5.0);
    vec3 deep = uWaterCol*(uKeyCol*0.35*max(L.y, 0.0)*mix(0.5, 1.0, sh) + uSkyAmb*0.55);
    vec3 wc = mix(deep, skyBase(R)*mix(0.72, 1.0, sh), F);
    wc += uKeyCol*pow(max(dot(R, L), 0.0), 240.0)*2.5*sh;
    wc = mix(wc, vec3(1.0)*(uKeyCol*0.4*sh + uSkyAmb*0.7), foam*0.8);
    col = mix(col, wc*mix(1.0, ao, 0.5), water);
  }
  // Bruma hacia el horizonte.
  float fog = smoothstep(uTerr2.x, uTerr2.y, dist);
  col = mix(col, uFogCol, fog*0.94);
  outColor = finish(col, 1.0);
}`;

const PROP_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=3) in vec4 aCol;
uniform mat4 uModel, uView, uProj, uLightVP;
uniform float uTime, uShadowOff;
out vec3 vWorld; out vec3 vNormal; out vec4 vCol; out vec4 vLight;
void main(){
  vec3 p = aPos;
  // Viento: las hojas se mecen más en la punta.
  float ph = uTime*1.3 + p.x*0.04 + p.z*0.05;
  p.x += sin(ph)*aCol.a; p.z += cos(ph*0.8 + 1.0)*aCol.a*0.6;
  vec4 wp = uModel*vec4(p, 1.0);
  vWorld = wp.xyz;
  vNormal = mat3(uModel)*aNor;
  vCol = aCol;
  vLight = uLightVP*vec4(wp.xyz + normalize(vNormal)*uShadowOff, 1.0);
  gl_Position = uProj*uView*wp;
}`;

const PROP_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld; in vec3 vNormal; in vec4 vCol; in vec4 vLight;
uniform vec3 uCam, uKeyDir, uKeyCol, uSkyAmb, uGroundAmb, uFogCol;
uniform vec4 uTerr2; uniform float uGrain;
uniform sampler2D uNoise, uRelief;
${FINISH_GLSL}
${SHADOW_GLSL}
out vec4 outColor;
void main(){
  vec3 N = normalize(vNormal);
  float leaf = step(0.0001, vCol.a);
  if (!gl_FrontFacing) N = -N;
  vec3 alb = vCol.rgb;
  if (leaf < 0.5) {
    // Roca: grano, vetas y pequeñas picaduras (textura proyectada por tres lados).
    vec3 w = abs(N); w /= (w.x + w.y + w.z);
    vec3 q = vWorld*uGrain;
    vec4 tx = texture(uRelief, q.zy)*w.x + texture(uRelief, q.xz)*w.y + texture(uRelief, q.xy)*w.z;
    vec4 tb = texture(uRelief, q.zy*0.23)*w.x + texture(uRelief, q.xz*0.23)*w.y + texture(uRelief, q.xy*0.23)*w.z;
    alb *= mix(0.62, 1.2, tx.r)*mix(0.8, 1.15, tb.a);
    vec2 gg = (tx.gb - 0.5)*1.4 + (tb.gb - 0.5)*1.0;
    vec3 t1 = normalize(cross(N, vec3(0.31, 0.77, 0.55)));
    N = normalize(N + (t1*gg.x + cross(N, t1)*gg.y)*0.9);
  }
  vec3 L = normalize(uKeyDir);
  float ndl = dot(N, L);
  float sh = shadowAt(vLight);
  // Las hojas dejan pasar algo de luz; la roca no.
  float diff = mix(max(ndl, 0.0), max(ndl, 0.0)*0.75 + max(-ndl, 0.0)*0.3 + 0.12, leaf);
  vec3 amb = mix(uGroundAmb, uSkyAmb, N.y*0.5 + 0.5);
  float gao = mix(0.55, 1.0, smoothstep(0.0, 1.0, leaf > 0.5 ? 1.0 : N.y*0.5 + 0.6));
  vec3 col = alb*(uKeyCol*diff*sh + amb*gao*mix(0.8, 1.0, sh));
  float dist = length(vWorld - uCam);
  float fog = smoothstep(uTerr2.x, uTerr2.y, dist);
  col = mix(col, uFogCol, fog);
  outColor = finish(col, 1.0);
}`;

const PROP_DEPTH_FS = `#version 300 es
precision highp float;
out vec4 o; void main(){ o = vec4(1.0); }`;

// ------------------------------------------------------------ pase de escenario

export function createEnvPass(gl, compile, makeTex, sharedNoise) {
  const sky = compile(gl, SKY_VS, SKY_FS);
  const terrain = compile(gl, TERRAIN_VS, TERRAIN_FS);
  const prop = compile(gl, PROP_VS, PROP_FS);
  const propDepth = compile(gl, PROP_VS, PROP_DEPTH_FS);
  const noiseTex = sharedNoise || makeTex(gl, noiseTexture(256), { srgb: false });
  const reliefTex = makeTex(gl, reliefTexture(256), { srgb: false });
  const skyVao = gl.createVertexArray();
  const terrVao = gl.createVertexArray();
  const terrBuf = gl.createBuffer();
  gl.bindVertexArray(terrVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, terrBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /** Prepara el escenario de un animal. */
  function build(look, info, seed) {
    const B = buildProps(look, info, seed);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const bufs = [];
    [[B.pos, 3, 0], [B.nor, 3, 1], [B.col, 4, 3]].forEach(([arr, n, loc]) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
      bufs.push(b);
    });
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(B.idx), gl.STATIC_DRAW);
    bufs.push(ib);
    gl.bindVertexArray(null);
    // Suelo: un cuadro enorme; la bruma lo funde con el horizonte antes del borde.
    const R = info.camDist * 40;
    const [cx, cz] = info.center;
    const quad = new Float32Array([cx - R, 0, cz - R, cx + R, 0, cz + R, cx + R, 0, cz - R, cx - R, 0, cz - R, cx - R, 0, cz + R, cx + R, 0, cz + R]);
    return { look, info, vao, bufs, count: B.idx.length, quad, tris: B.idx.length / 3 };
  }
  function dispose(env) {
    gl.deleteVertexArray(env.vao);
    for (const b of env.bufs) gl.deleteBuffer(b);
  }

  function bindCommon(prog, env, c) {
    const u = prog.u;
    if (u.uModel) gl.uniformMatrix4fv(u.uModel, false, c.model);
    if (u.uView) gl.uniformMatrix4fv(u.uView, false, c.cam.view);
    if (u.uProj) gl.uniformMatrix4fv(u.uProj, false, c.cam.proj);
    if (u.uLightVP) gl.uniformMatrix4fv(u.uLightVP, false, c.lightVP);
    if (u.uCam) gl.uniform3fv(u.uCam, c.cam.pos);
    if (u.uKeyDir) gl.uniform3fv(u.uKeyDir, c.light.key);
    if (u.uKeyCol) gl.uniform3fv(u.uKeyCol, c.light.keyCol);
    if (u.uSunDir) gl.uniform3fv(u.uSunDir, c.light.key);
    if (u.uSunCol) gl.uniform3fv(u.uSunCol, c.light.keyCol.map((v) => v * (env.look.under ? 0 : 1)));
    if (u.uSkyAmb) gl.uniform3fv(u.uSkyAmb, env.look.skyAmb);
    if (u.uGroundAmb) gl.uniform3fv(u.uGroundAmb, env.look.groundAmb);
    if (u.uZenith) gl.uniform3fv(u.uZenith, env.look.zenith);
    if (u.uHorizon) gl.uniform3fv(u.uHorizon, env.look.horizon);
    if (u.uFogCol) gl.uniform3fv(u.uFogCol, env.look.fog);
    if (u.uHdr) gl.uniform1f(u.uHdr, c.hdr ? 1 : 0);
    if (u.uExposure) gl.uniform1f(u.uExposure, c.exposure);
    if (u.uTime) gl.uniform1f(u.uTime, c.time);
    if (u.uShadowOff) gl.uniform1f(u.uShadowOff, c.shadowOff);
    const d = env.info.camDist;
    const under = env.look.under;
    if (u.uTerr2) gl.uniform4fv(u.uTerr2, [d * (under ? 0.7 : 3), d * (under ? 4.5 : 30), under ? 2 : env.look.hab.sea ? 1 : 0, c.time]);
    if (u.uShadow) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, c.shadowTex);
      gl.uniform1i(u.uShadow, 1);
      gl.uniform1f(u.uUseShadow, c.shadows ? 1 : 0);
    }
    if (u.uNoise) { gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, noiseTex); gl.uniform1i(u.uNoise, 4); }
    if (u.uRelief) { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, reliefTex); gl.uniform1i(u.uRelief, 5); }
  }

  /** Las plantas y rocas también dan sombra. */
  function drawDepth(env, c) {
    if (!env.count) return;
    gl.useProgram(propDepth.p);
    const u = propDepth.u;
    gl.uniformMatrix4fv(u.uModel, false, c.model);
    gl.uniformMatrix4fv(u.uView, false, c.lightView);
    gl.uniformMatrix4fv(u.uProj, false, c.lightProj);
    if (u.uTime) gl.uniform1f(u.uTime, c.time);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(env.vao);
    gl.drawElements(gl.TRIANGLES, env.count, gl.UNSIGNED_INT, 0);
  }

  function draw(env, c) {
    const look = env.look;
    // Cielo (sin tocar la profundidad)
    gl.useProgram(sky.p);
    bindCommon(sky, env, c);
    gl.uniformMatrix4fv(sky.u.uInvVP, false, c.invVP);
    gl.uniform3fv(sky.u.uFar, look.far);
    gl.uniform3fv(sky.u.uNear, look.near);
    gl.uniform3fv(sky.u.uCloudCol, look.cloudCol);
    gl.uniform4fv(sky.u.uSkyP, [c.yaw, c.time, look.cloud, look.ridge]);
    gl.uniform4fv(sky.u.uSkyQ, [look.night ? 1 : 0, look.under ? 1 : 0, look.biome === 'bosque' ? 1 : look.biome === 'pantano' ? 0.5 : 0.15, 0]);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    // Suelo
    gl.useProgram(terrain.p);
    bindCommon(terrain, env, c);
    const t = terrain.u;
    const hab = look.hab;
    gl.uniform3fv(t.uSoilA, look.soilA);
    gl.uniform3fv(t.uSoilB, look.soilB);
    gl.uniform3fv(t.uEarth, look.earth);
    gl.uniform3fv(t.uWaterCol, look.water);
    gl.uniform4fv(t.uBlob, c.blob);
    gl.uniform4fv(t.uTerr, [1 / env.info.upm, hab.cover, hab.water || 0, hab.wet]);
    gl.uniform4fv(t.uTerr3, [hab.ripple || 0, (Math.max(env.info.half[0], env.info.half[1]) * 1.1) / env.info.upm, Math.cos(c.yaw), Math.sin(c.yaw)]);
    gl.uniform2fv(t.uCenter, env.info.center);
    gl.bindVertexArray(terrVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, terrBuf);
    gl.bufferData(gl.ARRAY_BUFFER, env.quad, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // Rocas y plantas
    if (env.count) {
      gl.useProgram(prop.p);
      bindCommon(prop, env, c);
      gl.uniform1f(prop.u.uGrain, 2.2 / env.info.upm);
      gl.bindVertexArray(env.vao);
      gl.drawElements(gl.TRIANGLES, env.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  }

  return { build, dispose, draw, drawDepth, noiseTex };
}
