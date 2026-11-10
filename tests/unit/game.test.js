import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../js/systems/game.js';
import { wildGenes, rng } from '../../js/systems/genetics.js';
import { SPECIES_BY_ID } from '../../js/data/species.js';
import { checkProgress, MISSIONS } from '../../js/systems/missions.js';
import { runContest } from '../../js/systems/contest.js';
import { createDig, strike, digRewards, COLS, ROWS } from '../../js/systems/dig.js';
import { buildQuiz } from '../../js/data/quiz.js';

function startedGame(starter = 'protoceratops') {
  const s = G.createGame(0);
  G.chooseStarter(s, starter);
  const egg = s.huevos[0];
  G.tick(s, egg.duracion + 1);
  const r = G.hatch(s, egg.id, () => 0);
  return { s, d: r.dino };
}

test('el huevo inicial eclosiona en el recinto adaptado a su hábitat', () => {
  const { s, d } = startedGame('protoceratops');
  assert.equal(s.recintos[0].bioma, 'desierto');
  assert.equal(d.recinto, s.recintos[0].id);
  assert.equal(G.stageOf(d), 'cria');
});

test('un herbívoro rechaza la carne y explica por qué', () => {
  const { s, d } = startedGame('protoceratops');
  const r = G.feed(s, d.id, 'carne_roja');
  assert.equal(r.ok, false);
  assert.ok(r.rechazo);
  assert.match(r.msg, /herbívoro/);
  assert.equal(G.feed(s, d.id, 'cicadas').ok, true);
});

test('el hambre baja con el tiempo y la cría crece si come', () => {
  const { s, d } = startedGame('compsognathus');
  const h0 = d.hambre;
  G.tick(s, 60);
  assert.ok(d.hambre < h0);
  for (let i = 0; i < 40; i += 1) {
    G.tick(s, 15);
    if (d.hambre < 50) G.feed(s, d.id, 'insectos') || G.buyFood(s, 'insectos', 5);
    if (!s.inventario.comida.insectos) G.buyFood(s, 'insectos', 5);
  }
  assert.notEqual(G.stageOf(d), 'cria');
});

test('atender peticiones sube el vínculo', () => {
  const { s, d } = startedGame();
  d.peticion = { tipo: 'caricia', expira: s.tiempoJuego + 30 };
  const r = G.pet(s, d.id);
  assert.ok(r.vinculo > 0);
  assert.ok(d.vinculo > 0);
  assert.equal(d.peticion, null);
});

test('sin comida mucho tiempo el dinosaurio termina en la clínica (sin morir)', () => {
  const { s, d } = startedGame();
  for (let i = 0; i < 200; i += 1) G.tick(s, 30);
  assert.ok(d.enClinica);
  assert.ok(s.dinos.includes(d));
  s.monedas = 1000;
  assert.equal(G.medicate(s, d.id).ok, true);
  assert.equal(d.enClinica, false);
});

test('el progreso fuera de línea nunca deja necesidades por debajo de 35', () => {
  const { s, d } = startedGame();
  s.ultimo = Date.now() - 3 * 60 * 60 * 1000;
  const r = G.catchUp(s, Date.now());
  assert.ok(r.segundos <= G.OFFLINE_CAP_SEC);
  assert.ok(d.hambre >= 35 && d.animo >= 35);
  assert.equal(d.enClinica, false);
});

test('sintetizar un huevo requiere 50 % de genoma y monedas', () => {
  const s = G.createGame(0);
  s.genoma.triceratops = 40;
  assert.equal(G.synthesizeEgg(s, 'triceratops').ok, false);
  s.genoma.triceratops = 60;
  s.monedas = 0;
  assert.equal(G.synthesizeEgg(s, 'triceratops').ok, false);
  s.monedas = 1000;
  const r = G.synthesizeEgg(s, 'triceratops', rng(1));
  assert.equal(r.ok, true);
  assert.ok(r.huevo.viabilidad > 0.5 && r.huevo.viabilidad < 0.7);
});

test('solo se cruzan adultos de la misma especie y sexo opuesto', () => {
  const s = G.createGame(0);
  const sp = SPECIES_BY_ID.protoceratops;
  const mk = (sexo, especie = 'protoceratops') => {
    const g = wildGenes(SPECIES_BY_ID[especie], 80, rng(sexo === 'M' ? 1 : 2));
    g.sexo = sexo;
    const d = G.makeDino(s, especie, g, 'r1');
    d.edad = 99999;
    d.animo = 90;
    s.dinos.push(d);
    return d;
  };
  const a = mk('M');
  const b = mk('H');
  const c = mk('H', 'triceratops');
  assert.equal(G.canBreed(s, a, c).ok, false);
  assert.equal(G.canBreed(s, a, a).ok, false);
  const r = G.breedPair(s, a.id, b.id, rng(5));
  assert.equal(r.ok, true);
  assert.equal(r.huevo.especie, sp.id);
  assert.equal(G.canBreed(s, a, b).ok, false, 'hay que esperar entre cruces');
});

test('las misiones se completan en orden y pagan', () => {
  const { s } = startedGame();
  const before = s.monedas;
  const done = checkProgress(s);
  assert.equal(done[0].id, MISSIONS[0].id);
  assert.ok(s.monedas > before);
});

test('un depredador grande incomoda a los herbívoros del recinto', () => {
  const { s, d } = startedGame();
  const base = G.comfortOf(s, d).valor;
  const g = wildGenes(SPECIES_BY_ID.tyrannosaurus, 80, rng(9));
  const rex = G.makeDino(s, 'tyrannosaurus', g, d.recinto);
  rex.edad = 99999;
  s.dinos.push(rex);
  assert.ok(G.comfortOf(s, d).valor < base);
});

test('concurso: devuelve una tabla con el puesto del jugador', () => {
  const { s, d } = startedGame();
  d.edad = 99999;
  d.energia = 100;
  const r = runContest(s, d.id, 'carrera', rng(3));
  assert.equal(r.ok, true);
  assert.equal(r.tabla.length, 4);
  assert.ok(r.puesto >= 1 && r.puesto <= 4);
  assert.equal(runContest(s, d.id, 'carrera').ok, false, 'hay espera entre concursos');
});

test('excavación: la brocha nunca daña, el pico sí puede dañar un hueso expuesto', () => {
  const dig = createDig('hell_creek', { guiada: true, rnd: rng(11), energiaExtra: 400 });
  const bone = dig.items.find((it) => it.tipo === 'hueso');
  for (let j = bone.y; j < bone.y + bone.h; j += 1) for (let i = bone.x; i < bone.x + bone.w; i += 1) {
    while (dig.grid[j][i].capa > 0) strike(dig, 'brocha', i, j);
  }
  assert.ok(bone.recogido);
  assert.equal(bone.calidad, 1);
  const other = dig.items.find((it) => it.tipo === 'hueso' && !it.recogido);
  if (other) {
    while (dig.grid[other.y][other.x].capa > 0) strike(dig, 'brocha', other.x, other.y);
    strike(dig, 'pico', other.x, other.y);
    assert.ok(other.calidad < 1);
  }
  const { adn } = digRewards(dig);
  assert.ok(Object.values(adn).some((v) => v > 0));
});

test('excavación: se termina cuando se acaba la energía', () => {
  const dig = createDig('morrison', { rnd: rng(4) });
  for (let k = 0; k < 100 && !dig.terminado; k += 1) strike(dig, 'pico', k % COLS, Math.floor(k / COLS) % ROWS);
  assert.ok(dig.terminado);
});

test('el quiz tiene la respuesta correcta entre las opciones', () => {
  const q = buildQuiz(['tyrannosaurus', 'triceratops', 'stegosaurus', 'velociraptor'], 30, rng(8));
  for (const item of q) {
    assert.ok(item.ok >= 0 && item.ok < item.opciones.length, item.q);
    assert.equal(new Set(item.opciones).size, item.opciones.length, `opciones repetidas: ${item.q}`);
  }
});
