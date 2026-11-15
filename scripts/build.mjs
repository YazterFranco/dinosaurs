// Compila Dino Refugio para publicarlo: `npm run build` deja en dist/ el juego
// empaquetado y minimizado (pocos archivos, nombres con huella para la caché).
// El juego sigue funcionando sin compilar (index.html de la raíz); esto solo
// lo hace más ligero y rápido de cargar.
//
//   node scripts/build.mjs            compila a dist/
//   node scripts/build.mjs --report   además lista el tamaño de cada archivo

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve(new URL('..', import.meta.url).pathname);
const out = join(root, 'dist');
const report = process.argv.includes('--report');

/** Quita comentarios, sangría y líneas vacías de un sombreador GLSL. */
function minifyGlsl(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .join('\n');
}

// Los sombreadores son plantillas de texto que empiezan por `#version` (o por
// una declaración, en los trozos compartidos): se compactan al empaquetar.
const glslPlugin = {
  name: 'glsl-minify',
  setup(b) {
    b.onLoad({ filter: /render3d[\\/](gl|env|post)\.js$/ }, async (args) => {
      const src = await readFile(args.path, 'utf8');
      const contents = src.replace(/`(#version 300 es\n[^`]*|\n(?:uniform|precision) [^`]*)`/g, (m, body) => `\`${minifyGlsl(body)}\``);
      return { contents, loader: 'js' };
    });
  },
};

async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p));
    else files.push(p);
  }
  return files;
}

const t0 = Date.now();
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'assets'), { recursive: true });

// 1. JavaScript: un paquete principal y el motor 3D aparte (se carga después).
const js = await build({
  entryPoints: [join(root, 'js/main.js')],
  bundle: true,
  format: 'esm',
  splitting: true,
  minify: true,
  target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
  outdir: join(out, 'assets'),
  entryNames: 'app-[hash]',
  chunkNames: 'parte-[hash]',
  metafile: true,
  legalComments: 'none',
  plugins: [glslPlugin],
  logLevel: 'warning',
});
const entry = Object.entries(js.metafile.outputs).find(([, o]) => o.entryPoint)[0];
const appFile = `assets/${basename(entry)}`;

// 2. Estilos
const css = await build({
  entryPoints: [join(root, 'css/styles.css')],
  minify: true,
  outdir: join(out, 'assets'),
  entryNames: 'estilos-[hash]',
  metafile: true,
  logLevel: 'warning',
});
const cssFile = `assets/${basename(Object.keys(css.metafile.outputs)[0])}`;

// 3. Íconos y manifiesto
await cp(join(root, 'icons'), join(out, 'icons'), { recursive: true });
await cp(join(root, 'manifest.webmanifest'), join(out, 'manifest.webmanifest'));

// 4. Página: apunta a los archivos compilados.
let html = await readFile(join(root, 'index.html'), 'utf8');
if (!html.includes('href="css/styles.css"') || !html.includes('src="js/main.js"')) throw new Error('index.html ya no enlaza css/styles.css y js/main.js: revisa scripts/build.mjs');
html = html
  .replace('href="css/styles.css"', `href="${cssFile}"`)
  .replace('src="js/main.js"', `src="${appFile}"`)
  .replace('</head>', `  <link rel="modulepreload" href="${appFile}">\n</head>`);
await writeFile(join(out, 'index.html'), html);

// 5. Service worker con la lista exacta de lo compilado.
const files = (await walk(out)).map((f) => relative(out, f).split('\\').join('/')).filter((f) => f !== 'sw.js').sort();
const hash = createHash('sha1');
for (const f of files) hash.update(f).update(await readFile(join(out, f)));
const version = hash.digest('hex').slice(0, 10);
let sw = await readFile(join(root, 'sw.js'), 'utf8');
const list = ['./', ...files.map((f) => `./${f}`)].map((f) => `  '${f}',`).join('\n');
if (!/const ASSETS = \[[\s\S]*?\];/.test(sw) || !/const CACHE = '[^']+';/.test(sw)) throw new Error('sw.js cambió de forma: revisa scripts/build.mjs');
sw = sw
  .replace(/const CACHE = '[^']+';/, `const CACHE = 'dino-refugio-${version}';`)
  .replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = [\n${list}\n];`)
  .replace('// La lista de archivos se revisa en tests/unit/pwa.test.js.', '// Lista generada por scripts/build.mjs.');
await writeFile(join(out, 'sw.js'), sw);

// 6. Resumen
let total = 0; let gz = 0;
const rows = [];
for (const f of [...files, 'sw.js']) {
  const buf = await readFile(join(out, f));
  const g = /\.(js|css|html|svg|webmanifest)$/.test(f) ? gzipSync(buf).length : buf.length;
  total += buf.length; gz += g;
  rows.push([f, buf.length, g]);
}
let srcTotal = 0;
for (const f of [...await walk(join(root, 'js')), join(root, 'css/styles.css')]) srcTotal += (await stat(f)).size;
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
if (report) for (const [f, a, b] of rows) console.log(`${f.padEnd(44)} ${kb(a).padStart(10)}  gzip ${kb(b).padStart(9)}`);
const code = rows.filter(([f]) => /\.(js|css)$/.test(f) && f !== 'sw.js');
console.log(`dist/ listo en ${Date.now() - t0} ms · ${files.length + 1} archivos · ${kb(total)} (${kb(gz)} comprimido)`);
console.log(`Código: ${kb(srcTotal)} en ${(await walk(join(root, 'js'))).length + 1} archivos → ${kb(code.reduce((a, r) => a + r[1], 0))} en ${code.length} (${kb(code.reduce((a, r) => a + r[2], 0))} comprimido)`);
