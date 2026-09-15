// Enlaces: que todos lleven a donde dicen.
// Aquí vivía el bug del 15·09·2026: <symbol id="firma"> ocupaba el mismo id que
// <section id="firma">, así que el enlace "La firma" del menú no hacía nada.
const { test, expect } = require('@playwright/test');
const { abrir, SECCIONES, ALTO_CABECERA } = require('./utiles');

test.describe('Enlaces', () => {

  test('@critico no hay ids duplicados en el documento', async ({ page }) => {
    await abrir(page);
    const duplicados = await page.evaluate(() => {
      const vistos = new Map(), dup = [];
      document.querySelectorAll('[id]').forEach((n) => {
        if (vistos.has(n.id)) dup.push(`${n.id}: <${vistos.get(n.id)}> y <${n.tagName.toLowerCase()}>`);
        else vistos.set(n.id, n.tagName.toLowerCase());
      });
      return dup;
    });
    expect(duplicados,
      'Un id repetido rompe los enlaces internos: el navegador salta siempre al primero'
    ).toEqual([]);
  });

  test('@critico todo enlace interno apunta a un destino real y alcanzable', async ({ page }) => {
    await abrir(page);
    const rotos = await page.evaluate(() => {
      const malos = [];
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        const href = a.getAttribute('href');
        const texto = (a.textContent || '').trim().slice(0, 30) || href;
        if (href.length < 2) { malos.push(`"${texto}" tiene href vacío`); return; }
        const destino = document.getElementById(decodeURIComponent(href.slice(1)));
        if (!destino) { malos.push(`"${texto}" apunta a ${href}, que no existe`); return; }
        if (destino.closest('defs, symbol')) {
          malos.push(`"${texto}" apunta a ${href}, que está dentro de <defs>/<symbol> y no es desplazable`);
          return;
        }
        const r = destino.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) malos.push(`"${texto}" apunta a ${href}, que no tiene dimensiones`);
      });
      return malos;
    });
    expect(rotos).toEqual([]);
  });

  for (const seccion of SECCIONES) {
    test(`@critico el menú lleva de verdad a #${seccion}`, async ({ page }, testInfo) => {
      await abrir(page);
      const enlace = page.locator(`.nav-bot .menu a[href="#${seccion}"]`).first();
      if (!(await enlace.count()) || !(await enlace.isVisible())) {
        test.skip(true, `El enlace a #${seccion} no está visible en ${testInfo.project.name}`);
      }
      await enlace.click();
      await page.waitForTimeout(400);

      const r = await page.evaluate((id) => {
        const s = document.getElementById(id);
        return { scrollY: window.scrollY, top: s.getBoundingClientRect().top };
      }, seccion);

      expect(r.scrollY, `Al pulsar "${seccion}" la página no se movió`).toBeGreaterThan(5);

      // El inicio de la sección no puede quedar tapado por la cabecera pegajosa.
      const ancho = page.viewportSize().width;
      expect(r.top,
        `La sección #${seccion} queda por debajo de la cabecera fija (${ALTO_CABECERA(ancho)}px)`
      ).toBeGreaterThanOrEqual(-2);
    });
  }

  test('@critico en móvil el panel navega a todas las secciones', async ({ page }) => {
    // En móvil el menú del encabezado está oculto y se navega por el panel,
    // así que los casos de arriba se omiten ahí. Esta es su cobertura.
    await page.setViewportSize({ width: 390, height: 840 });
    await abrir(page);

    for (const seccion of SECCIONES) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.click('.btn-indice');
      await page.locator('#panel').waitFor({ state: 'visible' });

      const enlace = page.locator(`#panel a[href="#${seccion}"]`).first();
      expect(await enlace.count(), `El panel no ofrece #${seccion}`).toBeGreaterThan(0);
      await enlace.click();
      await page.waitForTimeout(400);

      const r = await page.evaluate((id) => {
        const s = document.getElementById(id);
        return { scrollY: window.scrollY, top: s.getBoundingClientRect().top };
      }, seccion);

      expect(r.scrollY, `En móvil, "${seccion}" no desplaza la página`).toBeGreaterThan(5);
      expect(r.top, `En móvil, #${seccion} queda tapado por la cabecera`).toBeGreaterThanOrEqual(-2);
      await expect(page.locator('#panel'), 'El panel debe cerrarse al navegar').toBeHidden();
    }
  });

  test('@critico los enlaces del pie también funcionan', async ({ page }) => {
    await abrir(page);
    const rotos = await page.evaluate(() => {
      const malos = [];
      document.querySelectorAll('.pie a[href^="#"]').forEach((a) => {
        const id = a.getAttribute('href').slice(1);
        const d = document.getElementById(id);
        if (!d || d.closest('defs, symbol')) malos.push(`Pie: "${a.textContent.trim()}" → #${id}`);
      });
      return malos;
    });
    expect(rotos).toEqual([]);
  });

  test('todo enlace que abre pestaña nueva lleva rel="noopener"', async ({ page }) => {
    await abrir(page);
    const inseguros = await page.$$eval('a[target="_blank"]',
      as => as.filter(a => !(a.getAttribute('rel') || '').includes('noopener'))
              .map(a => a.getAttribute('href')));
    expect(inseguros).toEqual([]);
  });

  test('los enlaces tel: y mailto: están bien formados', async ({ page }) => {
    await abrir(page);
    const malos = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
        const h = a.getAttribute('href');
        if (!/^tel:\+[1-9]\d{7,14}$/.test(h)) out.push(`tel mal formado: ${h}`);
      });
      document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
        const h = a.getAttribute('href');
        // Se admite un asunto prellenado: mailto:...?subject=...
        if (!/^mailto:[^@\s?]+@[^@\s?]+\.[a-z]{2,}(\?\S*)?$/i.test(h)) out.push(`mailto mal formado: ${h}`);
      });
      return out;
    });
    expect(malos).toEqual([]);
  });

  test('ningún enlace queda sin texto accesible', async ({ page }) => {
    await abrir(page);
    const mudos = await page.evaluate(() =>
      [...document.querySelectorAll('a')]
        .filter(a => a.getAttribute('aria-hidden') !== 'true')
        .filter(a => !(a.textContent || '').trim()
                  && !a.getAttribute('aria-label')
                  && !a.querySelector('[aria-label], title'))
        .map(a => a.getAttribute('href')));
    expect(mudos).toEqual([]);
  });
});
