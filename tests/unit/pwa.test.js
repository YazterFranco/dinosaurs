import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(root, dir), { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

test('el service worker guarda todos los archivos del juego para jugar sin conexión', async () => {
  const sw = await readFile(join(root, 'sw.js'), 'utf8');
  const files = ['index.html', 'manifest.webmanifest', ...await walk('css'), ...await walk('js'), ...await walk('icons')];
  for (const f of files) assert.ok(sw.includes(`'./${f}'`) || sw.includes(`"./${f}"`), `falta ${f} en sw.js`);
});

test('el manifiesto tiene íconos que existen', async () => {
  const m = JSON.parse(await readFile(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  for (const icon of m.icons) await readFile(join(root, icon.src));
});
