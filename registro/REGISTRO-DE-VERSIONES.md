# Registro de versiones de Cinta

| Versión | Fecha | Resumen | Verificada en ejecución |
|---|---|---|---|
| 0.6.2 | 2026-11-14 | La búsqueda de la biblioteca ya no se aplasta ni cae bajo la barra lateral en ventanas estrechas; entrega completa de 14 binarios (MSI y portables incluidos) | Sí en Linux (DOM real a 480–1300 px, WebKitGTK y app Tauri por AT-SPI); Windows/ARM64 pendientes en ejecución, pero CI compiló y publicó los 14 binarios |
| 0.6.1 | 2026-11-14 | Temas de color (Automático, Claro, Oscuro, Sepia guinda, Medianoche) y fondo personalizado con colores adaptativos; hoja «Apariencia» | No (sin red para compilar; probado en Chromium y con pruebas de contraste) |
| 0.6.0 | 2026-11-13 | Series, tiempo de lectura en SQLite, voz, desplazamiento continuo, ancho del texto, copiar cita | No (sin red para compilar) |
| 0.5.4 | 2026-11-13 | Marcar como terminado / no leído desde el menú del libro | No (sin red para compilar) |
| 0.5.3 | 2026-11-13 | Saltar al pasaje desde «Notas»; filtro «Leyendo» | No (sin red para compilar) |
| 0.5.2 | 2026-11-13 | Meta diaria de lectura, racha y gráfico semanal en Inicio | No (sin red para compilar) |
| 0.5.1 | 2026-11-13 | Editar título/autor/portada; copia de seguridad y restauración en .zip | No (sin red para compilar) |
| 0.5.0 | 2026-11-13 | Vista «Notas» con búsqueda y exportar a Markdown; orden por última lectura y progreso | No (sin red para compilar) |
| 0.4.5 | 2026-11-13 | Estructura de carpetas en español, registros de cambios/versiones/pendientes | No (sin red para compilar) |
| 0.4.4 | 2026-11-13 | Versión recibida como base (lectores EPUB/PDF/cómic/documentos/audio, anotaciones, guía incluida) | Compilada por CI según el historial; sin confirmar aquí |
| 0.4.2 | 2026-11-13 | Primera versión publicable: referencias/notas al pie EPUB, MSI y RPM, publicación automática por etiqueta `v*` | Pendiente de probar con EPUB reales |
| 0.4.0–0.4.1 | 2026-11-12 | Fases 1–5: base, biblioteca, lector EPUB, lector PDF, anotaciones; nombre «Cinta» (antes Folio) | No |

**Cómo publicar una versión:** subir la versión en los 5 sitios → `node herramientas/verificacion/verificar-release.mjs` → commit → `git tag vX.Y.Z && git push origin main vX.Y.Z`. Detalle en `documentacion/guias/PROMPT-PARA-OPENCODE.md`.

**Esquema:** `0.X.0` = bloque grande de funciones o rediseño; `0.X.Y` = arreglos y mejoras menores. `1.0.0` cuando las funciones principales estén verificadas en x64 y ARM64.
