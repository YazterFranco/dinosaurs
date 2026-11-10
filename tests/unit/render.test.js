import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES } from '../../js/data/species.js';
import { dinoSVG, eggSVG, defaultGenes } from '../../js/render/dino-svg.js';
import { ACCESSORY_IDS } from '../../js/data/cosmetics.js';

const variants = [['N', 'N'], ['a', 'a'], ['m', 'm'], ['l', 'l']];

test('el dibujo de cada especie es SVG válido en todas las etapas y variantes', () => {
  for (const sp of SPECIES) {
    for (const stage of ['cria', 'juvenil', 'adulto']) {
      for (const variante of variants) {
        const genes = { ...defaultGenes(sp), variante, patron: ['rayas', 'manchas'] };
        const svg = dinoSVG(sp, genes, { stage, mood: 'radiante', accesorio: ACCESSORY_IDS[0], anim: true });
        assert.match(svg, /^<svg [^>]*viewBox="0 0 240 160"/, sp.id);
        assert.ok(!/NaN|undefined|Infinity|\$\{/.test(svg), `${sp.id} ${stage} ${variante}: valores inválidos`);
        assert.ok(svg.endsWith('</svg>'));
        const lite = dinoSVG(sp, genes, { stage, detail: 'low', anim: 'lite' });
        assert.ok(!/NaN|undefined|Infinity|\$\{/.test(lite), `${sp.id} ${stage}: miniatura inválida`);
        assert.ok(!lite.includes('head-bob'), 'el modo ligero no anima la cabeza');
      }
    }
  }
});

test('la silueta no revela colores ni detalles', () => {
  for (const sp of SPECIES) {
    const svg = dinoSVG(sp, null, { silhouette: true });
    assert.ok(svg.includes('is-silhouette'));
    assert.ok(!/hsl\(/.test(svg), `${sp.id}: la silueta no debe llevar colores`);
  }
});

test('cada dibujo usa ids propios para no mezclar degradados entre dinosaurios', () => {
  const sp = SPECIES[0];
  const ids = (s) => [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const a = ids(dinoSVG(sp, null));
  const b = ids(dinoSVG(sp, null));
  assert.ok(a.length > 0);
  assert.equal(a.filter((x) => b.includes(x)).length, 0);
});

test('los huevos se dibujan con su especie', () => {
  for (const sp of SPECIES) assert.match(eggSVG(sp, null, { crack: 0.8 }), new RegExp(`Huevo de ${sp.nombre}`));
});
