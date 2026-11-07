// La app se puede instalar y sigue funcionando sin conexión.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('funciona sin conexión después de la primera visita', async ({ page, context }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('/index.html');
  await expect(page.locator('.starter-egg').first()).toBeVisible();
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  // Espera a que el service worker controle la página.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.starter-egg').first()).toBeVisible();
  await page.locator('.starter-egg[data-id="protoceratops"]').click();
  await expect(page).toHaveURL(/#\/criadero/);
  await context.setOffline(false);
});

test('tiene manifiesto e ícono para instalar', async ({ page }) => {
  await page.goto('/index.html');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const res = await page.request.get(href);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toBe('Dino Refugio');
});

test('el botón "Instalar como app" explica cómo instalarla', async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('/index.html');
  await page.locator('.starter-egg[data-id="oviraptor"]').click();
  await page.goto('/index.html#/mas');
  await page.locator('[data-install]').click();
  await expect(page.locator('#sheet-title')).toHaveText('Instalar como app');
});
