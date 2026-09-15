// Define QUÉ se considera la estructura del sitio a efectos de regresión.
// Lo usan por igual la prueba de regresión y el generador de la instantánea,
// para que comparar y generar no puedan divergir nunca.

async function tomarInstantanea(page, { abrir, cambiarIdioma }) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);

  const es = await page.evaluate(() => {
    const txt = (n) => (n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : null);
    return {
      titulo: document.title,
      h1: txt(document.querySelector('h1')),
      secciones: [...document.querySelectorAll('section[id], main[id]')].map(s => s.id),
      encabezados2: [...document.querySelectorAll('h2')].map(txt),
      menu: [...document.querySelectorAll('.nav-bot .menu a')].map(a => ({
        texto: txt(a), destino: a.getAttribute('href'),
      })),
      pie: [...document.querySelectorAll('.pie a')].map(a => ({
        texto: txt(a), destino: a.getAttribute('href'),
      })),
      areasPractica: [...document.querySelectorAll('.area h3, .areas h3')].map(txt),
      abogados: [...document.querySelectorAll('.abogado h3')].map(txt),
      publicaciones: [...document.querySelectorAll('.publi h3 a')].map(a => ({
        titulo: txt(a), destino: a.getAttribute('href'),
      })),
      contacto: [...document.querySelectorAll('#contacto .dato')].map(d => ({
        rotulo: txt(d.querySelector('dt')),
        valor: txt(d.querySelector('dd')),
        enlace: d.querySelector('dd a') ? d.querySelector('dd a').getAttribute('href') : null,
      })),
      externos: [...document.querySelectorAll('a[target="_blank"]')]
        .map(a => a.getAttribute('href')).sort(),
      telefonos: [...document.querySelectorAll('a[href^="tel:"]')]
        .map(a => a.getAttribute('href')).sort(),
      correos: [...document.querySelectorAll('a[href^="mailto:"]')]
        .map(a => a.getAttribute('href')).sort(),
      clavesTraduccion: [...new Set([...document.querySelectorAll('[data-t]')]
        .map(n => n.getAttribute('data-t')))].sort(),
      datosEstructurados: (() => {
        const n = document.querySelector('script[type="application/ld+json"]');
        if (!n) return null;
        try {
          const j = JSON.parse(n.textContent);
          return { tipo: j['@type'], nombre: j.name, fundacion: j.foundingDate, telefono: j.telephone };
        } catch { return 'JSON-LD inválido'; }
      })(),
      meta: {
        descripcion: (document.querySelector('meta[name="description"]') || {}).content || null,
        og: (document.querySelector('meta[property="og:description"]') || {}).content || null,
      },
    };
  });

  await cambiarIdioma(page, 'en');
  const en = await page.evaluate(() => {
    const txt = (n) => (n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : null);
    return {
      h1: txt(document.querySelector('h1')),
      menu: [...document.querySelectorAll('.nav-bot .menu a')].map(txt),
      encabezados2: [...document.querySelectorAll('h2')].map(txt),
    };
  });

  return { espanol: es, ingles: en, generada: new Date().toISOString().slice(0, 10) };
}

module.exports = { tomarInstantanea };
