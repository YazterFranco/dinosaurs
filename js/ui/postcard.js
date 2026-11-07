// Postal del dinosaurio: una imagen PNG para guardar o compartir.
import { SPECIES_BY_ID, PERIODS, periodLabel } from '../data/species.js';
import { BIOMES } from '../data/world.js';
import { stageOf, moodOf } from '../systems/game.js';
import { dinoSVG } from '../render/dino-svg.js';
import { esc, openSheet, closeSheet, toast } from './dom.js';

const W = 600;
const H = 760;

function cardSVG(state, d) {
  const sp = SPECIES_BY_ID[d.especie];
  const rec = state.recintos.find((r) => r.id === d.recinto);
  const b = BIOMES[rec ? rec.bioma : sp.bioma];
  const stage = stageOf(d);
  const p = PERIODS[sp.periodo];
  const date = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  const art = dinoSVG(sp, d.genes, { stage, mood: moodOf(d, state.tiempoJuego) || 'feliz', accesorio: d.accesorio })
    .replace('<svg class="dino-svg"', '<svg x="40" y="150" width="520" height="347" class="dino-svg"');
  const font = "'Trebuchet MS', 'Arial Rounded MT Bold', Arial, sans-serif";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="pc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.cielo[0]}"/><stop offset="1" stop-color="${b.cielo[1]}"/></linearGradient>
      <linearGradient id="pc-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.suelo[0]}"/><stop offset="1" stop-color="${b.suelo[1]}"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" rx="28" fill="#f8faf5"/>
    <rect x="24" y="24" width="${W - 48}" height="520" rx="20" fill="url(#pc-sky)"/>
    <circle cx="470" cy="110" r="38" fill="#fff6d8" opacity=".9"/>
    <path d="M24,330 C150,280 260,310 360,300 S520,280 576,300 L576,524 Q576,544 556,544 L44,544 Q24,544 24,524 Z" fill="${b.lejos}" opacity=".7"/>
    <path d="M24,400 C160,370 300,395 420,385 S540,375 576,390 L576,524 Q576,544 556,544 L44,544 Q24,544 24,524 Z" fill="url(#pc-ground)"/>
    ${art}
    <rect x="24" y="24" width="${W - 48}" height="520" rx="20" fill="none" stroke="#1d4a36" stroke-width="4"/>
    <text x="44" y="78" font-family="${font}" font-size="22" font-weight="700" fill="#1d4a36">🦕 Dino Refugio</text>
    <text x="${W / 2}" y="606" text-anchor="middle" font-family="${font}" font-size="46" font-weight="700" fill="#1f2a24">${esc(d.nombre)}</text>
    <text x="${W / 2}" y="644" text-anchor="middle" font-family="${font}" font-size="24" font-style="italic" fill="#4a5a51">${esc(sp.nombre)} · ${d.genes.sexo === 'M' ? 'macho' : 'hembra'}</text>
    <rect x="${W / 2 - 170}" y="664" width="340" height="38" rx="19" fill="${p.color}" opacity=".18"/>
    <text x="${W / 2}" y="690" text-anchor="middle" font-family="${font}" font-size="19" fill="#1f2a24">${esc(periodLabel(sp))} · hace ${sp.ma[0]} millones de años</text>
    <text x="${W / 2}" y="736" text-anchor="middle" font-family="${font}" font-size="16" fill="#4a5a51">${esc(date)}</text>
  </svg>`;
}

function toPng(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W * 2;
      c.height = H * 2;
      const ctx = c.getContext('2d');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('sin imagen'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no se pudo dibujar')); };
    img.src = url;
  });
}

export function openPostcard(app, dinoId, onBack) {
  const s = app.state;
  const d = s.dinos.find((x) => x.id === dinoId);
  if (!d) return;
  const svg = cardSVG(s, d);
  const body = openSheet('Postal', `<div class="postcard" id="pc-box">${svg.replace('<svg ', '<svg class="postcard-svg" ')}</div>
    <p class="small muted" style="text-align:center;margin-top:8px">También puedes mantener presionada la imagen para guardarla.</p>
    <div class="sheet-actions">
      <button class="btn btn-amber" type="button" data-share>Compartir</button>
      <button class="btn btn-ghost" type="button" data-save>Descargar</button>
      ${onBack ? '<button class="btn btn-ghost" type="button" data-back>Volver a la ficha</button>' : ''}
    </div>`);
  const file = `${d.nombre.replace(/[^\p{L}\p{N}]+/gu, '-')}-dino-refugio.png`;
  // Convierte la vista previa en una imagen real: así se puede guardar con un toque largo.
  toPng(svg).then((blob) => {
    const box = body.querySelector('#pc-box');
    if (!box) return;
    const img = new Image();
    img.className = 'postcard-svg';
    img.alt = `Postal de ${d.nombre}`;
    img.src = URL.createObjectURL(blob);
    box.innerHTML = '';
    box.appendChild(img);
  }).catch(() => { /* se queda la vista en SVG */ });
  const download = async () => {
    try {
      const blob = await toPng(svg);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Postal descargada.', 'good', '📸');
    } catch {
      toast('No se pudo crear la imagen en este navegador.', 'bad');
    }
  };
  body.querySelector('[data-save]').addEventListener('click', download);
  body.querySelector('[data-share]').addEventListener('click', async () => {
    try {
      const blob = await toPng(svg);
      const f = new File([blob], file, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: `${d.nombre} en Dino Refugio`, text: `¡Mira a ${d.nombre}, mi ${SPECIES_BY_ID[d.especie].nombre}!` });
      } else {
        await download();
      }
    } catch (err) {
      if (err && err.name !== 'AbortError') toast('No se pudo compartir; prueba con Descargar.', 'bad');
    }
  });
  const back = body.querySelector('[data-back]');
  if (back) back.addEventListener('click', () => { closeSheet(); onBack(); });
}
