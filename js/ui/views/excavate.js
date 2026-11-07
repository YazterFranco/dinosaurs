// Excavación: elegir yacimiento y minijuego por capas.
import { SPECIES_BY_ID, PERIODS } from '../../data/species.js';
import { SITES, SITES_BY_ID, CURIOS } from '../../data/world.js';
import {
  createDig, strike, digRewards, COLS, ROWS, PICK_COST, BRUSH_COST,
} from '../../systems/dig.js';
import { addDna, addMoney, addXp } from '../../systems/game.js';
import { dinoSVG } from '../../render/dino-svg.js';
import { esc, bar, setBar, openSheet, closeSheet, toast } from '../dom.js';

let dig = null;
let tool = 'pico';

const BONES = {
  craneo: '<path d="M8,30 C6,14 22,6 40,8 C60,9 74,16 82,26 L90,30 C92,36 84,40 76,38 L60,40 C50,48 34,48 22,44 C12,42 8,38 8,30 Z M30,22 a6,6 0 1 0 0.1,0 Z" fill-rule="evenodd"/>',
  femur: '<path d="M10,14 a8,8 0 1 1 10,10 L70,24 a8,8 0 1 1 10,-10 a8,8 0 1 1 0,16 a8,8 0 1 1 -10,-6 L20,34 a8,8 0 1 1 -10,-4 a8,8 0 1 1 0,-16 Z"/>',
  vertebra: '<path d="M30,40 h40 v20 h-40 Z M44,10 h12 v30 h-12 Z M10,44 l20,0 0,12 -20,4 Z M90,44 l-20,0 0,12 20,4 Z M38,60 h24 l-4,26 h-16 Z"/>',
  costilla: '<path d="M30,6 C70,12 76,60 50,94 L42,90 C64,58 58,22 26,14 Z"/>',
  garra: '<path d="M30,6 C70,10 82,56 58,94 C54,72 48,40 26,22 Z"/>',
  diente: '<path d="M30,12 C50,20 66,50 54,90 C46,70 34,56 22,48 C18,32 22,18 30,12 Z"/>',
};

function boneSvg(it) {
  const w = it.w * 100;
  const h = it.h * 100;
  let shape = BONES[it.hueso] || BONES.diente;
  const view = it.hueso === 'craneo' ? '0 0 100 50' : it.hueso === 'femur' ? '0 0 100 48' : '0 0 100 100';
  if (it.hueso === 'costilla' || it.hueso === 'garra') shape = shape.replace('<path', '<path');
  const opacity = 0.55 + 0.45 * it.calidad;
  return `<svg viewBox="${view}" preserveAspectRatio="none" style="width:${w > h ? 96 : 80}%;height:${h > w ? 96 : 80}%"><g fill="#f3ead2" stroke="#6b5434" stroke-width="2.5" opacity="${opacity}">${shape}</g>${it.calidad < 1 ? '<path d="M35,10 l8,14 l-6,8 l10,12" stroke="#6b5434" stroke-width="3" fill="none"/>' : ''}</svg>`;
}

let appRef = null;

export function render(el, params, app) {
  appRef = app;
  const s = app.state;
  if (params[0] && dig && dig.sitio === params[0]) return renderDig(el, app);
  if (params[0] && SITES_BY_ID[params[0]]) {
    // Llegar con un enlace a un sitio sin excavación activa: volver al listado.
    dig = null;
  }
  const byCont = {};
  for (const site of SITES) (byCont[site.continente] ||= []).push(site);
  const first = s.contadores.excavaciones === 0;
  el.innerHTML = `
    <div class="view-head"><div><h1>Excavar</h1><p class="muted">Cada yacimiento es un lugar real. Allí solo aparecen las especies que se hallaron en esas rocas.</p></div></div>
    ${first ? '<div class="mission"><span class="mi">⛏️</span><span class="grow"><b>Tu primera excavación es gratis</b><span class="small">Usa el pico para romper roca rápido y la brocha cerca de los huesos para no dañarlos.</span></span></div>' : ''}
    ${Object.entries(byCont).map(([cont, sites]) => `<h2 class="continent">${esc(cont)}</h2>${sites.map((site) => siteCard(s, site, first)).join('')}`).join('')}`;
  el.querySelectorAll('[data-site]').forEach((b) => b.addEventListener('click', () => startDig(app, b.dataset.site)));
}

function siteCard(s, site, first) {
  const locked = s.nivel < site.nivel;
  const cost = first ? 0 : site.costo;
  const per = PERIODS[site.periodo];
  return `<article class="site${locked ? ' locked' : ''}" style="--rock:${site.roca}">
    <div>
      <h3>${esc(site.nombre)}</h3>
      <p class="where">${esc(site.lugar)} · <span class="tag tag-${site.periodo.slice(0, 3)}">${per.nombre}</span> ${esc(site.ma)}</p>
    </div>
    ${locked ? `<span class="tag">🔒 Nivel ${site.nivel}</span>`
      : `<button class="btn btn-sm" type="button" data-site="${site.id}" ${s.monedas >= cost ? '' : 'disabled'}>${cost ? `Excavar · ${cost} 🪙` : 'Excavar gratis'}</button>`}
    <div class="species">${site.especies.map((id) => {
      const sp = SPECIES_BY_ID[id];
      const known = (s.genoma[id] || 0) > 0;
      return `<span title="${known ? esc(sp.nombre) : 'Especie sin descubrir'}">${dinoSVG(sp, null, { silhouette: !known, noShadow: true })}</span>`;
    }).join('')}</div>
    <p class="fact">${esc(site.dato)}</p>
  </article>`;
}

function startDig(app, siteId) {
  const s = app.state;
  const site = SITES_BY_ID[siteId];
  const first = s.contadores.excavaciones === 0;
  const cost = first ? 0 : site.costo;
  if (s.monedas < cost) { toast('No te alcanzan las monedas.', 'bad'); return; }
  app.do((st) => { addMoney(st, -cost); return null; }, { render: false, sound: false });
  dig = createDig(siteId, { guiada: first, energiaExtra: s.mejoras.energia * 6 });
  tool = 'pico';
  app.sfx.dig();
  app.go(`excavar/${siteId}`);
}

function renderDig(el, app) {
  const site = SITES_BY_ID[dig.sitio];
  el.innerHTML = `<div class="dig-wrap">
    <div class="view-head"><div><h1>${esc(site.nombre)}</h1><p class="muted small">${esc(site.lugar)} · ${esc(site.ma)}</p></div>
      <button class="btn btn-ghost btn-sm" type="button" data-end>Terminar</button></div>
    <div class="energy"><span>⚡</span>${bar((dig.energia / dig.energiaMax) * 100, 'amber nolow big')}<span data-en>${dig.energia}</span></div>
    <div class="dig-board" id="board">
      <div class="dig-items">${dig.items.map((it) => `<div class="dig-item" data-item="${dig.items.indexOf(it)}" style="grid-column:${it.x + 1}/span ${it.w};grid-row:${it.y + 1}/span ${it.h}">${it.tipo === 'hueso' ? boneSvg(it) : `<span class="curio">${it.icono}</span>`}</div>`).join('')}</div>
      <div class="dig-cells">${Array.from({ length: ROWS }).map((_, y) => Array.from({ length: COLS }).map((__, x) => `<button class="cell" type="button" data-x="${x}" data-y="${y}" data-l="${dig.grid[y][x].capa}" aria-label="Roca fila ${y + 1}, columna ${x + 1}"></button>`).join('')).join('')}</div>
    </div>
    <div class="tools" role="group" aria-label="Herramienta">
      <button class="tool" type="button" data-tool="pico" aria-pressed="${tool === 'pico'}">⛏️ <span>Pico<small>Rompe mucho · ${PICK_COST} ⚡ · puede dañar huesos</small></span></button>
      <button class="tool" type="button" data-tool="brocha" aria-pressed="${tool === 'brocha'}">🖌️ <span>Brocha<small>Quita una capa · ${BRUSH_COST} ⚡ · segura</small></span></button>
    </div>
    <div class="finds" id="finds">${foundTags()}</div>
    <p class="small muted" style="margin-top:10px">${esc(site.dato)}</p>
  </div>`;
  el.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => {
    tool = b.dataset.tool;
    el.querySelectorAll('[data-tool]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    app.sfx.tap();
  }));
  el.querySelector('[data-end]').addEventListener('click', () => finish(app));
  el.querySelectorAll('.cell').forEach((c) => c.addEventListener('click', () => hit(app, el, +c.dataset.x, +c.dataset.y)));
  paint(el);
}

function foundTags() {
  return dig.hallazgos.map((i) => {
    const it = dig.items[i];
    if (it.tipo === 'curio') return `<span class="tag tag-amber">${it.icono} ${esc(it.nombre)}</span>`;
    const sp = SPECIES_BY_ID[it.especie];
    return `<span class="tag">🦴 ${esc(it.nombre)} de ${esc(sp.corto || sp.nombre)}${it.calidad < 1 ? ' (dañado)' : ''}</span>`;
  }).join('');
}

function paint(el) {
  el.querySelectorAll('.cell').forEach((c) => {
    const cell = dig.grid[+c.dataset.y][+c.dataset.x];
    c.dataset.l = String(cell.capa);
    c.classList.toggle('glint', cell.capa === 1 && cell.item !== null);
    if (cell.capa === 0) c.setAttribute('aria-label', cell.item !== null ? 'Fósil expuesto' : 'Tierra excavada');
  });
  setBar(el.querySelector('.energy .bar'), (dig.energia / dig.energiaMax) * 100);
  el.querySelector('[data-en]').textContent = dig.energia;
}

function hit(app, el, x, y) {
  if (!dig || dig.terminado) return;
  const r = strike(dig, tool, x, y);
  if (!r.ok) { toast(r.msg, 'bad'); return; }
  (tool === 'pico' ? app.sfx.dig : app.sfx.brush)();
  const cellEl = el.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
  cellEl.classList.remove('shake');
  void cellEl.offsetWidth;
  cellEl.classList.add('shake');
  if (r.dano) {
    toast(`¡Cuidado! Dañaste el ${r.dano.nombre.toLowerCase()}. Usa la brocha cuando el fósil ya se ve.`, 'bad', '💥');
    const itEl = el.querySelector(`[data-item="${dig.items.indexOf(r.dano)}"]`);
    if (itEl && r.dano.tipo === 'hueso') itEl.innerHTML = boneSvg(r.dano);
  }
  for (const it of r.encontrados) {
    app.sfx.bone();
    const idx = dig.items.indexOf(it);
    el.querySelector(`[data-item="${idx}"]`).classList.add('found');
    if (it.tipo === 'hueso') {
      const sp = SPECIES_BY_ID[it.especie];
      toast(`¡${it.nombre} de ${sp.corto || sp.nombre}!`, 'good', '🦴');
    } else {
      toast(`¡Encontraste: ${it.nombre}!`, 'good', it.icono);
    }
  }
  el.querySelector('#finds').innerHTML = foundTags();
  paint(el);
  if (dig.terminado) setTimeout(() => finish(app), 700);
}

function applyRewards(app) {
  const site = SITES_BY_ID[dig.sitio];
  const { adn, curios } = digRewards(dig);
  const lines = [];
  const newSpecies = [];
  const done = dig;
  app.do((st) => {
    for (const [id, p] of Object.entries(adn)) {
      const wasNew = !(st.genoma[id] > 0);
      const res = addDna(st, id, p);
      if (wasNew) newSpecies.push(id);
      lines.push({ id, p, res });
    }
    for (const c of curios) {
      st.inventario.curios[c] = (st.inventario.curios[c] || 0) + 1;
      st.contadores.curios += 1;
    }
    st.contadores.excavaciones += 1;
    st.contadores.huesos += done.hallazgos.filter((i) => done.items[i].tipo === 'hueso').length;
    if (!st.sitiosVisitados.includes(site.id)) st.sitiosVisitados.push(site.id);
    addXp(st, 15 + lines.length * 5);
    return null;
  }, { render: false, sound: false });
  dig = null;
  return { lines, curios, newSpecies };
}

function finish(app) {
  if (!dig) return;
  const { lines, curios, newSpecies } = applyRewards(app);
  const total = lines.reduce((a, l) => a + l.p, 0);
  const body = openSheet('Resultados de la excavación', `
    ${lines.length ? `<div class="list">${lines.map((l) => {
      const sp = SPECIES_BY_ID[l.id];
      return `<div class="row" style="cursor:default"><span class="thumb">${dinoSVG(sp, null, { noShadow: true })}</span><span class="grow"><span class="title">${esc(sp.nombre)}${newSpecies.includes(l.id) ? ' <span class="tag tag-amber">¡Nueva!</span>' : ''}</span><span class="sub">+${l.p.toFixed(1)} % de ADN → ${l.res.despues.toFixed(1)} %</span>${bar(l.res.despues, `${l.res.despues >= 50 ? 'leaf' : 'amber'} nolow`)}</span></div>`;
    }).join('')}</div>` : '<p>Esta vez no recuperaste fósiles completos. Los huesos a medio excavar solo aportan un poco de ADN.</p>'}
    ${curios.length ? `<h3 style="margin-top:14px">Hallazgos</h3><ul class="funfacts" style="margin-top:8px">${curios.map((c) => { const k = CURIOS.find((x) => x.id === c); return `<li>${k.icono} <b>${esc(k.nombre)}</b>: ${esc(k.dato)}</li>`; }).join('')}</ul>` : ''}
    <p class="small muted" style="margin-top:12px">${total > 0 ? 'Con 50 % de genoma puedes sintetizar un huevo en el Criadero.' : 'Consejo: usa el pico en roca profunda y la brocha cuando aparezca el brillo ✦ de un fósil.'}</p>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <a class="btn" href="#/criadero">Ir al Criadero</a>
      <button class="btn btn-ghost" type="button" data-again>Otra excavación</button>
    </div>
    ${newSpecies.length ? `<p style="margin-top:10px"><a href="#/dinopedia/${newSpecies[0]}">Lee la ficha de tu nuevo descubrimiento</a></p>` : ''}`, { onClose: () => { if (location.hash.startsWith('#/excavar/')) app.go('excavar'); } });
  body.querySelector('[data-again]').addEventListener('click', () => { closeSheet(); app.go('excavar'); });
  if (lines.length) app.sfx.ok();
}

export function leave() {
  // Si sales a mitad de excavación, se guarda lo que ya encontraste.
  if (dig && !location.hash.startsWith(`#/excavar/${dig.sitio}`) && appRef) {
    const { lines } = applyRewards(appRef);
    const total = lines.reduce((a, l) => a + l.p, 0);
    toast(total > 0 ? `Excavación guardada: +${total.toFixed(1)} % de ADN.` : 'Dejaste la excavación sin fósiles completos.', total > 0 ? 'good' : '', '⛏️');
  }
}
