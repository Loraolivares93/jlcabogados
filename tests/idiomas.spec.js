// El sitio es bilingüe con un diccionario en línea. Lo fácil es añadir texto en
// español y olvidar la clave en inglés: eso se detecta aquí.
const { test, expect } = require('@playwright/test');
const { abrir, cambiarIdioma } = require('./utiles');

test.describe('Idiomas', () => {

  test('@critico ninguna clave queda vacía al cambiar de idioma', async ({ page }) => {
    await abrir(page);
    for (const lang of ['en', 'es']) {
      await cambiarIdioma(page, lang);
      const vacias = await page.$$eval('[data-t]',
        ns => ns.filter(n => !(n.textContent || '').trim()).map(n => n.getAttribute('data-t')));
      expect(vacias, `Claves sin texto en ${lang.toUpperCase()}`).toEqual([]);
    }
  });

  test('@critico toda clave del HTML existe en ambos diccionarios', async ({ page }) => {
    await abrir(page);

    const enEspanol = await page.$$eval('[data-t]',
      ns => Object.fromEntries(ns.map(n => [n.getAttribute('data-t'), n.innerHTML.trim()])));
    await cambiarIdioma(page, 'en');
    const enIngles = await page.$$eval('[data-t]',
      ns => Object.fromEntries(ns.map(n => [n.getAttribute('data-t'), n.innerHTML.trim()])));

    // Si una clave no existe en el diccionario inglés, su texto no cambia.
    // Se exceptúan los valores que son legítimamente iguales en ambos idiomas.
    const IGUALES_A_PROPOSITO = new Set(['WhatsApp']);
    const sinTraducir = Object.keys(enEspanol).filter((k) => {
      const es = enEspanol[k], en = enIngles[k];
      if (es === undefined || en === undefined) return true;
      if (es !== en) return false;
      if (IGUALES_A_PROPOSITO.has(es)) return false;
      // Cadenas sin letras (números, fechas, símbolos) pueden coincidir.
      return /[a-záéíóúñ]{4,}/i.test(es);
    });
    expect(sinTraducir, 'Claves que no cambian al pasar a inglés').toEqual([]);
  });

  test('el atributo lang del documento acompaña al idioma elegido', async ({ page }) => {
    await abrir(page);
    for (const lang of ['en', 'es']) {
      await cambiarIdioma(page, lang);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      const activo = await page.getAttribute(`.idio button[data-lang="${lang}"]`, 'aria-pressed');
      expect(activo, `El botón ${lang.toUpperCase()} debe anunciarse como activo`).toBe('true');
    }
  });

  test('el idioma elegido sobrevive a recargar la página', async ({ page }) => {
    await abrir(page);
    await cambiarIdioma(page, 'en');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText(/since \d{4}/i);
  });

  test('@critico sin scroll horizontal también en inglés', async ({ page }) => {
    // El inglés tiene palabras más largas en algunos rótulos.
    for (const ancho of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await abrir(page);
      await cambiarIdioma(page, 'en');
      const desborde = await page.evaluate(() =>
        Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      expect(desborde, `Desborda ${desborde}px en inglés a ${ancho}px`).toBeLessThanOrEqual(1);
    }
  });
});
