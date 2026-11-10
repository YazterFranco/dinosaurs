// Expediciones: salir, superar una etapa, toparse con un salvaje y volver.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
});

test('una expedición se juega de principio a fin y entrega el botín', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/index.html');
  await page.locator('.starter-egg[data-id="protoceratops"]').click();
  await page.evaluate(() => {
    const app = window.__dinoApp;
    app.state.huevos.forEach((e) => { e.progreso = e.duracion; });
    app.refresh();
  });
  await page.getByRole('button', { name: 'Eclosionar' }).click();
  await page.locator('#hatch-name').fill('Gaia');
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page).toHaveURL(/#\/parque/);
  // Las crías no salen: se avisa y no hay botón activo.
  await page.goto('/index.html#/expedicion');
  await expect(page.getByRole('heading', { name: 'Expediciones' })).toBeVisible();
  await expect(page.locator('[data-go]')).toHaveCount(0);
  await page.evaluate(() => {
    const app = window.__dinoApp;
    app.state.dinos.forEach((d) => { d.edad = 1e9; d.energia = 100; d.salud = 100; d.duermeHasta = 0; });
    app.state.inventario.comida.helechos = 5;
    app.refresh();
  });
  await page.locator('[data-go]').first().click();
  await expect(page.locator('.xp-path li.now')).toHaveCount(1);
  await expect(page.locator('[data-op]')).toHaveCount(3);
  await page.locator('[data-op]').first().click();
  // Tras el obstáculo llega el salvaje (o se acabó el aguante, que no pasa con 1 golpe).
  await expect(page.locator('[data-duel]')).toBeVisible();
  await page.locator('[data-tame]').click();
  await expect(page.locator('[data-food]').first()).toBeVisible();
  await page.locator('[data-back]').click();
  await page.locator('[data-duel]').click();
  await expect(page.locator('[data-move]')).toHaveCount(3);
  await page.locator('[data-move]').first().click();
  // Guardado: la expedición sigue ahí al recargar.
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator('.xp-scene')).toBeVisible();
  if (await page.locator('[data-retreat]').count()) await page.locator('[data-retreat]').click();
  await expect(page.locator('.xp-sum')).toBeVisible();
  await page.locator('[data-again]').click();
  await expect(page.getByRole('heading', { name: 'Expediciones' })).toBeVisible();
  expect(errors).toEqual([]);
});
