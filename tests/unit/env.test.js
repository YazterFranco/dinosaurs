// El escenario 3D del visor: colores, texturas de ruido y vegetación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { envLook, buildProps, noiseTexture, reliefTexture, hashStr } from '../../js/render3d/env.js';
import { BIOMES } from '../../js/data/world.js';

const LIGHT = { sky: [0.5, 0.58, 0.74], ground: [0.33, 0.28, 0.21], key: [0.4, 0.8, 0.5], keyCol: [1.9, 1.8, 1.6] };
const PHASES = ['dia', 'amanecer', 'atardecer', 'noche'];
const finite3 = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isFinite(v) && v >= 0);

test('cada hábitat tiene un escenario con colores válidos a cualquier hora', () => {
  for (const biome of Object.keys(BIOMES)) {
    for (const phase of PHASES) {
      const look = envLook(biome, phase, LIGHT);
      for (const k of ['zenith', 'horizon', 'fog', 'soilA', 'soilB', 'earth', 'far', 'near', 'water', 'skyAmb', 'groundAmb', 'foliage', 'cloudCol']) {
        assert.ok(finite3(look[k]), `${biome}/${phase}: ${k} no es un color`);
      }
      assert.equal(look.night, phase === 'noche');
    }
  }
  // De noche el cielo es mucho más oscuro que de día.
  const lum = (c) => c[0] + c[1] + c[2];
  assert.ok(lum(envLook('bosque', 'noche', LIGHT).zenith) < lum(envLook('bosque', 'dia', LIGHT).zenith) * 0.2);
  // Un hábitat desconocido no rompe nada, y los nadadores van bajo el agua.
  assert.ok(finite3(envLook('no-existe', 'dia', LIGHT).horizon));
  assert.equal(envLook('costa', 'dia', LIGHT, { underwater: true }).under, true);
});

test('las texturas de ruido tienen el tamaño pedido, usan todo el rango y se repiten sin costura', () => {
  for (const tex of [noiseTexture(64, 5), reliefTexture(64, 7)]) {
    assert.equal(tex.w, 64);
    assert.equal(tex.data.length, 64 * 64 * 4);
    let mn = 255; let mx = 0;
    for (let i = 0; i < tex.data.length; i += 4) { mn = Math.min(mn, tex.data[i]); mx = Math.max(mx, tex.data[i]); }
    assert.ok(mn < 30 && mx > 225, `rango pobre: ${mn}–${mx}`);
    // Sin costura: la última columna se parece a la primera tanto como dos vecinas cualesquiera.
    let seam = 0; let inner = 0;
    for (let y = 0; y < 64; y += 1) {
      seam += Math.abs(tex.data[(y * 64 + 63) * 4] - tex.data[(y * 64) * 4]);
      inner += Math.abs(tex.data[(y * 64 + 31) * 4] - tex.data[(y * 64 + 32) * 4]);
    }
    assert.ok(seam < inner * 3 + 64 * 4, `costura visible: ${seam} frente a ${inner}`);
  }
  assert.equal(noiseTexture(256), noiseTexture(256), 'la textura grande se calcula una sola vez');
});

test('las plantas y rocas rodean al animal sin pisarlo ni meterse en el paso de la cámara', () => {
  for (const biome of [...Object.keys(BIOMES), 'mar']) {
    for (const [len, height, lengthM] of [[190, 80, 12], [120, 40, 1]]) {
      const look = envLook(biome === 'mar' ? 'costa' : biome, 'dia', LIGHT, { underwater: biome === 'mar' });
      const info = { center: [10, 0], half: [len / 2, 22], height, upm: len / lengthM, camDist: len * 2.1 };
      const B = buildProps(look, info, hashStr(`x|${biome}`));
      assert.ok(B.n > 100, `${biome}: escenario vacío`);
      assert.equal(B.pos.length, B.n * 3);
      assert.equal(B.nor.length, B.n * 3);
      assert.equal(B.col.length, B.n * 4);
      assert.ok(B.idx.length % 3 === 0 && B.idx.every((i) => i >= 0 && i < B.n));
      assert.ok(B.idx.length / 3 < 60000, `${biome}: demasiados triángulos (${B.idx.length / 3})`);
      assert.ok(B.pos.every(Number.isFinite) && B.nor.every(Number.isFinite) && B.col.every(Number.isFinite));
      for (let i = 0; i < B.n; i += 1) {
        const x = B.pos[i * 3] - info.center[0]; const y = B.pos[i * 3 + 1]; const z = B.pos[i * 3 + 2] - info.center[1];
        const r = Math.hypot(x, z);
        // Franja libre por donde pasa la cámara al girar el diorama.
        assert.ok(r < info.camDist * 0.95 || r > info.camDist * 1.12, `${biome}: algo en el paso de la cámara (r=${r.toFixed(0)})`);
        // Cerca del animal nada le llega más arriba del lomo.
        if (r < info.camDist * 0.95 && biome !== 'mar') assert.ok(y < height * 0.9, `${biome}: planta demasiado alta junto al animal (${y.toFixed(0)})`);
      }
    }
  }
  // El mismo animal en el mismo hábitat siempre ve el mismo paisaje.
  const look = envLook('bosque', 'dia', LIGHT);
  const info = { center: [0, 0], half: [80, 20], height: 70, upm: 16, camDist: 340 };
  assert.deepEqual(buildProps(look, info, 42).pos.slice(0, 60), buildProps(look, info, 42).pos.slice(0, 60));
});

test('el service worker de la versión compilada se genera a partir del de desarrollo', async () => {
  // scripts/build.mjs reemplaza estas dos declaraciones: si cambian de forma, la compilación falla.
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /const CACHE = '[^']+';/);
  assert.match(sw, /const ASSETS = \[[\s\S]*?\];/);
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('href="css/styles.css"') && html.includes('src="js/main.js"'));
});
