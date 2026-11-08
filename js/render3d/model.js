// Modelos 3D procedurales de dinosaurios.
//
// Parten de las mismas proporciones que el dibujo 2D (species.look) y las
// llevan a 3D: cola, cuerpo y cuello forman una sola superficie cuyas
// secciones son la unión suave de los volúmenes del tronco y del cuello; la
// cabeza sale de su perfil lateral con un ancho que cambia de la nuca al
// hocico; las patas tienen muslo, espinilla, metatarso, dedos y garras.
// Coordenadas: x hacia la cabeza, y hacia arriba (suelo en y = 0), z hacia el
// lado cercano a la cámara.

import { phenotype } from '../systems/genetics.js';
import { HEADS } from '../render/dino-svg.js';
import {
  Mesh, v3, clamp, smoothstep, mix, ringSurface, catmull, catmullClosed, tube, ellipsoid, pillow, sheet, horn, merge, rotateAxis,
} from './geometry.js';
import { buildAccessory } from './accessories3d.js';

const rad = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const { add, sub, mul, norm, cross } = v3;

// ------------------------------------------------------------ utilidades 2D

function offsets2(spine, top, bot) {
  const dorsal = [];
  const ventral = [];
  for (let i = 0; i < spine.length; i += 1) {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(spine.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    dorsal.push([spine[i][0] + ty * top[i], spine[i][1] - tx * top[i]]);
    ventral.push([spine[i][0] - ty * bot[i], spine[i][1] + tx * bot[i]]);
  }
  return { dorsal, ventral };
}

/** Convierte un trazado SVG absoluto (M, L, C, Q, Z) en un polígono. */
export function parsePath(d, per = 10) {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  const pts = [];
  let i = 0;
  let cur = [0, 0];
  let cmd = 'M';
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLCQZ]/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === 'Z') continue;
    if (cmd === 'M' || cmd === 'L') { cur = [num(), num()]; pts.push(cur); } else if (cmd === 'C') {
      const c1 = [num(), num()]; const c2 = [num(), num()]; const p = [num(), num()];
      for (let s = 1; s <= per; s += 1) {
        const t = s / per; const u = 1 - t;
        pts.push([0, 1].map((k) => u * u * u * cur[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * p[k]));
      }
      cur = p;
    } else if (cmd === 'Q') {
      const c1 = [num(), num()]; const p = [num(), num()];
      for (let s = 1; s <= per; s += 1) {
        const t = s / per; const u = 1 - t;
        pts.push([0, 1].map((k) => u * u * cur[k] + 2 * u * t * c1[k] + t * t * p[k]));
      }
      cur = p;
    } else i += 1;
  }
  return pts;
}

/** Corte vertical de un polígono en x: [y mínima, y máxima] o null. */
export function scanPoly(poly, x) {
  let lo = Infinity;
  let hi = -Infinity;
  const n = poly.length;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    if ((a[0] <= x && b[0] >= x) || (b[0] <= x && a[0] >= x)) {
      const dx = b[0] - a[0];
      if (Math.abs(dx) < 1e-9) {
        lo = Math.min(lo, a[1], b[1]); hi = Math.max(hi, a[1], b[1]);
      } else {
        const y = a[1] + ((b[1] - a[1]) * (x - a[0])) / dx;
        lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

const xRange = (poly) => poly.reduce((r, p) => [Math.min(r[0], p[0]), Math.max(r[1], p[0])], [Infinity, -Infinity]);

function smax(a, b, k) {
  if (k <= 1e-6) return Math.max(a, b);
  const h = clamp(0.5 + (0.5 * (a - b)) / k, 0, 1);
  return mix(b, a, h) + k * h * (1 - h);
}

/** Perfil de un óvalo "superelíptico": 1 en el centro, 0 en los extremos. */
function shapeF(u, p) {
  const a = Math.abs(u);
  return a >= 1 ? 0 : Math.pow(1 - Math.pow(a, p), 1 / p);
}

// Ancho de la cabeza (proporción del alto) de la nuca (t = 0) al hocico (t = 1).
const HEAD_WIDTH = {
  boxy: [[0, 0.86], [0.3, 0.82], [0.62, 0.56], [1, 0.42]],
  short: [[0, 0.9], [0.5, 0.78], [1, 0.56]],
  slim: [[0, 0.95], [0.4, 0.74], [1, 0.42]],
  croc: [[0, 0.95], [0.3, 0.6], [0.82, 0.36], [0.94, 0.5], [1, 0.36]],
  small: [[0, 0.98], [0.6, 0.85], [1, 0.66]],
  duck: [[0, 0.92], [0.45, 0.68], [0.8, 0.86], [1, 0.78]],
  beak: [[0, 0.92], [0.5, 0.7], [1, 0.32]],
  parrot: [[0, 1.02], [0.55, 0.84], [1, 0.42]],
  horned: [[0, 1.12], [0.4, 0.96], [0.8, 0.56], [1, 0.34]],
  armored: [[0, 1.35], [0.5, 1.2], [1, 0.9]],
  dome: [[0, 1.0], [0.5, 0.86], [1, 0.55]],
  ptero: [[0, 0.88], [0.2, 0.56], [1, 0.16]],
};
function keyed(table, t) {
  for (let i = 1; i < table.length; i += 1) {
    if (t <= table[i][0]) {
      const [t0, v0] = table[i - 1];
      const [t1, v1] = table[i];
      const f = (t - t0) / (t1 - t0 || 1);
      return v0 + (v1 - v0) * (f * f * (3 - 2 * f));
    }
  }
  return table[table.length - 1][1];
}

// ------------------------------------------------------------ modelo

/**
 * Construye el modelo 3D.
 * @returns {{ parts: Array, colors: object, info: object, anim: object }}
 *   parts[i] = { mesh, mat, color?, double?, shells?, lid? }
 */
export function buildModel(species, genes, opts = {}) {
  const look = species.look;
  const feat = look.feat || {};
  const stage = opts.stage || 'adulto';
  const col = phenotype(genes);
  const parts = [];
  const push = (mesh, mat, extra = {}) => { if (mesh && mesh.count) parts.push({ mesh, mat, ...extra }); };

  const baby = stage === 'cria' ? 1 : stage === 'juvenil' ? 0.5 : 0;
  const headS = (look.head.s || 1) * 0.97 * (1 + 0.4 * baby);
  const [rx0, ry0] = look.body;
  const rx = rx0 * (1 - 0.12 * baby);
  const ry = ry0 * (1 - 0.04 * baby);
  const neckLen = look.neck[0] * (1 - 0.3 * baby);
  const neckAng = look.neck[1];
  const neckW = look.neck[2];
  const tailLen = look.tail[0] * (1 - 0.28 * baby);
  const tailW = look.tail[1];
  const legLen = look.leg[0] * (1 - 0.1 * baby);
  const legW = look.leg[1] * (1 + 0.1 * baby);
  const armLen = (look.arm ? look.arm[0] : 0) * (1 - 0.1 * baby);
  const plan = look.plan;
  const quad = plan === 'quad' || plan === 'semi';
  const fullFeathers = feat.feathers === 'full' || !!feat.wings;
  const feathered = fullFeathers || feat.feathers === 'partial';
  const sauropod = look.head.type === 'small' && neckLen > 20;
  const sleeping = !!opts.sleeping;

  // ---------- postura (igual que el dibujo 2D) ----------
  let cy;
  let tilt = 0;
  if (plan === 'biped') {
    cy = -(legLen * 0.98 + ry * 0.3);
    tilt = feat.lowStance ? 2 : 5 + (neckAng > 45 ? 5 : 0);
    if (feat.potBelly) tilt = 20;
  } else if (quad) {
    const front = plan === 'semi' ? Math.max(armLen, legLen * 0.62) : legLen * (feat.frontHigh ? 1.35 : feat.hindHigh ? 0.72 : 1);
    const hind = legLen * (feat.hindHigh ? 1.15 : 1);
    cy = -((front + hind) / 2 + ry * 0.38);
    tilt = (Math.atan2(front - hind, rx * 1.1) * 180) / Math.PI;
  } else if (plan === 'flyer') {
    cy = -(armLen * 0.25 + 30);
    tilt = 4;
  } else {
    cy = -48;
  }
  const cosT = Math.cos(rad(-tilt));
  const sinT = Math.sin(rad(-tilt));
  const R = (px, py) => [px * cosT - py * sinT, cy + px * sinT + py * cosT];
  const P3 = (p, z = 0) => [p[0], -p[1], z];

  // ---------- tronco y cola (perfil lateral) ----------
  const spineL = [];
  const top = [];
  const bot = [];
  const tailN = 8;
  const bellyF = feat.potBelly ? 1.22 : 1;
  for (let i = 0; i <= tailN; i += 1) {
    const t = i / tailN;
    const x = -rx * 0.8 - tailLen * (1 - t);
    let y;
    if (plan === 'biped') y = ry * 0.02 - (1 - t) ** 2 * ry * 0.12;
    else if (plan === 'swim') y = Math.sin((1 - t) * Math.PI * 1.2) * 3;
    else if (plan === 'flyer') y = 1;
    else y = ry * 0.12 + (1 - t) ** 1.4 * tailLen * 0.2;
    const h = lerp(0.7, Math.max(tailW * 0.62, 2), t ** 1.25) + (t > 0.85 ? ((t - 0.85) / 0.15) * ry * 0.22 : 0);
    spineL.push([x, y]);
    top.push(h * (feat.paddleTail ? 1.35 : 1));
    bot.push(h * 1.05 * (feat.paddleTail ? 1.3 : 1));
  }
  const bodyX = [-rx * 0.55, -rx * 0.18, rx * 0.22, rx * 0.56, rx * 0.86];
  const bodyTop = [ry * 0.88, ry * 0.98, ry * 0.97, ry * 0.86, ry * 0.6];
  const bodyBot = [ry * 0.8, ry * 1.02 * bellyF, ry * 1.0 * bellyF, ry * 0.86, ry * 0.56];
  bodyX.forEach((x, i) => { spineL.push([x, 0]); top.push(bodyTop[i]); bot.push(bodyBot[i]); });
  const spine = spineL.map(([x, y]) => R(x, y));
  const { dorsal, ventral } = offsets2(spine, top, bot);
  const chestTip = R(rx * 1.0, ry * 0.08);
  const tailTip = spine[0];
  const torsoPoly = catmullClosed([tailTip, ...dorsal.slice(1), chestTip, ...ventral.slice(1).reverse()], 6);

  // ---------- cuello ----------
  let neckA = neckAng;
  if (sleeping) neckA = Math.min(neckAng, 6) - 14; // durmiendo: cuello bajo
  const ang = rad(neckA);
  const nb = R(rx * 0.5, -ry * 0.18);
  const dir = [Math.cos(ang), -Math.sin(ang)];
  const perp = [dir[1], -dir[0]];
  const nl = Math.max(neckLen, 4) + rx * 0.35;
  const ne = [nb[0] + dir[0] * nl, nb[1] + dir[1] * nl];
  const neckPts = [];
  const nTop = [];
  const nBot = [];
  const endHalf = Math.min(neckW * 0.5, 6.2 * headS);
  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    const bow = Math.sin(t * Math.PI) * (neckLen > 30 ? -neckLen * 0.07 : 0);
    neckPts.push([nb[0] + dir[0] * nl * t + perp[0] * bow, nb[1] + dir[1] * nl * t + perp[1] * bow]);
    const w = lerp(Math.max(neckW * 0.9, ry * 0.72), endHalf, t ** 0.8);
    nTop.push(w * 0.92);
    nBot.push(w * (plan === 'biped' ? 1.12 : 1.02));
  }
  const nOff = offsets2(neckPts, nTop, nBot);
  const neckPoly = catmullClosed([...nOff.dorsal, ne, ...nOff.ventral.slice().reverse()], 6);

  // ---------- ancho del cuerpo ----------
  const bodyAspect = feat.armor || feat.wide ? 1.32 : sauropod ? 0.95 : look.head.type === 'horned' ? 0.98 : plan === 'quad' ? 0.88
    : plan === 'semi' ? 0.8 : plan === 'swim' ? 0.78 : plan === 'flyer' ? 0.92 : feat.potBelly ? 0.95 : 0.68;
  const tailAspect = feat.paddleTail ? 0.36 : feat.armor ? 0.95 : plan === 'swim' ? 0.6 : 0.8;
  const neckAspect = sauropod ? 0.9 : 0.86;
  const xTailBase = R(-rx * 0.8, 0)[0];
  const torsoAspect = (x) => lerp(tailAspect, bodyAspect, smoothstep(xTailBase - tailLen * 0.3, xTailBase + rx * 0.3, x));
  const cosNeck = Math.max(0.3, Math.cos(Math.abs(ang)));
  const tR = xRange(torsoPoly);
  const nR = xRange(neckPoly);

  const sectionParts = (x) => {
    const ps = [];
    const t = scanPoly(torsoPoly, x);
    if (t) {
      const tp = -t[0]; const bt = -t[1];
      const h = (tp - bt) / 2;
      if (h > 1e-4) ps.push({ c: (tp + bt) / 2, h, W: h * torsoAspect(x), kind: 'torso' });
    }
    const n = scanPoly(neckPoly, x);
    if (n) {
      const tp = -n[0]; const bt = -n[1];
      const h = (tp - bt) / 2;
      if (h > 1e-4) ps.push({ c: (tp + bt) / 2, h, W: h * cosNeck * neckAspect, kind: 'neck' });
    }
    return ps;
  };
  const widthAt = (ps, y) => {
    let w = 0;
    for (const p of ps) {
      const u = (y - p.c) / p.h;
      const wi = p.W * shapeF(u, u < 0 ? 2.5 : 2.05);
      w = w === 0 ? wi : smax(w, wi, 0.35 * Math.min(p.W, w) + 0.01);
    }
    return w;
  };
  const sectionAt = (x) => {
    const ps = sectionParts(x);
    if (!ps.length) return null;
    const U = Math.max(...ps.map((p) => p.c + p.h));
    const B = Math.min(...ps.map((p) => p.c - p.h));
    return { ps, U, B, c: (U + B) / 2, h: (U - B) / 2 };
  };
  /** Punto y normal aproximada de la piel del tronco en (x, ángulo). */
  const surfaceAt = (x, phi, side = 1) => {
    const s = sectionAt(x);
    if (!s) return null;
    const y = s.c + s.h * Math.sin(phi);
    const z = widthAt(s.ps, y) * side * Math.sign(Math.cos(phi) || 1);
    const s2 = sectionAt(x + 0.5) || s;
    const y2 = s2.c + s2.h * Math.sin(phi);
    const z2 = widthAt(s2.ps, y2) * side * Math.sign(Math.cos(phi) || 1);
    const yA = s.c + s.h * Math.sin(phi + 0.05);
    const zA = widthAt(s.ps, yA) * side * Math.sign(Math.cos(phi + 0.05) || 1);
    const p = [x, y, z];
    const dx = [0.5, y2 - y, z2 - z];
    const da = [0, yA - y, zA - z];
    let n = norm(cross(dx, da));
    const c = [x, s.c, 0];
    if (v3.dot(n, sub(p, c)) < 0) n = mul(n, -1);
    return { p, n };
  };
  const halfWidthAt = (x, y) => { const s = sectionAt(x); return s ? widthAt(s.ps, y) : 0; };

  // ---------- superficie del tronco + cuello ----------
  const x0 = Math.min(tR[0], nR[0]);
  const x1 = Math.max(tR[1], nR[1]);
  const dense = [];
  const M = 420;
  for (let i = 1; i < M; i += 1) {
    const x = x0 + ((x1 - x0) * i) / M;
    const s = sectionAt(x);
    if (s) dense.push({ x, c: s.c });
  }
  const arc = [0];
  for (let i = 1; i < dense.length; i += 1) arc.push(arc[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].c - dense[i - 1].c));
  const total = arc[arc.length - 1];
  const NR = 128;
  const K = 40;
  const ringXs = [];
  let j = 1;
  for (let i = 0; i < NR; i += 1) {
    const d = (i / (NR - 1)) * total;
    while (j < arc.length - 1 && arc[j] < d) j += 1;
    const f = (d - arc[j - 1]) / ((arc[j] - arc[j - 1]) || 1);
    ringXs.push(lerp(dense[j - 1].x, dense[j].x, clamp(f, 0, 1)));
  }
  const rings = [];
  const bodyMap = [];
  const tailTip3 = P3(tailTip);
  const nTipIdx = neckPoly.reduce((bi, p, i, a) => (p[0] > a[bi][0] ? i : bi), 0);
  const neckTip3 = P3(neckPoly[nTipIdx]);
  rings.push({ pts: Array.from({ length: K }, () => tailTip3.slice()), u: 0 });
  bodyMap.push({ u: 0, x: tailTip3[0], c: tailTip3[1], h: 0, girth: 0, s: 0 });
  ringXs.forEach((x, i) => {
    const s = sectionAt(x);
    const pts = [];
    let girth = 0;
    let prev = null;
    for (let k = 0; k < K; k += 1) {
      const phi = Math.PI + (k / K) * Math.PI * 2; // la costura queda del lado lejano
      const y = s.c + s.h * Math.sin(phi);
      const w = widthAt(s.ps, y);
      const p = [x, y, Math.cos(phi) >= 0 ? w : -w];
      if (prev) girth += v3.len(sub(p, prev));
      prev = p;
      pts.push(p);
    }
    const u = (i + 1) / (NR + 1);
    rings.push({ pts, u });
    bodyMap.push({ u, x, c: s.c, h: s.h, girth, s: (i / (NR - 1)) * total });
  });
  rings.push({ pts: Array.from({ length: K }, () => neckTip3.slice()), u: 1 });
  bodyMap.push({ u: 1, x: neckTip3[0], c: neckTip3[1], h: 0, girth: 0, s: total });
  push(ringSurface(rings), 'body', { shells: fullFeathers || plan === 'flyer' ? { len: plan === 'flyer' ? 1.4 : 2.6 + rx * 0.02, count: 10 } : feathered ? { len: 1.8, count: 8 } : null });

  // ---------- cabeza ----------
  const head = HEADS[look.head.type] || HEADS.slim;
  const headAngle = plan === 'flyer' ? -4 : sleeping ? -14 : Math.min(neckA * 0.35, 18) - 7;
  const ha = rad(-headAngle);
  const HP = (x, y) => [ne[0] + (x * Math.cos(ha) - y * Math.sin(ha)) * headS, ne[1] + (x * Math.sin(ha) + y * Math.cos(ha)) * headS];
  /** Punto en coordenadas de la cabeza (x adelante, y arriba, z lado) → modelo. */
  const H3 = (p) => { const q = HP(p[0], -p[1]); return [q[0], -q[1], p[2] * headS]; };
  const headPoly = parsePath(head.d, 12);
  const hR = xRange(headPoly);
  const widthTable = HEAD_WIDTH[look.head.type] || HEAD_WIDTH.slim;
  // Cráneo más ancho atrás que en el hocico (T. rex: ojos al frente, visión binocular).
  const backW = (look.head.back || 1) - 1;
  const headSection = (x) => {
    const iv = scanPoly(headPoly, x);
    if (!iv) return null;
    const tp = -iv[0]; const bt = -iv[1];
    const h = (tp - bt) / 2;
    const t = (x - hR[0]) / (hR[1] - hR[0]);
    return { c: (tp + bt) / 2, h, W: h * keyed(widthTable, t) * (1 + backW * Math.max(0, 1 - t) ** 1.5), t };
  };
  const headZ = (x, yUp) => {
    const s = headSection(x);
    if (!s) return 0;
    return s.W * shapeF((yUp - s.c) / s.h, 2.2);
  };
  const HK = 32;
  const boxyHead = ['boxy', 'short', 'croc', 'armored'].includes(look.head.type);
  const HN = 34;
  const hrings = [];
  const headMap = [];
  for (let i = 0; i <= HN; i += 1) {
    const t = (1 - Math.cos((i / HN) * Math.PI)) / 2;
    const x = hR[0] + (hR[1] - hR[0]) * clamp(t, 0.002, 0.998);
    const s = headSection(x);
    if (!s) continue;
    const pts = [];
    for (let k = 0; k < HK; k += 1) {
      const phi = Math.PI + (k / HK) * Math.PI * 2;
      const sp = Math.sin(phi); const cp = Math.cos(phi);
      const ex2 = boxyHead ? 0.72 : 0.86;
      const yy = s.c + s.h * Math.sign(sp) * Math.pow(Math.abs(sp), ex2);
      const zz = s.W * Math.sign(cp) * Math.pow(Math.abs(cp), ex2);
      pts.push(H3([x, yy, zz]));
    }
    hrings.push({ pts, u: t });
    headMap.push({ u: t, x, c: s.c, h: s.h, W: s.W });
  }
  // Puntas redondeadas
  const first = hrings[0]; const last = hrings[hrings.length - 1];
  const cen = (r) => r.pts.reduce((a, p) => add(a, mul(p, 1 / r.pts.length)), [0, 0, 0]);
  hrings.unshift({ pts: first.pts.map(() => cen(first)), u: 0 });
  hrings.push({ pts: last.pts.map(() => cen(last)), u: 1 });
  push(ringSurface(hrings), 'head');

  // ---------- ojos ----------
  const [ex, ey] = head.eye;
  const eyeUp = -ey;
  const eyeR = (feat.armor ? 1.5 : 1.75) * (1 + 0.55 * baby);
  const eyeSurfZ = headZ(ex, eyeUp);
  const eyeZ = Math.max(eyeR * 0.6, eyeSurfZ - eyeR * 0.38);
  const eyes = [];
  for (const side of [1, -1]) {
    const c = H3([ex, eyeUp, eyeZ * side]);
    const out = norm(sub(H3([ex, eyeUp, (eyeZ + 1) * side]), c));
    const fwd = norm(sub(H3([ex + 1, eyeUp, eyeZ * side]), c));
    let up = norm(cross(out, fwd));
    if (up[1] < 0) up = mul(up, -1);
    eyes.push({ c, r: eyeR * headS, out, fwd, up, side });
    // Globo ocular con el iris mirando hacia afuera (mapeo plano en el eje "out").
    const ball = ellipsoid(c, [eyeR * headS, eyeR * headS, eyeR * headS], { X: out, Y: up, Z: norm(cross(out, up)), lat: 10, lon: 14 });
    for (let i = 0; i < ball.count; i += 1) {
      const p = [ball.pos[i * 3], ball.pos[i * 3 + 1], ball.pos[i * 3 + 2]];
      const d = sub(p, c);
      const r = eyeR * headS;
      const fu = v3.dot(d, side > 0 ? fwd : mul(fwd, -1)) / r;
      const fv = v3.dot(d, up) / r;
      ball.uv[i * 2] = 0.5 + fu * 0.5 * side;
      ball.uv[i * 2 + 1] = 0.5 + fv * 0.5;
      if (v3.dot(d, out) < 0) { ball.uv[i * 2] = 0.02; ball.uv[i * 2 + 1] = 0.02; }
    }
    push(ball, 'eye');
  }
  // Párpados (casquetes esféricos que el sombreador abre y cierra).
  const mood = opts.mood || '';
  let upperLid = 0.22;
  let lowerLid = 0.08;
  if (mood === 'radiante') { upperLid = 0.5; lowerLid = 0.32; } else if (mood === 'cansado') upperLid = 0.62;
  else if (mood === 'triste') upperLid = 0.46;
  if (sleeping) { upperLid = 1; lowerLid = 0.2; }
  for (const e of eyes) {
    for (const lower of [false, true]) {
      const lm = new Mesh();
      const rows = 6; const cols = 14;
      for (let r = 0; r <= rows; r += 1) {
        for (let k = 0; k <= cols; k += 1) {
          lm.vert([0, 0, 0], [0, 1, 0], [r / rows, k / cols], [1, 1, 1, 1]);
        }
      }
      for (let r = 0; r < rows; r += 1) {
        for (let k = 0; k < cols; k += 1) {
          const a = r * (cols + 1) + k; const b = a + 1; const c = a + cols + 1; const d = c + 1;
          lm.idx.push(a, c, b, b, c, d);
        }
      }
      push(lm, 'lid', { lid: { c: e.c, r: e.r * 1.1, X: e.fwd, Y: e.up, Z: e.out, lower, amount: lower ? lowerLid : upperLid, tilt: mood === 'triste' ? -0.35 * e.side : 0 } });
    }
  }

  // ---------- detalles de la cabeza ----------
  const keratin = (mesh) => mesh.tint((p, i) => {
    const t = mesh.uv[i * 2];
    const k = 0.62 + 0.38 * t;
    return [k, k * 0.97, k * 0.9, 1];
  });
  if (head.brow) {
    for (const side of [1, -1]) {
      const c = H3([ex + 0.6, eyeUp + eyeR * 1.05, (eyeSurfZ * 0.86) * side]);
      push(ellipsoid(c, [eyeR * 1.7 * headS, eyeR * 0.55 * headS, eyeR * 0.75 * headS], { X: norm(sub(H3([ex + 2, eyeUp + eyeR * 1.05, eyeSurfZ * 0.86 * side]), c)), lat: 6, lon: 10 }), 'skin');
    }
  }
  if (feat.frill) {
    // Gola: escudo que nace en un arco alrededor de la nuca (de una mejilla,
    // por encima del cráneo, a la otra) y se abre hacia atrás y hacia afuera.
    // Sus partes laterales miran de lado: de perfil se ve el gran abanico.
    const w = feat.frill.w * (1 - 0.3 * baby);
    const A = 1.95;
    const hs = headSection(-1) || { c: 0, h: 7, W: 7 };
    const cB = [-2, hs.c + hs.h * 0.15, 0];
    const r0 = Math.max(hs.h, hs.W) * 0.85;
    const Bd = norm([-1, 0.38, 0]);
    const radial = (a) => rotateAxis([0, 1, 0], Bd, a);
    const baseAt = (a) => add(cB, mul(radial(a), r0));
    // Inclinada hacia atrás (~40°) como un escudo sobre el cuello, no como una vela.
    const Lmax = 23 * w;
    const len = (a) => Lmax * (1 - 0.42 * (a / A) ** 2);
    const outAt = (a) => add(baseAt(a), mul(norm(add(mul(Bd, 1.05), mul(radial(a), 0.8))), len(a)));
    const R = 8; const C = 30;
    const grid = [];
    for (let r = 0; r <= R; r += 1) {
      const row = [];
      for (let c = 0; c <= C; c += 1) {
        const a = -A + (c / C) * 2 * A;
        const t = r / R;
        // Ligera concavidad hacia adelante
        row.push(add(v3.lerp(baseAt(a), outAt(a), t), mul([1, 0, 0], Math.sin(t * Math.PI) * 1.2 * w)));
      }
      grid.push(row);
    }
    const fr = sheet(grid, { color: (r) => { const k = 0.78 + 0.22 * (r / R); return [k, k, k, 1]; } });
    push(fr.map(H3), 'plate', { double: true });
    const rimPts = [];
    for (let c = 0; c <= C; c += 1) rimPts.push(grid[R][c]);
    push(tube(rimPts.map(H3), [1.0 * headS * w], { sides: 8, cap: true, samples: 70 }), 'plate');
    for (let i = 1; i < 16; i += 1) {
      const a = -A + (i / 16) * 2 * A;
      const q = outAt(a);
      const out = norm(sub(q, baseAt(a)));
      push(horn(H3(q), sub(H3(add(q, out)), H3(q)), 2.3 * w * headS, 1.5 * w * headS, { sides: 7, taper: 0.7 }), 'plate');
    }
    const spikes = feat.frill.spikes || 0;
    for (let i = 0; i < spikes; i += 1) {
      const t = i / Math.max(1, spikes - 1);
      const a = (-1 + t * 2) * A * 0.4;
      const q = outAt(a);
      const out = norm(add(sub(q, baseAt(a)), [0, 3, 0]));
      const L = (Math.abs(t - 0.5) < 0.3 ? 26 : 18) * (1 - 0.5 * baby);
      push(keratin(horn(H3(q), sub(H3(add(q, out)), H3(q)), L * headS, 2.3 * headS, { curve: -0.2, bendAxis: [0, 0, 1], sides: 9 })), 'keratin');
    }
  }
  if (feat.horns) {
    const { brow, nose } = feat.horns;
    if (brow) {
      const L = brow * (1 - 0.6 * baby);
      for (const side of [1, -1]) {
        const b = [ex - 0.5, eyeUp + eyeR * 1.2, eyeSurfZ * 0.6 * side];
        push(keratin(horn(H3(b), sub(H3(add(b, [0.75, 0.72, 0.12 * side])), H3(b)), L * headS, Math.max(1.6, L * 0.13) * headS, { curve: 0.35, bendAxis: [0, 0, side], sides: 10 })), 'keratin');
      }
    }
    if (nose) {
      const L = nose * (1 - 0.5 * baby);
      const b = [21, 5.5, 0];
      push(keratin(horn(H3(b), sub(H3(add(b, [0.32, 1, 0])), H3(b)), L * headS, Math.max(1.8, L * 0.16) * headS, { curve: 0.25, bendAxis: [0, 0, 1], sides: 10 })), 'keratin');
    }
  }
  const midPillow = (pathD, thick, z = 0, mat = 'accent') => {
    const poly = parsePath(pathD, 8).map((p) => [p[0], -p[1]]);
    const pl = pillow(poly, { origin: [0, 0, z], U: [1, 0, 0], V: [0, 1, 0], N: [0, 0, 1], thick, steps: 4, edgeThin: true });
    push(pl.map(H3), mat);
  };
  if (feat.crest === 'tube') {
    const L = 34 * (1 - 0.6 * baby);
    const pts = [[5, 8.5, 0], [-L * 0.25, 13 + L * 0.12, 0], [-L * 0.6, 12 + L * 0.2, 0], [-L, 6 + L * 0.25, 0]];
    push(tube(pts.map(H3), [3.6 * headS, 4.0 * headS, 3.8 * headS, 2.6 * headS], { sides: 14, cap: true }), 'accent');
  } else if (feat.crest === 'double') {
    for (const z of [1.7, -1.7]) midPillow('M2,-7 Q8,-21 22,-9.5 Q12,-13.5 4,-5 Z', 0.9, z);
  } else if (feat.crest === 'casque') {
    midPillow('M1,-9.5 C1,-22 14,-22.5 14,-9 Z', 4.5);
  } else if (feat.crest === 'comb') {
    midPillow('M-2,-9.5 Q0,-16 4,-11 Q6,-16.5 9,-11 Q11,-15 14,-9.5 Z', 2.2);
  } else if (feat.crest === 'ptero') {
    midPillow('M3,-4 C-8,-10 -22,-15 -30,-16 C-26,-12 -18,-6 -2,1 Z', 1.4);
  }
  if (feat.browCrest) {
    for (const side of [1, -1]) {
      const b = [ex - 1.5, eyeUp + eyeR * 1.3, eyeSurfZ * 0.7 * side];
      push(keratin(horn(H3(b), sub(H3(add(b, [0.3, 1, 0.1 * side])), H3(b)), 4.5 * headS, 1.6 * headS, { sides: 8 })), 'keratin');
    }
  }
  if (feat.bullHorns) {
    for (const side of [1, -1]) {
      const b = [ex - 1.5, eyeUp + eyeR * 1.4, eyeSurfZ * 0.55 * side];
      push(keratin(horn(H3(b), sub(H3(add(b, [0.05, 0.55, 0.85 * side])), H3(b)), 9 * headS, 2.1 * headS, { curve: 0.6, bendAxis: [1, 0, 0].map((v) => v * -side), sides: 10 })), 'keratin');
    }
  }
  if (feat.nasalArch) push(ellipsoid(H3([7, 8.6, 0]), [5.5 * headS, 3.4 * headS, 3.2 * headS], { lat: 8, lon: 12 }), 'skin');
  if (feat.knobs) {
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 8) * Math.PI;
      for (const side of [1, -1]) {
        const p = [-2 + Math.cos(a) * 3, 6 + Math.sin(a) * 6.5, side * (3 + Math.sin(a) * 2.5)];
        push(ellipsoid(H3(p), [1.3 * headS, 1.3 * headS, 1.3 * headS], { lat: 5, lon: 8 }), 'shade');
      }
    }
  }
  if (feat.armor) {
    for (const side of [1, -1]) {
      for (const [hx, hy] of [[-6, 6], [-6, -3]]) {
        const b = [hx, hy, headZ(hx + 1, hy) * 0.8 * side];
        push(keratin(horn(H3(b), sub(H3(add(b, [-0.8, hy > 0 ? 0.4 : -0.3, 0.6 * side])), H3(b)), 5 * headS, 1.8 * headS, { sides: 8 })), 'keratin');
      }
    }
  }
  if (feat.cheekHorn) {
    for (const side of [1, -1]) {
      const b = [ex - 2, eyeUp - 5, headZ(ex - 2, eyeUp - 5) * 0.85 * side];
      push(keratin(horn(H3(b), sub(H3(add(b, [-0.2, -0.3, 1 * side])), H3(b)), 4 * headS, 1.4 * headS, { sides: 8 })), 'keratin');
    }
  }

  // ---------- patas ----------
  const zHip = (x, y) => halfWidthAt(x, y) * 0.62 + 0.4;
  const limbTube = (pts3, radii, mat = 'limb', squash = [0.82, 1]) => push(tube(pts3, radii, { sides: 16, squash, cap: true, uvUnit: 20 }).tint((p) => [1, 1, 1, clamp(0.55 + p[1] / (Math.abs(cy) * 1.2), 0.62, 1)]), mat);
  const claw = (base, dirv, len, r, curve = 0.7, axis) => push(keratin(horn(base, dirv, len, r, { curve, bendAxis: axis || norm(cross(norm(dirv), [0, 1, 0])), sides: 8, taper: 0.9 })), 'claw');
  const footBiped = (ball, side, L, w, isFar) => {
    // Tres dedos (II, III, IV) abiertos en abanico, con garras.
    const toes = [[-0.38, 0.8], [0, 1], [0.34, 0.85]];
    toes.forEach(([a, k]) => {
      const len = L * 0.19 * k;
      const d = [Math.cos(a), 0, Math.sin(a) * side];
      const p0 = [ball[0], ball[1], ball[2]];
      const p1 = [ball[0] + d[0] * len * 0.45, ball[1] * 0.55, ball[2] + d[2] * len * 0.45];
      const p2 = [ball[0] + d[0] * len * 0.85, Math.max(w * 0.12, 0.5), ball[2] + d[2] * len * 0.85];
      const p3 = [ball[0] + d[0] * len, Math.max(w * 0.1, 0.45), ball[2] + d[2] * len];
      const rr = w * 0.2;
      push(tube([p0, p1, p2, p3], [rr * 1.3, rr * 1.05, rr * 0.85, rr * 0.7], { sides: 10, cap: true, squash: [1, 0.8] }).tint([0.9, 0.9, 0.9, 0.85]), isFar ? 'limbFar' : 'limb');
      claw(p3, [d[0], -0.55, d[2]], Math.max(1.6, w * 0.42), rr * 0.75, 0.9, norm(cross([d[0], 0, d[2]], [0, 1, 0])));
    });
    if (feat.sickle) {
      const b = [ball[0] + w * 0.1, ball[1] + w * 0.25, ball[2] - side * w * 0.25];
      claw(b, [0.75, 0.6, 0], L * 0.12, w * 0.22, 1.6, [0, 0, -1]);
    }
  };
  const quadFoot = (p, w, side, nails, thumb, hooves, isFar) => {
    // Pie columnar con almohadilla y uñas anchas.
    const pad = ellipsoid([p[0] + w * 0.08, w * 0.32, p[2]], [w * 0.62, w * 0.34, w * 0.55], { lat: 8, lon: 14 });
    push(pad.tint([0.92, 0.92, 0.92, 0.8]), isFar ? 'limbFar' : 'limb');
    for (let k = 0; k < nails; k += 1) {
      const a = nails === 1 ? 0 : (k - (nails - 1) / 2) * 0.55;
      const c = [p[0] + w * 0.55 * Math.cos(a), w * (hooves ? 0.2 : 0.16), p[2] + w * 0.5 * Math.sin(a)];
      const nail = ellipsoid(c, [w * (hooves ? 0.26 : 0.17), w * (hooves ? 0.2 : 0.14), w * (hooves ? 0.2 : 0.15)], { lat: 6, lon: 10 });
      push(keratin(nail), 'claw');
    }
    if (thumb) claw([p[0] + w * 0.4, w * 0.75, p[2] - side * w * 0.35], [0.5, 0.4, -side * 0.6], w * 0.7, w * 0.16, 0.6);
  };

  const legs = [];
  if (plan === 'biped') {
    const hip = R(-rx * 0.28, ry * 0.22);
    const legSet = (side, stride) => {
      const isFar = side < 0;
      const h = [hip[0] + stride, hip[1]];
      const L = -h[1];
      const zh = zHip(h[0], -h[1] + ry * 0.2);
      const knee = [h[0] + L * 0.2, h[1] + L * 0.44];
      const ankle = [h[0] + L * 0.01 + stride * 0.2, -L * 0.2];
      const ball = [ankle[0] + L * 0.12, -legW * 0.32];
      const zK = zh * 1.02; const zA = zh * 0.92; const zB = zh * 0.86;
      const thighTop = [h[0] - ry * 0.12, h[1] - ry * 0.5];
      limbTube([P3([thighTop[0], thighTop[1] + ry * 0.15], zh * 0.25 * side), P3([h[0] - ry * 0.02, h[1] - ry * 0.05], zh * 0.62 * side), P3([h[0] + L * 0.06, h[1] + L * 0.17], zh * 0.9 * side), P3(knee, zK * side)], [ry * 0.32, ry * 0.5, ry * 0.42, legW * 0.58], isFar ? 'limbFar' : 'limb', [0.72, 1]);
      limbTube([P3(knee, zK * side), P3([lerp(knee[0], ankle[0], 0.5), lerp(knee[1], ankle[1], 0.5)], (zK + zA) * 0.5 * side), P3(ankle, zA * side)], [legW * 0.57, legW * 0.43, legW * 0.32], isFar ? 'limbFar' : 'limb', [0.85, 1]);
      limbTube([P3(ankle, zA * side), P3(ball, zB * side)], [legW * 0.3, legW * 0.27], isFar ? 'limbFar' : 'limb', [0.85, 1]);
      // Primer dedo (espolón) detrás del metatarso
      claw(P3([ankle[0] + L * 0.02, ankle[1] + L * 0.06], (zA - 1) * side), [-0.4, -0.6, -0.2 * side], legW * 0.3, legW * 0.08, 0.6);
      footBiped(P3(ball, zB * side), side, L, legW, isFar);
      legs.push({ hip: P3(h, zh * side), side });
    };
    legSet(1, 0);
    legSet(-1, legLen * 0.1);
    if (armLen > 0) {
      const sh = R(rx * 0.6, ry * 0.18);
      const zs = halfWidthAt(sh[0], -sh[1]) * 0.75 + 0.3;
      for (const side of [1, -1]) {
        const isFar = side < 0;
        const a = armLen;
        const s0 = [sh[0] + (isFar ? 1.5 : 0), sh[1]];
        const elbow = [s0[0] + a * 0.12, s0[1] + a * 0.5];
        const wrist = [elbow[0] + a * 0.42, elbow[1] + a * 0.12];
        const aw = Math.max(2.6, legW * 0.42) * (feat.tinyArms ? 0.9 : 1);
        const zE = zs * 1.08; const zW = zs * 0.95;
        limbTube([P3([s0[0] - 1, s0[1] - ry * 0.1], zs * 0.6 * side), P3(s0, zs * side), P3(elbow, zE * side), P3(wrist, zW * side)], [aw * 0.8, aw * 0.7, aw * 0.5, aw * 0.36], isFar ? 'limbFar' : 'limb', [0.85, 1]);
        const nC = feat.tinyArms ? 2 : 3;
        for (let i = 0; i < nC; i += 1) {
          const big = feat.bigClaws;
          const fd = [0.55, -0.8, (i - (nC - 1) / 2) * 0.25 * side];
          const fb = P3(wrist, zW * side);
          const fl = big ? a * 0.18 : Math.max(1.6, a * 0.12);
          const tip = add(fb, mul(norm(fd), fl));
          push(tube([fb, tip], [aw * 0.22, aw * 0.16], { sides: 8, cap: true }).tint([1, 1, 1, 0.85]), isFar ? 'limbFar' : 'limb');
          claw(tip, [fd[0] * 0.6, -1, fd[2]], big ? a * 0.55 : Math.max(1.8, a * 0.16), big ? aw * 0.2 : aw * 0.12, big ? 0.7 : 0.9, [0, 0, side > 0 ? -1 : 1].map((v) => v * -1));
        }
        if (feat.thumb && !isFar) claw(add(P3(wrist, zW * side), [0, 0.5, 0]), [0.2, 1, 0.3 * side], 4.5, aw * 0.16, 0);
        if (fullFeathers) {
          // Ala de plumas pennáceas: un abanico plano a lo largo del antebrazo y
          // la mano, con las plumas colgando hacia atrás y abajo.
          const len = feat.wings ? a * 1.1 : a * 0.66;
          const E = P3(elbow, zE * side + 0.45 * side);
          const Wp = P3(wrist, zW * side + 0.45 * side);
          const hand = add(Wp, mul(sub(Wp, E), 0.5));
          const U = norm(sub(hand, E));
          let V = norm(cross(U, [0, 0, side]));
          if (V[1] > 0) V = mul(V, -1);
          const N = norm(cross(U, V));
          const Lf = v3.len(sub(hand, E));
          const n = 8;
          const tips = [];
          for (let i = 0; i < n; i += 1) {
            const t = i / (n - 1);
            const base = add(E, mul(U, t * Lf));
            const an = rad(118 + 38 * t);
            const L2 = len * (0.5 + 0.5 * t);
            const tip = add(base, [Math.cos(an) * L2, -Math.sin(an) * L2, 0]);
            const d = sub(tip, E);
            tips.push([v3.dot(d, U), v3.dot(d, V)]);
          }
          const outline = [[0, 0], [Lf * 0.5, -0.4], [Lf, 0], ...tips.reverse()];
          const fan = pillow(catmullClosed(outline, 2), { origin: E, U, V, N, thick: 0.9, steps: 2, edgeThin: true, center: [Lf * 0.55, tips[3][1] * 0.45] });
          const fw = Lf / n;
          fan.tint((q) => { const k = Math.floor(v3.dot(sub(q, E), U) / fw) % 2 ? 0.86 : 1; return [k, k, k, 1]; });
          push(fan, 'feather');
        }
      }
    }
  } else if (quad) {
    const fx = rx * 0.55;
    const bx = -rx * 0.48;
    const fTop = R(fx, ry * 0.35);
    const bTop = R(bx, ry * 0.25);
    const hooves = !!feat.hooves || look.head.type === 'duck';
    for (const side of [1, -1]) {
      const isFar = side < 0;
      const m = isFar ? 'limbFar' : 'limb';
      // Delantera
      {
        const t0 = [fTop[0] + (isFar ? 3 : 0), fTop[1]];
        const L = -t0[1];
        const w = plan === 'semi' ? legW * 0.62 : legW;
        const zs = zHip(t0[0], -t0[1]) * 0.98;
        const elbow = [t0[0] - 1, t0[1] + L * 0.42];
        const wrist = [t0[0] + 0.5, -L * 0.18];
        const foot = [t0[0] + 1, -w * 0.55];
        limbTube([P3([t0[0], t0[1] - ry * 0.2], zs * 0.25 * side), P3([t0[0] - 0.5, t0[1] + L * 0.12], zs * 0.75 * side), P3(elbow, zs * side), P3(wrist, zs * 0.96 * side), P3(foot, zs * 0.95 * side)], [w * 0.55, w * 0.76, w * 0.53, w * 0.42, w * 0.48], m, [0.85, 1]);
        quadFoot(P3([foot[0], 0], zs * 0.95 * side), w * 1.05, side, sauropod ? 1 : 3, sauropod || feat.thumb, false, isFar);
      }
      // Trasera
      {
        const t0 = [bTop[0] + (isFar ? 4 : 0), bTop[1]];
        const L = -t0[1];
        const zh = zHip(t0[0], -t0[1]);
        const knee = [t0[0] + 3, t0[1] + L * 0.45];
        const ankle = [t0[0] - 1.5, -L * 0.18];
        const foot = [t0[0] + 0.5, -legW * 0.55];
        limbTube([P3([t0[0] - ry * 0.1, t0[1] - ry * 0.3], zh * 0.25 * side), P3([t0[0], t0[1]], zh * 0.62 * side), P3([t0[0] + 1, t0[1] + L * 0.2], zh * 0.9 * side), P3(knee, zh * side)], [ry * 0.3, ry * 0.48, ry * 0.4, legW * 0.55], m, [0.74, 1]);
        limbTube([P3(knee, zh * side), P3(ankle, zh * 0.95 * side), P3(foot, zh * 0.94 * side)], [legW * 0.55, legW * 0.4, legW * 0.48], m, [0.85, 1]);
        quadFoot(P3([foot[0] + 0.5, 0], zh * 0.94 * side), legW * 1.1, side, 3, false, hooves, isFar);
        legs.push({ hip: P3(t0, zh * side), side });
      }
    }
  } else if (plan === 'flyer') {
    // Pterosaurio planeando: alas de membrana abiertas a los lados.
    const S = armLen;
    const sh = R(rx * 0.35, -ry * 0.2);
    const hip = R(-rx * 0.5, ry * 0.3);
    for (const side of [1, -1]) {
      const zs = halfWidthAt(sh[0], -sh[1]) * 0.8;
      const s3 = P3(sh, zs * side);
      const elbow = add(s3, [S * 0.1, S * 0.07, S * 0.19 * side]);
      const wrist = add(s3, [S * 0.17, S * 0.11, S * 0.38 * side]);
      const tip = add(s3, [-S * 0.22, S * 0.26, S * 0.95 * side]);
      const fingerMid = add(s3, [S * 0.04, S * 0.2, S * 0.68 * side]);
      const att = P3(hip, halfWidthAt(hip[0], -hip[1]) * 0.7 * side);
      const lead = catmull([s3, elbow, wrist, fingerMid, tip], 6);
      const nS = 22;
      const leadR = [];
      for (let i = 0; i < nS; i += 1) leadR.push(lead[Math.round((i / (nS - 1)) * (lead.length - 1))]);
      const trail = [];
      for (let i = 0; i < nS; i += 1) {
        const t = i / (nS - 1);
        const p = v3.lerp(att, tip, t);
        const inward = Math.sin(t * Math.PI) * S * 0.16;
        trail.push(add(p, [inward, -Math.sin(t * Math.PI) * S * 0.05, 0]));
      }
      const rows = 7;
      const grid = [];
      for (let r = 0; r <= rows; r += 1) {
        const t = r / rows;
        grid.push(leadR.map((p, i) => add(v3.lerp(p, trail[i], t), [0, Math.sin(t * Math.PI) * S * 0.025, 0])));
      }
      push(sheet(grid, { color: (r) => { const k = 0.8 + 0.2 * (1 - r / rows); return [k, k, k, 1]; } }), 'membrane', { double: true, flap: side });
      push(tube([s3, elbow, wrist, fingerMid, tip], [2.6, 2.1, 1.6, 0.9, 0.3], { sides: 10, cap: true }), 'limb', { flap: side });
      claw(add(wrist, [0.5, 0.6, 0]), [1, -0.2, 0], 2.6, 0.5, 0.8);
      // Patas traseras extendidas atrás
      const h3 = P3(hip, halfWidthAt(hip[0], -hip[1]) * 0.6 * side);
      const k3 = add(h3, [-8, -3, 1.2 * side]);
      const f3 = add(k3, [-8, -1.5, 0.8 * side]);
      limbTube([h3, k3, f3], [3.4, 2, 1.4], side < 0 ? 'limbFar' : 'limb', [0.9, 1]);
      claw(f3, [-1, -0.3, 0], 2.4, 0.5, 0.6);
    }
  } else if (plan === 'swim') {
    const flipper = (p2, len, angDown, back, side, w) => {
      const zs = halfWidthAt(p2[0], -p2[1]) * 0.85;
      const b = P3(p2, zs * side);
      const dirv = norm([-back, -angDown, 0.6 * side]);
      const pts = [b, add(b, mul(dirv, len * 0.45)), add(b, mul(dirv, len))];
      push(tube(pts, [w * 0.5, w * 0.62, w * 0.12], { sides: 12, cap: true, squash: [0.28, 1], up: [0, 0, 1] }), side < 0 ? 'limbFar' : 'limb');
    };
    for (const side of [1, -1]) {
      flipper(R(rx * 0.5, ry * 0.45), armLen + 12, 0.7, 0.8, side, 10);
      flipper(R(-rx * 0.45, ry * 0.45), legLen + 8, 0.6, 1, side, 7);
    }
  }

  // ---------- rasgos del lomo ----------
  const alongD = (t) => {
    const pts = dorsal.slice(tailN - 1);
    const x = clamp(t, 0, 1) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(x));
    const k = x - i;
    return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
  };
  if (feat.sail) {
    const H = feat.sail * (1 - 0.4 * baby);
    const n = 16;
    const topPts = [];
    const basePts = [];
    for (let i = 0; i <= n; i += 1) {
      const t = 0.08 + (i / n) * 0.86;
      const p = alongD(t);
      topPts.push([p[0], -(p[1] - H * Math.sin(Math.PI * (0.06 + t * 0.86)) ** 0.9 - 2)]);
      basePts.push([p[0], -(p[1] + 4)]);
    }
    const rowsS = 8;
    const grid = [];
    for (let r = 0; r <= rowsS; r += 1) {
      const t = r / rowsS;
      grid.push(basePts.map((b, i) => [lerp(b[0], topPts[i][0], t), lerp(b[1], topPts[i][1], t) + Math.sin(t * Math.PI) * 0.6, 0]));
    }
    const ends = (row) => row;
    const sail = sheet(grid.map(ends), { color: (r, c) => { const k = c % 2 ? 0.86 : 1; return [k, k, k, 1]; } });
    push(sail, 'membrane', { double: true });
    for (let i = 1; i < n; i += 2) {
      const b = basePts[i]; const tp = topPts[i];
      push(tube([[b[0], b[1], 0], [lerp(b[0], tp[0], 0.5), lerp(b[1], tp[1], 0.5), 0], [tp[0], tp[1] - 0.6, 0]], [1.1, 0.8, 0.45], { sides: 8, cap: true }), 'accent');
    }
  }
  if (feat.plates) {
    for (const row of [1, -1]) {
      for (let i = 0; i < feat.plates; i += 1) {
        const t = (i + (row < 0 ? 1 : 0.5)) / (feat.plates + (row < 0 ? 0.6 : 0));
        const p = alongD(-0.25 + t * 1.2);
        const size = ((feat.backSpikes ? 8 : 15) * Math.sin(Math.PI * (0.12 + t * 0.78)) + 5) * (1 - 0.35 * baby) * (row < 0 ? 0.9 : 1);
        const lean = rad((t - 0.5) * 18);
        // Placa en forma de cometa con la punta un poco hacia atrás, como en los
        // fósiles de Stegosaurus: así cada placa se lee por separado.
        const ctrl = [[-0.3, 0.02], [-0.44, 0.42], [-0.28, 0.9], [-0.08, 1.22], [0.04, 1.36], [0.16, 1.22], [0.38, 0.86], [0.47, 0.4], [0.3, 0.02]];
        const outline = catmullClosed(ctrl, 4).map(([u, v]) => [u * size, v * size]);
        const base = [p[0], -p[1] - 2.5, row * 1.4];
        const U = [Math.cos(lean), -Math.sin(lean), 0];
        const V = norm([Math.sin(lean), Math.cos(lean), row * 0.14]);
        const N = norm(cross(U, V));
        const pl = pillow(outline, { origin: base, U, V, N, thick: Math.max(1.2, size * 0.13), steps: 4, edgeThin: true });
        pl.tint((q) => { const k = 0.82 + 0.18 * clamp((q[1] - base[1]) / size, 0, 1); return [k, k, k, 1]; });
        push(pl, 'plate');
      }
    }
  }
  if (feat.backSpikes) {
    for (let i = 0; i < feat.backSpikes; i += 1) {
      const p = alongD(0.05 + (i / feat.backSpikes) * 0.35);
      for (const side of [1, -1]) {
        const b = [p[0], -p[1] - 2, side * 1.6];
        push(keratin(horn(b, [-0.35, 1, 0.25 * side], 16 * (1 - 0.4 * baby), 1.9, { curve: -0.2, bendAxis: [0, 0, 1], sides: 9 })), 'keratin');
      }
    }
  }
  if (feat.tailSpikes) {
    for (let i = 0; i < 2; i += 1) {
      const b2 = spine[2 + i];
      for (const side of [1, -1]) {
        const b = [b2[0], -b2[1] + 1.5, side * 1.2];
        push(keratin(horn(b, [-0.55, 0.45, 0.7 * side], 16 * (1 - 0.3 * baby), 1.9, { curve: 0.1, sides: 9 })), 'keratin');
      }
    }
  }
  if (feat.scutes || feat.ridge) {
    for (let i = 0; i < 14; i += 1) {
      const p = alongD(i / 13);
      const r = feat.ridge ? 1.6 : 1.2;
      push(ellipsoid([p[0], -p[1] - 0.3, 0], [r * 1.5, r, r * 0.8], { lat: 5, lon: 8 }), 'shade');
    }
  }
  if (feat.dorsalCrest) {
    // Edmontosaurus (Sereno et al., Science 2025): una cresta carnosa continua
    // sobre el cuello y el lomo que, pasada la cadera, se vuelve una fila de
    // púas, una sobre cada vértebra de la cola.
    const ch = 2.6 * (1 - 0.35 * baby);
    const lobe = (p, h, len) => push(ellipsoid([p[0], -p[1] + h * 0.3, 0], [len, h, 0.7], { lat: 6, lon: 10 }), 'shade');
    for (let i = 0; i <= 26; i += 1) {
      const t = i / 26;
      lobe(alongD(t), ch * (0.8 + 0.2 * Math.sin(t * Math.PI)), 2.4);
    }
    const nd = nOff.dorsal;
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      const x = t * (nd.length - 1) * 0.85;
      const j = Math.min(nd.length - 2, Math.floor(x));
      const k = x - j;
      lobe([lerp(nd[j][0], nd[j + 1][0], k), lerp(nd[j][1], nd[j + 1][1], k)], ch * (0.85 - 0.5 * t), 2.2);
    }
    for (let k = 0; k < 14; k += 1) {
      const t = 0.22 + (k / 13) * 0.74; // 0 = punta de la cola, 1 = cadera
      const x = t * tailN;
      const j = Math.min(tailN - 1, Math.floor(x));
      const f = x - j;
      const p = [lerp(dorsal[j][0], dorsal[j + 1][0], f), lerp(dorsal[j][1], dorsal[j + 1][1], f)];
      const L = (1.9 + 2.4 * t) * (1 - 0.4 * baby);
      push(horn([p[0], -p[1] - 0.6, 0], [-0.32, 1, 0], L, 0.8 + 0.5 * t, { sides: 6 }), 'shade');
    }
  }
  if (feat.quills) {
    for (let i = 0; i < 9; i += 1) {
      const p = dorsal[Math.max(1, Math.floor(2 + i * 0.6))];
      const L = (15 - i * 1.1) * (1 - 0.4 * baby);
      push(horn([p[0], -p[1] - 1, 0], [-0.28, 1, 0], L, 0.55, { sides: 6 }).tint([0.95, 0.9, 0.82, 1]), 'claw');
    }
  }
  if (feat.neckSpines) {
    for (const side of [1, -1]) {
      for (let i = 0; i < 9; i += 1) {
        const t = 0.15 + i * 0.09;
        const p = nOff.dorsal[Math.min(nOff.dorsal.length - 1, Math.round(t * (nOff.dorsal.length - 1)))];
        const pb = [lerp(neckPts[0][0], ne[0], t), lerp(neckPts[0][1], ne[1], t)];
        const base = [lerp(pb[0], p[0], 0.7), -lerp(pb[1], p[1], 0.7), side * 1.3];
        const L = (8 + 16 * Math.sin(Math.PI * (0.25 + t * 0.6))) * (1 - 0.5 * baby);
        push(horn(base, [-0.35, 1, 0.12 * side], L, 0.9, { sides: 7 }).tint([0.86, 0.82, 0.74, 1]), 'claw');
      }
    }
  }

  // ---------- plumas de la cola ----------
  let frond = 0;
  let frondSpan = 0;
  if (feat.tailFeathers) { frond = 10; frondSpan = 0.9; } else if (feat.tailFan) { frond = 10; frondSpan = 0.4; } else if (feat.wings) { frond = 8; frondSpan = 0.55; } else if (fullFeathers) { frond = 4.5; frondSpan = 0.75; }
  if (frond) {
    const fr = frond * (1 - 0.4 * baby);
    const n = tailN;
    const F = (i) => { const u = i / (n - 1); return u > frondSpan ? 0 : fr * (1 - u / frondSpan) ** 0.6; };
    const left = []; const right = []; const mid = [];
    for (let i = 0; i < n; i += 1) {
      const c = spine[i];
      const y = -c[1] + 0.4;
      const hw = halfWidthAt(c[0], -c[1]) + F(i);
      left.push([c[0], y, hw]); right.push([c[0], y, -hw]); mid.push([c[0], y, 0]);
    }
    const tdx = spine[1][0] - spine[0][0];
    const tipP = [spine[0][0] - Math.sign(tdx || 1) * fr * 0.9, -spine[0][1] + 0.4, 0];
    left.unshift(tipP); right.unshift(tipP); mid.unshift(tipP);
    const grid = [left, mid, right];
    push(sheet(grid, { color: (r, c) => { const k = 0.8 + 0.2 * (c % 2); return [k, k, k, 1]; } }), 'feather', { double: true });
  }
  if (feat.paddleTail) {
    // Aleta vertical alta sobre la cola (Spinosaurus).
    const outline = [];
    for (let i = 1; i < tailN - 1; i += 1) outline.push([spine[i][0], -spine[i][1]]);
    const topF = outline.map(([x, y], i) => [x, y + 8 * Math.sin(((i + 0.5) / outline.length) * Math.PI) + 2]);
    const poly = [...outline, ...topF.reverse()];
    push(pillow(poly, { origin: [0, 0, 0], U: [1, 0, 0], V: [0, 1, 0], N: [0, 0, 1], thick: 1.6, steps: 3, edgeThin: true }), 'membrane');
  }

  // ---------- cola: mazo y aleta ----------
  const tip = P3(tailTip);
  if (feat.club) {
    for (const [dx, dz, s] of [[-2, 0, 1], [1, 4.5, 0.72], [1, -4.5, 0.72]]) {
      push(ellipsoid([tip[0] + dx, tip[1], tip[2] + dz], [8 * s, 5.5 * s, 6.5 * s], { lat: 8, lon: 12 }), 'shade');
    }
  }
  if (feat.fluke) {
    const outline = [[0, 0], [-6, 4], [-12, 15], [-7, 6], [-4, 1], [-9, -12], [-3, -3], [2, -1]];
    push(pillow(catmullClosed(outline, 3), { origin: tip, U: [1, 0, 0], V: [0, 1, 0], N: [0, 0, 1], thick: 2, steps: 3, edgeThin: true }), 'limb');
  }

  // ---------- armadura ----------
  if (feat.armor) {
    const cols = 15;
    for (let i = 0; i < cols; i += 1) {
      const t = (i + 0.5) / cols;
      const pd = alongD(t);
      const x = pd[0];
      for (let r = 0; r < 6; r += 1) {
        const phi = Math.PI / 2 - (r + (i % 2) * 0.5) * 0.24;
        for (const side of r === 0 && i % 2 === 0 ? [1] : [1, -1]) {
          const sa = surfaceAt(x, r === 0 && i % 2 === 0 ? Math.PI / 2 : phi, side);
          if (!sa) continue;
          const s = (2.7 - r * 0.25) * (0.85 + Math.sin(Math.PI * t) * 0.3);
          const Xa = [1, 0, 0];
          const Za = norm(cross(Xa, sa.n));
          push(ellipsoid(add(sa.p, mul(sa.n, s * 0.12)), [s * 1.1, s * 0.42, s * 0.85], { X: Xa, Y: sa.n, Z: Za, lat: 5, lon: 8 }), 'shade');
        }
      }
    }
    for (let i = 0; i < 7; i += 1) {
      const t = 0.08 + i * 0.13;
      const x = alongD(t)[0];
      for (const side of [1, -1]) {
        const sa = surfaceAt(x, -0.12, side);
        if (!sa) continue;
        const L = (4.5 + (i % 2) * 2) * (1 - 0.3 * baby);
        push(keratin(horn(sa.p, add(sa.n, [-0.4, -0.2, 0]), L, 1.6, { sides: 8 })), 'keratin');
      }
    }
  }
  if (feat.shoulderSpike) {
    const s0 = R(rx * 0.4, ry * 0.05);
    for (const side of [1, -1]) {
      const sa = surfaceAt(s0[0], 0.2, side);
      if (!sa) continue;
      push(keratin(horn(sa.p, [0.7, 0.25, 0.65 * side], ry * 0.75, 2.6, { curve: -0.3, bendAxis: [0, 1, 0], sides: 10 })), 'keratin');
    }
  }

  // ---------- accesorio ----------
  if (opts.accesorio) {
    const acc = buildAccessory(opts.accesorio, { ex, eyeUp, eyeR, top: -(head.top || -12), headZ, headS, H3, neck: { nb: P3(nb), ne: P3(ne), w: endHalf } });
    for (const a of acc) push(a.mesh, 'acc', { color: a.color, rough: a.rough, metal: a.metal, emissive: a.emissive });
  }

  // ---------- información para luz, cámara y animación ----------
  const all = parts.reduce((b, p) => { const bb = p.mesh.bounds(); return { min: b.min.map((v, k) => Math.min(v, bb.min[k])), max: b.max.map((v, k) => Math.max(v, bb.max[k])) }; }, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  const headTop = H3([ex, -(head.top || -12), 0]);
  return {
    parts,
    colors: col,
    genes,
    countershade: !!feat.countershade,
    iridescent: !!feat.iridescent,
    info: {
      bounds: all,
      bodyMap,
      headMap,
      headType: look.head.type,
      headScale: headS,
      head: { ex, eyeUp, eyeR, jaw: head.jaw, nose: head.nose, len: head.len, beak: !!head.beak, bill: !!head.bill, kind: head.kind, mask: !!feat.mask, x0: hR[0], x1: hR[1] },
      feathered, fullFeathers, plan, baby, rx, ry, tailLen,
      floats: plan === 'flyer' || plan === 'swim',
      headTop,
      seed: genes.seed || 7,
      regions: { tailBase: xTailBase, tailTip: tip[0], neckStart: nb[0] },
    },
    anim: {
      tail: [xTailBase + rx * 0.1, tip[0], Math.min(3.2, 0.9 + tailLen * 0.035), 0],
      body: [R(-rx * 0.6, 0)[0], R(rx * 0.7, 0)[0], -cy, 0.012],
      neck: [nb[0], -nb[1], ne[0] + head.len * headS, 0],
      flap: plan === 'flyer' ? [halfWidthAt(nb[0], -nb[1]) * 0.8, -cy, 0.28, 1] : [0, 0, 0, 0],
    },
  };
}
