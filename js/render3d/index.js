// API pública del 3D: imágenes renderizadas (parque, listas, fichas) y un
// visor interactivo que se gira con el dedo. Si el navegador no tiene WebGL2,
// quien llama se queda con el dibujo SVG.

import { buildModel } from './model.js';
import { createRenderer, m4 } from './gl.js';
import { defaultGenes } from '../render/dino-svg.js';

export const VERSION = 'r3d-1';
const rad = (d) => (d * Math.PI) / 180;

let support = null;
let software = false;
export function has3D() {
  if (support !== null) return support;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    support = !!gl;
    if (gl) {
      // Sin tarjeta gráfica (WebGL por software) el visor se queda quieto y
      // solo se redibuja al girarlo, para no trabar la interfaz.
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
      const l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext();
    }
  } catch { support = false; }
  return support;
}
/** true si WebGL corre por software (sin GPU): conviene gastar poco. */
export function isSoftwareGL() { has3D(); return software; }

// ------------------------------------------------------------ cámaras

/** Cámara ortográfica que encuadra al animal como el dibujo 2D (240 × 160). */
export function spriteCamera(scene, W, H, az = 24, el = 11) {
  const b = scene.bounds;
  const target = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const dir = [Math.sin(rad(az)) * Math.cos(rad(el)), Math.sin(rad(el)), Math.cos(rad(az)) * Math.cos(rad(el))];
  const eye = target.map((v, i) => v + dir[i] * 700);
  const view = m4.lookAt(eye, target, [0, 1, 0]);
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const p of scene.sample) {
    const v = m4.apply(view, p);
    if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
    if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
  }
  const g = m4.apply(view, [target[0], 0, target[2]]);
  minY = Math.min(minY, g[1]);
  const s = Math.min((W * (232 / 240)) / (maxX - minX), (H * (142 / 160)) / (maxY - minY), (W / 240) * 2.2);
  const cx = (minX + maxX) / 2;
  const bottom = minY - (H * (9 / 160)) / s;
  const top = bottom + H / s;
  const proj = m4.ortho(cx - W / (2 * s), cx + W / (2 * s), bottom, top, 1, 1600);
  return { view, proj, pos: eye, scale: s, viewOf: (p) => m4.apply(m4.mul(proj, view), p) };
}

/** Cámara en perspectiva para el visor; la distancia se ajusta para que el animal quepa al girar. */
export function viewerCamera(scene, W, H, opts = {}) {
  const b = scene.bounds;
  const target = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2 - (b.max[1] - b.min[1]) * 0.04, (b.min[2] + b.max[2]) / 2];
  const fov = rad(opts.fov || 30);
  const az = rad(opts.az ?? 22); const el = rad(opts.el ?? 12);
  const dir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  const aspect = W / H;
  const tx = Math.tan(fov / 2) * aspect * 0.9;
  const ty = Math.tan(fov / 2) * 0.86;
  let dist = 10;
  for (const yaw of opts.turntable ? [0, 0.35, -0.35] : [0]) {
    const rot = m4.mul(m4.translate(target[0], 0, target[2]), m4.mul(m4.rotY(yaw), m4.translate(-target[0], 0, -target[2])));
    const view = m4.lookAt(target.map((v, i) => v + dir[i] * 100), target, [0, 1, 0]);
    for (const p of scene.sample) {
      const v = m4.apply(view, m4.apply(rot, p));
      const depth = -v[2];
      dist = Math.max(dist, Math.abs(v[0]) / tx - depth + 100, Math.abs(v[1]) / ty - depth + 100);
    }
  }
  dist *= opts.zoom || 1;
  const eye = target.map((v, i) => v + dir[i] * dist);
  return { view: m4.lookAt(eye, target, [0, 1, 0]), proj: m4.persp(fov, aspect, Math.max(1, dist * 0.2), dist * 4), pos: eye, target };
}

// ------------------------------------------------------------ imágenes (sprites)

const cache = new Map();
const pending = new Map();
const queue = [];
let spr = null;

function spriteRenderer(W, H) {
  if (!spr) {
    const canvas = document.createElement('canvas');
    const r = createRenderer(canvas, { preserve: true, shadowSize: 1024 });
    if (!r) return null;
    canvas.addEventListener('webglcontextlost', () => { spr = null; support = false; });
    spr = { canvas, r };
  }
  if (spr.canvas.width !== W || spr.canvas.height !== H) { spr.canvas.width = W; spr.canvas.height = H; }
  return spr;
}

/** Clave estable de una imagen: especie, etapa, ánimo, accesorio y genes que cambian el aspecto. */
export function spriteKey(species, genes, opts = {}) {
  const g = genes || {};
  const gk = genes ? [g.hue1, g.hue2, g.sat, g.luz, (g.patron || []).join(''), (g.variante || []).join(''), g.seed].join(',') : 'base';
  return [VERSION, species.id, opts.stage || 'adulto', opts.mood || '', opts.sleeping ? 'z' : '', opts.accesorio || '', opts.silhouette ? 's' : '', opts.size || 'md', gk].join('|');
}

export function cachedSprite(key) { return cache.get(key) || null; }

// Caché persistente en IndexedDB: al volver a abrir el juego, las imágenes
// ya renderizadas aparecen al instante.
let dbP = null;
function db() {
  if (dbP) return dbP;
  dbP = new Promise((resolve) => {
    try {
      const req = indexedDB.open('dino-refugio-3d', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('img');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbP;
}
async function idbGet(key) {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const r = d.transaction('img').objectStore('img').get(key);
      r.onsuccess = () => { const v = r.result; resolve(v ? (v.b || v) : null); };
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function idbPut(key, blob) {
  const d = await db();
  if (!d) return;
  try { d.transaction('img', 'readwrite').objectStore('img').put({ b: blob, t: Date.now() }, key); } catch { /* sin caché persistente */ }
  schedulePrune();
}

// La caché no crece sin límite: se borran las imágenes de versiones viejas del
// motor y, si hay demasiadas, las más antiguas.
const IDB_MAX = 480;
let pruneDone = false;
function schedulePrune() {
  if (pruneDone) return;
  pruneDone = true;
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 2000));
  idle(() => { pruneIdb(); }, { timeout: 8000 });
}
export async function pruneIdb(max = IDB_MAX) {
  const d = await db();
  if (!d) return 0;
  return new Promise((resolve) => {
    try {
      const tx = d.transaction('img', 'readwrite');
      const store = tx.objectStore('img');
      const keep = [];
      let removed = 0;
      const req = store.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          const v = c.value;
          if (!String(c.key).startsWith(`${VERSION}|`)) { c.delete(); removed += 1; } else keep.push([c.key, (v && v.t) || 0]);
          c.continue();
          return;
        }
        if (keep.length > max) {
          keep.sort((a, b) => a[1] - b[1]);
          for (const [k] of keep.slice(0, keep.length - max)) { store.delete(k); removed += 1; }
        }
      };
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => resolve(removed);
    } catch { resolve(0); }
  });
}

function remember(key, url) {
  cache.set(key, url);
  if (cache.size > 260) {
    const [old, u] = cache.entries().next().value;
    cache.delete(old);
    try { URL.revokeObjectURL(u); } catch { /* nada */ }
  }
}

/**
 * Promesa con la URL de una imagen PNG del dinosaurio. Se renderiza en cola,
 * un animal por fotograma libre, para no trabar la interfaz.
 */
export function renderSprite(species, genes, opts = {}) {
  const key = spriteKey(species, genes, opts);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return pending.get(key);
  const p = (async () => {
    const stored = opts.persist === false ? null : await idbGet(key);
    if (stored) { const url = URL.createObjectURL(stored); remember(key, url); return url; }
    return new Promise((resolve, reject) => {
      queue.push({ species, genes, opts, key, resolve, reject, prio: opts.priority || 0 });
      queue.sort((a, b) => b.prio - a.prio);
      pump();
    });
  })();
  pending.set(key, p);
  p.finally(() => pending.delete(key));
  return p;
}

let pumping = false;
function pump() {
  if (pumping) return;
  pumping = true;
  const next = () => {
    const job = queue.shift();
    if (!job) { pumping = false; return; }
    try {
      const out = renderNow(job.species, job.genes, job.opts);
      out.blob.then((blob) => {
        if (!blob) throw new Error('sin imagen');
        const url = URL.createObjectURL(blob);
        remember(job.key, url);
        if (job.opts.persist !== false) idbPut(job.key, blob);
        job.resolve(url);
      }).catch(job.reject);
    } catch (err) {
      job.reject(err);
    }
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 16));
    idle(next, { timeout: software ? 600 : 120 });
  };
  next();
}

/** Renderiza ya (sin cola). Devuelve { blob: Promise<Blob>, canvas }. */
export function renderNow(species, genes, opts = {}) {
  const W = opts.size === 'sm' ? 240 : opts.size === 'lg' ? 1040 : 480;
  const H = Math.round((W * 160) / 240);
  const s = spriteRenderer(W, H);
  if (!s) throw new Error('sin WebGL2');
  const model = buildModel(species, genes || defaultGenes(species), opts);
  // Las miniaturas no necesitan una piel de 512 px: se calcula 4 veces más rápido.
  const scene = s.r.upload(model, { texScale: W < 300 ? 0.5 : 1 });
  const flyer = model.info.plan === 'flyer';
  const cam = spriteCamera(scene, W, H, flyer ? 30 : 24, flyer ? -24 : 11);
  s.r.render(scene, cam, { silhouette: !!opts.silhouette, bumpScale: W < 300 ? 0.3 : W < 600 ? 0.5 : 0.8, shells: true, ground: !flyer });
  let out = s.canvas;
  if (opts.sleeping) {
    const c2 = document.createElement('canvas');
    c2.width = W; c2.height = H;
    const ctx = c2.getContext('2d');
    ctx.drawImage(s.canvas, 0, 0);
    const p = cam.viewOf(model.info.headTop);
    const x = (p[0] * 0.5 + 0.5) * W; const y = (1 - (p[1] * 0.5 + 0.5)) * H;
    ctx.font = `700 ${Math.round(H * 0.11)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(40,52,70,.85)';
    ctx.fillText('z', Math.min(W - H * 0.2, x + H * 0.04), Math.max(H * 0.14, y - H * 0.03));
    ctx.font = `700 ${Math.round(H * 0.08)}px system-ui, sans-serif`;
    ctx.fillText('z', Math.min(W - H * 0.1, x + H * 0.13), Math.max(H * 0.08, y - H * 0.11));
    out = c2;
  }
  s.r.dispose(scene);
  const blob = new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  return { blob, canvas: out };
}

/** PNG en data URL (para la postal, que se rasteriza como imagen SVG). */
export function renderDataUrl(species, genes, opts = {}) {
  const { canvas } = renderNow(species, genes, { ...opts, size: opts.size || 'lg' });
  return canvas.toDataURL('image/png');
}

// ------------------------------------------------------------ visor

let hintsShown = 0;
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Monta un visor 3D en `el` (reemplaza su contenido cuando el primer cuadro
 * está listo). Arrastra para girar; flechas del teclado también.
 * Devuelve una función para desmontarlo.
 */
export function mountViewer(el, species, genes, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dino-3d-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${opts.title || species.nombre} en 3D. Arrastra o usa las flechas para girarlo.`);
  canvas.tabIndex = 0;
  const soft = isSoftwareGL();
  const r = createRenderer(canvas, { shadowSize: soft ? 1024 : 2048 });
  if (!r) return null;
  const model = buildModel(species, genes, opts);
  const scene = r.upload(model);
  // Calidad adaptable: si los cuadros tardan, primero se baja la resolución
  // y luego se deja de animar en reposo (solo se redibuja al girarlo).
  let still = reduceMotion() || !!opts.still || soft;
  let dprCap = soft ? 1 : 2;
  let lastDraw = 0;
  let slow = 16;
  let drawn = 0;
  let yaw = opts.yaw || 0;
  let vel = 0;
  let dragging = false;
  let lastX = 0;
  let raf = 0;
  let visible = true;
  let cam = null;
  let size = [0, 0];
  const t0 = performance.now();
  let nextBlink = 1.5 + Math.random() * 2;
  let started = false;
  let disposed = false;
  const resize = () => {
    const rect = (host.isConnected ? host : el).getBoundingClientRect();
    const w = Math.max(120, Math.round(Math.min(rect.width || 320, opts.maxWidth || 360)));
    const h = Math.round(w / (opts.aspect || 1.5));
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    if (w !== size[0] || h !== size[1] || dpr !== size[2]) {
      size = [w, h, dpr];
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      cam = viewerCamera(scene, canvas.width, canvas.height, { turntable: true, zoom: opts.zoom });
    }
  };
  let host = el;
  const frame = (now) => {
    raf = 0;
    if (!visible || disposed) return;
    if (canvas.isConnected) host = canvas.parentElement || host;
    else if (started) return; // lo sacaron de la página: esperamos a que vuelva
    const moving = dragging || Math.abs(vel) > 0.0005;
    // En reposo basta con ~30 cuadros por segundo: se ve igual y gasta la mitad.
    if (started && !moving && lastDraw && now - lastDraw < 30) { raf = requestAnimationFrame(frame); return; }
    if (lastDraw) {
      slow = slow * 0.8 + Math.min(600, now - lastDraw) * 0.2;
      drawn += 1;
      if (drawn > 10 && slow > (moving ? 70 : 60)) {
        if (dprCap > 1) dprCap = 1; else still = true;
        drawn = 0;
        slow = 30;
      }
    }
    lastDraw = now;
    resize();
    const t = (now - t0) / 1000;
    if (!dragging) { yaw += vel; vel *= 0.93; }
    let blink = 0;
    if (!still && !opts.sleeping) {
      const d = t - nextBlink;
      if (d > 0 && d < 0.16) blink = Math.sin((d / 0.16) * Math.PI);
      else if (d >= 0.16) nextBlink = t + 2.5 + Math.random() * 3.5;
    }
    const c = scene.bounds;
    const cx = (c.min[0] + c.max[0]) / 2; const cz = (c.min[2] + c.max[2]) / 2;
    const modelM = m4.mul(m4.translate(cx, 0, cz), m4.mul(m4.rotY(yaw), m4.translate(-cx, 0, -cz)));
    r.render(scene, cam, {
      model: modelM,
      time: still ? 0 : t,
      sway: still ? 0 : 1,
      breath: still ? 0 : 1,
      yaw: still || opts.sleeping ? 0 : Math.sin(t * 0.35) * 0.16,
      pitch: still || opts.sleeping ? 0 : Math.sin(t * 0.23 + 1) * 0.05,
      flapAmt: still ? 0 : 1,
      blink,
    });
    if (!started) {
      started = true;
      el.innerHTML = '';
      el.appendChild(canvas);
      el.classList.add('is-3d');
      if (io) io.observe(canvas);
      if (hintsShown < 3 && !opts.noHint) {
        hintsShown += 1;
        hint = document.createElement('span');
        hint.className = 'dino-3d-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = '↔ Arrastra para girar';
        el.appendChild(hint);
      }
    }
    if (!still || dragging || Math.abs(vel) > 0.0005) raf = requestAnimationFrame(frame);
    else lastDraw = 0;
  };
  const kick = () => { if (!raf && visible) { lastDraw = 0; raf = requestAnimationFrame(frame); } };
  let hint = null;
  const dropHint = () => { if (hint) { hint.remove(); hint = null; } };
  const onDown = (e) => { dropHint(); dragging = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture?.(e.pointerId); kick(); };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    yaw += dx * 0.012;
    vel = dx * 0.012;
    kick();
  };
  const onUp = () => { dragging = false; kick(); };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { dropHint(); vel = -0.06; kick(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { dropHint(); vel = 0.06; kick(); e.preventDefault(); }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('keydown', onKey);
  canvas.style.touchAction = 'pan-y';
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) kick();
    });
  }
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); };
  document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });
  kick();
  return {
    canvas,
    /** Llamar después de mover el lienzo a otro contenedor. */
    kick: () => { visible = true; kick(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      visible = false;
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      try { r.dispose(scene); r.destroy(); } catch { /* ya perdido */ }
    },
  };
}
