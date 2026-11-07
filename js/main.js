// Arranque, rutas, bucle de juego y HUD.
import * as G from './systems/game.js';
import { checkProgress, currentMission } from './systems/missions.js';
import { load, save } from './store.js';
import { sfx, setSound } from './audio.js';
import { toast, fmt, runSheetTick, sheetOpen, closeSheet } from './ui/dom.js';
import { XP_LEVELS, MAX_LEVEL } from './data/world.js';
import { SPECIES_BY_ID } from './data/species.js';

import * as starterView from './ui/views/starter.js';
import * as parkView from './ui/views/park.js';
import * as nurseryView from './ui/views/nursery.js';
import * as excavateView from './ui/views/excavate.js';
import * as dinopediaView from './ui/views/dinopedia.js';
import * as moreView from './ui/views/more.js';
import * as quizView from './ui/views/quiz.js';
import * as contestView from './ui/views/contest.js';
import { openDinoSheet } from './ui/views/dino-sheet.js';

const ROUTES = {
  inicio: starterView,
  parque: parkView,
  criadero: nurseryView,
  excavar: excavateView,
  dinopedia: dinopediaView,
  mas: moreView,
  misiones: moreView,
  tienda: moreView,
  hallazgos: moreView,
  diario: moreView,
  ajustes: moreView,
  quiz: quizView,
  concursos: contestView,
};
const TAB_OF = {
  parque: 'parque', criadero: 'criadero', excavar: 'excavar', dinopedia: 'dinopedia',
  mas: 'mas', misiones: 'mas', tienda: 'mas', hallazgos: 'mas', diario: 'mas', ajustes: 'mas', quiz: 'mas', concursos: 'mas',
};

const viewEl = document.getElementById('view');
let state = load() || G.createGame();
let current = { name: null, params: [], view: null };
let saveTimer = null;
let lastLevel = state.nivel;
let lastCoins = state.monedas;

const app = {
  get state() { return state; },
  set state(s) { state = s; },
  sfx,
  go(route) {
    if (location.hash === `#/${route}`) app.refresh();
    else location.hash = `#/${route}`;
  },
  refresh() {
    if (!current.view) return;
    const y = window.scrollY;
    current.view.render(viewEl, current.params, app, current.name);
    window.scrollTo(0, y);
    updateHud();
  },
  /** Ejecuta una acción del juego, avisa del resultado y guarda. */
  do(fn, opts = {}) {
    let r;
    try {
      r = fn(state);
    } catch (err) {
      console.error(err);
      toast('Algo salió mal con esa acción. Inténtalo de nuevo.', 'bad');
      return null;
    }
    if (r && r.msg && opts.toast !== false) toast(r.msg, r.ok ? 'good' : 'bad', opts.icon || (r.ok ? '' : '⚠️'));
    if (r && opts.sound !== false) (r.ok ? (opts.sfx || sfx.ok) : sfx.no)();
    after();
    if (opts.render !== false) app.refresh();
    return r;
  },
  after,
  openDino(id) { openDinoSheet(app, id); },
  save: () => persist(true),
  reset(newState) {
    state = newState;
    lastLevel = state.nivel;
    lastCoins = state.monedas;
    setSound(state.ajustes.sonido);
    persist(true);
    closeSheet();
    app.go(state.iniciado ? 'parque' : 'inicio');
  },
};
window.__dinoApp = app; // útil para depurar y para las pruebas E2E

function after() {
  const done = checkProgress(state);
  for (const d of done) {
    if (d.tipo === 'mision') toast(`Misión cumplida: ${d.titulo} (+${d.premio} monedas)`, 'gold', '✅');
    else toast(`¡Logro! ${d.titulo}`, 'gold', d.icono);
  }
  if (done.length) sfx.coin();
  if (state.nivel > lastLevel) {
    toast(`¡Tu refugio subió al nivel ${state.nivel}! Revisa los nuevos yacimientos.`, 'gold', '⭐');
    sfx.level();
    lastLevel = state.nivel;
  }
  updateHud();
  persist();
}

function persist(now = false) {
  clearTimeout(saveTimer);
  if (now) save(state);
  else saveTimer = setTimeout(() => save(state), 800);
}

// ---------- HUD ----------
function updateHud() {
  const { visitantes } = G.parkStats(state);
  const coins = document.querySelector('[data-bind="monedas"]');
  coins.textContent = `🪙 ${fmt(state.monedas)}`;
  if (state.monedas > lastCoins) {
    coins.classList.remove('bump');
    void coins.offsetWidth;
    coins.classList.add('bump');
  }
  lastCoins = state.monedas;
  document.querySelector('[data-bind="visitantes"]').textContent = `👥 ${fmt(visitantes)}`;
  const lvl = document.querySelector('[data-bind="nivel"]');
  const lo = XP_LEVELS[state.nivel - 1];
  const hi = XP_LEVELS[state.nivel] ?? lo;
  const p = state.nivel >= MAX_LEVEL ? 100 : ((state.xp - lo) / (hi - lo)) * 100;
  lvl.style.setProperty('--p', p.toFixed(1));
  lvl.innerHTML = `<span>${state.nivel}</span>`;
  lvl.setAttribute('aria-label', `Nivel ${state.nivel}, ${Math.round(p)} % hacia el siguiente`);

  const ready = state.huevos.filter((e) => e.progreso >= e.duracion || e.girar).length;
  const bc = document.querySelector('[data-bind="badgeCriadero"]');
  bc.hidden = !ready;
  bc.textContent = ready;
  const m = currentMission(state);
  const bm = document.querySelector('[data-bind="badgeMas"]');
  bm.hidden = !(m && m.check(state));
  bm.textContent = '!';
}

// ---------- Rutas ----------
function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  let [name, ...params] = raw.split('/').filter(Boolean).map(decodeURIComponent);
  if (!state.iniciado) name = 'inicio';
  else if (!name || !ROUTES[name] || name === 'inicio') name = 'parque';
  const view = ROUTES[name];
  if (current.view && current.view.leave) current.view.leave();
  if (sheetOpen()) closeSheet();
  current = { name, params, view };
  document.getElementById('hud').hidden = name === 'inicio';
  document.getElementById('tabbar').hidden = name === 'inicio';
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === TAB_OF[name]) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  view.render(viewEl, params, app, name);
  window.scrollTo(0, 0);
  viewEl.focus({ preventScroll: true });
  updateHud();
}

// ---------- Bucle ----------
function loop() {
  const now = Date.now();
  const dt = Math.min(5, Math.max(0, (now - state.ultimo) / 1000));
  state.ultimo = now;
  if (!state.iniciado || dt <= 0) return;
  const events = G.tick(state, dt);
  for (const ev of events) handleEvent(ev);
  if (events.length) after();
  else updateHud();
  if (current.view && current.view.tick) current.view.tick(app, events);
  runSheetTick();
  persist();
}

function handleEvent(ev) {
  const d = ev.dino && state.dinos.find((x) => x.id === ev.dino);
  if (ev.tipo === 'huevoListo') {
    const e = state.huevos.find((x) => x.id === ev.huevo);
    const sp = e && SPECIES_BY_ID[e.especie];
    toast(`¡Un huevo de ${sp ? sp.corto || sp.nombre : 'dinosaurio'} se está moviendo! Ve al Criadero.`, 'gold', '🥚');
    sfx.chirp();
  } else if (ev.tipo === 'crece' && d) {
    toast(ev.stage === 'adulto' ? `${d.nombre} ya es adulto.` : `${d.nombre} creció: ahora es juvenil.`, 'good', '🌱');
    sfx.roar(ev.stage === 'adulto');
  } else if (ev.tipo === 'clinica' && d) {
    toast(`${d.nombre} se enfermó y está en la clínica. Págale el tratamiento.`, 'bad', '🏥');
  }
}

window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist(true);
  else {
    const r = G.catchUp(state);
    if (r.monedas > 0) toast(`Mientras no estabas, los visitantes dejaron ${fmt(r.monedas)} monedas.`, 'gold', '👥');
    after();
  }
});
window.addEventListener('pagehide', () => persist(true));

// ---------- Inicio ----------
setSound(state.ajustes.sonido);
if (state.iniciado) {
  const r = G.catchUp(state);
  if (r.monedas > 0) setTimeout(() => toast(`¡Bienvenido de vuelta! Los visitantes dejaron ${fmt(r.monedas)} monedas.`, 'gold', '👥'), 600);
} else {
  state.ultimo = Date.now();
}
route();
setInterval(loop, 1000);
