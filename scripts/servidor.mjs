// Servidor estático mínimo para las pruebas. Sin dependencias a propósito:
// depender de "npx http-server" obliga a descargar un paquete en mitad de la
// ejecución y eso falla de forma intermitente en el runner de GitHub.
// Uso: node scripts/servidor.mjs [puerto]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const PUERTO = Number(process.argv[2] || process.env.PORT || 8080);
const RAIZ = resolve(process.cwd());

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const servidor = createServer(async (pet, res) => {
  try {
    let ruta = decodeURIComponent(new URL(pet.url, 'http://localhost').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';

    // Nada fuera de la carpeta del proyecto.
    const destino = join(RAIZ, normalize(ruta).replace(/^(\.\.[/\\])+/, ''));
    if (!destino.startsWith(RAIZ)) {
      res.writeHead(403).end('Prohibido');
      return;
    }

    const info = await stat(destino).catch(() => null);
    if (!info || !info.isFile()) {
      const err404 = await readFile(join(RAIZ, '404.html')).catch(() => null);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(err404 || 'No encontrado');
      return;
    }

    const cuerpo = await readFile(destino);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(destino).toLowerCase()] || 'application/octet-stream',
      'Content-Length': cuerpo.length,
      'Cache-Control': 'no-store',
    });
    res.end(cuerpo);
  } catch (e) {
    res.writeHead(500).end('Error: ' + e.message);
  }
});

// Que una petición cortada por el navegador no tumbe el proceso.
servidor.on('clientError', (e, socket) => socket.destroy());
process.on('uncaughtException', (e) => console.error('servidor:', e.message));

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Sirviendo ${RAIZ} en http://127.0.0.1:${PUERTO}`);
});
