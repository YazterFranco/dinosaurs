// Simulación de un jugador para revisar el ritmo del juego (balance).
// Uso: node scripts/simular-economia.mjs [días] [minutos por día]
//
// El bot juega sesiones diarias: cobra la taquilla, reclama la racha y las
// misiones, abre cofres, alimenta y atiende peticiones, excava con la energía
// disponible, sintetiza huevos y los incuba. Imprime un resumen por día.

import * as G from '../js/systems/game.js';
import * as R from '../js/systems/rewards.js';
import { createDig, strike, digRewards, COLS, ROWS } from '../js/systems/dig.js';
import { checkProgress } from '../js/systems/missions.js';
import { SPECIES_BY_ID, DIETS } from '../js/data/species.js';
import { SITES, FOODS, ENCLOSURE_CAPACITY } from '../js/data/world.js';
import { rng } from '../js/systems/genetics.js';

const DAYS = Number(process.argv[2] || 14);
const MIN_PER_DAY = Number(process.argv[3] || 20);
const rnd = rng(12345);
const DAY = 24 * 3600 * 1000;
let now = new Date(2026, 10, 2, 17, 0, 0).getTime();

const s = G.createGame(now);
G.chooseStarter(s, 'protoceratops');
const stats = { digs: 0, eggs: 0, hatched: 0, failedEggs: 0, chests: 0 };

function foodFor(d) {
  const sp = SPECIES_BY_ID[d.especie];
  const fav = sp.favoritos.find((f) => (s.inventario.comida[f] || 0) > 0);
  if (fav) return fav;
  const ok = Object.keys(FOODS).find((f) => G.canEat(sp, f) && (s.inventario.comida[f] || 0) > 0);
  if (ok) return ok;
  const buy = sp.favoritos[0];
  if (s.monedas >= FOODS[buy].precio * 5) G.buyFood(s, buy, 5);
  return buy;
}

function care() {
  for (const d of s.dinos) {
    if (d.enClinica) { G.medicate(s, d.id); continue; }
    if (d.peticion) {
      if (d.peticion.tipo === 'comida') G.feed(s, d.id, foodFor(d));
      else if (d.peticion.tipo === 'caricia') G.pet(s, d.id);
      else G.play(s, d.id);
    }
    if (d.hambre < 55) G.feed(s, d.id, foodFor(d));
    if (d.animo < 60 && d.duermeHasta <= s.tiempoJuego) G.pet(s, d.id);
  }
}

function dig() {
  const first = s.contadores.excavaciones === 0;
  const open = SITES.filter((x) => x.nivel <= s.nivel);
  // Prefiere sitios con especies sin completar.
  const site = open.sort((a, b) => {
    const need = (x) => x.especies.reduce((m, id) => m + (100 - (s.genoma[id] || 0)), 0) / x.especies.length;
    return need(b) - need(a) + (rnd() - 0.5) * 30;
  })[0];
  const cost = first ? 0 : site.costo;
  if (s.monedas < cost + 60) return false;
  if (!first && !R.spendEnergy(s, 1, now)) return false;
  G.addMoney(s, -cost);
  const dg = createDig(site.id, { guiada: first, energiaExtra: s.mejoras.energia * 6, rnd });
  // Estrategia sencilla: pico en roca profunda, brocha donde brilla un fósil.
  let guard = 0;
  while (!dg.terminado && guard < 300) {
    guard += 1;
    let target = null;
    for (let y = 0; y < ROWS && !target; y += 1) for (let x = 0; x < COLS && !target; x += 1) {
      const c = dg.grid[y][x];
      if (c.capa > 0 && c.item !== null && !dg.items[c.item].recogido) target = [x, y, 'brocha'];
    }
    if (!target) {
      const cells = [];
      for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLS; x += 1) if (dg.grid[y][x].capa > 0) cells.push([x, y]);
      if (!cells.length) break;
      const [x, y] = cells[Math.floor(rnd() * cells.length)];
      target = [x, y, 'pico'];
    }
    // Un jugador real no sabe dónde hay hueso hasta ver el brillo (capa 1).
    const c = dg.grid[target[1]][target[0]];
    const tool = c.item !== null && c.capa <= 1 ? 'brocha' : 'pico';
    if (!strike(dg, tool, target[0], target[1]).ok) break;
  }
  const { adn, curios } = digRewards(dg);
  for (const [id, p] of Object.entries(adn)) G.addDna(s, id, p * (R.featuredSite(s, now).id === site.id ? 2 : 1));
  for (const c of curios) { s.inventario.curios[c] = (s.inventario.curios[c] || 0) + 1; s.contadores.curios += 1; }
  s.contadores.excavaciones += 1;
  s.contadores.huesos += dg.hallazgos.filter((i) => dg.items[i].tipo === 'hueso').length;
  if (!s.sitiosVisitados.includes(site.id)) s.sitiosVisitados.push(site.id);
  G.addXp(s, 10 + Object.keys(adn).length * 3);
  stats.digs += 1;
  return true;
}

function nursery() {
  for (const e of [...s.huevos]) {
    if (e.progreso >= e.duracion) {
      if (!G.bestEnclosureFor(s, e.especie)) {
        const biome = SPECIES_BY_ID[e.especie].bioma;
        if (G.buildEnclosure(s, biome).ok === false) G.buildEnclosure(s, 'llanura');
      }
      const r = G.hatch(s, e.id, rnd);
      if (r.ok && r.fallido) stats.failedEggs += 1;
      else if (r.ok) stats.hatched += 1;
    } else if (e.girar) G.turnEgg(s, e.id);
  }
  // Sintetiza si hay espacio y una especie que aún no tenga.
  const owned = new Set(s.dinos.map((d) => d.especie));
  const cand = Object.keys(s.genoma).filter((id) => s.genoma[id] >= 50 && !owned.has(id) && !s.huevos.some((e) => e.especie === id));
  if (cand.length && s.huevos.length < G.incubatorSlots(s) && s.monedas >= G.eggPrice(cand[0]) + 50) {
    if (G.synthesizeEgg(s, cand[0], rnd).ok) stats.eggs += 1;
  }
}

function session(minutes) {
  R.claimDaily(s, now, rnd);
  const fr = R.claimFreeChest(s, now);
  if (fr.ok) { R.openChest(s, fr.cofre.id, rnd, now); stats.chests += 1; }
  for (let sec = 0; sec < minutes * 60; sec += 5) {
    now += 5000;
    G.tick(s, 5, { now, rnd });
    if (sec % 10 === 0) care();
    if (sec % 60 === 0) {
      for (const gft of [...s.recompensas.regalos]) R.collectGift(s, gft.id, rnd, now);
      R.collectBooth(s);
      nursery();
      while (R.energy(s, now).valor > 0 && dig()) { /* excava lo que pueda */ }
      R.dailyMissions(s, now).forEach((m, i) => { if (!m.reclamada && m.progreso >= m.meta) R.claimDailyMission(s, i, now); });
      if (R.claimDailyChest(s, now).ok) { /* añadido a cofres */ }
      while (s.recompensas.cofres.length) { R.openChest(s, s.recompensas.cofres[0].id, rnd, now); stats.chests += 1; }
      checkProgress(s);
      for (let l = 2; l <= s.nivel; l += 1) if (!s._lv || s._lv < l) { R.levelUpRewards(s, l, now); s._lv = l; }
    }
  }
  s.ultimo = now;
}

const rows = [];
for (let day = 1; day <= DAYS; day += 1) {
  session(MIN_PER_DAY);
  const t0 = now;
  now = t0 + DAY - MIN_PER_DAY * 60000;
  G.catchUp(s, now);
  const species = new Set(s.dinos.map((d) => d.especie)).size;
  const known = Object.keys(s.genoma).length;
  rows.push({
    dia: day, nivel: s.nivel, xp: s.xp, monedas: s.monedas, dinos: s.dinos.length, especiesCriadas: species,
    especiesDescubiertas: known, excavaciones: stats.digs, huevos: stats.eggs, fallidos: stats.failedEggs,
    adultos: s.dinos.filter((d) => G.stageOf(d) === 'adulto').length, recintos: s.recintos.length, racha: s.recompensas.diaria.racha,
    misiones: s.misiones.length, logros: s.logros.length, accesorios: s.recompensas.accesorios.length,
  });
}
console.table(rows);
console.log('Dieta de cada dino respetada:', s.dinos.every((d) => DIETS[SPECIES_BY_ID[d.especie].dieta]));
console.log('Recintos:', s.recintos.map((r) => `${r.bioma}(${G.dinosIn(s, r.id).length}/${ENCLOSURE_CAPACITY})`).join(' '));
