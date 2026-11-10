// Hoja de un dinosaurio: cuidado, genes e información.
import { SPECIES_BY_ID, DIETS, SIZE_CLASS } from '../../data/species.js';
import { FOODS, BIOMES, ENCLOSURE_CAPACITY } from '../../data/world.js';
import * as G from '../../systems/game.js';
import {
  STAT_KEYS, STAT_NAMES, PATTERN_NAMES, VARIANTS, VARIANT_INFO, dominantPattern, variantOf, isCarrier, phenotype,
} from '../../systems/genetics.js';
import { dinoArt } from '../../render/art.js';
import { dayPhase } from '../../systems/calendar.js';
import { ACCESSORIES } from '../../data/cosmetics.js';
import { equipAccessory } from '../../systems/rewards.js';
import { openPostcard } from '../postcard.js';
import {
  esc, bar, setBar, openSheet, closeSheet, sheetBody, setSheetTick, fmtTime, confirmSheet, heartBurst, toast,
} from '../dom.js';

/** Colores del escenario del visor: el bioma del recinto donde vive. */
function stageBg(s, d, sp) {
  const rec = s.recintos.find((r) => r.id === d.recinto);
  const b = BIOMES[(rec && rec.bioma) || sp.bioma] || BIOMES[sp.bioma];
  return [b.cielo[0], b.cielo[1], b.suelo[0]];
}

const REQ = { comida: ['🍽️', 'Tiene hambre de algo rico'], caricia: ['🤚', 'Quiere caricias'], juego: ['⚽', 'Quiere jugar'] };
let tab = 'cuidado';
let picking = false;

export function openDinoSheet(app, id) {
  tab = 'cuidado';
  picking = false;
  draw(app, id, true);
}

function draw(app, id, first = false) {
  const s = app.state;
  const d = s.dinos.find((x) => x.id === id);
  if (!d) { closeSheet(); return; }
  const sp = SPECIES_BY_ID[d.especie];
  const stage = G.stageOf(d);
  const asleep = d.duermeHasta > s.tiempoJuego;
  const title = `${esc(d.nombre)} <span class="muted small">${d.genes.sexo === 'M' ? '♂ macho' : '♀ hembra'}</span>`;
  const html = `
    <div class="portrait" id="dino-portrait">
      ${dinoArt(sp, d.genes, { stage, anim: !asleep, sleeping: asleep, mood: G.moodOf(d, s.tiempoJuego), accesorio: d.accesorio, viewer: true, viewerKey: `ficha-${d.id}`, title: `${d.nombre}, ${sp.nombre}`, phase: dayPhase().id, backdrop: stageBg(s, d, sp) })}
      ${d.peticion ? `<span class="bubble">${REQ[d.peticion.tipo][0]} ${REQ[d.peticion.tipo][1]}</span>` : ''}
    </div>
    <div class="portrait-meta"><p class="small muted">${esc(sp.nombre)} · ${stageLabel(stage)} · <a href="#/dinopedia/${sp.id}">Ver en la Dinopedia</a></p>
      <button class="btn btn-ghost btn-sm" type="button" data-photo>📸 Postal</button></div>
    <div class="chips dino-tabs" role="tablist">
      ${[['cuidado', 'Cuidado'], ['genes', 'Genes'], ['info', 'Hogar']].map(([k, l]) => `<button class="chip" role="tab" type="button" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join('')}
    </div>
    <div id="dino-tab">${tab === 'cuidado' ? careTab(s, d, sp, stage, asleep) : tab === 'genes' ? genesTab(d, sp, app) : homeTab(s, d, sp)}</div>`;
  const body = first ? openSheet(title, html, { onClose: () => app.refresh() }) : sheetBody();
  if (!first) {
    body.innerHTML = html;
    document.getElementById('sheet-title').innerHTML = title;
  }
  setSheetTick(() => live(app, id));
  wire(app, id, body);
}

function stageLabel(st) {
  return st === 'cria' ? 'Cría' : st === 'juvenil' ? 'Juvenil' : 'Adulto';
}

function careTab(s, d, sp, stage, asleep) {
  if (d.enClinica) {
    return `<div class="empty"><p><b>${esc(d.nombre)} está en la clínica.</b></p><p class="small">Pasó demasiada hambre o tristeza. El equipo veterinario puede curarlo.</p>
      <button class="btn" type="button" data-act="cure" style="margin-top:12px">Pagar tratamiento · ${G.TREATMENT_PRICE} 🪙</button></div>`;
  }
  const g = G.growthProgress(d);
  const want = d.peticion ? d.peticion.tipo : null;
  const foods = Object.entries(FOODS);
  return `
    <div class="needs-grid" id="needs">
      ${need('Hambre', '🍖', d.hambre, '', 'hambre')}
      ${need('Ánimo', '😊', d.animo, 'leaf', 'animo')}
      ${need('Energía', '⚡', d.energia, 'amber', 'energia')}
      ${need('Salud', '❤️', d.salud, 'water', 'salud')}
    </div>
    ${stage !== 'adulto' ? `<div class="need" style="margin-top:12px"><label><span>🌱 Crecimiento: ${stageLabel(stage)}</span><span data-live="crece">${fmtTime(g.faltaSeg)}</span></label>${bar(g.pct * 100, 'leaf nolow')}</div>
      <div class="need" style="margin-top:10px"><label><span>💞 Vínculo</span><span data-live="vinc">${Math.round(d.vinculo)}%</span></label>${bar(d.vinculo, 'amber nolow')}</div>
      <p class="small muted" style="margin-top:6px">Atiende lo que pide la cría (la burbuja) para que crezca el vínculo: da hasta +20 % a sus estadísticas para siempre.</p>` : ''}
    <div class="actions">
      <button class="action${want === 'comida' ? ' wanted' : ''}" type="button" data-act="feed"><span class="ai">🍽️</span>Alimentar</button>
      <button class="action${want === 'caricia' ? ' wanted' : ''}" type="button" data-act="pet" ${asleep ? 'disabled' : ''}><span class="ai">🤚</span>Acariciar</button>
      <button class="action${want === 'juego' ? ' wanted' : ''}" type="button" data-act="play" ${asleep ? 'disabled' : ''}><span class="ai">⚽</span>Jugar</button>
      ${asleep ? '<button class="action" type="button" data-act="wake"><span class="ai">🌅</span>Despertar</button>'
        : '<button class="action" type="button" data-act="rest"><span class="ai">💤</span>Dormir</button>'}
    </div>
    ${picking ? `<div class="food-grid" id="foods">
      ${foods.map(([id, f]) => {
        const ok = G.canEat(sp, id);
        const fav = sp.favoritos.includes(id);
        const q = s.inventario.comida[id] || 0;
        return `<button class="food${fav ? ' fav' : ''}${ok ? '' : ' nope'}" type="button" data-food="${id}" ${q ? '' : 'disabled'}><span class="fi">${f.icono}</span>${esc(f.nombre)}<span class="q">${q} en bodega${fav ? ' · ⭐' : ''}</span></button>`;
      }).join('')}
    </div><p class="small muted" style="margin-top:8px">${DIETS[sp.dieta].icono} ${esc(sp.corto || sp.nombre)} es ${DIETS[sp.dieta].nombre.toLowerCase()}. ¿Qué crees que puede comer?</p>` : ''}
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" type="button" data-act="med" ${d.salud >= 95 ? 'disabled' : ''}>💊 Medicina (${s.inventario.medicina})</button>
      <a class="btn btn-ghost btn-sm" href="#/tienda/comida">Comprar comida</a>
    </div>`;
}

function need(label, icon, v, cls, key) {
  return `<div class="need"><label><span>${icon} ${label}</span><span data-num="${key}">${Math.round(v)}</span></label><div data-bar="${key}">${bar(v, cls)}</div></div>`;
}

function family(s, d) {
  const name = (id) => { const x = s.dinos.find((y) => y.id === id); return x ? esc(x.nombre) : 'en un santuario'; };
  const parents = d.padres ? `Hijo de ${name(d.padres[0])} y ${name(d.padres[1])}` : 'Nació de ADN fósil';
  const kids = s.dinos.filter((x) => x.padres && x.padres.includes(d.id)).length;
  return `${parents}${kids ? ` · ${kids} cría${kids > 1 ? 's' : ''}` : ''}`;
}

function genesTab(d, sp, app) {
  const stats = G.effectiveStats(d);
  const ph = phenotype(d.genes);
  const v = variantOf(d.genes.variante);
  return `
    <div>${STAT_KEYS.map((k) => {
      const tr = (d.entreno && d.entreno[k]) || 0;
      const can = G.stageOf(d) !== 'cria' && tr < G.TRAIN_MAX;
      return `<div class="stat-row train-row"><span>${STAT_NAMES[k]}</span>${bar(Math.min(100, stats[k]), 'nolow')}<b>${stats[k]}</b>
        <button class="btn btn-ghost btn-sm" type="button" data-train="${k}" ${can ? '' : 'disabled'} aria-label="Entrenar ${STAT_NAMES[k]} por ${G.trainPrice(d, k)} monedas">+${G.TRAIN_STEP} · ${G.trainPrice(d, k)}🪙</button></div>`;
    }).join('')}</div>
    <p class="small muted" style="margin-top:6px">Valores actuales (según etapa, vínculo y entrenamiento). Genéticos: ${STAT_KEYS.map((k) => `${STAT_NAMES[k].slice(0, 3)} ${d.genes.stats[k]}`).join(' · ')}. Entrenar usa ${G.TRAIN_ENERGY} de energía y <b>no se hereda</b>: solo los genes pasan a las crías.</p>
    <dl class="kv" style="margin-top:14px">
      <dt>Colores</dt><dd><span class="swatches"><i style="background:${ph.piel}"></i><i style="background:${ph.acento}"></i><i style="background:${ph.vientre}"></i></span></dd>
      <dt>Patrón</dt><dd>${PATTERN_NAMES[dominantPattern(d.genes.patron)]} <span class="genotype">${d.genes.patron.join(' / ')}</span></dd>
      <dt>Variante</dt><dd>${VARIANTS[v]} <span class="genotype">${d.genes.variante.join(' / ')}</span>${isCarrier(d.genes.variante) ? ' <span class="tag tag-amber">Portador</span>' : ''}</dd>
      <dt>Generación</dt><dd>${d.genes.generacion || 1}</dd>
      <dt>Familia</dt><dd>${family(app.state, d)}</dd>
      <dt>Mutaciones</dt><dd>${d.genes.mutaciones || 0}</dd>
    </dl>
    ${v !== 'N' ? `<p class="small" style="margin-top:10px">🌟 ${esc(VARIANT_INFO[v])}</p>` : ''}
    ${isCarrier(d.genes.variante) ? '<p class="small muted" style="margin-top:10px">Lleva un alelo recesivo escondido. Si lo cruzas con otro portador, ¡1 de cada 4 crías podría mostrarlo!</p>' : ''}
    <p class="small muted" style="margin-top:10px">Cada rasgo tiene dos alelos: uno de la madre y otro del padre. El dominante es el que se ve.</p>`;
}

function homeTab(s, d, sp) {
  const c = G.comfortOf(s, d);
  const rec = s.recintos.find((r) => r.id === d.recinto);
  return `
    <div class="need"><label><span>Comodidad en ${esc(rec ? rec.nombre : '')}</span><span>${c.valor}%</span></label>${bar(c.valor, 'leaf')}</div>
    <ul class="reasons">${c.motivos.map((m) => `<li><span>${esc(m.t)}</span><span class="${m.v >= 0 ? 'pos' : 'neg'}">${m.v >= 0 ? '+' : ''}${m.v}</span></li>`).join('')}</ul>
    <dl class="kv" style="margin-top:14px">
      <dt>Hábitat ideal</dt><dd>${BIOMES[sp.bioma].icono} ${esc(BIOMES[sp.bioma].nombre)}</dd>
      <dt>Vida social</dt><dd>${esc(sp.social.tipo)} (${sp.social.min}–${sp.social.max})</dd>
      <dt>Favoritos</dt><dd>${sp.favoritos.map((f) => `${FOODS[f].icono} ${esc(FOODS[f].nombre)}`).join(', ')}</dd>
      <dt>Crece en</dt><dd>${SIZE_CLASS[sp.tamano].creceMin * 2.5} min de juego</dd>
      <dt>Trofeos</dt><dd>${d.trofeos.length ? d.trofeos.map(() => '🏆').join('') : 'Ninguno aún'}</dd>
    </dl>
    <span class="field-label">Accesorio <span class="muted small">(suma puntos en el concurso de belleza)</span></span>
    ${s.recompensas.accesorios.length ? `<div class="acc-pick">
      <button class="chip" type="button" data-acc="" aria-pressed="${!d.accesorio}">Ninguno</button>
      ${s.recompensas.accesorios.map((id) => `<button class="chip" type="button" data-acc="${id}" aria-pressed="${d.accesorio === id}">${ACCESSORIES[id].icono} ${esc(ACCESSORIES[id].nombre)}</button>`).join('')}
    </div>` : '<p class="small muted">Aún no tienes accesorios. Salen en los cofres: <a href="#/recompensas">ver recompensas</a>.</p>'}
    <label class="field-label" for="dn-name">Nombre</label>
    <div class="name-field"><input id="dn-name" maxlength="18" value="${esc(d.nombre)}" autocomplete="off"><button class="btn btn-sm" type="button" data-act="rename">Guardar</button></div>
    <label class="field-label" for="dn-move">Mudar a otro recinto</label>
    <div class="name-field"><select id="dn-move" class="search">${s.recintos.map((r) => `<option value="${r.id}" ${r.id === d.recinto ? 'selected' : ''}>${BIOMES[r.bioma].icono} ${esc(r.nombre)} (${G.dinosIn(s, r.id).length}/${ENCLOSURE_CAPACITY})</option>`).join('')}</select><button class="btn btn-sm" type="button" data-act="move">Mudar</button></div>
    <button class="btn btn-ghost btn-sm" type="button" data-act="donate" style="margin-top:16px">Enviar a un santuario</button>`;
}

function wire(app, id, body) {
  body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    picking = false;
    app.sfx.tap();
    draw(app, id);
  }));
  const portrait = body.querySelector('#dino-portrait');
  const burst = (glyph) => {
    if (!portrait) return;
    const r = portrait.getBoundingClientRect();
    heartBurst(portrait, r.width / 2 + (Math.random() - 0.5) * 60, r.height / 3, glyph);
  };
  const combo = (r) => {
    if (r && r.combo >= 2) toast(`¡Combo x${r.combo}! +${3 * r.combo} monedas`, 'gold', '⚡');
  };
  const act = (fn, glyph, sfx) => {
    const r = app.do(fn, { render: false, sfx });
    if (r && r.ok) {
      burst(glyph);
      if (r.vinculo) app.sfx.chirp();
      combo(r);
    }
    draw(app, id);
  };
  const photo = body.querySelector('[data-photo]');
  if (photo) photo.addEventListener('click', () => { app.sfx.tap(); openPostcard(app, id, () => openDinoSheet(app, id)); });
  body.querySelectorAll('[data-train]').forEach((b) => b.addEventListener('click', () => act((s) => G.train(s, id, b.dataset.train), '💪', app.sfx.coin)));
  body.querySelectorAll('[data-acc]').forEach((b) => b.addEventListener('click', () => act((s) => equipAccessory(s, id, b.dataset.acc), b.dataset.acc ? ACCESSORIES[b.dataset.acc].icono : '✨')));
  body.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'feed') { picking = !picking; app.sfx.tap(); draw(app, id); return; }
    if (a === 'pet') act((s) => G.pet(s, id), '❤️');
    if (a === 'play') act((s) => G.play(s, id), '⚽');
    if (a === 'rest') act((s) => G.rest(s, id), '💤');
    if (a === 'wake') act((s) => G.wake(s, id), '🌅');
    if (a === 'med') act((s) => G.medicate(s, id), '💚');
    if (a === 'cure') act((s) => G.medicate(s, id), '💚');
    if (a === 'rename') act((s) => G.rename(s, id, body.querySelector('#dn-name').value), '✏️');
    if (a === 'move') act((s) => G.moveDino(s, id, body.querySelector('#dn-move').value), '🏠');
    if (a === 'donate') {
      const d = app.state.dinos.find((x) => x.id === id);
      confirmSheet('¿Enviar a un santuario?', `${d.nombre} se irá a vivir a un gran santuario con más espacio. No volverá al refugio, pero recibirás monedas de apoyo.`, 'Enviar', () => app.do((s) => G.donate(s, id)));
    }
  }));
  body.querySelectorAll('[data-food]').forEach((b) => b.addEventListener('click', () => {
    const r = app.do((s) => G.feed(s, id, b.dataset.food), { render: false });
    if (r && r.ok) { burst(FOODS[b.dataset.food].icono); picking = false; combo(r); }
    draw(app, id);
  }));
}

// Actualización en vivo sin redibujar (no corta animaciones ni la escritura).
let lastSig = '';
function live(app, id) {
  const s = app.state;
  const d = s.dinos.find((x) => x.id === id);
  const body = sheetBody();
  if (!d || !body) return;
  const sig = `${G.stageOf(d)}${d.peticion ? d.peticion.tipo : ''}${d.duermeHasta > s.tiempoJuego}${d.enClinica}${G.moodOf(d, s.tiempoJuego)}`;
  if (lastSig && sig !== lastSig && tab === 'cuidado') { lastSig = sig; draw(app, id); return; }
  lastSig = sig;
  for (const k of ['hambre', 'animo', 'energia', 'salud']) {
    const n = body.querySelector(`[data-num="${k}"]`);
    if (n) n.textContent = Math.round(d[k]);
    const b = body.querySelector(`[data-bar="${k}"] .bar`);
    setBar(b, d[k]);
  }
  const g = G.growthProgress(d);
  const c = body.querySelector('[data-live="crece"]');
  if (c) {
    c.textContent = fmtTime(g.faltaSeg);
    setBar(c.closest('.need').querySelector('.bar'), g.pct * 100);
  }
}
