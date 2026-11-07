// Ilustración paramétrica de dinosaurios en SVG.
//
// Cada especie trae un objeto `look` con proporciones y rasgos (velas, placas,
// cuernos, crestas…). Los colores y patrones salen de los genes del individuo.
// Se dibuja en coordenadas locales con el suelo en y = 0 (arriba es negativo) y
// al final se encaja todo en el viewBox.

import { phenotype, rng } from '../systems/genetics.js';
import { ACCESSORIES } from '../data/cosmetics.js';

const INK = '#2d2a24';
const CLAW = '#f1e7d0';
const SW = 2.4; // grosor de contorno
let uidCounter = 0;

const f = (n) => Math.round(n * 10) / 10;
const rad = (d) => (d * Math.PI) / 180;

function limb(points, width, color, extra = '') {
  const d = `M${points.map((p) => `${f(p[0])},${f(p[1])}`).join(' L')}`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(width + SW * 2)}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
    + `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(width)}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
}

function blobPath(rx, ry, belly = 1) {
  return `M${-rx},0 C${-rx},${f(-ry * 0.95)} ${f(-rx * 0.35)},${-ry} 0,${-ry} `
    + `C${f(rx * 0.55)},${-ry} ${rx},${f(-ry * 0.6)} ${rx},0 `
    + `C${rx},${f(ry * 0.65 * belly)} ${f(rx * 0.4)},${f(ry * belly)} 0,${f(ry * belly)} `
    + `C${f(-rx * 0.55)},${f(ry * belly)} ${-rx},${f(ry * 0.6)} ${-rx},0 Z`;
}

// Cabezas: origen en la unión con el cuello, mirando a +x. Devuelve el path,
// la posición del ojo y el largo aproximado.
const HEADS = {
  boxy: { d: 'M-5,-7 C2,-14 20,-14 30,-8 L33,-1 C32,5 22,8 10,8 C1,8 -5,6 -7,2 Z', eye: [9, -6], len: 33, mouth: 'M12,2 L31,0', top: -14 },
  slim: { d: 'M-4,-6 C4,-10 16,-9 27,-3 C30,-1 29,2 25,3 L4,5 C-2,5 -6,2 -4,-6 Z', eye: [7, -4], len: 29, mouth: 'M10,2 L26,1', top: -10 },
  croc: { d: 'M-5,-7 C3,-11 10,-8 16,-5 L37,-2 C40,-1 40,2 37,3 L6,6 C-2,6 -7,2 -5,-7 Z', eye: [6, -6], len: 40, mouth: 'M12,3 L37,1', top: -11 },
  small: { d: 'M-4,-5 C1,-10 12,-9 16,-3 C17,1 13,4 8,4 L0,4 C-4,3 -6,0 -4,-5 Z', eye: [6, -4], len: 17, mouth: 'M8,2 L15,1', top: -10 },
  duck: { d: 'M-5,-7 C3,-12 13,-9 19,-4 C25,-3 29,-1 28,3 C22,6 14,5 6,6 C-2,6 -6,2 -5,-7 Z', eye: [6, -5], len: 29, mouth: 'M16,3 L27,2', top: -12 },
  beak: { d: 'M-4,-5 C2,-10 11,-8 19,-1 C14,2 8,4 2,4 C-3,3 -6,0 -4,-5 Z', eye: [5, -4], len: 19, mouth: 'M9,1 L18,-1', top: -10 },
  parrot: { d: 'M-5,-6 C1,-13 12,-12 15,-4 C17,0 15,6 10,7 C7,4 1,5 -3,3 Z', eye: [5, -5], len: 17, mouth: 'M9,3 L14,2', top: -13 },
  horned: { d: 'M-7,-8 C3,-13 15,-11 22,-5 L29,0 C27,5 20,8 11,8 C1,9 -7,5 -7,-8 Z', eye: [7, -5], len: 29, mouth: 'M18,4 L27,1', top: -13 },
  armored: { d: 'M-7,-6 C1,-11 15,-10 20,-4 C23,1 19,6 12,6 L-2,6 C-8,5 -9,0 -7,-6 Z', eye: [6, -3], len: 23, mouth: 'M12,3 L20,2', top: -11 },
  dome: { d: 'M-5,-4 C-6,-17 13,-19 16,-6 C20,-3 21,1 18,3 C12,5 4,6 -2,5 C-6,3 -7,0 -5,-4 Z', eye: [9, -3], len: 21, mouth: 'M11,3 L18,2', top: -19 },
  short: { d: 'M-5,-8 C3,-14 16,-12 22,-5 L23,2 C18,7 8,8 2,7 C-4,6 -7,0 -5,-8 Z', eye: [8, -6], len: 23, mouth: 'M8,4 L22,1', top: -14 },
  ptero: { d: 'M-4,-4 C2,-7 12,-5 38,0 C12,3 2,4 -4,3 Z', eye: [4, -2], len: 38, mouth: 'M8,1 L36,0', top: -7 },
};

/**
 * Devuelve el SVG de un dinosaurio.
 * @param {object} species  especie de species.js
 * @param {object} genes    genes del individuo (o null para el aspecto base)
 * @param {object} opts     { stage: 'cria'|'juvenil'|'adulto', anim: bool, silhouette: bool, sleeping: bool,
 *                           mood: 'feliz'|'radiante'|'triste'|'hambre'|'cansado', accesorio: id }
 */
export function dinoSVG(species, genes, opts = {}) {
  const stage = opts.stage || 'adulto';
  const look = species.look;
  const feat = look.feat || {};
  const uid = `d${(uidCounter += 1)}`;
  const g = genes || defaultGenes(species);
  const col = phenotype(g);
  const silhouette = !!opts.silhouette;
  const fill = silhouette ? '#3b3a35' : col.piel;
  const belly = silhouette ? '#3b3a35' : col.vientre;
  const shade = silhouette ? '#2b2a26' : col.sombra;
  const accent = silhouette ? '#3b3a35' : col.acento;
  const rand = rng(g.seed || 7);
  // Degradado suave de arriba (luz) hacia abajo (sombra), al estilo de Alba.
  const bodyFill = silhouette ? fill : `url(#${uid}b)`;

  // Proporciones de cría: cabeza y ojos más grandes, cuerpo más corto.
  const baby = stage === 'cria' ? 1 : stage === 'juvenil' ? 0.5 : 0;
  const headS = (look.head.s || 1) * 1.1 * (1 + 0.45 * baby);
  const [rx0, ry0] = look.body;
  const rx = rx0 * (1 - 0.12 * baby);
  const ry = ry0 * (1 - 0.05 * baby);
  const neckLen = look.neck[0] * (1 - 0.3 * baby);
  const neckAng = look.neck[1];
  const neckW = look.neck[2];
  const tailLen = look.tail[0] * (1 - 0.3 * baby);
  const tailW = look.tail[1];
  const legLen = look.leg[0] * (1 - 0.12 * baby);
  const legW = look.leg[1];
  const armLen = (look.arm ? look.arm[0] : 0) * (1 - 0.1 * baby);

  const plan = look.plan;
  const layers = { back: [], body: [], front: [], top: [] };

  // ---------- Postura del torso ----------
  let cx = 0;
  let cy;
  let tilt = 0; // grados, positivo = el frente sube
  if (plan === 'biped') {
    cy = -(legLen * 0.98 + ry * 0.36);
    tilt = feat.lowStance ? 2 : 6 + (neckAng > 45 ? 6 : 0);
    if (feat.potBelly) tilt = 22;
  } else if (plan === 'quad' || plan === 'semi') {
    const front = plan === 'semi' ? Math.max(armLen, legLen * 0.62) : legLen * (feat.frontHigh ? 1.35 : feat.hindHigh ? 0.72 : 1);
    const hind = legLen * (feat.hindHigh ? 1.15 : 1);
    cy = -((front + hind) / 2 + ry * 0.35);
    tilt = (Math.atan2(front - hind, rx * 1.1) * 180) / Math.PI;
  } else if (plan === 'flyer') {
    cy = -54;
    tilt = 6;
  } else { // swim
    cy = -52;
    tilt = 0;
  }

  const cosT = Math.cos(rad(-tilt));
  const sinT = Math.sin(rad(-tilt));
  // Punto del torso (coordenadas locales del torso) -> coordenadas del mundo.
  const R = (px, py) => [cx + px * cosT - py * sinT, cy + px * sinT + py * cosT];
  const torsoT = `translate(${f(cx)} ${f(cy)}) rotate(${f(-tilt)})`;

  // ---------- Cola ----------
  const tb = [-rx * 0.82, ry * 0.05];
  let droop = plan === 'biped' ? -ry * 0.1 : ry * 0.45;
  if (plan === 'swim') droop = 0;
  if (plan === 'flyer') droop = 2;
  const tip = [tb[0] - tailLen, tb[1] + droop + (plan === 'quad' ? tailLen * 0.12 : 0)];
  const tTop = [tb[0] + 6, tb[1] - tailW * 0.75];
  const tBot = [tb[0] + 8, tb[1] + tailW * 0.8];
  const tailPath = `M${f(tTop[0])},${f(tTop[1])} Q${f(tb[0] - tailLen * 0.5)},${f(tTop[1] + droop * 0.15)} ${f(tip[0])},${f(tip[1])} `
    + `Q${f(tb[0] - tailLen * 0.42)},${f(tBot[1] + droop * 0.7)} ${f(tBot[0])},${f(tBot[1])} Z`;

  // ---------- Cuello y cabeza ----------
  const nb = plan === 'flyer' ? [rx * 0.8, -ry * 0.1] : [rx * 0.72, -ry * 0.28];
  const nbW = R(nb[0], nb[1]);
  const ang = rad(neckAng);
  const ne = [nbW[0] + Math.cos(ang) * neckLen, nbW[1] - Math.sin(ang) * neckLen];
  const head = HEADS[look.head.type] || HEADS.slim;
  const headAngle = plan === 'flyer' ? -4 : Math.min(neckAng * 0.35, 18) - 6;
  const headT = `translate(${f(ne[0])} ${f(ne[1])}) rotate(${f(-headAngle)}) scale(${f(headS)})`;

  // ---------- Patas ----------
  const legFar = silhouette ? fill : shade;
  if (plan === 'biped') {
    const hip = R(-rx * 0.12, ry * 0.15);
    const hipFar = [hip[0] + 7, hip[1] - 2];
    const leg = (h, color, front) => {
      const L = -h[1];
      const knee = [h[0] + L * 0.2, h[1] + L * 0.48];
      const ankle = [h[0] + L * 0.02, -L * 0.17];
      const toe = [ankle[0] + L * 0.3, -2];
      const thighW = Math.max(legW * 1.3, ry * 0.45);
      let s = limb([knee, ankle, toe], legW * 0.62, color);
      if (!silhouette) s += `<path d="M${f(toe[0] + legW * 0.3)},${f(-3.5)} l4,2.5 l-4,1 z M${f(toe[0] - 1)},${f(-2.5)} l3.5,2.2 l-3.5,.8 z" fill="${CLAW}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
      s += `<ellipse cx="${f(h[0] + L * 0.08)}" cy="${f(h[1] + L * 0.2)}" rx="${f(thighW)}" ry="${f(L * 0.32)}" transform="rotate(-24 ${f(h[0] + L * 0.08)} ${f(h[1] + L * 0.2)})" fill="${color}" stroke="${INK}" stroke-width="${SW}"/>`;
      if (feat.sickle && front) s += `<path d="M${f(toe[0] - L * 0.12)},${f(-3)} q1,-8 -5,-9" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
      return s;
    };
    layers.back.push(leg(hipFar, legFar, false));
    layers.front.push(leg(hip, fill, true));
    if (armLen > 0) {
      const sh = R(rx * 0.58, ry * 0.12);
      const a = armLen;
      const shFar = [sh[0] + 4, sh[1] - 2];
      const arm = (s0, color, near) => {
        const elbow = [s0[0] + a * 0.25, s0[1] + a * 0.55];
        const hand = [s0[0] + a * 0.7, s0[1] + a * 0.55];
        let out = limb([s0, elbow, hand], Math.max(3, legW * 0.42), color);
        if (feat.bigClaws && near) out += `<path d="M${f(hand[0])},${f(hand[1])} q${f(a * 0.35)},2 ${f(a * 0.3)},${f(a * 0.42)} M${f(hand[0])},${f(hand[1] - 1)} q${f(a * 0.4)},-1 ${f(a * 0.42)},${f(a * 0.3)}" fill="none" stroke="#efe6d2" stroke-width="2.6" stroke-linecap="round"/>`;
        else if (near) out += `<path d="M${f(hand[0])},${f(hand[1])} l3,3 M${f(hand[0])},${f(hand[1])} l4,0" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
        if (feat.thumb && near) out += `<path d="M${f(hand[0] - 1)},${f(hand[1] - 2)} l2,-6 l2,5 z" fill="#efe6d2" stroke="${INK}" stroke-width="1.4"/>`;
        if ((feat.feathers === 'full' || feat.wings) && near && !silhouette) {
          const n = feat.wings ? 6 : 4;
          const len = feat.wings ? a * 0.9 : a * 0.5;
          let fan = '';
          for (let i = 0; i < n; i += 1) {
            const t = i / (n - 1);
            const px = s0[0] + (hand[0] - s0[0]) * t;
            const py = s0[1] + (hand[1] - s0[1]) * t + 2;
            fan += `<path d="M${f(px)},${f(py)} q${f(-len * 0.3)},${f(len * 0.5)} ${f(-len * 0.55)},${f(len * 0.85)} q${f(len * 0.35)},${f(-len * 0.25)} ${f(len * 0.5)},${f(-len * 0.75)}" fill="${accent}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
          }
          out = fan + out;
        }
        return out;
      };
      layers.back.push(arm(shFar, legFar, false));
      layers.top.push(arm(sh, fill, true));
    }
  } else if (plan === 'quad' || plan === 'semi') {
    const fx = rx * 0.55;
    const bx = -rx * 0.5;
    const fTop = R(fx, ry * 0.35);
    const bTop = R(bx, ry * 0.3);
    const column = (top, w, color, thigh) => {
      const L = -top[1];
      const knee = [top[0] + (thigh ? 4 : -2), top[1] + L * 0.5];
      const foot = [top[0] + (thigh ? -1 : 1), -w * 0.25];
      let s = limb([top, knee, foot], w, color);
      s += `<path d="M${f(foot[0] - w * 0.55)},${f(-1)} h${f(w * 1.25)}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
      if (!silhouette && color === fill) for (let k = 0; k < 3; k += 1) s += `<ellipse cx="${f(foot[0] - w * 0.25 + k * w * 0.32)}" cy="${f(-2.4)}" rx="${f(Math.max(1.2, w * 0.13))}" ry="1.4" fill="${CLAW}" stroke="${INK}" stroke-width=".8"/>`;
      if (thigh) s += `<ellipse cx="${f(top[0])}" cy="${f(top[1] + L * 0.12)}" rx="${f(w * 0.95)}" ry="${f(L * 0.3)}" fill="${color}" stroke="${INK}" stroke-width="${SW}"/>`;
      return s;
    };
    const frontW = plan === 'semi' ? legW * 0.55 : legW;
    layers.back.push(column([fTop[0] + 6, fTop[1] - 2], frontW, legFar, false));
    layers.back.push(column([bTop[0] + 6, bTop[1] - 2], legW, legFar, true));
    layers.front.push(column(fTop, frontW, fill, false));
    layers.front.push(column(bTop, legW, fill, true));
    if (feat.thumb) layers.front.push(`<path d="M${f(fTop[0] + 2)},${f(-6)} l3,-7 l2,6 z" fill="#efe6d2" stroke="${INK}" stroke-width="1.4"/>`);
  } else if (plan === 'flyer') {
    // Alas de membrana sostenidas por el cuarto dedo.
    const sh = R(rx * 0.35, -ry * 0.35);
    const span = armLen;
    const wing = (color, cls, up) => {
      const k = up ? -1 : 1;
      const wr = [sh[0] + span * 0.1, sh[1] + k * span * 0.4];
      const tp = [sh[0] - span * 0.62, sh[1] + k * span * 0.5];
      const hp = R(-rx * 0.6, ry * 0.2);
      return `<g class="${cls}" style="transform-origin:${f(sh[0])}px ${f(sh[1])}px">`
        + `<path d="M${f(sh[0])},${f(sh[1])} L${f(wr[0])},${f(wr[1])} L${f(tp[0])},${f(tp[1])} Q${f(sh[0] - span * 0.2)},${f(sh[1] + k * span * 0.2)} ${f(hp[0])},${f(hp[1])} Z" fill="${color}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`
        + `<path d="M${f(sh[0])},${f(sh[1])} L${f(wr[0])},${f(wr[1])} L${f(tp[0])},${f(tp[1])}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" opacity=".55"/></g>`;
    };
    layers.back.push(wing(shade, opts.anim ? 'flap flap-far' : '', true));
    layers.top.push(wing(accent, opts.anim ? 'flap' : '', false));
    const hip = R(-rx * 0.7, ry * 0.3);
    layers.back.push(limb([hip, [hip[0] - 10, hip[1] + 8], [hip[0] - 18, hip[1] + 10]], 4, legFar));
  } else if (plan === 'swim') {
    const fl = (p, len, color, ang0) => `<ellipse cx="${f(p[0])}" cy="${f(p[1] + len * 0.35)}" rx="${f(len * 0.32)}" ry="${f(len * 0.62)}" transform="rotate(${ang0} ${f(p[0])} ${f(p[1])})" fill="${color}" stroke="${INK}" stroke-width="${SW}"/>`;
    const fp = R(rx * 0.5, ry * 0.5);
    const bp = R(-rx * 0.45, ry * 0.5);
    layers.back.push(fl([fp[0] + 5, fp[1]], armLen + 8, shade, -40), fl([bp[0] + 5, bp[1]], legLen + 4, shade, -45));
    layers.front.push(fl(fp, armLen + 8, fill, -50), fl(bp, legLen + 4, fill, -55));
  }

  // ---------- Rasgos de la espalda (detrás del torso) ----------
  const back = [];
  if (feat.sail) {
    const H = feat.sail * (1 - 0.4 * baby);
    let spines = '';
    for (let i = 0; i < 7; i += 1) {
      const x = -rx * 0.55 + (rx * 1.05 * i) / 6;
      const hgt = H * Math.sin((Math.PI * (i + 0.5)) / 7);
      spines += `<path d="M${f(x)},${f(-ry * 0.7)} L${f(x)},${f(-ry * 0.8 - hgt)}" stroke="${INK}" stroke-width="1.2" opacity=".5"/>`;
    }
    back.push(`<path d="M${f(-rx * 0.65)},${f(-ry * 0.6)} C${f(-rx * 0.5)},${f(-ry - H * 1.2)} ${f(rx * 0.35)},${f(-ry - H * 1.2)} ${f(rx * 0.55)},${f(-ry * 0.55)} Z" fill="${accent}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>${spines}`);
  }
  if (feat.plates) {
    const n = feat.plates;
    for (let i = 0; i < n; i += 1) {
      const t = (i + 0.5) / n;
      const x = -rx * 0.95 + rx * 1.65 * t;
      const yTop = -ry * Math.sqrt(Math.max(0.05, 1 - (x / rx) ** 2)) * 0.98;
      const size = (feat.backSpikes ? 9 : 15) * Math.sin(Math.PI * (0.15 + t * 0.75)) * (1 - 0.35 * baby) + 5;
      const tiltP = (x / rx) * 14;
      back.push(`<path d="M${f(x - size * 0.5)},${f(yTop + 3)} L${f(x - size * 0.1)},${f(yTop - size * 1.15)} L${f(x + size * 0.55)},${f(yTop - size * 0.55)} L${f(x + size * 0.45)},${f(yTop + 3)} Z" transform="rotate(${f(tiltP)} ${f(x)} ${f(yTop)})" fill="${accent}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`);
    }
  }
  if (feat.backSpikes) {
    for (let i = 0; i < feat.backSpikes; i += 1) {
      const x = -rx * 0.9 + (rx * 0.6 * i) / feat.backSpikes;
      const yTop = -ry * Math.sqrt(Math.max(0.05, 1 - (x / rx) ** 2));
      back.push(`<path d="M${f(x - 3)},${f(yTop + 2)} L${f(x - 6)},${f(yTop - 18)} L${f(x + 3)},${f(yTop + 1)} Z" fill="#efe6d2" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`);
    }
  }
  if (feat.scutes || feat.ridge) {
    for (let i = 0; i < 9; i += 1) {
      const x = -rx * 0.85 + (rx * 1.6 * i) / 8;
      const yTop = -ry * Math.sqrt(Math.max(0.05, 1 - (x / rx) ** 2));
      back.push(`<circle cx="${f(x)}" cy="${f(yTop + 1)}" r="${feat.ridge ? 3.2 : 2.4}" fill="${accent}" stroke="${INK}" stroke-width="1.4"/>`);
    }
  }

  if (feat.quills && !silhouette) {
    for (let i = 0; i < 9; i += 1) {
      const t = 0.08 + i * 0.09;
      const x = tb[0] - tailLen * t;
      const y = tTop[1] + droop * t * 0.4 - (1 - t) * 1.5;
      const L = (16 - i * 1.1) * (1 - 0.4 * baby);
      back.push(`<path d="M${f(x)},${f(y + 2)} l${f(-L * 0.25)},${f(-L)}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M${f(x)},${f(y + 2)} l${f(-L * 0.25)},${f(-L)}" stroke="${accent}" stroke-width="1.3" stroke-linecap="round"/>`);
    }
  }

  // ---------- Torso + cola con patrón ----------
  const bellyF = feat.potBelly ? 1.25 : 1;
  const torso = blobPath(rx, ry, bellyF);
  const clipId = `${uid}c`;
  const gradId = `${uid}g`;
  const patternSvg = silhouette ? '' : patternLayer(col.patronId, rx, ry, tailLen, rand, col.patron);
  let tailExtra = '';
  if (feat.paddleTail) {
    tailExtra += `<path d="M${f(tb[0] - tailLen * 0.15)},${f(tTop[1] + droop * 0.1)} Q${f(tb[0] - tailLen * 0.55)},${f(tTop[1] - 22)} ${f(tip[0] + 4)},${f(tip[1] - 2)} Q${f(tb[0] - tailLen * 0.6)},${f(tTop[1] + 2)} ${f(tb[0] - tailLen * 0.15)},${f(tTop[1] + droop * 0.1)} Z" fill="${accent}" stroke="${INK}" stroke-width="2"/>`;
  }
  if (feat.fluke) {
    tailExtra += `<path d="M${f(tip[0] + 10)},${f(tip[1])} Q${f(tip[0] - 4)},${f(tip[1] + 6)} ${f(tip[0] - 6)},${f(tip[1] + 18)} Q${f(tip[0] + 6)},${f(tip[1] + 6)} ${f(tip[0] + 14)},${f(tip[1] + 2)} Z" fill="${fill}" stroke="${INK}" stroke-width="2"/>`;
  }
  let tailTop = '';
  if (feat.club) {
    tailTop += `<ellipse cx="${f(tip[0] + 2)}" cy="${f(tip[1])}" rx="9" ry="7" fill="${shade}" stroke="${INK}" stroke-width="${SW}"/><ellipse cx="${f(tip[0] + 8)}" cy="${f(tip[1] + 1)}" rx="6" ry="5" fill="${shade}" stroke="${INK}" stroke-width="2"/>`;
  }
  if (feat.tailSpikes) {
    const base = [tip[0] + tailLen * 0.18, tip[1] - 2];
    for (let i = 0; i < 2; i += 1) {
      const bx2 = base[0] - i * 8;
      tailTop += `<path d="M${f(bx2)},${f(base[1])} L${f(bx2 - 14)},${f(base[1] - 16)} L${f(bx2 - 3)},${f(base[1] + 1)} Z" fill="#efe6d2" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
      tailTop += `<path d="M${f(bx2 + 2)},${f(base[1])} L${f(bx2 - 16)},${f(base[1] - 6)} L${f(bx2 - 1)},${f(base[1] + 3)} Z" fill="#e2d6bd" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    }
  }
  if (feat.tailFeathers && !silhouette) {
    for (let i = 0; i < 7; i += 1) {
      const t = 0.25 + i * 0.11;
      const x = tb[0] - tailLen * t;
      const y = tb[1] + droop * t;
      tailTop += `<path d="M${f(x)},${f(y - 1)} q-3,-6 -9,-6 q4,4 3,7 z M${f(x)},${f(y + 1)} q-3,6 -9,6 q4,-4 3,-7 z" fill="${accent}" stroke="${INK}" stroke-width="1"/>`;
    }
  }
  if (feat.tailFan && !silhouette) {
    tailTop += `<path d="M${f(tip[0] + 8)},${f(tip[1])} l-9,-7 l3,6 l-8,0 l6,3 l-6,5 l9,-2 z" fill="${accent}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
  }
  if (feat.feathers && !silhouette) {
    // Plumón a lo largo del lomo.
    let fuzz = '';
    for (let i = 0; i < 10; i += 1) {
      const x = -rx * 0.9 + (rx * 1.6 * i) / 9;
      const yTop = -ry * Math.sqrt(Math.max(0.05, 1 - (x / rx) ** 2));
      fuzz += `<path d="M${f(x - 3)},${f(yTop + 2)} q2,-7 6,-1" fill="${accent}" stroke="${INK}" stroke-width="1.2"/>`;
    }
    back.push(fuzz);
  }

  let armorSvg = '';
  if (feat.armor && !silhouette) {
    for (let row = 0; row < 3; row += 1) {
      for (let i = 0; i < 7; i += 1) {
        const x = -rx * 0.75 + (rx * 1.45 * i) / 6 + (row % 2) * 6;
        const y = -ry * 0.7 + row * ry * 0.38;
        armorSvg += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4.2" ry="3" fill="${shade}" stroke="${INK}" stroke-width="1.2" opacity=".85"/>`;
      }
    }
    for (let i = 0; i < 6; i += 1) {
      const x = -rx * 0.75 + (rx * 1.45 * i) / 5;
      armorSvg += `<path d="M${f(x - 4)},${f(ry * 0.25)} L${f(x)},${f(ry * 0.25 + 9)} L${f(x + 4)},${f(ry * 0.25)} Z" fill="#efe6d2" stroke="${INK}" stroke-width="1.3"/>`;
    }
  }
  if (feat.shoulderSpike) {
    armorSvg += `<path d="M${f(rx * 0.35)},${f(ry * 0.05)} L${f(rx * 0.05)},${f(ry * 0.5)} L${f(rx * 0.5)},${f(ry * 0.25)} Z" fill="#efe6d2" stroke="${INK}" stroke-width="1.6"/>`;
  }
  let shadeSvg = '';
  let rimSvg = '';
  if (!silhouette) {
    const cs = feat.countershade ? 0.62 : 0.5;
    shadeSvg = `<path d="${blobPath(rx * 0.86, ry * cs, bellyF)}" transform="translate(${f(rx * 0.05)} ${f(ry * (1 - cs) + ry * 0.02)})" fill="${belly}" opacity=".92"/>`;
    rimSvg = `<path d="M${f(-rx * 0.62)},${f(-ry * 0.62)} Q${f(-rx * 0.1)},${f(-ry * 1.02)} ${f(rx * 0.5)},${f(-ry * 0.72)}" fill="none" stroke="#fff" stroke-width="${f(Math.max(2, ry * 0.12))}" stroke-linecap="round" opacity=".28"/>`;
    if (feat.iridescent) shadeSvg += `<path d="${torso}" fill="url(#${gradId}i)" opacity=".5"/>`;
  }

  const tailCls = opts.anim ? 'class="tail-sway"' : '';
  const torsoGroup = `<g transform="${torsoT}">`
    + back.join('')
    + `<g ${tailCls} style="transform-origin:${f(tb[0])}px ${f(tb[1])}px">`
    + `<path d="${tailPath}" fill="${bodyFill}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>${tailExtra}`
    + (patternSvg ? `<g clip-path="url(#${clipId}t)">${patternSvg.tail}</g>` : '')
    + tailTop + '</g>'
    + `<g class="${opts.anim ? 'breathe' : ''}" style="transform-origin:0px ${f(ry)}px">`
    + `<path d="${torso}" fill="${bodyFill}" stroke="${INK}" stroke-width="${SW}"/>`
    + `<g clip-path="url(#${clipId})">${shadeSvg}${patternSvg ? patternSvg.body : ''}${rimSvg}</g>`
    + armorSvg + '</g></g>';

  // ---------- Cuello ----------
  let neckSvg = '';
  if (neckLen > 2) {
    const mid = [(nbW[0] + ne[0]) / 2 - Math.sin(ang) * 3, (nbW[1] + ne[1]) / 2 - Math.cos(ang) * 3];
    const d = `M${f(nbW[0] - 4)},${f(nbW[1] + 4)} Q${f(mid[0])},${f(mid[1])} ${f(ne[0])},${f(ne[1])}`;
    neckSvg = `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(neckW + SW * 2)}" stroke-linecap="round"/>`
      + `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${f(neckW)}" stroke-linecap="round"/>`;
    if (feat.feathers && !silhouette) {
      neckSvg += `<path d="${d}" fill="none" stroke="${accent}" stroke-width="${f(neckW * 0.45)}" stroke-linecap="round" stroke-dasharray="2 4" opacity=".7"/>`;
    }
    if (feat.neckSpines) {
      // Dos filas de espinas a lo largo del cuello (Amargasaurus).
      const P0 = [nbW[0] - 4, nbW[1] + 4];
      const bez = (t) => [
        (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * mid[0] + t * t * ne[0],
        (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * mid[1] + t * t * ne[1],
      ];
      let far = '';
      let near = '';
      for (let i = 0; i < 9; i += 1) {
        const t = 0.1 + i * 0.095;
        const p = bez(t);
        const L = (8 + 16 * Math.sin(Math.PI * (0.25 + t * 0.6))) * (1 - 0.5 * baby);
        const tip = [p[0] - L * 0.35, p[1] - neckW * 0.4 - L];
        far += `<path d="M${f(p[0] + 2)},${f(p[1] - neckW * 0.2)} L${f(tip[0] + 3)},${f(tip[1] + 1)}" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/><path d="M${f(p[0] + 2)},${f(p[1] - neckW * 0.2)} L${f(tip[0] + 3)},${f(tip[1] + 1)}" stroke="${shade}" stroke-width="1.6" stroke-linecap="round"/>`;
        near += `<path d="M${f(p[0])},${f(p[1] - neckW * 0.3)} L${f(tip[0])},${f(tip[1])}" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M${f(p[0])},${f(p[1] - neckW * 0.3)} L${f(tip[0])},${f(tip[1])}" stroke="${silhouette ? fill : CLAW}" stroke-width="1.8" stroke-linecap="round"/>`;
      }
      neckSvg = far + neckSvg + near;
    }
  }

  // ---------- Cabeza ----------
  const eyeR = (feat.armor ? 2.1 : 2.4) * (1 + 0.6 * baby);
  const [ex, ey] = head.eye;
  let headExtra = '';
  let headBack = '';
  if (feat.frill) {
    const w = feat.frill.w * (1 - 0.3 * baby);
    const R0 = 19 * w;
    const fx0 = -2;
    const fy0 = -4;
    headBack += `<path d="M${f(fx0 + 4)},${f(fy0 + 8)} C${f(fx0 - R0 * 0.9)},${f(fy0 + 4)} ${f(fx0 - R0 * 1.1)},${f(fy0 - R0 * 1.1)} ${f(fx0 + 6)},${f(fy0 - R0 * 1.15)} C${f(fx0 + 8)},${f(fy0 - R0 * 0.6)} ${f(fx0 + 8)},${f(fy0 - 4)} ${f(fx0 + 4)},${f(fy0 + 8)} Z" fill="${accent}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    headBack += `<path d="M${f(fx0 + 2)},${f(fy0 + 2)} C${f(fx0 - R0 * 0.6)},${f(fy0)} ${f(fx0 - R0 * 0.75)},${f(fy0 - R0 * 0.8)} ${f(fx0 + 4)},${f(fy0 - R0 * 0.85)}" fill="none" stroke="${INK}" stroke-width="1" opacity=".35"/>`;
    for (let i = 0; i < (feat.frill.spikes || 0); i += 1) {
      const t = i / Math.max(1, feat.frill.spikes - 1);
      const a0 = rad(110 + t * 120);
      const px = fx0 + Math.cos(a0) * R0 * 0.95;
      const py = fy0 - Math.abs(Math.sin(a0)) * R0 * 1.05;
      const L = (i < 4 ? 22 : 12) * (1 - 0.5 * baby);
      headBack += `<path d="M${f(px - 2.5)},${f(py + 2)} L${f(px + Math.cos(a0) * L)},${f(py - Math.abs(Math.sin(a0)) * L)} L${f(px + 2.5)},${f(py + 2)} Z" fill="#efe6d2" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
    }
  }
  if (feat.horns) {
    const { brow, nose } = feat.horns;
    if (brow) {
      const L = brow * (1 - 0.6 * baby);
      headExtra += `<path d="M${f(ex - 2)},${f(ey - 3)} Q${f(ex + L * 0.2)},${f(ey - L * 0.8)} ${f(ex + L * 0.75)},${f(ey - L * 0.85)} Q${f(ex + L * 0.15)},${f(ey - L * 0.45)} ${f(ex + 3)},${f(ey - 2)} Z" fill="#efe6d2" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    }
    if (nose) {
      const L = nose * (1 - 0.5 * baby);
      headExtra += `<path d="M18,-6 Q${f(19 + L * 0.2)},${f(-6 - L * 0.9)} ${f(22 + L * 0.2)},${f(-7 - L)} Q${f(22 + L * 0.05)},${f(-6 - L * 0.4)} 24,-3 Z" fill="#efe6d2" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    }
  }
  if (feat.crest === 'tube') {
    const L = 34 * (1 - 0.6 * baby);
    headBack += `<path d="M2,-9 Q${f(-L * 0.4)},${f(-14 - L * 0.15)} ${f(-L)},${f(-6 - L * 0.25)}" fill="none" stroke="${INK}" stroke-width="10.5" stroke-linecap="round"/><path d="M2,-9 Q${f(-L * 0.4)},${f(-14 - L * 0.15)} ${f(-L)},${f(-6 - L * 0.25)}" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>`;
  } else if (feat.crest === 'double') {
    headExtra += `<path d="M2,-7 Q8,-22 22,-10 Q12,-14 4,-5 Z" fill="${accent}" stroke="${INK}" stroke-width="1.6"/><path d="M5,-8 Q12,-24 25,-8" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".5"/>`;
  } else if (feat.crest === 'casque') {
    headExtra += `<path d="M2,-10 C3,-22 14,-21 13,-9 Z" fill="${accent}" stroke="${INK}" stroke-width="1.6"/>`;
  } else if (feat.crest === 'comb') {
    headExtra += `<path d="M-1,-10 q2,-6 5,-1 q2,-6 5,-1 q2,-5 5,0" fill="${accent}" stroke="${INK}" stroke-width="1.5"/>`;
  } else if (feat.crest === 'ptero') {
    headBack += `<path d="M0,-4 L-30,-16 L-26,-10 L-2,1 Z" fill="${accent}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  if (feat.browCrest) headExtra += `<path d="M${ex - 4},${ey - 3} l3,-5 l4,4 z" fill="${accent}" stroke="${INK}" stroke-width="1.4"/>`;
  if (feat.bullHorns) headExtra += `<path d="M${ex - 1},${ey - 3} q-2,-10 6,-12 q-3,5 -1,10 z" fill="#efe6d2" stroke="${INK}" stroke-width="1.5"/>`;
  if (feat.nasalArch) headExtra += `<path d="M2,-8 q4,-8 10,-1" fill="${fill}" stroke="${INK}" stroke-width="1.8"/>`;
  if (feat.knobs) {
    for (let i = 0; i < 5; i += 1) headExtra += `<circle cx="${f(-4 + i * 4)}" cy="${f(-3 - Math.sin((i / 4) * Math.PI) * 4)}" r="1.6" fill="${shade}" stroke="${INK}" stroke-width="1"/>`;
  }
  if (feat.armor) headExtra += '<path d="M-6,-6 l-5,-4 l3,6 z M-6,4 l-6,2 l5,2 z" fill="#efe6d2" stroke="#2d2a24" stroke-width="1.3"/>';
  if (feat.cheekHorn) headExtra += `<path d="M${ex - 2},${ey + 5} l-6,4 l7,-1 z" fill="${CLAW}" stroke="${INK}" stroke-width="1.1"/>`;
  if (feat.mask && !silhouette) headExtra += `<path d="M${ex - 6},${ey - 2.5} Q${ex},${ey - 4.5} ${ex + 8},${ey - 1} L${ex + 8},${ey + 2.5} Q${ex},${ey + 1.5} ${ex - 6},${ey + 2.5} Z" fill="${col.patron}" opacity=".75"/>`;
  if (look.head.type === 'dome' && !silhouette) headExtra += `<path d="M-3,-8 C-2,-16 11,-17 14,-8" fill="none" stroke="${accent}" stroke-width="3" opacity=".7"/>`;

  const sleeping = !!opts.sleeping;
  const mood = opts.mood || '';
  const pupilDy = mood === 'triste' ? eyeR * 0.25 : 0.2;
  let eyeSvg = '';
  if (!silhouette && sleeping) {
    eyeSvg = `<path d="M${ex - eyeR},${ey} q${eyeR},${eyeR} ${eyeR * 2},0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
  } else if (!silhouette && mood === 'radiante') {
    // Ojos cerrados de felicidad: ^ ^
    eyeSvg = `<path d="M${f(ex - eyeR)},${f(ey + eyeR * 0.3)} q${f(eyeR)},${f(-eyeR * 1.6)} ${f(eyeR * 2)},0" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`;
  } else if (!silhouette) {
    eyeSvg = `<g class="${opts.anim ? 'blink' : ''}" style="transform-origin:${ex}px ${ey}px"><circle cx="${ex}" cy="${ey}" r="${f(eyeR)}" fill="#fffaf0" stroke="${INK}" stroke-width="1.2"/>`
      + `<circle cx="${f(ex + eyeR * 0.25)}" cy="${f(ey + pupilDy)}" r="${f(eyeR * 0.62)}" fill="${col.ojo}"/>`
      + `<circle cx="${f(ex + eyeR * 0.45)}" cy="${f(ey - eyeR * 0.3 + pupilDy)}" r="${f(eyeR * 0.22)}" fill="#fff"/>`
      + (mood === 'cansado' ? `<path d="M${f(ex - eyeR - 0.4)},${f(ey - 0.2)} a${f(eyeR + 0.4)},${f(eyeR + 0.4)} 0 0 1 ${f(eyeR * 2 + 0.8)},0 z" fill="${fill}" stroke="${INK}" stroke-width="1"/>` : '')
      + '</g>';
    if (mood === 'triste') eyeSvg += `<path d="M${f(ex - eyeR * 1.2)},${f(ey - eyeR * 1.1)} l${f(eyeR * 2.2)},${f(-eyeR * 0.7)}" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`;
    else if (mood === 'radiante' || mood === 'feliz') eyeSvg += `<path d="M${f(ex - eyeR)},${f(ey - eyeR * 1.5)} q${f(eyeR)},${f(-eyeR * 0.6)} ${f(eyeR * 2)},${f(-eyeR * 0.1)}" stroke="${INK}" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".55"/>`;
  }
  const happy = mood === 'feliz' || mood === 'radiante';
  const mouth = happy && !silhouette
    ? `<path d="${head.mouth}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" opacity=".75"/>`
    : `<path d="${head.mouth}" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round" opacity=".45"/>`;
  const drool = mood === 'hambre' && !silhouette && !sleeping ? `<path d="M${f(head.len * 0.55)},${f(4)} q-1.5,4 0,6 q1.5,-2 0,-6" fill="#a6d8ec" stroke="${INK}" stroke-width=".7"/>` : '';
  const blush = (baby || happy) && !silhouette ? `<ellipse cx="${ex + 5}" cy="${ey + 6}" rx="3" ry="1.8" fill="#e98a7a" opacity="${happy ? 0.6 : 0.45}"/>` : '';
  const acc = !silhouette && opts.accesorio && ACCESSORIES[opts.accesorio] ? ACCESSORIES[opts.accesorio].svg(ex, ey, head.top || -12) : '';
  const nostril = `<circle cx="${f(head.len - 5)}" cy="${f(-3)}" r="0.9" fill="${INK}" opacity=".6"/>`;
  const headGroup = `<g class="${opts.anim ? 'head-bob' : ''}" style="transform-origin:${f(ne[0])}px ${f(ne[1])}px"><g transform="${headT}">${headBack}`
    + `<path d="${head.d}" fill="${bodyFill}" stroke="${INK}" stroke-width="${f(SW / headS)}" stroke-linejoin="round"/>`
    + `${mouth}${drool}${nostril}${headExtra}${eyeSvg}${blush}${acc}</g></g>`;

  // ---------- Encaje en el viewBox ----------
  const topNeck = ne[1] + ((head.top || -12) - (feat.frill ? 22 : 0) - (feat.horns ? 18 : 0) - (feat.crest === 'tube' ? 20 : feat.crest ? 12 : 0) - (acc ? 14 : 0)) * headS
    - (feat.neckSpines ? 26 : 0);
  const topBack = cy - ry - (feat.sail || 0) * 1.1 - (feat.plates ? 22 : 0) - (feat.backSpikes ? 16 : 0);
  const topWing = plan === 'flyer' ? cy - armLen * 0.45 - 6 : 0;
  const minY = Math.min(topNeck, topBack, topWing, -10) - 4;
  const minX = Math.min(R(tip[0], tip[1])[0] - 14, cx - rx - 10);
  const maxX = Math.max(ne[0] + (head.len + 6) * headS, cx + rx + 8, plan === 'flyer' ? cx + armLen * 0.4 : 0);
  const W = 236;
  const H = 150;
  const scale = Math.min(W / (maxX - minX), H / (-minY), 2.2);
  const tx = (240 - (maxX - minX) * scale) / 2 - minX * scale;
  const ty = 152;

  const defs = silhouette ? '' : `<defs><linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col.brillo}"/><stop offset=".55" stop-color="${fill}"/><stop offset="1" stop-color="${shade}"/></linearGradient>`
    + `<clipPath id="${clipId}"><path d="${torso}"/></clipPath>`
    + `<clipPath id="${clipId}t"><path d="${tailPath}"/></clipPath>`
    + (feat.iridescent ? `<linearGradient id="${gradId}i" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ad0ff"/><stop offset=".5" stop-color="#8a5bff"/><stop offset="1" stop-color="#2ef0a8"/></linearGradient>` : '')
    + '</defs>';

  const shadow = opts.noShadow ? '' : `<ellipse cx="${f((minX + maxX) / 2 + rx * 0.1)}" cy="1" rx="${f((maxX - minX) * 0.36)}" ry="5" fill="#000" opacity=".14"/>`;
  const floatCls = plan === 'flyer' || plan === 'swim' ? (opts.anim ? 'hover' : '') : '';
  const body = `${shadow}<g class="${floatCls}">${layers.back.join('')}${neckSvg}${torsoGroup}${layers.front.join('')}${headGroup}${layers.top.join('')}</g>`;
  const zzz = sleeping ? `<text x="${f(ne[0] + 10)}" y="${f(minY + 12)}" class="zzz" font-size="16" fill="${INK}">z z</text>` : '';
  const label = opts.title ? `<title>${opts.title}</title>` : '';
  return `<svg class="dino-svg${silhouette ? ' is-silhouette' : ''}" viewBox="0 0 240 160" role="img" aria-label="${opts.title || species.nombre}" xmlns="http://www.w3.org/2000/svg">${label}${defs}`
    + `<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(scale)})">${body}${zzz}</g></svg>`;
}

function patternLayer(type, rx, ry, tailLen, rand, color) {
  if (type === 'liso') return null;
  let body = '';
  let tail = '';
  const op = 'opacity=".55"';
  if (type === 'rayas') {
    for (let x = -rx; x < rx; x += 11) body += `<path d="M${f(x)},${-ry} q4,${f(ry * 0.7)} -1,${f(ry * 1.1)}" stroke="${color}" stroke-width="4.5" fill="none" ${op} stroke-linecap="round"/>`;
    for (let i = 1; i < 6; i += 1) tail += `<rect x="${f(-rx - (tailLen * i) / 6)}" y="-40" width="4" height="80" fill="${color}" ${op}/>`;
  } else if (type === 'manchas') {
    for (let i = 0; i < 9; i += 1) body += `<circle cx="${f((rand() * 2 - 1) * rx * 0.85)}" cy="${f(-ry * 0.2 - rand() * ry * 0.7)}" r="${f(2.5 + rand() * 3.5)}" fill="${color}" ${op}/>`;
    for (let i = 0; i < 5; i += 1) tail += `<circle cx="${f(-rx - rand() * tailLen * 0.85)}" cy="${f(-2 + rand() * 6)}" r="${f(2 + rand() * 2.5)}" fill="${color}" ${op}/>`;
  } else if (type === 'bandas') {
    for (let x = -rx * 0.7; x < rx * 0.7; x += 22) body += `<rect x="${f(x)}" y="${-ry}" width="9" height="${f(ry * 0.9)}" rx="3" fill="${color}" ${op}/>`;
    for (let i = 1; i < 4; i += 1) tail += `<rect x="${f(-rx - (tailLen * i) / 4)}" y="-40" width="8" height="80" fill="${color}" ${op}/>`;
  } else if (type === 'moteado') {
    for (let i = 0; i < 30; i += 1) body += `<circle cx="${f((rand() * 2 - 1) * rx)}" cy="${f(-rand() * ry)}" r="${f(0.9 + rand() * 1.2)}" fill="${color}" ${op}/>`;
    for (let i = 0; i < 12; i += 1) tail += `<circle cx="${f(-rx - rand() * tailLen)}" cy="${f(-3 + rand() * 6)}" r="1.1" fill="${color}" ${op}/>`;
  }
  return { body, tail };
}

export function defaultGenes(species) {
  const [h1, h2] = species.look.colors;
  return {
    seed: species.id.length * 977,
    sexo: 'M', hue1: h1, hue2: h2, sat: 44, luz: 46,
    patron: [(species.look.feat && (species.look.feat.pattern || (species.look.feat.stripes && 'rayas'))) || 'liso', 'liso'],
    variante: ['N', 'N'], stats: { ...species.stats }, mutaciones: 0, generacion: 1,
  };
}

/** Huevo: forma, color base de la especie y manchas. */
export function eggSVG(species, genes, opts = {}) {
  const hue = genes ? genes.hue1 : species.look.colors[0];
  const crack = opts.crack || 0; // 0..1
  const rand = rng((genes && genes.seed) || species.id.length * 31);
  let spots = '';
  for (let i = 0; i < 7; i += 1) spots += `<circle cx="${f(34 + rand() * 32)}" cy="${f(30 + rand() * 50)}" r="${f(2 + rand() * 4)}" fill="hsl(${hue} 35% 45%)" opacity=".55"/>`;
  const cracks = crack > 0.3 ? `<path d="M36,48 l8,6 l6,-7 l7,8 l6,-6 l7,5" fill="none" stroke="#2d2a24" stroke-width="1.8" stroke-linejoin="round" opacity="${f(Math.min(1, crack))}"/>` : '';
  const elong = species.tamano === 'gigante' ? 0.92 : species.tamano === 'pequeno' ? 1.08 : 1;
  return `<svg class="egg-svg${opts.wobble ? ' wobble' : ''}" viewBox="0 0 100 100" role="img" aria-label="Huevo de ${species.nombre}">`
    + '<ellipse cx="50" cy="93" rx="26" ry="4" fill="#000" opacity=".12"/>'
    + `<path d="M50,${f(10 * elong)} C72,${f(10 * elong)} 80,52 78,66 C76,82 64,92 50,92 C36,92 24,82 22,66 C20,52 28,${f(10 * elong)} 50,${f(10 * elong)} Z" fill="hsl(${hue} 30% 88%)" stroke="#2d2a24" stroke-width="2.4"/>`
    + `${spots}<path d="M36,30 q6,-8 14,-10" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6" fill="none"/>${cracks}</svg>`;
}

/** Silueta humana de 1,7 m para comparar tamaños. */
export function humanPath(x, ground, h) {
  const s = h / 170;
  return `<g transform="translate(${f(x)} ${f(ground)}) scale(${f(s)})" fill="#2d2a24">`
    + '<circle cx="0" cy="-158" r="12"/><path d="M-14,-142 h28 l6,62 h-10 l-3,-44 h-2 l-2,124 h-12 l-2,-80 h-2 l-2,80 h-12 l-2,-124 h-2 l-3,44 h-10 z"/></g>';
}
