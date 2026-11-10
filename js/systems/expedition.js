// Expediciones: una aventura corta con uno de tus dinosaurios. Cruza
// obstáculos, se topa con dinosaurios salvajes (los enfrenta por turnos o los
// amansa con comida) y vuelve con botín. Retirarse a tiempo guarda todo;
// quedarse sin aguante pierde la mitad.
import { SPECIES, SPECIES_BY_ID } from '../data/species.js';
import { FOODS, BIOMES } from '../data/world.js';
import { effectiveStats, stageOf, addMoney, addXp, addDna, canEat, log } from './game.js';

export const EXPEDITION_ENERGY = 25;
export const DIETA = { carnivoro: 'carnívoro', herbivoro: 'herbívoro', omnivoro: 'omnívoro', piscivoro: 'piscívoro', insectivoro: 'insectívoro' };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

/** Obstáculos: cada opción usa una estadística distinta. */
export const OBSTACLES = [
  {
    id: 'rio', icono: '🌊', titulo: 'Un río crecido',
    texto: 'La lluvia desbordó el río y el paso quedó cortado.',
    dato: 'Muchos fósiles se formaron así: animales arrastrados por crecidas y enterrados rápido en el lodo.',
    opciones: [
      { texto: 'Cruzar a nado contra la corriente', stat: 'fuerza', dif: 55 },
      { texto: 'Buscar un vado río arriba', stat: 'intelecto', dif: 45 },
      { texto: 'Saltar de roca en roca', stat: 'velocidad', dif: 60 },
    ],
  },
  {
    id: 'derrumbe', icono: '🪨', titulo: 'Derrumbe en el cañón',
    texto: 'Un montón de rocas tapa el camino.',
    dato: 'Los cañones dejan a la vista capas de roca de millones de años: por eso se excava en ellos.',
    opciones: [
      { texto: 'Empujar las rocas', stat: 'fuerza', dif: 60 },
      { texto: 'Trepar por encima con cuidado', stat: 'velocidad', dif: 50 },
      { texto: 'Aguantar el rodeo largo', stat: 'vitalidad', dif: 45 },
    ],
  },
  {
    id: 'tormenta', icono: '⛈️', titulo: 'Tormenta eléctrica',
    texto: 'El cielo se oscurece y empiezan a caer rayos.',
    dato: 'En el Mesozoico el clima era más cálido y había tormentas tropicales incluso cerca de los polos.',
    opciones: [
      { texto: 'Correr hasta una cueva', stat: 'velocidad', dif: 55 },
      { texto: 'Aguantar bajo los árboles', stat: 'vitalidad', dif: 55 },
      { texto: 'Leer el viento y esquivarla', stat: 'intelecto', dif: 60 },
    ],
  },
  {
    id: 'selva', icono: '🌿', titulo: 'Helechos gigantes',
    texto: 'La vegetación es tan densa que no se ve el suelo.',
    dato: 'No había pasto: el suelo estaba cubierto de helechos, colas de caballo y cícadas.',
    opciones: [
      { texto: 'Abrirse paso a la fuerza', stat: 'tamano', dif: 55 },
      { texto: 'Seguir el rastro de otros animales', stat: 'intelecto', dif: 50 },
      { texto: 'Escurrirse entre los tallos', stat: 'velocidad', dif: 55 },
    ],
  },
  {
    id: 'lodo', icono: '🕳️', titulo: 'Trampa de lodo',
    texto: 'El suelo se hunde: es un pantano escondido.',
    dato: 'En trampas de lodo así quedaron atrapadas manadas enteras, como las de Plateosaurus en Europa.',
    opciones: [
      { texto: 'Salir a tirones', stat: 'fuerza', dif: 60 },
      { texto: 'Quedarse quieto y avanzar despacio', stat: 'intelecto', dif: 50 },
      { texto: 'Resistir hasta tocar fondo firme', stat: 'vitalidad', dif: 55 },
    ],
  },
  {
    id: 'volcan', icono: '🌋', titulo: 'Ceniza volcánica',
    texto: 'Un volcán lejano cubre el aire de ceniza.',
    dato: 'La ceniza volcánica conserva fósiles con un detalle increíble, hasta plumas y piel.',
    opciones: [
      { texto: 'Atravesar la nube sin parar', stat: 'vitalidad', dif: 60 },
      { texto: 'Rodearla a toda velocidad', stat: 'velocidad', dif: 55 },
      { texto: 'Subir a un punto alto y despejado', stat: 'tamano', dif: 50 },
    ],
  },
];

/** Movimientos del duelo: cada uno le gana a otro, como piedra, papel o tijera. */
export const MOVES = {
  embestir: { nombre: 'Embestir', icono: '💥', stat: 'fuerza', gana: 'rugir', desc: 'Fuerza. Le gana a Rugir.' },
  rugir: { nombre: 'Rugir', icono: '🔊', stat: 'tamano', gana: 'esquivar', desc: 'Tamaño. Le gana a Esquivar.' },
  esquivar: { nombre: 'Esquivar', icono: '💨', stat: 'velocidad', gana: 'embestir', desc: 'Velocidad. Le gana a Embestir.' },
};
const MOVE_IDS = Object.keys(MOVES);

export function zonesOf(state) {
  return Object.keys(BIOMES);
}

export function wildSpeciesIn(zona) {
  const list = SPECIES.filter((s) => (s.biomas || [s.bioma]).includes(zona));
  return list.length ? list : SPECIES;
}

export function canExplore(state, dino) {
  if (!dino) return { ok: false, msg: 'Elige un dinosaurio.' };
  if (state.expedicion) return { ok: false, msg: 'Ya hay una expedición en marcha.' };
  if (stageOf(dino) === 'cria') return { ok: false, msg: 'Las crías se quedan en el refugio.' };
  if (dino.enClinica) return { ok: false, msg: `${dino.nombre} está en la clínica.` };
  if (dino.duermeHasta > state.tiempoJuego) return { ok: false, msg: `${dino.nombre} está durmiendo.` };
  if (dino.energia < EXPEDITION_ENERGY) return { ok: false, msg: `${dino.nombre} necesita ${EXPEDITION_ENERGY} de energía.` };
  if (dino.salud < 40) return { ok: false, msg: `${dino.nombre} necesita recuperar salud.` };
  return { ok: true };
}

function makeWild(state, zona, jefe, rnd) {
  const sp = pick(wildSpeciesIn(zona), rnd);
  const k = (0.55 + Math.min(0.35, state.nivel * 0.03) + rnd() * 0.15) * (jefe ? 1.2 : 1);
  const stats = {};
  for (const key of Object.keys(sp.stats)) stats[key] = Math.round(sp.stats[key] * k);
  const hp = Math.round(40 + stats.vitalidad * 0.6);
  return { especie: sp.id, jefe, stats, hp, hpMax: hp, calma: 0 };
}

export function startExpedition(state, dinoId, zona, rnd = Math.random) {
  const dino = state.dinos.find((d) => d.id === dinoId);
  const chk = canExplore(state, dino);
  if (!chk.ok) return chk;
  if (!BIOMES[zona]) return { ok: false, msg: 'Esa zona no existe.' };
  dino.energia -= EXPEDITION_ENERGY;
  const st = effectiveStats(dino);
  const aguante = Math.round(50 + st.vitalidad * 0.7);
  const obs = [...OBSTACLES].sort(() => rnd() - 0.5);
  state.expedicion = {
    dino: dinoId, zona, paso: 0, aguante, aguanteMax: aguante,
    botin: { monedas: 0, xp: 0, adn: {}, comida: {} },
    etapas: [
      { tipo: 'obstaculo', id: obs[0].id },
      { tipo: 'salvaje', salvaje: makeWild(state, zona, false, rnd) },
      { tipo: 'obstaculo', id: obs[1].id },
      { tipo: 'salvaje', salvaje: makeWild(state, zona, true, rnd) },
      { tipo: 'tesoro' },
    ],
    duelo: false, ultimo: null, fin: null,
  };
  state.contadores.expediciones = (state.contadores.expediciones || 0) + 1;
  return { ok: true, msg: `${dino.nombre} sale de expedición.` };
}

const run = (state) => state.expedicion;
export const stageNow = (state) => (run(state) ? run(state).etapas[run(state).paso] : null);
const dinoOf = (state) => state.dinos.find((d) => d.id === run(state).dino);

function hurt(state, n) {
  const e = run(state);
  e.aguante = Math.max(0, e.aguante - Math.round(n));
  if (e.aguante <= 0) finish(state, 'agotado');
}

function next(state) {
  const e = run(state);
  if (e.fin) return;
  e.duelo = false;
  e.paso += 1;
  if (e.paso >= e.etapas.length) finish(state, 'completa');
}

function loot(e, monedas, xp) {
  e.botin.monedas += Math.round(monedas);
  e.botin.xp += Math.round(xp);
}

/** Probabilidad de superar una prueba con una estadística. */
export function chance(stat, dif) {
  return clamp(0.6 + (stat - dif) / 80, 0.12, 0.95);
}

/** Dificultad real de una opción: los primeros niveles son más suaves. */
export function difOf(state, op) {
  return op.dif - Math.max(0, 12 - state.nivel * 2);
}

/** Elige una opción de un obstáculo. */
export function chooseOption(state, index, rnd = Math.random) {
  const e = run(state);
  const stage = stageNow(state);
  if (!e || e.fin || !stage || stage.tipo !== 'obstaculo') return { ok: false, msg: 'No hay obstáculo ahora.' };
  const ob = OBSTACLES.find((o) => o.id === stage.id);
  const op = ob.opciones[index];
  if (!op) return { ok: false, msg: 'Opción no válida.' };
  const st = effectiveStats(dinoOf(state));
  const p = chance(st[op.stat], difOf(state, op));
  const exito = rnd() < p;
  if (exito) loot(e, 18 + state.nivel * 4 + rnd() * 14, 8);
  else hurt(state, 14 + rnd() * 10);
  e.ultimo = { tipo: 'obstaculo', exito, texto: exito ? `¡Lo logró! ${ob.dato}` : 'No salió bien y perdió aguante, pero sigue adelante.' };
  if (!e.fin) next(state);
  return { ok: true, exito, p };
}

/** Empieza el duelo con el dinosaurio salvaje de esta etapa. */
export function startDuel(state) {
  const e = run(state);
  const stage = stageNow(state);
  if (!e || e.fin || !stage || stage.tipo !== 'salvaje') return { ok: false, msg: 'No hay nadie a quien enfrentar.' };
  e.duelo = true;
  e.ultimo = null;
  return { ok: true };
}

function enemyMove(w, rnd) {
  const weights = MOVE_IDS.map((m) => 20 + w.stats[MOVES[m].stat]);
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < MOVE_IDS.length; i += 1) { r -= weights[i]; if (r <= 0) return MOVE_IDS[i]; }
  return MOVE_IDS[0];
}

/** Un turno del duelo. */
export function duelTurn(state, move, rnd = Math.random) {
  const e = run(state);
  const stage = stageNow(state);
  if (!e || e.fin || !e.duelo || !stage || stage.tipo !== 'salvaje' || !MOVES[move]) return { ok: false, msg: 'No hay duelo en marcha.' };
  const w = stage.salvaje;
  const mine = effectiveStats(dinoOf(state));
  const rival = enemyMove(w, rnd);
  const dmg = (stats, m) => 9 + stats[MOVES[m].stat] * 0.22 + rnd() * 6;
  let resultado = 'empate';
  let doy = 0; let recibo = 0;
  if (MOVES[move].gana === rival) { resultado = 'gana'; doy = dmg(mine, move) * 1.5; } else if (MOVES[rival].gana === move) { resultado = 'pierde'; recibo = dmg(w.stats, rival) * 1.25; } else { doy = dmg(mine, move) * 0.55; recibo = dmg(w.stats, rival) * 0.5; }
  w.hp = Math.max(0, w.hp - Math.round(doy));
  const sp = SPECIES_BY_ID[w.especie];
  e.ultimo = { tipo: 'turno', move, rival, resultado, doy: Math.round(doy), recibo: Math.round(recibo) };
  if (w.hp <= 0) {
    const adn = w.jefe ? 4 : 2.5;
    loot(e, (w.jefe ? 70 : 40) + state.nivel * 6, w.jefe ? 30 : 18);
    e.botin.adn[w.especie] = (e.botin.adn[w.especie] || 0) + adn;
    state.contadores.duelosGanados = (state.contadores.duelosGanados || 0) + 1;
    e.ultimo = { ...e.ultimo, tipo: 'victoria', texto: `El ${sp.corto || sp.nombre} salvaje se retira. Recoges una muestra de ADN (+${adn} %).` };
    next(state);
    return { ok: true, resultado, fin: 'victoria' };
  }
  hurt(state, recibo);
  return { ok: true, resultado, fin: e.fin ? 'agotado' : null };
}

/** Amansar (como en ARK): ofrecer comida. La favorita casi siempre funciona. */
export function tame(state, foodId, rnd = Math.random) {
  const e = run(state);
  const stage = stageNow(state);
  if (!e || e.fin || !stage || stage.tipo !== 'salvaje') return { ok: false, msg: 'No hay nadie a quien amansar.' };
  if (!FOODS[foodId] || !(state.inventario.comida[foodId] > 0)) return { ok: false, msg: 'No te queda de esa comida.' };
  const w = stage.salvaje;
  const sp = SPECIES_BY_ID[w.especie];
  state.inventario.comida[foodId] -= 1;
  const fav = sp.favoritos.includes(foodId);
  const come = canEat(sp, foodId);
  const p = !come ? 0 : (fav ? 0.9 : 0.5) - (w.jefe ? 0.12 : 0);
  if (rnd() < p) {
    const adn = w.jefe ? 7 : 5;
    loot(e, 20, w.jefe ? 30 : 20);
    e.botin.adn[w.especie] = (e.botin.adn[w.especie] || 0) + adn;
    state.contadores.amansados = (state.contadores.amansados || 0) + 1;
    e.ultimo = { tipo: 'amansado', exito: true, texto: `Come de tu mano y se queda tranquilo. Tomas una muestra de ADN (+${adn} %) sin pelear.` };
    next(state);
    return { ok: true, exito: true };
  }
  w.calma += 1;
  hurt(state, come ? 8 : 14);
  e.ultimo = { tipo: 'amansado', exito: false, texto: come ? 'Lo olfatea, pero se asusta y te da un empujón.' : `¡Eso no lo come! ${sp.corto || sp.nombre} es ${DIETA[sp.dieta] || sp.dieta} y se enoja.` };
  return { ok: true, exito: false };
}

/** Rodear sin que te vea: depende de la velocidad y el intelecto. */
export function sneak(state, rnd = Math.random) {
  const e = run(state);
  const stage = stageNow(state);
  if (!e || e.fin || !stage || stage.tipo !== 'salvaje' || e.duelo) return { ok: false, msg: 'Ahora no se puede.' };
  const st = effectiveStats(dinoOf(state));
  const w = stage.salvaje;
  const p = chance((st.velocidad + st.intelecto) / 2, (w.stats.velocidad + w.stats.intelecto) / 2 + 5);
  if (rnd() < p) {
    e.ultimo = { tipo: 'rodeo', exito: true, texto: 'Pasa sin hacer ruido. No hay botín, pero tampoco golpes.' };
    next(state);
    return { ok: true, exito: true };
  }
  hurt(state, 12);
  if (!e.fin) { e.duelo = true; e.ultimo = { tipo: 'rodeo', exito: false, texto: '¡Te vio! Ataca primero y empieza el duelo.' }; }
  return { ok: true, exito: false };
}

/** Abrir el tesoro del final. */
export function openTreasure(state, rnd = Math.random) {
  const e = run(state);
  const stage = stageNow(state);
  if (!e || e.fin || !stage || stage.tipo !== 'tesoro') return { ok: false, msg: 'Aún no llegas al final.' };
  loot(e, 60 + state.nivel * 10 + rnd() * 40, 25);
  const sp = pick(wildSpeciesIn(e.zona), rnd);
  e.botin.adn[sp.id] = (e.botin.adn[sp.id] || 0) + 3;
  const food = pick(Object.keys(FOODS), rnd);
  e.botin.comida[food] = (e.botin.comida[food] || 0) + 3;
  e.ultimo = { tipo: 'tesoro', texto: `Un nido fósil intacto: huesos de ${sp.corto || sp.nombre} (+3 % de ADN) y provisiones.` };
  next(state);
  return { ok: true };
}

/** Volver al refugio con lo que llevas. */
export function retreat(state) {
  const e = run(state);
  if (!e || e.fin) return { ok: false, msg: 'No hay expedición.' };
  finish(state, 'retirada');
  return { ok: true };
}

function finish(state, motivo) {
  const e = run(state);
  if (e.fin) return;
  const dino = dinoOf(state);
  const k = motivo === 'agotado' ? 0.5 : 1;
  const b = e.botin;
  const monedas = Math.round(b.monedas * k);
  const xp = Math.round(b.xp * k);
  addMoney(state, monedas);
  addXp(state, xp);
  const adn = {};
  for (const [id, pct] of Object.entries(b.adn)) { adn[id] = Math.round(pct * k * 10) / 10; addDna(state, id, adn[id]); }
  for (const [id, n] of Object.entries(b.comida)) if (motivo !== 'agotado') state.inventario.comida[id] = (state.inventario.comida[id] || 0) + n;
  if (dino) {
    if (motivo === 'agotado') { dino.salud = Math.max(20, dino.salud - 15); dino.animo = Math.max(10, dino.animo - 15); } else { dino.vinculo = Math.min(100, dino.vinculo + (motivo === 'completa' ? 5 : 2)); dino.animo = Math.min(100, dino.animo + 8); }
    log(state, motivo === 'completa' ? `${dino.nombre} completó una expedición` : motivo === 'agotado' ? `${dino.nombre} volvió agotado de una expedición` : `${dino.nombre} volvió de una expedición`, '🧭');
  }
  if (motivo === 'completa') state.contadores.expedicionesCompletas = (state.contadores.expedicionesCompletas || 0) + 1;
  e.fin = { motivo, monedas, xp, adn, comida: motivo === 'agotado' ? {} : { ...b.comida } };
}

/** Cierra la pantalla de resultados. */
export function closeExpedition(state) {
  if (state.expedicion && state.expedicion.fin) state.expedicion = null;
  return { ok: true };
}
