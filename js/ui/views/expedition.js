// Expediciones: aventura por etapas con obstáculos, duelos y amansar.
import { SPECIES_BY_ID } from '../../data/species.js';
import { BIOMES, FOODS } from '../../data/world.js';
import * as X from '../../systems/expedition.js';
import { stageOf, effectiveStats } from '../../systems/game.js';
import { dinoArt } from '../../render/art.js';
import { esc, fmt, toast } from '../dom.js';

let zona = null;
let feeding = false;
let fresh = false; // el último resultado acaba de ocurrir: se anima una vez

const STAT_LABEL = { tamano: 'Tamaño', fuerza: 'Fuerza', velocidad: 'Velocidad', vitalidad: 'Vitalidad', intelecto: 'Intelecto' };
const STAGE_ICON = { obstaculo: '⛰️', salvaje: '🦖', tesoro: '💎' };

export function render(el, params, app) {
  const s = app.state;
  if (s.expedicion && !s.dinos.some((d) => d.id === s.expedicion.dino)) s.expedicion = null;
  if (s.expedicion) return runView(el, app);
  return lobby(el, app);
}

function act(el, app, fn) {
  const r = app.do(fn, { render: false, toast: false, sound: false });
  if (!r || !r.ok) { if (r && r.msg) toast(r.msg, 'bad'); app.sfx.no(); return null; }
  fresh = true;
  render(el, [], app);
  if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  return r;
}

function lobby(el, app) {
  const s = app.state;
  const zonas = X.zonesOf(s);
  if (!zona || !BIOMES[zona]) zona = zonas[0];
  const b = BIOMES[zona];
  const vecinos = X.wildSpeciesIn(zona);
  const list = s.dinos.filter((d) => stageOf(d) !== 'cria');
  el.innerHTML = `<a href="#/mas" class="small">← Volver</a>
    <div class="view-head"><div><h1>Expediciones</h1><p class="muted">Sal a explorar con uno de tus dinosaurios y vuelve con monedas, comida y ADN.</p></div></div>
    <div class="chips" role="tablist">${zonas.map((z) => `<button class="chip" role="tab" type="button" aria-selected="${z === zona}" data-z="${z}">${BIOMES[z].icono} ${esc(BIOMES[z].nombre)}</button>`).join('')}</div>
    <div class="xp-scene xp-lobby" style="--sky:${b.cielo[0]};--haze:${b.cielo[1]};--soil:${b.suelo[0]};--soil2:${b.suelo[1]}">
      <div class="xp-herd">${vecinos.slice(0, 4).map((sp) => `<span>${dinoArt(sp, null, { stage: 'adulto', noShadow: true, size: 'sm', silhouette: !(s.genoma[sp.id] > 0) && !s.dinos.some((d) => d.especie === sp.id) })}</span>`).join('')}</div>
      <p class="xp-cap">${esc(b.dato)}</p>
    </div>
    <div class="panel xp-rules"><h2>Cómo funciona</h2>
      <ul>
        <li><b>⛰️ Obstáculos:</b> elige cómo pasarlos. Cada opción usa una habilidad distinta de tu dinosaurio.</li>
        <li><b>🦖 Salvajes:</b> enfréntalos en duelo, amánsalos con su comida o rodéalos sin ser visto.</li>
        <li><b>🎒 Botín:</b> si te retiras a tiempo te llevas todo. Si tu dinosaurio se queda sin aguante, pierdes la mitad.</li>
      </ul>
      <p class="small muted">Cada salida cuesta ${X.EXPEDITION_ENERGY} de energía del dinosaurio.</p></div>
    <section class="section"><h2>¿Quién va?</h2>
      ${list.length ? `<div class="list" style="margin-top:10px">${list.map((d) => {
        const sp = SPECIES_BY_ID[d.especie];
        const chk = X.canExplore(s, d);
        const st = effectiveStats(d);
        return `<div class="row" style="cursor:default"><span class="thumb">${dinoArt(sp, d.genes, { stage: stageOf(d), noShadow: true, detail: 'low', size: 'sm' })}</span>
          <span class="grow"><span class="title">${esc(d.nombre)}</span><span class="sub">${chk.ok ? `💪 ${Math.round(st.fuerza)} · 💨 ${Math.round(st.velocidad)} · 🧠 ${Math.round(st.intelecto)} · ❤️ ${Math.round(st.vitalidad)}` : esc(chk.msg)}</span></span>
          <button class="btn btn-sm" type="button" data-go="${d.id}" ${chk.ok ? '' : 'disabled'}>Explorar</button></div>`;
      }).join('')}</div>` : '<div class="empty"><p>Las crías no salen de expedición. Espera a que crezcan.</p><a class="btn" href="#/parque">Cuidar a mis crías</a></div>'}
    </section>`;
  el.querySelectorAll('[data-z]').forEach((bt) => bt.addEventListener('click', () => { zona = bt.dataset.z; app.sfx.tap(); render(el, [], app); }));
  el.querySelectorAll('[data-go]').forEach((bt) => bt.addEventListener('click', () => {
    feeding = false;
    if (act(el, app, (st) => X.startExpedition(st, bt.dataset.go, zona))) { app.sfx.roar(false); fresh = false; }
  }));
}

function hpBar(v, max, cls = '') {
  const pct = Math.max(0, Math.round((v / max) * 100));
  return `<span class="bar big ${pct < 34 ? 'low' : cls}" style="--v:${pct}%"><i></i></span>`;
}

function lootLine(b) {
  const adn = Object.values(b.adn).reduce((a, n) => a + n, 0);
  const comida = Object.values(b.comida).reduce((a, n) => a + n, 0);
  return `<span>🪙 ${fmt(b.monedas)}</span><span>⭐ ${b.xp} XP</span><span>🧬 ${Math.round(adn * 10) / 10} %</span>${comida ? `<span>🍖 ${comida}</span>` : ''}`;
}

function runView(el, app) {
  const s = app.state;
  const e = s.expedicion;
  const d = s.dinos.find((x) => x.id === e.dino);
  const sp = SPECIES_BY_ID[d.especie];
  const b = BIOMES[e.zona];
  if (e.fin) return endView(el, app, e, d, sp, b);
  const stage = X.stageNow(s);
  const u = e.ultimo;
  const anim = fresh;
  fresh = false;
  const wild = stage.tipo === 'salvaje' ? stage.salvaje : null;
  const wsp = wild ? SPECIES_BY_ID[wild.especie] : null;
  const turno = u && u.tipo === 'turno';
  const mineCls = anim && turno ? (u.resultado === 'pierde' ? 'hit' : u.resultado === 'gana' ? 'lunge' : 'clash') : '';
  const wildCls = anim && turno ? (u.resultado === 'gana' ? 'hit' : u.resultado === 'pierde' ? 'lunge' : 'clash') : '';

  let scene = '';
  let body = '';
  if (stage.tipo === 'obstaculo') {
    const ob = X.OBSTACLES.find((o) => o.id === stage.id);
    const st = effectiveStats(d);
    scene = `<span class="xp-prop" aria-hidden="true">${ob.icono}</span>`;
    body = `<h2>${ob.icono} ${esc(ob.titulo)}</h2><p>${esc(ob.texto)}</p>
      <div class="xp-choices">${ob.opciones.map((op, i) => {
        const p = Math.round(X.chance(st[op.stat], X.difOf(s, op)) * 100);
        return `<button class="xp-choice" type="button" data-op="${i}"><b>${esc(op.texto)}</b><span>${STAT_LABEL[op.stat]} · <i class="${p >= 65 ? 'good' : p >= 40 ? 'mid' : 'bad'}">${p} % de lograrlo</i></span></button>`;
      }).join('')}</div>`;
  } else if (stage.tipo === 'salvaje') {
    const nombre = esc(wsp.corto || wsp.nombre);
    scene = `<div class="xp-foe ${wildCls}"><span class="xp-hp"><b>${wild.jefe ? '👑 ' : ''}${nombre}</b>${hpBar(wild.hp, wild.hpMax, 'amber')}</span>
      <span class="xp-art flip">${dinoArt(wsp, null, { stage: 'adulto', noShadow: true, size: 'md', jaw: e.duelo ? 0.5 : undefined })}</span></div>`;
    if (e.duelo) {
      body = `<h2>⚔️ Duelo contra ${nombre}</h2>
        ${turno ? `<p class="xp-turn ${u.resultado}">Tú: ${X.MOVES[u.move].icono} ${X.MOVES[u.move].nombre} · Rival: ${X.MOVES[u.rival].icono} ${X.MOVES[u.rival].nombre} — ${u.resultado === 'gana' ? `¡Ganas el choque! −${u.doy} al rival.` : u.resultado === 'pierde' ? `Te supera. −${u.recibo} de aguante.` : `Empate: −${u.doy} al rival, −${u.recibo} a ti.`}</p>` : `<p>Elige tu movimiento. Cada uno le gana a otro: 💥 Embestir › 🔊 Rugir › 💨 Esquivar › 💥 Embestir.</p>`}
        <div class="xp-moves">${Object.entries(X.MOVES).map(([k, m]) => `<button class="xp-move" type="button" data-move="${k}"><span aria-hidden="true">${m.icono}</span><b>${m.nombre}</b><i>${m.desc}</i></button>`).join('')}</div>`;
    } else if (feeding) {
      const foods = Object.entries(s.inventario.comida).filter(([id, n]) => n > 0 && FOODS[id]);
      body = `<h2>🍖 Amansar a ${nombre}</h2><p>Es <b>${X.DIETA[wsp.dieta] || wsp.dieta}</b>. Ofrécele algo que le guste: su comida favorita casi nunca falla.</p>
        ${foods.length ? `<div class="xp-foods">${foods.map(([id, n]) => `<button class="chip" type="button" data-food="${id}">${FOODS[id].icono || '🍽️'} ${esc(FOODS[id].nombre)} ×${n}</button>`).join('')}</div>` : '<p class="small muted">No te queda comida. Compra en la tienda antes de salir.</p>'}
        <button class="btn btn-ghost btn-sm" type="button" data-back>← Otra opción</button>`;
    } else {
      body = `<h2>${wild.jefe ? '👑 ¡Un alfa!' : '🦖 Dinosaurio salvaje'}</h2><p>Un ${nombre} ${wild.jefe ? 'enorme ' : ''}te corta el paso. ${esc(wsp.datos[wild.jefe ? 1 : 0])}</p>
        <div class="xp-choices">
          <button class="xp-choice" type="button" data-duel><b>⚔️ Enfrentarlo</b><span>Duelo por turnos. Si ganas: monedas y ADN.</span></button>
          <button class="xp-choice" type="button" data-tame><b>🍖 Amansarlo</b><span>Dale comida de tu inventario. Más ADN y sin pelear.</span></button>
          <button class="xp-choice" type="button" data-sneak><b>🌿 Rodearlo</b><span>Velocidad e intelecto. Sin botín, pero sin golpes.</span></button>
        </div>`;
    }
  } else {
    scene = '<span class="xp-prop" aria-hidden="true">🥚</span>';
    body = `<h2>💎 El final del camino</h2><p>Entre las rocas asoma algo que nadie ha tocado en millones de años.</p>
      <div class="xp-choices"><button class="xp-choice" type="button" data-open><b>⛏️ Excavar el hallazgo</b><span>El premio mayor de la expedición.</span></button></div>`;
  }

  const note = u && u.texto ? `<p class="xp-note ${u.exito === false ? 'bad' : 'good'}${anim ? ' pop' : ''}">${esc(u.texto)}</p>` : '';
  el.innerHTML = `<div class="xp-top"><b>${b.icono} ${esc(b.nombre)}</b>
      <ol class="xp-path" aria-label="Etapa ${e.paso + 1} de ${e.etapas.length}">${e.etapas.map((t, i) => `<li class="${i < e.paso ? 'done' : i === e.paso ? 'now' : ''}">${STAGE_ICON[t.tipo]}</li>`).join('')}</ol></div>
    <div class="xp-scene" style="--sky:${b.cielo[0]};--haze:${b.cielo[1]};--soil:${b.suelo[0]};--soil2:${b.suelo[1]}">
      <div class="xp-me ${mineCls}"><span class="xp-hp"><b>${esc(d.nombre)}</b>${hpBar(e.aguante, e.aguanteMax)}<small>Aguante ${e.aguante}/${e.aguanteMax}</small></span>
        <span class="xp-art">${dinoArt(sp, d.genes, { stage: stageOf(d), accesorio: d.accesorio, noShadow: true, size: 'md', jaw: e.duelo ? 0.5 : undefined })}</span></div>
      ${scene}
    </div>
    ${note}
    <div class="panel xp-body">${body}</div>
    <div class="xp-foot"><span class="xp-loot" aria-label="Botín acumulado">🎒 ${lootLine(e.botin)}</span>
      <button class="btn btn-ghost btn-sm" type="button" data-retreat>🏃 Retirarse con el botín</button></div>`;

  const on = (sel, fn) => el.querySelectorAll(sel).forEach((bt) => bt.addEventListener('click', () => fn(bt)));
  on('[data-op]', (bt) => { const r = act(el, app, (st) => X.chooseOption(st, Number(bt.dataset.op))); if (r) (r.exito ? app.sfx.coin : app.sfx.no)(); });
  on('[data-duel]', () => { if (act(el, app, (st) => X.startDuel(st))) { app.sfx.roar(false); fresh = false; } });
  on('[data-tame]', () => { feeding = true; app.sfx.tap(); render(el, [], app); });
  on('[data-back]', () => { feeding = false; app.sfx.tap(); render(el, [], app); });
  on('[data-food]', (bt) => { const r = act(el, app, (st) => X.tame(st, bt.dataset.food)); if (r) { if (r.exito) feeding = false; (r.exito ? app.sfx.level : app.sfx.no)(); if (r.exito) render(el, [], app); } });
  on('[data-sneak]', () => { const r = act(el, app, (st) => X.sneak(st)); if (r) (r.exito ? app.sfx.ok : app.sfx.roar)(false); });
  on('[data-move]', (bt) => { const r = act(el, app, (st) => X.duelTurn(st, bt.dataset.move)); if (r) (r.fin === 'victoria' ? app.sfx.level : r.resultado === 'gana' ? app.sfx.ok : r.resultado === 'pierde' ? app.sfx.no : app.sfx.tap)(); });
  on('[data-open]', () => { if (act(el, app, (st) => X.openTreasure(st))) app.sfx.level(); });
  on('[data-retreat]', () => { feeding = false; act(el, app, (st) => X.retreat(st)); });
}

function endView(el, app, e, d, sp, b) {
  const f = e.fin;
  const head = f.motivo === 'completa' ? ['🏆', '¡Expedición completa!', `${d.nombre} llegó hasta el final y vuelve con todo el botín.`]
    : f.motivo === 'retirada' ? ['🎒', 'De vuelta a casa', `${d.nombre} regresa a salvo con lo que consiguió.`]
      : ['😮‍💨', 'Se acabó el aguante', `${d.nombre} vuelve agotado y pierde la mitad del botín. Déjalo descansar.`];
  const adn = Object.entries(f.adn).filter(([, n]) => n > 0);
  const comida = Object.entries(f.comida);
  el.innerHTML = `<div class="xp-scene xp-end" style="--sky:${b.cielo[0]};--haze:${b.cielo[1]};--soil:${b.suelo[0]};--soil2:${b.suelo[1]}">
      <span class="xp-art">${dinoArt(sp, d.genes, { stage: stageOf(d), accesorio: d.accesorio, noShadow: true, size: 'md', jaw: f.motivo === 'completa' ? 0.5 : undefined })}</span></div>
    <div class="panel xp-body"><h2>${head[0]} ${head[1]}</h2><p>${esc(head[2])}</p>
      <ul class="xp-sum">
        <li><span>🪙 Monedas</span><b>+${fmt(f.monedas)}</b></li>
        <li><span>⭐ Experiencia</span><b>+${f.xp}</b></li>
        ${adn.map(([id, n]) => `<li><span>🧬 ADN de ${esc(SPECIES_BY_ID[id].corto || SPECIES_BY_ID[id].nombre)}</span><b>+${n} %</b></li>`).join('')}
        ${comida.map(([id, n]) => `<li><span>${FOODS[id].icono || '🍽️'} ${esc(FOODS[id].nombre)}</span><b>+${n}</b></li>`).join('')}
      </ul>
      <div class="xp-actions"><button class="btn" type="button" data-again>Otra expedición</button><a class="btn btn-ghost" href="#/parque" data-home>Volver al refugio</a></div></div>`;
  if (fresh) { fresh = false; (f.motivo === 'agotado' ? app.sfx.no : app.sfx.level)(); }
  const close = () => app.do((st) => X.closeExpedition(st), { render: false, toast: false, sound: false });
  el.querySelector('[data-again]').addEventListener('click', () => { close(); render(el, [], app); });
  el.querySelector('[data-home]').addEventListener('click', close);
}
