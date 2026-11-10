// Preguntas del quiz: unas fijas sobre temas generales y otras generadas
// a partir de la Dinopedia.
import { SPECIES, PERIODS, DIETS } from './species.js';

export const GENERAL_QUESTIONS = [
  {
    q: '¿Qué animales vivos hoy son dinosaurios?',
    opciones: ['Las aves', 'Los cocodrilos', 'Las lagartijas', 'Las tortugas'],
    ok: 0,
    explica: 'Las aves descienden de terópodos emplumados: son dinosaurios vivos.',
  },
  {
    q: '¿Hace cuánto se extinguieron los dinosaurios no avianos?',
    opciones: ['66 millones de años', '6.600 años', '1 millón de años', '660 millones de años'],
    ok: 0,
    explica: 'Un asteroide de unos 10 km cayó en Chicxulub (México) hace 66 millones de años.',
  },
  {
    q: '¿Dónde cayó el asteroide que acabó con la era de los dinosaurios?',
    opciones: ['Península de Yucatán, México', 'Sahara, África', 'Siberia, Rusia', 'Australia'],
    ok: 0,
    explica: 'El cráter de Chicxulub mide unos 180 km y está bajo la península de Yucatán.',
  },
  {
    q: '¿En qué orden van los periodos del Mesozoico?',
    opciones: ['Triásico → Jurásico → Cretácico', 'Jurásico → Triásico → Cretácico', 'Cretácico → Jurásico → Triásico', 'Triásico → Cretácico → Jurásico'],
    ok: 0,
    explica: 'Triásico (252–201 Ma), Jurásico (201–145 Ma) y Cretácico (145–66 Ma).',
  },
  {
    q: '¿Qué es un paleontólogo?',
    opciones: ['Quien estudia la vida antigua a través de fósiles', 'Quien estudia rocas volcánicas', 'Quien estudia las estrellas', 'Quien estudia los océanos actuales'],
    ok: 0,
    explica: 'La paleontología estudia fósiles para entender la vida del pasado.',
  },
  {
    q: '¿Convivieron los humanos con los dinosaurios no avianos?',
    opciones: ['No, nos separan más de 60 millones de años', 'Sí, en la Edad de Piedra', 'Sí, en el antiguo Egipto', 'Solo con los más pequeños'],
    ok: 0,
    explica: 'Los primeros humanos aparecieron hace unos 300.000 años, mucho después.',
  },
  {
    q: '¿Qué es un coprolito?',
    opciones: ['Popó fosilizada', 'Un huevo fosilizado', 'Un diente roto', 'Un tipo de roca volcánica'],
    ok: 0,
    explica: 'Los coprolitos revelan qué comían los animales del pasado.',
  },
  {
    q: '¿Qué plantas NO existían en el Jurásico?',
    opciones: ['Plantas con flor', 'Helechos', 'Coníferas', 'Cícadas'],
    ok: 0,
    explica: 'Las plantas con flor aparecieron en el Cretácico.',
  },
  {
    q: '¿Cómo era el mundo en el Triásico?',
    opciones: ['Un solo supercontinente: Pangea', 'Igual que hoy', 'Cubierto de hielo', 'Siete continentes separados'],
    ok: 0,
    explica: 'Pangea comenzó a separarse en el Jurásico.',
  },
  {
    q: 'Pteranodon y Mosasaurus eran…',
    opciones: ['Reptiles que NO eran dinosaurios', 'Dinosaurios voladores y marinos', 'Aves primitivas', 'Mamíferos'],
    ok: 0,
    explica: 'Los pterosaurios y los mosasaurios son grupos distintos de los dinosaurios.',
  },
  {
    q: '¿Cómo se sabe el color de algunos dinosaurios?',
    opciones: ['Por melanosomas fosilizados en las plumas', 'Por pinturas rupestres', 'Por el color de los huesos', 'No hay ninguna forma'],
    ok: 0,
    explica: 'En fósiles muy bien conservados, como Microraptor, se ven las estructuras que daban color.',
  },
  {
    q: '¿Qué significa "dinosaurio"?',
    opciones: ['Lagarto terrible', 'Lagarto gigante', 'Reptil antiguo', 'Bestia veloz'],
    ok: 0,
    explica: 'Richard Owen inventó la palabra en 1842 a partir del griego deinos (terrible) y sauros (lagarto).',
  },
];

function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOthers(pool, correct, n, rnd) {
  return shuffle(pool.filter((x) => x !== correct), rnd).slice(0, n);
}

// Genera una pregunta a partir de una especie.
export function questionFromSpecies(s, rnd = Math.random) {
  const tipo = Math.floor(rnd() * 5);
  const nombre = s.corto || s.nombre;
  if (tipo === 0) {
    const ok = PERIODS[s.periodo].nombre;
    const opciones = shuffle([ok, ...pickOthers(Object.values(PERIODS).map((p) => p.nombre), ok, 2, rnd)], rnd);
    return { q: `¿En qué periodo vivió ${nombre}?`, opciones, ok: opciones.indexOf(ok), explica: `${nombre} vivió en el ${PERIODS[s.periodo].nombre} ${s.fase}, hace ${s.ma[0]}–${s.ma[1]} millones de años.` };
  }
  if (tipo === 1) {
    const ok = DIETS[s.dieta].nombre;
    const opciones = shuffle([ok, ...pickOthers(['Carnívoro', 'Herbívoro', 'Omnívoro', 'Piscívoro'], ok, 3, rnd)], rnd);
    return { q: `¿Qué comía ${nombre}?`, opciones, ok: opciones.indexOf(ok), explica: `${nombre} era ${DIETS[s.dieta].nombre.toLowerCase()}.` };
  }
  if (tipo === 2) {
    const ok = s.significado;
    const pool = SPECIES.map((x) => x.significado);
    const opciones = shuffle([ok, ...pickOthers(pool, ok, 3, rnd)], rnd);
    return { q: `¿Qué significa el nombre "${s.nombre}"?`, opciones, ok: opciones.indexOf(ok), explica: `"${s.nombre}" significa "${s.significado}".` };
  }
  if (tipo === 3) {
    const ok = s.continente;
    const pool = [...new Set(SPECIES.map((x) => x.continente))];
    const opciones = shuffle([ok, ...pickOthers(pool, ok, 3, rnd)], rnd);
    return { q: `¿En qué continente se encontró ${nombre}?`, opciones, ok: opciones.indexOf(ok), explica: `Se encontró en ${s.pais} (${s.formacion}).` };
  }
  const ok = `${s.longitudM} m`;
  const distract = shuffle(SPECIES.filter((x) => Math.abs(x.longitudM - s.longitudM) > s.longitudM * 0.4), rnd)
    .slice(0, 3).map((x) => `${x.longitudM} m`);
  const opciones = shuffle([ok, ...new Set(distract)], rnd);
  return { q: `¿Cuánto medía aproximadamente ${nombre} de largo?`, opciones, ok: opciones.indexOf(ok), explica: `${nombre} medía unos ${s.longitudM} metros${s.medidaNota ? ` (${s.medidaNota.toLowerCase()})` : ''}.` };
}

export function buildQuiz(knownIds, n = 5, rnd = Math.random) {
  const known = SPECIES.filter((s) => knownIds.includes(s.id));
  const pool = known.length >= 3 ? known : SPECIES.slice(0, 8);
  const out = [];
  const general = shuffle(GENERAL_QUESTIONS, rnd);
  for (let i = 0; i < n; i += 1) {
    if (i % 2 === 1 && general.length) {
      const g = general.pop();
      const order = shuffle(g.opciones.map((o, idx) => idx), rnd);
      out.push({ q: g.q, opciones: order.map((idx) => g.opciones[idx]), ok: order.indexOf(g.ok), explica: g.explica });
    } else {
      out.push(questionFromSpecies(pool[Math.floor(rnd() * pool.length)], rnd));
    }
  }
  return out;
}
