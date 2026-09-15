// Auditoría exploratoria de jlcabogados.com.
// Barre el sitio en varios anchos y reporta hallazgos con severidad.
// Uso: node auditoria.mjs [url]
import { chromium } from '@playwright/test';

const URL = process.argv[2] || 'http://127.0.0.1:8080/';
const ANCHOS = [320, 360, 375, 414, 480, 560, 620, 681, 768, 820, 900, 1024, 1280, 1440, 1920];
const ALTO_CABECERA = 56; // .nav-bot pegajosa

const hallazgos = [];
const anota = (sev, area, detalle) => hallazgos.push({ sev, area, detalle });

const navegador = await chromium.launch();
const ctx = await navegador.newContext();
const pag = await ctx.newPage();

const erroresConsola = [];
const fallosRed = [];
pag.on('console', m => { if (m.type() === 'error') erroresConsola.push(m.text()); });
pag.on('pageerror', e => erroresConsola.push('pageerror: ' + e.message));
pag.on('response', r => { if (r.status() >= 400) fallosRed.push(`${r.status()} ${r.url()}`); });

await pag.setViewportSize({ width: 1280, height: 900 });
await pag.goto(URL, { waitUntil: 'networkidle' });

// ---------- 1. IDs duplicados ----------
const dupes = await pag.evaluate(() => {
  const vistos = {}, dup = [];
  document.querySelectorAll('[id]').forEach(n => {
    const id = n.id;
    if (vistos[id]) dup.push({ id, primero: vistos[id], segundo: n.tagName.toLowerCase() });
    else vistos[id] = n.tagName.toLowerCase();
  });
  return dup;
});
dupes.forEach(d => anota('CRITICO', 'enlaces',
  `id="${d.id}" duplicado: <${d.primero}> y <${d.segundo}>. El navegador salta al primero.`));

// ---------- 2. Cada ancla interna lleva a un destino visible ----------
const anclas = await pag.evaluate(() => {
  const out = [];
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const href = a.getAttribute('href');
    if (href === '#' || href.length < 2) { out.push({ href, problema: 'href vacío' }); return; }
    const id = decodeURIComponent(href.slice(1));
    const destino = document.getElementById(id);
    if (!destino) { out.push({ href, problema: 'destino inexistente' }); return; }
    const r = destino.getBoundingClientRect();
    const oculto = r.width === 0 && r.height === 0;
    const enDefs = !!destino.closest('defs, symbol');
    out.push({
      href, tag: destino.tagName.toLowerCase(), oculto, enDefs,
      texto: (a.textContent || '').trim().slice(0, 30),
    });
  });
  return out;
});
anclas.forEach(a => {
  if (a.problema) anota('CRITICO', 'enlaces', `Enlace "${a.texto || a.href}" → ${a.problema} (${a.href})`);
  else if (a.enDefs || a.oculto) anota('CRITICO', 'enlaces',
    `Enlace "${a.texto}" (${a.href}) apunta a <${a.tag}> ${a.enDefs ? 'dentro de <defs>/<symbol>' : 'sin dimensiones'}: el navegador no puede desplazarse a él.`);
});

// ---------- 3. Navegación real: clic y comprobar dónde aterriza ----------
const enlacesNav = await pag.$$eval('.nav-bot .menu a[href^="#"]',
  as => as.map(a => ({ href: a.getAttribute('href'), texto: a.textContent.trim() })));

for (const { href, texto } of enlacesNav) {
  await pag.evaluate(() => window.scrollTo(0, 0));
  await pag.waitForTimeout(150);
  await pag.click(`.nav-bot .menu a[href="${href}"]`);
  await pag.waitForTimeout(900); // scroll-behavior: smooth
  const r = await pag.evaluate((sel) => {
    const destino = document.querySelector(`[id="${sel.slice(1)}"]:not(defs [id]):not(symbol)`)
      || document.getElementById(sel.slice(1));
    const caja = destino ? destino.getBoundingClientRect() : null;
    return { y: window.scrollY, topDestino: caja ? caja.top : null };
  }, href);

  if (r.y < 5 && href !== '#inicio') {
    anota('CRITICO', 'enlaces', `Clic en "${texto}" (${href}) no desplaza la página: se queda en el tope.`);
  } else if (r.topDestino !== null && r.topDestino < ALTO_CABECERA - 2) {
    anota('ALTO', 'espaciado', `"${texto}" (${href}) aterriza ${Math.round(ALTO_CABECERA - r.topDestino)}px por debajo de la cabecera fija: el encabezado queda tapado.`);
  }
}

// ---------- 4. Desbordamiento horizontal por ancho ----------
for (const w of ANCHOS) {
  await pag.setViewportSize({ width: w, height: 900 });
  await pag.waitForTimeout(250);
  const res = await pag.evaluate((vw) => {
    const doc = document.documentElement;
    const desborde = doc.scrollWidth - vw;
    const culpables = [];
    if (desborde > 1) {
      document.querySelectorAll('body *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > vw + 1) {
          culpables.push({
            sel: n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''),
            left: Math.round(r.left), right: Math.round(r.right),
          });
        }
      });
    }
    return { desborde, culpables: culpables.slice(0, 6) };
  }, w);
  if (res.desborde > 1) {
    anota('ALTO', 'espaciado',
      `${w}px: la página desborda ${res.desborde}px a lo ancho (scroll horizontal). Culpables: ${res.culpables.map(c => `${c.sel} [${c.left}→${c.right}]`).join(' | ')}`);
  }
}

// ---------- 5. Selector de idioma visible en todo ancho ----------
for (const w of ANCHOS) {
  await pag.setViewportSize({ width: w, height: 900 });
  await pag.waitForTimeout(200);
  const idiomaVisible = await pag.evaluate(() => {
    const botones = [...document.querySelectorAll('.idio button')];
    return botones.some(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  });
  if (!idiomaVisible) anota('ALTO', 'espaciado', `${w}px: el selector de idioma ES/EN no es alcanzable.`);
}

// ---------- 6. Áreas táctiles en móvil ----------
await pag.setViewportSize({ width: 375, height: 800 });
await pag.waitForTimeout(250);
const tactiles = await pag.evaluate(() => {
  const malos = [];
  document.querySelectorAll('a, button').forEach(n => {
    const r = n.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.height < 24 || r.width < 24) {
      malos.push({ t: (n.textContent || n.getAttribute('aria-label') || '').trim().slice(0, 28), h: Math.round(r.height), w: Math.round(r.width) });
    }
  });
  return malos.slice(0, 12);
});
tactiles.forEach(t => anota('MEDIO', 'espaciado', `375px: "${t.t}" mide ${t.w}×${t.h}px (mínimo recomendado 24×24).`));

// ---------- 7. Contacto: el texto visible coincide con el href ----------
await pag.setViewportSize({ width: 1280, height: 900 });
await pag.waitForTimeout(200);
const contacto = await pag.evaluate(() => {
  const sec = document.getElementById('contacto');
  if (!sec) return { falta: true };
  const soloDigitos = s => (s || '').replace(/\D/g, '');
  const filas = [];
  sec.querySelectorAll('a[href^="tel:"]').forEach(a => {
    filas.push({ tipo: 'tel', href: a.getAttribute('href'), texto: a.textContent.trim(),
      coincide: soloDigitos(a.getAttribute('href')).endsWith(soloDigitos(a.textContent)) });
  });
  sec.querySelectorAll('a[href^="mailto:"]').forEach(a => {
    filas.push({ tipo: 'mail', href: a.getAttribute('href'), texto: a.textContent.trim(),
      coincide: a.getAttribute('href').slice(7).toLowerCase() === a.textContent.trim().toLowerCase() });
  });
  sec.querySelectorAll('a[href*="wa.me"]').forEach(a => {
    filas.push({ tipo: 'whatsapp', href: a.getAttribute('href'), texto: a.textContent.trim(),
      coincide: soloDigitos(a.getAttribute('href')).endsWith(soloDigitos(a.textContent)) });
  });
  return { filas, tieneFormulario: !!sec.querySelector('form') };
});
if (contacto.falta) anota('CRITICO', 'contacto', 'No existe la sección #contacto.');
else {
  contacto.filas.forEach(f => {
    if (!f.coincide) anota('CRITICO', 'contacto',
      `${f.tipo}: el texto visible "${f.texto}" NO coincide con el destino ${f.href}.`);
  });
}

// ---------- 8. Todos los tel/mailto del documento ----------
const enlacesContacto = await pag.evaluate(() => {
  const out = [];
  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    const h = a.getAttribute('href');
    out.push({ tipo: 'tel', href: h, texto: a.textContent.trim(), valido: /^tel:\+[1-9]\d{7,14}$/.test(h) });
  });
  document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
    const h = a.getAttribute('href');
    out.push({ tipo: 'mailto', href: h, texto: a.textContent.trim(), valido: /^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(h) });
  });
  return out;
});
enlacesContacto.filter(e => !e.valido).forEach(e =>
  anota('ALTO', 'contacto', `${e.tipo} mal formado: ${e.href} (texto "${e.texto}")`));

// ---------- 9. Traducciones: claves faltantes en cada idioma ----------
const traduccion = await pag.evaluate(() => {
  const claves = [...document.querySelectorAll('[data-t]')].map(n => n.getAttribute('data-t'));
  return { claves: [...new Set(claves)], total: claves.length };
});
for (const lang of ['en', 'es']) {
  await pag.click(`.idio button[data-lang="${lang}"]`).catch(() => {});
  await pag.waitForTimeout(400);
  const vacios = await pag.evaluate(() => {
    const malos = [];
    document.querySelectorAll('[data-t]').forEach(n => {
      const t = (n.textContent || '').trim();
      if (!t) malos.push(n.getAttribute('data-t'));
    });
    return malos;
  });
  vacios.forEach(k => anota('ALTO', 'idiomas', `Clave "${k}" queda vacía en ${lang.toUpperCase()}.`));
  const htmlLang = await pag.evaluate(() => document.documentElement.getAttribute('lang'));
  if (htmlLang !== lang) anota('MEDIO', 'idiomas', `Con idioma ${lang.toUpperCase()}, <html lang> vale "${htmlLang}".`);
}
await pag.click('.idio button[data-lang="es"]').catch(() => {});
await pag.waitForTimeout(300);

// ---------- 10. Accesibilidad básica ----------
const a11y = await pag.evaluate(() => {
  const r = {};
  r.h1 = document.querySelectorAll('h1').length;
  r.imgSinAlt = [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length;
  r.svgSinNombre = [...document.querySelectorAll('svg[role="img"]')].filter(s => !s.getAttribute('aria-label') && !s.querySelector('title')).length;
  r.botonesSinNombre = [...document.querySelectorAll('button')]
    .filter(b => !(b.textContent || '').trim() && !b.getAttribute('aria-label')).length;
  r.enlacesSinTexto = [...document.querySelectorAll('a')]
    .filter(a => a.getAttribute('aria-hidden') !== 'true')
    .filter(a => !(a.textContent || '').trim() && !a.getAttribute('aria-label') && !a.querySelector('[aria-label], title')).length;
  const orden = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => +h.tagName[1]);
  r.saltosEncabezado = orden.filter((n, i) => i > 0 && n - orden[i - 1] > 1).length;
  return r;
});
if (a11y.h1 !== 1) anota('ALTO', 'accesibilidad', `La página tiene ${a11y.h1} elementos <h1> (debe haber exactamente 1).`);
if (a11y.imgSinAlt) anota('ALTO', 'accesibilidad', `${a11y.imgSinAlt} <img> sin atributo alt.`);
if (a11y.svgSinNombre) anota('MEDIO', 'accesibilidad', `${a11y.svgSinNombre} <svg role="img"> sin nombre accesible.`);
if (a11y.botonesSinNombre) anota('ALTO', 'accesibilidad', `${a11y.botonesSinNombre} <button> sin nombre accesible.`);
if (a11y.enlacesSinTexto) anota('ALTO', 'accesibilidad', `${a11y.enlacesSinTexto} <a> sin texto accesible.`);
if (a11y.saltosEncabezado) anota('MEDIO', 'accesibilidad', `${a11y.saltosEncabezado} salto(s) de nivel en los encabezados.`);

// ---------- 11. Coherencia del dato de años ----------
const anios = await pag.evaluate(() => {
  const n = document.querySelector('.anios');
  const txt = document.body.innerText;
  return { mostrado: n ? n.textContent.trim() : null, mencionaAnio: /\b(19|20)\d{2}\b/.test(txt) };
});
const esperado = String(new Date().getFullYear() - 1991);
if (anios.mostrado !== esperado) {
  anota('ALTO', 'contenido', `Los años en ejercicio muestran "${anios.mostrado}" y deberían ser "${esperado}" (año actual − 1991).`);
}

// ---------- 12. Consola y red ----------
erroresConsola.forEach(e => anota('CRITICO', 'salud', `Error de consola: ${e.slice(0, 160)}`));
fallosRed.forEach(f => anota('ALTO', 'salud', `Recurso que falla: ${f}`));

await navegador.close();

// ---------- Informe ----------
const orden = { CRITICO: 0, ALTO: 1, MEDIO: 2, BAJO: 3 };
hallazgos.sort((a, b) => orden[a.sev] - orden[b.sev]);
const cuenta = hallazgos.reduce((acc, h) => (acc[h.sev] = (acc[h.sev] || 0) + 1, acc), {});

console.log('\n================ AUDITORÍA jlcabogados.com ================');
console.log(`URL: ${URL}`);
console.log(`Hallazgos: ${hallazgos.length}  (${Object.entries(cuenta).map(([k, v]) => `${k}:${v}`).join('  ') || 'ninguno'})\n`);
for (const h of hallazgos) console.log(`[${h.sev}] (${h.area}) ${h.detalle}`);
console.log('\n===========================================================');
process.exit(0);
