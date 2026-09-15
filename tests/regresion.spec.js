// Regresión estructural.
// Se compara el sitio actual contra una instantánea guardada (tests/instantanea.json).
// Cualquier diferencia se marca como REGRESIÓN y hay que revisarla a mano.
// Si el cambio es intencional: npm run instantanea  (y se comitea el JSON).
//
// Se comparan hechos del DOM, no píxeles: así el resultado es idéntico en
// Windows, macOS y en el runner de GitHub, sin falsos positivos por tipografía.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { abrir, cambiarIdioma } = require('./utiles');
const { tomarInstantanea } = require('../scripts/instantanea-lib');

const RUTA = path.join(__dirname, 'instantanea.json');

// Recorre las dos estructuras en paralelo y devuelve solo las hojas que
// difieren, con la ruta exacta. Volcar los objetos enteros no sirve de nada:
// el informe debe decir qué cambió, no repetir el sitio completo.
function diferencias(antes, ahora, ruta = '') {
  const out = [];
  const corta = (v) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s === undefined ? 'undefined' : (s.length > 120 ? s.slice(0, 117) + '…' : s);
  };

  if (Array.isArray(antes) && Array.isArray(ahora)) {
    const n = Math.max(antes.length, ahora.length);
    if (antes.length !== ahora.length) {
      out.push(`${ruta}: la lista pasa de ${antes.length} a ${ahora.length} elementos`);
    }
    for (let i = 0; i < n; i++) {
      if (i >= antes.length) out.push(`${ruta}[${i}]: NUEVO → ${corta(ahora[i])}`);
      else if (i >= ahora.length) out.push(`${ruta}[${i}]: ELIMINADO ← ${corta(antes[i])}`);
      else out.push(...diferencias(antes[i], ahora[i], `${ruta}[${i}]`));
    }
    return out;
  }

  const objeto = (v) => v && typeof v === 'object';
  if (objeto(antes) && objeto(ahora)) {
    for (const k of new Set([...Object.keys(antes), ...Object.keys(ahora)])) {
      const sub = ruta ? `${ruta}.${k}` : k;
      if (!(k in antes)) out.push(`${sub}: apartado NUEVO`);
      else if (!(k in ahora)) out.push(`${sub}: apartado ELIMINADO`);
      else out.push(...diferencias(antes[k], ahora[k], sub));
    }
    return out;
  }

  if (JSON.stringify(antes) !== JSON.stringify(ahora)) {
    out.push(`${ruta}\n      antes: ${corta(antes)}\n      ahora: ${corta(ahora)}`);
  }
  return out;
}

test.describe('Regresión', () => {

  test('@regresion la estructura del sitio no ha cambiado', async ({ page }) => {
    test.skip(!fs.existsSync(RUTA),
      'No hay instantánea de referencia. Créala con: npm run instantanea');

    const referencia = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
    const actual = await tomarInstantanea(page, { abrir, cambiarIdioma });

    delete referencia.generada;
    delete actual.generada;

    const cambios = diferencias(referencia, actual);

    expect(cambios,
      '\nREGRESIÓN: el sitio cambió respecto de la instantánea.\n' +
      'Si el cambio es intencional, actualízala con "npm run instantanea" y comitea tests/instantanea.json.\n'
    ).toEqual([]);
  });
});
