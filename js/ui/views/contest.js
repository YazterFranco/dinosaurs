// Concursos: elegir prueba y participante, ver la carrera o la votación.
import { SPECIES_BY_ID } from '../../data/species.js';
import { CONTESTS, canEnter, contestScore, runContest } from '../../systems/contest.js';
import { stageOf } from '../../systems/game.js';
import { dinoSVG } from '../../render/dino-svg.js';
import { esc, toast } from '../dom.js';

let tipo = 'carrera';
let result = null;

export function render(el, params, app) {
  const s = app.state;
  const c = CONTESTS[tipo];
  const list = s.dinos.filter((d) => stageOf(d) !== 'cria');
  el.innerHTML = `<a href="#/mas" class="small">← Volver</a>
    <div class="view-head"><div><h1>Concursos</h1><p class="muted">Cría ejemplares más fuertes, rápidos y raros para ganar trofeos.</p></div></div>
    <div class="chips" role="tablist">${Object.entries(CONTESTS).map(([k, v]) => `<button class="chip" role="tab" type="button" aria-selected="${k === tipo}" data-t="${k}">${v.icono} ${v.nombre}</button>`).join('')}</div>
    <div class="panel"><h2>${c.icono} ${c.nombre}</h2><p style="margin-top:4px">${esc(c.desc)} Cuesta ${c.energia} de energía.</p><p class="small muted" style="margin-top:6px">${esc(c.dato)}</p></div>
    <div id="result">${result && result.tipo === tipo ? resultHtml(result) : ''}</div>
    <section class="section"><h2>Elige participante</h2>
      ${list.length ? `<div class="list" style="margin-top:10px">${list.map((d) => {
        const sp = SPECIES_BY_ID[d.especie];
        const chk = canEnter(s, d, tipo);
        return `<div class="row" style="cursor:default"><span class="thumb">${dinoSVG(sp, d.genes, { stage: stageOf(d), noShadow: true })}</span>
          <span class="grow"><span class="title">${esc(d.nombre)}</span><span class="sub">${esc(sp.corto || sp.nombre)} · puntuación base ${Math.round(contestScore(s, d, tipo))}${chk.ok ? '' : ` · ${esc(chk.msg)}`}</span></span>
          <button class="btn btn-sm" type="button" data-enter="${d.id}" ${chk.ok ? '' : 'disabled'}>Inscribir</button></div>`;
      }).join('')}</div>` : '<div class="empty"><p>Solo pueden competir juveniles y adultos.</p><a class="btn" href="#/parque">Cuidar a mis crías</a></div>'}
    </section>`;
  el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { tipo = b.dataset.t; app.sfx.tap(); render(el, [], app); }));
  el.querySelectorAll('[data-enter]').forEach((b) => b.addEventListener('click', () => {
    const r = app.do((st) => runContest(st, b.dataset.enter, tipo), { render: false, toast: false, sound: false });
    if (!r || !r.ok) { if (r) toast(r.msg, 'bad'); return; }
    result = { ...r, tipo, animar: true };
    render(el, [], app);
    el.querySelector('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (tipo === 'carrera') app.sfx.roar(false);
    setTimeout(() => {
      (r.puesto === 1 ? app.sfx.level : r.puesto <= 3 ? app.sfx.coin : app.sfx.no)();
      toast(r.puesto === 1 ? `¡${r.tabla[0].nombre} ganó! +${r.premio} monedas.` : `${r.msg}${r.premio ? ` +${r.premio} monedas.` : ''}`, r.puesto === 1 ? 'gold' : '', r.puesto === 1 ? '🏆' : '🎽');
    }, tipo === 'carrera' ? 2700 : 600);
  }));
  if (result && result.animar) {
    result.animar = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.querySelectorAll('.runner').forEach((r) => { r.style.left = r.dataset.to; });
    }));
  }
}

function resultHtml(r) {
  const order = [...r.tabla];
  const max = Math.max(...order.map((x) => x.puntos));
  let race = '';
  if (r.tipo === 'carrera') {
    const lanes = [...order].sort((a, b) => (a.tuyo ? -1 : b.tuyo ? 1 : 0));
    race = `<div class="race" aria-hidden="true">${lanes.map((x) => {
      const sp = SPECIES_BY_ID[x.especie];
      const to = `calc(${(x.puntos / max) * 100}% - ${(x.puntos / max) * 64}px)`;
      return `<div class="lane${x.tuyo ? ' mine' : ''}"><span class="runner" style="left:${r.animar ? '0' : to}" data-to="${to}">${dinoSVG(sp, null, { stage: 'adulto', anim: true, noShadow: true })}</span><span class="who">${esc(x.nombre)}</span></div>`;
    }).join('')}</div>`;
  }
  return `<section class="section"><h2>Resultado</h2>${race}
    <div class="podium">${order.map((x, i) => {
      const sp = SPECIES_BY_ID[x.especie];
      return `<div class="${x.tuyo ? 'mine' : ''}"><span class="pos">${i + 1}</span><span class="grow"><b>${esc(x.nombre)}</b> <span class="small muted">${esc(sp.corto || sp.nombre)}</span></span><span class="small">${Math.round(x.puntos)} pts</span></div>`;
    }).join('')}</div></section>`;
}
