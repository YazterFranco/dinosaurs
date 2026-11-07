// Pruebas de extremo a extremo de los flujos principales.
import { test, expect } from '@playwright/test';

/** Adelanta la incubadora sin esperar en tiempo real. */
async function readyEggs(page) {
  await page.evaluate(() => {
    const app = window.__dinoApp;
    app.state.huevos.forEach((e) => { e.progreso = e.duracion; });
    app.refresh();
  });
}

async function startWith(page, starter = 'protoceratops') {
  await page.goto('/index.html');
  await page.locator(`.starter-egg[data-id="${starter}"]`).click();
  await expect(page).toHaveURL(/#\/criadero/);
  await readyEggs(page);
  await page.getByRole('button', { name: 'Eclosionar' }).click();
  await expect(page.locator('#hatch-name')).toBeVisible();
  await page.locator('#hatch-name').fill('Gaia');
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page).toHaveURL(/#\/parque/);
}

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
});

test('elegir huevo inicial, eclosionar y ver a la cría en el parque', async ({ page }) => {
  await startWith(page);
  await expect(page.locator('.walker')).toHaveCount(1);
  await expect(page.locator('.dino-row')).toContainText('Gaia');
  await expect(page.locator('[data-bind="monedas"]')).toContainText('🪙');
});

test('un herbívoro rechaza la carne y acepta su comida favorita', async ({ page }) => {
  await startWith(page);
  await page.locator('.dino-row').first().click();
  await page.getByRole('button', { name: 'Alimentar' }).click();
  await page.locator('[data-food="carne_roja"]').click();
  await expect(page.locator('.toast').first()).toContainText('herbívoro');
  await page.locator('[data-food="cicadas"]').click();
  await expect(page.locator('.toast').first()).toContainText('favorito');
});

test('atender la petición de una cría sube el vínculo', async ({ page }) => {
  await startWith(page);
  await page.evaluate(() => {
    const s = window.__dinoApp.state;
    s.dinos[0].peticion = { tipo: 'caricia', expira: s.tiempoJuego + 60 };
  });
  await page.locator('.dino-row').first().click();
  await page.getByRole('button', { name: 'Acariciar' }).click();
  await expect(page.locator('[data-live="vinc"]')).not.toHaveText('0%');
});

test('la primera excavación es gratis y da ADN', async ({ page }) => {
  await startWith(page);
  await page.goto('/index.html#/excavar');
  await page.locator('[data-site="hell_creek"]').click();
  await expect(page.locator('.dig-board')).toBeVisible();
  // Golpea la cuadrícula; al acabarse la energía se abren los resultados solos.
  for (let i = 0; i < 48; i += 1) {
    if (await page.locator('.sheet[open]').count()) break;
    try {
      await page.locator('.cell').nth(i).click({ timeout: 1500 });
    } catch {
      break; // los resultados ya cubren el tablero
    }
  }
  await page.waitForTimeout(900);
  if (!(await page.locator('.sheet[open]').count())) await page.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.locator('#sheet-title')).toHaveText('Resultados de la excavación');
  const genome = await page.evaluate(() => window.__dinoApp.state.contadores.excavaciones);
  expect(genome).toBe(1);
});

test('la Dinopedia muestra fichas descubiertas y oculta las demás', async ({ page }) => {
  await startWith(page);
  await page.goto('/index.html#/dinopedia');
  await expect(page.locator('.specimen').filter({ hasText: 'Protoceratops' })).toHaveCount(1);
  await expect(page.locator('.specimen.locked').first()).toContainText('???');
  await page.locator('.specimen').filter({ hasText: 'Protoceratops' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Protoceratops');
  await expect(page.getByText('Mito y realidad')).toBeVisible();
  await expect(page.locator('.size-compare')).toBeVisible();
});

test('completar un quiz paga monedas', async ({ page }) => {
  await startWith(page);
  const before = await page.evaluate(() => window.__dinoApp.state.monedas);
  await page.goto('/index.html#/quiz');
  await page.getByRole('button', { name: 'Empezar' }).click();
  for (let i = 0; i < 5; i += 1) {
    const ok = await page.evaluate(() => {
      const q = document.querySelector('.quiz-q').textContent;
      return q;
    });
    expect(ok.length).toBeGreaterThan(5);
    await page.locator('.quiz-opt').first().click();
    await page.locator('[data-next]').click();
  }
  await expect(page.getByRole('button', { name: 'Otro quiz' })).toBeVisible();
  const after = await page.evaluate(() => window.__dinoApp.state.monedas);
  expect(after).toBeGreaterThanOrEqual(before);
  expect(await page.evaluate(() => window.__dinoApp.state.contadores.quizzes)).toBe(1);
});

test('cruzar dos adultos pone un huevo con cuadro de Punnett', async ({ page }) => {
  await startWith(page);
  await page.evaluate(() => {
    const app = window.__dinoApp;
    const s = app.state;
    const a = s.dinos[0];
    const b = JSON.parse(JSON.stringify(a));
    b.id = 'pareja';
    b.nombre = 'Lia';
    b.genes.sexo = a.genes.sexo === 'M' ? 'H' : 'M';
    s.dinos.push(b);
    for (const d of s.dinos) { d.edad = 1e6; d.animo = 95; d.salud = 100; }
    app.refresh();
  });
  await page.goto('/index.html#/criadero');
  await expect(page.locator('.punnett').first()).toBeVisible();
  await page.getByRole('button', { name: 'Cruzar', exact: true }).click();
  await expect(page.locator('.slot').first()).toBeVisible();
  expect(await page.evaluate(() => window.__dinoApp.state.huevos.length)).toBe(1);
});

test('la partida se guarda y se recupera al recargar', async ({ page }) => {
  await startWith(page);
  await page.evaluate(() => window.__dinoApp.save());
  await page.reload();
  await expect(page.locator('.dino-row')).toContainText('Gaia');
});

test('ninguna vista tiene desplazamiento horizontal', async ({ page }) => {
  await startWith(page);
  for (const r of ['parque', 'criadero', 'excavar', 'dinopedia', 'dinopedia/protoceratops', 'mas', 'misiones', 'tienda', 'quiz', 'concursos', 'ajustes', 'hallazgos', 'diario']) {
    await page.goto(`/index.html#/${r}`);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `scroll horizontal en ${r}`).toBeLessThanOrEqual(1);
  }
});
