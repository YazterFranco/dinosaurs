// Accesorios en 3D. Se modelan en coordenadas de la cabeza (x adelante,
// y arriba, z al lado) y se llevan al modelo con H3; la bufanda va en el cuello.

import { v3, ringSurface, tube, ellipsoid, horn, merge } from './geometry.js';

const { add, mul, norm, cross } = v3;

function torus(center, axis, R, r, opts = {}) {
  const N = norm(axis);
  const A = norm(Math.abs(N[1]) < 0.9 ? cross(N, [0, 1, 0]) : cross(N, [1, 0, 0]));
  const B = norm(cross(N, A));
  const seg = opts.seg || 28;
  const side = opts.side || 10;
  const [sqR, sqN] = opts.squash || [1, 1];
  const rings = [];
  for (let i = 0; i <= seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    const dirR = add(mul(A, Math.cos(a)), mul(B, Math.sin(a)));
    const c = add(center, mul(dirR, R));
    const pts = [];
    for (let k = 0; k < side; k += 1) {
      const b = (k / side) * Math.PI * 2;
      pts.push(add(c, add(mul(dirR, Math.cos(b) * r * sqR), mul(N, Math.sin(b) * r * sqN))));
    }
    rings.push({ pts, u: i / seg });
  }
  return ringSurface(rings, { color: opts.color });
}

const C = {
  ink: '#2b2622', pink: '#e8708f', rose: '#c94b6d', petal: '#fbe3ef', yellow: '#f2c14e', red: '#d9534a',
  blue: '#5ea8c0', lens: '#1f2a33', khaki: '#c9a66b', khaki2: '#d8b97f', band: '#6f5034', gold: '#e9b949', gold2: '#c98a2b', amber: '#f6a93c', lamp: '#fff4c4',
};

/**
 * @param {string} id  id del accesorio
 * @param {object} k   { ex, eyeUp, eyeR, top, headZ(x, y), headS, H3, neck: { nb, ne, w } }
 * @returns {Array<{mesh, color, rough?, metal?, emissive?}>}
 */
export function buildAccessory(id, k) {
  const { ex, eyeUp, eyeR, top, headZ, H3 } = k;
  const L = (mesh) => mesh.map(H3);
  const out = [];
  const add2 = (mesh, color, extra = {}) => out.push({ mesh, color, ...extra });
  const crownX = ex - 3;
  const crownY = top - 0.6;

  if (id === 'mono') {
    const c = [ex - 6, top + 0.6, 0];
    for (const s of [1, -1]) {
      add2(L(ellipsoid(add(c, [0, 0.4, 3.2 * s]), [2.2, 2.6, 3.4], { Z: norm([0, 0.45 * s, 1]), lat: 8, lon: 12 })), C.pink, { rough: 0.5 });
    }
    add2(L(ellipsoid(c, [1.6, 1.6, 1.6], { lat: 6, lon: 10 })), C.rose, { rough: 0.5 });
  } else if (id === 'flor') {
    const z = headZ(ex - 8, top - 1.5) * 0.8;
    const c = [ex - 8, top - 0.5, z];
    const nrm = norm([0, 0.6, 1]);
    const A = norm(cross(nrm, [1, 0, 0]));
    const B = norm(cross(nrm, A));
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      const d = add(mul(A, Math.cos(a)), mul(B, Math.sin(a)));
      add2(L(ellipsoid(add(c, mul(d, 3.4)), [3.4, 0.7, 2.3], { X: d, Y: nrm, Z: norm(cross(d, nrm)), lat: 6, lon: 10 })), C.petal, { rough: 0.6 });
    }
    add2(L(ellipsoid(add(c, mul(nrm, 0.6)), [1.6, 1.6, 1.6], { lat: 6, lon: 10 })), C.yellow, { rough: 0.6 });
  } else if (id === 'bufanda') {
    const { nb, ne, w } = k.neck;
    const p = v3.lerp(nb, ne, 0.78);
    const axis = norm(v3.sub(ne, nb));
    const R = w * 1.05 + 1;
    const stripes = (r, kk) => [1, 1, 1, 1];
    const ring = torus(p, axis, R, 1.9, { seg: 32, side: 10, color: stripes });
    for (let i = 0; i < ring.count; i += 1) {
      const s = Math.floor(ring.uv[i * 2] * 12) % 2 === 0;
      if (!s) { ring.col[i * 4] = 2.2; ring.col[i * 4 + 1] = 2.2; ring.col[i * 4 + 2] = 2.2; }
    }
    add2(ring, C.red, { rough: 0.85 });
    const hang = add(p, [-R * 0.2, -R * 0.4, R * 0.95]);
    const tail = tube([hang, add(hang, [-1.5, -5, 0.4]), add(hang, [-2.5, -10, 0.2])], [1.9, 1.8, 1.7], { sides: 8, cap: true, squash: [0.45, 1] });
    for (let i = 0; i < tail.count; i += 1) if (Math.floor(tail.uv[i * 2] * 5) % 2 === 1) { tail.col[i * 4] = 2.2; tail.col[i * 4 + 1] = 2.2; tail.col[i * 4 + 2] = 2.2; }
    add2(tail, C.red, { rough: 0.85 });
  } else if (id === 'gafas') {
    const r = eyeR * 1.6;
    for (const s of [1, -1]) {
      const z = headZ(ex, eyeUp) * s + 0.9 * s;
      const c = [ex, eyeUp, z];
      add2(L(torus(c, [0, 0, 1], r, 0.45, { seg: 24, side: 8 })), C.ink, { rough: 0.35 });
      add2(L(ellipsoid(add(c, [0, 0, 0.2 * s]), [r, r * 0.85, 0.35], { lat: 6, lon: 16 })), C.lens, { rough: 0.08, metal: 0.2 });
      add2(L(tube([add(c, [-r, 0.2, 0]), add(c, [-r - 7, 0.6, -s * 1.5])], [0.4, 0.35], { sides: 6, cap: true })), C.ink, { rough: 0.35 });
    }
    const zl = headZ(ex + r * 1.1, eyeUp + r * 0.6);
    add2(L(tube([[ex + r * 0.9, eyeUp + r * 0.4, zl + 0.9], [ex + r * 1.2, eyeUp + r * 1.3, 0], [ex + r * 0.9, eyeUp + r * 0.4, -zl - 0.9]], [0.45, 0.45, 0.45], { sides: 6 })), C.ink, { rough: 0.35 });
  } else if (id === 'gorro_fiesta') {
    const b = [crownX, crownY, 0];
    const dir = norm([-0.22, 1, 0]);
    const cone = horn(b, dir, 16, 5.6, { sides: 18, taper: 1 });
    for (let i = 0; i < cone.count; i += 1) {
      const t = cone.uv[i * 2];
      if (Math.floor(t * 6) % 2 === 1) { cone.col[i * 4] = 2.6; cone.col[i * 4 + 1] = 1.9; cone.col[i * 4 + 2] = 0.55; }
    }
    add2(L(cone), C.blue, { rough: 0.6 });
    add2(L(ellipsoid(add(b, mul(dir, 16.4)), [2.2, 2.2, 2.2], { lat: 6, lon: 10 })), C.pink, { rough: 0.9 });
  } else if (id === 'sombrero') {
    const b = [crownX, crownY, 0];
    add2(L(ellipsoid(add(b, [0, 0.4, 0]), [12, 0.8, 11], { lat: 6, lon: 22 })), C.khaki, { rough: 0.9 });
    add2(L(tube([add(b, [0, 0.4, 0]), add(b, [0, 4, 0]), add(b, [0, 7.5, 0])], [6.6, 6.2, 5.2], { sides: 20, cap: 'end' })), C.khaki2, { rough: 0.9 });
    add2(L(torus(add(b, [0, 2, 0]), [0, 1, 0], 6.5, 0.9, { squash: [0.5, 1.4], seg: 28, side: 8 })), C.band, { rough: 0.8 });
  } else if (id === 'casco_minero') {
    const b = [crownX, crownY - 0.6, 0];
    add2(L(ellipsoid(add(b, [0, 1.5, 0]), [9, 7.5, 8.2], { Y: [0, 1, 0], X: [0, 0, 1], Z: [1, 0, 0], lat: 10, lon: 20 })), C.yellow, { rough: 0.35 });
    add2(L(torus(add(b, [0, 1.2, 0]), [0, 1, 0], 9.2, 0.9, { seg: 30, side: 8, squash: [1.4, 0.6] })), C.gold2, { rough: 0.4 });
    const lampB = add(b, [7.2, 5.2, 0]);
    add2(L(tube([lampB, add(lampB, [2.5, 0.3, 0])], [2.4, 2.4], { sides: 14, cap: true })), C.ink, { rough: 0.5 });
    add2(L(ellipsoid(add(lampB, [2.6, 0.3, 0]), [0.5, 2, 2], { lat: 6, lon: 12 })), C.lamp, { rough: 0.1, emissive: 1.4 });
  } else if (id === 'corona' || id === 'corona_ambar') {
    const amber = id === 'corona_ambar';
    const b = [crownX, crownY, 0];
    const gold = amber ? C.gold2 : C.gold;
    const R = 6.2;
    const band = [];
    for (let i = 0; i <= 3; i += 1) band.push(add(b, [0, i * 1.1, 0]));
    const ringM = torus(add(b, [0, 1.6, 0]), [0, 1, 0], R, 0.9, { seg: 32, side: 8, squash: [0.6, 2.2] });
    add2(L(ringM), gold, { rough: 0.25, metal: 1 });
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const p = add(b, [Math.cos(a) * R, 3, Math.sin(a) * R]);
      add2(L(horn(p, [Math.cos(a) * 0.15, 1, Math.sin(a) * 0.15], (amber ? 6.5 : 5.5) + (i === 0 ? 1.5 : 0), 1.5, { sides: 8 })), gold, { rough: 0.25, metal: 1 });
      add2(L(ellipsoid(add(p, [Math.cos(a) * 0.4, 1.2 + (amber ? 5.6 : 4.8), Math.sin(a) * 0.4]), [0.9, 0.9, 0.9], { lat: 5, lon: 8 })), gold, { rough: 0.2, metal: 1 });
    }
    if (amber) {
      add2(L(ellipsoid(add(b, [R * 0.98, 2.4, 0]), [1.2, 2.6, 2.1], { lat: 8, lon: 12 })), C.amber, { rough: 0.05, emissive: 0.35 });
    } else {
      add2(L(ellipsoid(add(b, [R * 0.98, 2, 0]), [0.8, 1.3, 1.3], { lat: 6, lon: 10 })), C.red, { rough: 0.05 });
      for (const s of [1, -1]) add2(L(ellipsoid(add(b, [R * 0.7, 2, R * 0.7 * s]), [0.7, 1, 1], { lat: 6, lon: 10 })), C.blue, { rough: 0.05 });
    }
  }
  return out;
}

export { merge };
