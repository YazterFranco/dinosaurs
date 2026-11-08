// Ilustración de dinosaurios en SVG, estilo paleoarte.
//
// Cada especie trae un objeto `look` con proporciones y rasgos (velas, placas,
// cuernos, crestas…). El dibujo sigue una "columna": la cola, el cuerpo y el
// cuello son siluetas continuas que se ensanchan y se afinan como en un
// esqueleto real, y comparten un solo contorno. Encima se pinta el volumen
// (luz arriba, vientre más claro, sombra abajo), la textura (escamas,
// osteodermos o plumas) y el patrón de los genes. Las patas tienen muslo,
// espinilla, metatarso y dedos con garras de queratina.
// Se dibuja con el suelo en y = 0 (arriba es negativo) y al final se encaja
// en el viewBox de 240 × 160.

import { phenotype, rng } from '../systems/genetics.js';
import { ACCESSORIES } from '../data/cosmetics.js';

const SIL = '#3b3a35';
let uidCounter = 0;

const f = (n) => Math.round(n * 10) / 10;
const rad = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const pt = (p) => `${f(p[0])},${f(p[1])}`;

// ------------------------------------------------------------------ geometría

/** Curva suave (Catmull-Rom → Bézier) que pasa por los puntos. */
function smooth(pts, closed = false) {
  const n = pts.length;
  if (n < 2) return '';
  const g = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i += 1) {
    const p0 = g(i - 1);
    const p1 = g(i);
    const p2 = g(i + 1);
    const p3 = g(i + 2);
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${pt(p2)}`;
  }
  return closed ? `${d} Z` : d;
}

/** Desplaza una columna hacia arriba (dorso) y hacia abajo (vientre). */
function offsets(spine, top, bot) {
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

/** Extremidad cónica: una columna de puntos con un ancho en cada uno. */
function limbPath(pts, widths) {
  const { dorsal, ventral } = offsets(pts, widths.map((w) => w / 2), widths.map((w) => w / 2));
  return smooth([pts[0], ...dorsal.slice(1), pts[pts.length - 1], ...ventral.slice(1).reverse()], true);
}

/** Puntos repartidos cada `step` unidades a lo largo de una polilínea. */
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    let pos = step - carry;
    while (pos <= seg) {
      out.push([lerp(x0, x1, pos / seg), lerp(y0, y1, pos / seg)]);
      pos += step;
    }
    carry = seg - (pos - step);
  }
  return out;
}

const qb = (a, c, b, t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
const cb = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
};

function bboxAdd(bb, pts) {
  for (const p of pts) {
    if (p[0] < bb.minX) bb.minX = p[0];
    if (p[0] > bb.maxX) bb.maxX = p[0];
    if (p[1] < bb.minY) bb.minY = p[1];
  }
}

/** Banda suave a lo largo de un contorno (tres trazos de opacidad baja). `id` es el del trazo en <defs>. */
function band(id, color, width, opacity, low = false) {
  return (low ? [0.7] : [1, 0.66, 0.33]).map((k) => `<use href="#${id}" fill="none" stroke="${color}" stroke-width="${f(width * k)}" stroke-linecap="round" stroke-linejoin="round" opacity="${f(((low ? opacity * 1.6 : opacity) / 2.2) * 100) / 100}"/>`).join('');
}

/**
 * Flecos de plumas (o picnofibras) a lo largo de un borde. Los puntos van de
 * la cola hacia la cabeza; `sign` = 1 para el dorso y -1 para el vientre.
 */
function fringe(pts, len, rand, sign = 1) {
  const P = resample(pts, Math.max(2, len * 0.85));
  if (P.length < 3) return '';
  let d = '';
  const inner = [];
  for (let i = 0; i < P.length; i += 1) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(P.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const nx = ty * sign;
    const ny = -tx * sign;
    const L = len * (0.65 + rand() * 0.7);
    const base = [P[i][0] - nx * 1.2, P[i][1] - ny * 1.2];
    const tip = [P[i][0] + nx * L - tx * L * 0.95, P[i][1] + ny * L - ty * L * 0.95];
    inner.push([P[i][0] - nx * 3.5, P[i][1] - ny * 3.5]);
    d += i ? ` Q${f(P[i][0] + nx * L * 0.2)},${f(P[i][1] + ny * L * 0.2)} ${pt(base)}` : `M${pt(base)}`;
    d += ` L${pt(tip)}`;
  }
  return `${d} L${inner.reverse().map(pt).join(' L')} Z`;
}

// ------------------------------------------------------------------ luz
// Rampa de luz al estilo del arte de videojuegos (Team Fortress 2, Valve):
// las sombras se enfrían en vez de ennegrecerse, la zona de transición entre
// luz y sombra gana saturación cálida, los bordes que miran arriba reciben una
// luz de contorno y el vientre recibe la luz rebotada del suelo.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hsl = (h, s, l) => `hsl(${f(h)} ${f(clamp(s, 0, 100))}% ${f(clamp(l, 0, 100))}%)`;
function parseHsl(c) {
  const m = /hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(c || '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [30, 30, 50];
}
/** Gira un tono hacia `target` por el camino corto, como mucho `amt` grados. */
function toward(h, target, amt) {
  const d = ((target - h + 540) % 360) - 180;
  return (h + Math.sign(d) * Math.min(Math.abs(d), amt) + 360) % 360;
}
function lightRamp(base) {
  const [h, s, l] = parseHsl(base);
  return {
    cool: hsl(toward(h, 230, 22), s + 4, Math.max(l - 24, 5)),
    warm: hsl(toward(h, 18, 14), Math.min(s + 24, 88), Math.max(l - 5, 10)),
    rim: hsl(toward(h, 50, 16), Math.max(s - 6, 8), Math.min(l + 34, 95)),
    bounce: hsl(toward(h, 205, 24), Math.max(s - 12, 6), Math.min(l + 10, 82)),
    glow: hsl(toward(h, 15, 22), Math.min(s + 30, 92), Math.min(l + 20, 82)),
  };
}

/** Color del contorno: un tono muy oscuro del propio animal (no negro puro). */
function lineColor(genes, variante) {
  if (variante === 'a') return 'hsla(15,22%,46%,.9)';
  if (variante === 'l') return `hsla(${genes.hue1},16%,40%,.9)`;
  if (variante === 'm') return 'hsla(0,0%,3%,.9)';
  return `hsla(${genes.hue1},38%,11%,.88)`;
}

// ------------------------------------------------------------------ cabezas
// Origen en la unión con el cuello, mirando a +x. `eye`: centro del ojo;
// `jaw`: línea de la boca; `nose`: narina; `top`: borde superior (accesorios).
// `kind: 'theropod'` añade fenestra anteorbital y labios sobre los dientes.

const HEADS = {
  boxy: { d: 'M-6,-6 C-3,-11 3,-12.5 9,-12 C12,-14 15,-12.5 16,-11 C22,-10 29,-7 34,-4 C36,-2.5 36,0.5 34.5,1.5 C30,3 22,4 14,4.5 C14,6.5 12,9 6,9.5 C1,9.6 -4,8 -6.5,5 C-8,2 -7.8,-3 -6,-6 Z', eye: [11, -7], jaw: 'M6,4.6 C14,4.4 24,3.2 33.5,1.2', nose: [31.5, -3.2], top: -13, len: 36, brow: true, kind: 'theropod' },
  short: { d: 'M-6,-7 C-3,-12 4,-13.5 11,-12 C17,-10.5 22,-6.5 24,-3 C25,0 24,3 21,4.2 C16,5 10,5.2 6,5.5 C4,8 0,9 -3,8.4 C-6,7 -7.5,3 -7.2,-1 C-7,-3.5 -6.8,-5.5 -6,-7 Z', eye: [10, -6.5], jaw: 'M3,5.4 C10,5 17,4.4 22.8,2.6', nose: [21, -3], top: -14, len: 25, brow: true, kind: 'theropod' },
  slim: { d: 'M-5,-5.5 C-2,-8.5 4,-9.2 9,-8.5 C14,-7.6 21,-5.4 27,-2.6 C29.5,-1.4 30,0.6 28.6,1.6 C24,3 15,3.8 8,4.2 C3,4.6 -2,4.4 -4.6,3 C-6.4,1.4 -6.6,-2.6 -5,-5.5 Z', eye: [8, -4.2], jaw: 'M4,3.6 C12,3.4 20,2.6 28.4,1.2', nose: [26.5, -1.8], top: -9.5, len: 30, brow: true, kind: 'theropod' },
  croc: { d: 'M-5.5,-6.5 C-2,-9 4,-9.4 9,-8 C13,-6.6 17,-5 22,-4 C28,-3.4 33,-3.6 37,-4.4 C40,-4.6 41.5,-2.4 41,0 C40.4,2.4 38,3.2 35,2.8 C28,3 18,3.8 9,4.4 C3,4.8 -2.5,4.6 -5,3 C-7,1 -7.2,-3.6 -5.5,-6.5 Z', eye: [7, -6], jaw: 'M5,4 C15,3.6 27,2.8 39.5,1.6', nose: [37, -2.6], top: -9.5, len: 41, brow: true, kind: 'theropod' },
  small: { d: 'M-4.5,-4.6 C-2.5,-8.4 3,-9.6 8,-8.8 C12.5,-8 15.5,-5.4 16.8,-2.4 C17.6,-0.2 17,2.4 15,3.4 C11.5,4.6 6,4.6 1.5,4.4 C-1.8,4.2 -4.5,3 -5.4,0.6 C-6,-1.4 -5.6,-3.2 -4.5,-4.6 Z', eye: [6.5, -4.2], jaw: 'M3,3.8 C8,3.8 12,3.4 16.2,2', nose: [14.5, -2.8], top: -9.5, len: 17.5, brow: false },
  duck: { d: 'M-5.5,-6.5 C-2,-11 5,-11.4 10,-9 C13.5,-7.4 17,-5.4 21,-4.2 C25,-3.4 28.5,-2.8 29.8,-0.8 C30.6,1 29.4,2.8 27,3.2 C22,3.8 16,4.4 9,5.2 C3,5.8 -2.5,5.4 -5,3.4 C-7,1.4 -7.2,-3.6 -5.5,-6.5 Z', eye: [7, -5.2], jaw: 'M4,4.8 C13,4.4 21,3.6 29.2,1.6', nose: [24, -2.8], top: -11.5, len: 30.5, brow: false, bill: true },
  beak: { d: 'M-4.5,-4.8 C-2,-8.8 4,-9.6 8,-8 C11,-6.6 14,-4 19.5,-0.8 C15,1.6 10,3.2 5,3.8 C1,4.2 -2.8,3.6 -4.6,1.8 C-6,0.2 -5.8,-2.8 -4.5,-4.8 Z', eye: [5.5, -4.4], jaw: 'M3,3.2 C9,2.6 14,1.2 19,-0.6', nose: [12, -4], top: -9.8, len: 20, brow: false, beak: true },
  parrot: { d: 'M-5,-5.5 C-2.5,-11.5 5,-13.4 10.5,-11 C14.5,-9.2 16.6,-5.6 17,-2 C17.2,1.6 16,4.6 13.6,6.8 C12.6,5 11.4,4.4 9.6,4.6 C6,5 2,5 -1.4,4.2 C-4.4,3.4 -6,1.4 -6,-1.4 C-6,-3 -5.7,-4.4 -5,-5.5 Z', eye: [5.5, -5.4], jaw: 'M2,4 C7,4 11,3.8 13.8,5.8', nose: [11.5, -6], top: -12.6, len: 17.5, brow: false, beak: true },
  horned: { d: 'M-7,-8 C-3,-12.6 5,-13.2 11,-11 C16,-9 20,-6 24,-4 C27.5,-2.2 30,-0.6 30.6,1.4 C30.8,3.6 28.8,5.4 26,5.4 C23.6,5.4 22,6.4 20,7.4 C14,9.4 6,9.6 0,8.6 C-4.4,7.8 -7.4,5 -8,1.4 C-8.4,-2 -8.2,-5.4 -7,-8 Z', eye: [8, -6], jaw: 'M3,7 C11,6.8 18,5.6 26.4,5', nose: [24, -2.4], top: -12.8, len: 31, brow: true, beak: true },
  armored: { d: 'M-7,-5.4 C-4,-9.6 4,-10.4 11,-9.4 C16,-8.6 20,-6.2 21.6,-3 C22.8,-0.4 22,2.8 19.4,4.4 C15,6.2 8,6.4 1,6.2 C-3.6,6 -7,4.6 -8.2,1.8 C-9,-0.8 -8.6,-3.4 -7,-5.4 Z', eye: [7, -3.4], jaw: 'M3,5.4 C9,5.2 15,4.4 20.6,2.6', nose: [18.5, -2.4], top: -10.2, len: 22.5, brow: true },
  dome: { d: 'M-5,-3.6 C-6,-12 -1,-18 6,-18.6 C12.6,-19 17,-14.6 17.4,-8.6 C17.6,-6.6 18.8,-4.8 20,-2.6 C21,-0.4 20.4,2 18.4,3 C14,4.6 8,5.2 2,5 C-1.8,4.8 -4.8,3.4 -5.8,1 C-6.4,-0.6 -6,-2.2 -5,-3.6 Z', eye: [9, -4], jaw: 'M4,4.4 C9,4.2 14,3.6 19.6,1.6', nose: [18, -2], top: -18.6, len: 20.5, brow: true },
  ptero: { d: 'M-4.5,-4 C-1.5,-7 4,-7.2 9,-5.6 C17,-3.4 28,-1.2 40,0.2 C28,1.8 17,3.4 9,4 C3,4.4 -2,4 -4.4,2.4 C-6,1 -6,-2 -4.5,-4 Z', eye: [4, -2.4], jaw: 'M6,1.8 C17,1.4 28,0.8 39,0.3', nose: [16, -2], top: -7.2, len: 40, brow: false, beak: true },
};

// ------------------------------------------------------------------ dibujo

/**
 * Devuelve el SVG de un dinosaurio.
 * @param {object} species  especie de species.js
 * @param {object} genes    genes del individuo (o null para el aspecto base)
 * @param {object} opts     { stage: 'cria'|'juvenil'|'adulto', anim (true | 'lite'), silhouette, sleeping, noShadow, title,
 *                            mood: 'feliz'|'radiante'|'triste'|'hambre'|'cansado', accesorio }
 */
export function dinoSVG(species, genes, opts = {}) {
  const stage = opts.stage || 'adulto';
  const look = species.look;
  const feat = look.feat || {};
  const uid = `d${(uidCounter += 1)}`;
  const g = genes || defaultGenes(species);
  const col = phenotype(g);
  const sil = !!opts.silhouette;
  // Nivel de detalle: las miniaturas ('low') omiten la textura fina de escamas
  // y suavizan con un solo trazo, como el LOD de los videojuegos.
  const low = opts.detail === 'low';
  const LN = sil ? SIL : lineColor(g, col.variante);
  const fill = sil ? SIL : col.piel;
  const shade = sil ? SIL : col.sombra;
  const belly = col.vientre;
  const accent = sil ? SIL : col.acento;
  const lt = lightRamp(col.piel);
  const ltA = lightRamp(col.acento);
  const fullFeathers = feat.feathers === 'full' || !!feat.wings;
  const feathered = fullFeathers || feat.feathers === 'partial';
  const rand = rng(g.seed || 7);
  const bb = { minX: Infinity, maxX: -Infinity, minY: 0 };

  // Las crías tienen cabeza y ojos más grandes, cuello y cola más cortos.
  const baby = stage === 'cria' ? 1 : stage === 'juvenil' ? 0.5 : 0;
  const headS = (look.head.s || 1) * 1.05 * (1 + 0.42 * baby);
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

  // ---------- postura ----------
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
    cy = -(armLen * 0.22 + 26);
    tilt = 8;
  } else {
    cy = -50;
  }
  const cosT = Math.cos(rad(-tilt));
  const sinT = Math.sin(rad(-tilt));
  const R = (px, py) => [px * cosT - py * sinT, cy + px * sinT + py * cosT];

  // ---------- columna del cuerpo y la cola ----------
  const spineL = [];
  const top = [];
  const bot = [];
  const tailN = 8;
  const bellyF = feat.potBelly ? 1.22 : 1;
  for (let i = 0; i <= tailN; i += 1) {
    const t = i / tailN; // 0 = punta, 1 = base
    const x = -rx * 0.8 - tailLen * (1 - t);
    let y;
    if (plan === 'biped') y = ry * 0.02 - (1 - t) ** 2 * ry * 0.12;
    else if (plan === 'swim') y = Math.sin((1 - t) * Math.PI * 1.2) * 3;
    else if (plan === 'flyer') y = 1;
    else y = ry * 0.12 + (1 - t) ** 1.4 * tailLen * 0.2;
    const h = lerp(0.7, Math.max(tailW * 0.62, 2), t ** 1.25) + (t > 0.85 ? ((t - 0.85) / 0.15) * ry * 0.22 : 0);
    spineL.push([x, y]);
    top.push(h);
    bot.push(h * 1.05);
  }
  const bodyX = [-rx * 0.55, -rx * 0.18, rx * 0.22, rx * 0.56, rx * 0.86];
  const bodyTop = [ry * 0.88, ry * 0.98, ry * 0.97, ry * 0.86, ry * 0.6];
  const bodyBot = [ry * 0.8, ry * 1.02 * bellyF, ry * 1.0 * bellyF, ry * 0.86, ry * 0.56];
  bodyX.forEach((x, i) => { spineL.push([x, 0]); top.push(bodyTop[i]); bot.push(bodyBot[i]); });
  const spine = spineL.map(([x, y]) => R(x, y));
  const { dorsal, ventral } = offsets(spine, top, bot);
  const chestTip = R(rx * 1.0, ry * 0.08);
  const tailTip = spine[0];
  const torsoD = smooth([tailTip, ...dorsal.slice(1), chestTip, ...ventral.slice(1).reverse()], true);
  const dorsalD = smooth([tailTip, ...dorsal.slice(1, -1)]);
  const ventralD = smooth([tailTip, ...ventral.slice(1, -1)]);
  bboxAdd(bb, dorsal);
  bboxAdd(bb, ventral);

  // ---------- cuello ----------
  const ang = rad(neckAng);
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
  const nOff = offsets(neckPts, nTop, nBot);
  const neckPoly = [...nOff.dorsal, ne, ...nOff.ventral.slice().reverse()];
  const neckD = smooth(neckPoly, true);
  // Cuerpo + cuello como un único trazado (mismo sentido de giro, así la regla
  // nonzero los une): un recorte de una sola forma es mucho más barato de pintar.
  const area = (P) => P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
  const torsoPoly = [tailTip, ...dorsal.slice(1), chestTip, ...ventral.slice(1).reverse()];
  const unionD = `${torsoD} ${Math.sign(area(torsoPoly)) === Math.sign(area(neckPoly)) ? neckD : smooth(neckPoly.slice().reverse(), true)}`;
  const neckDorsalD = smooth(nOff.dorsal.slice(1));
  const neckVentralD = smooth(nOff.ventral.slice(1));
  bboxAdd(bb, nOff.dorsal);

  // ---------- cabeza ----------
  const head = HEADS[look.head.type] || HEADS.slim;
  const headAngle = plan === 'flyer' ? -4 : Math.min(neckAng * 0.35, 18) - 7;
  const headT = `translate(${f(ne[0])} ${f(ne[1])}) rotate(${f(-headAngle)}) scale(${f(headS)})`;
  const ha = rad(-headAngle);
  const HP = (x, y) => [ne[0] + (x * Math.cos(ha) - y * Math.sin(ha)) * headS, ne[1] + (x * Math.sin(ha) + y * Math.cos(ha)) * headS];
  bboxAdd(bb, [HP(-8, head.top), HP(head.len + 3, head.top), HP(head.len + 3, 8)]);

  // ---------- definiciones compartidas ----------
  const clipBody = `${uid}cb`;
  const clipHead = `${uid}ch`;
  const scales = `${uid}sc`;
  const limbG = `${uid}lg`;
  const keratin = `${uid}kr`;
  const outMask = `${uid}mk`;
  const bigRect = '<rect x="-600" y="-600" width="1200" height="1200" fill="#fff"/>';
  let defs = '';
  if (!sil) {
    defs = `<defs>
      <path id="${uid}T" d="${torsoD}"/><path id="${uid}N" d="${neckD}"/><path id="${uid}U" d="${unionD}"/>
      <path id="${uid}D" d="${dorsalD}"/><path id="${uid}V" d="${ventralD}"/>
      <path id="${uid}ND" d="${neckDorsalD}"/><path id="${uid}NV" d="${neckVentralD}"/>
      <clipPath id="${clipBody}"><path d="${unionD}"/></clipPath>
      <clipPath id="${clipHead}"><path d="${head.d}" transform="${headT}"/></clipPath>
      <mask id="${outMask}" maskUnits="userSpaceOnUse" x="-600" y="-600" width="1200" height="1200">${bigRect}<use href="#${uid}U" fill="#000"/></mask>
      <mask id="${uid}mt" maskUnits="userSpaceOnUse" x="-600" y="-600" width="1200" height="1200">${bigRect}<use href="#${uid}T" fill="#000"/></mask>
      <pattern id="${scales}" width="${feathered ? 4 : 3.6}" height="${feathered ? 3 : 3.2}" patternUnits="userSpaceOnUse" patternTransform="rotate(${f(-tilt)})">
        ${feathered
    ? '<path d="M3.4,.6 L.8,2.2" stroke="rgba(25,18,10,.15)" stroke-width=".6" stroke-linecap="round"/><path d="M3.6,1.4 L2.2,2.3" stroke="rgba(255,255,255,.08)" stroke-width=".45" stroke-linecap="round"/>'
    : '<circle cx=".9" cy=".8" r=".78" fill="rgba(25,18,10,.11)"/><circle cx="2.7" cy="2.4" r=".78" fill="rgba(25,18,10,.11)"/><circle cx=".7" cy=".52" r=".28" fill="rgba(255,255,255,.09)"/><circle cx="2.5" cy="2.12" r=".28" fill="rgba(255,255,255,.09)"/>'}
      </pattern>
      <linearGradient id="${limbG}" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="${lt.rim}" stop-opacity=".22"/><stop offset=".32" stop-color="${lt.rim}" stop-opacity="0"/><stop offset=".62" stop-color="${lt.warm}" stop-opacity=".12"/><stop offset="1" stop-color="${lt.cool}" stop-opacity=".6"/></linearGradient>
      <linearGradient id="${uid}ss" x1="0" y1="0" x2=".2" y2="1"><stop offset="0" stop-color="${ltA.glow}" stop-opacity=".8"/><stop offset=".5" stop-color="${ltA.glow}" stop-opacity=".22"/><stop offset="1" stop-color="${ltA.cool}" stop-opacity=".35"/></linearGradient>
      <linearGradient id="${uid}cr" x1="0" y1="0" x2="0" y2="1"><stop offset=".15" stop-color="${LN}" stop-opacity="0"/><stop offset=".6" stop-color="${LN}" stop-opacity=".7"/><stop offset="1" stop-color="${LN}" stop-opacity="1"/></linearGradient>
      <radialGradient id="${uid}ey" cx=".42" cy=".4" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
      <linearGradient id="${keratin}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7d6a4f"/><stop offset=".55" stop-color="#cbbb98"/><stop offset="1" stop-color="#f1e7d2"/></linearGradient>
      ${feat.iridescent ? `<linearGradient id="${uid}ir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ad0ff"/><stop offset=".5" stop-color="#8a5bff"/><stop offset="1" stop-color="#2ef0a8"/></linearGradient>` : ''}
    </defs>`;
  }

  const far = [];
  const back = [];
  const near = [];
  const topLayer = [];
  const bodyExtra = [];

  // Extremidad rellena con volumen. Las del lado cercano llevan contorno fuerte
  // solo fuera del cuerpo; dentro queda un pliegue suave (el músculo se funde).
  let limbN = 0;
  // Una forma con varias capas (color, sombra, contorno) se define una sola vez.
  const layers = (d, attrs) => {
    const id = `${uid}s${(limbN += 1)}`;
    return `<defs><path id="${id}" d="${d}"/></defs>${attrs.map((a) => `<use href="#${id}" ${a}/>`).join('')}`;
  };
  const limb = (pts, widths, isFar, creaseOp = 0) => {
    const d = limbPath(pts, widths);
    if (sil) return `<path d="${d}" fill="${SIL}"/>`;
    if (isFar) return layers(d, [`fill="${shade}"`, `fill="url(#${limbG})"`, `fill="none" stroke="${LN}" stroke-width="1.2" stroke-linejoin="round" opacity=".7"`]);
    // Dentro del cuerpo no se repinta nada: solo el borde delantero del músculo
    // (muslo, brazo), que se desvanece hacia arriba, como en el arte de juegos.
    let crease = '';
    if (creaseOp > 0.2) {
      const fe = offsets(pts, widths.map((w) => w / 2), widths.map((w) => w / 2)).dorsal;
      crease = `<path d="${smooth([pts[0], ...fe.slice(1)])}" fill="none" stroke="url(#${uid}cr)" stroke-width="1.2" stroke-linecap="round" opacity="${creaseOp}"/>`;
    }
    const id = `${uid}l${(limbN += 1)}`;
    return `<defs><path id="${id}" d="${d}"/></defs><g mask="url(#${outMask})"><use href="#${id}" fill="${fill}"/>${low ? '' : `<use href="#${id}" fill="url(#${scales})" opacity=".8"/>`}<use href="#${id}" fill="url(#${limbG})"/>`
      + `<use href="#${id}" fill="none" stroke="${LN}" stroke-width="1.4" stroke-linejoin="round"/></g>${crease}`;
  };
  // Sombra de contacto bajo cada pie (oclusión ambiental en el suelo).
  const contact = (x, w) => (opts.noShadow ? '' : `<ellipse cx="${f(x)}" cy=".6" rx="${f(w * 0.85)}" ry="${f(Math.max(1.2, w * 0.18))}" fill="#000" opacity="${sil ? 0.12 : 0.22}"/>`);
  // Garra o uña de queratina.
  const claw = (x, y, len, angDeg, w = 1.6) => {
    if (sil) return '';
    const a = rad(angDeg);
    const sx = Math.sin(a);
    const cx = Math.cos(a);
    return `<path d="M${f(x - w * sx)},${f(y + w * cx)} Q${f(x + cx * len * 0.6 - sx * w)},${f(y + sx * len * 0.6 - w)} ${f(x + cx * len)},${f(y + sx * len)} Q${f(x + cx * len * 0.5)},${f(y + sx * len * 0.5 + w * 0.6)} ${f(x + w * sx)},${f(y - w * cx)} Z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".55"/>`;
  };
  // Pie de terópodo / ornitópodo: tres dedos (se ven dos), con garras.
  const footBiped = (x, w, len, isFar) => {
    const h = Math.max(1.6, w * 0.36);
    const d = `M${f(x - w * 0.5)},${f(-h * 1.7)} C${f(x + len * 0.25)},${f(-h * 1.6)} ${f(x + len * 0.7)},${f(-h * 0.95)} ${f(x + len)},${f(-h * 0.5)} L${f(x + len)},0 L${f(x + len * 0.56)},0 Q${f(x + len * 0.46)},${f(-h * 0.45)} ${f(x + len * 0.34)},0 L${f(x - w * 0.6)},0 Z`;
    let s;
    if (sil) s = `<path d="${d}" fill="${SIL}"/>`;
    else {
      s = layers(d, [`fill="${isFar ? shade : fill}"`, `fill="url(#${limbG})"`, `fill="none" stroke="${LN}" stroke-width="1.1" stroke-linejoin="round" opacity="${isFar ? 0.7 : 1}"`])
        + `<path d="M${f(x + len * 0.36)},${f(-h * 1.3)} q.9,${f(h * 0.55)} 0,${f(h * 1)} M${f(x + len * 0.7)},${f(-h * 0.9)} q.7,${f(h * 0.4)} 0,${f(h * 0.75)}" fill="none" stroke="${LN}" stroke-width=".6" opacity=".4"/>`;
    }
    s += claw(x + len * 0.6, -h * 0.15, Math.max(1.4, w * 0.3), 32, Math.max(0.5, h * 0.33));
    s += claw(x + len - 0.3, -h * 0.25, Math.max(1.8, w * 0.42), 30, Math.max(0.6, h * 0.42));
    return s;
  };
  // Pie de cuadrúpedo: pata columnar con uñas anchas (pezuñas).
  const quadFoot = (x, w, isFar, nails, thumb) => {
    const h = w * 0.42;
    const d = `M${f(x - w * 0.5)},${f(-h * 1.9)} C${f(x - w * 0.62)},${f(-h * 0.7)} ${f(x - w * 0.72)},0 ${f(x - w * 0.48)},0 L${f(x + w * 0.74)},0 C${f(x + w * 0.86)},${f(-h * 0.45)} ${f(x + w * 0.62)},${f(-h * 1.4)} ${f(x + w * 0.42)},${f(-h * 1.9)} Z`;
    if (sil) return `<path d="${d}" fill="${SIL}"/>`;
    let s = layers(d, [`fill="${isFar ? shade : fill}"`, `fill="url(#${limbG})"`, `fill="none" stroke="${LN}" stroke-width="1.1" stroke-linejoin="round" opacity="${isFar ? 0.7 : 1}"`]);
    for (let k = 0; k < nails; k += 1) {
      const nx = x + w * (nails === 1 ? 0.45 : 0.02 + k * 0.25);
      s += `<path d="M${f(nx - 1.2)},0 Q${f(nx - 0.8)},${f(-h * 0.95)} ${f(nx + 1.3)},${f(-h * 0.5)} Q${f(nx + 1.6)},-.2 ${f(nx + 1.1)},0 Z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".45"/>`;
    }
    if (thumb && !isFar) s += claw(x + w * 0.62, -h * 0.9, w * 0.4, 25, 1);
    return s;
  };

  // ---------- patas ----------
  if (plan === 'biped') {
    const hip = R(-rx * 0.28, ry * 0.22);
    const legSet = (h, isFar) => {
      const L = -h[1];
      const knee = [h[0] + L * 0.2, h[1] + L * 0.44];
      const ankle = [h[0] + L * 0.01, -L * 0.2];
      const ball = [ankle[0] + L * 0.12, -legW * 0.32];
      let s = contact(ball[0] + L * 0.05, legW * 1.3);
      s += footBiped(ball[0] - legW * 0.12, legW, L * 0.19, isFar);
      s += limb([ankle, ball], [legW * 0.6, legW * 0.52], isFar);
      if (!sil) s += claw(ankle[0] - legW * 0.22, ankle[1] + L * 0.06, legW * 0.28, 120, 0.6); // primer dedo (espolón)
      s += limb([knee, [lerp(knee[0], ankle[0], 0.5), lerp(knee[1], ankle[1], 0.5)], ankle], [legW * 1.15, legW * 0.86, legW * 0.64], isFar);
      if (feat.sickle) s += claw(ball[0] + legW * 0.15, -legW * 0.75, L * 0.12, -38, 1);
      s += limb([[h[0] - ry * 0.12, h[1] - ry * 0.5], [h[0] + L * 0.05, h[1] + L * 0.14], knee], [ry * 1.1, ry * 0.9, legW * 1.15], isFar, 0.34);
      return s;
    };
    far.push(legSet([hip[0] + 6, hip[1] - 1.5], true));
    near.push(legSet(hip, false));
    if (armLen > 0) {
      const sh = R(rx * 0.6, ry * 0.18);
      const armSet = (s0, isFar) => {
        const a = armLen;
        const elbow = [s0[0] + a * 0.12, s0[1] + a * 0.5];
        const wrist = [elbow[0] + a * 0.42, elbow[1] + a * 0.12];
        const aw = Math.max(2.6, legW * 0.42) * (feat.tinyArms ? 0.9 : 1);
        let s = '';
        if (!isFar && fullFeathers && !sil) {
          // Ala de plumas pennáceas: secundarias en el antebrazo, primarias en la mano.
          const n = feat.wings ? 8 : 6;
          const len = feat.wings ? a * 1.05 : a * 0.62;
          const hand = [wrist[0] + (wrist[0] - elbow[0]) * 0.45, wrist[1] + (wrist[1] - elbow[1]) * 0.45];
          const tips = [];
          let rachis = '';
          for (let i = 0; i < n; i += 1) {
            const t = i / (n - 1);
            const b = [lerp(elbow[0], hand[0], t), lerp(elbow[1], hand[1], t)];
            const an = rad(112 + 42 * t);
            const L = len * (0.55 + 0.45 * t);
            const tp = [b[0] + Math.cos(an) * L, b[1] + Math.sin(an) * L];
            tips.push(tp);
            rachis += `<path d="M${pt(b)} L${pt(tp)}" stroke="${shade}" stroke-width=".7" opacity=".6"/>`;
          }
          const d = `${smooth([elbow, ...tips])} L${pt(hand)} L${pt(wrist)} Z`;
          s += `<path d="${d}" fill="${accent}"/><path d="${d}" fill="url(#${limbG})"/>${rachis}<path d="${d}" fill="none" stroke="${LN}" stroke-width="1" stroke-linejoin="round"/>`;
          bboxAdd(bb, tips);
        }
        s += limb([s0, elbow, wrist], [aw * 1.4, aw, aw * 0.7], isFar);
        const nC = feat.tinyArms ? 2 : 3;
        for (let i = 0; i < nC; i += 1) {
          const big = feat.bigClaws && i === 0;
          s += claw(wrist[0] - 0.5 + i * 0.6, wrist[1] + i * 0.8, big ? a * 0.5 : Math.max(2, a * 0.16), big ? 60 : 70 + i * 12, big ? 1.4 : 0.8);
        }
        if (feat.thumb && !isFar) s += `<path d="M${f(wrist[0] - 1)},${f(wrist[1] - 1.5)} l2.2,-5.5 l1.6,4.8 z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".6"/>`;
        return s;
      };
      far.push(armSet([sh[0] + 4, sh[1] - 1.5], true));
      topLayer.push(armSet(sh, false));
    }
  } else if (quad) {
    const fx = rx * 0.55;
    const bx = -rx * 0.48;
    const fTop = R(fx, ry * 0.35);
    const bTop = R(bx, ry * 0.25);
    const sauropod = look.head.type === 'small' && neckLen > 20;
    const front = (t0, isFar) => {
      const L = -t0[1];
      const w = plan === 'semi' ? legW * 0.62 : legW;
      const elbow = [t0[0] - 1, t0[1] + L * 0.42];
      const wrist = [t0[0] + 0.5, -L * 0.18];
      const foot = [t0[0] + 1, -w * 0.55];
      let s = contact(foot[0] + w * 0.12, w * 1.05);
      s += quadFoot(foot[0], w * 1.05, isFar, sauropod ? 1 : 3, sauropod);
      s += limb([wrist, foot], [w * 0.82, w * 0.98], isFar);
      s += limb([[t0[0], t0[1] - ry * 0.25], elbow, wrist], [w * 1.55, w * 1.05, w * 0.82], isFar, 0.28);
      if (feat.thumb && !isFar) s += `<path d="M${f(foot[0] + w * 0.35)},${f(-w * 1.1)} l2.5,-5 l1.2,4.6 z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".6"/>`;
      return s;
    };
    const hind = (t0, isFar) => {
      const L = -t0[1];
      const knee = [t0[0] + 3, t0[1] + L * 0.45];
      const ankle = [t0[0] - 1.5, -L * 0.18];
      const foot = [t0[0] + 0.5, -legW * 0.55];
      let s = contact(foot[0] + 0.5 + legW * 0.12, legW * 1.1);
      s += quadFoot(foot[0] + 0.5, legW * 1.1, isFar, 3, false);
      s += limb([knee, ankle, foot], [legW * 1.08, legW * 0.8, legW * 0.95], isFar);
      s += limb([[t0[0] - ry * 0.12, t0[1] - ry * 0.45], [t0[0] + 1, t0[1] + L * 0.18], knee], [ry * 1.05, ry * 0.82, legW * 1.08], isFar, 0.34);
      return s;
    };
    far.push(front([fTop[0] + 6, fTop[1] - 1.5], true), hind([bTop[0] + 6, bTop[1] - 1.5], true));
    near.push(front(fTop, false), hind(bTop, false));
  } else if (plan === 'flyer') {
    // Pterosaurio en vuelo: alas de membrana sostenidas por el cuarto dedo,
    // con propatagio delante del brazo y actinofibrillas en la membrana.
    const S = armLen;
    const hip = R(-rx * 0.5, ry * 0.35);
    const legF = (dx, isFar) => {
      const k1 = [hip[0] - 7 + dx, hip[1] + 6];
      const ft = [hip[0] - 15 + dx, hip[1] + 8];
      return limb([[hip[0] + dx, hip[1] - 2], k1, ft], [7, 3.6, 2.4], isFar) + claw(ft[0], ft[1], 2.4, 160, 0.6) + claw(ft[0] + 0.5, ft[1] + 0.5, 2.2, 140, 0.5);
    };
    // Las dos alas levantadas en "V" (batida hacia arriba); la lejana, más
    // pequeña por la perspectiva y un poco adelantada.
    const wing = (isFar) => {
      const fo = isFar ? 0.8 : 1;
      const sh = R(rx * 0.35 + (isFar ? 3 : 0), -ry * 0.7);
      const elbow = [sh[0] + S * 0.1 * fo, sh[1] - S * 0.12 * fo];
      const wrist = [sh[0] + S * 0.2 * fo, sh[1] - S * 0.28 * fo];
      const tip = [sh[0] - S * 0.28 * fo, sh[1] - S * 0.84 * fo];
      const fc = [wrist[0] + S * 0.04 * fo, sh[1] - S * 0.7 * fo];
      const att = R(-rx * 0.7, -ry * 0.55);
      const tc = [sh[0] + S * 0.02 * fo, sh[1] - S * 0.34 * fo];
      const pc = [sh[0] + S * 0.2 * fo, sh[1] - S * 0.1 * fo];
      const d = `M${pt(sh)} Q${pt(pc)} ${pt(wrist)} Q${pt(fc)} ${pt(tip)} Q${pt(tc)} ${pt(att)} Z`;
      const cls = opts.anim ? `flap${isFar ? ' flap-far' : ''}` : '';
      const st = `transform-origin:${f(sh[0])}px ${f(sh[1])}px`;
      bboxAdd(bb, [tip, wrist]);
      if (sil) return `<g class="${cls}" style="${st}"><path d="${d}" fill="${SIL}"/></g>`;
      let fibers = '';
      for (let i = 1; i < 8; i += 1) {
        const t = i / 8;
        const A = qb(wrist, fc, tip, t);
        const B = qb(tip, tc, att, 1 - t);
        fibers += `<path d="M${pt(A)} L${pt([lerp(A[0], B[0], 0.8), lerp(A[1], B[1], 0.8)])}" stroke="rgba(0,0,0,.14)" stroke-width=".55"/>`;
      }
      return `<g class="${cls}" style="${st}">`
        + `<path d="${d}" fill="${isFar ? shade : accent}" opacity=".95"/>${isFar ? '' : `<path d="${d}" fill="url(#${uid}ss)"/>`}<path d="${d}" fill="url(#${limbG})" opacity=".6"/>${fibers}`
        + `<path d="${d}" fill="none" stroke="${LN}" stroke-width="1.1" stroke-linejoin="round"/>`
        + `<path d="M${pt(sh)} L${pt(elbow)} L${pt(wrist)}" fill="none" stroke="${isFar ? shade : fill}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="M${pt(sh)} L${pt(elbow)} L${pt(wrist)}" fill="none" stroke="${LN}" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>`
        + `<path d="M${pt(wrist)} Q${pt(fc)} ${pt(tip)}" fill="none" stroke="${LN}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>`
        + `${claw(wrist[0], wrist[1], 2.6, 10, 0.6)}${claw(wrist[0] + 0.4, wrist[1] + 0.6, 2.4, 40, 0.5)}</g>`;
    };
    far.push(legF(4, true), wing(true));
    near.push(legF(0, false), wing(false));
  } else if (plan === 'swim') {
    const flipper = (p, len, isFar, a0) => {
      const tip = [p[0] - Math.cos(rad(a0)) * len, p[1] + Math.sin(rad(a0)) * len];
      return limb([p, [lerp(p[0], tip[0], 0.5), lerp(p[1], tip[1], 0.5) + 1], tip], [len * 0.28, len * 0.34, len * 0.12], isFar);
    };
    const fp = R(rx * 0.5, ry * 0.5);
    const bp = R(-rx * 0.45, ry * 0.5);
    far.push(flipper([fp[0] + 5, fp[1]], armLen + 10, true, 40), flipper([bp[0] + 5, bp[1]], legLen + 6, true, 45));
    near.push(flipper(fp, armLen + 10, false, 50), flipper(bp, legLen + 6, false, 55));
  }

  // ---------- rasgos del lomo (detrás del cuerpo) ----------
  const alongOf = (arr) => (t) => {
    // Punto entre la base de la cola (t = 0) y los hombros (t = 1).
    const pts = arr.slice(tailN - 1);
    const x = Math.max(0, Math.min(1, t)) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(x));
    const k = x - i;
    return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
  };
  const along = alongOf(dorsal);
  const alongV = alongOf(ventral);
  if (feat.sail) {
    const H = feat.sail * (1 - 0.4 * baby);
    const sp = [];
    const n = 11;
    for (let i = 0; i < n; i += 1) {
      const t = 0.1 + (i / (n - 1)) * 0.84;
      const p = along(t);
      sp.push([p[0], p[1] - H * Math.sin(Math.PI * (0.06 + t * 0.86)) ** 0.9 - 2]);
    }
    const a = along(0.04);
    const b = along(0.99);
    const d = `${smooth([[a[0], a[1] + 3], ...sp, [b[0], b[1] + 3]])} Z`;
    let spines = '';
    sp.forEach((p, i) => {
      const q = along(0.1 + (i / (n - 1)) * 0.84);
      spines += `<path d="M${f(q[0])},${f(q[1] + 2)} L${f(p[0] - 0.6)},${f(p[1] + 2)}" stroke="rgba(0,0,0,.22)" stroke-width="1.1"/><path d="M${f(q[0] + 1)},${f(q[1] + 2)} L${f(p[0] + 0.4)},${f(p[1] + 2.5)}" stroke="rgba(255,255,255,.14)" stroke-width=".8"/>`;
    });
    back.push(`<path d="${d}" fill="${accent}"/>${sil ? '' : `<path d="${d}" fill="url(#${uid}ss)"/><path d="${d}" fill="url(#${limbG})" opacity=".6"/>${spines}<path d="${d}" fill="url(#${scales})" opacity=".4"/><path d="${d}" fill="none" stroke="${LN}" stroke-width="1.3"/>`}`);
    bboxAdd(bb, sp);
  }
  if (feat.plates) {
    // Dos filas alternas, como en Stegosaurus: la del otro lado más oscura.
    for (const farRow of [true, false]) {
      for (let i = 0; i < feat.plates; i += 1) {
        const t = (i + (farRow ? 1 : 0.5)) / (feat.plates + (farRow ? 0.6 : 0));
        const p = along(-0.25 + t * 1.2);
        const size = ((feat.backSpikes ? 8 : 15) * Math.sin(Math.PI * (0.12 + t * 0.78)) + 5) * (1 - 0.35 * baby) * (farRow ? 0.88 : 1);
        const lean = (t - 0.5) * 18;
        const d = `M${f(-size * 0.5)},3 C${f(-size * 0.62)},${f(-size * 0.55)} ${f(-size * 0.25)},${f(-size * 1.15)} ${f(size * 0.05)},${f(-size * 1.25)} C${f(size * 0.42)},${f(-size * 1.05)} ${f(size * 0.62)},${f(-size * 0.42)} ${f(size * 0.5)},3 Z`;
        const grooves = sil ? '' : [-0.3, 0, 0.3].map((k) => `<path d="M${f(k * size * 0.3)},2 Q${f(k * size * 0.5)},${f(-size * 0.5)} ${f(k * size * 0.75 + size * 0.05)},${f(-size * 0.95)}" stroke="rgba(0,0,0,.2)" stroke-width=".7" fill="none"/>`).join('');
        back.push(`<g transform="translate(${f(p[0])} ${f(p[1])}) rotate(${f(lean)})"><path d="${d}" fill="${farRow ? shade : accent}"/>${sil ? '' : `${farRow ? '' : `<path d="${d}" fill="url(#${uid}ss)"/>`}<path d="${d}" fill="url(#${limbG})" opacity=".7"/>`}${grooves}<path d="${d}" fill="none" stroke="${LN}" stroke-width="1.1"/></g>`);
        bboxAdd(bb, [[p[0], p[1] - size * 1.3]]);
      }
    }
  }
  if (feat.backSpikes) {
    for (let i = 0; i < feat.backSpikes; i += 1) {
      const p = along(0.05 + (i / feat.backSpikes) * 0.35);
      const L = 16 * (1 - 0.4 * baby);
      back.push(`<path d="M${f(p[0] - 3)},${f(p[1] + 2)} Q${f(p[0] - 3.5)},${f(p[1] - L * 0.5)} ${f(p[0] - 5)},${f(p[1] - L)} Q${f(p[0] + 0.5)},${f(p[1] - L * 0.4)} ${f(p[0] + 3)},${f(p[1] + 1)} Z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".9"/>`);
      bboxAdd(bb, [[p[0], p[1] - L]]);
    }
  }
  if ((feat.scutes || feat.ridge) && !sil) {
    for (let i = 0; i < 12; i += 1) {
      const p = along(i / 11);
      bodyExtra.push(`<path d="M${f(p[0] - 2.4)},${f(p[1] + 1.2)} Q${f(p[0])},${f(p[1] - (feat.ridge ? 2.6 : 1.8))} ${f(p[0] + 2.4)},${f(p[1] + 1.2)} Z" fill="${shade}" stroke="${LN}" stroke-width=".55"/>`);
    }
  }
  if (feat.quills && !sil) {
    for (let i = 0; i < 9; i += 1) {
      const p = dorsal[Math.max(1, Math.floor(2 + i * 0.6))];
      const L = (15 - i * 1.1) * (1 - 0.4 * baby);
      back.push(`<path d="M${f(p[0])},${f(p[1] + 2)} l${f(-L * 0.28)},${f(-L)}" stroke="${LN}" stroke-width="2" stroke-linecap="round"/><path d="M${f(p[0])},${f(p[1] + 2)} l${f(-L * 0.28)},${f(-L)}" stroke="#d9cbb0" stroke-width=".9" stroke-linecap="round"/>`);
      bboxAdd(bb, [[p[0], p[1] - L]]);
    }
  }
  if (feat.neckSpines) {
    for (let row = 0; row < 2; row += 1) {
      for (let i = 0; i < 9; i += 1) {
        const t = 0.15 + i * 0.09;
        const p = nOff.dorsal[Math.min(nOff.dorsal.length - 1, Math.round(t * (nOff.dorsal.length - 1)))];
        const pb = [lerp(neckPts[0][0], ne[0], t), lerp(neckPts[0][1], ne[1], t)];
        const base = [lerp(pb[0], p[0], 0.7), lerp(pb[1], p[1], 0.7)];
        const L = (8 + 16 * Math.sin(Math.PI * (0.25 + t * 0.6))) * (1 - 0.5 * baby);
        const tipS = [base[0] - L * 0.35 + row * 3, base[1] - L];
        const line = `M${f(base[0] + row * 2)},${f(base[1])} L${pt(tipS)}`;
        (row ? topLayer : back).push(`<path d="${line}" stroke="${LN}" stroke-width="2.8" stroke-linecap="round"/><path d="${line}" stroke="${sil ? SIL : row ? '#d9cbb0' : shade}" stroke-width="1.4" stroke-linecap="round"/>`);
        bboxAdd(bb, [tipS]);
      }
    }
  }

  // ---------- plumas de la cola (abanico o fronda) ----------
  let frond = 0;
  let frondSpan = 0;
  if (feat.tailFeathers) { frond = 10; frondSpan = 0.9; } else if (feat.tailFan) { frond = 10; frondSpan = 0.4; } else if (feat.wings) { frond = 8; frondSpan = 0.55; } else if (fullFeathers) { frond = 4.5; frondSpan = 0.75; }
  if (frond) {
    const fr = frond * (1 - 0.4 * baby);
    const n = tailN;
    const F = (i) => {
      const u = i / (n - 1);
      return u > frondSpan ? 0 : fr * (1 - u / frondSpan) ** 0.6;
    };
    const pts = spine.slice(0, n);
    const o = offsets(pts, pts.map((_, i) => top[i] + F(i)), pts.map((_, i) => bot[i] + F(i) * 0.85));
    const tdx = pts[1][0] - pts[0][0];
    const tdy = pts[1][1] - pts[0][1];
    const tl = Math.hypot(tdx, tdy) || 1;
    const ext = [pts[0][0] - (tdx / tl) * fr * 0.9, pts[0][1] - (tdy / tl) * fr * 0.9];
    const d = smooth([ext, ...o.dorsal.slice(1), ...o.ventral.slice(1).reverse()], true);
    let rach = '';
    if (!sil) {
      for (let i = 1; i < n; i += 1) {
        if (F(i) < 1) continue;
        rach += `<path d="M${pt(pts[i])} L${pt(o.dorsal[i])} M${pt(pts[i])} L${pt(o.ventral[i])}" stroke="${shade}" stroke-width=".7" opacity=".55"/>`;
      }
    }
    back.push(`<path d="${d}" fill="${accent}"/>${sil ? '' : `<path d="${d}" fill="url(#${limbG})"/>${rach}<path d="${d}" fill="none" stroke="${LN}" stroke-width="1.1" stroke-linejoin="round"/>`}`);
    bboxAdd(bb, [ext, ...o.dorsal]);
  }

  // Flecos de plumas o picnofibras que rompen el contorno.
  let fringeSvg = '';
  if ((feathered || plan === 'flyer') && !sil) {
    const len = plan === 'flyer' ? 1.8 : fullFeathers ? 3.2 : 2.2;
    const dpts = [...dorsal.slice(Math.max(1, Math.round(tailN * (frond ? frondSpan * 0.6 : 0.3))), -1), ...nOff.dorsal.slice(1, -1)];
    const vpts = ventral.slice(tailN - 1, -1);
    fringeSvg = `<path d="${fringe(dpts, len, rand, 1)}" fill="${fill}" stroke="${LN}" stroke-width=".8" stroke-linejoin="round"/>`;
    if (fullFeathers) fringeSvg += `<path d="${fringe(vpts, len * 0.8, rand, -1)}" fill="${fill}" stroke="${LN}" stroke-width=".8" stroke-linejoin="round"/>`;
  }

  // ---------- volumen, textura y patrón sobre el cuerpo ----------
  let overlay = '';
  if (!sil) {
    const pat = patternLayer(col.patronId, { dorsal, ventral, nOff, tailN, rand, color: col.patron });
    // Oclusión: la cabeza proyecta sombra sobre el cuello.
    const hc = HP(head.len * 0.2, 8);
    const headCast = plan === 'flyer' ? '' : [1, 0.7, 0.45].map((k) => `<ellipse cx="${f(hc[0])}" cy="${f(hc[1])}" rx="${f(head.len * 0.34 * headS * k)}" ry="${f(4.5 * headS * k)}" fill="${lt.cool}" opacity=".16"/>`).join('');
    overlay = `<g clip-path="url(#${clipBody})">`
      + band(`${uid}V`, lt.warm, ry * 1.5, 0.22, low)
      + band(`${uid}V`, belly, ry * 1.05, feat.countershade ? 0.9 : 0.6, low)
      + band(`${uid}NV`, belly, neckW * 1.0, 0.55, low)
      + band(`${uid}D`, shade, ry * 0.9, 0.45, low)
      + band(`${uid}ND`, shade, neckW * 0.7, 0.35, low)
      + pat
      + (low ? '' : `<rect x="${f(bb.minX - 20)}" y="${f(cy - 200)}" width="${f(bb.maxX - bb.minX + 60)}" height="400" fill="url(#${scales})" opacity=".75"/>`)
      + band(`${uid}D`, col.brillo, ry * 0.4, 0.45, low)
      + band(`${uid}ND`, col.brillo, neckW * 0.35, 0.4, low)
      + band(`${uid}V`, lt.cool, ry * 0.62, 0.52, low)
      + band(`${uid}NV`, lt.cool, neckW * 0.42, 0.5, low)
      + `<use href="#${uid}V" fill="none" stroke="${lt.bounce}" stroke-width="2" opacity=".2"/>`
      + `<use href="#${uid}D" fill="none" stroke="${lt.rim}" stroke-width="2.6" opacity=".55" stroke-linecap="round"/>`
      + `<use href="#${uid}ND" fill="none" stroke="${lt.rim}" stroke-width="2.4" opacity=".5" stroke-linecap="round" mask="url(#${uid}mt)"/>`
      + headCast
      + (feat.iridescent ? `<use href="#${uid}T" fill="url(#${uid}ir)" opacity=".35"/>` : '')
      + skinFolds(R, rx, ry, nb, dir, neckW)
      + '</g>';
  }

  // ---------- cola: mazo, púas, aleta ----------
  let tailExtra = '';
  const tip = tailTip;
  if (feat.club) {
    const club = `M${f(tip[0] - 6)},${f(tip[1] - 2)} C${f(tip[0] - 7)},${f(tip[1] - 8)} ${f(tip[0] + 6)},${f(tip[1] - 9)} ${f(tip[0] + 9)},${f(tip[1] - 4)} C${f(tip[0] + 15)},${f(tip[1] - 5)} ${f(tip[0] + 16)},${f(tip[1] + 4)} ${f(tip[0] + 10)},${f(tip[1] + 5)} C${f(tip[0] + 5)},${f(tip[1] + 8)} ${f(tip[0] - 5)},${f(tip[1] + 6)} ${f(tip[0] - 6)},${f(tip[1] - 2)} Z`;
    tailExtra += `<path d="${club}" fill="${shade}"/>${sil ? '' : `<path d="${club}" fill="url(#${limbG})"/><path d="M${f(tip[0] - 3)},${f(tip[1] - 4.5)} q4,-2.5 9,-1" stroke="#fff" stroke-width="1.6" opacity=".2" fill="none" stroke-linecap="round"/><path d="M${f(tip[0] + 8.5)},${f(tip[1] - 3.5)} q-1.5,4 .5,8" stroke="${LN}" stroke-width=".7" opacity=".45" fill="none"/><path d="${club}" fill="none" stroke="${LN}" stroke-width="1.2"/>`}`;
    bboxAdd(bb, [[tip[0] - 7, tip[1] - 9]]);
  }
  if (feat.tailSpikes) {
    const b = spine[2];
    for (let i = 0; i < 2; i += 1) {
      const bx = b[0] - i * 7;
      tailExtra += `<path d="M${f(bx)},${f(b[1] - 1)} Q${f(bx - 7)},${f(b[1] - 7)} ${f(bx - 15)},${f(b[1] - 16)} Q${f(bx - 5)},${f(b[1] - 5)} ${f(bx - 2)},${f(b[1] + 1)} Z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".9" stroke-linejoin="round"/>`;
      tailExtra += `<path d="M${f(bx + 2)},${f(b[1])} Q${f(bx - 8)},${f(b[1] - 3)} ${f(bx - 17)},${f(b[1] - 6)} Q${f(bx - 7)},${f(b[1] + 1)} ${f(bx)},${f(b[1] + 3)} Z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".9" stroke-linejoin="round"/>`;
    }
    bboxAdd(bb, [[b[0] - 24, b[1] - 16]]);
  }
  if (feat.paddleTail) {
    const a = dorsal[1];
    const b = dorsal[tailN - 3];
    back.push(`<path d="M${f(b[0])},${f(b[1] + 1)} Q${f(lerp(a[0], b[0], 0.5))},${f(Math.min(a[1], b[1]) - 20)} ${f(a[0] - 2)},${f(a[1])} Z" fill="${accent}" stroke="${LN}" stroke-width="1"/>`);
  }
  if (feat.fluke) {
    tailExtra += `<path d="M${f(tip[0] + 10)},${f(tip[1])} Q${f(tip[0] - 4)},${f(tip[1] + 6)} ${f(tip[0] - 6)},${f(tip[1] + 18)} Q${f(tip[0] + 6)},${f(tip[1] + 6)} ${f(tip[0] + 14)},${f(tip[1] + 2)} Z" fill="${fill}" stroke="${LN}" stroke-width="1"/>`;
  }

  // ---------- armadura: osteodermos en bandas y púas laterales ----------
  let armor = '';
  if (feat.armor && !sil) {
    const cols = 13;
    for (let i = 0; i < cols; i += 1) {
      const t = (i + 0.5) / cols;
      const pd = along(t);
      const pv = alongV(t);
      for (let r = 0; r < 5; r += 1) {
        const depth = 0.03 + r * 0.13 + (i % 2) * 0.035;
        const x = lerp(pd[0], pv[0], depth) + (rand() - 0.5);
        const y = lerp(pd[1], pv[1], depth);
        const s = (2.6 - r * 0.3) * (0.85 + Math.sin(Math.PI * t) * 0.3);
        armor += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s)}" ry="${f(s * 0.68)}" fill="${shade}" stroke="${LN}" stroke-width=".45" opacity=".85"/><path d="M${f(x - s * 0.55)},${f(y - s * 0.1)} L${f(x + s * 0.55)},${f(y - s * 0.25)}" stroke="#fff" stroke-width=".6" opacity=".22"/>`;
      }
    }
    for (let i = 0; i < 7; i += 1) {
      const t = 0.08 + i * 0.13;
      const pd = along(t);
      const pv = alongV(t);
      const x = lerp(pd[0], pv[0], 0.72);
      const y = lerp(pd[1], pv[1], 0.72);
      const L = (3.8 + (i % 2) * 1.6) * (1 - 0.3 * baby);
      armor += `<path d="M${f(x - 2.2)},${f(y - 1)} Q${f(x - L * 0.6)},${f(y + L * 0.3)} ${f(x - L * 1.05)},${f(y + L * 0.75)} Q${f(x)},${f(y + L * 0.35)} ${f(x + 2.2)},${f(y)} Z" fill="${shade}" stroke="${LN}" stroke-width=".6"/><path d="M${f(x - 1)},${f(y - 0.3)} L${f(x - L * 0.85)},${f(y + L * 0.6)}" stroke="#fff" stroke-width=".5" opacity=".3"/>`;
    }
  }
  if (feat.shoulderSpike) {
    const s0 = R(rx * 0.4, ry * 0.05);
    armor += `<path d="M${f(s0[0] + 1)},${f(s0[1] - 2)} Q${f(s0[0] - 5)},${f(s0[1] + 4)} ${f(s0[0] - 10)},${f(s0[1] + 13)} Q${f(s0[0] - 1)},${f(s0[1] + 6)} ${f(s0[0] + 5)},${f(s0[1] + 5)} Z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".9"/>`;
  }

  // ---------- cabeza: detalles ----------
  const [ex, ey] = head.eye;
  let headBack = '';
  let headExtra = '';
  if (feat.frill) {
    const w = feat.frill.w * (1 - 0.3 * baby);
    const R0 = 19 * w;
    const fx0 = -2;
    const fy0 = -4;
    const P0 = [fx0 + 5, fy0 + 9];
    const P1 = [fx0 - R0 * 0.95, fy0 + 4];
    const P2 = [fx0 - R0 * 1.12, fy0 - R0 * 1.1];
    const P3 = [fx0 + 6, fy0 - R0 * 1.18];
    const fd = `M${pt(P0)} C${pt(P1)} ${pt(P2)} ${pt(P3)} C${f(fx0 + 9)},${f(fy0 - R0 * 0.6)} ${f(fx0 + 9)},${f(fy0 - 4)} ${pt(P0)} Z`;
    const center = [fx0 - R0 * 0.25, fy0 - R0 * 0.35];
    // Espinas largas (Styracosaurus) detrás del borde.
    for (let i = 0; i < (feat.frill.spikes || 0); i += 1) {
      const t = 0.5 + (i / Math.max(1, feat.frill.spikes - 1)) * 0.48;
      const p = cb(P0, P1, P2, P3, t);
      let dx = p[0] - center[0];
      let dy = p[1] - center[1];
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      const L = (i >= feat.frill.spikes - 4 ? 22 : 12) * (1 - 0.5 * baby);
      const tp = [p[0] + dx * L, p[1] + dy * L];
      headBack += `<path d="M${f(p[0] - dy * 2.4)},${f(p[1] + dx * 2.4)} Q${f(p[0] + dx * L * 0.6 - dy)},${f(p[1] + dy * L * 0.6 + dx)} ${pt(tp)} Q${f(p[0] + dx * L * 0.4 + dy)},${f(p[1] + dy * L * 0.4 - dx)} ${f(p[0] + dy * 2.4)},${f(p[1] - dx * 2.4)} Z" fill="url(#${keratin})" stroke="${LN}" stroke-width="${f(0.8 / headS)}" stroke-linejoin="round"/>`;
      bboxAdd(bb, [HP(tp[0], tp[1])]);
    }
    headBack += `<path d="${fd}" fill="${accent}"/>`;
    if (!sil) {
      headBack += `<path d="${fd}" fill="url(#${uid}ss)"/><path d="${fd}" fill="url(#${limbG})" opacity=".7"/><path d="${fd}" fill="url(#${scales})" opacity=".6"/><path d="M${f(fx0 + 3)},${f(fy0 + 3)} C${f(fx0 - R0 * 0.62)},${f(fy0)} ${f(fx0 - R0 * 0.78)},${f(fy0 - R0 * 0.82)} ${f(fx0 + 5)},${f(fy0 - R0 * 0.9)}" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.6"/>`;
      // Epoccipitales: pequeños huesos en el borde del volante.
      for (let i = 0; i < 9; i += 1) {
        const p = cb(P0, P1, P2, P3, 0.22 + i * 0.095);
        headBack += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(1.1 * w)}" fill="${accent}" stroke="${LN}" stroke-width=".4"/>`;
      }
    }
    headBack += `<path d="${fd}" fill="none" stroke="${LN}" stroke-width="${f(1.3 / headS)}"/>`;
    bboxAdd(bb, [HP(P2[0], P2[1]), HP(P3[0], P3[1])]);
  }
  if (feat.horns) {
    const { brow, nose } = feat.horns;
    if (brow) {
      const L = brow * (1 - 0.6 * baby);
      headExtra += `<path d="M${f(ex - 2.5)},${f(ey - 3)} Q${f(ex + L * 0.15)},${f(ey - L * 0.8)} ${f(ex + L * 0.78)},${f(ey - L * 0.88)} Q${f(ex + L * 0.12)},${f(ey - L * 0.42)} ${f(ex + 3)},${f(ey - 2)} Z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".8" stroke-linejoin="round"/>`;
      bboxAdd(bb, [HP(ex + L * 0.78, ey - L * 0.88)]);
    }
    if (nose) {
      const L = nose * (1 - 0.5 * baby);
      headExtra += `<path d="M19,-6 Q${f(19.5 + L * 0.2)},${f(-6 - L * 0.9)} ${f(22.5 + L * 0.2)},${f(-7 - L)} Q${f(22.5 + L * 0.05)},${f(-6 - L * 0.4)} 25,-3.2 Z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".8" stroke-linejoin="round"/>`;
      bboxAdd(bb, [HP(22.5 + L * 0.2, -7 - L)]);
    }
  }
  if (feat.crest === 'tube') {
    const L = 34 * (1 - 0.6 * baby);
    const d = `M5,-8.5 Q${f(-L * 0.4)},${f(-14.5 - L * 0.15)} ${f(-L)},${f(-6 - L * 0.25)}`;
    headBack += `<path d="${d}" fill="none" stroke="${LN}" stroke-width="9.6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${accent}" stroke-width="7.6" stroke-linecap="round"/>${sil ? '' : `<path d="${d}" fill="none" stroke="${ltA.glow}" stroke-width="3.4" stroke-linecap="round" opacity=".45" transform="translate(0 -1)"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".25" transform="translate(0 -1.6)"/><path d="${d}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" opacity=".15" transform="translate(0 2)"/>`}`;
    bboxAdd(bb, [HP(-L - 5, -11 - L * 0.25), HP(-L * 0.3, -20 - L * 0.1)]);
  } else if (feat.crest === 'double') {
    headExtra += `<path d="M2,-7 Q8,-21 22,-9.5 Q12,-13.5 4,-5 Z" fill="${accent}" stroke="${LN}" stroke-width=".9"/><path d="M5,-8 Q11,-20 21,-10" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>`;
    bboxAdd(bb, [HP(10, -16)]);
  } else if (feat.crest === 'casque') {
    headExtra += `<path d="M2,-10.5 C2,-21 13,-21.5 13,-10 Z" fill="${accent}" stroke="${LN}" stroke-width=".9"/>`;
    bboxAdd(bb, [HP(7, -19)]);
  } else if (feat.crest === 'comb') {
    headExtra += `<path d="M-1,-10.5 q2,-5.5 5,-1 q2,-5.5 5,-1 q2,-5 5,0" fill="${accent}" stroke="${LN}" stroke-width=".8"/>`;
  } else if (feat.crest === 'ptero') {
    headBack += `<path d="M2,-4 C-8,-10 -22,-15 -30,-16 C-26,-12 -18,-6 -2,1 Z" fill="${accent}" stroke="${LN}" stroke-width="${f(1.1 / headS)}" stroke-linejoin="round"/>`;
    bboxAdd(bb, [HP(-30, -16)]);
  }
  if (feat.browCrest) headExtra += `<path d="M${ex - 4},${ey - 3.2} l3,-4.6 l4,3.8 z" fill="${shade}" stroke="${LN}" stroke-width=".7"/>`;
  if (feat.bullHorns) headExtra += `<path d="M${ex - 1.5},${ey - 3.4} q-2,-9.5 6,-11.6 q-3,5 -1,10.2 z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".8"/>`;
  if (feat.nasalArch) headExtra += `<path d="M2,-8.6 q4.4,-7.6 10.4,-1" fill="${fill}" stroke="${LN}" stroke-width=".9"/>`;
  if (feat.knobs) for (let i = 0; i < 6; i += 1) headExtra += `<circle cx="${f(-3 + i * 3.6)}" cy="${f(-4 - Math.sin((i / 5) * Math.PI) * 4.5)}" r="1.4" fill="${shade}" stroke="${LN}" stroke-width=".5"/>`;
  if (feat.armor) headExtra += `<path d="M-6.5,-5.6 l-5,-4.2 l3,6 z M-6.5,3.6 l-6,2 l5,2 z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".6"/>`;
  if (feat.cheekHorn) headExtra += `<path d="M${ex - 2},${ey + 5} l-6,4 l7,-1 z" fill="url(#${keratin})" stroke="${LN}" stroke-width=".6"/>`;
  if (feat.mask && !sil) headExtra += `<path d="M${ex - 6},${ey - 2.6} Q${ex},${ey - 4.6} ${ex + 9},${ey - 1} L${ex + 9},${ey + 2.4} Q${ex},${ey + 1.4} ${ex - 6},${ey + 2.6} Z" fill="${col.patron}" opacity=".7"/>`;
  if (look.head.type === 'dome' && !sil) headExtra += '<path d="M-2,-9 C-1,-16.5 11,-17.5 14.5,-9" fill="none" stroke="#fff" stroke-width="2" opacity=".2"/>';
  if (look.head.type === 'boxy' && !sil) headExtra += `<path d="M${ex - 2},${ey - 3.4} q3,-3.2 6.5,-1" fill="${shade}" stroke="${LN}" stroke-width=".7"/>`;

  const sleeping = !!opts.sleeping;
  const mood = opts.mood || '';
  const eyeR = (feat.armor ? 1.5 : 1.75) * (1 + 0.55 * baby);
  const iris = col.ojo === '#1f1a14' ? `hsl(${35 + ((g.hue2 || 0) % 25)} 70% 42%)` : col.ojo;
  let eye = '';
  if (!sil) {
    const socket = `<ellipse cx="${f(ex)}" cy="${f(ey + 0.3)}" rx="${f(eyeR * 1.75)}" ry="${f(eyeR * 1.4)}" fill="${lt.cool}" opacity=".35"/><ellipse cx="${f(ex)}" cy="${f(ey + 0.1)}" rx="${f(eyeR * 1.3)}" ry="${f(eyeR * 1.15)}" fill="${shade}" opacity=".8"/>`;
    const brow = head.brow ? `<path d="M${f(ex - eyeR * 1.7)},${f(ey - eyeR * 0.9)} Q${f(ex)},${f(ey - eyeR * 2.1)} ${f(ex + eyeR * 1.9)},${f(ey - eyeR * 1.1)}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="${f(1.3 + eyeR * 0.2)}" stroke-linecap="round"/>` : '';
    if (sleeping) {
      eye = `${socket}<path d="M${f(ex - eyeR)},${f(ey)} q${f(eyeR)},${f(eyeR * 0.7)} ${f(eyeR * 2)},0" fill="none" stroke="${LN}" stroke-width="1" stroke-linecap="round"/>${brow}`;
    } else {
      const lid = mood === 'radiante' ? 0.55 : mood === 'cansado' ? 0.65 : mood === 'triste' ? 0.35 : 0;
      const ly = f(ey - eyeR * (1 - lid * 2));
      eye = `${socket}<g class="${opts.anim ? 'blink' : ''}" style="transform-origin:${f(ex)}px ${f(ey)}px${opts.anim ? `;animation-delay:${f(-rand() * 5)}s` : ''}">`
        + `<circle cx="${f(ex)}" cy="${f(ey)}" r="${f(eyeR)}" fill="${iris}"/><circle cx="${f(ex)}" cy="${f(ey)}" r="${f(eyeR)}" fill="url(#${uid}ey)" stroke="${LN}" stroke-width=".7"/>`
        + `<circle cx="${f(ex + eyeR * 0.15)}" cy="${f(ey + (mood === 'triste' ? 0.3 : 0))}" r="${f(eyeR * 0.5)}" fill="#120d08"/>`
        + `<circle cx="${f(ex + eyeR * 0.42)}" cy="${f(ey - eyeR * 0.38)}" r="${f(eyeR * 0.24)}" fill="#fff" opacity=".9"/>`
        + (lid ? `<path d="M${f(ex - eyeR - 0.3)},${ly} A${f(eyeR + 0.3)},${f(eyeR + 0.3)} 0 0 1 ${f(ex + eyeR + 0.3)},${ly} Z" fill="${fill}" stroke="${LN}" stroke-width=".6"/>` : '')
        + `</g>${brow}`;
    }
  }
  const open = mood === 'hambre' && !sil && !sleeping;
  const mouth = sil ? '' : `<path d="${head.jaw}" fill="none" stroke="${LN}" stroke-width="${open ? 1.4 : 0.9}" stroke-linecap="round" opacity=".75"/>`;
  const nose = sil ? '' : `<ellipse cx="${head.nose[0]}" cy="${head.nose[1]}" rx="1.3" ry=".75" fill="rgba(20,14,8,.7)" transform="rotate(-12 ${head.nose[0]} ${head.nose[1]})"/>`;
  // Volumen de la cabeza: mejilla y músculo de la mandíbula, fenestra
  // anteorbital en los terópodos, ranfoteca (pico) más oscura.
  const theropod = head.kind === 'theropod';
  const headShade = sil ? '' : `<g clip-path="url(#${clipHead})"><g transform="${headT}">`
    + `<path d="M-10,8 C5,10 20,8 ${head.len + 4},2" fill="none" stroke="${lt.cool}" stroke-width="7" opacity=".42"/>`
    + `<path d="M-10,4 C5,6 20,5 ${head.len + 4},0" fill="none" stroke="${lt.warm}" stroke-width="3" opacity=".18"/>`
    + `<path d="M-10,${head.top + 1} C2,${head.top - 1} 18,${head.top + 3} ${head.len},-2" fill="none" stroke="${lt.rim}" stroke-width="2.6" opacity=".5"/>`
    + `<ellipse cx="${f(ex - 4)}" cy="${f(ey + 6)}" rx="${f(head.len * 0.16)}" ry="3.2" fill="${lt.cool}" opacity=".22"/>`
    + (theropod ? `<ellipse cx="${f(ex + head.len * 0.24)}" cy="${f(ey + 2.4)}" rx="${f(head.len * 0.13)}" ry="${f(head.len * 0.05)}" fill="${lt.cool}" opacity=".25"/>` : '')
    + (head.bill || head.beak ? `<path d="M${f(head.len * 0.62)},-14 L${head.len + 6},-14 L${head.len + 6},14 L${f(head.len * 0.58)},14 Z" fill="${head.bill ? 'rgba(60,45,30,.25)' : 'rgba(40,30,20,.3)'}"/>` : '')
    + (low ? '' : `<rect x="-12" y="-24" width="${head.len + 20}" height="40" fill="url(#${scales})" transform="scale(${f(1 / headS)})" opacity=".8"/>`)
    + '</g></g>';
  const acc = !sil && opts.accesorio && ACCESSORIES[opts.accesorio] ? ACCESSORIES[opts.accesorio].svg(ex, ey, head.top || -12) : '';
  // Nivel de detalle de la animación: 'lite' (parque, muchos a la vez) solo
  // respira y parpadea; el retrato grande también mueve la cabeza.
  const bobCls = opts.anim && opts.anim !== 'lite' ? 'head-bob' : '';
  // Cada dinosaurio mueve la cabeza a su ritmo (retraso según su semilla).
  const bobStyle = `transform-origin:${f(ne[0])}px ${f(ne[1])}px${opts.anim ? `;animation-delay:${f(-rand() * 7)}s` : ''}`;
  // Contorno de la cabeza: sin volante ni cresta detrás, va en la capa de
  // trazos de abajo y el cuello tapa la unión; con ellos, se dibuja encima.
  const headLine = (w) => `<path d="${head.d}" transform="${headT}" fill="none" stroke="${LN}" stroke-width="${f(w / headS)}" stroke-linejoin="round"/>`;
  const headOnTop = !!headBack;
  const headOutline = sil || !headOnTop ? '' : headLine(1.5);
  const headUnder = sil || headOnTop ? '' : `<g class="${bobCls}" style="${bobStyle}">${headLine(3)}</g>`;
  const headGroup = `<g class="${bobCls}" style="${bobStyle}">`
    + `<g transform="${headT}">${headBack}<path d="${head.d}" fill="${fill}"/></g>${headShade}${headOutline}`
    + `<g transform="${headT}">${mouth}${nose}${headExtra}${eye}${acc}</g></g>`;
  if (acc) bboxAdd(bb, [HP(ex, (head.top || -12) - 16)]);

  // ---------- montaje ----------
  // Un solo contorno para cola + cuerpo + cuello: primero los trazos (anchos,
  // en el color de línea) y encima los rellenos, que tapan la mitad interior
  // de cada trazo y la unión entre piezas.
  // La respiración y la flotación mueven el SVG entero (lo anima la GPU sin
  // volver a pintar): animar por dentro grupos con recortes y degradados
  // obligaba a repintar todo en cada fotograma.
  const underlay = sil ? '' : `<g><use href="#${uid}T" fill="none" stroke="${LN}" stroke-width="3" stroke-linejoin="round"/></g>`
    + `<use href="#${uid}N" fill="none" stroke="${LN}" stroke-width="3" stroke-linejoin="round"/>${headUnder}`;
  const figure = far.join('') + back.join('') + underlay + fringeSvg
    + (sil ? `<path d="${neckD}" fill="${fill}"/>` : `<use href="#${uid}N" fill="${fill}"/>`)
    + `<g>${sil ? `<path d="${torsoD}" fill="${fill}"/>` : `<use href="#${uid}T" fill="${fill}"/>`}${overlay}${bodyExtra.join('')}${armor}${tailExtra}</g>`
    + near.join('') + headGroup + topLayer.join('');

  // ---------- encaje en el viewBox ----------
  const minY = Math.min(bb.minY, -10) - 4;
  const minX = bb.minX - 6;
  const maxX = bb.maxX + 6;
  const scale = Math.min(236 / (maxX - minX), 150 / -minY, 2.2);
  const tx = (240 - (maxX - minX) * scale) / 2 - minX * scale;
  const ty = 152;
  const shadow = opts.noShadow ? '' : `<ellipse cx="${f((minX + maxX) / 2 + rx * 0.05)}" cy="1" rx="${f((maxX - minX) * 0.34)}" ry="4.5" fill="#000" opacity=".16"/>`;
  const floats = plan === 'flyer' || plan === 'swim';
  const rootCls = opts.anim && !sleeping ? (floats ? ' is-float' : ' is-anim') : '';
  const zzz = sleeping ? `<text x="${f(ne[0] + 10)}" y="${f(minY + 12)}" class="zzz" font-size="14" fill="${LN}">z z</text>` : '';
  const label = opts.title ? `<title>${opts.title}</title>` : '';
  return `<svg class="dino-svg${sil ? ' is-silhouette' : ''}${rootCls}" viewBox="0 0 240 160" role="img" aria-label="${opts.title || species.nombre}" xmlns="http://www.w3.org/2000/svg">${label}${defs}`
    + `<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(scale)})">${shadow}<g>${figure}</g>${zzz}</g></svg>`;
}

/** Pliegues de piel en cuello, hombro y cadera. */
function skinFolds(R, rx, ry, nb, dir, neckW) {
  let s = '';
  const folds = [[rx * 0.55, -ry * 0.2, ry * 0.6], [-rx * 0.4, ry * 0.1, ry * 0.5]];
  for (const [x, y, h] of folds) {
    const a = R(x, y - h * 0.5);
    const b = R(x - 2, y + h * 0.5);
    s += `<path d="M${pt(a)} Q${f(a[0] - 3)},${f((a[1] + b[1]) / 2)} ${pt(b)}" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="1.2"/>`;
  }
  for (let i = 1; i <= 3; i += 1) {
    const p = [nb[0] + dir[0] * i * 4, nb[1] + dir[1] * i * 4];
    s += `<path d="M${f(p[0] - 1)},${f(p[1] + neckW * 0.2)} q2,${f(neckW * 0.3)} 0,${f(neckW * 0.6)}" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="1"/>`;
  }
  return s;
}

/** Patrón de los genes, siguiendo la curvatura del cuerpo. */
function patternLayer(type, { dorsal, ventral, nOff, tailN, rand, color }) {
  if (type === 'liso') return '';
  const op = 'opacity=".5"';
  let s = '';
  const pts = [...dorsal.map((p, i) => [p, ventral[i]]), ...nOff.dorsal.map((p, i) => [p, nOff.ventral[i]])];
  if (type === 'rayas') {
    for (let i = 1; i < pts.length - 1; i += 1) {
      const [d0, v0] = pts[i];
      const [d1] = pts[i + 1];
      const depth = 0.55 + (i % 2) * 0.12;
      const m = [lerp(d0[0], v0[0], depth), lerp(d0[1], v0[1], depth)];
      const w = Math.max(1.2, Math.hypot(d1[0] - d0[0], d1[1] - d0[1]) * 0.32);
      s += `<path d="M${f(d0[0] - w)},${f(d0[1] - 2)} Q${f(m[0] + 1)},${f((d0[1] + m[1]) / 2)} ${pt(m)} Q${f(m[0] + 2)},${f((d0[1] + m[1]) / 2)} ${f(d0[0] + w)},${f(d0[1] - 2)} Z" fill="${color}" ${op}/>`;
    }
  } else if (type === 'manchas') {
    for (let i = 1; i < pts.length; i += 1) {
      const [d0, v0] = pts[i];
      for (let k = 0; k < 2; k += 1) {
        const t = 0.15 + rand() * 0.4;
        s += `<ellipse cx="${f(lerp(d0[0], v0[0], t) + (rand() - 0.5) * 4)}" cy="${f(lerp(d0[1], v0[1], t))}" rx="${f(1.6 + rand() * 2.4)}" ry="${f(1.2 + rand() * 1.6)}" fill="${color}" ${op}/>`;
      }
    }
  } else if (type === 'bandas') {
    for (let i = 1; i < tailN; i += 2) {
      const [d0, v0] = pts[i];
      const [d1, v1] = pts[i + 1];
      s += `<path d="M${f(d0[0])},${f(d0[1] - 2)} L${f(d1[0])},${f(d1[1] - 2)} L${f(v1[0])},${f(v1[1] + 2)} L${f(v0[0])},${f(v0[1] + 2)} Z" fill="${color}" opacity=".6"/>`;
    }
    for (let i = tailN + 1; i < pts.length - 1; i += 2) {
      const [d0, v0] = pts[i];
      s += `<path d="M${f(d0[0] - 2)},${f(d0[1] - 2)} L${f(d0[0] + 2)},${f(d0[1] - 2)} L${f(lerp(d0[0], v0[0], 0.5) + 1)},${f(lerp(d0[1], v0[1], 0.5))} Z" fill="${color}" ${op}/>`;
    }
  } else if (type === 'moteado') {
    for (let i = 0; i < pts.length; i += 1) {
      const [d0, v0] = pts[i];
      for (let k = 0; k < 4; k += 1) {
        const t = rand() * 0.7;
        s += `<circle cx="${f(lerp(d0[0], v0[0], t) + (rand() - 0.5) * 5)}" cy="${f(lerp(d0[1], v0[1], t))}" r="${f(0.5 + rand() * 0.8)}" fill="${color}" opacity=".55"/>`;
      }
    }
  }
  return s;
}

export function defaultGenes(species) {
  const [h1, h2] = species.look.colors;
  return {
    seed: species.id.length * 977,
    sexo: 'M', hue1: h1, hue2: h2, sat: 40, luz: 44,
    patron: [(species.look.feat && (species.look.feat.pattern || (species.look.feat.stripes && 'rayas'))) || 'liso', 'liso'],
    variante: ['N', 'N'], stats: { ...species.stats }, mutaciones: 0, generacion: 1,
  };
}

/** Huevo: forma, color base de la especie, manchas y brillo. */
export function eggSVG(species, genes, opts = {}) {
  const hue = genes ? genes.hue1 : species.look.colors[0];
  const crack = opts.crack || 0; // 0..1
  const rand = rng((genes && genes.seed) || species.id.length * 31);
  const id = `e${(uidCounter += 1)}`;
  let spots = '';
  for (let i = 0; i < 9; i += 1) spots += `<ellipse cx="${f(32 + rand() * 36)}" cy="${f(28 + rand() * 54)}" rx="${f(1.6 + rand() * 3.6)}" ry="${f(1.2 + rand() * 2.6)}" fill="hsl(${hue} 30% 38%)" opacity=".45"/>`;
  const cracks = crack > 0.3 ? `<path d="M36,48 l8,6 l6,-7 l7,8 l6,-6 l7,5" fill="none" stroke="#2d2a24" stroke-width="1.6" stroke-linejoin="round" opacity="${f(Math.min(1, crack))}"/>` : '';
  const elong = species.tamano === 'gigante' ? 0.92 : species.tamano === 'pequeno' ? 1.08 : 1;
  const d = `M50,${f(10 * elong)} C72,${f(10 * elong)} 80,52 78,66 C76,82 64,92 50,92 C36,92 24,82 22,66 C20,52 28,${f(10 * elong)} 50,${f(10 * elong)} Z`;
  return `<svg class="egg-svg${opts.wobble ? ' wobble' : ''}" viewBox="0 0 100 100" role="img" aria-label="Huevo de ${species.nombre}">`
    + `<defs><radialGradient id="${id}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="hsl(${hue} 30% 94%)"/><stop offset=".7" stop-color="hsl(${hue} 22% 80%)"/><stop offset="1" stop-color="hsl(${hue} 20% 62%)"/></radialGradient></defs>`
    + '<ellipse cx="50" cy="93" rx="26" ry="4" fill="#000" opacity=".14"/>'
    + `<path d="${d}" fill="url(#${id})" stroke="rgba(30,24,18,.75)" stroke-width="1.6"/>`
    + `${spots}<path d="M35,30 q6,-9 15,-11" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".55" fill="none"/>${cracks}</svg>`;
}

/** Silueta humana de 1,7 m para comparar tamaños. */
export function humanPath(x, ground, h) {
  const s = h / 170;
  return `<g transform="translate(${f(x)} ${f(ground)}) scale(${f(s)})" fill="#2d2a24">`
    + '<circle cx="0" cy="-158" r="12"/><path d="M-14,-142 h28 l6,62 h-10 l-3,-44 h-2 l-2,124 h-12 l-2,-80 h-2 l-2,80 h-12 l-2,-124 h-2 l-3,44 h-10 z"/></g>';
}
