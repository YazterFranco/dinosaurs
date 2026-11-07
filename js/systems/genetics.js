// Genética del refugio.
//
// - Patrón: un locus con dominancia completa  rayas > manchas > bandas > moteado > liso.
// - Variante: un locus con alelo normal "N" dominante y tres recesivos:
//   "a" albino, "m" melanístico, "l" leucístico. Solo se expresan en homocigosis.
// - Color: dos tonos (hue) que se heredan mezclando los de los padres.
// - Estadísticas: cada una viene de uno de los padres (55 % del mayor),
//   con probabilidad de mutación como en ARK.

export const PATTERNS = ['rayas', 'manchas', 'bandas', 'moteado', 'liso'];
export const PATTERN_NAMES = {
  rayas: 'Rayas', manchas: 'Manchas', bandas: 'Bandas', moteado: 'Moteado', liso: 'Liso',
};
export const VARIANTS = { N: 'Normal', a: 'Albino', m: 'Melanístico', l: 'Leucístico' };
export const VARIANT_INFO = {
  a: 'Sin pigmento: piel blanca y ojos rojizos. En la naturaleza es muy raro.',
  m: 'Exceso de pigmento oscuro: casi negro. Ocurre en leopardos y serpientes.',
  l: 'Pigmento reducido pero ojos normales: tonos pálidos y suaves.',
};
export const STAT_KEYS = ['tamano', 'fuerza', 'velocidad', 'vitalidad', 'intelecto'];
export const STAT_NAMES = {
  tamano: 'Tamaño', fuerza: 'Fuerza', velocidad: 'Velocidad', vitalidad: 'Vitalidad', intelecto: 'Intelecto',
};

const MUTATION_ROLLS = 3;
const MUTATION_CHANCE = 0.05;
const HIGHER_PARENT_CHANCE = 0.55;

export function rng(seed) {
  // mulberry32: aleatorio reproducible
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapHue = (h) => ((Math.round(h) % 360) + 360) % 360;

export function dominantPattern(alleles) {
  return PATTERNS[Math.min(PATTERNS.indexOf(alleles[0]), PATTERNS.indexOf(alleles[1]))];
}

export function variantOf(alleles) {
  const [x, y] = alleles;
  if (x === y && x !== 'N') return x;
  return 'N';
}

export function isCarrier(alleles) {
  return variantOf(alleles) === 'N' && alleles.some((a) => a !== 'N');
}

function circularMix(h1, h2, r) {
  let d = ((h2 - h1 + 540) % 360) - 180;
  return wrapHue(h1 + d * r);
}

function pickPatternAllele(species, rnd) {
  const prefersStripes = species.look.feat && species.look.feat.stripes;
  const roll = rnd();
  if (prefersStripes && roll < 0.45) return 'rayas';
  if (roll < 0.55) return 'liso';
  return PATTERNS[Math.floor(rnd() * PATTERNS.length)];
}

function pickVariantAllele(rnd) {
  const roll = rnd();
  if (roll < 0.9) return 'N';
  return ['a', 'm', 'l'][Math.floor(rnd() * 3)];
}

/**
 * Genes de un huevo sintetizado desde ADN fósil.
 * Un genoma más completo da estadísticas mínimas más altas.
 */
export function wildGenes(species, genomePct, rnd = Math.random) {
  const [h1, h2] = species.look.colors;
  const quality = clamp((genomePct - 50) / 50, 0, 1); // 0 con 50 %, 1 con 100 %
  const stats = {};
  for (const k of STAT_KEYS) {
    const base = species.stats[k];
    const f = 0.72 + quality * 0.18 + rnd() * 0.2; // 0.72–1.10
    stats[k] = clamp(Math.round(base * f), 1, 150);
  }
  return {
    seed: Math.floor(rnd() * 1e9),
    sexo: rnd() < 0.5 ? 'M' : 'H',
    hue1: wrapHue(h1 + (rnd() - 0.5) * 30),
    hue2: wrapHue(h2 + (rnd() - 0.5) * 30),
    sat: Math.round(36 + rnd() * 18),
    luz: Math.round(40 + rnd() * 14),
    patron: [pickPatternAllele(species, rnd), pickPatternAllele(species, rnd)],
    variante: [pickVariantAllele(rnd), pickVariantAllele(rnd)],
    stats,
    mutaciones: 0,
    generacion: 1,
  };
}

/** Cruza dos progenitores y devuelve los genes de la cría. */
export function breed(a, b, rnd = Math.random) {
  const stats = {};
  for (const k of STAT_KEYS) {
    const hi = Math.max(a.stats[k], b.stats[k]);
    const lo = Math.min(a.stats[k], b.stats[k]);
    stats[k] = rnd() < HIGHER_PARENT_CHANCE ? hi : lo;
  }
  let hue1 = circularMix(a.hue1, b.hue1, rnd()) + (rnd() - 0.5) * 12;
  let hue2 = circularMix(a.hue2, b.hue2, rnd()) + (rnd() - 0.5) * 12;
  let mutaciones = Math.max(a.mutaciones || 0, b.mutaciones || 0);
  const mutadas = [];
  for (let i = 0; i < MUTATION_ROLLS; i += 1) {
    if (rnd() < MUTATION_CHANCE) {
      mutaciones += 1;
      if (rnd() < 0.75) {
        const k = STAT_KEYS[Math.floor(rnd() * STAT_KEYS.length)];
        const plus = 3 + Math.floor(rnd() * 6);
        stats[k] = clamp(stats[k] + plus, 1, 150);
        mutadas.push({ tipo: 'stat', stat: k, plus });
      } else {
        hue1 += 60 + rnd() * 120;
        mutadas.push({ tipo: 'color' });
      }
    }
  }
  const pick = (pair) => pair[Math.floor(rnd() * 2)];
  return {
    seed: Math.floor(rnd() * 1e9),
    sexo: rnd() < 0.5 ? 'M' : 'H',
    hue1: wrapHue(hue1),
    hue2: wrapHue(hue2),
    sat: Math.round(clamp((a.sat + b.sat) / 2 + (rnd() - 0.5) * 6, 25, 65)),
    luz: Math.round(clamp((a.luz + b.luz) / 2 + (rnd() - 0.5) * 6, 30, 60)),
    patron: [pick(a.patron), pick(b.patron)],
    variante: [pick(a.variante), pick(b.variante)],
    stats,
    mutaciones,
    mutadas,
    generacion: Math.max(a.generacion || 1, b.generacion || 1) + 1,
  };
}

/** Cuadro de Punnett genérico: devuelve la tabla 2×2 y las probabilidades por fenotipo. */
export function punnett(pa, pb, phenotypeFn) {
  const grid = [];
  const probs = {};
  for (const x of pa) {
    const row = [];
    for (const y of pb) {
      const geno = [x, y];
      const ph = phenotypeFn(geno);
      row.push({ geno, ph });
      probs[ph] = (probs[ph] || 0) + 0.25;
    }
    grid.push(row);
  }
  return { grid, probs };
}

export function patternPunnett(a, b) {
  return punnett(a.patron, b.patron, dominantPattern);
}

export function variantPunnett(a, b) {
  return punnett(a.variante, b.variante, variantOf);
}

/** Colores visibles (fenotipo) a partir de los genes. */
export function phenotype(genes) {
  const variante = variantOf(genes.variante);
  const patron = dominantPattern(genes.patron);
  const { hue1, hue2, sat, luz } = genes;
  let c = {
    piel: `hsl(${hue1} ${sat}% ${luz}%)`,
    vientre: `hsl(${hue1} ${Math.max(sat - 12, 10)}% ${Math.min(luz + 24, 88)}%)`,
    sombra: `hsl(${hue1} ${sat}% ${Math.max(luz - 16, 12)}%)`,
    acento: `hsl(${hue2} ${Math.min(sat + 14, 75)}% ${luz + 2}%)`,
    patron: `hsl(${hue1} ${Math.min(sat + 6, 70)}% ${Math.max(luz - 20, 10)}%)`,
    ojo: '#1f1a14',
  };
  if (variante === 'a') {
    c = { piel: 'hsl(30 20% 94%)', vientre: 'hsl(20 30% 97%)', sombra: 'hsl(20 15% 82%)', acento: 'hsl(350 55% 82%)', patron: 'hsl(30 15% 86%)', ojo: '#c2324a' };
  } else if (variante === 'm') {
    c = { piel: `hsl(${hue1} 14% 17%)`, vientre: `hsl(${hue1} 12% 27%)`, sombra: `hsl(${hue1} 14% 10%)`, acento: `hsl(${hue2} 30% 30%)`, patron: `hsl(${hue1} 10% 9%)`, ojo: '#e3b341' };
  } else if (variante === 'l') {
    c = { piel: `hsl(${hue1} 22% 88%)`, vientre: `hsl(${hue1} 18% 95%)`, sombra: `hsl(${hue1} 14% 76%)`, acento: `hsl(${hue2} 28% 80%)`, patron: `hsl(${hue1} 18% 78%)`, ojo: '#1f1a14' };
  }
  return { ...c, patron: c.patron, nombrePatron: patron, variante, patronId: patron };
}

export function rarityScore(genes) {
  const v = variantOf(genes.variante);
  let score = v === 'N' ? 1 : 3;
  if (dominantPattern(genes.patron) !== 'liso') score += 0.3;
  score += Math.min((genes.mutaciones || 0) * 0.15, 1.5);
  return score;
}
