# Créditos y licencias de las imágenes

Este archivo acompaña a los archivos de imagen de esta carpeta y cumple la
obligación de atribución y de licencia de la obra derivada que impone
CC BY-SA 4.0 (cláusulas 3.a y 3.b).

---

## Puerta del Conde — `ancho-*.webp`, `movil-*.webp`

**Obra original**

| | |
|---|---|
| Título | Puerta del Conde |
| Autor | Mariordo (Mario Roberto Durán Ortiz) |
| Fuente | https://commons.wikimedia.org/wiki/File:Puerta_del_Conde_CCSD_09_2018_1629.jpg |
| Licencia original | Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0) |
| Texto de la licencia | https://creativecommons.org/licenses/by-sa/4.0/legalcode.es |
| Dimensiones originales | 3000 × 2000 px |

**Modificaciones realizadas**

Los archivos de esta carpeta son obra derivada. Sobre la fotografía original se
aplicó:

1. **Recorte.** Dos encuadres distintos, uno por formato de pantalla:
   - escritorio: 2400 × 720 px, centrado en el punto (0,50 · 0,47) de la imagen original
   - móvil: 1000 × 1100 px, centrado en el punto (0,50 · 0,52)
2. **Oscurecido.** Capa de color `rgba(9, 26, 43, 0.78)` en escritorio y
   `rgba(9, 26, 43, 0.80)` en móvil, fundida en el propio archivo. Se hace así
   —y no como capa CSS— para que el contraste del texto que va encima sea una
   propiedad medible y verificable del archivo servido.
3. **Recodificación** a WebP con calidad 88, en varios anchos.

Los tres pasos se reproducen con los scripts del repositorio:

```
node scripts/recortar.mjs <original.jpg> <recorte.jpg> 2400 720 0.5 0.47
node scripts/optimizar-imagenes.mjs <carpeta> <destino> 1400,1900,2400 88 "rgba(9,26,43,.78)"
```

**Licencia de la obra derivada**

Los archivos `ancho-*.webp` y `movil-*.webp` se publican bajo
**CC BY-SA 4.0**, la misma licencia de la obra original, tal como exige la
cláusula de CompartirIgual.

https://creativecommons.org/licenses/by-sa/4.0/

---

## Alcance

La licencia CC BY-SA 4.0 alcanza **únicamente a estos archivos de imagen**. No
se extiende al resto del sitio: el código, los textos, el logotipo y los demás
contenidos de J. Lora Castillo & Asociados conservan sus propios derechos. Una
página que incorpora una obra CC BY-SA no se convierte por ello en obra
derivada de esa imagen.

El aviso de «Todos los derechos reservados» del pie del sitio debe entenderse
sin perjuicio de lo anterior: no impone condiciones adicionales sobre esta
fotografía ni restringe los derechos que su licencia concede a terceros.

## Si se sustituye la fotografía

Actualizar este archivo y el crédito del pie de `index.html` (clave de
traducción `credfoto`, en español y en inglés). Si la nueva imagen procede de
un banco sin obligación de atribución —Unsplash o Pexels—, ambos pueden
eliminarse.
