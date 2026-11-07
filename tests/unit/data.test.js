import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_BY_ID, PERIODS, DIETS, RARITY, SIZE_CLASS } from '../../js/data/species.js';
import { SITES, FOODS, BIOMES } from '../../js/data/world.js';
import { canEat } from '../../js/systems/game.js';

test('cada especie tiene los campos de la Dinopedia', () => {
  for (const s of SPECIES) {
    for (const k of ['id', 'nombre', 'significado', 'pronunciacion', 'grupo', 'formacion', 'pais', 'continente']) {
      assert.ok(s[k], `${s.id} sin ${k}`);
    }
    assert.ok(PERIODS[s.periodo], `${s.id}: periodo`);
    assert.ok(DIETS[s.dieta], `${s.id}: dieta`);
    assert.ok(RARITY[s.rareza], `${s.id}: rareza`);
    assert.ok(SIZE_CLASS[s.tamano], `${s.id}: tamaño`);
    assert.equal(s.datos.length, 3, `${s.id}: tres datos curiosos`);
    assert.ok(s.mito.mito && s.mito.realidad, `${s.id}: mito`);
    assert.ok(s.ma[0] >= s.ma[1], `${s.id}: rango de millones de años`);
    const p = PERIODS[s.periodo];
    assert.ok(s.ma[0] <= p.desde && s.ma[1] >= p.hasta, `${s.id}: las fechas caen dentro de su periodo`);
  }
});

test('los ids de especie son únicos', () => {
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, SPECIES.length);
});

test('las comidas favoritas existen y respetan la dieta', () => {
  for (const s of SPECIES) {
    for (const f of s.favoritos) {
      assert.ok(FOODS[f], `${s.id}: comida ${f} no existe`);
      assert.ok(canEat(s, f), `${s.id} no puede comer su favorito ${f}`);
    }
  }
});

test('los biomas de cada especie existen', () => {
  for (const s of SPECIES) {
    assert.ok(BIOMES[s.bioma], s.id);
    assert.ok(s.biomas.includes(s.bioma), `${s.id}: su bioma ideal está en la lista`);
  }
});

test('cada especie aparece en al menos un yacimiento y cada yacimiento solo lista especies reales', () => {
  const inSites = new Set(SITES.flatMap((x) => x.especies));
  for (const s of SPECIES) assert.ok(inSites.has(s.id), `${s.id} no se puede excavar`);
  for (const site of SITES) for (const id of site.especies) assert.ok(SPECIES_BY_ID[id], `${site.id}: ${id}`);
});

test('los yacimientos coinciden con el periodo de sus especies', () => {
  for (const site of SITES) {
    for (const id of site.especies) assert.equal(SPECIES_BY_ID[id].periodo, site.periodo, `${site.id}/${id}`);
  }
});

test('hay yacimientos de nivel 1 para empezar', () => {
  assert.ok(SITES.some((s) => s.nivel === 1));
});
