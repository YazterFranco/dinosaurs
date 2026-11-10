// Texturas procedurales (píxeles RGBA en memoria, sin canvas): piel con el
// color y el patrón de los genes, relieve de escamas, iris y hebras de plumas.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** 'hsl(30 40% 50%)' o '#rrggbb' → [r, g, b] en 0..255 (sRGB). */
export function cssToRgb(c) {
  if (!c) return [128, 128, 128];
  if (c[0] === '#') {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const m = /hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(c);
  if (!m) return [128, 128, 128];
  const h = Number(m[1]) / 360; const s = Number(m[2]) / 100; const l = Number(m[3]) / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    let x = t;
    if (x < 0) x += 1; if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}

// Ruido de valor determinista.
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s); const b = hash(xi + 1, yi, s); const c = hash(xi, yi + 1, s); const d = hash(xi + 1, yi + 1, s);
  return mix(mix(a, b, u), mix(c, d, u), v);
}
function fbm(x, y, s = 0) { return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15; }

// Las texturas genéricas se calculan una sola vez por página y se comparten
// entre el renderizador de imágenes y los visores.
const memo = new Map();
const once = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key); };

/** Celdas de Voronoi sobre una rejilla agitada, repetible en los bordes. */
function cells(u, v, N, seed, jitter, hex) {
  const cu = u * N; const cv = v * N;
  const i0 = Math.floor(cu); const j0 = Math.floor(cv);
  let d1 = 9; let d2 = 9; let w1 = 1;
  for (let dj = -2; dj <= 2; dj += 1) {
    const j = j0 + dj;
    const jw = ((j % N) + N) % N;
    const off = hex ? (jw % 2) * 0.5 : 0;
    for (let di = -2; di <= 2; di += 1) {
      const i = i0 + di;
      const iw = ((i % N) + N) % N;
      const px = i + off + 0.5 + (hash(iw, jw, seed) - 0.5) * jitter;
      const py = j + 0.5 + (hash(iw, jw, seed + 1) - 0.5) * jitter;
      const w = 0.7 + hash(iw, jw, seed + 2) * 0.6;
      const d = Math.hypot(cu - px, cv - py) / w;
      if (d < d1) { d2 = d1; d1 = d; w1 = w; } else if (d < d2) d2 = d;
    }
  }
  return [d1, d2, w1];
}

/** Ruido de valor que se repite cada `per` unidades. */
function pnoise(x, y, per, s) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf);
  const w = (n) => ((n % per) + per) % per;
  const a = hash(w(xi), w(yi), s); const b = hash(w(xi + 1), w(yi), s); const c = hash(w(xi), w(yi + 1), s); const d = hash(w(xi + 1), w(yi + 1), s);
  return mix(mix(a, b, u), mix(c, d, u), v);
}

/**
 * Detalle de piel que se repite en mosaico, un relieve por canal:
 *  R = escamas finas (celdas en panal), G = piel curtida (red de arrugas),
 *  B = escamas grandes sueltas y abultamientos suaves.
 */
export function skinDetail(size = 256, seed = 3) {
  return once(`detail${size},${seed}`, () => {
    const data = new Uint8Array(size * size * 4);
    const N1 = 14; const N2 = 7; const N3 = 5;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = x / size; const v = y / size;
        const [a1, a2, aw] = cells(u, v, N1, seed, 0.85, true);
        const edge = smooth(0, 0.2, a2 - a1);
        const dome = Math.sqrt(Math.max(0, 1 - Math.min(1, a1 / 0.72) ** 2));
        const grain = pnoise(u * 48, v * 48, 48, seed + 9);
        const r = clamp((dome * 0.7 + 0.3 * (aw - 0.7) / 0.6) * edge + (grain - 0.5) * 0.12, 0, 1);
        const [b1, b2] = cells(u, v, N2, seed + 20, 1.25, false);
        const crease = smooth(0, 0.16, b2 - b1);
        const soft = pnoise(u * 9, v * 9, 9, seed + 30) * 0.6 + pnoise(u * 21, v * 21, 21, seed + 31) * 0.4;
        const g = clamp(crease * (0.72 + soft * 0.28), 0, 1);
        const [c1, c2] = cells(u, v, N3, seed + 40, 1.1, false);
        const big = Math.sqrt(Math.max(0, 1 - Math.min(1, c1 / 0.62) ** 2)) * smooth(0, 0.25, c2 - c1);
        const b = clamp(big * 0.7 + soft * 0.3, 0, 1);
        const o = (y * size + x) * 4;
        data[o] = Math.round(r * 255); data[o + 1] = Math.round(g * 255); data[o + 2] = Math.round(b * 255); data[o + 3] = 255;
      }
    }
    return { w: size, h: size, data };
  });
}

/** Hebras para las capas de plumas o picnofibras. */
export function strandNoise(size = 64, seed = 5) {
  return once(`strand${size},${seed}`, () => makeStrandNoise(size, seed));
}
function makeStrandNoise(size, seed) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const v = Math.pow(hash(x, y, seed), 0.8);
      const o = (y * size + x) * 4;
      const c = Math.round(v * 255);
      data[o] = c; data[o + 1] = c; data[o + 2] = c; data[o + 3] = 255;
    }
  }
  return { w: size, h: size, data };
}

/** Iris: anillo oscuro, vetas radiales, pupila y fondo oscuro. */
export function irisTexture(color, size = 64) {
  const [r, g, b] = cssToRgb(color);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size - 0.5; const dy = (y + 0.5) / size - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2; // 0 centro, 1 borde
      const a = Math.atan2(dy, dx);
      const streak = 0.85 + 0.15 * Math.sin(a * 23) * Math.sin(a * 7 + d * 9);
      let k = streak * mix(1.15, 0.7, smooth(0.3, 0.95, d));
      let cr = r * k; let cg = g * k; let cb = b * k;
      const pupil = smooth(0.36, 0.31, d);
      const limbal = smooth(0.82, 0.98, d);
      cr = mix(cr, 18, pupil); cg = mix(cg, 12, pupil); cb = mix(cb, 8, pupil);
      cr = mix(cr, 28, limbal); cg = mix(cg, 20, limbal); cb = mix(cb, 14, limbal);
      const o = (y * size + x) * 4;
      data[o] = clamp(cr, 0, 255); data[o + 1] = clamp(cg, 0, 255); data[o + 2] = clamp(cb, 0, 255); data[o + 3] = 255;
    }
  }
  return { w: size, h: size, data };
}

const lerpRgb = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/**
 * Colores naturales: los genes dan el tono, pero la piel de un animal real
 * es más apagada y terrosa que un color puro. `k` es cuánta saturación queda.
 */
export function natural(rgb, k = 0.66, dim = 0.95) {
  const l = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2];
  const gray = [l * 1.04, l, l * 0.93];
  return rgb.map((c, i) => clamp((gray[i] + (c - gray[i]) * k) * dim, 0, 255));
}

function interpMap(map, u) {
  let i = 1;
  while (i < map.length - 1 && map[i].u < u) i += 1;
  const a = map[i - 1]; const b = map[i];
  const t = clamp((u - a.u) / ((b.u - a.u) || 1), 0, 1);
  const out = {};
  for (const k of Object.keys(b)) out[k] = typeof b[k] === 'number' ? mix(a[k], b[k], t) : b[k];
  return out;
}

/** Pliegue de piel: 1 en la cresta redondeada, 0 en el surco. */
const fold = (x) => Math.sqrt(Math.abs(Math.sin(Math.PI * x)));
const gauss = (x, s) => Math.exp(-(x * x) / (2 * s * s));

/**
 * Piel del cuerpo: u a lo largo (cola → cuello), v alrededor (0 = costado
 * lejano, 0.25 = vientre, 0.75 = lomo). El color lleva contrasombreado,
 * manchas naturales y el patrón de los genes; el canal alfa guarda el relieve
 * anatómico (pliegues del cuello, de las axilas y la ingle, arrugas del
 * vientre) que el sombreador convierte en luz y sombra.
 */
export function bodyTexture(model, opts = {}) {
  const W = opts.w || 512; const H = opts.h || 256;
  const c = model.colors;
  const info = model.info;
  const skin = natural(cssToRgb(c.piel)); const dark = natural(cssToRgb(c.sombra), 0.6, 0.9); const belly = natural(cssToRgb(c.vientre), 0.5, 0.98);
  const pat = natural(cssToRgb(c.patron), 0.7, 0.9); const light = natural(cssToRgb(c.brillo), 0.6);
  const seed = info.seed;
  const type = c.patronId;
  const counter = opts.countershade ? 1 : 0.82;
  const period = 7 + info.rx * 0.07;
  const map = info.bodyMap;
  const total = Math.max(1, map[map.length - 1].s);
  const reg = info.regions;
  const sAt = (x) => { for (const m of map) if (m.x >= x) return m.s; return total; };
  const sTail = sAt(reg.tailBase);
  const sNeck = sAt(reg.neckStart);
  const sHip = sAt(reg.hipX ?? reg.tailBase + info.rx * 0.5);
  const sSh = sAt(reg.shoulderX ?? reg.neckStart - info.rx * 0.1);
  const k = info.skinScale || 1; // animales grandes: pliegues más finos
  const feathered = info.feathered;
  const data = new Uint8Array(W * H * 4);
  const cols = [];
  for (let x = 0; x < W; x += 1) cols.push(interpMap(map, (x + 0.5) / W));
  // Tamaño de un píxel de textura en unidades del animal: los patrones finos
  // nunca bajan de unos pocos píxeles, así no se ven pixelados.
  // Lo que solo depende de la posición a lo largo se calcula una vez por columna.
  const colW = cols.map((m) => ({
    neck: smooth(sNeck - total * 0.02, sNeck + total * 0.05, m.s) * smooth(total, total - total * 0.04, m.s),
    hip: gauss(m.s - (sHip + info.rx * 0.34), info.rx * 0.12) * 0.9,
    sh: gauss(m.s - (sSh - info.rx * 0.2), info.rx * 0.1) * 0.8,
    tail: gauss(m.s - sTail, info.rx * 0.14) * 0.5,
    fade: smooth(0, sTail * 0.6 + 1, m.s),
  }));
  const texel = Math.max(total / W, Math.max(...cols.map((m) => m.girth || 1)) / H);
  for (let y = 0; y < H; y += 1) {
    const v = (y + 0.5) / H;
    const phi = Math.PI + v * Math.PI * 2;
    const s = Math.sin(phi);
    const side = Math.cos(phi);
    for (let x = 0; x < W; x += 1) {
      const m = cols[x];
      const along = m.s;
      const girth = Math.max(1, m.girth);
      // Distancia alrededor medida desde el lomo, simétrica en los dos
      // costados: los dibujos no se cortan en la unión de la textura.
      const around = Math.abs(((v - 0.25 + 1) % 1) - 0.5) * girth;
      const isTail = along < sTail;
      const n1 = fbm(along / 9, (around + 3) / 9, seed);
      const n2 = vnoise(along / 15, around / 10, seed + 51);
      // Contrasombreado con borde irregular: lomo oscuro, vientre claro.
      const sj = s + (n1 - 0.5) * 0.5;
      let col = skin;
      col = lerpRgb(col, dark, smooth(0.15, 0.95, sj) * 0.62);
      col = lerpRgb(col, light, smooth(0.6, 0.15, Math.abs(sj - 0.2)) * 0.1);
      col = lerpRgb(col, belly, smooth(-0.05, -0.8, sj) * counter);
      // Manchas grandes y difusas, y grano fino.
      col = col.map((ch) => ch * (0.86 + n2 * 0.2 + n1 * 0.1));
      const grain = hash(x, y, seed + 77);
      col = col.map((ch) => ch * (0.975 + grain * 0.05));
      // Patrón de los genes.
      let p = 0;
      if (type === 'rayas') {
        const wob = (fbm(along / 14, around / 6, seed + 3) - 0.5) * 2.6;
        const f = Math.sin((along / period) * Math.PI * 2 + wob + Math.abs(s - 1) * 0.6);
        p = smooth(0.3, 0.62, f) * smooth(-0.45, 0.3, sj);
        p *= smooth(0.9, 0.65, along / total);
        p *= 0.75 + n1 * 0.5;
      } else if (type === 'manchas') {
        const cell = Math.max(5.5, texel * 9);
        const gx = Math.floor(along / cell); const gy = Math.floor(around / cell);
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const cx = (gx + ox + 0.2 + hash(gx + ox, gy + oy, seed) * 0.6) * cell;
            const cyy = (gy + oy + 0.2 + hash(gx + ox, gy + oy, seed + 1) * 0.6) * cell;
            const r = cell * (0.18 + hash(gx + ox, gy + oy, seed + 2) * 0.24);
            const d = Math.hypot((along - cx) / 1.3, around - cyy) + (n1 - 0.5) * cell * 0.25;
            p = Math.max(p, smooth(r, r * 0.6, d));
          }
        }
        p *= smooth(-0.5, 0.1, sj);
      } else if (type === 'bandas') {
        if (isTail) {
          p = smooth(0.2, 0.45, Math.sin((along / (period * 0.9)) * Math.PI * 2));
        } else {
          const f = Math.sin((along / (period * 2.2)) * Math.PI * 2 + 1.3 + (n1 - 0.5));
          p = smooth(0.45, 0.7, f) * smooth(-0.1, 0.5, sj);
        }
      } else if (type === 'moteado') {
        // Moteado fino, como el de los cocodrilos (piel de Diplodocus juvenil,
        // 2025): manchitas redondas de tamaño variable. Se miran las celdas
        // vecinas para que ninguna mancha quede cortada en cuadrado.
        const cell = Math.max(2.6, texel * 7);
        const gx = Math.floor(along / cell); const gy = Math.floor(around / cell);
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const hx = gx + ox; const hy = gy + oy;
            if (hash(hx, hy, seed + 3) < 0.3) continue;
            const cx = (hx + 0.5 + (hash(hx, hy, seed) - 0.5) * 0.7) * cell;
            const cyy = (hy + 0.5 + (hash(hx, hy, seed + 1) - 0.5) * 0.7) * cell;
            const r = cell * (0.16 + hash(hx, hy, seed + 2) * 0.24);
            p = Math.max(p, smooth(r, r * 0.55, Math.hypot(along - cx, around - cyy)));
          }
        }
        p *= smooth(-0.6, 0.1, sj);
      }
      col = lerpRgb(col, pat, clamp(p, 0, 1) * 0.8);

      // ---- relieve anatómico (alfa) ----
      const ventral = smooth(0.3, -0.75, s);
      const flank = 1 - Math.abs(s);
      const cw = colW[x];
      const inNeck = cw.neck;

      // Pliegues que rodean el cuello (más marcados en la garganta), y los de
      // la ingle, la axila y la base de la cola.
      let wRing = inNeck * (0.35 + 0.65 * ventral);
      wRing += (cw.hip + cw.sh) * (0.25 + 0.75 * flank) + cw.tail * ventral;
      // (el ruido que ondula los pliegues solo se calcula donde hay pliegues)
      const ring = wRing > 0.02 ? fold(along / (2.7 * k) + (vnoise(along / 7, around / 3, seed + 31) - 0.5) * 1.5) : 1;
      // Arrugas a lo largo del vientre.
      const wBelly = smooth(-0.4, -0.92, s) * (1 - inNeck) * cw.fade * 0.55;
      const lon = wBelly > 0.02 ? fold(around / (2.3 * k) + (vnoise(along / 4, around / 5, seed + 41) - 0.5) * 1.3) : 1;
      const amp = feathered ? 0.35 : 1;
      let h = 0.5 + amp * (clamp(wRing, 0, 1) * (ring - 0.62) * 0.8 + wBelly * (lon - 0.62) * 0.6);
      // Volumen suave de los músculos: se nota al girar la luz.
      h += (n2 - 0.5) * 0.1;
      const groove = clamp(wRing, 0, 1) * (1 - ring) + wBelly * (1 - lon);
      col = col.map((ch) => ch * (1 - 0.22 * amp * clamp(groove, 0, 1)));
      const o = (y * W + x) * 4;
      data[o] = clamp(col[0], 0, 255); data[o + 1] = clamp(col[1], 0, 255); data[o + 2] = clamp(col[2], 0, 255); data[o + 3] = clamp(Math.round(h * 255), 0, 255);
    }
  }
  return { w: W, h: H, data };
}

/** Polilínea de un trazado de mandíbula "M.. C.." en coordenadas de la cabeza. */
function jawFn(jawPoly) {
  return (x) => {
    for (let i = 0; i < jawPoly.length - 1; i += 1) {
      const a = jawPoly[i]; const b = jawPoly[i + 1];
      if ((a[0] <= x && b[0] >= x) || (b[0] <= x && a[0] >= x)) {
        const t = (x - a[0]) / ((b[0] - a[0]) || 1);
        return mix(a[1], b[1], t);
      }
    }
    return null;
  };
}

/**
 * Piel de la cabeza: contrasombreado, boca con labios escamosos, narinas,
 * sombra alrededor del ojo, pico de queratina y antifaz. El canal alfa lleva
 * el relieve: surco de la boca, borde del labio, fosa nasal y ceja.
 */
export function headTexture(model, jawPoly, opts = {}) {
  const W = opts.w || 256; const H = opts.h || 128;
  const c = model.colors;
  const info = model.info;
  const hd = info.head;
  const skin = natural(cssToRgb(c.piel)); const dark = natural(cssToRgb(c.sombra), 0.6, 0.9); const belly = natural(cssToRgb(c.vientre), 0.5, 0.98); const pat = natural(cssToRgb(c.patron), 0.7, 0.9);
  const beakCol = [78, 66, 52];
  const map = info.headMap;
  const jaw = jawFn(jawPoly);
  const [nx, ny] = hd.nose;
  const noseUp = -ny;
  const data = new Uint8Array(W * H * 4);
  const cols = [];
  for (let x = 0; x < W; x += 1) cols.push(interpMap(map, (x + 0.5) / W));
  for (let y = 0; y < H; y += 1) {
    const v = (y + 0.5) / H;
    const phi = Math.PI / 2 + v * Math.PI * 2; // v = 0 en la coronilla
    const s = Math.sin(phi);
    const cphi = Math.cos(phi);
    const lateral = Math.abs(cphi);
    for (let x = 0; x < W; x += 1) {
      const m = cols[x];
      const yy = m.c + m.h * s; // altura (arriba +) de este píxel en la cabeza
      const n1 = fbm(m.x / 3, v * 8, info.seed + 21);
      const sj = s + (n1 - 0.5) * 0.4;
      let col = lerpRgb(skin, dark, smooth(0.25, 1, sj) * 0.58);
      col = lerpRgb(col, belly, smooth(-0.15, -0.9, sj) * 0.85);
      col = col.map((ch) => ch * (0.9 + n1 * 0.2));
      let h = 0.5;
      let keratin = 0;
      // Pico o ranfoteca
      if (hd.beak || hd.bill) {
        const start = hd.bill ? hd.len * 0.62 : info.headType === 'horned' ? hd.len * 0.8 : hd.len * 0.6;
        keratin = smooth(start - 1.5, start + 1.5, m.x);
        col = lerpRgb(col, beakCol, keratin * (hd.bill ? 0.55 : 0.8));
      }
      // Antifaz (Sinosauropteryx)
      if (hd.mask) {
        const dy = Math.abs(yy - hd.eyeUp);
        const kk = smooth(3.2, 1.8, dy) * smooth(hd.ex - 7, hd.ex - 4, m.x) * smooth(hd.ex + 11, hd.ex + 7, m.x) * (lateral > 0.15 ? 1 : 0);
        col = lerpRgb(col, pat, kk * 0.85);
      }
      // Ojo: cuenca más oscura y ceja en relieve
      const de = Math.hypot((m.x - hd.ex) / 1.15, yy - hd.eyeUp);
      const eyeSide = lateral > 0.2 ? 1 : 0;
      col = lerpRgb(col, dark, smooth(hd.eyeR * 2.6, hd.eyeR * 1.2, de) * 0.5 * eyeSide);
      h += eyeSide * (smooth(hd.eyeR * 2.4, hd.eyeR * 1.5, de) * 0.22 - smooth(hd.eyeR * 1.5, hd.eyeR * 0.9, de) * 0.3);
      // Boca: surco oscuro, labio de escamas encima y debajo
      const jy = jaw(m.x);
      if (jy !== null && lateral > 0.12) {
        const d = yy - -jy;
        const ad = Math.abs(d);
        const line = smooth(0.55, 0.12, ad);
        col = lerpRgb(col, [34, 24, 19], line * 0.92);
        h -= smooth(0.9, 0.1, ad) * 0.42;
        const lip = smooth(2.4, 0.9, ad) * smooth(0.25, 0.9, ad);
        h += lip * 0.16;
        if (hd.kind === 'theropod' && !keratin) {
          // Escamas labiales: surcos cortos y verticales a lo largo del labio.
          const sc = fold(m.x / 1.25 + 0.3);
          h -= lip * (1 - sc) * 0.22;
          col = col.map((ch) => ch * (1 + lip * 0.08 - lip * (1 - sc) * 0.16));
        }
      }
      // Narinas
      const dn = Math.hypot((m.x - nx) / 1.5, (yy - noseUp) / 0.8);
      if (lateral > 0.2) {
        col = lerpRgb(col, [26, 19, 15], smooth(1.1, 0.7, dn) * 0.9);
        h += smooth(2.4, 1.3, dn) * 0.14 - smooth(1.3, 0.6, dn) * 0.4;
      }
      const o = (y * W + x) * 4;
      data[o] = clamp(col[0], 0, 255); data[o + 1] = clamp(col[1], 0, 255); data[o + 2] = clamp(col[2], 0, 255); data[o + 3] = clamp(Math.round(h * 255), 0, 255);
    }
  }
  return { w: W, h: H, data };
}
