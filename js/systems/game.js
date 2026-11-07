// Lógica central: estado, paso del tiempo y acciones del jugador.
// Las funciones reciben el estado y lo modifican; devuelven un resultado
// con mensajes para la interfaz. No tocan el DOM, así se pueden probar en Node.

import { SPECIES_BY_ID, SIZE_CLASS, DIETS, RARITY } from '../data/species.js';
import {
  FOODS, MEDICINE, BIOMES, ENRICHMENT, ENCLOSURE_COST, ENCLOSURE_LEVEL, ENCLOSURE_CAPACITY,
  MAX_ENRICHMENT, UPGRADES, levelFromXp, CURIOS,
} from '../data/world.js';
import { wildGenes, breed as breedGenes, variantOf, rarityScore, STAT_KEYS } from './genetics.js';

export const SAVE_VERSION = 1;
export const OFFLINE_CAP_SEC = 2 * 60 * 60;
export const EGG_PRICE = { comun: 60, pococomun: 100, rara: 160, epica: 240, legendaria: 350 };
export const TREATMENT_PRICE = 80;
export const BREED_COOLDOWN_SEC = 240;
export const CONTEST_COOLDOWN_SEC = 180;
export const STARTERS = ['protoceratops', 'oviraptor', 'compsognathus'];

const NAMES = [
  'Pepita', 'Trueno', 'Chispa', 'Bombón', 'Rocky', 'Luna', 'Canela', 'Bruno', 'Kiwi', 'Nube',
  'Pinto', 'Coco', 'Tango', 'Maní', 'Sol', 'Fósil', 'Rex', 'Lola', 'Pecas', 'Mango', 'Gala',
  'Toby', 'Chiqui', 'Brisa', 'Olmo', 'Café', 'Sombra', 'Ámbar', 'Tito', 'Nina', 'Duna', 'Volcán',
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let idSeq = 0;
export function newId(prefix) {
  idSeq += 1;
  return `${prefix}${Date.now().toString(36)}${idSeq.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

// ------------------------------------------------------------------ estado

export function createGame(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    creado: now,
    ultimo: now,
    tiempoJuego: 0,
    monedas: 300,
    xp: 0,
    nivel: 1,
    iniciado: false,
    genoma: {},
    leidos: [],
    dinos: [],
    huevos: [],
    recintos: [{ id: 'r1', bioma: 'bosque', nombre: 'Recinto Bosque', enriquecimiento: [] }],
    inventario: {
      comida: { helechos: 6, cicadas: 2, carne_pequena: 4, carne_roja: 2, pescado: 2, insectos: 4, frutos: 3 },
      medicina: 1,
      curios: {},
    },
    mejoras: { incubadora: 0, rapida: 0, energia: 0 },
    contadores: {
      excavaciones: 0, huesos: 0, curios: 0, huevosSintetizados: 0, eclosiones: 0, alimentar: 0,
      caricias: 0, juegos: 0, peticiones: 0, cruces: 0, quizzes: 0, quizPerfecto: 0,
      concursos: 0, concursosGanados: 0, adultos: 0, rechazos: 0, ganancias: 0,
    },
    misiones: [],
    logros: [],
    sitiosVisitados: [],
    ajustes: { sonido: true },
    eventos: [],
  };
}

export function log(state, texto, icono = '•') {
  state.eventos.unshift({ t: state.tiempoJuego, texto, icono });
  if (state.eventos.length > 40) state.eventos.length = 40;
}

export function addXp(state, xp) {
  const before = state.nivel;
  state.xp += xp;
  state.nivel = levelFromXp(state.xp);
  return state.nivel > before ? state.nivel : null;
}

export function addMoney(state, n) {
  state.monedas = Math.max(0, Math.round(state.monedas + n));
  if (n > 0) state.contadores.ganancias += n;
}

export function incubatorSlots(state) {
  return UPGRADES.incubadora.base + state.mejoras.incubadora;
}

export function knownSpecies(state) {
  return Object.keys(state.genoma).filter((id) => state.genoma[id] > 0);
}

export function ownedSpecies(state) {
  return [...new Set(state.dinos.map((d) => d.especie))];
}

// ------------------------------------------------------------------ dinos

export function stageOf(dino) {
  const sp = SPECIES_BY_ID[dino.especie];
  const grow = SIZE_CLASS[sp.tamano].creceMin * 60;
  if (dino.edad < grow) return 'cria';
  if (dino.edad < grow * 2.5) return 'juvenil';
  return 'adulto';
}

export function growthProgress(dino) {
  const sp = SPECIES_BY_ID[dino.especie];
  const grow = SIZE_CLASS[sp.tamano].creceMin * 60;
  const stage = stageOf(dino);
  if (stage === 'cria') return { stage, pct: dino.edad / grow, faltaSeg: grow - dino.edad };
  if (stage === 'juvenil') return { stage, pct: (dino.edad - grow) / (grow * 1.5), faltaSeg: grow * 2.5 - dino.edad };
  return { stage, pct: 1, faltaSeg: 0 };
}

export function effectiveStats(dino) {
  const stage = stageOf(dino);
  const sf = stage === 'cria' ? 0.4 : stage === 'juvenil' ? 0.7 : 1;
  const bond = 1 + 0.2 * (dino.vinculo / 100);
  const out = {};
  for (const k of STAT_KEYS) out[k] = Math.round(dino.genes.stats[k] * sf * bond);
  return out;
}

function randomName(rnd = Math.random) {
  return NAMES[Math.floor(rnd() * NAMES.length)];
}

export function makeDino(state, especie, genes, recintoId, now = state.tiempoJuego) {
  return {
    id: newId('dn'),
    especie,
    nombre: randomName(),
    genes,
    edad: 0,
    hambre: 80,
    animo: 75,
    energia: 90,
    salud: 100,
    vinculo: 0,
    recinto: recintoId,
    nacio: now,
    peticion: null,
    proxPeticion: now + 20,
    duermeHasta: 0,
    enClinica: false,
    criaListo: 0,
    concursoListo: 0,
    trofeos: [],
    padres: null,
  };
}

// ------------------------------------------------------------------ recintos

export function dinosIn(state, recintoId) {
  return state.dinos.filter((d) => d.recinto === recintoId);
}

export function comfortOf(state, dino) {
  const sp = SPECIES_BY_ID[dino.especie];
  const rec = state.recintos.find((r) => r.id === dino.recinto);
  if (!rec) return { valor: 40, motivos: [] };
  const motivos = [];
  let v = 55;
  if (rec.bioma === sp.bioma) { v += 20; motivos.push({ t: `Le encanta el ${BIOMES[rec.bioma].nombre.toLowerCase()}`, v: 20 }); }
  else if (sp.biomas.includes(rec.bioma)) { v += 8; motivos.push({ t: 'El bioma le resulta cómodo', v: 8 }); }
  else { v -= 20; motivos.push({ t: `Prefiere: ${BIOMES[sp.bioma].nombre.toLowerCase()}`, v: -20 }); }

  const mates = dinosIn(state, rec.id).filter((d) => d.especie === dino.especie).length;
  const { min, max, tipo } = sp.social;
  if (mates < min) { const p = Math.max(-18, -9 * (min - mates)); v += p; motivos.push({ t: `Vive en ${tipo}: quiere al menos ${min} de su especie`, v: p }); }
  else if (mates > max) { const p = -8 * (mates - max); v += p; motivos.push({ t: `Demasiados de su especie (máx. ${max})`, v: p }); }
  else { v += 10; motivos.push({ t: tipo === 'solitario' ? 'Disfruta su espacio' : 'Está a gusto con su grupo', v: 10 }); }

  const isPrey = sp.dieta === 'herbivoro' || sp.dieta === 'omnivoro';
  if (isPrey) {
    const order = Object.keys(SIZE_CLASS);
    const threat = dinosIn(state, rec.id).some((o) => {
      const os = SPECIES_BY_ID[o.especie];
      return o.id !== dino.id && (os.dieta === 'carnivoro' || os.dieta === 'piscivoro')
        && order.indexOf(os.tamano) >= order.indexOf(sp.tamano) && stageOf(o) !== 'cria';
    });
    if (threat) { v -= 18; motivos.push({ t: 'Hay un depredador en el recinto', v: -18 }); }
  }
  const enr = rec.enriquecimiento.reduce((sum, id) => sum + (ENRICHMENT[id] ? ENRICHMENT[id].bonus : 0), 0);
  if (enr) { v += enr; motivos.push({ t: 'Objetos de enriquecimiento', v: enr }); }
  return { valor: clamp(Math.round(v), 0, 100), motivos };
}

export function attractionOf(state, dino) {
  if (dino.enClinica) return 0;
  const sp = SPECIES_BY_ID[dino.especie];
  const stage = stageOf(dino);
  const sm = stage === 'cria' ? 1.15 : stage === 'juvenil' ? 0.85 : 1;
  const mood = 0.35 + 0.65 * (dino.animo / 100);
  const sleep = dino.duermeHasta > state.tiempoJuego ? 0.8 : 1;
  return sp.fama * 10 * sm * mood * sleep * rarityScore(dino.genes);
}

export function parkStats(state) {
  const atr = state.dinos.reduce((s, d) => s + attractionOf(state, d), 0);
  return { atractivo: Math.round(atr), visitantes: Math.round(atr / 4), ingresoMin: Math.round(atr * 0.25) };
}

// ------------------------------------------------------------------ paso del tiempo

const REQUESTS = ['comida', 'caricia', 'juego'];

function requestGain(sp) {
  const total = SIZE_CLASS[sp.tamano].creceMin * 150;
  return clamp(Math.round(100 / (total / 42)), 6, 40);
}

/**
 * Avanza el juego `dt` segundos. `offline` suaviza la caída de necesidades
 * para que nadie sufra mientras no juegas.
 */
export function tick(state, dt, opts = {}) {
  const offline = !!opts.offline;
  const rnd = opts.rnd || Math.random;
  state.tiempoJuego += dt;
  const t = state.tiempoJuego;
  const events = [];
  const floor = offline ? 35 : 0;

  for (const d of state.dinos) {
    const sp = SPECIES_BY_ID[d.especie];
    if (d.enClinica) continue;
    const size = SIZE_CLASS[sp.tamano];
    const asleep = d.duermeHasta > t;
    const perMin = dt / 60;

    d.hambre = Math.max(floor, d.hambre - 5 * size.apetito * perMin);
    if (asleep) d.energia = Math.min(100, d.energia + 18 * perMin);
    else d.energia = Math.max(floor, d.energia - 2.5 * perMin);
    if (!asleep && d.energia <= 3 && !offline) {
      d.duermeHasta = t + 40;
      events.push({ tipo: 'duerme', dino: d.id });
    }

    let target = comfortOf(state, d).valor;
    if (d.hambre < 25) target -= 20;
    if (d.energia < 15) target -= 10;
    target = clamp(target, 0, 100);
    const drift = 4 * perMin;
    if (d.animo > target) d.animo = Math.max(target, d.animo - drift);
    else d.animo = Math.min(target, d.animo + drift * 0.5);
    d.animo = Math.max(floor, d.animo);

    if (!offline && (d.hambre < 10 || d.animo < 10)) d.salud = Math.max(0, d.salud - 3 * perMin);
    else d.salud = Math.min(100, d.salud + 1 * perMin);
    if (d.salud <= 0) {
      d.enClinica = true;
      d.peticion = null;
      events.push({ tipo: 'clinica', dino: d.id });
      log(state, `${d.nombre} fue llevado a la clínica`, '🏥');
      continue;
    }

    const before = stageOf(d);
    if (d.hambre > 10) d.edad += dt;
    const after = stageOf(d);
    if (after !== before) {
      events.push({ tipo: 'crece', dino: d.id, stage: after });
      if (after === 'adulto') {
        state.contadores.adultos += 1;
        d.peticion = null;
        log(state, `${d.nombre} ya es adulto`, '🦖');
      } else {
        log(state, `${d.nombre} ahora es juvenil`, '🌱');
      }
    }

    // Peticiones de crías y juveniles (vínculo).
    if (after !== 'adulto' && !offline) {
      if (d.peticion && d.peticion.expira <= t) {
        d.peticion = null;
        d.proxPeticion = t + 20 + rnd() * 15;
      }
      if (!d.peticion && t >= d.proxPeticion && !asleep) {
        d.peticion = { tipo: REQUESTS[Math.floor(rnd() * REQUESTS.length)], expira: t + 35 };
        events.push({ tipo: 'peticion', dino: d.id });
      }
    }
  }

  // Incubadora
  const slots = incubatorSlots(state);
  const speed = 1 + 0.25 * state.mejoras.rapida;
  let active = 0;
  for (const e of state.huevos) {
    if (active >= slots) { e.incubando = false; continue; }
    e.incubando = true;
    active += 1;
    if (e.progreso < e.duracion) {
      e.progreso = Math.min(e.duracion, e.progreso + dt * speed);
      if (!offline && !e.girar && e.progreso < e.duracion && t >= e.proxGiro) {
        e.girar = { expira: t + 14 };
      }
      if (e.girar && e.girar.expira <= t) {
        e.girar = null;
        e.proxGiro = t + 22 + rnd() * 10;
      }
      if (e.progreso >= e.duracion) {
        e.girar = null;
        events.push({ tipo: 'huevoListo', huevo: e.id });
      }
    }
  }

  // Visitantes
  const { ingresoMin } = parkStats(state);
  const income = ingresoMin * (dt / 60) * (offline ? 0.5 : 1);
  state._resto = (state._resto || 0) + income;
  if (state._resto >= 1) {
    const whole = Math.floor(state._resto);
    state._resto -= whole;
    addMoney(state, whole);
  }
  return events;
}

/** Aplica el tiempo que pasó con el juego cerrado. */
export function catchUp(state, now = Date.now()) {
  const elapsed = Math.min(OFFLINE_CAP_SEC, Math.max(0, (now - state.ultimo) / 1000));
  state.ultimo = now;
  if (elapsed < 5) return { segundos: 0, monedas: 0 };
  const money0 = state.monedas;
  let left = elapsed;
  while (left > 0) {
    const step = Math.min(10, left);
    tick(state, step, { offline: true });
    left -= step;
  }
  return { segundos: Math.round(elapsed), monedas: state.monedas - money0 };
}

// ------------------------------------------------------------------ cuidado

function findDino(state, id) {
  const d = state.dinos.find((x) => x.id === id);
  if (!d) throw new Error('Dinosaurio no encontrado');
  return d;
}

function fulfill(state, d, tipo) {
  if (d.peticion && d.peticion.tipo === tipo) {
    const sp = SPECIES_BY_ID[d.especie];
    const gain = requestGain(sp);
    d.vinculo = Math.min(100, d.vinculo + gain);
    d.peticion = null;
    d.proxPeticion = state.tiempoJuego + 25 + Math.random() * 15;
    state.contadores.peticiones += 1;
    addXp(state, 4);
    return gain;
  }
  return 0;
}

export function canEat(sp, foodId) {
  const food = FOODS[foodId];
  return DIETS[sp.dieta].categorias.includes(food.categoria);
}

export function feed(state, dinoId, foodId) {
  const d = findDino(state, dinoId);
  const sp = SPECIES_BY_ID[d.especie];
  const food = FOODS[foodId];
  if (!food) return { ok: false, msg: 'Esa comida no existe.' };
  if (d.enClinica) return { ok: false, msg: `${d.nombre} está en la clínica.` };
  if ((state.inventario.comida[foodId] || 0) <= 0) return { ok: false, msg: `No te quedan ${food.nombre.toLowerCase()}. Compra más en la tienda.` };
  if (!canEat(sp, foodId)) {
    state.contadores.rechazos += 1;
    const why = sp.dieta === 'herbivoro'
      ? `${sp.corto || sp.nombre} es herbívoro: sus dientes y su intestino estaban hechos para plantas.`
      : `${sp.corto || sp.nombre} es ${DIETS[sp.dieta].nombre.toLowerCase()}: no puede vivir de eso.`;
    return { ok: false, rechazo: true, msg: `¡Lo rechaza! ${why}` };
  }
  if (d.hambre >= 97) return { ok: false, msg: `${d.nombre} está lleno.` };
  state.inventario.comida[foodId] -= 1;
  const fav = sp.favoritos.includes(foodId);
  d.hambre = Math.min(100, d.hambre + food.saciedad * (fav ? 1.2 : 1));
  d.animo = Math.min(100, d.animo + (fav ? 8 : 3));
  state.contadores.alimentar += 1;
  addXp(state, 2);
  const vin = fulfill(state, d, 'comida');
  let extra = '';
  if (food.soloCretacico && sp.periodo !== 'cretacico') extra = ' Curioso: en su época todavía no existían las flores.';
  return { ok: true, fav, vinculo: vin, msg: `${d.nombre} comió ${food.nombre.toLowerCase()}${fav ? ' (¡su favorito!)' : ''}.${extra}` };
}

export function pet(state, dinoId) {
  const d = findDino(state, dinoId);
  if (d.enClinica) return { ok: false, msg: `${d.nombre} está en la clínica.` };
  if (d.duermeHasta > state.tiempoJuego) return { ok: false, msg: `${d.nombre} está durmiendo. ¡Shhh!` };
  d.animo = Math.min(100, d.animo + 6);
  state.contadores.caricias += 1;
  addXp(state, 1);
  const vin = fulfill(state, d, 'caricia');
  return { ok: true, vinculo: vin, msg: `${d.nombre} disfruta las caricias.` };
}

export function play(state, dinoId) {
  const d = findDino(state, dinoId);
  if (d.enClinica) return { ok: false, msg: `${d.nombre} está en la clínica.` };
  if (d.duermeHasta > state.tiempoJuego) return { ok: false, msg: `${d.nombre} está durmiendo.` };
  if (d.energia < 15) return { ok: false, msg: `${d.nombre} está muy cansado para jugar. Déjalo descansar.` };
  d.energia = Math.max(0, d.energia - 12);
  d.animo = Math.min(100, d.animo + 14);
  state.contadores.juegos += 1;
  addXp(state, 2);
  const vin = fulfill(state, d, 'juego');
  return { ok: true, vinculo: vin, msg: `${d.nombre} juega feliz.` };
}

export function rest(state, dinoId) {
  const d = findDino(state, dinoId);
  if (d.enClinica) return { ok: false, msg: `${d.nombre} está en la clínica.` };
  if (d.energia >= 95) return { ok: false, msg: `${d.nombre} no tiene sueño.` };
  d.duermeHasta = state.tiempoJuego + 30 + (100 - d.energia) * 0.4;
  return { ok: true, msg: `${d.nombre} se acurruca a dormir.` };
}

export function wake(state, dinoId) {
  const d = findDino(state, dinoId);
  d.duermeHasta = 0;
  return { ok: true, msg: `${d.nombre} despertó.` };
}

export function medicate(state, dinoId) {
  const d = findDino(state, dinoId);
  if (d.enClinica) {
    if (state.monedas < TREATMENT_PRICE) return { ok: false, msg: `El tratamiento cuesta ${TREATMENT_PRICE} monedas.` };
    addMoney(state, -TREATMENT_PRICE);
    d.enClinica = false;
    d.salud = 70;
    d.hambre = Math.max(d.hambre, 70);
    d.animo = Math.max(d.animo, 50);
    log(state, `${d.nombre} salió de la clínica`, '💚');
    return { ok: true, msg: `${d.nombre} recibió tratamiento y volvió al recinto.` };
  }
  if (state.inventario.medicina <= 0) return { ok: false, msg: 'No tienes medicina. Cómprala en la tienda.' };
  if (d.salud >= 95) return { ok: false, msg: `${d.nombre} está sano.` };
  state.inventario.medicina -= 1;
  d.salud = Math.min(100, d.salud + 50);
  return { ok: true, msg: `${d.nombre} se siente mejor.` };
}

export function rename(state, dinoId, nombre) {
  const d = findDino(state, dinoId);
  const clean = String(nombre || '').trim().slice(0, 18);
  if (!clean) return { ok: false, msg: 'Escribe un nombre.' };
  d.nombre = clean;
  return { ok: true, msg: `Ahora se llama ${clean}.` };
}

export function moveDino(state, dinoId, recintoId) {
  const d = findDino(state, dinoId);
  if (!state.recintos.find((r) => r.id === recintoId)) return { ok: false, msg: 'Ese recinto no existe.' };
  if (dinosIn(state, recintoId).length >= ENCLOSURE_CAPACITY) return { ok: false, msg: 'Ese recinto está lleno.' };
  d.recinto = recintoId;
  return { ok: true, msg: `${d.nombre} se mudó.` };
}

export function donate(state, dinoId) {
  const d = findDino(state, dinoId);
  const sp = SPECIES_BY_ID[d.especie];
  const value = Math.round(sp.fama * 25 * rarityScore(d.genes) * (stageOf(d) === 'adulto' ? 1 : 0.5));
  state.dinos = state.dinos.filter((x) => x.id !== d.id);
  addMoney(state, value);
  addXp(state, 10);
  log(state, `${d.nombre} se fue a vivir a un santuario`, '🏞️');
  return { ok: true, valor: value, msg: `${d.nombre} se mudó a un gran santuario. Recibiste ${value} monedas de apoyo.` };
}

// ------------------------------------------------------------------ genoma y huevos

export function addDna(state, especie, pct) {
  const before = state.genoma[especie] || 0;
  state.genoma[especie] = clamp(Math.round((before + pct) * 10) / 10, 0, 100);
  return { antes: before, despues: state.genoma[especie] };
}

export function eggPrice(especie) {
  return EGG_PRICE[SPECIES_BY_ID[especie].rareza];
}

function pushEgg(state, especie, genes, viabilidad, origen) {
  const sp = SPECIES_BY_ID[especie];
  const egg = {
    id: newId('hv'),
    especie,
    genes,
    viabilidad: clamp(viabilidad, 0.1, 1),
    progreso: 0,
    duracion: SIZE_CLASS[sp.tamano].incubaSeg,
    girar: null,
    proxGiro: state.tiempoJuego + 15,
    origen,
    incubando: false,
  };
  state.huevos.push(egg);
  return egg;
}

export function synthesizeEgg(state, especie, rnd = Math.random) {
  const sp = SPECIES_BY_ID[especie];
  const g = state.genoma[especie] || 0;
  if (g < 50) return { ok: false, msg: `Necesitas al menos 50 % del genoma de ${sp.corto || sp.nombre}.` };
  const price = eggPrice(especie);
  if (state.monedas < price) return { ok: false, msg: `Sintetizar este huevo cuesta ${price} monedas.` };
  addMoney(state, -price);
  const genes = wildGenes(sp, g, rnd);
  const viab = 0.5 + 0.5 * ((g - 50) / 50);
  const egg = pushEgg(state, especie, genes, viab, 'adn');
  state.contadores.huevosSintetizados += 1;
  addXp(state, 10);
  return { ok: true, huevo: egg, msg: `Huevo de ${sp.corto || sp.nombre} listo. Viabilidad ${Math.round(egg.viabilidad * 100)} %.` };
}

export function turnEgg(state, eggId) {
  const e = state.huevos.find((x) => x.id === eggId);
  if (!e || !e.girar) return { ok: false, msg: 'Este huevo no necesita girarse ahora.' };
  e.girar = null;
  e.proxGiro = state.tiempoJuego + 22 + Math.random() * 10;
  e.viabilidad = Math.min(1, e.viabilidad + 0.05);
  addXp(state, 2);
  return { ok: true, msg: 'Giraste el huevo: así el embrión no se pega a la cáscara. +5 % viabilidad.' };
}

export function bestEnclosureFor(state, especie) {
  const sp = SPECIES_BY_ID[especie];
  const withRoom = state.recintos.filter((r) => dinosIn(state, r.id).length < ENCLOSURE_CAPACITY);
  if (!withRoom.length) return null;
  const score = (r) => (r.bioma === sp.bioma ? 3 : sp.biomas.includes(r.bioma) ? 2 : 0)
    + (dinosIn(state, r.id).some((d) => d.especie === especie) ? 1 : 0);
  return withRoom.sort((a, b) => score(b) - score(a))[0];
}

export function hatch(state, eggId, rnd = Math.random) {
  const e = state.huevos.find((x) => x.id === eggId);
  if (!e) return { ok: false, msg: 'Huevo no encontrado.' };
  if (e.progreso < e.duracion) return { ok: false, msg: 'Todavía no está listo.' };
  const sp = SPECIES_BY_ID[e.especie];
  const rec = bestEnclosureFor(state, e.especie);
  if (!rec) return { ok: false, msg: 'No hay espacio en ningún recinto. Construye otro o muda a alguien.' };
  state.huevos = state.huevos.filter((x) => x.id !== e.id);
  if (rnd() > e.viabilidad) {
    const refund = e.origen === 'adn' ? Math.round(eggPrice(e.especie) / 2) : 0;
    addMoney(state, refund);
    addDna(state, e.especie, 3);
    return { ok: true, fallido: true, msg: `El huevo de ${sp.corto || sp.nombre} no era viable. Recuperaste ${refund} monedas y algo de ADN. Con más genoma, los huevos son más fuertes.` };
  }
  const d = makeDino(state, e.especie, e.genes, rec.id);
  if (e.padres) d.padres = e.padres;
  state.dinos.push(d);
  state.contadores.eclosiones += 1;
  addXp(state, 20);
  log(state, `¡Nació ${d.nombre}, un ${sp.corto || sp.nombre}!`, '🐣');
  return { ok: true, dino: d, recinto: rec, msg: `¡Nació un ${sp.corto || sp.nombre}! Vive en ${rec.nombre}.` };
}

export function chooseStarter(state, especie) {
  if (!STARTERS.includes(especie)) return { ok: false, msg: 'Elige uno de los huevos iniciales.' };
  const sp = SPECIES_BY_ID[especie];
  state.genoma[especie] = 50;
  // El primer recinto se adapta al hábitat del huevo inicial.
  const first = state.recintos[0];
  if (first && dinosIn(state, first.id).length === 0) {
    first.bioma = sp.bioma;
    first.nombre = `Recinto ${BIOMES[sp.bioma].nombre.split(' ')[0]}`;
  }
  const genes = wildGenes(sp, 70);
  const egg = pushEgg(state, especie, genes, 1, 'regalo');
  state.iniciado = true;
  log(state, `Recibiste un huevo de ${sp.nombre}`, '🥚');
  return { ok: true, huevo: egg };
}

// ------------------------------------------------------------------ cría

export function canBreed(state, a, b) {
  if (!a || !b) return { ok: false, msg: 'Elige dos dinosaurios.' };
  if (a.id === b.id) return { ok: false, msg: 'Elige dos dinosaurios distintos.' };
  if (a.especie !== b.especie) return { ok: false, msg: 'Solo se pueden cruzar dinosaurios de la misma especie.' };
  if (a.genes.sexo === b.genes.sexo) return { ok: false, msg: 'Necesitas un macho y una hembra.' };
  if (stageOf(a) !== 'adulto' || stageOf(b) !== 'adulto') return { ok: false, msg: 'Ambos deben ser adultos.' };
  for (const d of [a, b]) {
    if (d.enClinica) return { ok: false, msg: `${d.nombre} está en la clínica.` };
    if (d.animo < 60) return { ok: false, msg: `${d.nombre} necesita ánimo de 60 o más.` };
    if (d.salud < 50) return { ok: false, msg: `${d.nombre} necesita estar más sano.` };
    if (d.criaListo > state.tiempoJuego) return { ok: false, msg: `${d.nombre} necesita descansar ${Math.ceil(d.criaListo - state.tiempoJuego)} s más.` };
  }
  return { ok: true };
}

export function breedPair(state, aId, bId, rnd = Math.random) {
  const a = findDino(state, aId);
  const b = findDino(state, bId);
  const check = canBreed(state, a, b);
  if (!check.ok) return check;
  const genes = breedGenes(a.genes, b.genes, rnd);
  const egg = pushEgg(state, a.especie, genes, 0.92, 'cria');
  egg.padres = [a.id, b.id];
  a.criaListo = state.tiempoJuego + BREED_COOLDOWN_SEC;
  b.criaListo = state.tiempoJuego + BREED_COOLDOWN_SEC;
  state.contadores.cruces += 1;
  addXp(state, 25);
  const sp = SPECIES_BY_ID[a.especie];
  const mut = genes.mutadas && genes.mutadas.length ? ` ¡Hubo ${genes.mutadas.length} mutación(es)!` : '';
  log(state, `${a.nombre} y ${b.nombre} pusieron un huevo`, '🪺');
  return { ok: true, huevo: egg, msg: `${a.nombre} y ${b.nombre} pusieron un huevo de ${sp.corto || sp.nombre}.${mut}` };
}

// ------------------------------------------------------------------ tienda

export function buyFood(state, foodId, qty = 1) {
  const food = FOODS[foodId];
  const cost = food.precio * qty;
  if (state.monedas < cost) return { ok: false, msg: 'No te alcanzan las monedas.' };
  addMoney(state, -cost);
  state.inventario.comida[foodId] = (state.inventario.comida[foodId] || 0) + qty;
  return { ok: true, msg: `Compraste ${qty} × ${food.nombre.toLowerCase()}.` };
}

export function buyMedicine(state) {
  if (state.monedas < MEDICINE.precio) return { ok: false, msg: 'No te alcanzan las monedas.' };
  addMoney(state, -MEDICINE.precio);
  state.inventario.medicina += 1;
  return { ok: true, msg: 'Compraste medicina.' };
}

export function buildEnclosure(state, bioma) {
  if (state.nivel < ENCLOSURE_LEVEL[bioma]) return { ok: false, msg: `Disponible en el nivel ${ENCLOSURE_LEVEL[bioma]}.` };
  const cost = ENCLOSURE_COST[bioma];
  if (state.monedas < cost) return { ok: false, msg: `Construirlo cuesta ${cost} monedas.` };
  addMoney(state, -cost);
  const n = state.recintos.filter((r) => r.bioma === bioma).length + 1;
  const rec = { id: newId('r'), bioma, nombre: `Recinto ${BIOMES[bioma].nombre.split(' ')[0]}${n > 1 ? ` ${n}` : ''}`, enriquecimiento: [] };
  state.recintos.push(rec);
  addXp(state, 30);
  log(state, `Construiste ${rec.nombre}`, '🏗️');
  return { ok: true, recinto: rec, msg: `¡${rec.nombre} construido!` };
}

export function buyEnrichment(state, recintoId, itemId) {
  const rec = state.recintos.find((r) => r.id === recintoId);
  const item = ENRICHMENT[itemId];
  if (!rec || !item) return { ok: false, msg: 'Objeto o recinto no válido.' };
  if (rec.enriquecimiento.includes(itemId)) return { ok: false, msg: 'Ese recinto ya lo tiene.' };
  if (rec.enriquecimiento.length >= MAX_ENRICHMENT) return { ok: false, msg: `Máximo ${MAX_ENRICHMENT} objetos por recinto.` };
  if (state.monedas < item.precio) return { ok: false, msg: 'No te alcanzan las monedas.' };
  addMoney(state, -item.precio);
  rec.enriquecimiento.push(itemId);
  addXp(state, 6);
  return { ok: true, msg: `${item.nombre} instalado. ${item.dato}` };
}

export function buyUpgrade(state, key) {
  const up = UPGRADES[key];
  const lvl = state.mejoras[key];
  if (lvl >= up.precios.length) return { ok: false, msg: 'Ya está al máximo.' };
  const cost = up.precios[lvl];
  if (state.monedas < cost) return { ok: false, msg: `Cuesta ${cost} monedas.` };
  addMoney(state, -cost);
  state.mejoras[key] += 1;
  addXp(state, 15);
  return { ok: true, msg: `${up.nombre} mejorado.` };
}

export function sellCurio(state, curioId) {
  const c = CURIOS.find((x) => x.id === curioId);
  const have = state.inventario.curios[curioId] || 0;
  if (!c || have <= 0) return { ok: false, msg: 'No tienes ese hallazgo.' };
  state.inventario.curios[curioId] = have - 1;
  addMoney(state, c.valor);
  return { ok: true, msg: `Un museo compró tu ${c.nombre.toLowerCase()} por ${c.valor} monedas.` };
}

export function markRead(state, especie) {
  if (!state.leidos.includes(especie)) {
    state.leidos.push(especie);
    addXp(state, 3);
    return true;
  }
  return false;
}

export function rarityLabel(especie) {
  return RARITY[SPECIES_BY_ID[especie].rareza];
}

export function isRareVariant(dino) {
  return variantOf(dino.genes.variante) !== 'N';
}
