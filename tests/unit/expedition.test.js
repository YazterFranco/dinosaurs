import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, makeDino } from '../../js/systems/game.js';
import { SPECIES_BY_ID } from '../../js/data/species.js';
import { defaultGenes } from '../../js/render/dino-svg.js';
import * as X from '../../js/systems/expedition.js';

function seeded(seed = 7) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

function setup(especie = 'triceratops') {
  const s = createGame();
  const d = makeDino(s, especie, defaultGenes(SPECIES_BY_ID[especie]), s.recintos[0] && s.recintos[0].id);
  d.nacio = -1e9; d.edad = 1e9; d.crecimiento = 1; d.energia = 100; d.salud = 100;
  s.dinos.push(d);
  return { s, d };
}

test('solo salen de expedición dinosaurios crecidos, despiertos y con energía', () => {
  const { s, d } = setup();
  if (!X.canExplore(s, d).ok) return assert.fail(X.canExplore(s, d).msg);
  d.energia = 5;
  assert.equal(X.canExplore(s, d).ok, false);
  d.energia = 100; d.enClinica = true;
  assert.equal(X.canExplore(s, d).ok, false);
});

test('una expedición tiene cinco etapas, cuesta energía y no se puede duplicar', () => {
  const { s, d } = setup();
  const r = X.startExpedition(s, d.id, 'bosque', seeded());
  assert.ok(r.ok, r.msg);
  assert.equal(d.energia, 100 - X.EXPEDITION_ENERGY);
  assert.deepEqual(s.expedicion.etapas.map((e) => e.tipo), ['obstaculo', 'salvaje', 'obstaculo', 'salvaje', 'tesoro']);
  assert.notEqual(s.expedicion.etapas[0].id, s.expedicion.etapas[2].id);
  assert.equal(X.startExpedition(s, d.id, 'bosque').ok, false);
  JSON.stringify(s); // se puede guardar
});

test('la probabilidad de una prueba crece con la estadística y tiene límites', () => {
  assert.ok(X.chance(90, 50) > X.chance(50, 50));
  assert.equal(X.chance(50, 50), 0.6);
  assert.ok(X.chance(0, 100) >= 0.12 && X.chance(100, 0) <= 0.95);
});

test('se puede jugar una expedición entera de mil maneras sin romper el estado', () => {
  for (let seed = 1; seed <= 150; seed += 1) {
    const rnd = seeded(seed);
    const { s, d } = setup(seed % 2 ? 'tyrannosaurus' : 'triceratops');
    s.inventario.comida = { helechos: 5, carne_roja: 5 };
    const antes = s.monedas;
    assert.ok(X.startExpedition(s, d.id, ['bosque', 'llanura', 'pantano'][seed % 3], rnd).ok);
    let guard = 0;
    while (!s.expedicion.fin) {
      guard += 1;
      assert.ok(guard < 300, 'la expedición no termina');
      const st = X.stageNow(s);
      const e = s.expedicion;
      if (st.tipo === 'obstaculo') assert.ok(X.chooseOption(s, Math.floor(rnd() * 3), rnd).ok);
      else if (st.tipo === 'tesoro') assert.ok(X.openTreasure(s, rnd).ok);
      else if (e.duelo) assert.ok(X.duelTurn(s, ['embestir', 'rugir', 'esquivar'][Math.floor(rnd() * 3)], rnd).ok);
      else {
        const k = rnd();
        if (k < 0.3 && s.inventario.comida.helechos > 0) X.tame(s, 'helechos', rnd);
        else if (k < 0.5 && s.inventario.comida.carne_roja > 0) X.tame(s, 'carne_roja', rnd);
        else if (k < 0.65) X.sneak(s, rnd);
        else if (k < 0.7) X.retreat(s);
        else X.startDuel(s);
      }
      assert.ok(e.aguante >= 0 && e.aguante <= e.aguanteMax);
    }
    const f = s.expedicion.fin;
    assert.ok(['completa', 'retirada', 'agotado'].includes(f.motivo));
    assert.ok(s.monedas >= antes && Number.isFinite(s.monedas));
    for (const v of Object.values(s.genoma)) assert.ok(v >= 0 && v <= 100);
    for (const v of Object.values(s.inventario.comida)) assert.ok(v >= 0);
    X.closeExpedition(s);
    assert.equal(s.expedicion, null);
  }
});

test('amansar con la comida equivocada gasta la comida y cuesta aguante', () => {
  const { s, d } = setup();
  X.startExpedition(s, d.id, 'bosque', seeded(3));
  const e = s.expedicion;
  e.paso = 1;
  e.etapas[1].salvaje.especie = 'tyrannosaurus';
  s.inventario.comida = { helechos: 2, carne_roja: 1 };
  const antes = e.aguante;
  const r = X.tame(s, 'helechos', () => 0);
  assert.equal(r.exito, false);
  assert.equal(s.inventario.comida.helechos, 1);
  assert.ok(e.aguante < antes);
  const ok = X.tame(s, 'carne_roja', () => 0);
  assert.equal(ok.exito, true);
  assert.ok(e.botin.adn.tyrannosaurus > 0);
  assert.equal(e.paso, 2);
});

test('quedarse sin aguante devuelve solo la mitad del botín', () => {
  const { s, d } = setup();
  X.startExpedition(s, d.id, 'bosque', seeded(5));
  const e = s.expedicion;
  e.botin.monedas = 100;
  e.aguante = 1;
  const antes = s.monedas;
  X.chooseOption(s, 0, () => 0.999);
  assert.equal(e.fin.motivo, 'agotado');
  assert.equal(s.monedas - antes, 50);
});
