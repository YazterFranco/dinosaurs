// Arte de los dinosaurios para la interfaz: devuelve HTML con el dibujo SVG
// (instantáneo y de respaldo) y, si el navegador tiene WebGL2, lo cambia por
// la versión 3D: una imagen renderizada o, en los retratos grandes, un visor
// que se puede girar. Las vistas solo llaman a dinoArt() y se olvidan.

import { dinoSVG, defaultGenes } from './dino-svg.js';

const KEY = 'dino-refugio-3d';

/** Preferencia guardada: 'on' (forzado), 'off' o null (automático). */
function pref() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function is3DOn() { return pref() !== 'off'; }

export function set3D(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* sin almacenamiento */ }
}

let lib = null;
let libP = null;
let why = 'pendiente';
export function load3D() {
  if (!libP) {
    libP = import('../render3d/index.js')
      .then((m) => {
        // En automático, sin tarjeta gráfica (WebGL por software) el 3D iría
        // lento: se queda el dibujo plano salvo que el jugador lo active.
        if (!m.has3D()) { why = 'sin'; lib = null; } else if (m.isSoftwareGL() && pref() !== 'on') { why = 'lento'; lib = null; } else { why = 'on'; lib = m; }
        return lib;
      })
      .catch(() => { why = 'sin'; lib = null; return null; });
  }
  return libP;
}

/** Estado del 3D para Ajustes: 'on', 'off', 'lento' (sin GPU), 'sin' (sin WebGL2) o 'pendiente'. */
export function status3D() { return pref() === 'off' ? 'off' : why; }

const registry = new Map();
let nid = 0;
const viewers = new Map(); // clave del visor → { canvas, kick, dispose, look }

const floats = (sp) => sp.look.plan === 'flyer' || sp.look.plan === 'swim';

function imgTag(url, species, o, extra = '') {
  const cls = ['dino-svg', 'dino-img'];
  if (o.anim && !o.sleeping) cls.push(floats(species) ? 'is-float' : 'is-anim');
  if (o.silhouette) cls.push('is-silhouette');
  if (o.className) cls.push(o.className);
  const delay = o.anim ? ` style="animation-delay:-${(Math.random() * 3).toFixed(2)}s"` : '';
  return `<img class="${cls.join(' ')}" src="${url}" alt="${o.title || species.nombre}" draggable="false"${delay}${extra}>`;
}

/**
 * HTML de un dinosaurio. opts como dinoSVG, más:
 *  - viewer: true → visor 3D interactivo (retratos)
 *  - viewerKey: reutiliza el mismo visor al redibujar la misma ficha
 *  - size: 'sm' (miniaturas) | 'md' (por defecto) | 'lg'
 *  - className: clase extra para el elemento final
 */
export function dinoArt(species, genes, opts = {}) {
  const svg = dinoSVG(species, genes, opts);
  const fallback = opts.className ? svg.replace('class="dino-svg', `class="${opts.className} dino-svg`) : svg;
  if (typeof document === 'undefined' || !is3DOn() || lib === false) return fallback;
  const o = { ...opts, size: opts.size || 'md' };
  if (lib && !o.viewer) {
    const url = lib.cachedSprite(lib.spriteKey(species, genes || null, o));
    if (url) return imgTag(url, species, o);
  }
  nid += 1;
  const id = `art${nid}`;
  registry.set(id, { species, genes, opts: o });
  return `<span class="dino-art${o.viewer ? ' dino-viewer' : ''}${o.className ? ` ${o.className}-wrap` : ''}" data-art="${id}">${fallback}</span>`;
}

/** Imagen 3D para meter dentro de otro SVG (comparación de tamaño). */
export function dinoArtSvg(species, genes, opts, box) {
  const nested = dinoSVG(species, genes, opts).replace('<svg class="dino-svg"', `<svg x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" class="dino-svg"`);
  if (typeof document === 'undefined' || !is3DOn() || lib === false) return nested;
  nid += 1;
  const id = `art${nid}`;
  registry.set(id, { species, genes, opts: { ...opts, size: opts.size || 'md' }, box });
  return `<g data-art-g="${id}">${nested}</g>`;
}

function hydrateOne(el) {
  const id = el.dataset.art || el.dataset.artG;
  const job = registry.get(id);
  registry.delete(id);
  el.removeAttribute('data-art');
  el.removeAttribute('data-art-g');
  if (!job || !lib) return;
  const { species, opts } = job;
  const genes = job.genes || defaultGenes(species);
  if (opts.viewer) {
    const look = lib.spriteKey(species, genes, { ...opts, size: 'viewer' });
    const vkey = opts.viewerKey || null;
    const prev = vkey ? viewers.get(vkey) : null;
    if (prev && prev.look === look && prev.canvas) {
      el.innerHTML = '';
      el.appendChild(prev.canvas);
      el.classList.add('is-3d');
      prev.kick();
      return;
    }
    if (prev) { prev.dispose(); viewers.delete(vkey); }
    const v = lib.mountViewer(el, species, genes, { ...opts, aspect: 1.5, maxWidth: opts.maxWidth || 360 });
    if (v) viewers.set(vkey || `v${id}`, { ...v, look });
    return;
  }
  lib.renderSprite(species, job.genes || null, opts).then((url) => {
    if (!el.isConnected) return;
    if (job.box) {
      const b = job.box;
      el.innerHTML = `<image href="${url}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" preserveAspectRatio="xMidYMid meet"/>`;
      return;
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = imgTag(url, species, opts);
    const img = tmp.firstChild;
    const swap = () => { if (el.isConnected) el.replaceWith(img); };
    if (img.decode) img.decode().then(swap, swap); else swap();
  }).catch(() => { /* se queda el dibujo SVG */ });
}

function hydrate() {
  if (!lib) return;
  document.querySelectorAll('[data-art], [data-art-g]').forEach(hydrateOne);
  for (const [k, v] of viewers) {
    if (!v.canvas || !v.canvas.isConnected) {
      // Damos un momento por si la ficha se redibuja y el visor vuelve.
      setTimeout(() => {
        const cur = viewers.get(k);
        if (cur === v && (!v.canvas || !v.canvas.isConnected)) { v.dispose(); viewers.delete(k); }
      }, 400);
    }
  }
}

/** Activa el cambio automático a 3D en toda la página. */
export function start3D() {
  if (typeof document === 'undefined' || !is3DOn()) return;
  load3D().then((m) => {
    if (!m) { lib = false; return; }
    hydrate();
    const mo = new MutationObserver((muts) => {
      if (muts.some((m2) => m2.addedNodes.length || m2.removedNodes.length)) hydrate();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });
}

/** PNG en data URL del dinosaurio en 3D (o null si no hay 3D). Para la postal. */
export async function dinoPngDataUrl(species, genes, opts) {
  if (!is3DOn()) return null;
  const m = await load3D();
  if (!m) return null;
  try { return m.renderDataUrl(species, genes || defaultGenes(species), opts); } catch { return null; }
}
