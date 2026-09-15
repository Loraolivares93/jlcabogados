// Contacto: es la vía por la que entra el cliente. Nada aquí puede fallar en silencio.
const { test, expect } = require('@playwright/test');
const { abrir, cambiarIdioma, CONTACTO } = require('./utiles');

test.describe('Contacto', () => {

  test('@critico la sección existe y se alcanza desde cualquier llamada a la acción', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#contacto')).toHaveCount(1);

    const ctas = page.locator('a[href="#contacto"]');
    const total = await ctas.count();
    expect(total, 'Debe haber al menos una llamada a la acción hacia contacto').toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      const cta = ctas.nth(i);
      if (!(await cta.isVisible())) continue;
      await page.evaluate(() => window.scrollTo(0, 0));
      await cta.click();
      await page.waitForTimeout(350);
      const y = await page.evaluate(() => window.scrollY);
      expect(y, `La llamada a la acción nº${i + 1} no lleva a contacto`).toBeGreaterThan(5);
    }
  });

  test('@critico el texto visible coincide con el destino del enlace', async ({ page }) => {
    await abrir(page);
    const discrepancias = await page.evaluate(() => {
      const soloDigitos = (s) => (s || '').replace(/\D/g, '');
      const malos = [];
      document.querySelectorAll('a[href^="tel:"], a[href*="wa.me"]').forEach((a) => {
        const texto = soloDigitos(a.textContent);
        const destino = soloDigitos(a.getAttribute('href'));
        // El texto puede omitir el código de país; el destino debe terminar en él.
        if (texto && !destino.endsWith(texto)) {
          malos.push(`"${a.textContent.trim()}" enlaza a ${a.getAttribute('href')}`);
        }
      });
      document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
        const texto = a.textContent.trim().toLowerCase();
        const destino = a.getAttribute('href').slice(7).toLowerCase();
        if (texto.includes('@') && texto !== destino) {
          malos.push(`"${a.textContent.trim()}" enlaza a ${a.getAttribute('href')}`);
        }
      });
      return malos;
    });
    expect(discrepancias,
      'Un número o correo que se ve distinto del que marca es un cliente perdido'
    ).toEqual([]);
  });

  test('@regresion los datos de contacto no han cambiado', async ({ page }) => {
    await abrir(page);
    const seccion = page.locator('#contacto');

    await expect(seccion.getByText(CONTACTO.telefono.texto, { exact: false }).first()).toBeVisible();
    await expect(seccion.locator(`a[href="${CONTACTO.telefono.href}"]`).first()).toHaveCount(1);

    await expect(seccion.getByText(CONTACTO.whatsapp.texto, { exact: false }).first()).toBeVisible();
    await expect(seccion.locator(`a[href="${CONTACTO.whatsapp.href}"]`).first()).toHaveCount(1);

    await expect(seccion.locator(`a[href="${CONTACTO.correo.href}"]`).first()).toHaveCount(1);
    await expect(seccion.getByText(CONTACTO.direccion, { exact: false }).first()).toBeVisible();
  });

  // El cierre es la última llamada a la acción de la página. Antes ofrecía solo
  // mailto: y tel:, que en un ordenador sin cliente de correo ni marcador no
  // abren nada: el visitante pulsaba y no pasaba nada.
  test.describe('Cierre "Cuéntenos su caso"', () => {

    test('@critico ofrece una vía que funciona en cualquier equipo', async ({ page }) => {
      await abrir(page);
      const wa = page.locator('.cierre a[href*="wa.me"]');
      await expect(wa, 'WhatsApp es la única vía que no depende de apps instaladas').toHaveCount(1);
      await expect(wa).toBeVisible();
      await expect(wa).toHaveAttribute('target', '_blank');
      await expect(wa).toHaveAttribute('rel', /noopener/);
    });

    test('@critico las tres vías apuntan a los datos correctos', async ({ page }) => {
      await abrir(page);
      const destinos = await page.$$eval('.cierre .acciones a',
        as => as.map(a => a.getAttribute('href')));
      expect(destinos.some(h => h.includes('wa.me/18297077773')), 'falta WhatsApp').toBe(true);
      expect(destinos.some(h => h.startsWith('mailto:info@jlcabogados.com')), 'falta el correo').toBe(true);
      expect(destinos.some(h => h === 'tel:+18095664065'), 'falta el teléfono').toBe(true);
    });

    test('@critico copia el dato al portapapeles como respaldo', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
      await abrir(page);

      const correo = page.locator('.cierre a[data-copiar]').first();
      const esperado = await correo.getAttribute('data-copiar');

      // Se evita que el navegador intente abrir mailto:/tel:, que en las pruebas
      // no lleva a ninguna parte; lo que se comprueba es el respaldo.
      await page.evaluate(() => {
        document.querySelectorAll('.cierre a[data-copiar]')
          .forEach(a => a.addEventListener('click', e => e.preventDefault()));
      });
      await correo.click();

      const copiado = await page.evaluate(() => navigator.clipboard.readText());
      expect(copiado, 'Si no se abre el cliente de correo, al menos queda copiado').toBe(esperado);

      // El aviso aparece medio segundo después, solo si no se abrió ninguna app.
      await expect(page.locator('.aviso-copia')).toContainText(esperado, { timeout: 4000 });
    });

    test('el aviso de copiado se anuncia y respeta el idioma', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
      await abrir(page);
      const aviso = page.locator('.aviso-copia');
      await expect(aviso).toHaveAttribute('role', 'status');
      await expect(aviso).toHaveAttribute('aria-live', 'polite');

      await cambiarIdioma(page, 'en');
      await page.evaluate(() => {
        document.querySelectorAll('.cierre a[data-copiar]')
          .forEach(a => a.addEventListener('click', e => e.preventDefault()));
      });
      await page.locator('.cierre a[data-copiar]').first().click();
      await expect(aviso).toContainText(/copied/i, { timeout: 4000 });
    });
  });

  test('el enlace al mapa apunta a las coordenadas de la oficina', async ({ page }) => {
    await abrir(page);
    const mapa = page.locator('#contacto a.mapa, #contacto a[href*="google.com/maps"]').first();
    await expect(mapa).toHaveCount(1);
    const href = await mapa.getAttribute('href');
    expect(href).toContain('18.459');
    expect(href).toContain('-69.954');
  });

  test('@regresion los años en ejercicio se calculan solos y cuadran', async ({ page }) => {
    await abrir(page);
    const esperado = String(new Date().getFullYear() - CONTACTO.anioInicio);
    const mostrados = await page.$$eval('.anios', ns => ns.map(n => n.textContent.trim()));
    expect(mostrados.length, 'Debe existir al menos un contador de años').toBeGreaterThan(0);
    for (const v of mostrados) {
      expect(v, `El contador muestra ${v} y debería ser ${esperado} (año actual − ${CONTACTO.anioInicio})`).toBe(esperado);
    }
    // El año de inicio debe aparecer escrito junto al contador.
    const cuerpo = await page.textContent('body');
    expect(cuerpo).toContain(String(CONTACTO.anioInicio));
  });
});
