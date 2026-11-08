// Criadero: incubadora, genoma (síntesis de huevos) y cruces.
import { SPECIES_BY_ID, SPECIES, RARITY } from '../../data/species.js';
import * as G from '../../systems/game.js';
import {
  patternPunnett, variantPunnett, PATTERN_NAMES, VARIANTS, STAT_KEYS, STAT_NAMES,
} from '../../systems/genetics.js';
import { eggSVG, dinoSVG } from '../../render/dino-svg.js';
import { esc, bar, setBar, fmtTime, openSheet, closeSheet } from '../dom.js';

let pickA = '';
let pickB = '';

export function render(el, params, app) {
  const s = app.state;
  const slots = G.incubatorSlots(s);
  const known = SPECIES.filter((sp) => (s.genoma[sp.id] || 0) > 0)
    .sort((a, b) => (s.genoma[b.id] || 0) - (s.genoma[a.id] || 0));
  const adults = s.dinos.filter((d) => G.stageOf(d) === 'adulto');

  el.innerHTML = `
    <div class="view-head"><div><h1>Criadero</h1><p class="muted">Incuba huevos, sintetiza ADN y cruza a tus adultos.</p></div></div>

    <section class="section" aria-labelledby="h-inc">
      <div class="section-head"><h2 id="h-inc">Incubadora</h2><span class="small muted">${Math.min(slots, s.huevos.length)}/${slots} ranuras</span></div>
      <div class="incubator">
        ${s.huevos.map((e, i) => eggSlot(s, e, i < slots)).join('')}
        ${Array.from({ length: Math.max(0, slots - s.huevos.length) }).map(() => '<div class="slot empty-slot"><span class="small">Ranura libre</span></div>').join('')}
      </div>
      ${s.huevos.length > slots ? '<p class="small muted" style="margin-top:8px">Los huevos de más esperan en el nido hasta que se libere una ranura. Puedes comprar más ranuras en la tienda.</p>' : ''}
    </section>

    <section class="section" aria-labelledby="h-gen">
      <div class="section-head"><h2 id="h-gen">Genoma</h2><a class="small" href="#/excavar">Conseguir más ADN</a></div>
      <p class="small muted" style="margin-bottom:10px">Con 50 % del genoma puedes sintetizar un huevo. Más genoma = huevos más fuertes y mejores estadísticas.</p>
      ${known.length ? `<div class="list">${known.map((sp) => genomeRow(s, sp)).join('')}</div>`
        : '<div class="empty"><p>Todavía no tienes ADN.</p><a class="btn" href="#/excavar">Ir a excavar</a></div>'}
    </section>

    <section class="section" aria-labelledby="h-cruce">
      <h2 id="h-cruce">Cruzar</h2>
      <p class="small muted" style="margin:4px 0 10px">Elige un macho y una hembra adultos de la misma especie, con ánimo de 60 o más.</p>
      ${adults.length >= 2 ? breedingPanel(s, adults) : '<div class="empty"><p>Necesitas al menos dos adultos de la misma especie.</p><p class="small">Cuida a tus crías hasta que crezcan, o incuba otro huevo de la misma especie.</p></div>'}
    </section>`;

  el.querySelectorAll('[data-turn]').forEach((b) => b.addEventListener('click', () => app.do((st) => G.turnEgg(st, b.dataset.turn), { sfx: app.sfx.tap })));
  el.querySelectorAll('[data-hatch]').forEach((b) => b.addEventListener('click', () => hatchMoment(app, b.dataset.hatch)));
  el.querySelectorAll('[data-synth]').forEach((b) => b.addEventListener('click', () => app.do((st) => G.synthesizeEgg(st, b.dataset.synth), { icon: '🧬' })));
  const sa = el.querySelector('#pick-a');
  const sb = el.querySelector('#pick-b');
  if (sa) {
    sa.addEventListener('change', () => { pickA = sa.value; app.refresh(); });
    sb.addEventListener('change', () => { pickB = sb.value; app.refresh(); });
    const go = el.querySelector('[data-breed]');
    if (go) go.addEventListener('click', () => app.do((st) => G.breedPair(st, pickA, pickB), { icon: '🪺' }));
  }
}

function eggSlot(s, e, active) {
  const sp = SPECIES_BY_ID[e.especie];
  const ready = e.progreso >= e.duracion;
  const p = (e.progreso / e.duracion) * 100;
  return `<div class="slot${ready ? ' ready' : ''}${active ? '' : ' waiting'}" data-egg="${e.id}">
    ${eggSVG(sp, e.genes, { wobble: ready || !!e.girar, crack: ready ? 0.8 : p / 140 })}
    <div class="name">${esc(sp.corto || sp.nombre)}</div>
    <div class="sub" data-eggtime>${!active ? 'En el nido, esperando' : ready ? '¡Listo para eclosionar!' : `Faltan ${fmtTime((e.duracion - e.progreso) / (1 + 0.25 * s.mejoras.rapida))}`}</div>
    ${bar(p, 'amber nolow')}
    <div class="sub">Viabilidad ${Math.round(e.viabilidad * 100)}%${e.origen === 'cria' ? ' · 🪺 de cruce' : ''}</div>
    ${ready ? `<button class="btn btn-leaf" type="button" data-hatch="${e.id}" style="margin-top:8px">Eclosionar</button>`
      : e.girar ? `<button class="btn btn-amber" type="button" data-turn="${e.id}" style="margin-top:8px">¡Girar huevo!</button>` : ''}
  </div>`;
}

function genomeRow(s, sp) {
  const g = s.genoma[sp.id] || 0;
  const price = G.eggPrice(sp.id);
  const can = g >= 50;
  const r = RARITY[sp.rareza];
  return `<div class="row genome-row" style="cursor:default">
    <span class="thumb">${dinoSVG(sp, null, { silhouette: !can, noShadow: true, detail: 'low' })}</span>
    <span class="grow">
      <span class="title">${esc(sp.nombre)}</span>
      <span class="sub"><span style="color:${r.color};font-weight:700">${r.nombre}</span> · ${g.toFixed(g % 1 ? 1 : 0)} % del genoma</span>
      ${bar(g, `${g >= 50 ? 'leaf' : 'amber'} nolow`)}
    </span>
    <button class="btn btn-sm" type="button" data-synth="${sp.id}" ${can && s.monedas >= price ? '' : 'disabled'} aria-label="Sintetizar huevo de ${esc(sp.nombre)} por ${price} monedas">🥚 ${price}</button>
  </div>`;
}

function breedingPanel(s, adults) {
  const opt = (d, sel) => {
    const sp = SPECIES_BY_ID[d.especie];
    return `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.nombre)} ${d.genes.sexo === 'M' ? '♂' : '♀'} · ${esc(sp.corto || sp.nombre)}</option>`;
  };
  if (!adults.some((d) => d.id === pickA)) pickA = adults[0].id;
  const a = adults.find((d) => d.id === pickA);
  const mates = adults.filter((d) => d.id !== pickA);
  if (!mates.some((d) => d.id === pickB)) {
    const ideal = mates.find((d) => d.especie === a.especie && d.genes.sexo !== a.genes.sexo);
    pickB = (ideal || mates[0]).id;
  }
  const b = adults.find((d) => d.id === pickB);
  const check = G.canBreed(s, a, b);
  let preview = '';
  if (a.especie === b.especie && a.genes.sexo !== b.genes.sexo) {
    const pp = patternPunnett(a.genes, b.genes);
    const vp = variantPunnett(a.genes, b.genes);
    preview = `<div class="panel" style="margin-top:12px">
      <h3>Lo que puede salir</h3>
      <div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:10px">
        <div>${punnettTable('Patrón', a, b, pp, (x) => PATTERN_NAMES[x])}</div>
        <div>${punnettTable('Variante', a, b, vp, (x) => VARIANTS[x])}</div>
      </div>
      <p class="small muted" style="margin-top:10px">Cada casilla tiene 25 % de probabilidad. Las estadísticas de la cría vienen de un progenitor u otro (55 % del mejor) y hay una pequeña probabilidad de mutación.</p>
      <div style="margin-top:8px">${STAT_KEYS.map((k) => `<div class="stat-row"><span>${STAT_NAMES[k]}</span>${bar(Math.min(100, Math.max(a.genes.stats[k], b.genes.stats[k])), 'nolow')}<b>${Math.min(a.genes.stats[k], b.genes.stats[k]) === Math.max(a.genes.stats[k], b.genes.stats[k]) ? a.genes.stats[k] : `${Math.min(a.genes.stats[k], b.genes.stats[k])}–${Math.max(a.genes.stats[k], b.genes.stats[k])}`}</b></div>`).join('')}</div>
    </div>`;
  }
  return `<div class="panel">
    <div class="breed-pick">
      <div><label class="field-label" for="pick-a">Progenitor 1</label><select id="pick-a">${adults.map((d) => opt(d, pickA)).join('')}</select></div>
      <div><label class="field-label" for="pick-b">Progenitor 2</label><select id="pick-b">${mates.map((d) => opt(d, pickB)).join('')}</select></div>
    </div>
    <p class="small ${check.ok ? '' : 'muted'}" style="margin-top:10px">${check.ok ? '✅ Pareja lista para cruzar.' : `⚠️ ${esc(check.msg)}`}</p>
    <button class="btn btn-block" type="button" data-breed ${check.ok ? '' : 'disabled'} style="margin-top:10px">Cruzar</button>
  </div>${preview}`;
}

function punnettTable(label, a, b, pn, name) {
  const key = label === 'Patrón' ? 'patron' : 'variante';
  return `<table class="punnett"><caption class="small" style="text-align:left;font-weight:700;margin-bottom:4px">${label}</caption>
    <tr><th></th>${b.genes[key].map((x) => `<th>${esc(b.nombre)}<br>${x}</th>`).join('')}</tr>
    ${pn.grid.map((row, i) => `<tr><th>${esc(a.nombre)}<br>${a.genes[key][i]}</th>${row.map((c) => `<td class="${c.ph !== 'N' && c.ph !== 'liso' ? 'hl' : ''}">${esc(name(c.ph))}</td>`).join('')}</tr>`).join('')}
  </table>
  <div class="probs">${Object.entries(pn.probs).map(([k, v]) => `<span class="tag">${esc(name(k))} ${Math.round(v * 100)}%</span>`).join('')}</div>`;
}

function hatchMoment(app, eggId) {
  const s = app.state;
  const e = s.huevos.find((x) => x.id === eggId);
  if (!e) return;
  const sp = SPECIES_BY_ID[e.especie];
  const body = openSheet('¡Está naciendo!', `<div class="hatch-stage" id="hatch">${eggSVG(sp, e.genes, { wobble: true, crack: 1 })}</div>`, { onClose: () => app.refresh() });
  app.sfx.hatch();
  setTimeout(() => {
    const r = app.do((st) => G.hatch(st, eggId), { render: false, toast: false });
    const stage = body.querySelector('#hatch');
    if (!r || !r.ok) { closeSheet(); return; }
    if (r.fallido) {
      stage.innerHTML = `<p style="text-align:center">${esc(r.msg)}</p>`;
      body.insertAdjacentHTML('beforeend', '<button class="btn btn-block" type="button" data-close style="margin-top:12px">Entendido</button>');
      body.querySelector('[data-close]').addEventListener('click', closeSheet);
      return;
    }
    const d = r.dino;
    const colors = ['#efa531', '#b9d46a', '#5ea8c0', '#c8473d', '#2e6a4e'];
    stage.innerHTML = `<div class="confetti">${Array.from({ length: 26 }).map((_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % 5]};animation-delay:${Math.random() * 0.4}s"></i>`).join('')}</div>
      <div class="reveal">${dinoSVG(sp, d.genes, { stage: 'cria', anim: true, mood: 'feliz' })}</div>`;
    app.sfx.chirp();
    body.insertAdjacentHTML('beforeend', `<p style="text-align:center">${esc(r.msg)}</p>
      <label class="field-label" for="hatch-name">Ponle nombre</label>
      <div class="name-field"><input id="hatch-name" maxlength="18" value="${esc(d.nombre)}" autocomplete="off"><button class="btn" type="button" data-save>Listo</button></div>
      <p class="small muted" style="margin-top:10px">Sabías que… los huevos de muchos dinosaurios tardaban meses en eclosionar, según las líneas de crecimiento de dientes embrionarios.</p>`);
    const done = () => {
      app.do((st) => G.rename(st, d.id, body.querySelector('#hatch-name').value), { toast: false, render: false, sound: false });
      closeSheet();
      app.go(`parque/${r.recinto.id}`);
    };
    body.querySelector('[data-save]').addEventListener('click', done);
    body.querySelector('#hatch-name').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') done(); });
  }, 1100);
}

export function tick(app, events) {
  const s = app.state;
  if (events.some((ev) => ev.tipo === 'huevoListo')) { app.refresh(); return; }
  let needs = false;
  document.querySelectorAll('[data-egg]').forEach((slot) => {
    const e = s.huevos.find((x) => x.id === slot.dataset.egg);
    if (!e) { needs = true; return; }
    const hasTurn = !!slot.querySelector('[data-turn]');
    if (hasTurn !== !!e.girar) needs = true;
    setBar(slot.querySelector('.bar'), (e.progreso / e.duracion) * 100);
    const t = slot.querySelector('[data-eggtime]');
    if (t && e.incubando && e.progreso < e.duracion) t.textContent = `Faltan ${fmtTime((e.duracion - e.progreso) / (1 + 0.25 * s.mejoras.rapida))}`;
  });
  if (needs) app.refresh();
}
