// El arte 3D: se usa cuando hay WebGL2 y se puede apagar en Ajustes.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
});

async function start(page) {
  await page.goto('/index.html');
  await page.locator('.starter-egg[data-id="protoceratops"]').click();
  await expect(page).toHaveURL(/#\/criadero/);
  await page.evaluate(() => {
    const app = window.__dinoApp;
    app.state.huevos.forEach((e) => { e.progreso = e.duracion; });
    app.refresh();
  });
  await page.getByRole('button', { name: 'Eclosionar' }).click();
  await page.locator('#hatch-name').fill('Gaia');
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page).toHaveURL(/#\/parque/);
}

const hasWebGL2 = (page) => page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
const softwareGL = (page) => page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return false;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
});

test('con WebGL2 el parque usa imágenes 3D y la ficha trae un visor que se gira', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Forzado: en las máquinas de pruebas WebGL suele ir por software (y lento).
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('dino-refugio-3d', 'on'));
  await start(page);
  test.skip(!(await hasWebGL2(page)), 'este navegador no tiene WebGL2');
  await expect(page.locator('.walker img.dino-img')).toHaveCount(1, { timeout: 25_000 });
  await page.locator('.dino-row').first().click();
  const viewer = page.locator('#dino-portrait canvas.dino-3d-canvas');
  await expect(viewer).toBeVisible({ timeout: 25_000 });
  await expect(viewer).toHaveAttribute('aria-label', /3D/);
  await viewer.focus();
  await page.keyboard.press('ArrowRight');
  const box = await viewer.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#dino-portrait .dino-3d-hint')).toHaveCount(0);
  // Botones del visor: rugir (avisa para el sonido) y caminar.
  const roared = page.evaluate(() => new Promise((res) => document.addEventListener('dino-roar', () => res(true), { once: true })));
  await page.locator('#dino-portrait .dino-3d-ctl button').first().click();
  expect(await roared).toBe(true);
  const walk = page.locator('#dino-portrait .dino-3d-ctl button[aria-pressed]');
  await walk.click();
  await expect(walk).toHaveAttribute('aria-pressed', 'true');
  await walk.click();
  expect(errors).toEqual([]);
});

test('con el 3D apagado se ve el dibujo y no se crea ningún visor', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dino-refugio-3d', 'off'));
  await start(page);
  await expect(page.locator('.walker svg.dino-svg')).toHaveCount(1);
  await page.locator('.dino-row').first().click();
  await expect(page.locator('#dino-portrait svg.dino-svg')).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.locator('img.dino-img')).toHaveCount(0);
  await expect(page.locator('canvas.dino-3d-canvas')).toHaveCount(0);
});

test('sin tarjeta gráfica, en automático, se usa el dibujo plano', async ({ page }) => {
  await start(page);
  test.skip(!(await softwareGL(page)), 'este navegador tiene aceleración gráfica');
  await expect(page.locator('.walker svg.dino-svg')).toHaveCount(1);
  await page.waitForTimeout(800);
  await expect(page.locator('img.dino-img')).toHaveCount(0);
  await page.goto('/index.html#/ajustes');
  await expect(page.locator('#d3')).not.toBeChecked();
  await expect(page.getByText('sin tarjeta gráfica')).toBeVisible();
});

test('el interruptor de 3D en Ajustes guarda la preferencia', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('d3')) { sessionStorage.setItem('d3', '1'); localStorage.setItem('dino-refugio-3d', 'on'); } });
  await start(page);
  await page.goto('/index.html#/ajustes');
  const toggle = page.locator('#d3');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dino-refugio-3d'))).toBe('off');
});

test('el visor muestra al animal en su hábitat y la postal sale con ese paisaje', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem('dino-refugio-3d', 'on'));
  await start(page);
  test.skip(!(await hasWebGL2(page)), 'este navegador no tiene WebGL2');
  await page.locator('.dino-row').first().click();
  const stage = page.locator('#dino-portrait .dino-3d.has-env');
  await expect(stage).toBeVisible({ timeout: 30_000 });
  // El escenario llena el lienzo: arriba hay cielo y abajo suelo (colores distintos).
  const px = await page.evaluate(() => new Promise((resolve) => {
    const c = document.querySelector('#dino-portrait canvas.dino-3d-canvas');
    // El lienzo WebGL se borra tras pintarse: se copia justo después de un cuadro.
    c.focus();
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const t = document.createElement('canvas');
      t.width = 40; t.height = 40;
      const g = t.getContext('2d');
      g.drawImage(c, 0, 0, 40, 40);
      const top = g.getImageData(20, 2, 1, 1).data; const bottom = g.getImageData(4, 37, 1, 1).data;
      resolve({ top: [...top], bottom: [...bottom] });
    }));
  }));
  // (Si el cuadro ya se había borrado, ambos píxeles vienen vacíos y no se compara.)
  if (px.top[3] > 0 && px.bottom[3] > 0) {
    const diff = Math.abs(px.top[0] - px.bottom[0]) + Math.abs(px.top[1] - px.bottom[1]) + Math.abs(px.top[2] - px.bottom[2]);
    expect(diff).toBeGreaterThan(12);
  }
  await page.locator('[data-photo]').click();
  await expect(page.locator('#pc-pose')).toBeVisible({ timeout: 40_000 });
  await expect(page.locator('#pc-box img.postcard-svg')).toBeVisible();
  expect(errors).toEqual([]);
});

test('con la calidad al mínimo el visor sigue funcionando sin escenario', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  test.setTimeout(120_000);
  await page.addInitScript(() => { localStorage.setItem('dino-refugio-3d', 'on'); localStorage.setItem('dino-refugio-calidad', '0'); });
  await start(page);
  test.skip(!(await hasWebGL2(page)), 'este navegador no tiene WebGL2');
  await page.locator('.dino-row').first().click();
  await expect(page.locator('#dino-portrait canvas.dino-3d-canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#dino-portrait .dino-3d.has-env')).toHaveCount(0);
  expect(errors).toEqual([]);
});
