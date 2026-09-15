// Vigilante local: cada vez que se guarda index.html, vuelve a correr la suite.
// Uso: npm run vigilar
// Sirve para trabajar con la red puesta sin tener que acordarse de lanzar nada.
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';

const ARCHIVOS = ['index.html', '404.html'];
let corriendo = false;
let pendiente = false;

function correr(motivo) {
  if (corriendo) { pendiente = true; return; }
  corriendo = true;
  console.log(`\n[36m→ ${motivo}: ejecutando pruebas...[0m\n`);
  const t0 = Date.now();
  const p = spawn('npx', ['playwright', 'test', '--project=escritorio', '--reporter=list'],
    { stdio: 'inherit', shell: true });
  p.on('exit', (code) => {
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(code === 0
      ? `\n[32m✓ Todo en orden (${seg}s). Vigilando cambios...[0m`
      : `\n[31m✗ Hay fallos (${seg}s). Revisa arriba. Vigilando cambios...[0m`);
    corriendo = false;
    if (pendiente) { pendiente = false; correr('cambios acumulados'); }
  });
}

console.log('Vigilando: ' + ARCHIVOS.join(', ') + '\nCtrl+C para salir.');
correr('arranque');

let temporizador;
for (const archivo of ARCHIVOS) {
  try {
    watch(archivo, () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => correr(`cambió ${archivo}`), 400);
    });
  } catch {
    console.warn(`No se pudo vigilar ${archivo} (¿no existe?)`);
  }
}
