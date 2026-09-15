// Espaciado y diseño responsivo.
// Aquí vivía el bug del 15·09·2026: a 320px "info@jlcabogados.com" no cabía en
// su columna y empujaba la página 6px, creando scroll horizontal en toda la web.
const { test, expect } = require('@playwright/test');
const { abrir, ANCHOS_CLAVE, desbordeHorizontal, culpablesDeDesborde } = require('./utiles');

test.describe('Espaciado', () => {

  // El scroll horizontal es siempre un defecto: se comprueba ancho por ancho,
  // incluidos los bordes exactos de cada media query.
  for (const ancho of ANCHOS_CLAVE) {
    test(`@critico sin scroll horizontal a ${ancho}px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await abrir(page);
      const desborde = await desbordeHorizontal(page);
      if (desborde > 1) {
        const culpables = await culpablesDeDesborde(page);
        expect(desborde, `Desborda ${desborde}px.\n  ${culpables.join('\n  ')}`).toBeLessThanOrEqual(1);
      }
      expect(desborde).toBeLessThanOrEqual(1);
    });
  }

  test('@critico el selector de idioma es alcanzable en cualquier ancho', async ({ page }) => {
    const inalcanzables = [];
    for (const ancho of ANCHOS_CLAVE) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await abrir(page);
      const visible = await page.evaluate(() =>
        [...document.querySelectorAll('.idio button')].some((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }));
      if (!visible) inalcanzables.push(ancho);
    }
    expect(inalcanzables, 'Anchos donde ES/EN desaparece').toEqual([]);
  });

  test('las áreas táctiles llegan al mínimo de 24×24px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await abrir(page);
    const pequenos = await page.evaluate(() => {
      const malos = [];
      document.querySelectorAll('a, button').forEach((n) => {
        if (n.getAttribute('aria-hidden') === 'true') return;
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.height < 24 || r.width < 24) {
          const t = (n.textContent || n.getAttribute('aria-label') || '').trim().slice(0, 30);
          malos.push(`"${t}" mide ${Math.round(r.width)}×${Math.round(r.height)}px`);
        }
      });
      return malos;
    });
    expect(pequenos).toEqual([]);
  });

  test('ningún texto queda recortado por su contenedor', async ({ page }) => {
    await abrir(page);
    const recortados = await page.evaluate(() => {
      const malos = [];
      document.querySelectorAll('h1, h2, h3, p, dd, dt, li, a, button').forEach((n) => {
        const e = getComputedStyle(n);
        if (e.overflow === 'visible' || e.overflow === '') return;
        if (n.scrollHeight > n.clientHeight + 2 && e.overflowY === 'hidden') {
          malos.push(`"${(n.textContent || '').trim().slice(0, 35)}" recortado verticalmente`);
        }
      });
      return malos.slice(0, 10);
    });
    expect(recortados).toEqual([]);
  });

  test('el panel móvil abre y cierra', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await abrir(page);
    const abrirBtn = page.locator('[aria-controls="panel"], .hamb, .menu-btn').first();
    test.skip(!(await abrirBtn.count()), 'Esta plantilla no expone botón de panel');
    await abrirBtn.click();
    await expect(page.locator('#panel')).toBeVisible();
    const desborde = await desbordeHorizontal(page);
    expect(desborde, 'El panel abierto no debe generar scroll horizontal').toBeLessThanOrEqual(1);
  });
});
