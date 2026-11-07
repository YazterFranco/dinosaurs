// Recompensas y tiempo real: energía de expedición, taquilla, racha diaria,
// misiones diarias, cofres, regalos de los dinosaurios y subida de nivel.
//
// Principios (ver docs/GDD.md): nada se pierde por no jugar, la racha tiene
// escudos que la protegen y no hay compras con dinero real.

import { SPECIES, SPECIES_BY_ID } from '../data/species.js';
import { SITES, FOODS, CURIOS } from '../data/world.js';
import { ACCESSORIES, ACCESSORY_BY_RARITY } from '../data/cosmetics.js';
import { dayKey, daysBetween, weekIndex } from './calendar.js';
import { rng, wildGenes } from './genetics.js';
import {
  addMoney, addXp, addDna, parkStats, log, newId, boothCap,
} from './game.js';

export { boothCap };

export const ENERGY_REGEN_MS = 10 * 60 * 1000;
export const ENERGY_BASE_MAX = 5;
export const ENERGY_REFILL_PRICE = 120;
export const FREE_CHEST_MS = 4 * 60 * 60 * 1000;
export const MAX_SHIELDS = 2;


// ------------------------------------------------------------------ energía

export function energyMax(state) {
  return ENERGY_BASE_MAX + (state.mejoras.mochila || 0);
}

/** Actualiza la energía con el tiempo real transcurrido y la devuelve. */
export function energy(state, now = Date.now()) {
  const e = state.recompensas.energia;
  const max = energyMax(state);
  if (e.valor >= max) {
    e.ultimo = now;
    return { valor: e.valor, max, proxima: 0 };
  }
  const ticks = Math.floor((now - e.ultimo) / ENERGY_REGEN_MS);
  if (ticks > 0) {
    e.valor = Math.min(max, e.valor + ticks);
    e.ultimo += ticks * ENERGY_REGEN_MS;
    if (e.valor >= max) e.ultimo = now;
  }
  const proxima = e.valor >= max ? 0 : ENERGY_REGEN_MS - (now - e.ultimo);
  return { valor: e.valor, max, proxima };
}

export function spendEnergy(state, n = 1, now = Date.now()) {
  const cur = energy(state, now);
  if (cur.valor < n) return false;
  const wasFull = cur.valor >= cur.max;
  state.recompensas.energia.valor -= n;
  if (wasFull) state.recompensas.energia.ultimo = now;
  return true;
}

export function giveEnergy(state, n, now = Date.now()) {
  energy(state, now);
  // Se puede pasar del máximo con premios, hasta el doble.
  state.recompensas.energia.valor = Math.min(energyMax(state) * 2, state.recompensas.energia.valor + n);
}

export function buyEnergyRefill(state, now = Date.now()) {
  const cur = energy(state, now);
  if (cur.valor >= cur.max) return { ok: false, msg: 'Tu energía ya está llena.' };
  if (state.monedas < ENERGY_REFILL_PRICE) return { ok: false, msg: `Recargar cuesta ${ENERGY_REFILL_PRICE} monedas.` };
  addMoney(state, -ENERGY_REFILL_PRICE);
  state.recompensas.energia.valor = cur.max;
  state.recompensas.energia.ultimo = now;
  return { ok: true, msg: 'Energía recargada. ¡A excavar!' };
}

// ------------------------------------------------------------------ taquilla

export function collectBooth(state) {
  const amount = Math.floor(state.recompensas.taquilla);
  if (amount <= 0) return { ok: false, msg: 'La taquilla está vacía. Los visitantes pagan mientras tus dinosaurios están felices.' };
  state.recompensas.taquilla -= amount;
  addMoney(state, amount);
  state.contadores.cobros = (state.contadores.cobros || 0) + 1;
  addXp(state, 2);
  return { ok: true, monedas: amount, msg: `Cobraste ${amount} monedas de la taquilla.` };
}

// ------------------------------------------------------------------ racha diaria

export const DAILY_REWARDS = [
  { dia: 1, icono: '🪙', texto: '100 monedas', monedas: 100 },
  { dia: 2, icono: '🍖', texto: 'Cesta de comida', comida: 8 },
  { dia: 3, icono: '⚡', texto: '+3 energía y 100 monedas', energia: 3, monedas: 100 },
  { dia: 4, icono: '📦', texto: 'Cofre de madera', cofre: 'madera' },
  { dia: 5, icono: '🧬', texto: 'ADN de regalo', adn: 8 },
  { dia: 6, icono: '💰', texto: '300 monedas', monedas: 300 },
  { dia: 7, icono: '🏆', texto: 'Cofre de oro', cofre: 'oro' },
];

export function dailyStatus(state, now = Date.now()) {
  const d = state.recompensas.diaria;
  const today = dayKey(now);
  const gap = d.ultimoDia ? daysBetween(d.ultimoDia, today) : null;
  const disponible = gap === null || gap >= 1;
  let racha = d.racha;
  let protegida = false;
  let perdida = false;
  if (disponible && gap !== null && gap > 1) {
    if (gap - 1 <= d.escudos) protegida = true;
    else { perdida = true; racha = 0; }
  }
  const siguiente = disponible ? racha + 1 : racha;
  const dia = ((Math.max(1, siguiente) - 1) % 7) + 1;
  return { disponible, racha: d.racha, rachaSiReclama: siguiente, dia, protegida, perdida, escudos: d.escudos, faltan: gap === null ? 0 : gap - 1 };
}

export function claimDaily(state, now = Date.now(), rnd = Math.random) {
  const st = dailyStatus(state, now);
  if (!st.disponible) return { ok: false, msg: 'Ya reclamaste el regalo de hoy. ¡Vuelve mañana!' };
  const d = state.recompensas.diaria;
  if (st.protegida) d.escudos -= st.faltan;
  d.racha = st.perdida ? 1 : d.racha + 1;
  d.mejorRacha = Math.max(d.mejorRacha, d.racha);
  d.ultimoDia = dayKey(now);
  const reward = DAILY_REWARDS[st.dia - 1];
  const items = [];
  const bonusPct = Math.min(50, (Math.ceil(d.racha / 7) - 1) * 10);
  if (reward.monedas) {
    const m = Math.round(reward.monedas * (1 + bonusPct / 100));
    addMoney(state, m);
    items.push({ icono: '🪙', texto: `${m} monedas` });
  }
  if (reward.energia) { giveEnergy(state, reward.energia, now); items.push({ icono: '⚡', texto: `+${reward.energia} energía` }); }
  if (reward.comida) items.push(...giveFood(state, reward.comida, rnd));
  if (reward.adn) items.push(giveDna(state, reward.adn, rnd));
  if (reward.cofre) { addChest(state, reward.cofre, 'Racha diaria'); items.push({ icono: CHESTS[reward.cofre].icono, texto: CHESTS[reward.cofre].nombre }); }
  if (st.dia === 7 && d.escudos < MAX_SHIELDS) {
    d.escudos += 1;
    items.push({ icono: '🛡️', texto: 'Escudo de racha' });
  }
  addXp(state, 10);
  log(state, `Racha diaria: ${d.racha} día(s)`, '🔥');
  return {
    ok: true, dia: st.dia, racha: d.racha, items, protegida: st.protegida, perdida: st.perdida, bonusPct,
    msg: st.protegida ? `¡Un escudo protegió tu racha! Llevas ${d.racha} días.` : `¡Día ${d.racha} de racha!`,
  };
}

// ------------------------------------------------------------------ misiones diarias

const DAILY_POOL = [
  { key: 'alimentar', icono: '🍖', texto: (n) => `Alimenta ${n} veces`, metas: [5, 8], premio: 60 },
  { key: 'caricias', icono: '🤚', texto: (n) => `Acaricia ${n} veces`, metas: [6, 10], premio: 40 },
  { key: 'juegos', icono: '⚽', texto: (n) => `Juega ${n} veces`, metas: [3, 5], premio: 50 },
  { key: 'peticiones', icono: '💞', texto: (n) => `Atiende ${n} peticiones de crías`, metas: [2, 4], premio: 70, req: (s) => s.dinos.length > 0 },
  { key: 'excavaciones', icono: '⛏️', texto: (n) => `Excava ${n} veces`, metas: [1, 2], premio: 80 },
  { key: 'huesos', icono: '🦴', texto: (n) => `Desentierra ${n} huesos`, metas: [3, 5], premio: 80 },
  { key: 'quizzes', icono: '🎓', texto: () => 'Completa un quiz', metas: [1, 1], premio: 70 },
  { key: 'concursos', icono: '🏆', texto: (n) => `Participa en ${n} concurso(s)`, metas: [1, 2], premio: 80, req: (s) => s.contadores.adultos > 0 },
  { key: 'regalos', icono: '🎁', texto: (n) => `Recoge ${n} regalos de tus dinosaurios`, metas: [2, 4], premio: 60 },
  { key: 'cobros', icono: '🎟️', texto: (n) => `Cobra la taquilla ${n} veces`, metas: [2, 3], premio: 40 },
  { key: 'eclosiones', icono: '🐣', texto: () => 'Haz eclosionar un huevo', metas: [1, 1], premio: 90, req: (s) => s.contadores.eclosiones > 0 },
];

function seedFrom(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function dailyMissions(state, now = Date.now()) {
  const dm = state.recompensas.diarias;
  const today = dayKey(now);
  if (dm.dia !== today) {
    const r = rng(seedFrom(`${today}:${state.creado}`));
    const pool = DAILY_POOL.filter((m) => !m.req || m.req(state));
    const pick = [];
    while (pick.length < 3 && pool.length) pick.push(...pool.splice(Math.floor(r() * pool.length), 1));
    const hard = state.nivel >= 5 ? 1 : 0;
    dm.dia = today;
    dm.cofre = false;
    dm.lista = pick.map((m) => ({
      key: m.key, icono: m.icono, texto: m.texto(m.metas[hard]), meta: m.metas[hard],
      base: state.contadores[m.key] || 0, premio: m.premio + state.nivel * 5, reclamada: false,
    }));
  }
  return dm.lista.map((m) => ({ ...m, progreso: Math.min(m.meta, (state.contadores[m.key] || 0) - m.base) }));
}

export function claimDailyMission(state, idx, now = Date.now()) {
  const list = dailyMissions(state, now);
  const m = list[idx];
  if (!m) return { ok: false, msg: 'Esa misión no existe.' };
  if (m.reclamada) return { ok: false, msg: 'Ya reclamaste esta misión.' };
  if (m.progreso < m.meta) return { ok: false, msg: `Te falta: ${m.progreso}/${m.meta}.` };
  state.recompensas.diarias.lista[idx].reclamada = true;
  addMoney(state, m.premio);
  addXp(state, 12);
  return { ok: true, msg: `Misión diaria completa: +${m.premio} monedas.` };
}

export function claimDailyChest(state, now = Date.now()) {
  const list = dailyMissions(state, now);
  const dm = state.recompensas.diarias;
  if (dm.cofre) return { ok: false, msg: 'Ya abriste el cofre de hoy.' };
  if (!list.every((m) => m.reclamada)) return { ok: false, msg: 'Completa y reclama las tres misiones del día.' };
  dm.cofre = true;
  const c = addChest(state, 'plata', 'Misiones diarias');
  return { ok: true, cofre: c, msg: '¡Ganaste un cofre de plata!' };
}

// ------------------------------------------------------------------ cofres

export const CHESTS = {
  madera: { nombre: 'Cofre de madera', icono: '📦', premios: 2, color: '#b07a4a', brillo: '#e9c99a' },
  plata: { nombre: 'Cofre de plata', icono: '🎁', premios: 3, color: '#8fa3b0', brillo: '#e6eef3' },
  oro: { nombre: 'Cofre de oro', icono: '🏆', premios: 4, color: '#e0a52b', brillo: '#fff1b8' },
  fosil: { nombre: 'Cofre fósil', icono: '🦴', premios: 3, color: '#9a8a7a', brillo: '#efe6d2' },
};

export function addChest(state, tipo, origen = '') {
  const c = { id: newId('cf'), tipo, origen };
  state.recompensas.cofres.push(c);
  return c;
}

export function freeChestStatus(state, now = Date.now()) {
  const listo = state.recompensas.cofreGratis;
  return { listo: now >= listo, faltaMs: Math.max(0, listo - now) };
}

export function claimFreeChest(state, now = Date.now()) {
  const st = freeChestStatus(state, now);
  if (!st.listo) return { ok: false, msg: 'El próximo envío de suministros todavía viene en camino.' };
  state.recompensas.envios = (state.recompensas.envios || 0) + 1;
  const tipo = state.recompensas.envios % 3 === 0 ? 'plata' : 'madera';
  state.recompensas.cofreGratis = now + FREE_CHEST_MS;
  const c = addChest(state, tipo, 'Envío de suministros');
  return { ok: true, cofre: c, msg: `Llegó un envío: ${CHESTS[tipo].nombre.toLowerCase()}.` };
}

function weighted(table, rnd) {
  const total = table.reduce((s, x) => s + x.w, 0);
  let r = rnd() * total;
  for (const x of table) { r -= x.w; if (r <= 0) return x; }
  return table[table.length - 1];
}

function giveFood(state, n, rnd) {
  const ids = Object.keys(FOODS).filter((id) => !FOODS[id].soloCretacico || state.nivel >= 2);
  const got = {};
  for (let i = 0; i < n; i += 1) {
    const id = ids[Math.floor(rnd() * ids.length)];
    got[id] = (got[id] || 0) + 1;
    state.inventario.comida[id] = (state.inventario.comida[id] || 0) + 1;
  }
  return Object.entries(got).map(([id, q]) => ({ icono: FOODS[id].icono, texto: `${q} × ${FOODS[id].nombre}` }));
}

/** ADN para una especie conocida; a veces descubre una especie nueva de un sitio desbloqueado. */
function giveDna(state, pct, rnd, allowNew = true) {
  const unlockedSpecies = SITES.filter((s) => s.nivel <= state.nivel).flatMap((s) => s.especies);
  const unknown = unlockedSpecies.filter((id) => !(state.genoma[id] > 0));
  const known = Object.keys(state.genoma).filter((id) => state.genoma[id] > 0 && state.genoma[id] < 100);
  let id;
  if (allowNew && unknown.length && (rnd() < 0.35 || !known.length)) id = unknown[Math.floor(rnd() * unknown.length)];
  else if (known.length) id = known[Math.floor(rnd() * known.length)];
  else id = SPECIES[0].id;
  const nuevo = !(state.genoma[id] > 0);
  addDna(state, id, pct);
  const sp = SPECIES_BY_ID[id];
  return { icono: '🧬', texto: `+${pct} % ADN de ${sp.corto || sp.nombre}${nuevo ? ' (¡nueva especie!)' : ''}`, especie: id, nuevo };
}

function giveAccessory(state, tier, rnd) {
  const r = rnd();
  let rare = 'comun';
  if (tier === 'oro') rare = r < 0.12 ? 'legendaria' : r < 0.45 ? 'epica' : 'rara';
  else if (tier === 'plata') rare = r < 0.04 ? 'legendaria' : r < 0.18 ? 'epica' : r < 0.55 ? 'rara' : 'comun';
  else rare = r < 0.08 ? 'epica' : r < 0.35 ? 'rara' : 'comun';
  const pool = ACCESSORY_BY_RARITY[rare];
  const id = pool[Math.floor(rnd() * pool.length)];
  const inv = state.recompensas.accesorios;
  const dup = inv.includes(id);
  if (dup) {
    const coins = { comun: 40, rara: 80, epica: 160, legendaria: 400 }[rare];
    addMoney(state, coins);
    return { icono: ACCESSORIES[id].icono, texto: `${ACCESSORIES[id].nombre} (repetido: +${coins} monedas)`, rareza: rare };
  }
  inv.push(id);
  return { icono: ACCESSORIES[id].icono, texto: `Accesorio: ${ACCESSORIES[id].nombre}`, rareza: rare, nuevo: true };
}

function giveGoldenEgg(state, rnd) {
  const ok = Object.keys(state.genoma).filter((id) => state.genoma[id] >= 50);
  if (!ok.length) return null;
  const id = ok[Math.floor(rnd() * ok.length)];
  const sp = SPECIES_BY_ID[id];
  const genes = wildGenes(sp, 100, rnd);
  const v = ['a', 'm', 'l'][Math.floor(rnd() * 3)];
  genes.variante = rnd() < 0.5 ? [v, v] : ['N', v];
  state.huevos.push({
    id: newId('hv'), especie: id, genes, viabilidad: 1, progreso: 0,
    duracion: 90, girar: null, proxGiro: state.tiempoJuego + 15, origen: 'dorado', incubando: false,
  });
  return { icono: '🥚', texto: `¡Huevo dorado de ${sp.corto || sp.nombre}! Lleva genes raros.`, rareza: 'legendaria' };
}

/** Abre un cofre y aplica sus premios. Devuelve la lista para animarla. */
export function openChest(state, chestId, rnd = Math.random, now = Date.now()) {
  const idx = state.recompensas.cofres.findIndex((c) => c.id === chestId);
  if (idx < 0) return { ok: false, msg: 'Ese cofre no existe.' };
  const chest = state.recompensas.cofres[idx];
  state.recompensas.cofres.splice(idx, 1);
  const def = CHESTS[chest.tipo];
  const tierMult = { madera: 1, plata: 1.8, fosil: 1.4, oro: 3 }[chest.tipo];
  const items = [];
  if (chest.tipo === 'oro') items.push(giveAccessory(state, 'oro', rnd));
  const table = [
    { k: 'monedas', w: 30 },
    { k: 'comida', w: 18 },
    { k: 'adn', w: chest.tipo === 'fosil' ? 50 : 22 },
    { k: 'energia', w: 10 },
    { k: 'medicina', w: 5 },
    { k: 'curio', w: 8 },
    { k: 'accesorio', w: chest.tipo === 'madera' ? 6 : 12 },
    { k: 'huevo', w: chest.tipo === 'oro' ? 6 : chest.tipo === 'plata' ? 1.5 : 0 },
  ];
  while (items.length < def.premios) {
    const pick = weighted(table, rnd).k;
    if (pick === 'monedas') {
      const m = Math.round((40 + rnd() * 60 + state.nivel * 8) * tierMult);
      addMoney(state, m);
      items.push({ icono: '🪙', texto: `${m} monedas` });
    } else if (pick === 'comida') items.push(...giveFood(state, Math.round(3 * tierMult), rnd).slice(0, 2));
    else if (pick === 'adn') items.push(giveDna(state, Math.round((4 + rnd() * 5) * tierMult), rnd));
    else if (pick === 'energia') { const n = chest.tipo === 'oro' ? 4 : 2; giveEnergy(state, n, now); items.push({ icono: '⚡', texto: `+${n} energía` }); }
    else if (pick === 'medicina') { state.inventario.medicina += 1; items.push({ icono: '💊', texto: 'Medicina' }); }
    else if (pick === 'curio') {
      const c = CURIOS[Math.floor(rnd() * CURIOS.length)];
      state.inventario.curios[c.id] = (state.inventario.curios[c.id] || 0) + 1;
      state.contadores.curios += 1;
      items.push({ icono: c.icono, texto: c.nombre });
    } else if (pick === 'accesorio') items.push(giveAccessory(state, chest.tipo === 'oro' ? 'oro' : chest.tipo === 'plata' ? 'plata' : 'madera', rnd));
    else if (pick === 'huevo') {
      const egg = giveGoldenEgg(state, rnd);
      if (egg) items.push(egg);
    }
  }
  state.contadores.cofresAbiertos = (state.contadores.cofresAbiertos || 0) + 1;
  addXp(state, 6);
  return { ok: true, tipo: chest.tipo, items, msg: `Abriste un ${def.nombre.toLowerCase()}.` };
}

// ------------------------------------------------------------------ regalos y visitantes

export const GIFTS = {
  pluma: { icono: '🪶', nombre: 'Pluma', texto: 'monedas' },
  semilla: { icono: '🌰', nombre: 'Semillas', texto: 'comida' },
  hueso: { icono: '🦴', nombre: 'Huesito', texto: 'ADN' },
  ambar: { icono: '💎', nombre: 'Gota de ámbar', texto: 'monedas' },
  estrella: { icono: '⭐', nombre: 'Estrella fugaz', texto: 'energía' },
};

export function collectGift(state, giftId, rnd = Math.random, now = Date.now()) {
  const list = state.recompensas.regalos;
  const i = list.findIndex((g) => g.id === giftId);
  if (i < 0) return { ok: false, msg: 'Ese regalo ya no está.' };
  const g = list[i];
  list.splice(i, 1);
  state.contadores.regalos = (state.contadores.regalos || 0) + 1;
  addXp(state, 2);
  let texto = '';
  if (g.tipo === 'pluma') { const m = 8 + Math.round(rnd() * 12) + state.nivel; addMoney(state, m); texto = `+${m} 🪙`; }
  else if (g.tipo === 'ambar') { const m = 40 + state.nivel * 5; addMoney(state, m); texto = `+${m} 🪙`; }
  else if (g.tipo === 'semilla') { const f = giveFood(state, 2, rnd); texto = f.map((x) => x.icono).join(' '); }
  else if (g.tipo === 'hueso') { addDna(state, g.especie, 1.5); texto = '+1,5 % 🧬'; }
  else if (g.tipo === 'estrella') { giveEnergy(state, 1, now); texto = '+1 ⚡'; }
  return { ok: true, tipo: g.tipo, texto, msg: `${GIFTS[g.tipo].nombre}: ${texto}` };
}

export function vipReward(state) {
  const m = Math.max(25, Math.round(parkStats(state).ingresoMin * 3));
  addMoney(state, m);
  state.contadores.vip = (state.contadores.vip || 0) + 1;
  addXp(state, 5);
  return { ok: true, monedas: m, msg: `¡Una fotógrafa de una revista de ciencia pagó ${m} monedas por fotografiar tu refugio!` };
}

// ------------------------------------------------------------------ eventos y niveles

export function featuredSite(state, now = Date.now()) {
  const open = SITES.filter((s) => s.nivel <= state.nivel);
  return open[weekIndex(now) % open.length];
}

/** Premios por subir de nivel: cofre y energía llena. */
export function levelUpRewards(state, level, now = Date.now()) {
  const tipo = level % 5 === 0 ? 'oro' : 'plata';
  addChest(state, tipo, `Nivel ${level}`);
  const e = energy(state, now);
  if (e.valor < e.max) { state.recompensas.energia.valor = e.max; state.recompensas.energia.ultimo = now; }
  const sitios = SITES.filter((s) => s.nivel === level).map((s) => s.nombre);
  return { tipo, sitios };
}

export function ownedAccessories(state) {
  return state.recompensas.accesorios.slice();
}

export function equipAccessory(state, dinoId, accId) {
  const d = state.dinos.find((x) => x.id === dinoId);
  if (!d) return { ok: false, msg: 'Dinosaurio no encontrado.' };
  if (accId && !state.recompensas.accesorios.includes(accId)) return { ok: false, msg: 'Aún no tienes ese accesorio.' };
  d.accesorio = accId || null;
  return { ok: true, msg: accId ? `${d.nombre} luce ${ACCESSORIES[accId].nombre.toLowerCase()}.` : `${d.nombre} se quitó el accesorio.` };
}

export function pendingCount(state, now = Date.now()) {
  let n = 0;
  if (dailyStatus(state, now).disponible) n += 1;
  if (freeChestStatus(state, now).listo) n += 1;
  n += state.recompensas.cofres.length;
  const list = dailyMissions(state, now);
  n += list.filter((m) => !m.reclamada && m.progreso >= m.meta).length;
  if (list.every((m) => m.reclamada) && !state.recompensas.diarias.cofre) n += 1;
  return n;
}

