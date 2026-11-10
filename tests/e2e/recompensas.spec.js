// Pruebas E2E de recompensas: racha diaria, cofres, taquilla y energía.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
});

async function startWith(page) {
  await page.goto('/index.html');
  await page.locator('.starter-egg[data-id="oviraptor"]').click();
  await page.evaluate(() => {
    const app = window.__dinoApp;
    app.state.huevos.forEach((e) => { e.progreso = e.duracion; });
    app.refresh();
  });
  await page.getByRole('button', { name: 'Eclosionar' }).click();
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page).toHaveURL(/#\/parque/);
}

test('el regalo diario aparece al volver y suma racha', async ({ page }) => {
  await startWith(page);
  await page.evaluate(() => window.__dinoApp.save());
  await page.reload();
  await expect(page.locator('#sheet-title')).toHaveText('¡Tu regalo de hoy!');
  await page.getByRole('button', { name: 'Reclamar regalo' }).click();
  await expect(page.locator('.loot-item').first()).toBeVisible();
  expect(await page.evaluate(() => window.__dinoApp.state.recompensas.diaria.racha)).toBe(1);
});

test('el envío gratis abre un cofre con premios', async ({ page }) => {
  await startWith(page);
  await page.goto('/index.html#/recompensas');
  await page.getByRole('button', { name: 'Recibir' }).click();
  await page.locator('#chest-tap').click({ force: true });
  await expect(page.locator('.loot-item')).toHaveCount(2, { timeout: 4000 });
  expect(await page.evaluate(() => window.__dinoApp.state.contadores.cofresAbiertos)).toBe(1);
});

test('la taquilla guarda las monedas de los visitantes hasta cobrarlas', async ({ page }) => {
  await startWith(page);
  await page.evaluate(() => { window.__dinoApp.state.recompensas.taquilla = 75; window.__dinoApp.refresh(); });
  const before = await page.evaluate(() => window.__dinoApp.state.monedas);
  await page.locator('#booth').click();
  const after = await page.evaluate(() => window.__dinoApp.state.monedas);
  expect(after - before).toBeGreaterThanOrEqual(75);
});

test('excavar (después de la primera) gasta energía de expedición', async ({ page }) => {
  await startWith(page);
  await page.evaluate(() => { window.__dinoApp.state.contadores.excavaciones = 1; });
  await page.goto('/index.html#/excavar');
  await page.locator('[data-site="hell_creek"]').click();
  await expect(page.locator('.dig-board')).toBeVisible();
  expect(await page.evaluate(() => window.__dinoApp.state.recompensas.energia.valor)).toBe(4);
});

test('recoger un regalo de un dinosaurio', async ({ page }) => {
  await startWith(page);
  await page.evaluate(() => {
    const s = window.__dinoApp.state;
    s.recompensas.regalos.push({ id: 'rgtest', tipo: 'pluma', recinto: s.recintos[0].id, especie: 'oviraptor', x: 0.5, y: 0.85 });
    window.__dinoApp.refresh();
  });
  await page.locator('[data-gift="rgtest"]').click({ force: true });
  expect(await page.evaluate(() => window.__dinoApp.state.contadores.regalos)).toBe(1);
});
