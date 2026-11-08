// Geometría procedural para los modelos 3D (sin dependencias).
// Todo se construye con "anillos": secciones transversales que se unen en una
// superficie suave (cuerpo, patas, cuernos, garras) o con "almohadas" (placas,
// golas, velas) y mallas abiertas (membranas). Las normales salen de las
// diferencias entre vecinos, así no hay costuras.

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
const { add, sub, mul, dot, cross, norm, lerp } = v3;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;

/** Malla en arreglos planos. `col` = [r, g, b, ao] (multiplica el color del material). */
export class Mesh {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }

  get count() { return this.pos.length / 3; }

  vert(p, n, uv, c) {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.uv.push(uv[0], uv[1]);
    this.col.push(c[0], c[1], c[2], c[3]);
    return this.count - 1;
  }

  append(m) {
    const o = this.count;
    this.pos.push(...m.pos); this.nor.push(...m.nor); this.uv.push(...m.uv); this.col.push(...m.col);
    for (const i of m.idx) this.idx.push(i + o);
    return this;
  }

  /** Pinta todos los vértices con un color (o una función de la posición). */
  tint(c) {
    for (let i = 0; i < this.count; i += 1) {
      const cc = typeof c === 'function' ? c([this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]], i) : c;
      this.col[i * 4] = cc[0]; this.col[i * 4 + 1] = cc[1]; this.col[i * 4 + 2] = cc[2];
      if (cc.length > 3) this.col[i * 4 + 3] = cc[3];
    }
    return this;
  }

  /** Aplica una función a cada posición (mover, rotar, curvar) y ajusta las normales. */
  map(fn) {
    const e = 0.01;
    for (let i = 0; i < this.count; i += 1) {
      const p0 = [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
      const n0 = [this.nor[i * 3], this.nor[i * 3 + 1], this.nor[i * 3 + 2]];
      const p = fn(p0);
      const q = fn([p0[0] + n0[0] * e, p0[1] + n0[1] * e, p0[2] + n0[2] * e]);
      const n = norm(sub(q, p));
      this.pos[i * 3] = p[0]; this.pos[i * 3 + 1] = p[1]; this.pos[i * 3 + 2] = p[2];
      this.nor[i * 3] = n[0]; this.nor[i * 3 + 1] = n[1]; this.nor[i * 3 + 2] = n[2];
    }
    return this;
  }

  /** Refleja en z (la otra mitad del animal). Invierte las caras para que sigan mirando afuera. */
  mirrorZ() {
    const m = new Mesh();
    m.pos = this.pos.slice(); m.nor = this.nor.slice(); m.uv = this.uv.slice(); m.col = this.col.slice();
    for (let i = 0; i < m.count; i += 1) { m.pos[i * 3 + 2] *= -1; m.nor[i * 3 + 2] *= -1; }
    for (let i = 0; i < this.idx.length; i += 3) m.idx.push(this.idx[i], this.idx[i + 2], this.idx[i + 1]);
    return m;
  }

  bounds() {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.pos.length; i += 3) {
      for (let k = 0; k < 3; k += 1) {
        if (this.pos[i + k] < min[k]) min[k] = this.pos[i + k];
        if (this.pos[i + k] > max[k]) max[k] = this.pos[i + k];
      }
    }
    return { min, max };
  }

  arrays() {
    return {
      pos: new Float32Array(this.pos),
      nor: new Float32Array(this.nor),
      uv: new Float32Array(this.uv),
      col: new Float32Array(this.col),
      idx: this.count > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx),
    };
  }
}

const WHITE = [1, 1, 1, 1];

/**
 * Superficie de anillos. `rings[r].pts` son K puntos de una sección cerrada;
 * `rings[r].u` es la coordenada de textura a lo largo. Si un anillo está
 * colapsado (punta de cola o de cuerno) la normal apunta a lo largo del eje.
 */
export function ringSurface(rings, opts = {}) {
  const m = new Mesh();
  const R = rings.length;
  const K = rings[0].pts.length;
  const color = opts.color || WHITE;
  const centers = rings.map((r) => r.pts.reduce((a, p) => add(a, mul(p, 1 / K)), [0, 0, 0]));
  const size = rings.map((r, i) => r.pts.reduce((a, p) => Math.max(a, v3.len(sub(p, centers[i]))), 0));
  // Orientación: la normal de la rejilla debe apuntar hacia afuera del eje.
  let sign = 0;
  const raw = (r, k) => {
    const P = rings[r].pts;
    const dk = sub(P[(k + 1) % K], P[(k - 1 + K) % K]);
    const dr = sub(rings[Math.min(R - 1, r + 1)].pts[k], rings[Math.max(0, r - 1)].pts[k]);
    return cross(dr, dk);
  };
  for (let r = 1; r < R - 1; r += 1) {
    if (size[r] < 1e-6) continue;
    for (let k = 0; k < K; k += Math.max(1, K >> 2)) sign += dot(raw(r, k), sub(rings[r].pts[k], centers[r]));
  }
  const s = sign >= 0 ? 1 : -1;
  for (let r = 0; r < R; r += 1) {
    const P = rings[r].pts;
    for (let k = 0; k <= K; k += 1) {
      const kk = k % K;
      let n = raw(r, kk);
      if (size[r] < 1e-4 || v3.len(n) < 1e-9) {
        const other = centers[r === 0 ? 1 : R - 2];
        n = sub(centers[r], other);
      } else n = mul(n, s);
      const c = typeof color === 'function' ? color(r, kk, P[kk]) : color;
      m.vert(P[kk], norm(n), [rings[r].u, opts.vFn ? opts.vFn(kk / K) : kk / K], c);
    }
  }
  const W = K + 1;
  for (let r = 0; r < R - 1; r += 1) {
    for (let k = 0; k < K; k += 1) {
      const a = r * W + k;
      const b = a + 1;
      const c = a + W;
      const d = c + 1;
      if (s > 0) { m.idx.push(a, c, b, b, c, d); } else { m.idx.push(a, b, c, b, d, c); }
    }
  }
  return m;
}

/** Puntos de una curva Catmull-Rom (abierta) que pasa por `pts`. */
export function catmull(pts, perSeg = 8) {
  const n = pts.length;
  if (n < 2) return pts.slice();
  const out = [];
  const g = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = g(i - 1); const p1 = g(i); const p2 = g(i + 1); const p3 = g(i + 2);
    for (let s = 0; s < perSeg; s += 1) {
      const t = s / perSeg;
      const t2 = t * t; const t3 = t2 * t;
      out.push(p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[n - 1].slice());
  return out;
}

/** Igual que catmull() pero cerrada. */
export function catmullClosed(pts, perSeg = 8) {
  const n = pts.length;
  const out = [];
  const g = (i) => pts[(i + n) % n];
  for (let i = 0; i < n; i += 1) {
    const p0 = g(i - 1); const p1 = g(i); const p2 = g(i + 1); const p3 = g(i + 2);
    for (let s = 0; s < perSeg; s += 1) {
      const t = s / perSeg;
      const t2 = t * t; const t3 = t2 * t;
      out.push(p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  return out;
}

/** Remuestrea una polilínea con puntos equidistantes (n puntos). */
export function resampleN(pts, n) {
  const L = [0];
  for (let i = 1; i < pts.length; i += 1) L.push(L[i - 1] + v3.len(sub(pts[i], pts[i - 1])));
  const total = L[L.length - 1] || 1;
  const out = [];
  let j = 1;
  for (let i = 0; i < n; i += 1) {
    const d = (i / (n - 1)) * total;
    while (j < L.length - 1 && L[j] < d) j += 1;
    const t = (d - L[j - 1]) / ((L[j] - L[j - 1]) || 1);
    out.push(lerp(pts[j - 1], pts[j], clamp(t, 0, 1)));
  }
  return out;
}

/**
 * Tubo a lo largo de un camino 3D con radio variable (patas, cuernos, garras,
 * dedos). `radii` puede ser un arreglo (uno por punto de control) o una
 * función t → radio. `squash` aplana la sección ([lado, arriba]).
 * Con `cap` los extremos se redondean.
 */
export function tube(path, radii, opts = {}) {
  const sides = opts.sides || 14;
  const dense = opts.dense === false ? path : resampleN(catmull(path, 8), opts.samples || Math.max(8, Math.round(path.length * 6)));
  const N = dense.length;
  const rAt = typeof radii === 'function' ? radii : typeof radii === 'number' || radii.length < 2 ? () => (typeof radii === 'number' ? radii : radii[0]) : (t) => {
    const x = t * (radii.length - 1);
    const i = Math.min(radii.length - 2, Math.floor(x));
    const f = x - i;
    const a = radii[i]; const b = radii[i + 1];
    return a + (b - a) * (f * f * (3 - 2 * f));
  };
  const [sqx, sqy] = opts.squash || [1, 1];
  // Marco por transporte paralelo, empezando con un "arriba" dado.
  const T = dense.map((p, i) => norm(sub(dense[Math.min(N - 1, i + 1)], dense[Math.max(0, i - 1)])));
  let up = opts.up || [0, 1, 0];
  if (Math.abs(dot(up, T[0])) > 0.95) up = [1, 0, 0];
  let Nn = norm(cross(cross(T[0], up), T[0]));
  const frames = [];
  for (let i = 0; i < N; i += 1) {
    if (i > 0) {
      const b = cross(T[i - 1], T[i]);
      const bl = v3.len(b);
      if (bl > 1e-6) {
        const ax = mul(b, 1 / bl);
        const ang = Math.acos(clamp(dot(T[i - 1], T[i]), -1, 1));
        Nn = rotateAxis(Nn, ax, ang);
      }
    }
    const B = norm(cross(T[i], Nn));
    frames.push([Nn, B]);
  }
  const rings = [];
  const ring = (c, i, r) => {
    const [n, b] = frames[i];
    const pts = [];
    for (let k = 0; k < sides; k += 1) {
      const a = (k / sides) * Math.PI * 2;
      pts.push(add(c, add(mul(n, Math.cos(a) * r * sqy), mul(b, Math.sin(a) * r * sqx))));
    }
    return pts;
  };
  const capSteps = opts.cap ? 3 : 0;
  let pathLen = 0;
  for (let i = 1; i < N; i += 1) pathLen += v3.len(sub(dense[i], dense[i - 1]));
  if (opts.cap === true || opts.cap === 'start') {
    const r0 = rAt(0);
    for (let s = capSteps; s >= 1; s -= 1) {
      const a = (s / capSteps) * (Math.PI / 2);
      rings.push({ pts: ring(sub(dense[0], mul(T[0], Math.sin(a) * r0)), 0, Math.cos(a) * r0 + 1e-5), u: 0 });
    }
  }
  for (let i = 0; i < N; i += 1) {
    const t = i / (N - 1);
    rings.push({ pts: ring(dense[i], i, Math.max(1e-5, rAt(t))), u: t });
  }
  if (opts.cap === true || opts.cap === 'end') {
    const r1 = rAt(1);
    for (let s = 1; s <= capSteps; s += 1) {
      const a = (s / capSteps) * (Math.PI / 2);
      rings.push({ pts: ring(add(dense[N - 1], mul(T[N - 1], Math.sin(a) * r1)), N - 1, Math.cos(a) * r1 + 1e-5), u: 1 });
    }
  }
  const m = ringSurface(rings, { color: opts.color });
  if (opts.uvUnit) {
    let rs = 0;
    for (let i = 0; i < N; i += 1) rs += rAt(i / (N - 1));
    const circ = 2 * Math.PI * (rs / N) * ((sqx + sqy) / 2);
    const su = pathLen / opts.uvUnit;
    const sv = Math.max(1, Math.round(circ / opts.uvUnit));
    for (let i = 0; i < m.count; i += 1) { m.uv[i * 2] *= su; m.uv[i * 2 + 1] *= sv; }
  }
  return m;
}

export function rotateAxis(v, axis, ang) {
  const c = Math.cos(ang); const s = Math.sin(ang);
  const d = dot(axis, v);
  const cr = cross(axis, v);
  return [
    v[0] * c + cr[0] * s + axis[0] * d * (1 - c),
    v[1] * c + cr[1] * s + axis[1] * d * (1 - c),
    v[2] * c + cr[2] * s + axis[2] * d * (1 - c),
  ];
}

/** Elipsoide con ejes propios (X, Y, Z son vectores unitarios). */
export function ellipsoid(center, radii, opts = {}) {
  const X = opts.X || [1, 0, 0]; const Y = opts.Y || [0, 1, 0]; const Z = opts.Z || [0, 0, 1];
  const lat = opts.lat || 10; const lon = opts.lon || 16;
  const rings = [];
  for (let i = 0; i <= lat; i += 1) {
    const phi = (i / lat) * Math.PI; // a lo largo de X
    const pts = [];
    for (let k = 0; k < lon; k += 1) {
      const th = (k / lon) * Math.PI * 2;
      const x = -Math.cos(phi) * radii[0];
      const r = Math.sin(phi);
      pts.push(add(center, add(mul(X, x), add(mul(Y, r * Math.cos(th) * radii[1]), mul(Z, r * Math.sin(th) * radii[2])))));
    }
    rings.push({ pts, u: i / lat });
  }
  return ringSurface(rings, { color: opts.color });
}

/**
 * "Almohada": un contorno 2D (cerrado) inflado en forma de lente, con bordes
 * redondeados. Sirve para placas, golas, crestas, velas y aletas.
 * `origin` + `U`/`V` definen el plano; `N` es su normal. `thick` es el grosor
 * en el centro. `bend(p, s)` puede curvar el resultado (s: 0 centro → 1 borde).
 */
export function pillow(outline, opts) {
  const { origin, U, V, N } = opts;
  const thick = opts.thick || 1;
  const steps = opts.steps || 5;
  const c2 = opts.center || outline.reduce((a, p) => [a[0] + p[0] / outline.length, a[1] + p[1] / outline.length], [0, 0]);
  const rings = [];
  const total = steps * 2;
  for (let i = 0; i <= total; i += 1) {
    const a = (i / total) * Math.PI;
    const s = Math.sin(a); // 0 centro, 1 borde
    const z = Math.cos(a) * thick * 0.5;
    const pts = outline.map((p) => {
      const x = c2[0] + (p[0] - c2[0]) * s;
      const y = c2[1] + (p[1] - c2[1]) * s;
      let q = add(origin, add(mul(U, x), add(mul(V, y), mul(N, z * (opts.edgeThin ? Math.max(0.25, 1 - s * s * 0.75) : 1)))));
      if (opts.bend) q = opts.bend(q, s, [x, y]);
      return q;
    });
    rings.push({ pts, u: s });
  }
  return ringSurface(rings, { color: opts.color });
}

/**
 * Superficie abierta (membranas): una rejilla de filas × columnas de puntos.
 * Se dibuja por las dos caras.
 */
export function sheet(grid, opts = {}) {
  const m = new Mesh();
  const R = grid.length;
  const C = grid[0].length;
  const color = opts.color || WHITE;
  for (let r = 0; r < R; r += 1) {
    for (let c = 0; c < C; c += 1) {
      const dr = sub(grid[Math.min(R - 1, r + 1)][c], grid[Math.max(0, r - 1)][c]);
      const dc = sub(grid[r][Math.min(C - 1, c + 1)], grid[r][Math.max(0, c - 1)]);
      const cr = cross(dc, dr);
      let n = v3.len(cr) < 1e-9 ? [0, 1, 0] : norm(cr);
      if (opts.flip) n = mul(n, -1);
      m.vert(grid[r][c], n, [c / (C - 1), r / (R - 1)], typeof color === 'function' ? color(r, c) : color);
    }
  }
  for (let r = 0; r < R - 1; r += 1) {
    for (let c = 0; c < C - 1; c += 1) {
      const a = r * C + c; const b = a + 1; const d = a + C; const e = d + 1;
      if (opts.flip) m.idx.push(a, b, d, b, e, d); else m.idx.push(a, d, b, b, d, e);
    }
  }
  return m;
}

/** Garra o cuerno: tubo curvo que termina en punta. */
export function horn(base, dir, length, radius, opts = {}) {
  const d = norm(dir);
  const bendAxis = opts.bendAxis ? norm(opts.bendAxis) : norm(cross(d, [0, 0, 1]).every((x) => Math.abs(x) < 1e-6) ? [1, 0, 0] : cross(d, [0, 0, 1]));
  const curve = opts.curve || 0; // radianes de curvatura total
  const pts = [];
  let p = base.slice();
  let cur = d;
  const n = 6;
  for (let i = 0; i <= n; i += 1) {
    pts.push(p);
    cur = rotateAxis(cur, bendAxis, curve / n);
    p = add(p, mul(cur, length / n));
  }
  return tube(pts, (t) => radius * Math.pow(1 - t, opts.taper || 0.85) + radius * 0.04, { sides: opts.sides || 10, cap: 'start', color: opts.color, squash: opts.squash, samples: 14 });
}

/** Une varias mallas en una. */
export function merge(meshes) {
  const out = new Mesh();
  for (const m of meshes) if (m) out.append(m);
  return out;
}
