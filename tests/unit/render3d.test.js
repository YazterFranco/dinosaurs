import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES } from '../../js/data/species.js';
import { defaultGenes } from '../../js/render/dino-svg.js';
import { ACCESSORY_IDS } from '../../js/data/cosmetics.js';
import { buildModel, parsePath } from '../../js/render3d/model.js';
import { bodyTexture, headTexture } from '../../js/render3d/textures.js';
import { spriteKey, spriteCamera, viewerCamera } from '../../js/render3d/index.js';
import { m4 } from '../../js/render3d/gl.js';

const finite = (arr) => arr.every((v) => Number.isFinite(v));

function checkModel(m, label) {
  assert.ok(m.parts.length > 5, `${label}: muy pocas piezas`);
  for (const p of m.parts) {
    const { pos, nor, uv, idx } = p.mesh;
    assert.ok(p.mat, `${label}: pieza sin material`);
    assert.ok(pos.length > 0 && pos.length % 3 === 0, `${label}: posiciones vacías`);
    assert.equal(nor.length, pos.length, `${label}: normales incompletas`);
    assert.equal(uv.length / 2, pos.length / 3, `${label}: uv incompletas`);
    assert.ok(finite(pos) && finite(nor) && finite(uv), `${label}: ${p.mat} con NaN`);
    const n = pos.length / 3;
    assert.ok(idx.every((i) => i >= 0 && i < n), `${label}: ${p.mat} con índices fuera de rango`);
  }
  const b = m.info.bounds;
  assert.ok(finite([...b.min, ...b.max]), `${label}: caja inválida`);
  const size = b.max.map((v, i) => v - b.min[i]);
  assert.ok(size[0] > 20 && size[1] > 10 && size[2] > 4, `${label}: el modelo está aplastado (${size.map((v) => v.toFixed(0))})`);
  for (const k of Object.keys(m.anim)) {
    if (k === 'legs') continue;
    assert.ok(finite([].concat(m.anim[k])), `${label}: animación ${k} inválida`);
  }
  for (const l of m.anim.legs) assert.ok(finite([...l.hip, ...l.knee, ...l.ankle, l.phase, l.bend]), `${label}: pata sin articulaciones válidas`);
  for (const p of m.parts) if (p.mesh.rig) assert.equal(p.mesh.rig.length / 4, p.mesh.pos.length / 3, `${label}: ${p.mat} con datos de animación incompletos`);
}

test('el modelo 3D de cada especie es geometría válida en todas las etapas, ánimos y accesorios', () => {
  for (const sp of SPECIES) {
    const base = defaultGenes(sp);
    for (const stage of ['cria', 'juvenil', 'adulto']) {
      const genes = { ...base, patron: ['rayas', 'manchas'], variante: stage === 'cria' ? ['a', 'a'] : base.variante };
      const acc = ACCESSORY_IDS[(sp.id.length + stage.length) % ACCESSORY_IDS.length];
      checkModel(buildModel(sp, genes, { stage, mood: 'radiante', accesorio: acc }), `${sp.id} ${stage}`);
    }
    checkModel(buildModel(sp, base, { stage: 'adulto', sleeping: true, mood: 'triste' }), `${sp.id} dormido`);
  }
});

test('cada accesorio se puede modelar en 3D', () => {
  const sp = SPECIES.find((s) => s.id === 'tyrannosaurus');
  for (const acc of ACCESSORY_IDS) {
    const m = buildModel(sp, defaultGenes(sp), { accesorio: acc });
    assert.ok(m.parts.some((p) => p.mat === 'acc'), `${acc}: no aparece en el modelo`);
  }
});

test('las texturas de piel y cabeza se generan sin canvas y con el tamaño pedido', () => {
  for (const sp of SPECIES.slice(0, 12)) {
    const m = buildModel(sp, { ...defaultGenes(sp), patron: ['manchas', 'manchas'] }, {});
    const body = bodyTexture(m, { countershade: true });
    assert.equal(body.data.length, body.w * body.h * 4);
    const head = headTexture(m, parsePath(m.info.head.jaw, 8));
    assert.equal(head.data.length, head.w * head.h * 4);
    let alpha = 0;
    for (let i = 3; i < body.data.length; i += 4) alpha += body.data[i];
    assert.ok(alpha > 0, `${sp.id}: textura vacía`);
  }
});

test('la cámara encuadra al animal entero en la imagen y en el visor', () => {
  for (const sp of SPECIES) {
    const m = buildModel(sp, defaultGenes(sp), {});
    const sample = [];
    for (const p of m.parts) for (let i = 0; i < p.mesh.pos.length; i += 3 * 7) sample.push([p.mesh.pos[i], p.mesh.pos[i + 1], p.mesh.pos[i + 2]]);
    const scene = { bounds: m.info.bounds, sample };
    const flyer = m.info.plan === 'flyer';
    const cam = spriteCamera(scene, 480, 320, flyer ? 30 : 24, flyer ? -24 : 11);
    for (const p of sample) {
      const v = cam.viewOf(p);
      assert.ok(Math.abs(v[0]) <= 1.001 && Math.abs(v[1]) <= 1.001, `${sp.id}: se sale del encuadre`);
    }
    const vc = viewerCamera(scene, 360, 240, { turntable: true });
    const pv = m4.mul(vc.proj, vc.view);
    for (const p of sample) {
      const c = m4.apply(pv, p);
      assert.ok(Number.isFinite(c[0]) && Math.abs(c[0]) <= 1.01 && Math.abs(c[1]) <= 1.01, `${sp.id}: se sale del visor`);
    }
  }
});

test('la clave de la imagen cambia con lo que cambia el aspecto, y solo con eso', () => {
  const sp = SPECIES[0];
  const g = defaultGenes(sp);
  const k = spriteKey(sp, g, {});
  assert.equal(k, spriteKey(sp, { ...g }, {}));
  assert.notEqual(k, spriteKey(sp, { ...g, hue1: g.hue1 + 10 }, {}));
  assert.notEqual(k, spriteKey(sp, g, { stage: 'cria' }));
  assert.notEqual(k, spriteKey(sp, g, { accesorio: 'corona' }));
  assert.notEqual(k, spriteKey(sp, g, { size: 'sm' }));
  assert.notEqual(k, spriteKey(sp, g, { silhouette: true }));
  assert.equal(k, spriteKey(sp, g, { anim: true, title: 'otro texto' }));
});
