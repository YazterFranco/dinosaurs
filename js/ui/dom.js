// Utilidades de interfaz: escape de texto, toasts y hoja modal.

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmt(n) {
  return Math.round(n).toLocaleString('es');
}

export function fmtKg(kg) {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('es', { maximumFractionDigits: 1 })} t`;
  return `${fmt(kg)} kg`;
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

export function pct(v) {
  return `${Math.round(Math.max(0, Math.min(100, v)))}%`;
}

export function bar(value, cls = '') {
  const low = value < 25 && !cls.includes('nolow') ? ' low' : '';
  return `<div class="bar ${cls}${low}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value)}"><i style="--v:${pct(value)}"></i></div>`;
}

export function setBar(el, value) {
  if (!el) return;
  const i = el.querySelector('i');
  if (i) i.style.setProperty('--v', pct(value));
  el.setAttribute('aria-valuenow', Math.round(value));
  if (!el.classList.contains('nolow')) el.classList.toggle('low', value < 25);
}

const toastBox = () => document.getElementById('toasts');

export function toast(text, kind = '', icon = '') {
  const box = toastBox();
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon ? `<span class="ti" aria-hidden="true">${icon}</span>` : ''}<span>${esc(text)}</span>`;
  box.prepend(el);
  while (box.children.length > 2) box.lastElementChild.remove();
  const life = Math.min(5000, 1900 + text.length * 28);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, life);
  el.addEventListener('click', () => el.remove());
}

// ---------- hoja inferior ----------
let onSheetClose = null;
let sheetTicker = null;

export function openSheet(title, bodyHtml, opts = {}) {
  const dlg = document.getElementById('sheet');
  dlg.innerHTML = `<div class="sheet-head"><h2 id="sheet-title">${title}</h2>`
    + '<button class="icon-btn sheet-close" type="button" aria-label="Cerrar">✕</button></div>'
    + `<div class="sheet-body">${bodyHtml}</div>`;
  dlg.querySelector('.sheet-close').addEventListener('click', () => closeSheet());
  onSheetClose = opts.onClose || null;
  sheetTicker = opts.tick || null;
  if (!dlg.open) {
    dlg.showModal();
    dlg.addEventListener('close', handleClose, { once: true });
  }
  dlg.addEventListener('click', backdropClose);
  return dlg.querySelector('.sheet-body');
}

function backdropClose(e) {
  const dlg = e.currentTarget;
  if (e.target !== dlg) return;
  const r = dlg.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) closeSheet();
}

function handleClose() {
  const dlg = document.getElementById('sheet');
  dlg.removeEventListener('click', backdropClose);
  sheetTicker = null;
  const cb = onSheetClose;
  onSheetClose = null;
  if (cb) cb();
}

export function closeSheet() {
  const dlg = document.getElementById('sheet');
  if (dlg.open) dlg.close();
}

export function sheetOpen() {
  return document.getElementById('sheet').open;
}

export function setSheetTick(fn) { sheetTicker = fn; }
export function runSheetTick() { if (sheetTicker && sheetOpen()) sheetTicker(); }

export function sheetBody() {
  return document.querySelector('#sheet .sheet-body');
}

export function setSheetTitle(html) {
  const h = document.getElementById('sheet-title');
  if (h) h.innerHTML = html;
}

export function confirmSheet(title, text, okLabel, onOk, danger = false) {
  const body = openSheet(esc(title), `<p>${esc(text)}</p><div style="display:flex;gap:8px;margin-top:16px">`
    + '<button class="btn btn-ghost" data-no type="button">Cancelar</button>'
    + `<button class="btn ${danger ? 'btn-danger' : ''}" data-yes type="button">${esc(okLabel)}</button></div>`);
  body.querySelector('[data-no]').addEventListener('click', closeSheet);
  body.querySelector('[data-yes]').addEventListener('click', () => { closeSheet(); onOk(); });
}

export function heartBurst(container, x, y, glyph = '❤️') {
  const h = document.createElement('span');
  h.className = 'heart';
  h.textContent = glyph;
  h.style.left = `${x}px`;
  h.style.top = `${y}px`;
  container.appendChild(h);
  setTimeout(() => h.remove(), 1000);
}
