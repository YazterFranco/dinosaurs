// Guardado en el navegador (localStorage) con exportación por código.
import { createGame, SAVE_VERSION } from './systems/game.js';

const KEY = 'dino-refugio-partida';

function safeGet() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function safeSet(v) {
  try { localStorage.setItem(KEY, v); return true; } catch { return false; }
}

export function migrate(data) {
  const base = createGame();
  // Rellena campos nuevos sin perder lo guardado.
  const merged = { ...base, ...data };
  merged.inventario = { ...base.inventario, ...(data.inventario || {}) };
  merged.inventario.comida = { ...(data.inventario && data.inventario.comida) };
  merged.contadores = { ...base.contadores, ...(data.contadores || {}) };
  merged.mejoras = { ...base.mejoras, ...(data.mejoras || {}) };
  merged.ajustes = { ...base.ajustes, ...(data.ajustes || {}) };
  merged.version = SAVE_VERSION;
  return merged;
}

export function load() {
  const raw = safeGet();
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function save(state) {
  state.ultimo = Date.now();
  return safeSet(JSON.stringify(state));
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
}

export function exportCode(state) {
  const json = JSON.stringify(state);
  return btoa(unescape(encodeURIComponent(json)));
}

export function importCode(code) {
  const json = decodeURIComponent(escape(atob(String(code).trim())));
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.dinos) || typeof data.monedas !== 'number') throw new Error('Código no válido');
  return migrate(data);
}
