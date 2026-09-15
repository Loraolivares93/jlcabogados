// Accesibilidad. El contraste se calcula con la fórmula de WCAG 2.1 sobre el
// color realmente pintado, no sobre el que dice la hoja de estilos.
const { test, expect } = require('@playwright/test');
const { abrir } = require('./utiles');

// Relación de contraste según WCAG 2.1
const FORMULA_CONTRASTE = `
  function aLineal(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function luminancia(rgb) { return 0.2126 * aLineal(rgb[0]) + 0.7152 * aLineal(rgb[1]) + 0.0722 * aLineal(rgb[2]); }
  function aRGB(s) { const m = s.match(/\\d+(\\.\\d+)?/g); return m ? m.slice(0, 3).map(Number) : null; }
  function fondoReal(n) {
    // Sube por los ancestros hasta encontrar un fondo opaco. Hay que mirar
    // también background-image: la portada y el cierre pintan su color con un
    // degradado, y ahí backgroundColor vale rgba(0,0,0,0). Si solo se mirase
    // backgroundColor se llegaría al blanco del body y saldría texto blanco
    // sobre blanco, 1:1, que es un falso positivo.
    let e = n;
    while (e && e !== document.documentElement) {
      const s = getComputedStyle(e);
      const c = s.backgroundColor;
      const rgb = aRGB(c);
      const alfa = c.startsWith('rgba') ? parseFloat(c.split(',')[3]) : 1;
      if (rgb && alfa > 0.9) return rgb;
      if (s.backgroundImage && s.backgroundImage !== 'none') {
        // Sin expresiones regulares: este bloque viaja dentro de una plantilla
        // de texto y las barras invertidas se perderían por el camino.
        const img = s.backgroundImage;
        const i = img.indexOf('rgb');
        if (i >= 0) {
          const desde = img.slice(i);
          const v = desde.slice(desde.indexOf('(') + 1, desde.indexOf(')')).split(',').map(Number);
          if (v.length >= 3 && (v.length < 4 || v[3] > 0.9)) return v.slice(0, 3);
        }
      }
      e = e.parentElement;
    }
    return [255, 255, 255];
  }
  function contraste(n) {
    const frente = aRGB(getComputedStyle(n).color);
    const fondo = fondoReal(n);
    if (!frente) return null;
    const l1 = luminancia(frente), l2 = luminancia(fondo);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
`;

test.describe('Accesibilidad', () => {

  test('@critico el contraste del texto cumple WCAG AA', async ({ page }) => {
    await abrir(page);
    const fallos = await page.evaluate(`(() => {
      ${FORMULA_CONTRASTE}
      const malos = [];
      document.querySelectorAll('p, a, h1, h2, h3, h4, dt, dd, span, b, li, button').forEach((n) => {
        const texto = (n.textContent || '').trim();
        if (!texto || n.children.length > 0) return;
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const e = getComputedStyle(n);
        if (e.visibility === 'hidden' || e.opacity === '0') return;
        const px = parseFloat(e.fontSize);
        const negrita = parseInt(e.fontWeight, 10) >= 700;
        // Texto grande: >=24px, o >=18.66px en negrita.
        const esGrande = px >= 24 || (negrita && px >= 18.66);
        const minimo = esGrande ? 3.0 : 4.5;
        const c = contraste(n);
        if (c !== null && c < minimo - 0.02) {
          malos.push(texto.slice(0, 32) + ' → ' + c.toFixed(2) + ':1 (mínimo ' + minimo + ':1, ' + e.fontSize + ')');
        }
      });
      return [...new Set(malos)].slice(0, 12);
    })()`);
    expect(fallos).toEqual([]);
  });

  test('@critico existe un solo h1 y los encabezados no saltan niveles', async ({ page }) => {
    await abrir(page);
    const r = await page.evaluate(() => {
      const niveles = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({
        n: +h.tagName[1], t: (h.textContent || '').trim().slice(0, 35),
      }));
      const saltos = [];
      niveles.forEach((h, i) => {
        if (i > 0 && h.n - niveles[i - 1].n > 1) {
          saltos.push(`h${niveles[i - 1].n} "${niveles[i - 1].t}" → h${h.n} "${h.t}"`);
        }
      });
      return { h1: niveles.filter(x => x.n === 1).length, saltos };
    });
    expect(r.h1, 'Debe haber exactamente un <h1>').toBe(1);
    expect(r.saltos, 'Saltos de nivel en los encabezados').toEqual([]);
  });

  test('el enlace "saltar al contenido" aparece al tabular y funciona', async ({ page }) => {
    await abrir(page);
    await page.keyboard.press('Tab');
    const saltar = page.locator('.saltar');
    test.skip(!(await saltar.count()), 'Esta versión no tiene enlace de salto');
    await expect(saltar).toBeFocused();
    const visible = await saltar.evaluate((n) => {
      const r = n.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.width > 0;
    });
    expect(visible, 'Al recibir el foco debe hacerse visible').toBe(true);
  });

  test('todo control tiene nombre accesible', async ({ page }) => {
    await abrir(page);
    const mudos = await page.evaluate(() => {
      const malos = [];
      document.querySelectorAll('button, [role="button"]').forEach((n) => {
        if (n.getAttribute('aria-hidden') === 'true') return;
        if (!(n.textContent || '').trim() && !n.getAttribute('aria-label') && !n.getAttribute('title')) {
          malos.push(n.outerHTML.slice(0, 70));
        }
      });
      document.querySelectorAll('svg[role="img"]').forEach((n) => {
        if (!n.getAttribute('aria-label') && !n.querySelector('title')) {
          malos.push('svg sin nombre: ' + (n.getAttribute('class') || ''));
        }
      });
      document.querySelectorAll('img').forEach((n) => {
        if (!n.hasAttribute('alt')) malos.push('img sin alt: ' + n.src.slice(0, 50));
      });
      return malos;
    });
    expect(mudos).toEqual([]);
  });

  test('se puede recorrer la navegación solo con el teclado', async ({ page }) => {
    await abrir(page);
    const alcanzados = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const r = a.getBoundingClientRect();
        const e = getComputedStyle(a);
        return {
          etiqueta: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 25),
          conFoco: e.outlineStyle !== 'none' || e.boxShadow !== 'none' || r.top >= 0,
        };
      });
      if (info) alcanzados.push(info);
    }
    expect(alcanzados.length, 'El tabulador debe recorrer los enlaces del sitio').toBeGreaterThan(5);
    expect(alcanzados.every(a => a.conFoco), 'Todo elemento enfocado debe ser perceptible').toBe(true);
  });
});
