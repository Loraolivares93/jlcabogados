// Configuración de las pruebas E2E de jlcabogados.com
// Por defecto levanta un servidor estático sobre los archivos del repositorio,
// de modo que se prueba exactamente el código que se va a publicar.
// Para probar el sitio ya publicado: BASE_URL=https://jlcabogados.com npx playwright test
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';
const ES_LOCAL = BASE_URL.includes('127.0.0.1') || BASE_URL.includes('localhost');

module.exports = defineConfig({
  testDir: './tests',
  // Un fallo en estas pruebas es un fallo real del sitio: no se reintenta a ciegas.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list'], ['json', { outputFile: 'informe/resultados.json' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  // Los mismos casos se ejecutan en tres tamaños: ahí es donde aparecen
  // los problemas de espaciado y desbordamiento.
  projects: [
    { name: 'movil',     use: { ...devices['Pixel 7'] } },
    { name: 'tableta',   use: { ...devices['iPad (gen 7)'] } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: ES_LOCAL ? {
    command: 'npx --yes http-server -p 8080 -s .',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  } : undefined,
});
