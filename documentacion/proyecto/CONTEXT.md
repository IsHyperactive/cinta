# CINTA (antes Folio) — ARCHIVO DE CONTEXTO DEL PROYECTO

> **Desde la 0.4.5 las carpetas cambiaron de nombre** (`app/`→`aplicacion/`, `docs/`→`documentacion/`, `scripts/`→`herramientas/`). Traducción de rutas: `documentacion/MAPA-DE-CARPETAS.md`. Cambios y pendientes actuales: carpeta `registro/`.

> Pega este archivo completo al inicio de cualquier chat nuevo para retomar el proyecto.
> Regla de trabajo: en CADA fase se actualiza este archivo (secciones 4, 5 y 9) y se agrega
> una entrada nueva al REGISTRO DE ACTUALIZACIONES (sección 9). Nunca se borra el historial.

════════════════════════════════════════════════════════════════
## 1. OBJETIVO
════════════════════════════════════════════════════════════════
App de escritorio para Windows y Linux que imita Apple Books, pero solo para archivos LOCALES
(sin tienda, sin libros de paga, sin sincronización en la nube).
- Debe soportar TODOS los formatos posibles, más de los que soporta Apple Books.
- Debe funcionar de forma NATIVA en Windows x64 y ARM64, y en Linux x64 (interfaz y backend).
- Idioma de la interfaz: español.
- Se construye por fases; cada fase debe quedar funcionando por sí sola.

════════════════════════════════════════════════════════════════
## 2. DECISIONES TOMADAS
════════════════════════════════════════════════════════════════
| Tema | Decisión | Motivo |
|---|---|---|
| Framework | Tauri 2 | Backend en Rust, app ligera, soporta ARM64 |
| Interfaz | React 18 + TypeScript + Vite | Ecosistema y lectores web maduros |
| Motor web | WebView2 (viene con Windows) | Existe para ARM64; EPUB es HTML/CSS |
| Lector EPUB | `epubjs` 0.3.x (paginado, spread automático) | JS puro (usa JSZip), sin riesgo de ARM |
| Instancia única | `tauri-plugin-single-instance` 2 | «Abrir con» reutiliza la ventana abierta; evita dos procesos sobre la misma base SQLite (verificar compilación ARM64) |
| Metadatos/portada EPUB | Rust: crates `zip` (deflate Rust puro) + `roxmltree` | Rust puro, ARM seguro |
| Portada/metadatos PDF | pdf.js en la interfaz (primera página → JPEG → Rust) | JS puro, ARM seguro |
| Lector PDF | pdf.js (`pdfjs-dist` 4.x, Fase 4) | JS puro, sin riesgo de ARM |
| Base de datos | SQLite vía rusqlite con feature `bundled` | Se compila dentro de la app, sin DLLs |
| Distribución | **.exe portable de un solo archivo** (`--no-bundle`), sin instalador; datos en `CintaData\` junto al .exe | Pedido del usuario; NSIS queda como opción secundaria |
| Nombre | **Cinta** (antes «Folio») | Por el marcador del icono; elegido en la actualización 006 |
| Licencia | MIT, sin telemetría, sala limpia | Proyecto open source (ver sección 3C) |
| Sincronización | Ninguna | Solo archivos locales |

Referencias verificadas (Tauri docs): compilar para ARM64 requiere las herramientas
"MSVC v143 C++ ARM64 build tools" y `rustup target add aarch64-pc-windows-msvc`;
solo NSIS soporta ARM64; el instalador corre emulado pero la app es binario ARM64 nativo.

════════════════════════════════════════════════════════════════
## 3. REGLAS DE COMPATIBILIDAD ARM64 (obligatorias)
════════════════════════════════════════════════════════════════
1. Antes de agregar cualquier dependencia nativa (crate de Rust con C/C++, DLL, binario),
   confirmar que compila para `aarch64-pc-windows-msvc`.
2. Preferir JS puro o Rust puro. Evitar binarios precompilados solo x64.
3. SQLite siempre con `bundled`. No depender de librerías instaladas en el sistema.
4. Cada fase debe compilar en x64 Y ARM64 (script `../scripts/build-all.ps1`).
5. Probar en un equipo o VM con Windows ARM antes de marcar una fase como terminada.

════════════════════════════════════════════════════════════════
## 3B. HARDWARE DEL USUARIO Y REGLAS TÁCTILES
════════════════════════════════════════════════════════════════
**Equipo de prueba/uso: un equipo ARM64 con Windows 11**, pantalla táctil y lápiz,
uso en horizontal y vertical. Por eso ARM64 es el objetivo principal, no un extra.
- En este equipo el host de Rust es `aarch64-pc-windows-msvc`: `npm --prefix app run tauri dev` ya compila nativo ARM64.
  Basta instalar Node.js (versión ARM64), Rust (rustup ARM64) y Visual Studio Build Tools con
  "Desarrollo para el escritorio con C++" + "MSVC v143 C++ ARM64 build tools". `../scripts/build-all.ps1` es opcional aquí.
- Reglas táctiles (obligatorias en toda pantalla nueva):
  1. Objetivos táctiles de al menos 44 px (`@media (pointer: coarse)` los agranda).
  2. Nada importante solo con hover ni solo con clic derecho; el clic derecho y la pulsación larga abren el mismo menú.
  3. Gestos del lector: deslizar = cambiar de página, tocar bordes (25 %) = página, tocar centro = barras,
     pellizcar con dos dedos = tamaño de letra. Todo también por teclado (flechas, Re Pág, Av Pág, Esc).
  4. Diseño adaptable: el ancho estrecho/vertical (≤ 820 px) mueve la barra lateral arriba.
  5. `touch-action` evita que el pellizco haga zoom de toda la ventana; el scroll vertical sigue activo en la biblioteca.
  6. Lápiz: previsto para la Fase 5 (resaltar y anotar con el lápiz usando Pointer Events `pointerType === "pen"`).

════════════════════════════════════════════════════════════════
## 3C. OPEN SOURCE Y SALA LIMPIA (clean-room)
════════════════════════════════════════════════════════════════
- Licencia MIT, sin telemetría, sin cuentas ni nube. Todo local.
- Inspiración filosófica: ArtCraft (según la prensa: apps libres MIT/Apache, sin telemetría, "nativas, no envueltas",
  construidas desde cero). Se adopta: libre, local, privado, nativo cuando sea posible, hecho desde cero.
- **Cinta NO se construye descompilando Apple Books ni ninguna otra app.** Es una reimplementación desde cero:
  se usan especificaciones abiertas (EPUB, PDF), documentación pública y las funciones visibles para cualquier usuario.
  Código, íconos, textos y recursos son propios. Ver `../.github/CONTRIBUTING.md`.
- "Idéntico" significa mismas funciones y buena experiencia, no copia de código, recursos ni identidad visual.
- Pregunta abierta: Tauri usa WebView2 (motor web del sistema, no Electron). Si se quiere "nativo puro" al estilo
  ArtCraft (Rust con egui/Slint/iced), implicaría reescribir lectores y portar el motor EPUB; se evaluaría después de la Fase 7.

════════════════════════════════════════════════════════════════
## 4. FORMATOS (estado)
════════════════════════════════════════════════════════════════
Apple Books lee: EPUB, PDF, iBooks (.ibooks/IBA) y audiolibros. Cinta apunta a más.

| Formato | Importar | Leer | Fase prevista | Estrategia |
|---|---|---|---|---|
| EPUB 2/3 | Sí (título, autor, portada) | Sí (Fase 3, sin verificar) | 3 | epub.js |
| PDF | Sí (título, autor, portada) | Sí (Fase 4, sin verificar) | 4 | pdf.js |
| MOBI / AZW3 | Sí | No | 6 | Convertir a HTML/EPUB en Rust |
| FB2 | Sí | No | 6 | Convertir a HTML en Rust |
| CBZ / CBR | Sí | No | 6 | Imágenes en visor de páginas |
| TXT / HTML | Sí | No | 6 | Render directo |
| DOCX | Sí | No | 6 | Convertir a HTML |
| M4B / M4A / MP3 | Sí | No | 6 | Reproductor con capítulos |
| .ibooks (IBA) | Sí | No | 6 | Investigar viabilidad (formato propietario) |
"Importar" = se registra en la biblioteca. Aún no hay lector para ninguno.
Metadatos de MOBI/AZW3/FB2/CBZ/etc. se agregan en la Fase 6 junto con su lector.

════════════════════════════════════════════════════════════════
## 5. ESTADO DE LAS FASES
════════════════════════════════════════════════════════════════
- [~] Fase 1 — Base: proyecto, ventana, SQLite, importar archivos, cuadrícula   (código escrito, SIN compilar aún)
- [~] Fase 2 — Biblioteca: metadatos, portadas reales (EPUB y PDF), colecciones, carpetas   (código escrito, SIN compilar aún)
- [~] Fase 3 — Lector EPUB + soporte táctil   (código escrito, SIN compilar aún)
- [~] Fase 4 — Lector PDF (zoom, miniaturas, búsqueda, contenido, temas «Aa» estilo Apple Books) + base open source   (código escrito, SIN compilar aún)
- [~] Fase 5 — Anotaciones: marcadores y resaltados en EPUB y PDF (escrito, sin compilar); faltan notas de texto y trazo con lápiz
- [ ] Fase 6 — Más formatos (ver sección 4)
- [ ] Fase 7 — Pulido: atajos, rendimiento, instalador firmado

Leyenda: [ ] pendiente · [~] escrita sin verificar · [x] verificada en x64 y ARM64

════════════════════════════════════════════════════════════════
## 6. ESTRUCTURA DEL PROYECTO
════════════════════════════════════════════════════════════════
```
cinta/
├─ README.md, LICENSE      ← presentación y licencia MIT
├─ docs/                   ← documentación del proyecto
│  ├─ CONTEXT.md           ← este archivo (decisiones, fases y estado)
│  ├─ COMPILAR.md          ← compilación desde Linux y GitHub Actions
│  ├─ SIGNING.md           ← firma de instaladores y ejecutables
│  ├─ THIRD_PARTY_LICENSES.md
│  └─ OPENCODE-LINUX.md
├─ scripts/                ← compilación para Windows
│  ├─ build-portable.ps1   ← .exe portable x64 y ARM64 en portable\
│  ├─ build-all.ps1        ← instaladores NSIS x64 y ARM64
│  └─ build-signed.ps1     ← instaladores y portables firmados
├─ .github/                ← workflows de CI y guía de contribución
├─ guia/                   ← fuente de la «Guía de Cinta»: construir.py y portada.jpg
└─ app/                    ← aplicación: interfaz + backend Tauri
   ├─ package.json, vite.config.ts, tsconfig.json, index.html
   ├─ src/                 ← interfaz (React + TS)
   │  ├─ main.tsx          ← entrada
   │  ├─ App.tsx           ← biblioteca: barra lateral, colecciones, búsqueda, cuadrícula, arrastrar y soltar
   │  ├─ Reader.tsx        ← lector EPUB: páginas, contenido, temas, texto, gestos táctiles, progreso
   │  ├─ PdfReader.tsx     ← lector PDF: scroll continuo, zoom, miniaturas, contenido, búsqueda, modo noche
   │  ├─ annot.ts          ← tipos y colores compartidos de anotaciones, reduceMotion()
   │  ├─ pdf.ts            ← extrae título, autor y portada de PDFs con pdf.js
   │  ├─ vite-env.d.ts
   │  └─ styles.css        ← tema claro/oscuro automático (prefers-color-scheme)
   └─ src-tauri/           ← backend (Rust)
      ├─ Cargo.toml
      ├─ tauri.conf.json   ← ventana, bundle NSIS, WebView2 downloadBootstrapper
      ├─ capabilities/default.json   ← permisos: core:default, dialog:default
      ├─ icons/icon.ico    ← icono provisional
      ├─ assets/Guia-de-Cinta.epub   ← libro por defecto, se incrusta en el .exe (include_bytes!)
      └─ src/
         ├─ main.rs        ← llama a cinta_lib::run()
         ├─ lib.rs         ← base de datos, migraciones y comandos
         └─ epub.rs        ← lee metadatos y portada de EPUB (Rust puro)
```

════════════════════════════════════════════════════════════════
## 7. BACKEND: BASE DE DATOS Y COMANDOS
════════════════════════════════════════════════════════════════
Archivo: `%APPDATA%\com.cinta.reader\library.db` (SQLite, modo WAL, `user_version = 7`)

```sql
CREATE TABLE books (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,   -- nombre del archivo; se reemplaza por el título de los metadatos
  path       TEXT    NOT NULL UNIQUE,
  format     TEXT    NOT NULL,   -- extensión en minúsculas
  added_at   INTEGER NOT NULL,   -- segundos Unix
  author     TEXT,               -- v2
  cover      BLOB,               -- v2: imagen de portada
  cover_mime TEXT,               -- v2: NULL si no hay portada
  progress_cfi TEXT,             -- v3: posición de lectura (CFI de EPUB)
  progress_pct REAL NOT NULL DEFAULT 0,   -- v3: 0 a 1
  last_read_at INTEGER NOT NULL DEFAULT 0, -- v3: segundos Unix
  want INTEGER NOT NULL DEFAULT 0,         -- v4: 1 = en «Quiero leer»
  source TEXT                              -- v5: ruta del archivo original (solo para no importarlo dos veces)
);
CREATE TABLE ext_progress (path TEXT PRIMARY KEY, cfi TEXT NOT NULL, pct REAL NOT NULL DEFAULT 0, updated INTEGER NOT NULL);  -- v6: posición de archivos abiertos sin agregar
CREATE TABLE annotations (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, kind TEXT NOT NULL, loc TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT 'amarillo', note TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL);   -- v7: key = "b:<id>" (biblioteca) o "p:<ruta>" (sin agregar); kind = bookmark|highlight; loc = CFI (EPUB) o p<página> (PDF)
CREATE TABLE collections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);   -- v2
CREATE TABLE collection_books (collection_id INTEGER NOT NULL, book_id INTEGER NOT NULL,
  PRIMARY KEY (collection_id, book_id));                                                     -- v2
```
Comandos Tauri (invocados con `invoke` desde React):
- `list_books() -> Book[]`  (más recientes primero)
- `add_books(paths: string[]) -> number`  (async; acepta archivos Y carpetas; COPIA cada libro a `CintaData\Libros` y guarda la ruta relativa `Libros/<archivo>`; el original no se toca; ignora duplicados (por `source`) y formatos no soportados; para EPUB lee metadatos y portada)
- `set_book_info(id, title?, author?, coverBase64?)`  (lo usa la interfaz para PDFs)
- `get_cover(id) -> bytes`
- `read_book_file(id, path?) -> bytes`  (`id >= 0`: libro de la biblioteca, solo por id; `id < 0`: archivo abierto SIN agregar, se lee de `path`)
- `relink_book(id, path)`  (async; copia el archivo elegido a `Libros/` y lo usa en lugar del perdido)
- `startup_file() -> string?`  (archivo con el que se abrió la app: arrastrado sobre el .exe o «Abrir con»)
- `remove_book(id)`  (quita de la biblioteca; si es una copia en `Libros/` borra SOLO esa copia (comprobado con canonicalize); los originales y enlaces antiguos de ruta absoluta nunca se borran)
- `set_want(id, want)`  (marca/desmarca «Quiero leer»)
- `set_progress(id, cfi, pct?, path?)`  (guarda posición y porcentaje; `pct` puede faltar mientras se calculan las ubicaciones; con `id < 0` guarda por ruta en `ext_progress`)
- `get_external_progress(path) -> {cfi, pct}?`
- `list_annotations(key) -> Annotation[]`, `add_annotation(key, kind, loc, text, color, note) -> id`, `update_annotation(id, color?, note?)`, `delete_annotation(id)`  (Fase 5; `remove_book` borra las anotaciones `b:<id>`)
- `list_collections()`, `create_collection(name) -> id`, `delete_collection(id)`, `set_book_collection(bookId, collectionId, member)`
Tipo `Book` (camelCase en JS): `{ id, title, author, path, format, addedAt, coverMime, collectionIds, progressCfi, progressPct, lastReadAt, want, missing }`  (`missing` = el archivo ya no existe)
Eventos hacia la interfaz: `import-progress [hecho, total]`, `open-file <ruta>`.

Migraciones: usar `PRAGMA user_version`; cada fase que cambie el esquema sube la versión.

════════════════════════════════════════════════════════════════
## 8. CONVENCIONES
════════════════════════════════════════════════════════════════
- Código y comentarios en español; nombres de variables en inglés.
- La lista de extensiones vive en DOS lugares y debe mantenerse igual:
  `SUPPORTED` en `app/src-tauri/src/lib.rs` y `EXTENSIONS` en `app/src/App.tsx`.
- Eliminar un libro de la biblioteca borra solo la copia de Cinta (`Libros/`); nunca toca el archivo original del usuario.
- La interfaz respeta el tema claro/oscuro del sistema.

### Cómo compilar y ejecutar
Requisitos: Node.js, Rust (rustup), Visual Studio Build Tools con "Desarrollo para el escritorio con C++".
Para ARM64 agregar el componente "MSVC v143 C++ ARM64 build tools" y:
`rustup target add aarch64-pc-windows-msvc`
```
npm --prefix app install
npm --prefix app run tauri dev                       # desarrollo
npm --prefix app run tauri build -- --target x86_64-pc-windows-msvc --bundle nsis
npm --prefix app run tauri build -- --target aarch64-pc-windows-msvc --bundle nsis
# o ambos:  .\scripts\build-all.ps1
```

════════════════════════════════════════════════════════════════
## 9. REGISTRO DE ACTUALIZACIONES (más reciente al final)
════════════════════════════════════════════════════════════════

──────── ACTUALIZACIÓN 001 · 2026-11-12 · Fase 1: Base ────────
**Hecho**
- Proyecto Tauri 2 + React + TypeScript creado.
- SQLite con tabla `books`, comandos `list_books`, `add_books`, `remove_book`.
- Interfaz: barra lateral (Biblioteca / EPUB / PDF / Otros formatos), búsqueda,
  cuadrícula de portadas generadas por color, importar con botón o arrastrando archivos.
- Script `../scripts/build-all.ps1` para x64 y ARM64.
**Verificación**
- El código fue escrito pero NO compilado ni ejecutado (el entorno de desarrollo no tenía Rust ni Windows).
- Pendiente: correr `npm install` y `npm run tauri dev`; pegar aquí cualquier error.
**Pendiente / riesgos**
- Si el icono provisional da error, regenerar con `npx tauri icon ruta\imagen.png`.
- Verificar que el arrastrar y soltar entregue rutas en Windows (API `onDragDropEvent` de Tauri 2).
- Sin probar en ARM64.
**Siguiente**: Fase 2 (metadatos y portadas reales de EPUB/PDF, colecciones, escaneo de carpetas).

──────── ACTUALIZACIÓN 002 · 2026-11-12 · Fase 2: Biblioteca ────────
**Hecho**
- Migración de la base de datos a v2 (autor, portada, colecciones). Las bibliotecas de la Fase 1 se migran solas.
- EPUB: título, autor y portada leídos en Rust (`epub.rs`), soporta cover-image de EPUB 3 y `<meta name="cover">` de EPUB 2.
- PDF: título, autor y portada (primera página) generados con pdf.js en segundo plano, de a uno.
- Agregar carpetas completas (botón o arrastrando); recorre subcarpetas.
- Colecciones: crear, eliminar, asignar libros desde la tarjeta y filtrar desde la barra lateral.
- Búsqueda ahora incluye el autor.
- Todo el zip del proyecto (código + este archivo) se entrega junto en un solo archivo.
**Dependencias nuevas** (todas verificadas como Rust/JS puro o con SQLite embebido): `zip` (solo deflate), `roxmltree`, `walkdir`, `base64`, `pdfjs-dist` 4.x.
**Verificación**
- Código escrito, NO compilado ni ejecutado. La Fase 1 tampoco ha sido confirmada por el usuario.
- Pendiente: `npm install` y `npm run tauri dev`; probar con un EPUB y un PDF con y sin portada; pegar aquí cualquier error.
**Pendiente / riesgos**
- pdf.js 4.x necesita un WebView2 reciente (el de Windows 10/11 actualizado lo cumple); `build.target` en `esnext`.
- Si un PDF no se puede renderizar, queda con la portada de color; se reintenta al abrir la app.
- Rutas de la biblioteca guardadas tal cual; si el usuario mueve o borra el archivo, la Fase 3/4 debe avisar claramente.
- Sin probar en ARM64.
**Siguiente**: Fase 3 (lector EPUB: paginación, tabla de contenidos, temas, tipografía y progreso guardado).

──────── ACTUALIZACIÓN 003 · 2026-11-12 · Fase 3: Lector EPUB + táctil ────────
**Hecho**
- Lector EPUB (`Reader.tsx`) con epub.js: páginas, spread automático, tabla de contenidos, barra de progreso con
  porcentaje, título del capítulo, temas Claro / Sepia / Oscuro, tamaño de letra (70–220 %) y 3 tipografías.
- Preferencias del lector guardadas en `localStorage`; posición y porcentaje por libro guardados en SQLite (migración v3).
- Se reabre en la última posición. Nueva colección automática "Leyendo" (ordenada por última lectura) y barra de progreso en la portada.
- Táctil: deslizar, tocar bordes, pellizcar para el tamaño de letra, objetivos de 44 px, menú del libro (botón ⋯,
  pulsación larga o clic derecho) como hoja inferior con colecciones y "Quitar", barra lateral adaptable en vertical.
- Se escribieron las reglas del equipo del usuario (equipo ARM64) en la sección 3B.
**Dependencias nuevas**: `epubjs` 0.3.x (JS puro).
**Verificación**
- Código escrito, NO compilado ni ejecutado. Fases 1 y 2 tampoco confirmadas por el usuario.
- Pendiente de probar en el equipo ARM64: abrir un EPUB, deslizar, tocar bordes, pellizcar, cambiar tema, cerrar y reabrir.
**Pendiente / riesgos**
- Tocar bordes: el cálculo usa `container.scrollLeft` de epub.js para ubicar el toque dentro de la página; si los bordes
  no responden bien, ajustar en `registerGestures` (Reader.tsx).
- Los eventos táctiles se reciben a través de epub.js (el texto está dentro de un iframe); si el deslizar no responde, revisar ahí primero.
- El porcentaje no aparece hasta terminar de calcular ubicaciones (unos segundos en libros grandes).
- PDF todavía no se abre (Fase 4); otros formatos solo se importan.
**Siguiente**: Fase 4 (lector PDF con pdf.js: zoom con pellizco, miniaturas, búsqueda, mismo progreso guardado).

──────── ACTUALIZACIÓN 004 · 2026-11-12 · Fase 4: Lector PDF + base open source ────────
**Hecho**
- Lector PDF (`PdfReader.tsx`): scroll continuo con dibujado por demanda (solo las páginas cercanas), ajuste al ancho,
  zoom 50–400 % con botones, Ctrl + rueda y pellizco (vista previa inmediata y redibujado nítido al soltar),
  miniaturas, tabla de contenidos del PDF, búsqueda en todo el documento con lista de resultados y resaltado,
  indicador y barra de páginas, modo noche (invierte colores), reabre en la última página.
- El progreso del PDF usa el mismo comando `set_progress` (cfi = `p<página>`, pct = página / total); no hubo cambios en Rust.
- Abrir PDF desde la biblioteca; entra en "Leyendo" y muestra barra de progreso en la portada.
- Base open source: `../LICENSE` (MIT), `../README.md`, `../.github/CONTRIBUTING.md` (regla de sala limpia), `THIRD_PARTY_LICENSES.md`.
  `package.json` y `Cargo.toml` declaran `license = "MIT"`. Versión 0.4.2.
**Decisión**
- No se descompila ni se copia Apple Books. Reimplementación desde cero (sección 3C).
**Verificación**
- Código escrito, NO compilado ni ejecutado. Fases 1 a 3 tampoco confirmadas por el usuario.
- Probar en el equipo ARM64: abrir un PDF, pellizcar, desplazarse, miniaturas, buscar una palabra, modo noche, cerrar y reabrir.
**Pendiente / riesgos**
- Pellizco: mientras se pellizca, el navegador también puede desplazar la página (dos dedos); si se siente raro, ajustar en `PdfReader.tsx`.
- Los resaltados marcan el fragmento de texto completo donde aparece la palabra y no detectan coincidencias partidas entre fragmentos.
- PDFs escaneados no tienen texto: la búsqueda no encuentra nada (OCR queda fuera por ahora).
- Páginas de tamaños muy distintos: la altura estimada se corrige al dibujarlas, puede haber un pequeño salto.
- Revisar licencias con `cargo license` y `license-checker` antes de publicar (ver `THIRD_PARTY_LICENSES.md`).
**Siguiente**: Fase 5 (resaltados, notas y marcadores en EPUB y PDF; lápiz).

──────── ACTUALIZACIÓN 005 · 2026-11-12 · App portable + icono ────────
**Hecho**
- Modo portable (`lib.rs`): biblioteca (`library.db`) y perfil de WebView2 (localStorage: tema, zoom, etc.) se guardan en
  `FolioData\` junto al .exe. Si esa carpeta no es escribible, cae a `%APPDATA%\com.folio.reader`.
- `app/src-tauri/.cargo/config.toml`: runtime de C estático (`crt-static`) → no requiere instalar Visual C++ Redistributable.
- `../scripts/build-portable.ps1`: `tauri build --no-bundle` y copia `portable\Folio-portable-x64.exe` / `-arm64.exe`.
- Icono real (`icons/icon.ico` multitamaño 16–256 + `icon.png`), a partir de la imagen del usuario (hoja con marcador guinda sobre degradado naranja).
- `tauri.conf.json` sincronizado a versión 0.4.2.
**Verificación**: NO compilado (entorno sin Windows). Probar `.\scripts\build-portable.ps1 -Arch arm64` y ejecutar el .exe desde otra carpeta/USB.
**Pendiente / riesgos**
- Requiere WebView2 Runtime en el equipo (viene en Windows 11 y Windows 10 actualizado); no puede ir embebido en un solo .exe.
- Las rutas de los libros se guardan absolutas: si la carpeta portable se mueve a otro equipo/letra de unidad, los libros no se encuentran.
  Opción: guardar rutas relativas al .exe cuando el libro esté en la misma unidad.
- SQLite en modo WAL crea `library.db-wal/-shm`; cerrar la app antes de copiar/quitar el USB.
- Nombre del producto en revisión (el nombre cambia: productName, identifier, Cargo `name`, `folio_lib`, títulos, claves de localStorage, carpeta `FolioData`).

──────── ACTUALIZACIÓN 006 · 2026-11-12 · Nombre «Cinta» + portadas estilo Apple Books ────────
**Hecho**
- Renombrado: Folio → **Cinta** (por el marcador/cinta del icono). Cambió: `productName`, `identifier` (`com.cinta.reader`),
  crate `cinta` / `cinta_lib`, `package.json`, título de la ventana, claves de localStorage (`cinta.reader`, `cinta.pdf`),
  carpeta portable `CintaData`, scripts (`Cinta-portable-x64.exe`). El historial de arriba conserva el nombre antiguo a propósito.
- Portadas estilo Apple Books (`App.tsx` + `styles.css`): se respeta la proporción real de cada portada (ya no se recorta a 2:3),
  apoyada abajo en su celda, con lomo (brillo/pliegue a la izquierda), borde fino y sombra suave. Las portadas grandes se reducen
  a ~640 px de alto al cargarlas (rápido y nítido). Etiqueta de formato solo en los que no son EPUB. El progreso ahora es texto bajo el título
  («62 %» / «Terminado») en vez de barra sobre la portada. Portadas de PDF generadas a 600 px de ancho (antes 360) para pantallas de alta densidad.
**Verificación**: NO compilado (sin Windows). Probar con EPUB con portada vertical, cuadrada, y un PDF.
**Pendiente / riesgos**
- Si una portada sale con proporción rara, revisar `loadCover` (usa `createImageBitmap`, soportado por WebView2).
- Cambiar de nombre cambia la ruta de datos de la versión instalada (`%APPDATA%\com.cinta.reader`); en modo portable no afecta.
- Nombre sin verificar en registros de marcas; solo se buscó rápido en la web sin hallar un lector con ese nombre.

──────── ACTUALIZACIÓN 007 · 2026-11-12 · Estructura tipo Apple Books (parte 1) ────────
**Objetivo del usuario**: que Cinta sea "literalmente Apple Books pero en Windows" (Linux se porta al terminar). Se interpreta como
paridad de funciones y de organización, con recursos, iconos y textos propios (regla de sala limpia, sección 3C).
**Hecho (parte 1: biblioteca)**
- Barra lateral: Inicio · Quiero leer · Terminados · (Biblioteca) Libros · Audiolibros · PDF · Colecciones. Iconos propios en SVG.
- Inicio con estantes horizontales: Continuar (por última lectura), Quiero leer, Agregados recientemente, con «Ver todo ›».
- «Quiero leer»: migración v4 (`want`), comando `set_want`, casilla en el menú ⋯ del libro. «Terminados» es automático (≥ 99 %).
- Título grande de página, orden (Recientes / Título / Autor, se recuerda), la búsqueda abarca toda la biblioteca.
- Se reemplazan los filtros anteriores (Leyendo, EPUB, Otros formatos).
**Verificación**: NO compilado. Revisión de sintaxis de Rust (rustfmt) y TypeScript sin errores de sintaxis; falta compilar en Windows.
**Siguiente (por partes)**: 2) lector EPUB al estilo Apple Books (barras que aparecen al tocar, temas, tipografía, tabla de contenidos);
3) lector PDF; 4) Fase 5 de anotaciones (resaltados, notas, marcadores, lápiz); 5) vista de lista, vista de detalle del libro, Terminar/Marcar.

──────── ACTUALIZACIÓN 008 · 2026-11-12 · Biblioteca con copias + abrir sin agregar ────────
**Decisión del usuario**: seguir la filosofía de Apple Books → cada libro agregado se COPIA a la biblioteca de la app; al eliminarlo
se borra la copia, nunca el original. Además, poder abrir un libro sin agregarlo. (Se descartó por ahora un modo «enlace» sin copia.)
**Hecho**
- `add_books` copia a `CintaData\Libros` (rutas relativas, así sigue funcionando si la carpeta portable cambia de unidad o PC).
  Nombres repetidos → «libro (2).epub». No se importa dos veces el mismo original; lo arrastrado desde `Libros` no se duplica.
  La copia se hace sin bloquear la base de datos (comando async).
- `remove_book` borra solo la copia dentro de `Libros` (protegido contra rutas fuera de esa carpeta). Menú ⋯: «Eliminar de la biblioteca»
  con aviso. Las bibliotecas anteriores (rutas absolutas) solo se quitan de la lista.
- Abrir sin agregar: botón «Abrir archivo» (EPUB/PDF), arrastrar un libro sobre el .exe o «Abrir con» (`startup_file`).
  Se lee de su ubicación, no se copia ni se guarda progreso; el lector muestra «Agregar a la biblioteca».
- Migración v5 (`source`).
**Verificación**: NO compilado (sintaxis de Rust revisada con rustfmt). Probar: agregar desde Descargas, borrar el original y comprobar que
el libro sigue; eliminar en Cinta y comprobar que el original sigue; abrir sin agregar; mover la carpeta portable y reabrir.
**Pendiente / riesgos**
- Copiar duplica el espacio (decisión consciente). Opción futura: modo enlace o «mover» en vez de copiar.
- No hay «instancia única»: abrir un segundo libro con «Abrir con» abre otra ventana de Cinta.
- Las carpetas grandes pueden tardar al copiar; falta una barra de progreso de importación.
- Si se borra a mano un archivo de `Libros`, el libro queda en la lista y el lector muestra error al abrirlo (falta aviso «archivo no encontrado»).

──────── ACTUALIZACIÓN 009 · 2026-11-12 · Memoria de posición también sin agregar ────────
- Biblioteca: ya guardaba y restauraba la posición (EPUB por CFI, PDF por página; guardado con 0,7 s de retraso y al pulsar «Volver»).
- Nuevo: los archivos abiertos SIN agregar también recuerdan su posición, guardada por ruta del archivo (tabla `ext_progress`, migración v6).
  Si luego se agregan a la biblioteca, conservan esa posición.
**Verificación**: NO compilado. **Pendiente**: guardar también al cerrar la ventana de golpe (hoy se pierde lo de los últimos 0,7 s);
si el archivo se mueve de carpeta, la posición de un libro no agregado se pierde (clave = ruta).

──────── ACTUALIZACIÓN 010 · 2026-11-12 · Pendientes resueltos + lector EPUB (parte 2) ────────
**Pendientes de la 008/009 resueltos**
- Guardado al cerrar: ambos lectores guardan al instante con `beforeunload`, `pagehide` y al pasar a segundo plano.
- Archivo no encontrado: `list_books` devuelve `missing`; la tarjeta sale atenuada con «Archivo no encontrado», al abrirla avisa, y el menú ⋯ ofrece
  «Localizar archivo…» (`relink_book`: copia el archivo elegido a `Libros/`). Conserva progreso y colecciones.
- Progreso de importación: «Importando 4 de 20…» (evento `import-progress`, solo si son más de 3 archivos).
- Instancia única: «Abrir con» / arrastrar sobre el .exe con la app ya abierta envía el libro a la misma ventana (`open-file`) y la enfoca.
**Lector EPUB estilo Apple Books (parte 2)**
- Botón «Aa» abre una ventana flotante (no un panel lateral): tamaño de letra A/A, 4 temas redondos (Claro, Sepia, Gris, Oscuro),
  5 tipografías, interlineado (Original/Compacto/Normal/Amplio; «Original» respeta el del libro) y «Justificar texto».
- Botón «Buscar»: búsqueda en todo el libro capítulo por capítulo, resultados en vivo (máx. 300), al tocar salta a la posición.
- Las flechas del teclado no cambian de página mientras se escribe en el buscador.
**Verificación**: NO compilado (rustfmt y revisión de sintaxis TS sin errores). Probar: buscar una palabra, cambiar tema/interlineado/justificar y reabrir;
borrar a mano un archivo de `CintaData\Libros` y usar «Localizar archivo»; abrir un 2.º libro con «Abrir con».
**Pendiente / riesgos**
- Confirmar que `tauri-plugin-single-instance` compila en `aarch64-pc-windows-msvc` (regla 1 de la sección 3).
- Búsqueda: no resalta la palabra en la página; el interlineado/justificado depende de que el libro no fije estilos propios con más prioridad.
- Posición de libros no agregados se pierde si el archivo cambia de carpeta (clave = ruta).
**Siguiente**: lector PDF al estilo Apple Books (mismas ventanas «Aa»/buscar), luego Fase 5 (resaltados, notas, marcadores, lápiz).

──────── ACTUALIZACIÓN 011 · 2026-11-12 · Lector PDF estilo Apple Books ────────
**Hecho**
- `PdfReader.tsx` ahora usa la misma interfaz que el EPUB: barra superior Volver · Contenido · Buscar · «Aa» (se quitan los botones −, +, Noche/Día y «Panel»).
- Ventana flotante «Aa» (`.pop`): zoom con A/A (pasos de 10 %, muestra el %), los mismos 4 temas redondos (Claro, Sepia, Gris, Oscuro) y botón «Ajustar al ancho».
  Los temas tiñen la página con CSS (`.t-sepia`, `.t-gris`, `.t-oscuro` en styles.css); un PDF no se puede reflowar, por eso no hay tipografía ni interlineado.
  Compatibilidad: la preferencia antigua `night: true` de `cinta.pdf` se migra a tema Oscuro.
- «Contenido» abre el panel lateral con pestañas Contenido / Páginas (miniaturas); si el PDF no tiene índice abre en Páginas.
- «Buscar»: mismo panel y formulario que el EPUB («Buscar en el documento», Enter o botón), resultados con «Página N» + fragmento; atajo Ctrl+F.
- Resaltado de la búsqueda: ahora marca solo la palabra (antes marcaba todo el fragmento de texto) y encuentra varias coincidencias por fragmento.
- Esc cierra primero la ventana/panel y luego el lector.
**Verificación**: NO compilado (sin node_modules ni Windows). Revisión con tsc: solo errores por falta de dependencias, sin errores de sintaxis.
Probar: abrir un PDF, «Aa» → cambiar tema y zoom y reabrir, buscar una palabra y tocar un resultado, Ctrl+F, Contenido/Páginas, y un PDF con preferencia antigua en modo noche.
**Pendiente / riesgos**
- Resaltado aproximado: el ancho del fragmento se reparte por caracteres, puede desfasarse un poco con tipografías proporcionales; coincidencias partidas entre fragmentos siguen sin detectarse.
- Sepia/Gris usan `mix-blend-mode: multiply` sobre el lienzo: verificar que se vean bien en el equipo (WebView2) y con PDFs con fondos de color.
- Al tocar un resultado se va a la página, no al renglón exacto.
**Siguiente**: Fase 5 (marcadores, resaltados y notas en EPUB y PDF con lápiz). Se propone empezar por marcadores + resaltados en EPUB (migración v7, tabla `annotations`).

──────── ACTUALIZACIÓN 012 · 2026-11-12 · Fase 5 (parte 1): marcadores y resaltados en EPUB ────────
**Hecho**
- Backend: migración v7 (tabla `annotations`) y comandos `list/add/update/delete_annotation`. La clave es `b:<id>` o `p:<ruta>` (libros sin agregar).
- Marcador: botón ☆/★ en la barra superior del EPUB; marca o quita la página visible (se detecta con comparación de CFI).
- Resaltado: al seleccionar texto (ratón, dedo o lápiz) aparece una barra flotante con 4 colores (amarillo, verde, azul, rosa); tocar un resaltado permite cambiar el color o «Quitar».
  Se guardan en SQLite y se vuelven a pintar al abrir el libro (`rendition.annotations.highlight`).
- Panel «Contenido» ahora tiene pestañas Contenido / Marcadores / Resaltados (en orden de lectura, tocar = ir, ✕ = eliminar).
**Verificación**: NO compilado (sin rustfmt/cargo/node_modules aquí). Probar: seleccionar texto con ratón, con el dedo (pulsación larga) y con el lápiz; cerrar y reabrir; marcar/desmarcar página; borrar el libro y ver que no quedan anotaciones.
**Pendiente / riesgos**
- Selección táctil: el cuerpo del EPUB tiene `touch-action: none`; si la pulsación larga no selecciona, quitar esa regla en `applyPrefs` (Reader.tsx) y mover el deslizar a otra lógica.
- Resaltados en tema Oscuro: opacidad fija 0.4; ajustar si se ven apagados.
- Un libro abierto sin agregar y luego agregado pierde sus anotaciones (clave distinta); falta migrarlas en `add_books`.
- Aún no hay notas de texto (columna `note` lista), ni anotaciones en PDF, ni trazo a mano con el Pen.
**Siguiente**: anotaciones en PDF (marcador por página y resaltado sobre texto), luego notas y Pen.

──────── ACTUALIZACIÓN 013 · 2026-11-12 · Fase 5 (parte 2): anotaciones en PDF + respuesta táctil y animaciones ────────
**Anotaciones en PDF**
- Capa de texto de pdf.js (`pdfjs.TextLayer`, invisible) encima de cada página: permite seleccionar texto con ratón, dedo o Pen.
- Resaltado: barra de 4 colores (la misma del EPUB). Se guarda `loc = p<página>|<JSON [[x,y,w,h],…]>` en puntos de PDF, así sigue en su sitio con cualquier zoom. Tocar un resaltado = cambiar color o quitar.
- Marcador por página (☆/★ en la barra). Panel lateral con 4 pestañas: Contenido · Páginas · Marcadores · Resaltados.
- `PageView` ahora es `memo` (antes cada cambio de página volvía a renderizar todas las páginas).
- Tipos/colores compartidos en `src/annot.ts`.
**Táctil**
- EPUB: la página sigue al dedo mientras se desliza (con resistencia) y vuelve con un resorte si no se completa el gesto; no arrastra mientras se selecciona texto.
- PDF: doble toque = zoom (100 % ↔ 200 %) hacia el punto tocado; un toque = barras (con 260 ms de espera para distinguirlo del doble toque).
- Sin retardo de toque (`touch-action: manipulation`), sin resaltado gris al tocar, retroalimentación al presionar (los botones se encogen un poco).
**Animaciones** (curva `--ease` estilo iOS): pasar de página con deslizamiento + fundido; barras que se deslizan al ocultarse; ventana «Aa» con zoom suave; hojas inferiores y panel lateral que se deslizan; fundido del velo; barra de resaltado que sube; el lector se abre con un fundido; saltos cortos de página en PDF con desplazamiento suave.
Se respeta «Reducir movimiento» de Windows (`prefers-reduced-motion`): sin animaciones.
**Verificación**: NO compilado. Probar en el equipo: seleccionar texto en un PDF (dedo, Pen, ratón), resaltar, cambiar zoom y comprobar que el resaltado no se mueve; doble toque; deslizar en EPUB lento y rápido; abrir/cerrar paneles.
**Pendiente / riesgos**
- CSS de la capa de texto escrito a mano (no se importa `pdf_viewer.css`): si las palabras no coinciden con el texto dibujado, revisar `--scale-factor` / `--total-scale-factor` en `.textLayer`.
- Doble toque sobre texto: el navegador selecciona la palabra; se limpia la selección al hacer zoom.
- El arrastre del EPUB usa transform en `.stage`; si se ve parpadeo en el equipo, probar `will-change: transform`.
- Resaltados de PDF multi-página (selección que cruza páginas) solo guardan la primera página.
- Sigue pendiente: migrar anotaciones al agregar un libro abierto sin agregar.
**Siguiente**: notas de texto sobre resaltados y trazo con lápiz (Pointer Events `pen`), luego vista de lista/detalle.

──────── ACTUALIZACIÓN 014 · 2026-11-12 · Auditoría para reducir errores de compilación ────────
**Qué se verificó (sin Windows ni Rust en el entorno)**
- TypeScript en modo estricto (misma configuración de `tsconfig.json`) sobre todo `src/`, con declaraciones de tipos de apoyo para React, Tauri y epubjs: sin errores propios tras las correcciones.
  Los avisos restantes eran de las declaraciones de apoyo o de comparar con pdf.js 6 en lugar de 4.10, no del código.
- Rust: delimitadores balanceados en `lib.rs`; revisión manual de lo nuevo (migración v7, 4 comandos de anotaciones, registro en `generate_handler!`). Rust NO se pudo compilar.
**Errores reales encontrados y corregidos (App.tsx)**
1. `useEffect` de «open-file» e «import-progress» usaba `openExternal` en su lista de dependencias ANTES de declararlo → en ejecución daba «Cannot access 'openExternal' before initialization» y la app se quedaba en blanco. Movido después de su declaración.
2. `.then((p) => p && openExternal(p))` devolvía un tipo no válido → `tsc` fallaba y `npm run build` (que ejecuta `tsc && vite build`) habría cortado `tauri build`. Cambiado a un bloque con `if`.
**Comprobación rápida antes de compilar todo**
```
npm install
npm run typecheck                       # nuevo: tsc --noEmit, tarda segundos
cargo check --manifest-path app/src-tauri/Cargo.toml --target aarch64-pc-windows-msvc   # errores de Rust sin generar el .exe
npm run tauri build -- --target aarch64-pc-windows-msvc --no-bundle
```
**Riesgos que siguen abiertos**: que alguna dependencia de Rust cambie de API respecto a lo escrito (rusqlite 0.32, zip 2, tauri-plugin-single-instance en ARM64), y el comportamiento real de selección táctil y capa de texto de pdf.js (solo se ve ejecutando).

──────── (agregar nuevas actualizaciones debajo de esta línea) ────────

──────── ACTUALIZACIÓN 015 · 2026-11-12 · Depuración completa (sin poder compilar) ────────
**Error que impedía compilar (Rust)**
1. `lib.rs` llamaba a `portable_dir()` y esa función NO existía → `cargo build` fallaba. Implementada: `CintaData` junto al .exe si es escribible; si no, `%APPDATA%\com.cinta.reader`.
**Errores de comportamiento corregidos**
2. `Reader.tsx`: el atajo de teclado dentro del EPUB usaba un `onKey` viejo → Escape cerraba el libro aunque hubiera un panel abierto. Ahora usa `onKeyRef`.
3. `PdfReader.tsx`: si se cerraba el PDF mientras cargaba, se llamaba `setPdf` con un documento ya destruido.
4. `styles.css`: `.cover-slot .cover { width:100% }` pisaba la proporción de portadas más altas que 2:3 (quedaban estiradas). Ahora solo afecta a la portada generada.
5. `lib.rs`: `fs::copy` conserva «solo lectura» → en Windows `remove_book` no podía borrar la copia. Ahora se quita ese atributo antes de borrar.
6. `lib.rs`: `startup_file` usaba `env::args()` (pánico con rutas no Unicode) → `args_os()`. WAL de SQLite ya no es fatal si la unidad no lo admite (USB exFAT/red).
7. `App.tsx`: errores de `invoke` (agregar, eliminar, leer biblioteca, portadas) ahora se muestran o se ignoran en vez de quedar como promesas rechazadas.
8. `Reader.tsx`/`PdfReader.tsx`: `localStorage.setItem` protegido con try/catch.
9. `../scripts/build-all.ps1`: `--bundle` → `--bundles` (nombre real de la opción). Ambos .ps1 ahora se detienen si un comando falla; `../scripts/build-portable.ps1` borra el .exe anterior (no copia uno viejo) y avisa si falta un target de Rust.
10. `.gitignore`: `portable` y `CintaData`.
**Verificación**: sintaxis TS (0 errores) y Rust (rustfmt) revisadas; entorno sin red ni Windows → NO compilado. Guía: `COMPILAR.md`.

### Actualización — Notas de texto en resaltados (Fase 5b, parte 1)
- Nuevo `src/NoteDialog.tsx`: editor de nota (texto citado + textarea; Ctrl+Enter guarda, Esc cancela).
- `Reader.tsx` y `PdfReader.tsx`: botón «Nota» en la barra de selección. Sobre texto nuevo crea un resaltado amarillo y abre la nota; sobre un resaltado existente edita su nota. La nota se guarda con `update_annotation` (columna `note`, sin cambios en Rust ni en la base de datos) y se muestra en cursiva en el panel Resaltados.
- `styles.css`: `.notebox`, `.notequote`, `.noterow`, `.ann-note`.
- Pendiente de la Fase 5b: lápiz (Pointer Events `pointerType === "pen"`: resaltar y escribir a mano).
- **Verificación**: sin node_modules ni red en este entorno → NO compilado ni probado; ejecutar `npm run typecheck`.

### Actualización — Lápiz en el lector PDF (Fase 5b, parte 2)
- Nuevo `src/InkLayer.tsx`: capa SVG por página. El lápiz (y el ratón) dibujan; el grosor sale de la presión del lápiz; el dedo desplaza la página (`panBy`); el pellizco sigue usando los manejadores táctiles existentes. El botón del borrador del lápiz o el modo «Borrar» eliminan el trazo tocado.
- Los trazos se guardan como anotaciones `kind = "ink"`, `loc = p<página>|{"w":grosor,"pts":[[x,y],…]}` en puntos de PDF (independiente del zoom). `annot.ts`: tipo `ink` y paleta `INK_COLORS`.
- `lib.rs`: `add_annotation` acepta `"ink"`. Sin cambios de esquema.
- `PdfReader.tsx`: botón «Lápiz» en la barra superior y barra flotante (4 colores, Borrar, Listo).
- Pendiente: tinta en EPUB (el texto fluye y no hay coordenadas fijas), deshacer/rehacer, exportar anotaciones.
- **Verificación**: sin node_modules ni red → NO compilado. Revisado con `tsc` parcial: solo errores por tipos de React ausentes. Ejecutar `npm run typecheck`.

### Actualización — Vista de lista y detalle del libro (Fase 7, parte 1)
- `App.tsx`: interruptor Cuadrícula/Lista en la barra (se recuerda en `localStorage` `cinta.view`; no aparece en Inicio). Nuevos componentes `BookRow` (portada pequeña, título, autor, formato, barra de progreso, fecha de agregado) y `BookDetail` (portada grande, Leer/Continuar/Leer de nuevo/Escuchar, Quiero leer, progreso, formato, fechas, ubicación y colecciones).
- El detalle se abre con «Ver detalles» en el menú ⋯ del libro (tarjeta o fila).
- `styles.css`: `.seg`, `.list`, `.row*`, `.bar`, `.detail*`, `.chip`; adaptable a ≤ 820 px y objetivos táctiles de 44+ px.
- Sin cambios en Rust.
- **Verificación**: sin node_modules ni red → NO compilado; `tsc` parcial solo muestra errores por tipos de React ausentes. Ejecutar `npm run typecheck`.

### Actualización — Reproductor de audiolibros (Fase 8, parte 1)
- Nuevo `src/AudioPlayer.tsx` (M4B, M4A, MP3): reproducir/pausar, retroceder 15 s / adelantar 30 s, barra de posición, velocidad (0,75×–2×, se recuerda en `cinta.audio.speed`), temporizador de sueño (15–60 min), marcadores por tiempo (anotación `bookmark` con `loc = t<segundos>`), teclas multimedia (Media Session) y atajos (Espacio, ←, →, Esc).
- Progreso: `set_progress` con `cfi = t<segundos>` y `pct = tiempo/duración`, cada 5 s, al pausar y al cerrar; se reanuda donde se quedó. Funciona también con «Abrir archivo» (id −1).
- `App.tsx`: `openBook` y `openExternal` abren audio con `AudioPlayer`, pasándole la portada.
- Limitación conocida: el archivo se carga completo en memoria (Blob) vía `read_book_file`. Para M4B de varios cientos de MB lo ideal es streaming con el protocolo `asset` de Tauri (rutas relativas de la copia en biblioteca requieren resolverse en Rust). No hay lectura de capítulos MP4 todavía.
- Sin cambios en Rust.
- **Verificación**: sin node_modules ni red → NO compilado ni probado con audio real. Ejecutar `npm run typecheck`.

### Actualización — Formatos extra (Fase 9)
- Nuevo `src/convert.ts`: conversores a HTML en JS puro (ARM64 seguro). TXT (UTF-8 o Windows-1252), HTML (saneado: sin scripts, estilos, formularios ni eventos), DOCX (`mammoth`, carga dinámica), FB2 (XML propio con portada, poemas e imágenes) y MOBI/AZW3 (PDB + PalmDOC, imágenes por `recindex`, sin DRM).
- Nuevo `src/DocReader.tsx`: lector de texto en `iframe` aislado (`sandbox="allow-same-origin"`, sin scripts), temas claro/sepia/oscuro, tamaño de letra, progreso por posición de scroll (`cfi = s<fracción>`), deslizador. Preferencias en `localStorage` `cinta.doc`.
- Nuevo `src/ComicReader.tsx`: CBZ (y CBR que en realidad sean ZIP) con `jszip`; orden natural de páginas, precarga, ajuste alto/ancho, modo manga (derecha a izquierda), toque en bordes y teclado; progreso `cfi = p<índice>`.
- `App.tsx`: constantes `DOCS`, `COMICS`, `READABLE`; `openBook` y `openExternal` abren estos formatos.
- `package.json`: nuevas dependencias `jszip` y `mammoth` → ejecutar `npm install`. Licencias añadidas a `THIRD_PARTY_LICENSES.md`.
- Limitaciones conocidas: AZW3 es solo lectura de la parte MOBI 6 (KF8 puro y HUFF/CDIC no soportados), sin DRM; CBR en formato RAR real no se lee (se pide convertir a CBZ); sin índice, búsqueda ni resaltados en el lector de texto; sin portadas reales para estos formatos.
- **Verificación**: sin node_modules ni red → NO compilado ni probado con archivos reales. Ejecutar `npm install` y `npm run typecheck`.

### Actualización — Atajos, rendimiento e instalador firmado (Fase 10)
- Atajos (`App.tsx`): Ctrl+F o `/` buscar; Ctrl+O agregar libros; Ctrl+Mayús+O abrir archivo; Ctrl+Mayús+A agregar carpeta; Ctrl+1…6 secciones; Alt+1/Alt+2 cuadrícula/lista; F1 o `?` ayuda (componente `ShortcutsHelp`, botón ⌨ en la barra); Esc cierra ventana/menú/detalle. Se desactivan dentro de un lector (cada lector tiene sus teclas).
- Rendimiento: portadas con carga perezosa (`IntersectionObserver`, margen 400 px) y como máximo 3 decodificaciones simultáneas; `content-visibility: auto` en tarjetas y filas; en Rust, `read_book_file` y `get_cover` pasan a `async` para no bloquear el hilo principal con archivos grandes (PDF, audiolibros).
- Firma: `tauri.conf.json` con `digestAlgorithm` y `timestampUrl`; nuevo `../scripts/build-signed.ps1` (instalador NSIS + portable firmado con signtool, huella por parámetro o `CINTA_CERT_THUMBPRINT`, config temporal) y `SIGNING.md` (certificados, SmartScreen, autofirmado de prueba).
- Pendiente de esta fila: medir rendimiento real con una biblioteca grande (≥ 1000 libros) y valorar virtualizar la cuadrícula; firmar de verdad requiere un certificado que tú debes obtener.
- **Verificación**: sin Windows, Rust ni node_modules → NO compilado ni probado. Ejecutar `cargo check` (cambio `async` en dos comandos), `npm run typecheck` y probar atajos.

### Actualización — Lector de texto con índice, búsqueda, marcadores y resaltados (Fase 11)
- `DocReader.tsx` reescrito. Posiciones = desplazamiento en el texto concatenado del `<body>` (independiente de tema y tamaño de letra).
- Índice automático con los títulos `h1–h3` (pestaña Contenido). Búsqueda de texto (hasta 300 resultados, con fragmento; al tocar uno se selecciona y se centra). Marcadores por posición de pantalla (anotación `bookmark`, `loc = s<fracción>`). Resaltados en 4 colores con notas (`NoteDialog`; anotación `highlight`, `loc = o<inicio>-<fin>`), repintados con `<mark data-ann>`; tocar un resaltado lo edita (color, nota, quitar). Panel lateral con pestañas Contenido / Marcadores / Resaltados.
- Sin cambios en Rust ni en la base de datos.
- Limitaciones: los resaltados dependen del texto convertido; si se cambia la forma de convertir un formato en el futuro, los desplazamientos guardados podrían quedar desalineados. Búsqueda sin ignorar acentos.
- **Verificación**: sin node_modules ni red → NO compilado ni probado. Ejecutar `npm run typecheck`.

### Actualización — Guía de Cinta incluida por defecto (Fase 12)
**Pedido del usuario**: la app debe traer un libro por defecto que sea la guía de toda la aplicación, con la portada que él aportó, y que quede disponible después de compilar.
**Hecho**
- Nuevo libro **«Guía de Cinta»** (EPUB 3, 13 secciones en español: bienvenida, empezar, biblioteca, agregar libros, formatos, EPUB, PDF, anotaciones y lápiz, texto/cómics/audio, atajos y gestos, privacidad, problemas frecuentes, acerca de). Escrito a partir de las funciones y etiquetas reales de la interfaz de esta versión. Tema neutro (sirve en Claro, Sepia, Gris y Oscuro).
- Fuente y generador en `guia/` (`construir.py`, solo biblioteca estándar de Python, + `portada.jpg`). Salida: `app/src-tauri/assets/Guia-de-Cinta.epub`.
- `lib.rs`: `GUIDE_EPUB = include_bytes!("../assets/Guia-de-Cinta.epub")` → va DENTRO del .exe (portable e instalador), nada que copiar tras compilar. Nueva función `install_guide` (se llama en `setup`, después de `migrate`): al primer arranque copia el EPUB a `CintaData\Libros\Guia-de-Cinta.epub`, lo agrega a `books` con título, autor y portada leídos con `epub::read_meta`, y `source = "cinta:guia"`.
- Marca `CintaData\.guia` con `GUIDE_VERSION` ("1"): no se reinstala en cada arranque; si el usuario elimina la guía, no vuelve (recuperarla = borrar `.guia`); si una versión nueva de Cinta sube `GUIDE_VERSION` y el usuario aún la tiene, se reemplaza su copia sin duplicar. Nunca es fatal: si algo falla, la app arranca igual. Sin cambios de esquema ni de interfaz.
- Aparece en Inicio → «Agregados recientemente» y en Libros; al eliminarla se borra solo su copia (regla normal).
**Verificación**
- La lógica de `install_guide` (copiada tal cual de `lib.rs`) se compiló y probó en un arnés aparte con SQLite y el esquema real (`migrate`): primer arranque, segundo arranque sin duplicar, eliminación respetada, recuperación borrando `.guia` y actualización de versión: todo OK. Probado con rustc 1.75 y rusqlite 0.31 (la API usada es la misma que en 0.32).
- El EPUB se validó como XML bien formado, con `mimetype` sin comprimir y lectura correcta de título, autor y portada. NO se ha abierto aún dentro de Cinta ni compilado el proyecto completo (sin Windows). Ejecutar `cargo check` y abrir la guía en la app.
**Pendiente / riesgos**
- La portada original mide 343 × 512 px (ampliada al doble): conviene una versión de mayor resolución en `guia/portada.jpg`.
- Con la guía instalada la biblioteca nunca está vacía en el primer arranque, así que no se ve el aviso «Tu biblioteca está vacía»; si se quiere conservar esa pantalla, mostrar un banner de bienvenida o ignorar la guía en `books.length === 0`.
- La guía describe la interfaz actual: al cambiar nombres de botones o atajos, actualizar `guia/construir.py`, regenerar y subir `GUIDE_VERSION`.
- Revisar en pantalla (equipo ARM64) cómo se ven los cuadros de colores, tablas y emojis con los 4 temas y las 5 tipografías.


### Actualización — Repositorio ordenado para publicación (v0.4.2)
- La aplicación completa (interfaz, `package.json`, Vite, TypeScript y backend Tauri) se movió a `app/`. La raíz solo conserva `README.md`, `LICENSE`, `.gitignore`, `docs/`, `scripts/`, `guia/` y `.github/`.
- `app/src-tauri/tauri.conf.json` no cambió: sigue usando `frontendDist: "../dist"` y `npm run build`, ahora relativos a `app/`.
- El workflow de Windows usa `working-directory: app`; los artefactos se publican desde `app/release/`.
- Los scripts de `scripts/` se ejecutan desde la raíz y llaman a `npm --prefix app`.
- **Verificación**: `npm --prefix app run typecheck` y `npm --prefix app run build` correctos; `tauri info` detecta el proyecto en `app/`; enlaces locales y YAML validados.

### Actualización — Versión para Linux (v0.4.2)
- Nuevo trabajo **Linux x64** en `.github/workflows/build.yml` (renombrado desde `build-windows.yml`): instala WebKitGTK 4.1 y compila `.deb` y AppImage con Tauri.
- Artefactos con nombres estables: `Cinta-linux-x64.AppImage` y `Cinta-linux-x64.deb`.
- `tauri.conf.json` incluye iconos PNG estándar (32, 128, 256 y 512) además del `.ico`, y metadatos de paquete (editor, licencia, descripción y categoría) para que el `.deb` se vea bien en Linux.
- La app usa `CintaData` junto al ejecutable si se puede escribir; si no (por ejemplo, instalada en `/usr/bin` o dentro de un AppImage), usa `~/.local/share/com.cinta.reader`.
- **Verificación**: ejecución real de GitHub Actions en Ubuntu correcta (run `43351566471`); los paquetes Linux se publicaron en la release.

### Actualización — Texto público sin dispositivos concretos (v0.4.2)
- Se reescribieron `README.md`, `.github/CONTRIBUTING.md` y `docs/README.md` con un tono más cercano y una invitación clara al feedback y a contribuir.
- Se eliminaron todas las referencias a un dispositivo concreto (marca y modelo) del README, las notas de la release, la guía incluida en la app, la documentación y los comentarios del código. Ahora el texto describe qué hace Cinta, sin nombrar equipos.
- La guía (`guia/construir.py`) se regeneró y se subió `GUIDE_VERSION` a `2`.
- **Verificación**: `npm --prefix app run typecheck` correcto; la guía regenerada no contiene referencias al dispositivo; ejecución de GitHub Actions `43354260443` (Linux x64, Windows x64 y Windows ARM64) correcta; release con 7 assets actualizada.


──────── ACTUALIZACIÓN 016 · 2026-11-13 · Conservar anotaciones al importar un libro externo ────────
**Problema detectado**
- Si un libro se abría sin agregar y se anotaba, sus anotaciones quedaban bajo la clave `p:<ruta>`. Al agregarlo después, la biblioteca pasaba a consultarlas con `b:<id>`, por lo que parecía que se habían perdido.

**Cambio realizado**
- En `add_books`, después de insertar correctamente el libro y recuperar su ID, se migran las anotaciones de la ruta original exacta a `b:<id>`.
- Se conservan marcadores, resaltados, notas y trazos de lápiz sin duplicarlos ni cambiar sus posiciones.
- Solo se migran las anotaciones cuando la importación crea realmente un nuevo registro; no se modifica el archivo original.

**Verificación**
- Cambio guardado en la rama `redesign/desktop-apple-books`, commit `5cacad9feec780fcc9d329e941d7456c52aa162b`.
- Pendiente: ejecutar `cargo check`, `npm run typecheck` y probar el flujo completo (abrir sin agregar → anotar → agregar → comprobar las anotaciones).
- No se ha probado todavía en Windows ni Linux.

**Siguientes carencias identificadas para fases posteriores**
- Streaming de audiolibros grandes y lectura de capítulos/índice M4B.
- Búsqueda de texto sin distinguir acentos en el lector de documentos.
- Exportación/importación de anotaciones y deshacer/rehacer trazos.
- Soporte de CBR RAR real y compatibilidad completa KF8/AZW3.
- Portadas y metadatos reales para más formatos.
- Medición y optimización con bibliotecas grandes (≥ 1000 libros).


──────── ACTUALIZACIÓN 017 · 2026-11-13 · Navegación de referencias y notas al pie EPUB ────────
**Problema detectado**
- Al pulsar una llamada o referencia interna de un EPUB, epub.js puede navegar al destino, pero Cinta no conservaba una acción propia para regresar a la posición exacta de lectura.

**Cambio realizado**
- `Reader.tsx`: se registra en fase de captura el CFI del enlace interno antes de que epub.js procese la navegación. Se admiten referencias `#ancla` y destinos relativos en otros XHTML; se excluyen enlaces externos y esquemas como `mailto:`.
- Se agrega un historial de posiciones y el control de escritorio «↶ Referencia» para volver al punto de origen. También se admite `Alt + ←`.
- La captura usa los elementos del documento del iframe sin `instanceof Element` del documento principal, evitando el problema de constructores entre realms.
- El guardado de notas ya no cierra el editor si falla la escritura: informa el error y permite reintentar.
- El control visual de regreso se limita a escritorio; no se cambia la presentación móvil.

**Verificación pendiente**
- GitHub Actions debe ejecutar TypeScript, Vite y los paquetes de Windows/Linux sobre el commit final.
- Falta probar con EPUB reales que incluyan notas al pie, destinos en otros XHTML, enlaces `#ancla` y backlinks. No se declara todavía como verificado en ejecución.


**Preparación de publicación 0.4.2**
- `app/package.json`, `app/package-lock.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock` y `app/src-tauri/tauri.conf.json` quedan sincronizados en la versión `0.4.2`.
- El workflow incorpora un trabajo de publicación condicionado a etiquetas `v*`: descarga los artefactos Linux/Windows, valida que haya al menos nueve archivos no vacíos y crea o actualiza la GitHub Release con los instaladores y paquetes.
- La publicación real solo ocurrirá al crear la etiqueta `v0.4.2` después de integrar y verificar los cambios en `main`.

──────── ACTUALIZACIÓN 018 · 2026-11-13 · v0.4.5 · Estructura en español + registros ────────
- Reorganización de carpetas y nuevo `registro/` (cambios, versiones, pendientes). Detalle y lista «Falta por hacer» en `registro/REGISTRO-DE-CAMBIOS.md`.
- Sin cambios de comportamiento. Sin compilar en este entorno: verificar con `npm ci && npm run typecheck && npm run build`.

──────── ACTUALIZACIÓN 019 · 2026-11-13 · v0.5.0 · Vista «Notas» + orden ampliado ────────
- Nueva vista Notas (`aplicacion/src/vistas/Notas.tsx`) y comandos Rust `list_all_annotations`, `save_text_file`. Detalle y «Falta por hacer» en `registro/REGISTRO-DE-CAMBIOS.md`. Sin compilar en este entorno.

──────── ACTUALIZACIÓN 020 · 2026-11-13 · v0.5.1 · Editar libro + copia de seguridad ────────
- Nuevos `EditarLibro.tsx`, `CopiaSeguridad.tsx` y comandos Rust `set_book_cover_file`, `backup_library`, `restore_library`. Detalle y «Falta por hacer» en `registro/REGISTRO-DE-CAMBIOS.md`. Sin compilar en este entorno.

──────── ACTUALIZACIÓN 021 · 2026-11-13 · v0.5.2 · Meta diaria de lectura ────────
- Nuevos `MetaLectura.tsx`, `utilidades/metas.ts`, `estilos/metas.css`. Detalle y «Falta por hacer» en `registro/REGISTRO-DE-CAMBIOS.md`. Sin compilar en este entorno.

──────── ACTUALIZACIÓN 022 · 2026-11-13 · v0.5.3 · Saltar a la nota + «Leyendo» ────────
- `openBookAt` en `App.tsx`, notas clicables en `vistas/Notas.tsx`, filtro `reading`. Detalle en `registro/REGISTRO-DE-CAMBIOS.md`. Sin compilar en este entorno.

──────── ACTUALIZACIÓN 023 · 2026-11-13 · v0.5.4 · Marcar terminado / no leído ────────
- `markRead` en `App.tsx` (usa `set_progress`). Detalle en `registro/REGISTRO-DE-CAMBIOS.md`. Sin compilar en este entorno.

──────── ACTUALIZACIÓN 024 · 2026-11-13 · v0.6.0 · Series, estadísticas, voz, desplazamiento, ancho, copiar cita ────────
- `lib.rs` (migración 8, `log_reading`, `reading_log_all`, `set_book_info` con serie), `utilidades/metas.ts` (ahora en SQLite), `lectores/Reader.tsx`, `EditarLibro.tsx`, `App.tsx`. Detalle y «Falta por hacer» en `registro/REGISTRO-DE-CAMBIOS.md`. Sin compilar en este entorno.

──────── ACTUALIZACIÓN 025 · 2026-11-14 · v0.6.1 · Temas de color + fondo personalizado adaptativo ────────
- Nuevos `estilos/temas.css` (importado al final desde `main.tsx`), `estilos/apariencia.css`, `utilidades/fondo.ts` (lógica pura de colores), `utilidades/temas.ts`, `componentes/Apariencia.tsx`; script anti-parpadeo en `index.html`; comandos Rust `set_background`, `save_background`, `get_background`, `clear_background` y carpeta `Fondos` (incluida en la copia de seguridad). «Automático» no tiene reglas CSS: es la 0.6.0 exacta. Pruebas: `herramientas/verificacion/probar-fondo.mjs` y `contraste-temas.mjs`. Detalle, ajustes de contraste y «Falta por hacer» en `registro/REGISTRO-DE-CAMBIOS.md`. Sin compilar en este entorno.

### Actualización — Se retira la animación «Hoja de libro» (v0.7.1)
Se eliminan `utilidades/hoja.ts`, sus estilos y la opción del panel «Aa»: la hoja plana con perspectiva no igualaba el pase de hoja de Apple Books. Las preferencias guardadas con `anim: "hoja"` se migran a «Deslizar» en `loadPrefs`. Se mantiene la doble página (`MIN_DOBLE = 800` en `Reader.tsx`). La guía mantiene entera la lista «Qué encontrarás» (`GUIDE_VERSION` = 5).

### Actualización — Desenfoque de la imagen de fondo (v0.7.2)
El deslizador «Desenfoque» pasa de difuminar los paneles a difuminar la imagen: variable `--fondo-img-blur` (la fija `calcularPaleta`), `filter: blur` sobre `.fondo-capa img` con la imagen agrandada 2,5 × el desenfoque por lado. `--fondo-blur` (cristal de los paneles) ya no se escribe en `<html>`: es fijo en `temas.css`. Guardado como `desenfoqueImagen` en `cinta.fondo`; `GUIDE_VERSION` = 6.

──────── ACTUALIZACIÓN 026 · 2026-11-14 · v0.7.2 · Versión principal (sustituye a 0.7.0 y 0.7.1) ────────
La 0.7.2 queda como **única versión publicada**: las releases y etiquetas v0.7.0 y v0.7.1 se eliminan por descontinuadas. Motivos: la 0.7.0 traía una «Hoja de libro» que no igualaba a Apple Books (hoja rígida, plana, sombra fuera del borde y reverso gris) y el desenfoque del fondo no difuminaba la imagen; la 0.7.1 retiró la animación y arregló la guía, pero seguía con el desenfoque roto. La 0.7.2 corrige el desenfoque (`--fondo-img-blur`, `filter: blur` sobre la imagen, `desenfoqueImagen`) y conserva la doble página, las fuentes a la vista y los marcapáginas SVG de la 0.7.0. La entrega sigue en 9 archivos exactos. Detalle y «Falta por hacer» en `registro/REGISTRO-DE-CAMBIOS.md`.
