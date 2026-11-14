# Registro de cambios de Cinta

Formato: la versión más reciente va ARRIBA. Cada entrada tiene cuatro bloques: **Añadido / Cambiado / Corregido** y, siempre, **Falta por hacer**.
**Regla para cualquier IA o persona:** al terminar una tarea, agrega una entrada nueva aquí, sube la versión en los 5 sitios
(ver `AGENTS.md`), añade la fila en `REGISTRO-DE-VERSIONES.md` y actualiza `PENDIENTES.md`. Nunca borres entradas viejas.
Antes de empezar, lee `PENDIENTES.md`: ahí está lo siguiente que toca.

---

## [0.6.2] · 2026-11-14 · La búsqueda de la biblioteca ya no se aplasta ni cae bajo la barra lateral
**Estado de verificación:** `npm run typecheck` y `npm run build` en verde; `verificar-release.mjs` en verde. Medido en el DOM real (Firefox WebDriver BiDi) a 1300, 1100, 1041, 1040, 1000, 950, 900, 850, 821, 820, 760, 700, 640, 626, 600, 500 y 480 px, tanto en Inicio como en «Libros» con el selector de orden y el conmutador de vista visibles: en todos, la barra lateral sigue a la izquierda y la búsqueda queda dentro de la barra superior con su ancho completo (390 px, o todo el ancho disponible si la ventana es más estrecha), sin encogerse. También en WebKitGTK (el motor que usa la app en Linux) a 1366 px y en la app Tauri real por AT-SPI (búsqueda en la fila superior). En móvil real (≤ 479 px) se conserva el diseño anterior con la barra arriba.

### Añadido
- (nada nuevo)

### Cambiado
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
