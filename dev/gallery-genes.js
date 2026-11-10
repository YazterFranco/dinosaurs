// Genes variados para revisar colores y patrones en la galería.
const PATS = ['rayas', 'manchas', 'bandas', 'moteado', 'liso'];
const VARS = [['N', 'N'], ['N', 'N'], ['N', 'N'], ['a', 'a'], ['m', 'm'], ['l', 'l']];
export function breedLikeGenes(sp, i) {
  const [h1, h2] = sp.look.colors;
  return {
    seed: 1000 + i * 37, sexo: 'M', hue1: (h1 + i * 23) % 360, hue2: (h2 + i * 41) % 360, sat: 35 + (i * 7) % 25, luz: 38 + (i * 5) % 16,
    patron: [PATS[i % PATS.length], 'liso'], variante: VARS[i % VARS.length], stats: { ...sp.stats }, mutaciones: 0, generacion: 1,
  };
}
