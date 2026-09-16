// Convierte imágenes a WebP en varios anchos usando el Chromium que ya trae
// Playwright. Se hace así a propósito: las librerías nativas de imagen (sharp,
// canvas) obligan a compilar y complican el runner de GitHub, y aquí se
// procesan dos fotos, no dos mil.
//
// Uso: node scripts/optimizar-imagenes.mjs <carpeta-origen> <carpeta-destino> [anchos] [calidad]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const origen = process.argv[2];
const destino = process.argv[3];
const anchos = (process.argv[4] || '640,1000,1600').split(',').map(Number);
const calidad = Number(process.argv[5] || 72);
// Color de velo horneado en el archivo, p.ej. 'rgba(9,26,43,.62)'. Vacío = sin velo.
const velo = process.argv[6] || '';

if (!origen || !destino) {
  console.error('Uso: node scripts/optimizar-imagenes.mjs <origen> <destino> [anchos] [calidad] [velo]');
  process.exit(1);
}
fs.mkdirSync(destino, { recursive: true });

const archivos = fs.readdirSync(origen).filter(f => /\.(jpe?g|png)$/i.test(f));
if (!archivos.length) { console.error('No hay imágenes en ' + origen); process.exit(1); }

const navegador = await chromium.launch();
const pag = await navegador.newPage();
const resultados = [];

for (const archivo of archivos) {
  const nombre = path.parse(archivo).name;
  const bytes = fs.readFileSync(path.join(origen, archivo));
  const dataUrl = `data:image/${/png$/i.test(archivo) ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`;

  for (const ancho of anchos) {
    const b64 = await pag.evaluate(async ({ dataUrl, ancho, calidad, velo }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const escala = ancho / img.naturalWidth;
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = Math.round(img.naturalHeight * escala);
      const ctx = lienzo.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

      // Oscurecido opcional, horneado en el propio archivo. Va aquí y no como
      // capa CSS semitransparente a propósito: si el velo se pone encima con
      // CSS, el fondo real bajo el texto depende de cada píxel de la foto y
      // deja de poder comprobarse. Horneado, el archivo servido ya es oscuro
      // y el contraste es una propiedad medible del sitio.
      if (velo) {
        ctx.fillStyle = velo;
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      }
      return lienzo.toDataURL('image/webp', calidad / 100).split(',')[1];
    }, { dataUrl, ancho, calidad, velo });

    const salida = path.join(destino, `${nombre}-${ancho}.webp`);
    const buf = Buffer.from(b64, 'base64');
    fs.writeFileSync(salida, buf);
    resultados.push({ archivo: path.basename(salida), kb: (buf.length / 1024).toFixed(1) });
  }
}

await navegador.close();

console.log('Generadas en ' + destino + ':');
let total = 0;
for (const r of resultados) { console.log(`  ${r.archivo.padEnd(24)} ${r.kb.padStart(7)} KB`); total += Number(r.kb); }
console.log(`  ${'TOTAL'.padEnd(24)} ${total.toFixed(1).padStart(7)} KB`);
