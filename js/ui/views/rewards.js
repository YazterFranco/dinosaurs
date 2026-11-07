// Recompensas: racha diaria, misiones del día, cofres, energía, evento de la
// semana, bonus del día y colección de accesorios. También las ventanas de
// apertura de cofres, regalo diario y subida de nivel.
import * as R from '../../systems/rewards.js';
import { dayBonus, msToMidnight, msToWeekEnd } from '../../systems/calendar.js';
import { ACCESSORIES, ACCESSORY_IDS } from '../../data/cosmetics.js';
import { RARITY, SPECIES_BY_ID } from '../../data/species.js';
import { dinoSVG } from '../../render/dino-svg.js';
import {
  esc, bar, openSheet, closeSheet,
} from '../dom.js';

const RARITY_COLOR = { comun: RARITY.comun.color, rara: RARITY.rara.color, epica: RARITY.epica.color, legendaria: RARITY.legendaria.color };

export function fmtLong(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h >= 24) return `${Math.floor(h / 24)} d ${h % 24} h`;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${String(sec).padStart(2, '0')} s`;
  return `${sec} s`;
}

export function chestSVG(tipo, open = false) {
  const c = R.CHESTS[tipo];
  const lid = open
    ? `<path d="M14,34 L22,8 L82,8 L90,34 Z" fill="${c.color}" stroke="#2d2a24" stroke-width="3" stroke-linejoin="round" transform="rotate(-24 14 34)"/>`
    : `<path d="M12,40 C12,22 88,22 88,40 Z" fill="${c.color}" stroke="#2d2a24" stroke-width="3"/><rect x="44" y="34" width="12" height="12" rx="3" fill="${c.brillo}" stroke="#2d2a24" stroke-width="2.5"/>`;
  const rays = open ? `<g opacity=".85">${[...Array(9)].map((_, i) => `<path d="M50,40 L${50 + Math.cos((-160 + i * 17.5) * Math.PI / 180) * 60},${40 + Math.sin((-160 + i * 17.5) * Math.PI / 180) * 60}" stroke="${c.brillo}" stroke-width="5" stroke-linecap="round"/>`).join('')}</g>` : '';
  return `<svg class="chest-svg${open ? ' is-open' : ''}" viewBox="0 0 100 90" role="img" aria-label="${esc(c.nombre)}">
    ${rays}
    <ellipse cx="50" cy="84" rx="38" ry="5" fill="#000" opacity=".15"/>
    <rect x="12" y="40" width="76" height="42" rx="6" fill="${c.color}" stroke="#2d2a24" stroke-width="3"/>
    <rect x="12" y="50" width="76" height="7" fill="${c.brillo}" opacity=".55"/>
    <path d="M30,40 v42 M70,40 v42" stroke="#2d2a24" stroke-width="2.5" opacity=".5"/>
    ${lid}
  </svg>`;
}

function confetti() {
  const colors = ['#efa531', '#b9d46a', '#5ea8c0', '#e8708f', '#2e6a4e'];
  return `<div class="confetti">${Array.from({ length: 28 }).map((_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % 5]};animation-delay:${Math.random() * 0.4}s"></i>`).join('')}</div>`;
}

/** Ventana de apertura de cofre: tiembla, se abre y muestra los premios uno a uno. */
export function openChestSheet(app, chestId, onDone) {
  const s = app.state;
  const chest = s.recompensas.cofres.find((c) => c.id === chestId);
  if (!chest) return;
  const def = R.CHESTS[chest.tipo];
  const body = openSheet(esc(def.nombre), `<div class="chest-stage" id="chest-stage">
      <button class="chest-btn wobble" type="button" id="chest-tap" aria-label="Abrir ${esc(def.nombre)}">${chestSVG(chest.tipo)}</button>
      <p class="small muted">${chest.origen ? esc(chest.origen) : ''} · Toca el cofre para abrirlo</p>
    </div><div class="loot" id="loot"></div>`, { onClose: () => { app.refresh(); if (onDone) onDone(); } });
  body.querySelector('#chest-tap').addEventListener('click', () => {
    const r = app.do((st) => R.openChest(st, chestId), { toast: false, render: false, sound: false });
    if (!r || !r.ok) return;
    app.sfx.chest();
    const stage = body.querySelector('#chest-stage');
    stage.innerHTML = `${confetti()}<div class="chest-open">${chestSVG(chest.tipo, true)}</div>`;
    const loot = body.querySelector('#loot');
    r.items.forEach((it, i) => {
      setTimeout(() => {
        const color = it.rareza ? RARITY_COLOR[it.rareza] : '';
        loot.insertAdjacentHTML('beforeend', `<div class="loot-item${it.rareza ? ` r-${it.rareza}` : ''}" style="${color ? `--rc:${color}` : ''}"><span class="li">${it.icono}</span><span>${esc(it.texto)}</span>${it.nuevo ? '<span class="tag tag-amber">¡Nuevo!</span>' : ''}</div>`);
        (it.rareza === 'legendaria' || it.rareza === 'epica' ? app.sfx.level : app.sfx.coin)();
      }, 350 + i * 420);
    });
    setTimeout(() => {
      const more = app.state.recompensas.cofres.length;
      loot.insertAdjacentHTML('afterend', `<div class="sheet-actions">
        ${more ? `<button class="btn btn-amber" type="button" data-next>Abrir otro (${more})</button>` : ''}
        <button class="btn ${more ? 'btn-ghost' : ''}" type="button" data-done>Genial</button></div>`);
      const next = body.querySelector('[data-next]');
      if (next) next.addEventListener('click', () => openChestSheet(app, app.state.recompensas.cofres[0].id, onDone));
      body.querySelector('[data-done]').addEventListener('click', closeSheet);
    }, 450 + r.items.length * 420);
  });
}

/** Ventana del regalo diario con el calendario de 7 días. */
export function dailySheet(app) {
  const s = app.state;
  const st = R.dailyStatus(s);
  const body = openSheet(st.disponible ? '¡Tu regalo de hoy!' : 'Racha diaria', `
    ${streakHeader(s, st)}
    ${calendarRow(st)}
    ${st.perdida ? '<p class="small" style="margin-top:10px">Perdiste la racha anterior, ¡pero hoy empieza una nueva! Cada 7 días ganas un escudo 🛡️ que protege la racha si un día no puedes jugar.</p>' : ''}
    ${st.protegida ? `<p class="small" style="margin-top:10px">🛡️ Faltaste ${st.faltan} día(s), pero tu escudo protegerá la racha.</p>` : ''}
    <div id="daily-out"></div>
    <div class="sheet-actions">${st.disponible ? '<button class="btn btn-amber btn-block" type="button" data-claim>Reclamar regalo</button>' : `<p class="small muted">Próximo regalo en ${fmtLong(msToMidnight())}.</p>`}</div>`,
  { onClose: () => app.refresh() });
  const b = body.querySelector('[data-claim]');
  if (b) b.addEventListener('click', () => {
    const r = app.do((state) => R.claimDaily(state), { toast: false, render: false, sound: false });
    if (!r || !r.ok) return;
    app.sfx.level();
    body.querySelector('#daily-out').innerHTML = `${confetti()}<div class="loot">${r.items.map((it) => `<div class="loot-item"><span class="li">${it.icono}</span><span>${esc(it.texto)}</span></div>`).join('')}</div>
      ${r.bonusPct ? `<p class="small" style="margin-top:8px">🔥 Bonus por racha larga: +${r.bonusPct} % de monedas.</p>` : ''}`;
    body.querySelector('.cal').outerHTML = calendarRow({ ...R.dailyStatus(app.state), dia: r.dia, reclamado: true });
    body.querySelector('.streak-head').outerHTML = streakHeader(app.state, R.dailyStatus(app.state));
    const acts = body.querySelector('.sheet-actions');
    acts.innerHTML = '<button class="btn btn-block" type="button" data-done>¡A jugar!</button>';
    acts.querySelector('[data-done]').addEventListener('click', closeSheet);
  });
}

function streakHeader(s, st) {
  const d = s.recompensas.diaria;
  return `<div class="streak-head"><span class="flame" aria-hidden="true">🔥</span><div><b>${d.racha ? `${d.racha} ${d.racha === 1 ? 'día' : 'días'} de racha` : '¡Empieza tu racha hoy!'}</b><span class="small muted">Mejor racha: ${d.mejorRacha} · Escudos: ${'🛡️'.repeat(d.escudos) || 'ninguno'}</span></div></div>`;
}

function calendarRow(st) {
  const today = st.dia;
  return `<ol class="cal">${R.DAILY_REWARDS.map((r) => {
    const cls = st.reclamado
      ? (r.dia <= today ? 'got' : '')
      : (r.dia < today ? 'got' : r.dia === today && st.disponible ? 'today' : '');
    return `<li class="${cls}${r.dia === 7 ? ' big' : ''}"><span class="d">Día ${r.dia}</span><span class="ci">${r.icono}</span><span class="ct">${esc(r.texto)}</span></li>`;
  }).join('')}</ol>`;
}

/** Ventana de subida de nivel. */
export function levelUpSheet(app, level, info) {
  const body = openSheet(`¡Nivel ${level}!`, `<div class="levelup">${confetti()}
      <div class="lv-badge">${level}</div>
      <p>Tu refugio es más famoso. ¡Más visitantes y nuevos lugares para explorar!</p>
      <div class="loot">
        <div class="loot-item"><span class="li">${R.CHESTS[info.tipo].icono}</span><span>${R.CHESTS[info.tipo].nombre}</span></div>
        <div class="loot-item"><span class="li">⚡</span><span>+1 de energía</span></div>
        ${info.sitios.map((n) => `<div class="loot-item r-rara" style="--rc:${RARITY.rara.color}"><span class="li">🗺️</span><span>Nuevo yacimiento: ${esc(n)}</span></div>`).join('')}
      </div></div>
      <div class="sheet-actions"><button class="btn btn-amber" type="button" data-open>Abrir cofre</button><button class="btn btn-ghost" type="button" data-done>Después</button></div>`);
  app.sfx.level();
  body.querySelector('[data-done]').addEventListener('click', closeSheet);
  body.querySelector('[data-open]').addEventListener('click', () => {
    const c = app.state.recompensas.cofres[app.state.recompensas.cofres.length - 1];
    if (c) openChestSheet(app, c.id);
  });
}

// ------------------------------------------------------------------ vista

export function render(el, params, app) {
  const s = app.state;
  const now = Date.now();
  const st = R.dailyStatus(s, now);
  const missions = R.dailyMissions(s, now);
  const free = R.freeChestStatus(s, now);
  const en = R.energy(s, now);
  const bonus = dayBonus(now);
  const featured = R.featuredSite(s, now);
  const allDone = missions.every((m) => m.reclamada);
  const owned = s.recompensas.accesorios;
  el.innerHTML = `
    <div class="view-head"><div><h1>Recompensas</h1><p class="muted">Vuelve cada día: tus dinosaurios te esperan con sorpresas.</p></div></div>

    <section class="panel daily-panel">
      ${streakHeader(s, st)}
      ${calendarRow(st)}
      <button class="btn ${st.disponible ? 'btn-amber' : 'btn-ghost'} btn-block" type="button" data-daily style="margin-top:12px">${st.disponible ? '🎁 Reclamar regalo de hoy' : `Próximo regalo en <span data-t="midnight">${fmtLong(msToMidnight(now))}</span>`}</button>
    </section>

    <section class="section"><div class="section-head"><h2>Misiones de hoy</h2><span class="small muted">Cambian en <span data-t="midnight">${fmtLong(msToMidnight(now))}</span></span></div>
      <div class="list">${missions.map((m, i) => `<div class="row dm${m.reclamada ? ' done' : ''}" style="cursor:default">
        <span class="mi-ico" aria-hidden="true">${m.icono}</span>
        <span class="grow"><span class="title">${esc(m.texto)}</span>${bar((m.progreso / m.meta) * 100, 'leaf nolow')}<span class="sub">${m.progreso}/${m.meta} · +${m.premio} 🪙</span></span>
        ${m.reclamada ? '<span class="tag">✅</span>' : `<button class="btn btn-sm${m.progreso >= m.meta ? ' btn-amber' : ''}" type="button" data-claim="${i}" ${m.progreso >= m.meta ? '' : 'disabled'}>Reclamar</button>`}
      </div>`).join('')}</div>
      <div class="row bonus-chest" style="cursor:default;margin-top:8px">
        <span class="thumb" style="width:52px;height:46px">${chestSVG('plata')}</span>
        <span class="grow"><span class="title">Cofre de plata del día</span><span class="sub">Completa las tres misiones.</span></span>
        ${s.recompensas.diarias.cofre ? '<span class="tag">✅</span>' : `<button class="btn btn-sm btn-amber" type="button" data-dchest ${allDone ? '' : 'disabled'}>Ganar</button>`}
      </div>
    </section>

    <section class="section"><div class="section-head"><h2>Cofres</h2><span class="small muted">${s.recompensas.cofres.length} por abrir</span></div>
      <div class="chest-grid">
        <div class="chest-card${free.listo ? ' ready' : ''}">
          <span class="chest-mini">${chestSVG('madera')}</span>
          <b>Envío de suministros</b>
          <span class="small muted">Gratis cada 4 horas</span>
          ${free.listo ? '<button class="btn btn-amber btn-sm" type="button" data-free>Recibir</button>' : `<span class="tag" data-t="free">${fmtLong(free.faltaMs)}</span>`}
        </div>
        ${s.recompensas.cofres.map((c) => `<div class="chest-card ready"><span class="chest-mini">${chestSVG(c.tipo)}</span><b>${esc(R.CHESTS[c.tipo].nombre)}</b><span class="small muted">${esc(c.origen || '')}</span><button class="btn btn-sm" type="button" data-open="${c.id}">Abrir</button></div>`).join('')}
      </div>
    </section>

    <section class="section"><h2>Energía de expedición</h2>
      <div class="panel" style="margin-top:10px">
        <div class="energy-row"><span class="bolt">⚡</span><span class="grow"><b>${en.valor}/${en.max}</b> ${bar((en.valor / en.max) * 100, 'amber nolow')}<span class="small muted">${en.valor >= en.max ? 'Llena' : `+1 en <span data-t="energy">${fmtLong(en.proxima)}</span>`} · Cada excavación usa 1.</span></span>
        <button class="btn btn-sm btn-ghost" type="button" data-refill ${en.valor >= en.max ? 'disabled' : ''}>Recargar · ${R.ENERGY_REFILL_PRICE} 🪙</button></div>
      </div>
    </section>

    <section class="section"><h2>Eventos</h2>
      <div class="event-grid" style="margin-top:10px">
        <div class="event-card"><span class="ev-ico">${bonus.icono}</span><b>${esc(bonus.titulo)}</b><span class="small">${esc(bonus.desc)}</span><span class="small muted">Termina en <span data-t="midnight">${fmtLong(msToMidnight(now))}</span></span></div>
        <a class="event-card" href="#/excavar"><span class="ev-ico">🌟</span><b>Yacimiento de la semana</b><span class="small">${esc(featured.nombre)}: ¡ADN doble!</span><span class="small muted">Termina en ${fmtLong(msToWeekEnd(now))}</span></a>
      </div>
    </section>

    <section class="section"><div class="section-head"><h2>Accesorios</h2><span class="small muted">${owned.length}/${ACCESSORY_IDS.length}</span></div>
      <p class="small muted" style="margin-bottom:10px">Salen en los cofres. Pónselos a tus dinosaurios desde su ficha (pestaña Hogar). Dan puntos en el concurso de belleza.</p>
      <div class="acc-grid">${ACCESSORY_IDS.map((id) => {
        const a = ACCESSORIES[id];
        const has = owned.includes(id);
        return `<div class="acc${has ? '' : ' off'}" style="--rc:${RARITY_COLOR[a.rareza]}">${has ? accPreview(id) : '<span class="acc-q">?</span>'}<b>${has ? esc(a.nombre) : '???'}</b><span class="small" style="color:${RARITY_COLOR[a.rareza]}">${RARITY[a.rareza].nombre}</span></div>`;
      }).join('')}</div>
    </section>`;

  el.querySelector('[data-daily]').addEventListener('click', () => dailySheet(app));
  el.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => app.do((st2) => R.claimDailyMission(st2, +b.dataset.claim), { sfx: app.sfx.coin })));
  const dc = el.querySelector('[data-dchest]');
  if (dc) dc.addEventListener('click', () => {
    const r = app.do((st2) => R.claimDailyChest(st2), { toast: false });
    if (r && r.ok) openChestSheet(app, r.cofre.id);
  });
  const fb = el.querySelector('[data-free]');
  if (fb) fb.addEventListener('click', () => {
    const r = app.do((st2) => R.claimFreeChest(st2), { toast: false });
    if (r && r.ok) openChestSheet(app, r.cofre.id);
  });
  el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openChestSheet(app, b.dataset.open)));
  el.querySelector('[data-refill]').addEventListener('click', () => app.do((st2) => R.buyEnergyRefill(st2), { icon: '⚡' }));
}

function accPreview(id) {
  return dinoSVG(SPECIES_BY_ID.psittacosaurus, null, { stage: 'cria', accesorio: id, mood: 'feliz', noShadow: true });
}

export function tick(app) {
  const now = Date.now();
  const s = app.state;
  document.querySelectorAll('[data-t="midnight"]').forEach((e) => { e.textContent = fmtLong(msToMidnight(now)); });
  const fr = R.freeChestStatus(s, now);
  const f = document.querySelector('[data-t="free"]');
  if (f) { if (fr.listo) app.refresh(); else f.textContent = fmtLong(fr.faltaMs); }
  const en = R.energy(s, now);
  const e = document.querySelector('[data-t="energy"]');
  if (e) e.textContent = fmtLong(en.proxima);
}

