import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rng, wildGenes, breed, dominantPattern, variantOf, isCarrier, punnett, variantPunnett, patternPunnett, STAT_KEYS, phenotype,
} from '../../js/systems/genetics.js';
import { SPECIES_BY_ID } from '../../js/data/species.js';

const rex = SPECIES_BY_ID.tyrannosaurus;

test('el patrón dominante gana', () => {
  assert.equal(dominantPattern(['liso', 'rayas']), 'rayas');
  assert.equal(dominantPattern(['manchas', 'bandas']), 'manchas');
  assert.equal(dominantPattern(['liso', 'liso']), 'liso');
});

test('las variantes solo se expresan en homocigosis', () => {
  assert.equal(variantOf(['a', 'a']), 'a');
  assert.equal(variantOf(['N', 'a']), 'N');
  assert.equal(variantOf(['a', 'm']), 'N');
  assert.ok(isCarrier(['N', 'm']));
  assert.ok(!isCarrier(['N', 'N']));
});

test('cuadro de Punnett de dos portadores: 25 % albino', () => {
  const r = punnett(['N', 'a'], ['N', 'a'], variantOf);
  assert.equal(r.probs.a, 0.25);
  assert.equal(r.probs.N, 0.75);
});

test('las probabilidades del Punnett suman 1', () => {
  const a = wildGenes(rex, 80, rng(1));
  const b = wildGenes(rex, 80, rng(2));
  for (const pn of [variantPunnett(a, b), patternPunnett(a, b)]) {
    const sum = Object.values(pn.probs).reduce((x, y) => x + y, 0);
    assert.equal(sum, 1);
  }
});

test('más genoma da mejores estadísticas mínimas', () => {
  const avg = (pct) => {
    let total = 0;
    const r = rng(42);
    for (let i = 0; i < 200; i += 1) {
      const g = wildGenes(rex, pct, r);
      total += STAT_KEYS.reduce((s, k) => s + g.stats[k], 0);
    }
    return total / 200;
  };
  assert.ok(avg(100) > avg(50));
});

test('la cría hereda estadísticas de sus padres (o mejoradas por mutación)', () => {
  const r = rng(7);
  const a = wildGenes(rex, 90, r);
  const b = wildGenes(rex, 60, r);
  for (let i = 0; i < 100; i += 1) {
    const c = breed(a, b, r);
    for (const k of STAT_KEYS) {
      const lo = Math.min(a.stats[k], b.stats[k]);
      const hi = Math.max(a.stats[k], b.stats[k]);
      assert.ok(c.stats[k] >= lo && c.stats[k] <= hi + 8 * 3, `${k}: ${c.stats[k]}`);
    }
    assert.ok(a.patron.includes(c.patron[0]) || b.patron.includes(c.patron[0]));
    assert.equal(c.generacion, 2);
  }
});

test('el fenotipo albino es claro con ojos rojos', () => {
  const g = { ...wildGenes(rex, 80, rng(3)), variante: ['a', 'a'] };
  const ph = phenotype(g);
  assert.equal(ph.variante, 'a');
  assert.equal(ph.ojo, '#c2324a');
});
