import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../js/systems/game.js';
import * as R from '../../js/systems/rewards.js';
import { rng, wildGenes } from '../../js/systems/genetics.js';
import { SPECIES_BY_ID } from '../../js/data/species.js';
import { dayKey, daysBetween, DAY_BONUSES, dayBonus } from '../../js/systems/calendar.js';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 10, 2, 10, 0, 0).getTime(); // lunes 2 de noviembre de 2026, 10:00

function game() {
  const s = G.createGame(T0);
  G.chooseStarter(s, 'protoceratops');
  return s;
}

test('calendario: claves de día y diferencia de días', () => {
  assert.equal(dayKey(T0), '2026-11-02');
  assert.equal(daysBetween('2026-11-02', '2026-11-05'), 3);
  assert.equal(DAY_BONUSES.length, 7);
  assert.equal(dayBonus(T0).id, 'excavacion');
});

test('energía: se gasta y se recarga con el tiempo real', () => {
  const s = game();
  assert.equal(R.energy(s, T0).valor, 5);
  assert.ok(R.spendEnergy(s, 1, T0));
  assert.equal(R.energy(s, T0).valor, 4);
  assert.equal(R.energy(s, T0 + R.ENERGY_REGEN_MS - 1000).valor, 4);
  assert.equal(R.energy(s, T0 + R.ENERGY_REGEN_MS + 1000).valor, 5);
  for (let i = 0; i < 5; i += 1) R.spendEnergy(s, 1, T0 + R.ENERGY_REGEN_MS + 2000);
  assert.equal(R.spendEnergy(s, 1, T0 + R.ENERGY_REGEN_MS + 2000), false);
});

test('energía: la mochila sube el máximo', () => {
  const s = game();
  s.mejoras.mochila = 2;
  assert.equal(R.energyMax(s), 7);
});

test('racha diaria: sube cada día y se reclama una sola vez', () => {
  const s = game();
  assert.equal(R.claimDaily(s, T0, rng(1)).ok, true);
  assert.equal(R.claimDaily(s, T0 + 1000, rng(1)).ok, false);
  const r2 = R.claimDaily(s, T0 + DAY, rng(1));
  assert.equal(r2.racha, 2);
  assert.equal(r2.dia, 2);
});

test('racha diaria: un escudo protege un día perdido; sin escudos se reinicia', () => {
  const s = game();
  R.claimDaily(s, T0, rng(1));
  R.claimDaily(s, T0 + DAY, rng(1));
  assert.equal(s.recompensas.diaria.escudos, 1);
  const r = R.claimDaily(s, T0 + 3 * DAY, rng(1)); // faltó un día
  assert.ok(r.protegida);
  assert.equal(r.racha, 3);
  assert.equal(s.recompensas.diaria.escudos, 0);
  const r2 = R.claimDaily(s, T0 + 6 * DAY, rng(1)); // faltó dos días y no hay escudos
  assert.ok(r2.perdida);
  assert.equal(r2.racha, 1);
  assert.equal(s.recompensas.diaria.mejorRacha, 3);
});

test('racha diaria: el día 7 da cofre de oro y un escudo', () => {
  const s = game();
  s.recompensas.diaria.escudos = 0;
  let r;
  for (let i = 0; i < 7; i += 1) r = R.claimDaily(s, T0 + i * DAY, rng(i + 1));
  assert.equal(r.dia, 7);
  assert.ok(s.recompensas.cofres.some((c) => c.tipo === 'oro'));
  assert.equal(s.recompensas.diaria.escudos, 1);
});

test('misiones diarias: tres por día, se reclaman al cumplirlas y dan cofre', () => {
  const s = game();
  const list = R.dailyMissions(s, T0);
  assert.equal(list.length, 3);
  assert.equal(R.claimDailyMission(s, 0, T0).ok, false);
  for (const m of list) s.contadores[m.key] = (s.contadores[m.key] || 0) + m.meta;
  for (let i = 0; i < 3; i += 1) assert.equal(R.claimDailyMission(s, i, T0).ok, true);
  const c = R.claimDailyChest(s, T0);
  assert.equal(c.ok, true);
  assert.equal(c.cofre.tipo, 'plata');
  assert.equal(R.claimDailyChest(s, T0).ok, false);
  // Al día siguiente hay misiones nuevas.
  R.dailyMissions(s, T0 + DAY);
  assert.equal(s.recompensas.diarias.dia, dayKey(T0 + DAY));
  assert.equal(s.recompensas.diarias.cofre, false);
});

test('cofre gratis: listo al empezar y luego cada 4 horas', () => {
  const s = game();
  assert.equal(R.claimFreeChest(s, T0).ok, true);
  assert.equal(R.claimFreeChest(s, T0 + 1000).ok, false);
  assert.equal(R.claimFreeChest(s, T0 + R.FREE_CHEST_MS + 1).ok, true);
});

test('abrir cofres da tantos premios como su tipo y el de oro trae accesorio', () => {
  const s = game();
  const c = R.addChest(s, 'oro');
  const r = R.openChest(s, c.id, rng(3), T0);
  assert.equal(r.ok, true);
  assert.ok(r.items.length >= 4);
  assert.ok(s.recompensas.accesorios.length >= 1 || r.items[0].texto.includes('repetido'));
  assert.equal(s.recompensas.cofres.length, 0);
  const m = R.addChest(s, 'madera');
  assert.equal(R.openChest(s, m.id, rng(4), T0).items.length >= 2, true);
});

test('taquilla: los visitantes pagan ahí hasta un tope y se cobra a mano', () => {
  const s = game();
  const g = wildGenes(SPECIES_BY_ID.tyrannosaurus, 90, rng(2));
  const d = G.makeDino(s, 'tyrannosaurus', g, 'r1');
  d.edad = 1e6;
  s.dinos.push(d);
  const m0 = s.monedas;
  for (let i = 0; i < 60; i += 1) G.tick(s, 1, { now: T0 });
  assert.equal(s.monedas, m0, 'las monedas no entran solas');
  assert.ok(s.recompensas.taquilla > 0);
  const r = R.collectBooth(s);
  assert.equal(r.ok, true);
  assert.equal(s.monedas, m0 + r.monedas);
  s.recompensas.taquilla = 0;
  for (let i = 0; i < 600; i += 1) G.tick(s, 60, { now: T0, offline: true });
  assert.ok(s.recompensas.taquilla <= G.boothCap(s));
});

test('regalos: los dinosaurios felices dejan regalos que se pueden recoger', () => {
  const s = game();
  const g = wildGenes(SPECIES_BY_ID.protoceratops, 90, rng(5));
  const d = G.makeDino(s, 'protoceratops', g, s.recintos[0].id);
  d.animo = 100;
  s.dinos.push(d);
  for (let i = 0; i < 200; i += 1) { d.animo = 100; d.hambre = 100; d.energia = 100; G.tick(s, 1, { now: T0 }); }
  assert.ok(s.recompensas.regalos.length > 0);
  const gift = s.recompensas.regalos[0];
  const r = R.collectGift(s, gift.id, rng(1), T0);
  assert.equal(r.ok, true);
  assert.equal(s.contadores.regalos, 1);
});

test('combo: cuidados acertados seguidos dan monedas extra', () => {
  const s = game();
  const g = wildGenes(SPECIES_BY_ID.protoceratops, 90, rng(6));
  const d = G.makeDino(s, 'protoceratops', g, s.recintos[0].id);
  s.dinos.push(d);
  d.hambre = 10;
  G.feed(s, d.id, 'cicadas');
  d.hambre = 10;
  const r = G.feed(s, d.id, 'cicadas');
  assert.equal(r.combo, 2);
});

test('accesorios: solo se equipan los que tienes', () => {
  const s = game();
  const d = G.makeDino(s, 'protoceratops', wildGenes(SPECIES_BY_ID.protoceratops, 80, rng(1)), 'r1');
  s.dinos.push(d);
  assert.equal(R.equipAccessory(s, d.id, 'corona').ok, false);
  s.recompensas.accesorios.push('corona');
  assert.equal(R.equipAccessory(s, d.id, 'corona').ok, true);
  assert.equal(d.accesorio, 'corona');
});

test('subir de nivel da un cofre y llena la energía', () => {
  const s = game();
  R.spendEnergy(s, 3, T0);
  const info = R.levelUpRewards(s, 5, T0);
  assert.equal(info.tipo, 'oro');
  assert.equal(R.energy(s, T0).valor, R.energyMax(s));
});
