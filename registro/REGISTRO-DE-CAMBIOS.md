# Registro de cambios de Cinta

Formato: la versión más reciente va ARRIBA. Cada entrada tiene cuatro bloques: **Añadido / Cambiado / Corregido** y, siempre, **Falta por hacer**.
**Regla para cualquier IA o persona:** al terminar una tarea, agrega una entrada nueva aquí, sube la versión en los 5 sitios
(ver `AGENTS.md`), añade la fila en `REGISTRO-DE-VERSIONES.md` y actualiza `PENDIENTES.md`. Nunca borres entradas viejas.
Antes de empezar, lee `PENDIENTES.md`: ahí está lo siguiente que toca.

---

## [0.7.2] · 2026-11-14 · El «Desenfoque» del fondo personalizado ahora difumina la imagen de verdad
**Estado de verificación:** probado en **Chromium real** con el CSS real de la app y la lógica real de `temas.ts`/`fondo.ts` (con Tauri simulado): se midió la nitidez de la imagen en pantalla con el desenfoque en 0, 20 y 24 px, y después de mover la atenuación al 50 % y al 90 %. `probar-fondo.mjs`, `contraste-temas.mjs` y `verificar-release.mjs` en verde. En este entorno, `npm ci`, `npm run typecheck`, `npm run build` y `cargo check --locked` también quedaron en verde. Pendiente probar en la app real (WebView2 y WebKitGTK).

### Cambiado
- **Esta versión pasa a ser la única publicada.** Sustituye a la **0.7.0** y a la **0.7.1**, cuyas releases y etiquetas se eliminan por descontinuadas. Motivos: la 0.7.0 traía la animación «Hoja de libro» (rígida, plana y con un reverso gris que no igualaba a Apple Books) y el desenfoque del fondo no difuminaba la imagen; la 0.7.1 retiró esa animación y arregló la guía, pero seguía arrastrando el desenfoque roto.
- La 0.7.2 reúne lo bueno de ambas: mantiene la retirada de «Hoja de libro» de la 0.7.1 y conserva la doble página, las fuentes a la vista y los marcapáginas vectoriales de la 0.7.0.
- La entrega sigue siendo de **9 archivos exactos**: los dos portables de Windows, `.deb`/`.rpm`/AppImage de Linux x64 y ARM64, y `SHA256SUMS.txt`.

### Corregido
- **Causa del fallo:** el deslizador «Desenfoque» solo cambiaba `--fondo-blur`, que es el cristal esmerilado de los *paneles*; la imagen nunca se difuminaba. Con la atenuación alta el velo tapa la foto y el efecto en los paneles desaparece, por eso parecía que «dejaba de funcionar» al tocar el porcentaje. Además, ese valor se escribía en el estilo de `<html>` y pisaba la regla de «Reducir transparencia» del sistema.
- **Ahora:** el deslizador (0–24 px) difumina la propia imagen (`--fondo-img-blur`, `filter: blur` sobre la imagen, entre la foto y el velo). La imagen se agranda un poco y la capa recorta el sobrante, así el borde difuminado no deja ver el fondo. La vista previa escala el desenfoque (×0,4) para verse como la pantalla real.
- El cristal esmerilado de los paneles pasa a ser fijo (14 px, y 0 con «Reducir transparencia»), definido solo en `temas.css`.
- El desenfoque solo suaviza píxeles, así que no empeora el contraste calculado con los píxeles nítidos: el mínimo de atenuación y las garantías de legibilidad no cambian.
- Etiqueta: «Desenfoque de la imagen». Valor por defecto: 0 (la imagen se ve nítida hasta que se difumina). Se guarda como `desenfoqueImagen`; el valor antiguo no se lee (era de los paneles).
- Guía de Cinta: texto de «Ajusta a tu gusto» actualizado; `GUIDE_VERSION` sube a 6.

### Falta por hacer
- Probar el deslizador con fotos reales y pesadas en WebView2 (x64 y ARM64): el filtro se repite al arrastrar; si va a saltos en equipos modestos, limitar la imagen a 1280 px mientras se arrastra.
- Valorar si «Zoom», «Voltear» y «Cubo» (animaciones de página) tienen sentido; Apple Books no las tiene.

---

## [0.7.1] · 2026-11-14 · Se retira la animación «Hoja de libro» y la guía ya no deja una página con dos líneas sueltas
**Estado de verificación:** `verificar-release.mjs` en verde. **No se pudo ejecutar `npm ci`, `npm run typecheck` ni `npm run build`** en este entorno (sin red: las dependencias no se instalan). Con `tsc` se comprobó que los cambios no dejan nombres sin definir ni importaciones rotas (los únicos errores que quedan son los de los módulos que faltan). Pendiente compilar y probar en la app real.

### Cambiado
- **Se elimina por completo la animación «Hoja de libro»** (`utilidades/hoja.ts`, sus estilos y su opción en el panel «Aa»). Motivo: la hoja era rígida, giraba plana con perspectiva, crecía más que la página al acercarse al lector, dejaba una sombra fuera del borde de la página y mostraba un gris plano en la cara trasera; no se comportaba como el pase de hoja de Apple Books. Se prefiere no tener una animación que no esté a la altura.
- Quien tenía elegida «Hoja de libro» pasa automáticamente a «Deslizar» (también cualquier valor desconocido guardado en `cinta.reader`).
- Se conserva el libro a doble página (dos páginas enfrentadas con el lomo en el centro, desde 800 px) y la sombra del canal; `MIN_DOBLE` pasa a vivir en `Reader.tsx`.

### Corregido
- **Guía de Cinta:** la lista «Qué encontrarás» se partía y dejaba una página con solo los puntos 9 y 10. Ahora la lista (con su título) se mantiene entera en una sola página. `GUIDE_VERSION` sube a 5 para que se actualice la copia ya instalada.

### Falta por hacer
- Compilar y probar en Windows (WebView2, x64 y ARM64): doble página, animaciones restantes y guía.
- Si se quiere un pase de hoja con curvatura real, hay que hacerlo con una malla (WebGL/canvas), no con CSS plano; no se reintroduce hasta que se pueda comparar fotograma a fotograma con Apple Books.

---

## [0.7.0] · 2026-11-14 · Panel «Aa» arreglado, marcapáginas vectoriales y hoja de libro a doble página
**Estado de verificación:** `npm ci`, `npm run typecheck` y `npm run build` en verde; `verificar-release.mjs` en verde. Probado en **Chromium real** con el CSS real de la app, `epub.js` y la Guía de Cinta: el giro de la hoja se capturó fotograma a fotograma (0 %, 20 %, 40 %, 50 %, 60 %, 80 %, 95 % y final) hacia adelante y hacia atrás, incluido un cambio de capítulo (portada ↔ primer capítulo), sin errores en consola; el panel «Aa» y las 16 cintas se midieron y capturaron a 1440×900 con escala 2. **No verificado:** dentro de la app Tauri real (WebView2 en Windows, WebKitGTK en Linux), con EPUB de otros editores, ni en pantallas táctiles; `cargo check --locked` no se ejecutó (no se tocó Rust; solo cambió el número de versión).

### Añadido
- **Fuente del texto, a la vista.** Sección «Fuente» con 10 opciones, cada nombre escrito con su propia tipografía: «Original del libro» (respeta la fuente del EPUB), Georgia, Cambria, Palatino, Times New Roman, Constantia, Segoe UI, Verdana, Arial y Consolas. Cada una lleva fuentes de respaldo para Linux/macOS.
- **Hoja de libro a doble página.** Con la ventana a 800 px o más, el libro se ve como un libro abierto: dos páginas enfrentadas con el lomo en el centro y una sombra de canal. Al pasar de página, la hoja es la página de la derecha: gira sobre el lomo y aterriza a la izquierda mostrando su **reverso**, que es la página izquierda del par siguiente. Al volver atrás ocurre lo contrario. Mientras gira se oscurece, proyecta sombra sobre la página que tapa y va dejando ver la página nueva por debajo.
- `herramientas/cintas/generar-cintas.py`: genera los 16 marcapáginas.

### Cambiado
- **Marcapáginas vectoriales (SVG).** Los 16 PNG de 104×326 px se sustituyen por SVG: los recortes (muesca, punta, esquinas) son trazados matemáticos, nítidos a cualquier tamaño y densidad de pantalla. Cada cinta es un material distinto (satén, grosgrain, trenzado, cuero con costura, filo de oro o plata). Los 16 ids (`c01`…`c16`) se conservan, así que la cinta elegida sigue elegida; algunos diseños repetidos del juego anterior ahora son distintos (p. ej. `c10`, `c11`, `c14`, `c15`, `c16`).
- **Marcapáginas más grande en la lectura:** de 96–160 px de alto a 170–290 px (proporción 3:10).
- **Con 800 px o más, el libro se ve a doble página** (antes lo decidía `epub.js` con el mismo umbral por defecto; ahora se pasa explícito para que coincida con la hoja).
- Con una sola página (ventana estrecha) la hoja de libro sigue siendo la animación anterior.

### Corregido
- **Panel «Aa»: la sección de fuentes no se veía y los marcapáginas se salían de su sitio.** Las secciones del panel se encogían a 0 px cuando el panel superaba su altura máxima. Ahora las secciones no se encogen y el panel se desplaza si no cabe.
- **Miniaturas de marcapáginas enormes y mal recortadas** en el panel: ahora son miniaturas de 74 px de alto con la cinta completa.

### Falta por hacer
- Probar la hoja a doble página en Windows (WebView2), Linux (WebKitGTK) y con EPUB de editoriales reales (capítulos muy pesados, imágenes a toda página). Los capítulos de más de 2,5 MB no se copian y usan el desvanecido.
- La hoja es rígida (gira plana con perspectiva y sombras); no se curva como la de Apple Books.
- Arrastrar la esquina de la hoja con el dedo o el ratón para pasar de página.

## [0.6.2] · 2026-11-14 · La búsqueda de la biblioteca ya no se aplasta ni cae bajo la barra lateral
**Estado de verificación:** `npm run typecheck` y `npm run build` en verde; `verificar-release.mjs` en verde. La release v0.6.2 se republicó desde GitHub Actions con **9 archivos: 8 binarios más `SHA256SUMS.txt`** (Windows x64/ARM64: un `.exe` portable por arquitectura; Linux x64/ARM64: `.deb`, `.rpm` y AppImage); comprobé los checksums de los portables de Windows x64/ARM64 y del AppImage de Linux x64. Medido en el DOM real (Firefox WebDriver BiDi) a 1300, 1100, 1041, 1040, 1000, 950, 900, 850, 821, 820, 760, 700, 640, 626, 600, 500 y 480 px, tanto en Inicio como en «Libros» con el selector de orden y el conmutador de vista visibles: en todos, la barra lateral sigue a la izquierda y la búsqueda queda dentro de la barra superior con su ancho completo (390 px, o todo el ancho disponible si la ventana es más estrecha), sin encogerse. También en WebKitGTK (el motor que usa la app en Linux) a 1366 px y en la app Tauri real por AT-SPI (búsqueda en la fila superior). En móvil real (≤ 479 px) se conserva el diseño anterior con la barra arriba.

### Añadido
- (nada nuevo)

### Cambiado
- **La entrega queda en 9 archivos:** cada release publica siempre los mismos 8 binarios más `SHA256SUMS.txt`: un `.exe` portable para Windows x64 y otro para ARM64; `.deb`, `.rpm` y AppImage para Linux x64 y ARM64. En Windows no hay instaladores ni MSI, y en Linux el AppImage es el formato universal. La 0.6.1 también se republicó con esos mismos 9 nombres. El workflow ahora comprueba que estén exactamente esos 8 binarios, con los mismos nombres, antes de publicar.
- **La búsqueda conserva su ancho:** ocupa hasta 390 px (o todo el ancho disponible en ventanas más estrechas) y ya no se encoge para hacer sitio. Cuando el selector de orden, el conmutador de vista y los botones de acción no caben en la misma fila, la barra superior los pasa a la fila siguiente en lugar de comprimir la búsqueda. Funciona con cualquier ancho de texto, así que también cubre Windows y ARM64.
- **Corte del diseño móvil:** la barra lateral pasa arriba solo por debajo de 480 px, en lugar de 820 px. Cinta es una app de escritorio y su ventana mínima es 640 px, así que entre 480 y 820 px manda el diseño de escritorio con el panel a la izquierda.

### Corregido
- **La búsqueda aparecía debajo del panel lateral** al estrechar la ventana por debajo de 821 px; ahora el panel se queda a la izquierda y la búsqueda permanece en la barra superior.

### Falta por hacer
- Probar a mano la ventana estrecha en Windows (WebView2) y en Windows/Linux ARM64; el CSS es el mismo, pero no se compiló aquí para esas plataformas.
- Revisar si el corte de 479 px debe acompañarse de una revisión táctil (objetivos ≥ 44 px) cuando la barra pasa arriba.

## [0.6.1] · 2026-11-14 · Parte 3a: temas de color y fondo personalizado adaptativo
**Estado de verificación:** sin compilar (sin red: no hay `node_modules` ni crates). **Hecho aquí:** (1) `verificar-release.mjs` en verde; (2) `herramientas/verificacion/probar-fondo.mjs` (nuevo): 11 imágenes sintéticas × 3 atenuaciones, contraste medido con una implementación independiente: todo correcto; (3) en Chromium real con los CSS reales (`styles.css` + `temas.css`): «Automático» da capturas **idénticas píxel a píxel** a la 0.6.0 (con y sin `temas.css`, 1100 y 600 px, claro y oscuro del sistema), cada tema gana sobre el bloque de escritorio y sobre `prefers-color-scheme`, y con fondo clara/oscura/colorida el peor 5 % de píxeles detrás de cada texto queda ≥ 4,5:1 (medido sobre capturas, no calculado); (4) `tsc` sobre `fondo.ts`, `temas.ts`, `Apariencia.tsx`, `AppleIcon.tsx` y `main.tsx` con tipos simulados de React/Tauri/Phosphor: sin errores en esos archivos; (5) EPUB de la guía regenerado y validado (zip, XML, `mimetype` sin comprimir). **No verificado:** `npm ci`, `npm run typecheck` y `npm run build` reales, `cargo check --locked` (los 4 comandos Rust nuevos están revisados a mano, no compilados), y nada dentro de la app Tauri real (selector de archivos, `get_background`/`save_background` con datos binarios, WebView2). **Correr primero:** `npm ci && npm run typecheck && npm run build` y `cargo check --locked`. Lo más probable que falle: la firma de `save_background` (`tauri::ipc::Request` + `InvokeBody::Raw`) y los tipos de `@types/react` en `Apariencia.tsx`.

### Añadido
- **Temas de color** (`estilos/temas.css`, importado al final desde `main.tsx`): Automático (por defecto), Claro, Oscuro, Sepia guinda, Medianoche y Fondo personalizado. Se aplican con `data-tema` en `<html>` y las variables `--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--accent-text`, `--border`, `--desktop-sidebar`, `--desktop-card`, `--desktop-shadow`, más `color-scheme`. **«Automático» no pone atributo ni tiene reglas**: es exactamente la 0.6.0. El lector (`THEMES` de `Reader.tsx`) no se tocó.
- Elección guardada en `localStorage` («cinta.tema»); un script en `index.html` la aplica **antes del primer render** (con el fondo, usa la última paleta calculada, «cinta.fondo.paleta») para que no parpadee.
- **Fondo personalizado:** `Elegir imagen…` (jpg, png, webp) → Rust la copia a `Fondos` como «pendiente» → el frontend la reduce con un canvas (lado mayor ≤ 1920 px, JPEG 0,85) y la confirma. Comandos Rust nuevos: `set_background(path)`, `get_background(pendiente?)` (devuelve bytes, patrón de `get_cover`; sin protocolos de archivo), `clear_background(solo_pendiente?)` y `save_background` (cuerpo binario crudo; necesario porque `set_background(path)` solo copia y la reducción ocurre en el WebView). La carpeta es `Fondos` dentro de `CintaData` (junto al .exe en modo portable).
- **Copia de seguridad y restauración incluyen `Fondos/fondo`** (`backup_library`, `restore_library`). No se incluyen la imagen pendiente ni temporales.
- **Colores adaptativos, todo local** (`utilidades/fondo.ts`, lógica pura): miniatura 48×48; luminancia relativa WCAG media, de la zona bajo la barra lateral (22 % izquierdo) y del área principal; color dominante (cubo más poblado) y más saturado (promedio del 2 % con más croma). Decide modo del texto (el que necesita menos atenuación), `--text`/`--muted`, color de paneles y un acento derivado del tono más saturado, movido hasta ≥ 3:1 contra la superficie más exigente y con `--accent-text` ≥ 4,5:1 (si la foto es casi gris, acento azul).
- **Legibilidad garantizada:** capas imagen fija → velo de atenuación → paneles translúcidos con `backdrop-filter: blur()` (barra lateral y superior, estado vacío, tarjetas y controles, hojas, detalle, avisos). La atenuación mínima se calcula con el **peor caso por percentil** (p95 de lo más claro en modo oscuro; p5 de lo más oscuro en modo claro), no con el promedio, contra `--muted` (el texto menos contrastado) y con margen (objetivo 4,7:1). Deslizadores «Atenuación» (nunca por debajo del mínimo; si se intenta, se mantiene y se avisa en pantalla) y «Desenfoque» (0–24 px).
- Rendimiento: la imagen se decodifica **una vez** en un único `<img>` dentro de un `div` fijo (`position: fixed; will-change: transform; contain: strict`) detrás de la app; la miniatura se saca de ese mismo elemento. No se repinta al desplazar.
- `prefers-reduced-transparency` (y navegadores sin `backdrop-filter`): paneles opacos y sin desenfoque; `prefers-reduced-motion`: sin el fundido de entrada.
- **Hoja «Apariencia»** (`componentes/Apariencia.tsx`, `estilos/apariencia.css`, patrón `.sheet`): muestras con miniatura de los cinco temas (Automático se ve mitad claro, mitad oscuro) y del fondo, `Elegir imagen…`, `Quitar fondo`, deslizadores, vista previa en vivo y avisos accesibles (`role="status"`). Botón «Apariencia» al pie de la barra lateral (al final de la barra superior en ≤ 820 px) y atajo `Ctrl + ,`, añadido a la ayuda de atajos. Íconos Phosphor `Palette` e `Image` (sin trazos nuevos). Objetivos táctiles ≥ 44 px con puntero táctil.
- `herramientas/verificacion/probar-fondo.mjs` (pruebas de contraste del fondo, ejecutables con Node ≥ 22.18) y `herramientas/verificacion/contraste-temas.mjs` (lee `temas.css` y comprueba cada paleta).
- Guía incluida: apartado «Apariencia y fondo» en «Tu biblioteca», atajo `Ctrl + ,`, carpeta `Fondos` y accesibilidad. `GUIDE_VERSION` de «3» a «4».

### Cambiado
- **Textos públicos:** el README y la presentación se reescribieron con una voz más cercana, de persona a persona. El icono de la app se copió a `documentacion/icono.png` y ahora se ve en el README y en la publicación de la release.
- **Entrega simplificada:** la release publica 8 archivos (un instalador NSIS por arquitectura y `.deb`/`.rpm`/`.AppImage` por arquitectura) más `SHA256SUMS.txt`. Se dejaron de generar MSI, portables de Windows y `tar.gz` portable de Linux; el workflow ahora exige un mínimo de 8 archivos.
- Contrastes de las paletas pedidas (verificados; ver `contraste-temas.mjs`): **Claro** — secundario `#86868b` daba 3,6:1 (3,3:1 sobre el panel) y el texto blanco sobre `#007aff` daba 4,0:1, así que pasan a `#6e6e73` y `#0071e3` (≥ 4,6:1 y 4,7:1). **Sepia guinda** — secundario `#6f6247` daba 4,4:1 sobre el panel; pasa a `#655a41` (5,0:1). **Oscuro** y **Medianoche** cumplen tal cual. Tarjeta de Claro `#ffffff`, de Sepia `#f8f0de` y sombras de cada tema: elegidas aquí (el pedido no las daba).
- Sin fondo no cambia nada de lo ya existente: `styles.css`, `Reader.tsx` y los lectores no se tocaron.

### Corregido
- (nada nuevo)

### Falta por hacer
- **Probar en la app real** (nada de esto se pudo): elegir imagen con el diálogo, que `save_background` reciba bien el cuerpo binario, el fondo tras reiniciar (y en portable junto al .exe), copia de seguridad y restauración con fondo, y fotos reales muy clara, muy oscura y muy colorida. Probar también a mano: cada tema con el sistema en claro y en oscuro, imagen borrada a mano y corrupta, ventana estrecha y que «Automático» se vea igual que la 0.6.0 (en Chromium sí; falta en WebView2).
- El texto de **portadas, tarjetas con sombra y controles de los lectores** no entra en la garantía: la garantía cubre el texto de la biblioteca sobre la imagen (con y sin panel). Un texto sobre el borde de un panel translúcido en una foto con mucho contraste local puede verse algo peor que el peor caso medido, pero el blur lo suaviza.
- En modo claro con foto muy colorida o de tonos medios la atenuación mínima puede ser alta (60–80 %): es el precio de garantizar 4,5:1 en el peor caso; el modo se elige solo por menor atenuación necesaria.
- Los lectores usan variables del tema de la app en sus paneles (`.pop`, `.toc`): con un tema fijo distinto del sistema esos paneles toman sus colores. Es coherente, pero se puede aislar.
- La vista previa decodifica la imagen otra vez (es un `<img>` aparte, pequeño). La vista principal sí la decodifica una sola vez.
- Parte 3 sigue abierta: sistema de diseño único y consolidar las «pasadas» de `styles.css`.

## [0.6.0] · 2026-11-13 · Parte 2f: series, estadísticas, voz, desplazamiento continuo, ancho del texto, copiar cita
**Estado de verificación:** sin compilar (sin red ni Rust en este entorno). Hecho aquí: (1) `tsc` sobre `App.tsx`, `Reader.tsx`, `EditarLibro.tsx`, `MetaLectura.tsx` y `metas.ts` con tipos simulados para las dependencias que no están instaladas: sin errores de nombres, sintaxis ni de los campos nuevos de `Book`; (2) pruebas ejecutadas en Node de la migración localStorage → base de datos, estadísticas por libro, racha y `trocear` (voz): correctas; (3) revisión línea por línea del Rust nuevo; (4) la guía EPUB regenerada se valida (zip, XML, `mimetype` sin comprimir); (5) `verificar-release.mjs` en verde. No verificado: compilación de Rust, `npm run build` real y el comportamiento en vivo. **Correr primero:** `npm ci && npm run typecheck && npm run build` y `cargo check --locked`. Lo más probable que falle: tipos de `epubjs` (`any`) y los nuevos comandos Rust.

### Añadido
- **Series:** columnas `series` y `series_index` en `books` (migración 8). Se editan en «Editar información» (nombre y número); la serie se ve en la tarjeta, la lista y el detalle; hay orden «Serie» y la búsqueda también encuentra por serie.
- **Tiempo de lectura en SQLite:** tabla `reading_log (day, book_id, seconds)` y comandos `log_reading` y `reading_log_all`. Entra en la copia de seguridad. El registro anterior de localStorage (0.5.2–0.5.4) se migra una sola vez. El detalle del libro muestra tiempo total y días de lectura.
- **Lector EPUB:** botón **Voz** (leer en voz alta con las voces del sistema, sigue de capítulo en capítulo; velocidad ×0.8–×1.5 en «Aa»); **Desplazamiento continuo** (interruptor en «Aa», usa el flujo `scrolled-doc` de epub.js); **Ancho del texto** (Estrecho / Normal / Ancho, sin tocar el `body` del libro); **Copiar** (cita con título) y **Buscar** (busca la selección en el libro) en la barra de selección.
- Índices SQL (`collection_books.book_id`, `books.series`) y `content-visibility` en los estantes para bibliotecas grandes.
- **Guía incluida** regenerada con las funciones nuevas (`herramientas/guia-incluida/construir.py`) y `GUIDE_VERSION` subida a «3» en `lib.rs`, para que quien ya tiene la guía reciba la nueva. README actualizado.

### Cambiado
- `registrarSegundos(seg, bookId)` ahora recibe el libro. Los libros abiertos sin agregar (id −1) cuentan para la meta del día pero no para estadísticas por libro.
- `set_book_info` recibe `series` y `seriesIndex` (`""` quita la serie).

### Corregido
- (nada nuevo)

### Falta por hacer
- **Diccionario:** no se hizo; un diccionario sin internet necesita datos que Cinta no incluye (y la regla del proyecto es no usar la nube). Alternativa pendiente: botón «Definir» que abra el diccionario del sistema.
- **CBR con RAR real y AZW3/KF8 completo:** no se hizo; necesita librerías Rust nuevas que no se pueden verificar sin compilar.
- Probar en vivo: cambio de páginas ↔ desplazamiento continuo (puede no recolocarse bien según epub.js), voces disponibles en Windows ARM64, y que la meta diaria siga contando tras la migración.
- Voz y copiar cita solo en EPUB (no PDF, documentos ni cómics). La página no sigue a la voz mientras lee.
- Rendimiento con ≥ 1000 libros: solo se añadieron índices y `content-visibility`; falta medirlo con una biblioteca real.

## [0.5.4] · 2026-11-13 · Parte 2e: marcar como terminado / no leído
**Estado de verificación:** sin compilar (sin red); solo TypeScript, usa el comando Rust existente `set_progress`. Correr `npm ci && npm run typecheck && npm run build`.

### Añadido
- En el menú ⋯ de cada libro legible: **«Marcar como terminado»** (progreso 100 %, conserva la posición) o **«Marcar como no leído»** (0 % y sin posición). Así el libro entra o sale de «Terminados» y «Leyendo» (`markRead` en `App.tsx`).

### Decisión tomada
- **Márgenes de página en EPUB: NO se hizo.** El lector paginado de epub.js calcula las columnas con el relleno del `body`; forzarlo con `!important` puede romper la paginación y no se puede probar sin compilar. Hacerlo probando en pantalla.

### Falta por hacer (siguiente IA, lee esto)
1. Compilar y probar (ver arriba); probar marcar/desmarcar y que «Terminados»/«Leyendo» reaccionen.
2. Funciones restantes: leer en voz alta (TTS del sistema), desplazamiento continuo y márgenes en EPUB (requiere probar en vivo), series (leer `calibre:series` del OPF en `epub.rs`), tiempo de lectura a SQLite.
3. Parte 3 (0.6.0): estética (pedir al usuario qué le disgusta o capturas).

---

## [0.5.3] · 2026-11-13 · Parte 2d: saltar a la nota y filtro «Leyendo»
**Estado de verificación:** sin compilar (sin red); solo TypeScript/CSS. Correr `npm ci && npm run typecheck && npm run build`.

### Añadido
- En **Notas**, tocar una nota abre el libro **en ese pasaje** (EPUB: CFI de `loc`; PDF: página de `p<n>`). Otros formatos solo abren el libro. Implementado con `openBookAt` en `App.tsx`, que pasa la posición como `progressCfi` al lector.
- Sección **Leyendo** en la barra lateral (libros con progreso entre 0 y 99 %), ordenada por última lectura. Icono `reading` (Phosphor `BookOpen`).

### Limitaciones conocidas
- Al saltar a una nota, la posición guardada del libro pasa a ser la de esa nota en cuanto se lee/guarda (comportamiento normal de progreso).
- Un resaltado de PDF abre la página, no hace zoom al rectángulo.

### Falta por hacer (siguiente IA, lee esto)
1. Compilar y probar: tocar una nota de EPUB y otra de PDF; verificar el filtro «Leyendo».
2. Pasar tiempo de lectura/meta a SQLite (entra en copia de seguridad).
3. Siguientes funciones: leer en voz alta, desplazamiento continuo y márgenes en EPUB, series.
4. Parte 3 (0.6.0): estética (pedir al usuario qué le disgusta o capturas).

---

## [0.5.2] · 2026-11-13 · Parte 2c: meta diaria de lectura y racha
**Estado de verificación:** sin compilar (sin red); solo TypeScript/CSS, sin cambios en Rust. Correr `npm ci && npm run typecheck && npm run build`.

### Añadido
- **Meta de hoy** en Inicio (`componentes/MetaLectura.tsx`, `utilidades/metas.ts`, `estilos/metas.css`): minutos leídos hoy frente a la meta (5–90 min, por defecto 15), racha de días seguidos que cumplieron la meta y gráfico de los últimos 7 días.
- El tiempo cuenta cada 15 s mientras hay un libro o audiolibro abierto, con la ventana visible y en primer plano (`App.tsx`).
- Datos en `localStorage` (`cinta.lectura.dias`, `cinta.lectura.meta`): se conservan 400 días.

### Limitaciones conocidas
- Los datos viven en el WebView (en la versión portable, junto al .exe) y **no entran en la copia de seguridad** todavía.
- No distingue entre libros ni cuenta lectura con la ventana en segundo plano (a propósito).

### Falta por hacer (siguiente IA, lee esto)
1. Compilar y probar: leer 1 min, cerrar el libro, ver «Meta de hoy» en Inicio; cambiar la meta; comprobar la racha cambiando días.
2. Mover tiempo de lectura y meta a SQLite (tabla nueva `reading_days`, migración `user_version = 8`) para incluirlos en la copia de seguridad y mostrar tiempo por libro.
3. Saltar a la posición exacta desde «Notas».
4. Siguientes funciones: leer en voz alta, márgenes y desplazamiento continuo en EPUB (la fuente, interlineado y justificado ya existen), series, filtro «Leyendo».
5. Parte 3 (0.6.0): estética.

---

## [0.5.1] · 2026-11-13 · Parte 2b: editar información del libro y copia de seguridad
**Estado de verificación:** sin compilar (sin red). El Rust nuevo (`backup_library`, `restore_library`, `set_book_cover_file`) NO se ha compilado: si `cargo check --locked` falla, revisar primero la API de `zip` 2.6 (`SimpleFileOptions`, `enclosed_name`) y `VACUUM INTO`. Correr también `npm run typecheck`.

### Añadido
- **Editar información** (⋯ de un libro → «Editar información…»): corrige título, autor y cambia la portada con una imagen JPG/PNG/WebP (`componentes/EditarLibro.tsx`). La portada nueva se refresca al instante.
- **Copia de seguridad** (barra lateral → Datos → «Copia de seguridad», `componentes/CopiaSeguridad.tsx`): crea un .zip con la base de datos (copia consistente con `VACUUM INTO`) y la carpeta «Libros». Restaurar extrae los libros y deja la base como `library.db.restaurar`; se aplica al **reiniciar** Cinta (guarda la anterior como `library.db.anterior`).
- Rust: comandos `set_book_cover_file`, `backup_library`, `restore_library`; el arranque aplica la restauración pendiente antes de abrir la base.
- Iconos `backup` (Phosphor `FloppyDisk`).

### Limitaciones conocidas
- La copia no incluye archivos abiertos con «Abrir archivo» ni libros enlazados por ruta absoluta (solo las copias en `Libros/`).
- Tras restaurar hay que reiniciar a mano (no hay reinicio automático).

### Falta por hacer (siguiente IA, lee esto)
1. Compilar y probar: crear copia, restaurar en otra carpeta de datos, editar título/autor/portada. Si `FloppyDisk` no existe en la versión instalada de Phosphor, usar `DownloadSimple`.
2. Saltar a la posición exacta desde «Notas» (pendiente de 0.5.0).
3. Siguientes funciones: meta y racha de lectura, leer en voz alta, tipografía EPUB, desplazamiento continuo, series, filtro «Leyendo».
4. Parte 3 (0.6.0): estética.

---

## [0.5.0] · 2026-11-13 · Parte 2: vista «Notas» y más formas de ordenar
**Estado de verificación:** sin compilar (sin red). Tipos TS revisados con un chequeo parcial sin errores propios; el Rust (`lib.rs`) NO se ha compilado. Correr `npm ci && npm run typecheck && npm run build` y `cargo check --locked` antes de publicar.

### Añadido
- Sección **Notas** en la barra lateral (`aplicacion/src/vistas/Notas.tsx`, estilos en `estilos/notas.css`): todos los resaltados, notas y marcadores de la biblioteca agrupados por libro, con búsqueda, filtro (Todo / Resaltados / Con nota / Marcadores) y botón **Exportar (.md)** que guarda en Markdown.
- Rust: comandos `list_all_annotations` (une anotaciones de libros de la biblioteca; excluye trazos de lápiz) y `save_text_file`, registrados en `invoke_handler`.
- Orden nuevo en la biblioteca: **Última lectura** y **Progreso**.
- Icono `notes` (Phosphor `NotePencil`).

### No se tocó
- Diseño general ni otros lectores. La exportación solo cubre libros de la biblioteca (no los abiertos con «Abrir archivo»).

### Falta por hacer (siguiente IA, lee esto)
1. Compilar y probar (ver arriba); si `NotePencil` no existiera en la versión instalada de `@phosphor-icons/react`, cambiar por `Notepad`.
2. Al tocar un libro desde «Notas» solo se abre el libro; falta **saltar a la posición exacta** de la nota (EPUB: CFI en `loc`; PDF: `p<página>`). Requiere que `Reader.tsx`/`PdfReader.tsx` acepten una posición inicial.
3. Siguientes funciones de `PENDIENTES.md` (Parte 2 continúa): meta y racha de lectura, leer en voz alta, copia de seguridad, editar metadatos/portada, tipografía EPUB, desplazamiento continuo.
4. Parte 3 (0.6.0): estética.

---

## [0.4.5] · 2026-11-13 · Parte 1: estructura ordenada y registros
**Estado de verificación:** carpetas, imports, versiones y workflow comprobados con `verificar-release.mjs` y un chequeo de imports. NO se pudo ejecutar `npm ci`, `typecheck`, `build` ni `cargo` (sin red en el entorno). Hay que correrlos antes de publicar.

### Cambiado
- Todo el proyecto se reorganizó en carpetas con nombre en español (mapa completo en `documentacion/MAPA-DE-CARPETAS.md`):
  - `app/` → `aplicacion/` (y dentro, `src/` se divide en `lectores/`, `componentes/`, `utilidades/`, `estilos/`).
  - `docs/` → `documentacion/` (`guias/`, `proyecto/`, `legal/`).
  - `scripts/` → `herramientas/` (`compilacion/`, `verificacion/`, `guia-incluida/`).
  - Nuevo `registro/` con este archivo, el registro de versiones y los pendientes.
- Los scripts de compilación se renombraron: `compilar-todo.ps1`, `compilar-portable.ps1`, `compilar-firmado.ps1`.
- `build.yml`, `.gitignore`, `AGENTS.md`, `PROMPT-PARA-OPENCODE.md`, guías y scripts actualizados a las rutas nuevas.
- `verificar-release.mjs` ahora también exige que exista la entrada de la versión en este registro.
- Versión 0.4.4 → 0.4.5 en los 5 sitios.

### Añadido
- `registro/` (cambios, versiones, pendientes) y `documentacion/MAPA-DE-CARPETAS.md`.
- `LEEME.md` en cada carpeta principal explicando qué contiene.

### No se tocó
- Ningún comportamiento ni diseño de la app (solo rutas de archivos). El código de `src-tauri/` es idéntico salvo un comentario.

### Falta por hacer (siguiente IA, lee esto)
1. Verificar que compila: `node herramientas/verificacion/verificar-release.mjs` y luego `cd aplicacion && npm ci && npm run typecheck && npm run build`. Si falla algún import, la causa será la reorganización de `src/`.
2. **Parte 2 (0.5.0): funciones.** Prioridad del usuario: primero subir el % de funciones de Apple Books; ver lista en `PENDIENTES.md`.
3. **Parte 3 (0.6.0): estética.** El usuario no está conforme con el aspecto actual; ver notas en `PENDIENTES.md`.
4. Nota: `documentacion/proyecto/CONTEXT.md` conserva rutas antiguas (`app/`, `docs/`) en su texto histórico; no se reescribió por la regla de solo añadir. Usa `MAPA-DE-CARPETAS.md` para traducirlas.

---

## [0.4.4] y anteriores
Historial detallado en `documentacion/proyecto/CONTEXT.md`, sección 9 (actualizaciones 001–017). Resumen en `REGISTRO-DE-VERSIONES.md`.
