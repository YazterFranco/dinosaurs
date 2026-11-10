// Minijuego de excavación por capas.
//
// La cuadrícula tiene capas de roca (1–3). El pico rompe 2 capas en el centro y
// 1 alrededor, pero daña huesos ya expuestos. La brocha quita 1 capa sin dañar.

import { SPECIES_BY_ID } from '../data/species.js';
import { SITES_BY_ID, BONE_TYPES, CURIOS } from '../data/world.js';

export const COLS = 8;
export const ROWS = 6;
export const BASE_ENERGY = 30;
export const PICK_COST = 2;
export const BRUSH_COST = 1;
const RARITY_WEIGHT = { comun: 5, pococomun: 4, rara: 3, epica: 2, legendaria: 1.4 };
// Las especies raras aparecen menos, pero cada hueso aporta más ADN.
const RARITY_DNA = { comun: 1, pococomun: 1.1, rara: 1.25, epica: 1.4, legendaria: 1.6 };

function weightedPick(items, weightFn, rnd) {
  const total = items.reduce((s, x) => s + weightFn(x), 0);
  let r = rnd() * total;
  for (const x of items) {
    r -= weightFn(x);
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

function fits(grid, x, y, w, h) {
  if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return false;
  for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) if (grid[j][i].item !== null) return false;
  return true;
}

function place(grid, itemIdx, w, h, rnd) {
  for (let tries = 0; tries < 60; tries += 1) {
    const x = Math.floor(rnd() * (COLS - w + 1));
    const y = Math.floor(rnd() * (ROWS - h + 1));
    if (fits(grid, x, y, w, h)) {
      for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) grid[j][i].item = itemIdx;
      return { x, y };
    }
  }
  return null;
}

/**
 * Crea una excavación.
 * @param {string} siteId
 * @param {object} opts  { energiaExtra, guiada: bool (primera excavación), rnd }
 */
export function createDig(siteId, opts = {}) {
  const rnd = opts.rnd || Math.random;
  const site = SITES_BY_ID[siteId];
  const grid = [];
  for (let y = 0; y < ROWS; y += 1) {
    const row = [];
    for (let x = 0; x < COLS; x += 1) {
      const depth = 1 + Math.floor(rnd() * 3);
      row.push({ capa: depth, max: depth, item: null });
    }
    grid.push(row);
  }
  const items = [];
  const nBones = opts.guiada ? 3 : 2 + (rnd() < 0.55 ? 1 : 0);
  const guidedSpecies = opts.guiada ? weightedPick(site.especies, (id) => RARITY_WEIGHT[SPECIES_BY_ID[id].rareza], rnd) : null;
  for (let i = 0; i < nBones; i += 1) {
    const especie = guidedSpecies || weightedPick(site.especies, (id) => RARITY_WEIGHT[SPECIES_BY_ID[id].rareza], rnd);
    const bone = opts.guiada && i === 0 ? BONE_TYPES[0] : BONE_TYPES[Math.floor(rnd() * BONE_TYPES.length)];
    const vertical = bone.h > bone.w;
    const pos = place(grid, items.length, bone.w, bone.h, rnd);
    if (pos) items.push({ tipo: 'hueso', especie, hueso: bone.id, nombre: bone.nombre, adn: bone.adn, ...pos, w: bone.w, h: bone.h, calidad: 1, recogido: false, vertical });
  }
  const nCurios = 1 + (rnd() < 0.5 ? 1 : 0);
  for (let i = 0; i < nCurios; i += 1) {
    const c = CURIOS[Math.floor(rnd() * CURIOS.length)];
    const pos = place(grid, items.length, 1, 1, rnd);
    if (pos) items.push({ tipo: 'curio', curio: c.id, nombre: c.nombre, icono: c.icono, ...pos, w: 1, h: 1, calidad: 1, recogido: false });
  }
  const energia = BASE_ENERGY + (opts.energiaExtra || 0);
  return { sitio: siteId, grid, items, energia, energiaMax: energia, terminado: false, hallazgos: [] };
}

function cellExposed(dig, x, y) {
  return dig.grid[y][x].capa <= 0;
}

function checkCollect(dig) {
  const found = [];
  dig.items.forEach((it, idx) => {
    if (it.recogido) return;
    for (let j = it.y; j < it.y + it.h; j += 1) for (let i = it.x; i < it.x + it.w; i += 1) if (!cellExposed(dig, i, j)) return;
    it.recogido = true;
    dig.hallazgos.push(idx);
    found.push(it);
  });
  return found;
}

/** Usa una herramienta en (x, y). Devuelve { ok, dano, encontrados }. */
export function strike(dig, tool, x, y) {
  if (dig.terminado) return { ok: false, msg: 'La excavación terminó.' };
  const cost = tool === 'pico' ? PICK_COST : BRUSH_COST;
  if (dig.energia < cost) return { ok: false, msg: 'No te queda energía.' };
  dig.energia -= cost;
  let dano = null;
  const hit = (i, j, n, center) => {
    if (i < 0 || j < 0 || i >= COLS || j >= ROWS) return;
    const c = dig.grid[j][i];
    if (c.capa <= 0) {
      if (tool === 'pico' && center && c.item !== null) {
        const it = dig.items[c.item];
        if (!it.recogido && it.tipo === 'hueso') {
          it.calidad = Math.max(0.2, it.calidad - 0.2);
          dano = it;
        }
      }
      return;
    }
    c.capa = Math.max(0, c.capa - n);
  };
  if (tool === 'pico') {
    hit(x, y, 2, true);
    hit(x - 1, y, 1); hit(x + 1, y, 1); hit(x, y - 1, 1); hit(x, y + 1, 1);
  } else {
    hit(x, y, 1, true);
  }
  const encontrados = checkCollect(dig);
  if (dig.energia < BRUSH_COST || dig.items.every((it) => it.recogido)) dig.terminado = true;
  return { ok: true, dano, encontrados };
}

/** Resumen final: ADN por especie y hallazgos sueltos. */
export function digRewards(dig) {
  const adn = {};
  const curios = [];
  for (const it of dig.items) {
    if (it.tipo === 'hueso') {
      let pct;
      if (it.recogido) pct = it.adn * it.calidad;
      else {
        // Huesos a medio excavar: aportan algo según lo expuesto.
        let open = 0;
        for (let j = it.y; j < it.y + it.h; j += 1) for (let i = it.x; i < it.x + it.w; i += 1) if (cellExposed(dig, i, j)) open += 1;
        const frac = open / (it.w * it.h);
        pct = frac >= 0.5 ? it.adn * it.calidad * 0.3 : 0;
      }
      pct *= RARITY_DNA[SPECIES_BY_ID[it.especie].rareza];
      if (pct > 0) adn[it.especie] = Math.round(((adn[it.especie] || 0) + pct) * 10) / 10;
    } else if (it.recogido) curios.push(it.curio);
  }
  return { adn, curios };
}
