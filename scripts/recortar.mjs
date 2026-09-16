// Recorta una imagen a una relación de aspecto concreta, controlando qué punto
// queda en el centro. Sirve para dar a cada formato de pantalla su propio
// encuadre en lugar de dejar que `background-size:cover` recorte a ciegas:
// la sección del cierre es 3,3:1 en escritorio pero 0,86:1 en móvil, así que
// un único recorte no puede servir a los dos.
//
// Uso: node scripts/recortar.mjs <origen.jpg> <destino.jpg> <ancho> <alto> [focoX] [focoY]
//   focoX/focoY: 0..1, qué punto de la imagen original queda centrado (0.5 = centro)
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [origen, destino, anchoStr, altoStr, fxStr, fyStr] = process.argv.slice(2);
if (!origen || !destino || !anchoStr || !altoStr) {
  console.error('Uso: node scripts/recortar.mjs <origen> <destino> <ancho> <alto> [focoX] [focoY]');
  process.exit(1);
}
const W = Number(anchoStr), H = Number(altoStr);
const fx = fxStr === undefined ? 0.5 : Number(fxStr);
const fy = fyStr === undefined ? 0.5 : Number(fyStr);

const b64 = fs.readFileSync(origen).toString('base64');
const navegador = await chromium.launch();
const pag = await navegador.newPage();

const salida = await pag.evaluate(async ({ b64, W, H, fx, fy }) => {
  const img = new Image();
  img.src = 'data:image/jpeg;base64,' + b64;
  await img.decode();

  const lienzo = document.createElement('canvas');
  lienzo.width = W; lienzo.height = H;
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Escala mínima que cubre el destino, como hace background-size:cover.
  const escala = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * escala, dh = img.naturalHeight * escala;

  // Desplazamiento para que el punto de foco quede centrado, sin salirse.
  let x = W / 2 - fx * dw;
  let y = H / 2 - fy * dh;
  x = Math.min(0, Math.max(W - dw, x));
  y = Math.min(0, Math.max(H - dh, y));

  ctx.drawImage(img, x, y, dw, dh);
  return { datos: lienzo.toDataURL('image/jpeg', 0.95).split(',')[1], origen: [img.naturalWidth, img.naturalHeight] };
}, { b64, W, H, fx, fy });

await navegador.close();
fs.writeFileSync(destino, Buffer.from(salida.datos, 'base64'));
console.log(`${origen.split(/[\\/]/).pop()} ${salida.origen.join('x')} -> ${destino.split(/[\\/]/).pop()} ${W}x${H} (foco ${fx}, ${fy})`);
