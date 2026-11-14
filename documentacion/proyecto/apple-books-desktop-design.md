
# Cinta con diseño Apple Books — Specificación visual

**Referencia visual:** Apple Books para macOS, contrastada con la guía oficial de Apple y capturas reales de Biblioteca, Inicio, Colecciones, ficha de libro y lector.

## Principio de implementación

Reproducir el lenguaje visual y la organización de Apple Books para Mac, manteniendo las funciones reales de Cinta. Los iconos deben seguir la familia SF Symbols de Apple (misma metáfora, silueta, grosor y alineación), dibujados como SVG consistentes cuando no se puedan usar símbolos nativos.

## 1. Ventana y estructura

- **Aplicación de escritorio de dos zonas:** barra lateral persistente y área principal.
- **Barra lateral:** ancho estable, fondo lateral ligeramente distinto al contenido, separación sutil. Sin paneles oscuros rectangulares ni selección azul saturada.
- **Área principal:** márgenes amplios, títulos y controles alineados a una cuadrícula constante.
- **Respetar los controles de ventana nativos** de Windows/Linux; no fingir una barra de título que no existe.
- **Adaptar el ancho** de la barra lateral y el contenido a ventanas pequeñas sin romper la biblioteca.

## 2. Barra lateral y mapa de iconos

Apple Books organiza navegación superior, biblioteca y colecciones. Cinta conserva sus funciones reales con íconos equivalentes de la familia SF Symbols:

| Función de Cinta | Ícono SF Symbols | Significado |
|---|---|---|
| **Buscar** | `magnifyingglass` | Filtrar libros de la biblioteca |
| **Audiolibros** | `audio` | Sección de audiolibros |
| **PDF** | `pdf` | Sección de documentos PDF |
| **Libros** | `books` | Sección de libros normales |
| **Inicio** | `home` | Vista principal/biblioteca |
| **Quiero leer** | `want` | Libros que quieres leer |
| **Terminados** | `done` | Libros que ya leíste |

## 3. Controles y vistas

- **Vista de cuadrícula:** Muestra los libros como tarjetas con portada y título.
- **Vista de lista:** Muestra los libros en formato lista con información detallada.
- **Táctil y animaciones:** Los controles están diseñados para funcionar con gestos de pantalla táctil y tienen animaciones sutiles al pasar de página o seleccionar elementos.
- **Atajos de teclado:** Combos de teclas para navegar rápidamente (atrás, adelante, marcar como leído, etc.).

## 4. Estilo visual

- **Títulos y lomos:** Los libros muestran el título y autor en la portada, respetando la proporción real.
- **Esterilizado:** El diseño evita colores saturados y utiliza tipografías de lectura cómoda.
- **Modo claro/oscuro:** El respetivo respeto a la configuración del sistema o del usuario.

---

### ¿Cómo usar esto?

Este documento sirve de referencia para el diseño visual de Cinta. Si eres diseñador o desarrollador, úsalo como guía para mantener la consistencia con el estilo de Apple Books. Si eres usuario final, los iconos y el diseño ya vienen integrados en la aplicación desde la versión 0.4.2.

**¿Dudas?** Revisa la [guía de contribuyentes](../../.github/CONTRIBUTING.md) o abre una discusión en el repositorio.
