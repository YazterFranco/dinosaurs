// Parque: diorama vivo del recinto con los dinosaurios paseando.
import { SPECIES_BY_ID } from '../../data/species.js';
import { BIOMES, ENRICHMENT, ENCLOSURE_CAPACITY } from '../../data/world.js';
import {
  dinosIn, stageOf, comfortOf, attractionOf,
} from '../../systems/game.js';
import { currentMission } from '../../systems/missions.js';
import { dinoSVG } from '../../render/dino-svg.js';
import { esc, bar, setBar, heartBurst } from '../dom.js';

const SIZE_W = { pequeno: 0.27, mediano: 0.33, grande: 0.41, gigante: 0.5 };
const STAGE_S = { cria: 0.62, juvenil: 0.82, adulto: 1 };
const REQ_ICON = { comida: '🍽️', caricia: '🤚', juego: '⚽' };
const DECOR_SPOTS = [[0.12, 0.62], [0.88, 0.6], [0.66, 0.95], [0.34, 0.97]];

const pos = new Map();
let selected = null;
let raf = 0;
let sceneSig = '';

export function render(el, params, app) {
  const s = app.state;
  if (params[0] && s.recintos.some((r) => r.id === params[0])) selected = params[0];
  if (!selected || !s.recintos.some((r) => r.id === selected)) selected = s.recintos[0].id;
  const rec = s.recintos.find((r) => r.id === selected);
  const biome = BIOMES[rec.bioma];
  const mission = currentMission(s);
  const dinos = dinosIn(s, rec.id);
  const comfort = dinos.length ? Math.round(dinos.reduce((a, d) => a + comfortOf(s, d).valor, 0) / dinos.length) : null;
  const visitors = Math.round(dinos.reduce((a, d) => a + attractionOf(s, d), 0) / 4);

  el.innerHTML = `
    ${mission ? `<a class="mission" href="#/${mission.ir}"><span class="mi" aria-hidden="true">🧭</span><span class="grow"><b>${esc(mission.titulo)}</b><span class="small">${esc(mission.desc)}</span></span><span class="tag tag-amber">+${mission.premio} 🪙</span></a>` : ''}
    <div class="chips" role="tablist" aria-label="Recintos">
      ${s.recintos.map((r) => `<button class="chip" role="tab" type="button" aria-selected="${r.id === rec.id}" data-rec="${r.id}">${BIOMES[r.bioma].icono} ${esc(r.nombre)} <span class="muted small">${dinosIn(s, r.id).length}/${ENCLOSURE_CAPACITY}</span></button>`).join('')}
      <a class="chip" href="#/tienda/recintos" aria-label="Construir un recinto">＋ Nuevo</a>
    </div>
    <div class="diorama" id="diorama" style="--sky2:${biome.cielo[1]}">
      ${landscape(rec.bioma)}
      <div class="diorama-meta">
        <span class="tag">${biome.icono} ${esc(biome.nombre)}</span>
        ${comfort !== null ? `<span class="tag" title="Comodidad promedio">😊 ${comfort}%</span>` : ''}
        <span class="tag" title="Visitantes mirando este recinto">👥 ${visitors}</span>
      </div>
      ${rec.enriquecimiento.map((id, i) => `<span class="decor" style="left:${DECOR_SPOTS[i][0] * 100}%;top:${DECOR_SPOTS[i][1] * 100}%" title="${esc(ENRICHMENT[id].nombre)}">${ENRICHMENT[id].icono}</span>`).join('')}
      <div id="walkers"></div>
    </div>
    <p class="small muted" style="margin-top:8px">${esc(biome.dato)}</p>
    <div class="section-head section"><h2>Habitantes</h2><a class="btn btn-ghost btn-sm" href="#/tienda/enriquecimiento">Mejorar recinto</a></div>
    ${dinos.length ? `<div class="dino-cards">${dinos.map((d) => dinoRow(s, d)).join('')}</div>`
      : `<div class="empty"><p>Este recinto está vacío.</p><p class="small">Incuba un huevo en el Criadero: la cría llegará al recinto que mejor le quede.</p><a class="btn" href="#/criadero" style="margin-top:12px">Ir al Criadero</a></div>`}
  `;

  el.querySelectorAll('[data-rec]').forEach((b) => b.addEventListener('click', () => {
    selected = b.dataset.rec;
    sceneSig = '';
    app.sfx.tap();
    render(el, [], app);
  }));
  el.querySelectorAll('[data-dino]').forEach((b) => b.addEventListener('click', () => app.openDino(b.dataset.dino)));
  sceneSig = '';
  drawWalkers(app);
  startLoop(app);
}

function dinoRow(s, d) {
  const sp = SPECIES_BY_ID[d.especie];
  const stage = stageOf(d);
  const asleep = d.duermeHasta > s.tiempoJuego;
  const alert = d.peticion || d.hambre < 25 || d.salud < 40 || d.enClinica;
  return `<button class="row dino-row" type="button" data-dino="${d.id}" data-row="${d.id}">
    <span class="thumb">${dinoSVG(sp, d.genes, { stage, sleeping: asleep, noShadow: true })}</span>
    <span class="grow">
      <span class="title">${esc(d.nombre)} ${d.genes.sexo === 'M' ? '♂' : '♀'}</span>
      <span class="sub">${esc(sp.corto || sp.nombre)} · ${stage === 'cria' ? 'Cría' : stage === 'juvenil' ? 'Juvenil' : 'Adulto'}${d.enClinica ? ' · <b class="tag tag-warn">En clínica</b>' : ''}${asleep ? ' · 💤' : ''}</span>
      <span class="needs">
        <span>🍖 ${bar(d.hambre)}</span>
        <span>😊 ${bar(d.animo, 'leaf')}</span>
      </span>
    </span>
    ${alert ? '<i class="alert-dot" aria-label="Necesita atención"></i>' : ''}
  </button>`;
}

function landscape(bioma) {
  const b = BIOMES[bioma];
  let deco = '';
  if (bioma === 'bosque') {
    for (let i = 0; i < 9; i += 1) {
      const x = 12 + i * 47 + (i % 2) * 14;
      const h = 70 + (i % 3) * 18;
      deco += `<path d="M${x},${150 - h} l-18,${h * 0.55} h8 l-14,${h * 0.45} h48 l-14,${-h * 0.45} h8 z" fill="${b.cerca}" opacity="${0.75 + (i % 2) * 0.2}"/>`;
    }
  } else if (bioma === 'llanura') {
    deco += `<path d="M-10,168 C80,150 160,190 240,170 S360,160 420,175 L420,190 C340,180 260,200 180,186 S40,176 -10,184 Z" fill="#7fb5c4" opacity=".85"/>`;
    for (let i = 0; i < 7; i += 1) deco += `<g transform="translate(${30 + i * 58} ${148 + (i % 2) * 6})"><path d="M0,0 q-10,-14 -22,-12 M0,0 q-4,-18 -10,-24 M0,0 q4,-18 10,-24 M0,0 q10,-14 22,-12" stroke="${b.cerca}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`;
  } else if (bioma === 'pantano') {
    deco += `<ellipse cx="120" cy="190" rx="110" ry="18" fill="${b.agua}" opacity=".8"/><ellipse cx="320" cy="175" rx="80" ry="12" fill="${b.agua}" opacity=".7"/>`;
    for (let i = 0; i < 10; i += 1) deco += `<path d="M${20 + i * 40},${160 + (i % 3) * 8} v-${22 + (i % 4) * 6}" stroke="${b.cerca}" stroke-width="3"/><ellipse cx="${20 + i * 40}" cy="${136 + (i % 3) * 8 - (i % 4) * 6}" rx="3" ry="7" fill="#6b4a2a"/>`;
  } else if (bioma === 'desierto') {
    deco += `<path d="M-10,150 C60,120 120,128 190,150 S320,118 420,145 L420,240 L-10,240 Z" fill="${b.lejos}" opacity=".7"/>`;
    for (let i = 0; i < 5; i += 1) {
      const x = 40 + i * 85;
      const y = 160 + (i % 2) * 12;
      const r = 10 + (i % 3) * 5;
      deco += `<path d="M${x - r},${y} q${r * 0.2},${-r * 1.1} ${r},${-r * 1.15} q${r * 0.9},0 ${r},${r * 1.15} z" fill="#c99a6a"/><path d="M${x - r * 0.6},${y - r * 0.6} q${r * 0.4},${-r * 0.45} ${r * 0.8},${-r * 0.4}" stroke="#ecd0a8" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
  } else if (bioma === 'costa') {
    deco += `<rect x="0" y="118" width="400" height="40" fill="${b.agua}"/><path d="M0,124 q20,-6 40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>`;
    for (let i = 0; i < 4; i += 1) {
      const x = 30 + i * 110;
      deco += `<path d="M${x},160 q-4,-30 2,-50" stroke="#6b4a2a" stroke-width="5" fill="none"/><g transform="translate(${x + 2} 110)" fill="${b.cerca}"><path d="M0,0 q-18,-4 -26,8 q14,-8 26,-8z M0,0 q18,-4 26,8 q-14,-8 -26,-8z M0,0 q-8,-16 -22,-14 q14,2 22,14z M0,0 q8,-16 22,-14 q-14,2 -22,14z"/></g>`;
    }
  }
  return `<svg class="land" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="sky-${bioma}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.cielo[0]}"/><stop offset="1" stop-color="${b.cielo[1]}"/></linearGradient>
    <linearGradient id="gr-${bioma}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.suelo[0]}"/><stop offset="1" stop-color="${b.suelo[1]}"/></linearGradient></defs>
    <rect width="400" height="240" fill="url(#sky-${bioma})"/>
    <circle cx="330" cy="48" r="22" fill="#fff6d8" opacity=".9"/>
    <path d="M0,120 C70,86 130,100 200,96 S330,78 400,104 L400,240 L0,240 Z" fill="${b.lejos}" opacity=".7"/>
    <path d="M0,140 C90,120 160,136 240,128 S350,120 400,132 L400,240 L0,240 Z" fill="url(#gr-${bioma})"/>
    ${deco}
  </svg>`;
}

function walkerBox(d, sp, W, H) {
  const p = pos.get(d.id);
  const stage = stageOf(d);
  const depth = 0.78 + (p.y - 0.58) * 0.75;
  const w = Math.min(W, H * 1.45) * SIZE_W[sp.tamano] * STAGE_S[stage] * depth;
  return { w, top: p.y * H - w * 0.633, left: p.x * W - w / 2 };
}

function sigOf(s, d) {
  return `${d.id}:${stageOf(d)}:${d.duermeHasta > s.tiempoJuego ? 1 : 0}:${d.peticion ? d.peticion.tipo : ''}:${d.animo > 70 ? 1 : 0}`;
}

function drawWalkers(app) {
  const s = app.state;
  const box = document.getElementById('walkers');
  const dio = document.getElementById('diorama');
  if (!box || !dio) return;
  const dinos = dinosIn(s, selected).filter((d) => !d.enClinica);
  const sig = dinos.map((d) => sigOf(s, d)).join('|');
  if (sig === sceneSig) return;
  sceneSig = sig;
  const W = dio.clientWidth;
  const H = dio.clientHeight;
  box.innerHTML = dinos.map((d) => {
    const sp = SPECIES_BY_ID[d.especie];
    if (!pos.has(d.id)) {
      const flyer = sp.look.plan === 'flyer';
      pos.set(d.id, {
        x: 0.15 + Math.random() * 0.7,
        y: flyer ? 0.42 + Math.random() * 0.1 : 0.62 + Math.random() * 0.3,
        dir: Math.random() < 0.5 ? -1 : 1,
        speed: 0.012 + Math.random() * 0.02,
        pause: 0,
      });
    }
    const asleep = d.duermeHasta > s.tiempoJuego;
    const stage = stageOf(d);
    const { w } = walkerBox(d, sp, W, H);
    return `<button class="walker${stage === 'cria' && !asleep ? ' hop' : ''}" type="button" data-walk="${d.id}" style="width:${w.toFixed(0)}px" aria-label="${esc(d.nombre)}, ${esc(sp.nombre)}">
      <span class="flip">${dinoSVG(sp, d.genes, { stage, anim: !asleep, sleeping: asleep, mood: d.animo > 70 ? 'feliz' : '' })}</span>
      ${d.peticion ? `<span class="bubble" aria-label="Pide ${d.peticion.tipo}">${REQ_ICON[d.peticion.tipo]}</span>` : ''}
      <span class="nametag">${esc(d.nombre)}</span>
    </button>`;
  }).join('');
  box.querySelectorAll('[data-walk]').forEach((b) => b.addEventListener('click', (e) => {
    const r = dio.getBoundingClientRect();
    heartBurst(dio, e.clientX - r.left - 10, e.clientY - r.top - 20);
    app.sfx.chirp();
    app.openDino(b.dataset.walk);
  }));
  place(s);
}

function place(s) {
  const dio = document.getElementById('diorama');
  if (!dio) return;
  const W = dio.clientWidth;
  const H = dio.clientHeight;
  dio.querySelectorAll('[data-walk]').forEach((el) => {
    const d = s.dinos.find((x) => x.id === el.dataset.walk);
    if (!d) return;
    const sp = SPECIES_BY_ID[d.especie];
    const p = pos.get(d.id);
    const { w, top, left } = walkerBox(d, sp, W, H);
    el.style.width = `${w.toFixed(0)}px`;
    el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
    el.style.zIndex = String(Math.round(p.y * 100));
    el.classList.toggle('left', p.dir < 0);
  });
}

function startLoop(app) {
  cancelAnimationFrame(raf);
  let last = performance.now();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const s = app.state;
    if (!document.getElementById('diorama')) return;
    if (!reduce) {
      for (const d of dinosIn(s, selected)) {
        const p = pos.get(d.id);
        if (!p) continue;
        if (d.duermeHasta > s.tiempoJuego) continue;
        if (p.pause > 0) { p.pause -= dt; continue; }
        p.x += p.dir * p.speed * dt * (d.peticion ? 0.3 : 1);
        if (p.x < 0.1) { p.x = 0.1; p.dir = 1; }
        if (p.x > 0.9) { p.x = 0.9; p.dir = -1; }
        if (Math.random() < dt * 0.25) {
          p.pause = 1 + Math.random() * 3;
          if (Math.random() < 0.5) p.dir *= -1;
        }
      }
    }
    place(s);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

export function tick(app) {
  const s = app.state;
  drawWalkers(app);
  document.querySelectorAll('[data-row]').forEach((row) => {
    const d = s.dinos.find((x) => x.id === row.dataset.row);
    if (!d) return;
    const bars = row.querySelectorAll('.bar');
    setBar(bars[0], d.hambre);
    setBar(bars[1], d.animo);
    const alert = d.peticion || d.hambre < 25 || d.salud < 40 || d.enClinica;
    const dot = row.querySelector('.alert-dot');
    if (alert && !dot) row.insertAdjacentHTML('beforeend', '<i class="alert-dot" aria-label="Necesita atención"></i>');
    if (!alert && dot) dot.remove();
  });
}

export function leave() {
  cancelAnimationFrame(raf);
}
