# Pruebas del sitio

Suite E2E con [Playwright](https://playwright.dev). Recorre el sitio en un navegador
real —igual que un visitante— y falla si algo se rompe.

Se ejecuta **sola en GitHub Actions** en cada push a `main`, en cada pull request y
una vez al día sobre el sitio publicado. No hace falta lanzarla a mano ni pedirle a
nadie que revise: si algo se rompe, el commit aparece con un aspa roja en GitHub.

## Uso diario

```bash
npm install                 # una sola vez
npx playwright install chromium

npm test                    # toda la suite (móvil, tableta, escritorio)
npm run test:critico        # solo lo marcado @critico, ~30 s
npm run vigilar             # se queda corriendo: reejecuta al guardar index.html
npm run informe             # abre el informe HTML del último paso
```

Para probar el sitio ya publicado en lugar de los archivos locales:

```bash
# PowerShell
$env:BASE_URL="https://jlcabogados.com"; npx playwright test
```

## Qué cubre

| Archivo | Qué vigila |
|---|---|
| `enlaces.spec.js` | Ids duplicados, anclas que no existen o no son alcanzables, que cada opción del menú y del pie desplace de verdad, `rel="noopener"`, formato de `tel:` y `mailto:` |
| `espaciado.spec.js` | Scroll horizontal en 18 anchos distintos, selector de idioma siempre alcanzable, áreas táctiles de 24×24 px, texto recortado, panel móvil |
| `contacto.spec.js` | Que las llamadas a la acción lleguen a contacto, que el número que se ve sea el que marca, dirección, mapa y el contador de años |
| `idiomas.spec.js` | Claves sin traducir o vacías, `lang` del documento, persistencia al recargar, desborde en inglés |
| `accesibilidad.spec.js` | Contraste WCAG AA calculado sobre el color pintado, jerarquía de encabezados, nombres accesibles, recorrido con teclado |
| `salud.spec.js` | Errores de consola, recursos rotos, JSON-LD coherente con lo que se muestra, metadatos, página 404 |
| `regresion.spec.js` | Compara el sitio contra `instantanea.json` y marca cualquier diferencia |

Cada caso corre en tres tamaños: **móvil** (Pixel 7), **tableta** (iPad) y
**escritorio** (1440px).

## Etiquetas

- `@critico` — rompe el sitio para un visitante. Nunca debe ir a producción en rojo.
- `@regresion` — algo cambió respecto de la referencia guardada. Puede ser
  intencional, pero hay que mirarlo.

## Cuidado con el servidor reutilizado

`playwright.config.js` usa `reuseExistingServer` en local: si ya hay algo
escuchando en el 8080, la suite lo usa en lugar de arrancar el suyo. Eso es
cómodo, pero si ese servidor quedó vivo desde antes puede estar sirviendo una
versión anterior del sitio y **la suite dará por buena una página vieja**.

Pasó el 16·09·2026: en local salieron 173 en verde y GitHub encontró 3 fallos
reales. Ante una discrepancia entre local y CI, lo primero es:

```bash
pkill -f servidor.mjs   # o cerrar el proceso del 8080
npm test
```

## Regresiones

`tests/instantanea.json` guarda la estructura conocida del sitio: secciones,
menú, pie, áreas de práctica, abogados, publicaciones, datos de contacto, claves
de traducción y metadatos.

Si cambias el sitio a propósito, la prueba de regresión fallará señalando
exactamente qué cambió. Para aceptar el cambio:

```bash
npm run instantanea     # regenera la referencia
git add tests/instantanea.json
```

Compara **hechos del DOM, no píxeles**: así el resultado es idéntico en Windows,
macOS y en el servidor de GitHub, sin falsos positivos por diferencias de
tipografía.

## Auditoría exploratoria

`auditoria.mjs` es una barrida amplia que reporta hallazgos con severidad
(CRÍTICO / ALTO / MEDIO) en lugar de fallar. Útil para buscar problemas nuevos
que todavía no tienen prueba:

```bash
npm run auditoria                              # archivos locales
node auditoria.mjs https://jlcabogados.com     # sitio publicado
```

Cuando encuentre algo real, conviene convertirlo en un caso permanente dentro de
`tests/` para que no vuelva a aparecer.

## Bugs que originaron esta suite (15·09·2026)

Reportados por un visitante y reproducidos aquí antes de corregirlos:

1. **Enlace "La firma" muerto.** `<symbol id="firma">` dentro del SVG ocupaba el
   mismo id que `<section id="firma">`. El navegador salta siempre al primer
   elemento con ese id, así que la opción del menú no hacía nada. Lo cubre
   `enlaces.spec.js`.
2. **Scroll horizontal en móviles estrechos.** A 320 px `info@jlcabogados.com`
   no cabía en su columna y empujaba la página 6 px. Lo cubre `espaciado.spec.js`.
3. **Contacto con áreas táctiles pequeñas.** Teléfono, WhatsApp y correo medían
   20 px de alto, por debajo del mínimo de 24 px. Lo cubre `espaciado.spec.js`.
