# Licencias de terceros

Cinta usa estos componentes de código abierto. Las licencias indicadas son las declaradas por cada proyecto;
antes de publicar una versión, verifícalas con `cargo license` y `npx license-checker`.

| Componente | Uso | Licencia |
|---|---|---|
| Tauri | Marco de la aplicación | MIT o Apache-2.0 |
| React, React DOM | Interfaz | MIT |
| Vite, @vitejs/plugin-react | Compilación del frontend | MIT |
| epub.js (`epubjs`) | Lector EPUB | BSD-2-Clause |
| PDF.js (`pdfjs-dist`) | Lector PDF y portadas | Apache-2.0 |
| JSZip (`jszip`) | Lector de cómics CBZ | MIT o GPL-3.0 (se usa bajo MIT) |
| mammoth | Conversión de DOCX a HTML | BSD-2-Clause |
| rusqlite | Base de datos | MIT |
| SQLite | Motor de la base de datos (embebido) | Dominio público |
| zip | Lectura de archivos EPUB | MIT |
| roxmltree | Lectura de XML | MIT o Apache-2.0 |
| walkdir | Recorrer carpetas | Unlicense o MIT |
| base64 | Codificación de portadas | MIT o Apache-2.0 |

WebView2 (el motor web de Windows) es un componente de Microsoft que se instala aparte y no se distribuye dentro de Cinta.
