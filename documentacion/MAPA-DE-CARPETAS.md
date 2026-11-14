# Mapa de carpetas de Cinta

```
Cinta/
├─ README.md                 Presentación pública y descargas (GitHub lo exige en la raíz)
├─ LICENSE                   Licencia MIT
├─ AGENTS.md                 Reglas para IAs/agentes (convención, se queda en la raíz)
├─ .github/                  Workflow de compilación (build.yml) y guía para contribuir
├─ aplicacion/               La app
│  ├─ index.html, package.json, vite.config.ts, tsconfig.json
│  ├─ src/                   Interfaz (React + TypeScript)
│  │  ├─ main.tsx, App.tsx   Arranque y pantalla principal/biblioteca
│  │  ├─ lectores/           Reader (EPUB), PdfReader, ComicReader, DocReader, AudioPlayer
│  │  ├─ vistas/             Notas (todas las notas y resaltados)
│  │  ├─ componentes/        AppleIcon (iconos), NoteDialog (notas), InkLayer (lápiz)
│  │  ├─ utilidades/         annot (anotaciones), pdf (pdf.js), convert (DOCX/FB2/MOBI→HTML)
│  │  └─ estilos/            styles.css
│  └─ src-tauri/             Núcleo en Rust (nombre fijo de Tauri, no renombrar)
│     ├─ src/                lib.rs (comandos y base SQLite), epub.rs, main.rs
│     ├─ assets/             Guia-de-Cinta.epub incrustada
│     └─ icons/, capabilities/, tauri.conf.json, Cargo.toml
├─ documentacion/
│  ├─ guias/                 COMPILAR, COMPILACIONES, SIGNING, OPENCODE-LINUX, PROMPT-PARA-OPENCODE
│  ├─ proyecto/              CONTEXT.md (decisiones e historial 001–017), diseño Apple Books
│  └─ legal/                 Licencias de terceros
├─ herramientas/
│  ├─ compilacion/           compilar-todo / compilar-portable / compilar-firmado (.ps1)
│  ├─ verificacion/          verificar-release.mjs (versiones y workflow)
│  └─ guia-incluida/         construir.py + portada.jpg que generan la Guía de Cinta
└─ registro/                 REGISTRO-DE-CAMBIOS, REGISTRO-DE-VERSIONES, PENDIENTES
```

## Equivalencias con las rutas antiguas (para leer CONTEXT.md histórico)
| Antes | Ahora |
|---|---|
| `app/` | `aplicacion/` |
| `app/src/Reader.tsx`, `PdfReader`, `ComicReader`, `DocReader`, `AudioPlayer` | `aplicacion/src/lectores/` |
| `app/src/AppleIcon`, `NoteDialog`, `InkLayer` | `aplicacion/src/componentes/` |
| `app/src/annot`, `pdf`, `convert` | `aplicacion/src/utilidades/` |
| `app/src/styles.css` | `aplicacion/src/estilos/styles.css` |
| `docs/` | `documentacion/` (`guias/`, `proyecto/`, `legal/`) |
| `scripts/build-all.ps1` etc. | `herramientas/compilacion/compilar-todo.ps1` etc. |
| `scripts/verificar-release.mjs` | `herramientas/verificacion/verificar-release.mjs` |
| `guia/` | `herramientas/guia-incluida/` |
| `PROMPT-PARA-OPENCODE.md` | `documentacion/guias/PROMPT-PARA-OPENCODE.md` |

Los nombres de archivos de código (`Reader.tsx`, etc.) no se tradujeron para no romper imports ni mezclar idiomas en el código; la etiqueta en español está en la carpeta.
