// "Más": centro de misiones, tienda, hallazgos, diario y ajustes.
import {
  FOODS, MEDICINE, BIOMES, ENRICHMENT, ENCLOSURE_COST, ENCLOSURE_LEVEL, MAX_ENRICHMENT, UPGRADES, CURIOS, XP_LEVELS, MAX_LEVEL,
} from '../../data/world.js';
import { MISSIONS, ACHIEVEMENTS, currentMission } from '../../systems/missions.js';
import * as G from '../../systems/game.js';
import * as R from '../../systems/rewards.js';
import { ACCESSORIES, ACCESSORY_IDS } from '../../data/cosmetics.js';
import { RARITY, SPECIES_BY_ID } from '../../data/species.js';
import { dinoArt, is3DOn, set3D, start3D, status3D } from '../../render/art.js';
import { canOfferInstall, install } from '../install.js';
import { exportCode, importCode, clear } from '../../store.js';
import { setSound } from '../../audio.js';
import { esc, fmt, fmtTime, confirmSheet, toast } from '../dom.js';

export function render(el, params, app, name) {
  if (name === 'misiones') return missions(el, app);
  if (name === 'tienda') return shop(el, params, app);
  if (name === 'hallazgos') return curios(el, app);
  if (name === 'diario') return diary(el, app);
  if (name === 'ajustes') return settings(el, app);
  return hub(el, app);
}

function hub(el, app) {
  const s = app.state;
  const m = currentMission(s);
  const nCurios = Object.values(s.inventario.curios).reduce((a, b) => a + b, 0);
  const items = [
    ['recompensas', '🎁', 'Recompensas', 'Racha, cofres, misiones de hoy y accesorios', R.pendingCount(s) > 0],
    ['misiones', '📜', 'Misiones y logros', m ? m.titulo : '¡Todas completas!', m && m.check(s)],
    ['tienda', '🛒', 'Tienda', 'Comida, recintos y mejoras'],
    ['expedicion', '🧭', 'Expediciones', s.expedicion ? '¡Hay una en marcha!' : 'Explora, enfrenta salvajes y amánsalos', !!s.expedicion],
    ['concursos', '🏆', 'Concursos', 'Carrera, fuerza, belleza, ingenio'],
    ['quiz', '🎓', 'Quiz', 'Gana monedas y ADN aprendiendo'],
    ['hallazgos', '🐚', 'Hallazgos', `${nCurios} objetos en tu vitrina`],
    ['diario', '📓', 'Diario del refugio', 'Lo que pasó últimamente'],
    ['ajustes', '⚙️', 'Ajustes', 'Sonido, 3D y partida guardada'],
  ];
  el.innerHTML = `<div class="view-head"><div><h1>Más</h1><p class="muted">Nivel ${s.nivel} · ${fmt(s.xp)} XP · ${s.dinos.length} dinosaurios</p></div></div>
    <nav class="hub">${items.map(([r, i, t, sub, badge]) => `<a href="#/${r}"><span class="hi" aria-hidden="true">${i}</span><b>${t}</b><span>${esc(sub)}</span>${badge ? '<i class="badge">!</i>' : ''}</a>`).join('')}
      ${canOfferInstall() ? '<a href="#/mas" data-install><span class="hi" aria-hidden="true">📲</span><b>Instalar como app</b><span>En tu pantalla de inicio y sin internet</span></a>' : ''}</nav>`;
  const ib = el.querySelector('[data-install]');
  if (ib) ib.addEventListener('click', (e) => { e.preventDefault(); install(); });
}

function back() {
  return '<a href="#/mas" class="small">← Volver</a>';
}

function missions(el, app) {
  const s = app.state;
  const cur = currentMission(s);
  const next = XP_LEVELS[s.nivel];
  el.innerHTML = `${back()}
    <div class="view-head"><div><h1>Misiones y logros</h1><p class="muted">Nivel ${s.nivel}${s.nivel < MAX_LEVEL ? ` · ${fmt(next - s.xp)} XP para el siguiente` : ' · nivel máximo'}</p></div></div>
    <section class="panel"><h2>Misiones</h2>
      <ol class="mission-list" style="margin-top:10px">${MISSIONS.map((m) => {
        const done = s.misiones.includes(m.id);
        const now = cur && cur.id === m.id;
        return `<li class="row" style="cursor:default${now ? ';border-color:#cfe09a;background:#f3f8e4' : ''}"><span aria-hidden="true">${done ? '✅' : now ? '🧭' : '⬜'}</span><span class="grow"><span class="title ${done ? 'done' : ''}">${esc(m.titulo)}</span><span class="sub">${esc(m.desc)}</span></span><span class="tag tag-amber">+${m.premio} 🪙</span>${now ? `<a class="btn btn-sm" href="#/${m.ir}">Ir</a>` : ''}</li>`;
      }).join('')}</ol>
    </section>
    <section class="section"><h2>Logros <span class="small muted">${s.logros.length}/${ACHIEVEMENTS.length}</span></h2>
      <div class="ach" style="margin-top:10px">${ACHIEVEMENTS.map((a) => `<div class="${s.logros.includes(a.id) ? '' : 'off'}"><span class="ai" aria-hidden="true">${a.icono}</span><span><b>${esc(a.titulo)}</b><br><span class="small muted">${esc(a.desc)}</span></span></div>`).join('')}</div>
    </section>`;
}

let shopTab = 'comida';
function shop(el, params, app) {
  const s = app.state;
  if (params[0]) shopTab = params[0];
  const tabs = [['comida', '🍖 Comida'], ['recintos', '🏗️ Recintos'], ['enriquecimiento', '🪵 Enriquecimiento'], ['mejoras', '🔧 Mejoras'], ['accesorios', '🎀 Accesorios']];
  let body = '';
  if (shopTab === 'comida') {
    body = `<div class="shop-grid">${Object.entries(FOODS).map(([id, f]) => `<div class="shop-item"><span class="si">${f.icono}</span><span class="grow"><b>${esc(f.nombre)}</b><span class="sub" style="display:block">Tienes ${s.inventario.comida[id] || 0} · ${esc(f.dato)}</span></span>
        <span style="display:flex;flex-direction:column;gap:6px"><button class="btn btn-sm" type="button" data-food="${id}" data-q="1">1 · ${G.foodPrice(id)}🪙</button><button class="btn btn-sm btn-ghost" type="button" data-food="${id}" data-q="5">5 · ${G.foodPrice(id) * 5}🪙</button></span></div>`).join('')}
      <div class="shop-item"><span class="si">${MEDICINE.icono}</span><span class="grow"><b>${MEDICINE.nombre}</b><span class="sub" style="display:block">Tienes ${s.inventario.medicina} · Recupera salud.</span></span><button class="btn btn-sm" type="button" data-med>${MEDICINE.precio}🪙</button></div></div>`;
  } else if (shopTab === 'recintos') {
    body = `<p class="small muted" style="margin-bottom:10px">Cada especie prefiere un hábitat. Un recinto adecuado sube su ánimo y atrae más visitantes.</p>
      <div class="shop-grid">${Object.entries(BIOMES).map(([id, b]) => {
        const lvl = ENCLOSURE_LEVEL[id];
        const n = s.recintos.filter((r) => r.bioma === id).length;
        return `<div class="shop-item"><span class="si">${b.icono}</span><span class="grow"><b>${esc(b.nombre)}</b><span class="sub" style="display:block">${n ? `Tienes ${n}. ` : ''}${esc(b.dato)}</span></span>
          ${s.nivel < lvl ? `<span class="tag">🔒 Nivel ${lvl}</span>` : `<button class="btn btn-sm" type="button" data-build="${id}">${G.enclosurePrice(s, id)}🪙</button>`}</div>`;
      }).join('')}</div>`;
  } else if (shopTab === 'enriquecimiento') {
    body = `<p class="small muted" style="margin-bottom:10px">Los objetos dan ánimo a todos los habitantes del recinto (máximo ${MAX_ENRICHMENT} por recinto).</p>
      ${s.recintos.map((r) => `<div class="panel"><h3>${BIOMES[r.bioma].icono} ${esc(r.nombre)} <span class="small muted">${r.enriquecimiento.length}/${MAX_ENRICHMENT}</span></h3>
        <div class="shop-grid" style="margin-top:10px">${Object.entries(ENRICHMENT).map(([id, it]) => {
          const has = r.enriquecimiento.includes(id);
          return `<div class="shop-item" style="background:#fff"><span class="si">${it.icono}</span><span class="grow"><b>${esc(it.nombre)}</b><span class="sub" style="display:block">+${it.bonus} de ánimo</span></span>${has ? '<span class="tag">Instalado</span>' : `<button class="btn btn-sm" type="button" data-enr="${id}" data-rec="${r.id}" ${r.enriquecimiento.length >= MAX_ENRICHMENT ? 'disabled' : ''}>${it.precio}🪙</button>`}</div>`;
        }).join('')}</div></div>`).join('')}`;
  } else if (shopTab === 'accesorios') {
    body = `<p class="small muted" style="margin-bottom:10px">Precio fijo: sabes exactamente qué compras. También salen en los cofres.</p>
      <div class="acc-grid">${ACCESSORY_IDS.map((id) => {
        const a = ACCESSORIES[id];
        const has = s.recompensas.accesorios.includes(id);
        const price = R.ACCESSORY_PRICE[a.rareza];
        return `<div class="acc" style="--rc:${RARITY[a.rareza].color}">${dinoArt(SPECIES_BY_ID.psittacosaurus, null, { stage: 'cria', detail: 'low', accesorio: id, mood: 'feliz', noShadow: true })}<b>${esc(a.nombre)}</b><span class="small" style="color:${RARITY[a.rareza].color}">${RARITY[a.rareza].nombre} · +${a.bonus} belleza</span>
          ${has ? '<span class="tag">Tuyo</span>' : `<button class="btn btn-sm" type="button" data-acc="${id}" ${s.monedas >= price ? '' : 'disabled'}>${fmt(price)}🪙</button>`}</div>`;
      }).join('')}</div>`;
  } else {
    body = `<div class="shop-grid">${Object.entries(UPGRADES).map(([id, u]) => {
      const lvl = s.mejoras[id];
      const max = lvl >= u.precios.length;
      return `<div class="shop-item"><span class="si">${u.icono}</span><span class="grow"><b>${esc(u.nombre)}</b><span class="sub" style="display:block">Nivel ${lvl}/${u.precios.length}${u.dato ? ` · ${esc(u.dato)}` : ''}${id === 'incubadora' ? ` · Ranuras: ${G.incubatorSlots(s)}` : ''}</span></span>
        ${max ? '<span class="tag">Máximo</span>' : `<button class="btn btn-sm" type="button" data-up="${id}">${u.precios[lvl]}🪙</button>`}</div>`;
    }).join('')}</div>`;
  }
  el.innerHTML = `${back()}<div class="view-head"><div><h1>Tienda</h1><p class="muted">Tienes ${fmt(s.monedas)} monedas.</p></div></div>
    <div class="chips" role="tablist">${tabs.map(([k, l]) => `<a class="chip" role="tab" href="#/tienda/${k}" aria-selected="${shopTab === k}">${l}</a>`).join('')}</div>
    <div style="margin-top:6px">${body}</div>`;
  const active = el.querySelector('.chips .chip[aria-selected="true"]');
  if (active) active.parentElement.scrollLeft = active.offsetLeft - 16;
  el.querySelectorAll('[data-food]').forEach((b) => b.addEventListener('click', () => app.do((st) => G.buyFood(st, b.dataset.food, +b.dataset.q), { sfx: app.sfx.coin })));
  el.querySelectorAll('[data-med]').forEach((b) => b.addEventListener('click', () => app.do((st) => G.buyMedicine(st), { sfx: app.sfx.coin })));
  el.querySelectorAll('[data-build]').forEach((b) => b.addEventListener('click', () => app.do((st) => G.buildEnclosure(st, b.dataset.build), { icon: '🏗️' })));
  el.querySelectorAll('[data-enr]').forEach((b) => b.addEventListener('click', () => app.do((st) => G.buyEnrichment(st, b.dataset.rec, b.dataset.enr), { icon: ENRICHMENT[b.dataset.enr].icono })));
  el.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => app.do((st) => G.buyUpgrade(st, b.dataset.up), { icon: '🔧' })));
  el.querySelectorAll('[data-acc]').forEach((b) => b.addEventListener('click', () => app.do((st) => R.buyAccessory(st, b.dataset.acc), { icon: ACCESSORIES[b.dataset.acc].icono, sfx: app.sfx.coin })));
}

function curios(el, app) {
  const s = app.state;
  el.innerHTML = `${back()}<div class="view-head"><div><h1>Hallazgos</h1><p class="muted">Fósiles que no son dinosaurios, pero cuentan la historia de su mundo.</p></div></div>
    <div class="shop-grid">${CURIOS.map((c) => {
      const n = s.inventario.curios[c.id] || 0;
      return `<div class="shop-item"${n ? '' : ' style="opacity:.55"'}><span class="si">${n ? c.icono : '❔'}</span><span class="grow"><b>${n ? esc(c.nombre) : 'Sin encontrar'}</b><span class="sub" style="display:block">${n ? `Tienes ${n} · ${esc(c.dato)}` : 'Aparecen al excavar.'}</span></span>${n ? `<button class="btn btn-sm btn-ghost" type="button" data-sell="${c.id}">Vender · ${c.valor}🪙</button>` : ''}</div>`;
    }).join('')}</div>`;
  el.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => app.do((st) => G.sellCurio(st, b.dataset.sell), { sfx: app.sfx.coin })));
}

function diary(el, app) {
  const s = app.state;
  const c = s.contadores;
  el.innerHTML = `${back()}<div class="view-head"><div><h1>Diario del refugio</h1><p class="muted">Tiempo de juego: ${fmtTime(s.tiempoJuego)}</p></div></div>
    <dl class="facts">
      ${[['Excavaciones', c.excavaciones], ['Huesos', c.huesos], ['Eclosiones', c.eclosiones], ['Cruces', c.cruces], ['Comidas servidas', c.alimentar], ['Caricias', c.caricias], ['Concursos ganados', c.concursosGanados], ['Monedas ganadas', fmt(c.ganancias)]]
        .map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
    </dl>
    <section class="section"><h2>Últimos sucesos</h2>
      ${s.eventos.length ? `<ul class="list" style="padding:0;margin:10px 0 0">${s.eventos.map((e) => `<li class="row" style="cursor:default"><span aria-hidden="true">${e.icono}</span><span class="grow">${esc(e.texto)}</span><span class="small muted">${fmtTime(s.tiempoJuego - e.t)}</span></li>`).join('')}</ul>` : '<div class="empty"><p>Aún no hay sucesos.</p></div>'}
    </section>`;
}

function settings(el, app) {
  const s = app.state;
  const d3 = status3D();
  el.innerHTML = `${back()}<div class="view-head"><div><h1>Ajustes</h1></div></div>
    <div class="panel">
      ${canOfferInstall() ? '<button class="btn btn-amber btn-block" type="button" data-install style="margin-bottom:12px">📲 Instalar como app</button>' : '<p class="small" style="margin-bottom:12px">✅ Estás jugando en la app instalada.</p>'}
      <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700">Sonido
        <input type="checkbox" id="snd" ${s.ajustes.sonido ? 'checked' : ''} style="width:24px;height:24px"></label>
      <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700;margin-top:12px">Dinosaurios en 3D
        <input type="checkbox" id="d3" ${d3 === 'on' || (d3 === 'pendiente' && is3DOn()) ? 'checked' : ''} ${d3 === 'sin' ? 'disabled' : ''} style="width:24px;height:24px"></label>
      <p class="small muted" style="margin-top:4px">${d3 === 'sin' ? 'Tu navegador no tiene WebGL2, así que se usa el dibujo plano.'
    : d3 === 'lento' ? 'Tu navegador dibuja sin tarjeta gráfica, así que usamos el dibujo plano. Puedes activar el 3D igual, pero irá más lento.'
      : 'Modelos 3D con luz y sombras. Si tu teléfono va lento, desactívalo para usar el dibujo plano.'}</p>
    </div>
    <div class="panel">
      <h2>Partida guardada</h2>
      <p class="small muted" style="margin-top:4px">Se guarda sola en este navegador. Para pasarla a otro dispositivo, copia el código y pégalo allí.</p>
      <button class="btn btn-ghost btn-sm" type="button" data-export style="margin-top:10px">Mostrar código de guardado</button>
      <textarea id="code" class="search" rows="3" style="margin-top:10px;font-size:.75rem" aria-label="Código de guardado" placeholder="Pega aquí un código para cargar una partida"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn btn-sm" type="button" data-copy>Copiar código</button>
        <button class="btn btn-sm btn-ghost" type="button" data-import>Cargar código</button>
      </div>
    </div>
    <div class="panel">
      <h2>Empezar de nuevo</h2>
      <p class="small muted" style="margin-top:4px">Borra la partida de este navegador.</p>
      <button class="btn btn-danger btn-sm" type="button" data-reset style="margin-top:10px">Borrar partida</button>
    </div>
    <div class="panel">
      <h2>Sobre el juego</h2>
      <p class="small" style="margin-top:6px">Datos basados en literatura paleontológica y en la Dino Directory del Natural History Museum de Londres. Mecánicas inspiradas en Jurassic World Evolution, ARK, Prehistoric Kingdom y Tamagotchi. Más detalles en <code>docs/GDD.md</code>.</p>
    </div>`;
  const inst = el.querySelector('[data-install]');
  if (inst) inst.addEventListener('click', () => install());
  el.querySelector('#d3').addEventListener('change', (e) => {
    set3D(e.target.checked);
    toast(e.target.checked ? 'Dinosaurios en 3D activados.' : 'Usando el dibujo plano.', 'good', '🦖');
    setTimeout(() => location.reload(), 600);
  });
  el.querySelector('#snd').addEventListener('change', (e) => {
    s.ajustes.sonido = e.target.checked;
    setSound(s.ajustes.sonido);
    app.save();
    if (s.ajustes.sonido) app.sfx.ok();
  });
  const code = el.querySelector('#code');
  el.querySelector('[data-export]').addEventListener('click', () => { code.value = exportCode(s); code.select(); });
  el.querySelector('[data-copy]').addEventListener('click', async () => {
    if (!code.value) code.value = exportCode(s);
    try { await navigator.clipboard.writeText(code.value); toast('Código copiado.', 'good', '📋'); } catch { code.select(); toast('Selecciona el texto y cópialo.', ''); }
  });
  el.querySelector('[data-import]').addEventListener('click', () => {
    try {
      const st = importCode(code.value);
      app.reset(st);
      toast('Partida cargada.', 'good', '💾');
    } catch {
      toast('Ese código no es válido. Revisa que lo copiaste completo.', 'bad');
    }
  });
  el.querySelector('[data-reset]').addEventListener('click', () => confirmSheet('¿Borrar la partida?', 'Perderás tus dinosaurios, ADN y monedas. No se puede deshacer.', 'Borrar todo', () => {
    clear();
    app.reset(G.createGame());
  }, true));
}
