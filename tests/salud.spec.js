// Salud general: errores de consola, recursos que no cargan y metadatos.
const { test, expect } = require('@playwright/test');
const { abrir, cambiarIdioma } = require('./utiles');

test.describe('Salud', () => {

  test('@critico la página carga sin errores de consola ni recursos rotos', async ({ page }) => {
    const errores = [];
    const rotos = [];
    page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('pageerror', e => errores.push('excepción: ' + e.message));
    page.on('requestfailed', r => rotos.push(`${r.url()} — ${r.failure()?.errorText}`));
    page.on('response', r => { if (r.status() >= 400) rotos.push(`${r.status()} ${r.url()}`); });

    await abrir(page);
    await cambiarIdioma(page, 'en');
    await cambiarIdioma(page, 'es');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);

    expect(errores, 'Errores de JavaScript en consola').toEqual([]);
    expect(rotos, 'Recursos que no cargan').toEqual([]);
  });

  test('@critico los datos estructurados son JSON válido y coherentes', async ({ page }) => {
    await abrir(page);
    const ld = await page.$$eval('script[type="application/ld+json"]', ns => ns.map(n => n.textContent));
    expect(ld.length, 'Falta el bloque JSON-LD').toBeGreaterThan(0);

    for (const bruto of ld) {
      let datos;
      expect(() => { datos = JSON.parse(bruto); }, 'JSON-LD inválido').not.toThrow();
      expect(datos['@type']).toBeTruthy();
      // El año de fundación del JSON-LD debe coincidir con el que se muestra.
      if (datos.foundingDate) {
        const cuerpo = await page.textContent('body');
        expect(cuerpo,
          `El JSON-LD dice ${datos.foundingDate} pero ese año no aparece en la página`
        ).toContain(String(datos.foundingDate));
      }
      if (datos.telephone) {
        const limpio = datos.telephone.replace(/\D/g, '');
        const enlaces = await page.$$eval('a[href^="tel:"]',
          as => as.map(a => a.getAttribute('href').replace(/\D/g, '')));
        expect(enlaces, 'El teléfono del JSON-LD no coincide con ningún enlace tel:').toContain(limpio);
      }
    }
  });

  test('los metadatos mínimos están presentes', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
    const desc = await page.getAttribute('meta[name="description"]', 'content');
    expect(desc.length, 'La descripción debe tener cuerpo suficiente').toBeGreaterThan(60);
    expect(desc.length, 'La descripción se corta en buscadores si pasa de ~160').toBeLessThan(200);
    await expect(page.locator('title')).not.toBeEmpty();
  });

  test('las tipografías del sitio cargan de verdad', async ({ page }) => {
    // Si Google Fonts falla, el sitio cae a Arial y el diseño cambia de anchos.
    await abrir(page);
    const cargadas = await page.evaluate(() =>
      ['Archivo', 'Barlow'].filter(f => document.fonts.check(`16px "${f}"`)));
    expect(cargadas, 'Ninguna de las tipografías del sitio llegó a cargar').not.toEqual([]);
  });

  test('la página 404 existe y devuelve contenido', async ({ page }) => {
    const r = await page.goto('/404.html');
    expect(r.status()).toBeLessThan(400);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('el año del pie se mantiene al día solo', async ({ page }) => {
    await abrir(page);
    const anio = page.locator('#year');
    test.skip(!(await anio.count()), 'Esta versión no muestra el año en el pie');
    await expect(anio).toHaveText(String(new Date().getFullYear()));
  });
});
