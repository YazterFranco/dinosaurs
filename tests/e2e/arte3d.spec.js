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
  // Forzado: en las máquinas de pruebas WebGL suele ir por software.
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
