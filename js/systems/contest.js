// Concursos: dan un objetivo a la crianza de mejores ejemplares.
import { SPECIES, SPECIES_BY_ID } from '../data/species.js';
import { effectiveStats, stageOf, addMoney, addXp, CONTEST_COOLDOWN_SEC, log } from './game.js';
import { rarityScore, dominantPattern } from './genetics.js';

export const CONTESTS = {
  carrera: {
    nombre: 'Carrera', icono: '🏁', energia: 30,
    desc: 'Gana el más rápido. Cuenta la velocidad y la energía.',
    dato: 'Se estima que algunos ornitomímidos corrían a más de 40 km/h; el T. rex adulto, mucho menos.',
  },
  fuerza: {
    nombre: 'Fuerza', icono: '💪', energia: 30,
    desc: 'Empujar un tronco gigante. Cuentan la fuerza y el tamaño.',
    dato: 'La fuerza de un animal crece con su tamaño, pero no al mismo ritmo que su peso.',
  },
  belleza: {
    nombre: 'Belleza', icono: '✨', energia: 15,
    desc: 'Los visitantes votan. Cuentan rareza, patrón y ánimo.',
    dato: 'Muchos dinosaurios usaban crestas, golas y plumas para exhibirse, como las aves de hoy.',
  },
  ingenio: {
    nombre: 'Ingenio', icono: '🧩', energia: 20,
    desc: 'Encontrar comida escondida. Cuentan el intelecto y el vínculo.',
    dato: 'Los troodóntidos tenían el cerebro más grande en proporción a su cuerpo entre los dinosaurios.',
  },
};

export function contestScore(state, dino, tipo) {
  const s = effectiveStats(dino);
  switch (tipo) {
    case 'carrera': return s.velocidad * 0.75 + dino.energia * 0.25;
    case 'fuerza': return s.fuerza * 0.65 + s.tamano * 0.35;
    case 'belleza': return 25 * rarityScore(dino.genes) + (dominantPattern(dino.genes.patron) !== 'liso' ? 10 : 0) + dino.animo * 0.45;
    case 'ingenio': return s.intelecto * 0.7 + dino.vinculo * 0.3;
    default: return 0;
  }
}

export function canEnter(state, dino, tipo) {
  const c = CONTESTS[tipo];
  if (stageOf(dino) === 'cria') return { ok: false, msg: 'Las crías todavía no compiten.' };
  if (dino.enClinica) return { ok: false, msg: `${dino.nombre} está en la clínica.` };
  if (dino.duermeHasta > state.tiempoJuego) return { ok: false, msg: `${dino.nombre} está durmiendo.` };
  if (dino.energia < c.energia) return { ok: false, msg: `${dino.nombre} necesita ${c.energia} de energía.` };
  if (dino.concursoListo > state.tiempoJuego) return { ok: false, msg: `${dino.nombre} descansa ${Math.ceil(dino.concursoListo - state.tiempoJuego)} s más.` };
  return { ok: true };
}

const RIVAL_NAMES = ['Garra', 'Colmillo', 'Pluma', 'Roca', 'Centella', 'Hoja', 'Zarpa', 'Bruma', 'Cometa'];

export function runContest(state, dinoId, tipo, rnd = Math.random) {
  const dino = state.dinos.find((d) => d.id === dinoId);
  const check = canEnter(state, dino, tipo);
  if (!check.ok) return check;
  const c = CONTESTS[tipo];
  dino.energia -= c.energia;
  dino.concursoListo = state.tiempoJuego + CONTEST_COOLDOWN_SEC;
  state.contadores.concursos += 1;

  const mine = contestScore(state, dino, tipo) + rnd() * 18;
  const base = 38 + state.nivel * 4.5;
  const rivals = [0, 1, 2].map(() => {
    const sp = SPECIES[Math.floor(rnd() * SPECIES.length)];
    return {
      nombre: RIVAL_NAMES[Math.floor(rnd() * RIVAL_NAMES.length)],
      especie: sp.id,
      puntos: Math.max(5, base + (rnd() - 0.5) * 34),
      rival: true,
    };
  });
  const tabla = [{ nombre: dino.nombre, especie: dino.especie, puntos: mine, tuyo: true }, ...rivals]
    .sort((a, b) => b.puntos - a.puntos);
  const puesto = tabla.findIndex((x) => x.tuyo) + 1;
  const premios = { 1: 120 + state.nivel * 20, 2: 50 + state.nivel * 6, 3: 20 };
  const premio = premios[puesto] || 0;
  addMoney(state, premio);
  addXp(state, puesto === 1 ? 30 : 10);
  if (puesto === 1) {
    state.contadores.concursosGanados += 1;
    dino.trofeos.push(tipo);
    log(state, `${dino.nombre} ganó el concurso de ${c.nombre.toLowerCase()}`, '🏆');
  }
  const sp = SPECIES_BY_ID[dino.especie];
  return { ok: true, tabla, puesto, premio, msg: `${dino.nombre} (${sp.corto || sp.nombre}) quedó en el puesto ${puesto}.` };
}
