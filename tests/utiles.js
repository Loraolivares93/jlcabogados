// Ayudas compartidas por las pruebas.

// Alto de la cabecera pegajosa (.nav-bot) según el ancho de la ventana.
const ALTO_CABECERA = (ancho) => (ancho <= 560 ? 50 : 56);

// Anchos donde el diseño cambia de comportamiento. Incluye los bordes exactos
// de cada media query, que es donde se rompen las cosas.
const ANCHOS_CLAVE = [320, 360, 375, 414, 480, 560, 561, 620, 680, 681, 768, 860, 900, 1024, 1080, 1280, 1440, 1920];

// Secciones a las que apunta la navegación principal.
const SECCIONES = ['firma', 'areas', 'abogados', 'publicaciones', 'contacto'];

// Datos de contacto que deben aparecer tal cual. Si cambian en el sitio sin
// cambiarlos aquí, la prueba falla: es intencional, son datos que no deben
// moverse por accidente.
const CONTACTO = {
  telefono: { texto: '(809) 566-4065', href: 'tel:+18095664065' },
  whatsapp: { texto: '(829) 707-7773', href: 'https://wa.me/18297077773' },
  correo:   { texto: 'info@jlcabogados.com', href: 'mailto:info@jlcabogados.com' },
  direccion: 'C. Centro Olímpico No. 256',
  anioInicio: 1991,
};

// Carga la página y espera a que el script de idioma haya corrido.
async function abrir(page, ruta = '/') {
  await page.goto(ruta, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.hasAttribute('lang'));
  // Espera a que las tipografías estén aplicadas: medir a mitad del intercambio
  // de fuentes da anchos falsos y haría fallar las pruebas de desborde sin motivo.
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // Desactiva el desplazamiento suave: hace las pruebas deterministas.
  await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  return page;
}

// Cambia el idioma y espera a que se apliquen las traducciones.
// En móvil el selector del encabezado está oculto y el único alcanzable vive
// dentro del panel, así que hay que abrirlo igual que haría un visitante.
async function cambiarIdioma(page, lang) {
  const boton = page.locator(`.idio button[data-lang="${lang}"]`);
  let visible = boton.locator('visible=true').first();

  if (!(await visible.count())) {
    await page.click('.btn-indice');
    await page.locator('#panel').waitFor({ state: 'visible' });
    visible = boton.locator('visible=true').first();
  }

  await visible.click();
  await page.waitForFunction(
    (l) => document.documentElement.getAttribute('lang') === l, lang, { timeout: 5000 });

  // Si se abrió el panel para llegar al selector, se cierra: dejarlo abierto
  // falsearía las medidas de las pruebas que vengan después.
  const panel = page.locator('#panel');
  if (await panel.isVisible().catch(() => false)) {
    await page.click('.panel-cerrar');
    await panel.waitFor({ state: 'hidden' }).catch(() => {});
  }
}

// Devuelve cuánto desborda el documento por la derecha (0 = sin scroll horizontal).
async function desbordeHorizontal(page) {
  return page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

// Identifica qué elementos se salen del ancho de la ventana.
async function culpablesDeDesborde(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    document.querySelectorAll('body *').forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > vw + 1) {
        const cls = typeof n.className === 'string' && n.className.trim()
          ? '.' + n.className.trim().split(/\s+/).join('.') : '';
        out.push(`<${n.tagName.toLowerCase()}${cls}> se extiende hasta ${Math.round(r.right)}px (ventana ${vw}px) — "${(n.textContent || '').trim().slice(0, 40)}"`);
      }
    });
    return out.slice(0, 8);
  });
}

module.exports = {
  ALTO_CABECERA, ANCHOS_CLAVE, SECCIONES, CONTACTO,
  abrir, cambiarIdioma, desbordeHorizontal, culpablesDeDesborde,
};
