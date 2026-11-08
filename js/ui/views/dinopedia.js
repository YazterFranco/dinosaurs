// Dinopedia: fichas de museo, línea de tiempo y comparación de tamaño.
import {
  SPECIES, SPECIES_BY_ID, PERIODS, DIETS, RARITY, periodLabel, maLabel,
} from '../../data/species.js';
import { SITES, FOODS, BIOMES } from '../../data/world.js';
import { markRead } from '../../systems/game.js';
import { humanPath } from '../../render/dino-svg.js';
import { dinoArt, dinoArtSvg } from '../../render/art.js';
import { esc, fmtKg, bar } from '../dom.js';

let filter = 'todos';
let query = '';
let mode = 'fichas';

export function render(el, params, app) {
  if (params[0] && SPECIES_BY_ID[params[0]]) return renderEntry(el, SPECIES_BY_ID[params[0]], app);
  const s = app.state;
  const found = SPECIES.filter((sp) => (s.genoma[sp.id] || 0) > 0).length;
  el.innerHTML = `
    <div class="view-head"><div><h1>Dinopedia</h1><p class="muted">${found} de ${SPECIES.length} especies descubiertas. Excava para desbloquear las fichas.</p></div></div>
    <div class="chips" role="group" aria-label="Vista">
      <button class="chip" type="button" data-mode="fichas" aria-pressed="${mode === 'fichas'}">🏷️ Fichas</button>
      <button class="chip" type="button" data-mode="tiempo" aria-pressed="${mode === 'tiempo'}">⏳ Línea de tiempo</button>
    </div>
    <div id="dp-body"></div>`;
  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; app.sfx.tap(); render(el, [], app); }));
  const body = el.querySelector('#dp-body');
  if (mode === 'tiempo') body.innerHTML = timeline(s);
  else {
    body.innerHTML = `
      <input class="search" type="search" placeholder="Buscar por nombre…" aria-label="Buscar especie" value="${esc(query)}">
      <div class="chips" role="group" aria-label="Filtrar por periodo" style="margin-top:10px">
        ${[['todos', 'Todos'], ['triasico', 'Triásico'], ['jurasico', 'Jurásico'], ['cretacico', 'Cretácico'], ['descubiertos', 'Descubiertos']].map(([k, l]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}
      </div>
      <div class="specimens" id="grid"></div>`;
    const draw = () => { body.querySelector('#grid').innerHTML = grid(s); };
    draw();
    body.querySelector('.search').addEventListener('input', (e) => { query = e.target.value; draw(); });
    body.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.f;
      body.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    }));
  }
}

function grid(s) {
  const q = query.trim().toLowerCase();
  const list = SPECIES.filter((sp) => {
    const known = (s.genoma[sp.id] || 0) > 0;
    if (filter === 'descubiertos' && !known) return false;
    if (['triasico', 'jurasico', 'cretacico'].includes(filter) && sp.periodo !== filter) return false;
    if (q && !(known && sp.nombre.toLowerCase().includes(q))) return false;
    return true;
  });
  if (!list.length) return '<div class="empty" style="grid-column:1/-1"><p>No hay especies con ese filtro.</p></div>';
  return list.map((sp) => {
    const g = s.genoma[sp.id] || 0;
    const known = g > 0;
    return `<a class="specimen${known ? '' : ' locked'}" href="#/dinopedia/${sp.id}" style="--pc:${PERIODS[sp.periodo].color}">
      ${dinoArt(sp, null, { silhouette: !known, noShadow: true, detail: 'low' })}
      <span class="sname">${known ? esc(sp.nombre) : '???'}</span>
      <span class="smeta">${PERIODS[sp.periodo].nombre}${known ? ` · ${DIETS[sp.dieta].icono}` : ''}${sp.colorReal ? ' · 🎨' : ''}</span>
      ${known ? bar(g, 'leaf nolow') : ''}
    </a>`;
  }).join('');
}

function timeline(s) {
  const order = ['cretacico', 'jurasico', 'triasico'];
  return `<p class="small muted">Del más reciente (arriba) al más antiguo (abajo). Los dinosaurios no avianos se extinguieron hace 66 millones de años, cuando cayó un asteroide en Chicxulub, México.</p>
  <div class="timeline">${order.map((pk) => {
    const p = PERIODS[pk];
    const sps = SPECIES.filter((sp) => sp.periodo === pk).sort((a, b) => a.ma[1] - b.ma[1]);
    return `<div class="tl-period" style="--pc:${p.color}"><h3>${p.nombre} <span class="small muted">${p.desde}–${p.hasta} Ma</span></h3></div>
      ${sps.map((sp) => {
        const known = (s.genoma[sp.id] || 0) > 0;
        return `<a class="tl-item" style="--pc:${p.color}" href="#/dinopedia/${sp.id}"><span class="thumb">${dinoArt(sp, null, { silhouette: !known, noShadow: true, detail: 'low', size: 'sm' })}</span><span>${known ? esc(sp.nombre) : '???'}</span><span class="ma">${sp.ma[0]} Ma</span></a>`;
      }).join('')}
      ${pk === 'cretacico' ? '<p class="tl-gap">💡 El T. rex vivió más cerca de nosotros en el tiempo que del Stegosaurus.</p>' : ''}
      ${pk === 'jurasico' ? '<p class="tl-gap">💡 El Jurásico duró unos 56 millones de años; los humanos existimos desde hace solo 300.000.</p>' : ''}`;
  }).join('')}
  <div class="tl-period" style="--pc:#c9783f"><p class="tl-gap">Hace 252 Ma: la mayor extinción de la historia abrió el camino a los dinosaurios.</p></div>
  </div>`;
}

function sizeCompare(sp) {
  // Escala: el lienzo mide 360×150; la persona mide 1,7 m.
  const L = sp.longitudM;
  const Hm = sp.alturaM;
  const W = 340;
  const ground = 138;
  const maxM = Math.max(L + 2.5, 4);
  const scale = Math.min((W - 20) / maxM, 100 / Math.max(Hm, 1.8));
  const dinoW = L * scale;
  const humanH = 1.7 * scale;
  return `<svg class="size-compare" viewBox="0 0 360 156" role="img" aria-label="Comparación: ${esc(sp.nombre)} medía ${L} metros de largo; una persona mide 1,7 metros">
    <line x1="8" y1="${ground}" x2="352" y2="${ground}" stroke="#c9d4c8" stroke-width="2"/>
    ${humanPath(18, ground, humanH)}
    ${(() => {
      const w = dinoW * 1.02;
      const h = (w * 160) / 240;
      return dinoArtSvg(sp, null, { noShadow: true }, { x: 36 - w * 0.01, y: ground - h * 0.95, w, h });
    })()}
    <text x="${36 + dinoW / 2}" y="${ground + 11}" text-anchor="middle" font-size="10" font-weight="700" fill="#1f2a24" stroke="#fff" stroke-width="3" paint-order="stroke">${L.toLocaleString('es')} m de ${sp.medidaNota ? 'envergadura' : 'largo'}</text>
    <text x="18" y="${ground + 11}" text-anchor="middle" font-size="9" fill="#4a5a51">1,7 m</text>
  </svg>`;
}

function renderEntry(el, sp, app) {
  const s = app.state;
  const g = s.genoma[sp.id] || 0;
  const known = g > 0;
  const sites = SITES.filter((x) => x.especies.includes(sp.id));
  const rar = RARITY[sp.rareza];
  if (known && markRead(s, sp.id)) app.after();
  if (!known) {
    el.innerHTML = `<a href="#/dinopedia" class="small">← Volver a la Dinopedia</a>
      <div class="entry-hero" style="margin-top:10px"><div class="portrait">${dinoArt(sp, null, { silhouette: true })}</div>
      <div><h1>Especie sin descubrir</h1><p class="muted" style="margin-top:6px">Vivió en el ${esc(periodLabel(sp))}. Encuentra un fósil suyo para leer su ficha.</p>
      <p style="margin-top:12px"><b>Dónde excavar:</b> ${sites.map((x) => esc(`${x.nombre} (${x.lugar})`)).join(', ')}</p>
      <a class="btn" href="#/excavar" style="margin-top:14px">Ir a excavar</a></div></div>`;
    return;
  }
  const d = DIETS[sp.dieta];
  el.innerHTML = `<a href="#/dinopedia" class="small">← Volver a la Dinopedia</a>
    <div class="entry-hero" style="margin-top:10px">
      <div class="portrait">${dinoArt(sp, null, { anim: true, viewer: true, viewerKey: `pedia-${sp.id}` })}</div>
      <div class="entry-title">
        <h1 class="sci">${esc(sp.nombre)}</h1>
        <p><b>"${esc(sp.significado)}"</b> · se pronuncia <i>${esc(sp.pronunciacion)}</i></p>
        <p style="margin-top:8px"><span class="tag tag-${sp.periodo.slice(0, 3)}">${esc(periodLabel(sp))}</span> <span class="tag">${d.icono} ${d.nombre}</span> <span class="tag" style="background:${rar.color};color:#fff">${rar.nombre}</span></p>
        <div class="need" style="margin-top:12px"><label><span>🧬 Genoma recuperado</span><span>${g.toFixed(g % 1 ? 1 : 0)} %</span></label>${bar(g, 'leaf nolow')}</div>
      </div>
    </div>
    ${sp.noDino ? `<div class="notdino"><b>¡Ojo! No es un dinosaurio.</b> ${esc(sp.noDino)}</div>` : ''}
    ${sp.colorReal ? `<div class="realcolor"><b>🎨 Color real conocido</b> ${esc(sp.colorReal)} Por eso su ilustración usa esos tonos.</div>` : ''}
    <dl class="facts">
      ${fact('Vivió', maLabel(sp))}
      ${fact('Grupo', sp.grupo)}
      ${fact(sp.medidaNota ? 'Envergadura' : 'Largo', `${sp.longitudM.toLocaleString('es')} m`)}
      ${fact('Alto', `${sp.alturaM.toLocaleString('es')} m`)}
      ${fact('Peso', `≈ ${fmtKg(sp.pesoKg)}`)}
      ${fact('Hallado en', `${sp.pais}`)}
      ${fact('Rocas', sp.formacion)}
      ${fact('Descubierto', `${sp.descubierto.anio} · ${sp.descubierto.por}`)}
    </dl>
    <section class="section"><h2>Tamaño comparado</h2>${sizeCompare(sp)}</section>
    <section class="section"><h2>Datos curiosos</h2><ul class="funfacts">${sp.datos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section class="section"><h2>Mito y realidad</h2><div class="myth"><div class="m"><b>Mito</b>${esc(sp.mito.mito)}</div><div class="r"><b>Realidad</b>${esc(sp.mito.realidad)}</div></div></section>
    <section class="section"><h2>Cómo cuidarlo en el refugio</h2>
      <dl class="kv panel">
        <dt>Hábitat</dt><dd>${BIOMES[sp.bioma].icono} ${esc(BIOMES[sp.bioma].nombre)}${sp.biomas.length > 1 ? `, también ${sp.biomas.filter((b) => b !== sp.bioma).map((b) => BIOMES[b].nombre.toLowerCase()).join(', ')}` : ''}</dd>
        <dt>Vida social</dt><dd>${esc(sp.social.tipo)}: le gustan grupos de ${sp.social.min} a ${sp.social.max}</dd>
        <dt>Comida favorita</dt><dd>${sp.favoritos.map((f) => `${FOODS[f].icono} ${esc(FOODS[f].nombre)}`).join(', ')}</dd>
        <dt>Yacimientos</dt><dd>${sites.map((x) => esc(x.nombre)).join(', ')}</dd>
      </dl>
    </section>
    <p class="small muted" style="margin-top:16px">Las medidas son estimaciones promedio; cambian según el ejemplar y el estudio. ${sp.colorReal ? 'El color de esta especie se reconstruyó a partir de sus fósiles.' : 'Los colores de la ilustración son imaginados: casi nunca se conserva el color real.'}</p>`;
}

function fact(k, v) {
  return `<div class="fact"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
}
