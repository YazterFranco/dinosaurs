// Instalar el juego como app (PWA): botón nativo en Android/escritorio e
// instrucciones paso a paso en iPhone/iPad, donde no hay botón automático.
import { openSheet, closeSheet, toast } from './dom.js';

// Dirección pública del juego (GitHub Pages). Desde ahí se instala como app.
export const PUBLIC_URL = 'https://yazterfranco.github.io/dinosaurs/';

let deferred = null;
const listeners = new Set();

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canOfferInstall() {
  return !isStandalone();
}

export function onInstallChange(fn) { listeners.add(fn); }

export function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    toast('¡Dino Refugio quedó instalado como app!', 'gold', '📲');
    listeners.forEach((fn) => fn());
  });
}

export async function install() {
  if (deferred) {
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    deferred = null;
    if (choice && choice.outcome === 'accepted') return;
  }
  showInstructions();
}

function isFramed() {
  try { return window.self !== window.top; } catch { return true; }
}

function showInstructions() {
  if (isFramed() || !('serviceWorker' in navigator)) {
    const body = openSheet('Instalar como app', `
      <p>Esta vista previa no se puede instalar. Para tener Dino Refugio como app, abre su página pública en el navegador del celular:</p>
      <p class="url-box"><code id="pub-url">${PUBLIC_URL}</code></p>
      <div class="sheet-actions"><button class="btn btn-amber" type="button" data-copy>Copiar dirección</button><a class="btn btn-ghost" href="${PUBLIC_URL}" target="_blank" rel="noopener">Abrir</a></div>
      <p class="small muted" style="margin-top:10px">Allí verás la opción <b>Instalar app</b> (Android) o <b>Compartir → Agregar a inicio</b> (iPhone). Tu partida de aquí no se pasa sola: usa el código de guardado en Ajustes.</p>`);
    body.querySelector('[data-copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(PUBLIC_URL); toast('Dirección copiada.', 'good', '📋'); } catch {
        const r = document.createRange();
        r.selectNodeContents(body.querySelector('#pub-url'));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        toast('Selecciona la dirección y cópiala.', '');
      }
    });
    return;
  }
  const ios = isIOS();
  const https = location.protocol === 'https:' || location.hostname === 'localhost';
  const body = openSheet('Instalar como app', `
    <p>Dino Refugio se puede instalar en tu pantalla de inicio. Se abre a pantalla completa como cualquier app y funciona sin internet.</p>
    ${https ? '' : '<p class="small" style="margin-top:8px">⚠️ Para instalarlo, ábrelo desde su dirección web segura (https), por ejemplo la de GitHub Pages.</p>'}
    <ol class="steps">
      ${ios ? `<li>Abre esta página en <b>Safari</b>.</li>
        <li>Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>
        <li>Elige <b>Agregar a inicio</b> y confirma con <b>Agregar</b>.</li>`
      : `<li>Abre esta página en <b>Chrome</b> o <b>Edge</b>.</li>
        <li>Toca el menú <b>⋮</b> (arriba a la derecha).</li>
        <li>Elige <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</li>`}
    </ol>
    <p class="small muted" style="margin-top:10px">Tu partida se guarda en el dispositivo. Para pasarla entre el navegador y la app, usa el código de guardado en Ajustes.</p>
    <div class="sheet-actions"><button class="btn" type="button" data-ok>Entendido</button></div>`);
  body.querySelector('[data-ok]').addEventListener('click', closeSheet);
}
