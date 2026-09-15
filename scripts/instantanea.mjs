// Genera tests/instantanea.json, la referencia contra la que se detectan regresiones.
// Uso: npm run instantanea          (sobre los archivos del repositorio)
//      npm run instantanea -- https://jlcabogados.com   (sobre el sitio publicado)
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const { tomarInstantanea } = require('../scripts/instantanea-lib.js');
const { abrir, cambiarIdioma } = require('../tests/utiles.js');

const destino = process.argv[2] || 'http://127.0.0.1:8080/';
const esLocal = destino.includes('127.0.0.1') || destino.includes('localhost');

let servidor;
if (esLocal) {
  servidor = spawn(process.execPath, ['scripts/servidor.mjs', '8080'], { stdio: 'ignore' });
  // Espera a que responda.
  for (let i = 0; i < 40; i++) {
    try { await fetch(destino); break; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
}

const navegador = await chromium.launch();
const pag = await navegador.newPage();
pag.goto = ((original) => (ruta, op) =>
  original.call(pag, ruta.startsWith('http') ? ruta : destino, op))(pag.goto);

const instantanea = await tomarInstantanea(pag, { abrir, cambiarIdioma });
await navegador.close();
if (servidor) servidor.kill();

const ruta = path.join(process.cwd(), 'tests', 'instantanea.json');
fs.writeFileSync(ruta, JSON.stringify(instantanea, null, 2) + '\n');

console.log(`Instantánea guardada en tests/instantanea.json`);
console.log(`  origen: ${destino}`);
console.log(`  secciones: ${instantanea.espanol.secciones.join(', ')}`);
console.log(`  áreas: ${instantanea.espanol.areasPractica.length}  ·  abogados: ${instantanea.espanol.abogados.length}  ·  publicaciones: ${instantanea.espanol.publicaciones.length}`);
console.log('\nRevisa el archivo y coméntalo en el commit si el cambio es intencional.');
process.exit(0);
