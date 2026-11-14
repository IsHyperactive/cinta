# Pendientes de Cinta (hoja de ruta para quien continúe)

Última actualización: 0.7.2 (2026-11-14). Actualízala en cada versión: tacha lo hecho (`[x]`) y añade lo nuevo.

## Contexto del usuario (importante)
- Quiere que Cinta imite Apple Books con archivos locales, en Windows x64/ARM64 (y Linux).
- **Orden de prioridad que él pidió:** 1) subir el porcentaje de funciones de Apple Books; 2) pulido estético después.
- Hoy opina que la **estética aún no le gusta** y que **faltan funciones**. Trabajar por partes y con pocos tokens: una parte por versión.
- No cambiar el diseño ni los iconos (Phosphor) sin que lo pida; ahora SÍ lo pidió para la Parte 3.
- Todo en español, todo ordenado en carpetas con nombre en español; nada suelto.

## Parte 4 · 0.7.2 — Versión principal (sustituye a 0.7.0 y 0.7.1)
- [x] Releases y etiquetas **v0.7.0** y **v0.7.1 eliminadas**; la única versión publicada es la **0.7.2**.
- [x] **Desenfoque del fondo**: difumina la propia imagen y sigue funcionando al mover la atenuación.
- [x] Retirada la animación «Hoja de libro» (0.7.1) y guía con la lista «Qué encontrarás» en una sola página.
- [x] Conservados la doble página, las fuentes a la vista y los marcapáginas vectoriales SVG (0.7.0).
- [x] Entrega de 9 archivos exactos verificada por el workflow.
- [ ] Probar el desenfoque con fotos reales y pesadas en WebView2 (x64 y ARM64) y en WebKitGTK.
- [ ] Probar en la app real la doble página, las animaciones restantes y la guía.

## Parte 2 · 0.5.0 — Funciones (candidatas, por verificar contra el código actual)
Comprobar primero qué existe ya (README y `App.tsx`); lo siguiente es lo típico de Apple Books que podría faltar:
- [x] Biblioteca: ordenar (recientes, título, autor, última lectura, progreso) — ya existían «Quiero leer» y «Terminados» (0.5.0).
- [x] Filtro «Leyendo» (0.5.3).
- [x] Series (0.6.0).
- [x] Inicio con «Continuar», «Quiero leer» y recientes (ya existía).
- [x] Vista «Notas» con búsqueda y exportar a Markdown (0.5.0).
- [x] Desde «Notas», saltar al pasaje (0.5.3).
- [x] Copiar cita y «Buscar» la selección en el libro (0.6.0). [ ] Diccionario (sin internet no hay datos; ver REGISTRO-DE-CAMBIOS 0.6.0).
- [x] Meta diaria, racha y semana (0.5.2, en localStorage).
- [x] Tiempo de lectura en SQLite y estadísticas por libro (0.6.0).
- [x] Tipografía EPUB: fuente, tamaño, interlineado y justificado (ya existían).
- [x] Desplazamiento continuo y ancho del texto en EPUB (0.6.0; por probar en vivo).
- [x] Leer en voz alta en EPUB (0.6.0; voces del sistema).
- [x] Editar metadatos y portada (0.5.1).
- [x] Marcar como terminado / no leído (0.5.4).
- [x] Copia de seguridad y restauración en .zip (0.5.1; reinicio manual tras restaurar).
- [ ] CBR con RAR real y KF8/AZW3 completo (ya anotado en CONTEXT.md).
- [ ] Rendimiento con ≥ 1000 libros.

## Parte 3 · 0.6.x — Estética
- [ ] Pedir al usuario 2–3 capturas de referencia (o de Apple Books) y qué le disgusta exactamente antes de rediseñar.
- [ ] Sistema de diseño único: variables CSS de color/tipografía/espaciado en `aplicacion/src/estilos/` (hoy `styles.css` tiene ~1550 líneas con varias «pasadas» apiladas; consolidar y dividir por componente).
- [x] Temas de color: Automático, Claro, Oscuro, Sepia guinda, Medianoche (0.6.1; `estilos/temas.css`).
- [x] Fondo personalizado con colores adaptativos y hoja «Apariencia» (0.6.1; por probar en la app real).
- [x] **Búsqueda en ventanas estrechas** (0.6.2): conserva su ancho (hasta 390 px) en vez de encogerse; si los controles no caben, la barra superior los pasa a otra fila. La barra lateral se queda a la izquierda desde 480 px; el diseño móvil empieza por debajo.
- [ ] Revisar portadas, barra lateral, tarjetas y barras de lectura con los temas nuevos; aislar los paneles del lector de las variables del tema de la app.
- [ ] Respetar reglas táctiles (objetivos ≥ 44 px, barra arriba por debajo de 480 px).

## Deuda técnica / verificación
- [ ] 0.7.2: probar el desenfoque de la imagen con fotos reales en WebView2; valorar si Zoom/Voltear/Cubo se quedan.
- [ ] 0.7.1: ejecutar `npm ci`, `npm run typecheck` y `npm run build` (no se pudo en el entorno donde se hizo, sin red) y probar la doble página y las animaciones restantes en la app real.
- [ ] Pase de hoja con curvatura real (malla/WebGL): solo si se puede comparar con Apple Books; la versión CSS plana se retiró en 0.7.1.
- [ ] 0.6.2: probar la ventana estrecha (480–1040 px) en Windows/WebView2 y en ARM64; el CSS es el mismo, pero no se compiló para esas plataformas aquí.
- [ ] 0.6.1: probar en la app real el fondo (diálogo de archivos, `save_background` con cuerpo binario, reinicio, copia de seguridad/restauración con `Fondos`) y fotos reales clara/oscura/colorida; `cargo check --locked` de los 4 comandos nuevos.
- [ ] Ejecutar `npm ci`, `npm run typecheck`, `npm run build` y CI tras la reorganización de 0.4.5.
- [ ] Probar en Windows ARM64 (Surface Pro X) y con EPUB reales con notas al pie.
- [ ] Dividir `App.tsx` (959 líneas), `PdfReader.tsx` (978) y `lib.rs` (788) en módulos más pequeños.
