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

/** Relieve de escamas: celdas de Voronoi redondeadas, repetible en los bordes. */
// Las texturas genéricas se calculan una sola vez por página y se comparten
// entre el renderizador de imágenes y los visores.
const memo = new Map();
const once = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key); };

export function scaleBump(size = 256, cells = 9, seed = 3) {
  return once(`bump${size},${cells},${seed}`, () => makeScaleBump(size, cells, seed));
}
function makeScaleBump(size, cells, seed) {
  const data = new Uint8Array(size * size * 4);
  const pts = [];
  for (let j = 0; j < cells; j += 1) {
    for (let i = 0; i < cells; i += 1) {
      const off = (j % 2) * 0.5;
      pts.push([(i + off + (hash(i, j, seed) - 0.5) * 0.9) / cells, (j + 0.5 + (hash(i, j, seed + 1) - 0.5) * 0.85) / cells, 0.6 + hash(i, j, seed + 2) * 0.8]);
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size; const v = y / size;
      let d1 = 9; let d2 = 9; let w1 = 1;
      for (const [px, py, w] of pts) {
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const dx = (u - px - ox) * cells; const dy = (v - py - oy) * cells;
            const d = Math.sqrt(dx * dx + dy * dy) / w;
            if (d < d1) { d2 = d1; d1 = d; w1 = w; } else if (d < d2) d2 = d;
          }
        }
      }
      const edge = smooth(0, 0.22, d2 - d1);
      const dome = Math.sqrt(Math.max(0, 1 - Math.min(1, d1 / 0.75) ** 2));
      const fine = vnoise(u * cells * 3.1, v * cells * 3.1, seed + 9);
      const h = clamp(dome * 0.68 * edge + 0.2 * edge * w1 * 0.6 + (fine - 0.5) * 0.14, 0, 1);
      const o = (y * size + x) * 4;
      const c = Math.round(h * 255);
      data[o] = c; data[o + 1] = c; data[o + 2] = c; data[o + 3] = 255;
    }
  }
  return { w: size, h: size, data };
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

function interpMap(map, u) {
  let i = 1;
  while (i < map.length - 1 && map[i].u < u) i += 1;
  const a = map[i - 1]; const b = map[i];
  const t = clamp((u - a.u) / ((b.u - a.u) || 1), 0, 1);
  const out = {};
  for (const k of Object.keys(b)) out[k] = typeof b[k] === 'number' ? mix(a[k], b[k], t) : b[k];
  return out;
}

/**
 * Piel del cuerpo: u a lo largo (cola → cuello), v alrededor (0 = costado
 * cercano, 0.25 = lomo, 0.75 = vientre). Contrasombreado + patrón.
 */
export function bodyTexture(model, opts = {}) {
  const W = opts.w || 512; const H = opts.h || 256;
  const c = model.colors;
  const info = model.info;
  const skin = cssToRgb(c.piel); const dark = cssToRgb(c.sombra); const belly = cssToRgb(c.vientre); const pat = cssToRgb(c.patron); const light = cssToRgb(c.brillo);
  const seed = info.seed;
  const type = c.patronId;
  const counter = opts.countershade ? 1 : 0.8;
  const period = 7 + info.rx * 0.07;
  const map = info.bodyMap;
  const data = new Uint8Array(W * H * 4);
  const cols = [];
  for (let x = 0; x < W; x += 1) cols.push(interpMap(map, (x + 0.5) / W));
  // Tamaño de un píxel de textura en unidades del animal: los patrones finos
  // nunca bajan de unos pocos píxeles, así no se ven pixelados.
  const texel = Math.max(map[map.length - 1].s / W, Math.max(...cols.map((m) => m.girth || 1)) / H);
  for (let y = 0; y < H; y += 1) {
    const v = (y + 0.5) / H;
    const phi = Math.PI + v * Math.PI * 2;
    const s = Math.sin(phi);
    const side = Math.cos(phi);
    for (let x = 0; x < W; x += 1) {
      const m = cols[x];
      const along = m.s;
      const around = v * Math.max(1, m.girth);
      const isTail = m.x < info.regions.tailBase;
      let col = skin;
      // Contrasombreado: lomo más oscuro, vientre claro.
      col = lerpRgb(col, dark, smooth(0.25, 1, s) * 0.55);
      col = lerpRgb(col, light, smooth(0.65, 0.2, Math.abs(s - 0.35)) * 0.12);
      col = lerpRgb(col, belly, smooth(-0.1, -0.85, s) * counter);
      // Variación natural de tono.
      const n = fbm(along / 9, (around + side * 3) / 9, seed);
      col = col.map((ch) => ch * (0.92 + n * 0.16));
      // Patrón de los genes.
      let p = 0;
      if (type === 'rayas') {
        const wob = (fbm(along / 14, around / 6, seed + 3) - 0.5) * 2.2;
        const f = Math.sin((along / period) * Math.PI * 2 + wob + Math.abs(s - 1) * 0.6);
        p = smooth(0.35, 0.6, f) * smooth(-0.35, 0.35, s);
        p *= smooth(0.85, 0.6, (along / Math.max(1, map[map.length - 1].s)));
      } else if (type === 'manchas') {
        const cell = 5.5;
        const gx = Math.floor(along / cell); const gy = Math.floor(around / cell);
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const cx = (gx + ox + 0.2 + hash(gx + ox, gy + oy, seed) * 0.6) * cell;
            const cyy = (gy + oy + 0.2 + hash(gx + ox, gy + oy, seed + 1) * 0.6) * cell;
            const r = cell * (0.18 + hash(gx + ox, gy + oy, seed + 2) * 0.22);
            const d = Math.hypot((along - cx) / 1.3, around - cyy);
            p = Math.max(p, smooth(r, r * 0.7, d));
          }
        }
        p *= smooth(-0.45, 0.1, s);
      } else if (type === 'bandas') {
        if (isTail) {
          p = smooth(0.2, 0.45, Math.sin((along / (period * 0.9)) * Math.PI * 2));
        } else {
          const f = Math.sin((along / (period * 2.2)) * Math.PI * 2 + 1.3);
          p = smooth(0.45, 0.7, f) * smooth(-0.1, 0.5, s);
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
        p *= smooth(-0.6, 0.1, s);
      }
      col = lerpRgb(col, pat, clamp(p, 0, 1) * 0.78);
      const o = (y * W + x) * 4;
      data[o] = clamp(col[0], 0, 255); data[o + 1] = clamp(col[1], 0, 255); data[o + 2] = clamp(col[2], 0, 255); data[o + 3] = 255;
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
 * Piel de la cabeza: contrasombreado, línea de la boca con labios, narinas,
 * sombra alrededor del ojo, pico de queratina y antifaz.
 */
export function headTexture(model, jawPoly, opts = {}) {
  const W = opts.w || 256; const H = opts.h || 128;
  const c = model.colors;
  const info = model.info;
  const hd = info.head;
  const skin = cssToRgb(c.piel); const dark = cssToRgb(c.sombra); const belly = cssToRgb(c.vientre); const pat = cssToRgb(c.patron);
  const beakCol = [74, 64, 52];
  const map = info.headMap;
  const jaw = jawFn(jawPoly);
  const [nx, ny] = hd.nose;
  const noseUp = -ny;
  const data = new Uint8Array(W * H * 4);
  const cols = [];
  for (let x = 0; x < W; x += 1) cols.push(interpMap(map, (x + 0.5) / W));
  for (let y = 0; y < H; y += 1) {
    const v = (y + 0.5) / H;
    const phi = Math.PI + v * Math.PI * 2;
    const s = Math.sin(phi);
    const cphi = Math.cos(phi);
    for (let x = 0; x < W; x += 1) {
      const m = cols[x];
      const yy = m.c + m.h * s; // altura (arriba +) de este píxel en la cabeza
      let col = lerpRgb(skin, dark, smooth(0.35, 1, s) * 0.5);
      col = lerpRgb(col, belly, smooth(-0.15, -0.9, s) * 0.85);
      col = col.map((ch) => ch * (0.93 + fbm(m.x / 3, v * 8, info.seed + 21) * 0.14));
      // Pico o ranfoteca
      if (hd.beak || hd.bill) {
        const start = hd.bill ? hd.len * 0.62 : info.headType === 'horned' ? hd.len * 0.8 : hd.len * 0.6;
        col = lerpRgb(col, beakCol, smooth(start - 1.5, start + 1.5, m.x) * (hd.bill ? 0.55 : 0.8));
      }
      // Antifaz (Sinosauropteryx)
      if (hd.mask) {
        const dy = Math.abs(yy - hd.eyeUp);
        const k = smooth(3.2, 1.8, dy) * smooth(hd.ex - 7, hd.ex - 4, m.x) * smooth(hd.ex + 11, hd.ex + 7, m.x) * (Math.abs(cphi) > 0.15 ? 1 : 0);
        col = lerpRgb(col, pat, k * 0.85);
      }
      // Sombra alrededor del ojo
      const de = Math.hypot((m.x - hd.ex) / 1.15, yy - hd.eyeUp);
      col = lerpRgb(col, dark, smooth(hd.eyeR * 2.6, hd.eyeR * 1.2, de) * 0.45 * (Math.abs(cphi) > 0.2 ? 1 : 0));
      // Boca: línea oscura y labio un poco más claro encima
      const jy = jaw(m.x);
      if (jy !== null && Math.abs(cphi) > 0.12) {
        const d = yy - -jy;
        const line = smooth(0.55, 0.12, Math.abs(d));
        const lip = smooth(1.8, 0.6, d) * smooth(0.1, 0.6, d);
        col = lerpRgb(col, [36, 26, 20], line * 0.9);
        if (hd.kind === 'theropod') col = col.map((ch) => ch * (1 + lip * 0.1));
      }
      // Narinas
      const dn = Math.hypot((m.x - nx) / 1.5, (yy - noseUp) / 0.8);
      if (Math.abs(cphi) > 0.2) col = lerpRgb(col, [28, 20, 16], smooth(1.1, 0.7, dn) * 0.9);
      const o = (y * W + x) * 4;
      data[o] = clamp(col[0], 0, 255); data[o + 1] = clamp(col[1], 0, 255); data[o + 2] = clamp(col[2], 0, 255); data[o + 3] = 255;
    }
  }
  return { w: W, h: H, data };
}
