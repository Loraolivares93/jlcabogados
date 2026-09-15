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

test.describe('Regresión', () => {

  test('@regresion la estructura del sitio no ha cambiado', async ({ page }) => {
    test.skip(!fs.existsSync(RUTA),
      'No hay instantánea de referencia. Créala con: npm run instantanea');

    const referencia = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
    const actual = await tomarInstantanea(page, { abrir, cambiarIdioma });

    const diferencias = [];
    const comparar = (ruta, a, b) => {
      const ja = JSON.stringify(a), jb = JSON.stringify(b);
      if (ja !== jb) diferencias.push(`${ruta}\n    antes: ${ja}\n    ahora: ${jb}`);
    };

    for (const clave of Object.keys(referencia)) {
      if (clave === 'generada') continue;
      comparar(clave, referencia[clave], actual[clave]);
    }
    const nuevas = Object.keys(actual).filter(k => !(k in referencia) && k !== 'generada');
    nuevas.forEach(k => diferencias.push(`${k} (apartado nuevo)`));

    expect(diferencias,
      '\nREGRESIÓN: el sitio cambió respecto de la instantánea.\n' +
      'Si el cambio es intencional, actualízala con "npm run instantanea" y comitea tests/instantanea.json.\n'
    ).toEqual([]);
  });
});
