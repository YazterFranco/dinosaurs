// Misiones (tutorial guiado) y logros.
import { SPECIES } from '../data/species.js';
import { SITES } from '../data/world.js';
import { stageOf, addMoney, addXp, ownedSpecies, isRareVariant, log } from './game.js';

const c = (s) => s.contadores;
const maxGenome = (s) => Math.max(0, ...Object.values(s.genoma));

// Cadena del tutorial: se muestra la primera no completada.
export const MISSIONS = [
  { id: 'eclosion1', titulo: 'Tu primer huevo', desc: 'Ve al Criadero y espera a que eclosione tu huevo inicial.', ir: 'criadero', premio: 80, xp: 15, check: (s) => c(s).eclosiones >= 1 },
  { id: 'alimentar3', titulo: 'Hora de comer', desc: 'Alimenta 3 veces a tus dinosaurios con la comida de su dieta.', ir: 'parque', premio: 50, xp: 10, check: (s) => c(s).alimentar >= 3 },
  { id: 'peticion2', titulo: 'Vínculo especial', desc: 'Atiende 2 peticiones de una cría (la burbuja sobre su cabeza).', ir: 'parque', premio: 60, xp: 15, check: (s) => c(s).peticiones >= 2 },
  { id: 'dinopedia1', titulo: 'Aprende algo nuevo', desc: 'Abre una ficha de la Dinopedia.', ir: 'dinopedia', premio: 40, xp: 10, check: (s) => s.leidos.length >= 1 },
  { id: 'excavar1', titulo: 'Paleontólogo en acción', desc: 'Excava en un yacimiento y recupera fósiles.', ir: 'excavar', premio: 80, xp: 20, check: (s) => c(s).excavaciones >= 1 },
  { id: 'adn50', titulo: 'Medio genoma', desc: 'Reúne 50 % del genoma de una especie nueva.', ir: 'excavar', premio: 80, xp: 20, check: (s) => Object.entries(s.genoma).filter(([, v]) => v >= 50).length >= 2 },
  { id: 'sintetizar1', titulo: 'Clonación', desc: 'Sintetiza un huevo con ADN en el Criadero.', ir: 'criadero', premio: 60, xp: 15, check: (s) => c(s).huevosSintetizados >= 1 },
  { id: 'quiz1', titulo: 'Examen de paleontología', desc: 'Completa un quiz.', ir: 'quiz', premio: 80, xp: 20, check: (s) => c(s).quizzes >= 1 },
  { id: 'adulto1', titulo: '¡Ya es grande!', desc: 'Cría un dinosaurio hasta que sea adulto.', ir: 'parque', premio: 150, xp: 30, check: (s) => c(s).adultos >= 1 },
  { id: 'enriquecer1', titulo: 'Recinto feliz', desc: 'Instala un objeto de enriquecimiento en un recinto.', ir: 'tienda', premio: 60, xp: 15, check: (s) => s.recintos.some((r) => r.enriquecimiento.length > 0) },
  { id: 'recinto2', titulo: 'Nuevo hábitat', desc: 'Construye un segundo recinto.', ir: 'tienda', premio: 150, xp: 30, check: (s) => s.recintos.length >= 2 },
  { id: 'cruce1', titulo: 'La vida se abre camino', desc: 'Cruza un macho y una hembra adultos de la misma especie.', ir: 'criadero', premio: 200, xp: 40, check: (s) => c(s).cruces >= 1 },
  { id: 'concurso1', titulo: 'Campeón', desc: 'Gana un concurso.', ir: 'concursos', premio: 200, xp: 40, check: (s) => c(s).concursosGanados >= 1 },
  { id: 'especies5', titulo: 'Refugio variado', desc: 'Ten 5 especies distintas viviendo en el refugio.', ir: 'parque', premio: 300, xp: 60, check: (s) => ownedSpecies(s).length >= 5 },
];

export const ACHIEVEMENTS = [
  { id: 'col10', icono: '📚', titulo: 'Coleccionista', desc: 'Descubre 10 especies en la Dinopedia.', check: (s) => Object.keys(s.genoma).length >= 10 },
  { id: 'col20', icono: '🦴', titulo: 'Curador', desc: 'Descubre 20 especies.', check: (s) => Object.keys(s.genoma).length >= 20 },
  { id: 'colAll', icono: '🏛️', titulo: 'Museo completo', desc: `Descubre las ${SPECIES.length} especies.`, check: (s) => Object.keys(s.genoma).length >= SPECIES.length },
  { id: 'genoma100', icono: '🧬', titulo: 'Genoma completo', desc: 'Completa el 100 % del genoma de una especie.', check: (s) => maxGenome(s) >= 100 },
  { id: 'variante', icono: '🌟', titulo: 'Rareza genética', desc: 'Cría un albino, melanístico o leucístico.', check: (s) => s.dinos.some(isRareVariant) },
  { id: 'mutacion', icono: '🧪', titulo: 'Mutante', desc: 'Obtén una cría con una mutación.', check: (s) => s.dinos.some((d) => (d.genes.mutaciones || 0) > 0) },
  { id: 'gen3', icono: '🌳', titulo: 'Árbol genealógico', desc: 'Cría un dinosaurio de tercera generación.', check: (s) => s.dinos.some((d) => (d.genes.generacion || 1) >= 3) },
  { id: 'vinculo100', icono: '💞', titulo: 'Mejores amigos', desc: 'Llega a 100 % de vínculo con un dinosaurio.', check: (s) => s.dinos.some((d) => d.vinculo >= 100) },
  { id: 'quizPerfecto', icono: '🎓', titulo: 'Sabelotodo', desc: 'Responde un quiz sin errores.', check: (s) => c(s).quizPerfecto >= 1 },
  { id: 'excavador', icono: '⛏️', titulo: 'Excavador incansable', desc: 'Haz 20 excavaciones.', check: (s) => c(s).excavaciones >= 20 },
  { id: 'trotamundos', icono: '🌍', titulo: 'Trotamundos', desc: 'Excava en todos los continentes.', check: (s) => new Set(s.sitiosVisitados.map((id) => SITES.find((x) => x.id === id).continente)).size >= 5 },
  { id: 'curios10', icono: '🐚', titulo: 'Gabinete de curiosidades', desc: 'Encuentra 10 hallazgos sueltos.', check: (s) => c(s).curios >= 10 },
  { id: 'campeon5', icono: '🏆', titulo: 'Leyenda de la arena', desc: 'Gana 5 concursos.', check: (s) => c(s).concursosGanados >= 5 },
  { id: 'gigantes', icono: '🦕', titulo: 'Tierra de gigantes', desc: 'Ten un dinosaurio gigante adulto.', check: (s) => s.dinos.some((d) => SPECIES.find((x) => x.id === d.especie).tamano === 'gigante' && stageOf(d) === 'adulto') },
  { id: 'nivel10', icono: '⭐', titulo: 'Refugio de prestigio', desc: 'Llega al nivel 10.', check: (s) => s.nivel >= 10 },
];

export function currentMission(state) {
  return MISSIONS.find((m) => !state.misiones.includes(m.id)) || null;
}

/** Completa misiones y logros que ya se cumplen. Devuelve lo nuevo. */
export function checkProgress(state) {
  const done = [];
  for (const m of MISSIONS) {
    if (state.misiones.includes(m.id)) continue;
    if (m.check(state)) {
      state.misiones.push(m.id);
      addMoney(state, m.premio);
      addXp(state, m.xp);
      log(state, `Misión cumplida: ${m.titulo}`, '✅');
      done.push({ tipo: 'mision', ...m });
    } else break; // en orden, una a la vez
  }
  for (const a of ACHIEVEMENTS) {
    if (state.logros.includes(a.id)) continue;
    if (a.check(state)) {
      state.logros.push(a.id);
      addMoney(state, 100);
      addXp(state, 25);
      log(state, `Logro: ${a.titulo}`, a.icono);
      done.push({ tipo: 'logro', ...a });
    }
  }
  return done;
}
