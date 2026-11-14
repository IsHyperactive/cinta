# -*- coding: utf-8 -*-
"""Genera la «Guía de Cinta» (EPUB) que viene incluida por defecto en la app.

Uso (desde la raíz del proyecto):   python herramientas/guia-incluida/construir.py
Resultado: aplicacion/src-tauri/assets/Guia-de-Cinta.epub  (lo incrusta lib.rs con include_bytes!)
Después de cambiar la guía, sube GUIDE_VERSION en aplicacion/src-tauri/src/lib.rs.
Solo usa la biblioteca estándar de Python. La portada es herramientas/guia-incluida/portada.jpg.
"""
import zipfile, uuid, io, os

AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, "..", "..", "aplicacion", "src-tauri", "assets", "Guia-de-Cinta.epub")
TITLE = "Guía de Cinta"
SUB = "Todo lo que necesitas para leer"
UID = "urn:uuid:" + str(uuid.uuid5(uuid.NAMESPACE_URL, "cinta-guia-oficial"))

# ---------- portada ----------
with open(os.path.join(AQUI, "portada.jpg"), "rb") as f:
    COVER = f.read()

# ---------- estilos ----------
CSS = """
html,body{margin:0;padding:0}
body{line-height:1.6}
p{margin:0 0 .9em}
h1,h2,h3{line-height:1.2;font-weight:700;break-after:avoid}
.kicker{font-size:.72em;letter-spacing:.16em;text-transform:uppercase;color:#d9560b;font-weight:700;margin:.4em 0 .5em}
h1{font-size:2em;margin:0 0 .2em}
.bar{width:52px;height:4px;border-radius:2px;background:#d9560b;margin:.7em 0 1.2em}
.lead{font-size:1.13em;opacity:.85;margin-bottom:1.4em}
h2{font-size:1.28em;margin:1.7em 0 .5em}
h3{font-size:1.04em;margin:1.3em 0 .3em}
ul,ol{margin:0 0 1em;padding-left:1.3em}
li{margin:0 0 .45em}
.card{border:1px solid rgba(128,128,128,.35);border-radius:12px;padding:.8em 1em .3em;margin:0 0 .9em;break-inside:avoid;background:rgba(128,128,128,.07)}
.card h3{margin:0 0 .25em;font-size:1.05em}
.card .ic{font-size:1.4em;display:block;margin-bottom:.1em}
.callout{border-left:4px solid #d9560b;background:rgba(217,86,11,.11);padding:.75em 1em .15em;border-radius:0 10px 10px 0;margin:1.3em 0;break-inside:avoid}
.callout .t{font-weight:700;font-size:.74em;letter-spacing:.1em;text-transform:uppercase;color:#d9560b;margin:0 0 .3em}
.callout.nota{border-color:#3d84d8;background:rgba(61,132,216,.12)}
.callout.nota .t{color:#3d84d8}
.callout.ojo{border-color:#c8362d;background:rgba(200,54,45,.11)}
.callout.ojo .t{color:#c8362d}
kbd{font-family:inherit;font-size:.86em;font-weight:600;padding:.08em .5em;border:1px solid rgba(128,128,128,.55);border-bottom-width:2px;border-radius:6px;background:rgba(128,128,128,.14);white-space:nowrap}
.btn{font-weight:700;padding:.04em .5em;border-radius:6px;background:rgba(217,86,11,.16);white-space:nowrap}
table{width:100%;border-collapse:collapse;margin:.6em 0 1.3em;font-size:.95em}
th{text-align:left;font-size:.8em;letter-spacing:.06em;text-transform:uppercase;opacity:.75;padding:.45em .6em;border-bottom:2px solid #d9560b}
td{padding:.55em .6em;border-bottom:1px solid rgba(128,128,128,.3);vertical-align:top}
tr{break-inside:avoid}
ol.pasos{list-style:none;counter-reset:p;padding:0;margin:1em 0 1.4em}
ol.pasos li{counter-increment:p;position:relative;padding:.1em 0 0 2.9em;margin:0 0 1.1em;min-height:2.1em;break-inside:avoid}
ol.pasos li::before{content:counter(p);position:absolute;left:0;top:.05em;width:2em;height:2em;border-radius:50%;background:#d9560b;color:#fff;text-align:center;line-height:2em;font-weight:700}
ol.pasos li b{display:block;font-size:1.05em}
.sw{display:inline-block;width:.85em;height:.85em;border-radius:50%;vertical-align:-.1em;margin-right:.25em;border:1px solid rgba(0,0,0,.25)}
.fin{text-align:center;margin-top:2.5em;opacity:.8}
.cover{text-align:center;margin:0;padding:0}
.cover img{max-width:100%;max-height:100vh;width:auto;height:auto}
"""

def kb(*keys):
    return " + ".join("<kbd>%s</kbd>" % k for k in keys)

def page(kicker, title, lead, body):
    return """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es" lang="es">
<head><meta charset="utf-8"/><title>%s</title><link rel="stylesheet" type="text/css" href="css/style.css"/></head>
<body>
<section epub:type="chapter">
<p class="kicker">%s</p>
<h1>%s</h1>
<div class="bar"></div>
<p class="lead">%s</p>
%s
</section>
</body>
</html>""" % (title, kicker, title, lead, body)

def callout(kind, label, text):
    cls = "" if kind == "tip" else " " + kind
    return '<div class="callout%s"><p class="t">%s</p><p>%s</p></div>' % (cls, label, text)

def tip(t): return callout("tip", "Consejo", t)
def note(t): return callout("nota", "Nota", t)
def warn(t): return callout("ojo", "Ojo", t)

def card(icon, title, text):
    return '<div class="card"><span class="ic">%s</span><h3>%s</h3><p>%s</p></div>' % (icon, title, text)

def table(head, rows):
    h = "".join("<th>%s</th>" % c for c in head)
    r = "".join("<tr>" + "".join("<td>%s</td>" % c for c in row) + "</tr>" for row in rows)
    return "<table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>" % (h, r)

CH = []  # (archivo, título, html)

# ===== 1. Bienvenida =====
CH.append(("bienvenida", "Bienvenido a Cinta", page(
    "Bienvenida", "Bienvenido a Cinta",
    "Un lector de libros libre y pensado para tocar. Todo vive en tu equipo.",
    card("🔒", "Local y privado", "Tus libros se quedan en tu equipo. Sin cuentas, sin nube y sin telemetría.")
    + card("👆", "Táctil de verdad", "Deslizar, tocar y pellizcar. Botones grandes y una interfaz que se adapta a pantallas en vertical o en horizontal.")
    + card("🕊️", "Libre", "Licencia MIT: úsalo, modifícalo y compártelo. Hecho desde cero.")
    + "<h2>Cómo usar esta guía</h2>"
    "<p>Esta guía viene incluida con Cinta y es un libro EPUB como cualquier otro, así que es el mejor lugar para practicar. Mientras la lees, prueba esto:</p>"
    "<ul><li>Desliza el dedo para cambiar de página.</li>"
    "<li>Toca el borde izquierdo o derecho de la pantalla para pasar de página.</li>"
    "<li>Toca el centro para mostrar u ocultar las barras.</li>"
    "<li>Pulsa <span class=\"btn\">Aa</span> para cambiar el tema, el tamaño y la tipografía.</li>"
    "<li>Pulsa <span class=\"btn\">Contenido</span> para saltar a cualquier capítulo.</li></ul>"
    + tip("Cada capítulo se entiende por sí solo. Si buscas algo concreto, usa <b>Buscar</b> o abre <b>Contenido</b>.")
    + "<h2>Qué encontrarás</h2>"
    "<ol><li><b>Empieza en un minuto</b>: lo mínimo para leer ya.</li>"
    "<li><b>Tu biblioteca</b>: secciones, estantes, colecciones y menús.</li>"
    "<li><b>Agregar libros</b>: cómo entran y qué pasa con tus archivos.</li>"
    "<li><b>Formatos compatibles</b>: qué abre Cinta y cómo.</li>"
    "<li><b>Leer un EPUB</b> y <b>Leer un PDF</b>.</li>"
    "<li><b>Marcadores, resaltados y notas</b>, y el lápiz.</li>"
    "<li><b>Texto, cómics y audiolibros</b>.</li>"
    "<li><b>Gestos y atajos de un vistazo</b>.</li>"
    "<li><b>Tus datos y privacidad</b>.</li>"
    "<li><b>Problemas frecuentes</b> y <b>Acerca de Cinta</b>.</li></ol>"
)))

# ===== 2. Empieza en un minuto =====
CH.append(("empieza", "Empieza en un minuto", page(
    "Capítulo 1", "Empieza en un minuto",
    "Tres pasos y ya estás leyendo.",
    '<ol class="pasos">'
    "<li><b>Agrega tus libros</b>Pulsa <span class=\"btn\">Agregar libros</span> (o " + kb("Ctrl", "O") + ") y elige archivos. También puedes arrastrar archivos o carpetas a la ventana de Cinta.</li>"
    "<li><b>Abre uno</b>Toca su portada. Cinta recuerda en qué página te quedaste.</li>"
    "<li><b>Lee a tu manera</b>Desliza para cambiar de página. Toca el centro para ver las barras y ajustar tema, letra y más con <span class=\"btn\">Aa</span>.</li>"
    "</ol>"
    + tip("Tu progreso se guarda solo. Cierra el libro o la ventana cuando quieras: al volver, continúas donde lo dejaste.")
    + "<h2>¿Solo quieres leer un archivo?</h2>"
    "<p>No hace falta agregarlo. Pulsa <span class=\"btn\">Abrir archivo</span> (" + kb("Ctrl", "Mayús", "O") + ") o arrastra el archivo sobre el programa de Cinta. Se abre al momento y, si luego te gusta, puedes sumarlo a la biblioteca desde el propio lector con <span class=\"btn\">Agregar a la biblioteca</span>.</p>"
    "<h2>¿Y ahora qué?</h2>"
    "<p>Sigue por <b>Tu biblioteca</b> para organizar lo que tienes, o salta directo a <b>Leer un EPUB</b> si quieres dominar el lector.</p>"
)))

# ===== 3. Tu biblioteca =====
CH.append(("biblioteca", "Tu biblioteca", page(
    "Capítulo 2", "Tu biblioteca",
    "Todo lo que has agregado, ordenado y a un toque de distancia.",
    "<h2>La barra lateral</h2>"
    + table(["Sección", "Qué muestra"], [
        ["<b>Inicio</b>", "Estantes con lo que estás leyendo, lo que quieres leer y lo agregado hace poco."],
        ["<b>Quiero leer</b>", "Los libros que marcaste para más adelante."],
        ["<b>Terminados</b>", "Libros que llegaste al final (se llenan solos al superar el 99 %)."],
        ["<b>Libros</b>", "Todo tu contenido de lectura."],
        ["<b>Audiolibros</b>", "Archivos M4B, M4A y MP3."],
        ["<b>PDF</b>", "Todos tus PDF."],
        ["<b>Colecciones</b>", "Tus grupos personales, como «Trabajo» o «Novelas»."],
    ])
    + "<h2>Inicio: tres estantes</h2>"
    "<p><b>Continuar</b> (ordenado por lo último que leíste), <b>Quiero leer</b> y <b>Agregados recientemente</b>. Cada estante tiene un enlace <span class=\"btn\">Ver todo ›</span>.</p>"
    "<h2>Encontrar y ordenar</h2>"
    "<ul><li><b>Buscar:</b> " + kb("Ctrl", "F") + " o <kbd>/</kbd>. Busca en toda la biblioteca, por título, autor y serie.</li>"
    "<li><b>Ordenar:</b> por <i>Recientes</i>, <i>Título</i>, <i>Autor</i>, <i>Última lectura</i>, <i>Progreso</i> o <i>Serie</i>. Cinta recuerda tu elección.</li>"
    "<li><b>Vista:</b> alterna entre cuadrícula <kbd>▦</kbd> y lista <kbd>☰</kbd> (" + kb("Alt", "1") + " / " + kb("Alt", "2") + "). La lista muestra portada pequeña, autor, formato, progreso y fecha.</li></ul>"
    "<p>Debajo de cada título verás tu avance: «62 %» o «Terminado».</p>"
    "<h2>El menú ⋯ de cada libro</h2>"
    "<p>Pulsa <kbd>⋯</kbd> en un libro, o mantén pulsada su portada, o usa el clic derecho. Todos abren el mismo menú:</p>"
    "<ul><li><b>Ver detalles:</b> portada grande, botones Leer / Continuar / Leer de nuevo / Escuchar, progreso, serie, formato, fechas, tiempo que llevas leyendo y colecciones.</li>"
    "<li><b>Quiero leer:</b> lo marca o desmarca.</li>"
    "<li><b>Editar información…:</b> cambia título, autor y portada, y agrupa el libro en una <b>serie</b> con su número (por ejemplo «Fundación», n.º 2).</li>"
    "<li><b>Colecciones:</b> casillas para meter el libro en una o varias.</li>"
    "<li><b>Localizar archivo…:</b> solo aparece si el archivo del libro se perdió.</li>"
    "<li><b>Eliminar de la biblioteca:</b> quita el libro (ver el siguiente capítulo para saber qué se borra).</li></ul>"
    "<h2>Colecciones</h2>"
    "<p>Pulsa el <kbd>+</kbd> junto a «Colecciones», escribe un nombre y listo. Agrega libros desde su menú ⋯ y filtra desde la barra lateral. Para eliminar una colección, pasa el cursor sobre ella y pulsa la <kbd>✕</kbd>: los libros se quedan en tu biblioteca.</p>"
    + "<h2>Apariencia y fondo</h2>"
    "<p>Pulsa <span class=\"btn\">Apariencia</span> al pie de la barra lateral (en una ventana estrecha, al final de la barra superior) o usa " + kb("Ctrl", ",") + ". Solo cambian los colores: la forma de la app, la letra y los iconos se quedan igual.</p>"
    + table(["Tema", "Cómo se ve"], [
        ["<b>Automático</b>", "Sigue el modo claro u oscuro de tu sistema. Es el aspecto de siempre y viene elegido por defecto."],
        ["<b>Claro</b> y <b>Oscuro</b>", "Fijos, sin importar lo que use tu sistema."],
        ["<b>Sepia guinda</b>", "Papel cálido con acento guinda, cómodo de noche sin ser negro."],
        ["<b>Medianoche</b>", "Gris azulado muy oscuro con acento azul."],
        ["<b>Fondo personalizado</b>", "Tu propia imagen detrás de la biblioteca."],
    ])
    + "<h3>Fondo personalizado</h3>"
    "<ol class=\"pasos\">"
    "<li><b>Elige una imagen</b>Pulsa <span class=\"btn\">Elegir imagen…</span> y busca un archivo jpg, png o webp. Cinta la reduce (hasta 1920 px por el lado mayor) y guarda una copia ligera en la carpeta <code>Fondos</code> de <code>CintaData</code>. Tu archivo original no se toca.</li>"
    "<li><b>Deja que Cinta adapte los colores</b>Analiza la foto en tu propio equipo, sin internet, y decide si el texto va claro u oscuro y qué color de acento usar. Los paneles (barra lateral, barras, hojas y menús) quedan semitransparentes y con desenfoque para que todo se lea.</li>"
    "<li><b>Ajusta a tu gusto</b>Con <b>Atenuación</b> oscureces (o aclaras) la imagen y con <b>Desenfoque</b> difuminas lo que hay detrás de los paneles. La vista previa te muestra el resultado al instante.</li>"
    "</ol>"
    + note("La atenuación nunca baja del mínimo con el que el texto se lee bien sobre tu imagen. Si intentas ir por debajo, Cinta lo mantiene y te lo avisa. Pulsa <span class=\"btn\">Quitar fondo</span> para volver al tema anterior.")
    + "<p>El fondo se ve en la biblioteca: Inicio, listas, Notas, hojas y menús. Los lectores (EPUB, PDF, cómics, texto y audiolibros) no usan la imagen y conservan sus propios temas, y las portadas no cambian. Si activas «Reducir transparencia» en tu sistema, los paneles se ven opacos y sin desenfoque. Si la imagen se borra o se daña, Cinta vuelve sola al tema anterior, sin errores.</p>"
    + note("En una ventana estrecha o en vertical, la barra lateral pasa automáticamente a la parte superior.")
)))

# ===== 4. Agregar libros =====
CH.append(("agregar", "Agregar libros", page(
    "Capítulo 3", "Agregar libros",
    "Cuatro formas de traer tus libros y una promesa: tus archivos originales no se tocan.",
    table(["Forma", "Cómo"], [
        ["<b>Agregar libros</b>", "Botón azul de la barra superior o " + kb("Ctrl", "O") + ". Puedes elegir varios a la vez."],
        ["<b>Agregar carpeta</b>", "Botón o " + kb("Ctrl", "Mayús", "A") + ". Cinta recorre también las subcarpetas."],
        ["<b>Arrastrar y soltar</b>", "Suelta archivos o carpetas sobre la ventana."],
        ["<b>Abrir con…</b>", "Haz doble clic o usa «Abrir con» en un libro, o arrástralo sobre el programa Cinta. Si ya está abierta, se usa la misma ventana."],
    ])
    + "<p>Si agregas más de tres archivos verás el avance: «Importando 4 de 20…». Los archivos repetidos se ignoran y los formatos no compatibles se saltan.</p>"
    "<h2>Qué pasa con tus archivos</h2>"
    "<p>Cada libro que agregas se <b>copia</b> a la carpeta <code>CintaData\\Libros</code>, igual que hace Apple Books. Tu archivo original no se mueve ni se modifica. Si dos libros se llaman igual, el segundo queda como «libro (2)».</p>"
    + warn("<b>Eliminar de la biblioteca</b> borra solo la copia que Cinta guardó, nunca tu archivo original. Por eso el espacio que ocupa un libro se duplica mientras conserves ambos.")
    + "<h2>Leer sin agregar</h2>"
    "<p><span class=\"btn\">Abrir archivo</span> te deja leer un EPUB o PDF directamente desde donde está. No se copia, pero Cinta sí recuerda tu posición. Si después lo agregas, conserva esa posición.</p>"
    "<h2>«Archivo no encontrado»</h2>"
    "<p>Si borras o mueves a mano un archivo dentro de <code>CintaData\\Libros</code>, el libro aparece atenuado con ese aviso. Abre su menú ⋯, elige <b>Localizar archivo…</b> y señala el archivo: Cinta lo copia de nuevo y conserva tu progreso y tus colecciones.</p>"
)))

# ===== 5. Formatos =====
CH.append(("formatos", "Formatos compatibles", page(
    "Capítulo 4", "Formatos compatibles",
    "Más formatos de los habituales, cada uno con el lector que mejor le queda.",
    table(["Formato", "Cómo se lee"], [
        ["<b>EPUB</b>", "Lector completo: páginas, contenido, búsqueda, marcadores, resaltados y notas."],
        ["<b>PDF</b>", "Desplazamiento continuo, zoom, miniaturas, búsqueda, marcadores, resaltados, notas y lápiz."],
        ["<b>MOBI · AZW3 · FB2 · DOCX · TXT · HTML</b>", "Lector de texto con índice, búsqueda, marcadores, resaltados y notas."],
        ["<b>CBZ · CBR</b>", "Lector de cómics con modo manga."],
        ["<b>M4B · M4A · MP3</b>", "Reproductor de audiolibros."],
    ])
    + "<h2>Lo que conviene saber</h2>"
    "<ul><li><b>Sin DRM:</b> Cinta no incluye soporte para libros protegidos con DRM.</li>"
    "<li><b>AZW3:</b> se lee la parte MOBI de compatibilidad; el formato KF8 puro no es compatible.</li>"
    "<li><b>CBR:</b> funciona si el archivo en realidad es un ZIP. Si es RAR de verdad, conviértelo a CBZ.</li>"
    "<li><b>PDF escaneados:</b> son imágenes, sin texto; la búsqueda y la selección de texto no encontrarán nada.</li>"
    "<li><b>.ibooks:</b> se pueden agregar a la biblioteca, pero Cinta todavía no puede abrirlos.</li></ul>"
    + note("La portada de un EPUB sale del propio libro. En los PDF, Cinta usa la primera página; si no puede generarla, verás una portada de color con el título.")
)))

# ===== 6. EPUB =====
CH.append(("epub", "Leer un EPUB", page(
    "Capítulo 5", "Leer un EPUB",
    "El lector principal de Cinta: limpio, ajustable y con gestos naturales.",
    "<h2>Gestos</h2>"
    + table(["Haz esto", "Y ocurre esto"], [
        ["<b>Deslizar</b>", "Cambia de página. La página sigue tu dedo."],
        ["<b>Tocar un borde</b> (el 25 % de cada lado)", "Página anterior o siguiente."],
        ["<b>Tocar el centro</b>", "Muestra u oculta las barras."],
        ["<b>Pellizcar con dos dedos</b>", "Cambia el tamaño de letra."],
        ["<b>Pulsación larga</b>", "Selecciona texto para resaltarlo."],
    ])
    + "<p>En teclado: " + kb("←") + " " + kb("→") + " o " + kb("Re Pág") + " " + kb("Av Pág") + " cambian de página, y " + kb("Esc") + " vuelve a la biblioteca. En una ventana ancha, Cinta muestra dos páginas a la vez.</p>"
    "<h2>La barra superior</h2>"
    "<p><span class=\"btn\">Volver</span> · <span class=\"btn\">Contenido</span> · <span class=\"btn\">Buscar</span> · <span class=\"btn\">Voz</span> · <span class=\"btn\">Aa</span> · <kbd>☆</kbd> marcador. Abajo ves una barra de progreso con el porcentaje y el título del capítulo.</p>"
    "<h2>Aa: tu página a tu gusto</h2>"
    "<p>Se abre como una ventana flotante, sin tapar el libro:</p>"
    "<ul><li><b>Tamaño de letra:</b> botones A pequeña y A grande, del 70 % al 220 %.</li>"
    "<li><b>Tema:</b> <span class=\"sw\" style=\"background:#ffffff\"></span>Claro, <span class=\"sw\" style=\"background:#f1e7d0\"></span>Sepia, <span class=\"sw\" style=\"background:#d9dadd\"></span>Gris y <span class=\"sw\" style=\"background:#121316\"></span>Oscuro.</li>"
    "<li><b>Tipografía:</b> Georgia, Cambria, Palatino Linotype, Segoe UI o Verdana.</li>"
    "<li><b>Interlineado:</b> Original, Compacto, Normal o Amplio. «Original» respeta el del libro.</li>"
    "<li><b>Ancho del texto:</b> Estrecho, Normal o Ancho, para ajustar los márgenes a tu pantalla.</li>"
    "<li><b>Desplazamiento continuo:</b> en lugar de pasar páginas, el texto se desliza hacia abajo.</li>"
    "<li><b>Velocidad de la voz:</b> de ×0.8 a ×1.5 (ver «Voz» más abajo).</li>"
    "<li><b>Justificar texto:</b> alinea los dos márgenes.</li></ul>"
    "<p>Tus ajustes se recuerdan para el siguiente libro.</p>"
    "<h2>Voz: que el libro te lea</h2>"
    "<p>Pulsa <span class=\"btn\">Voz</span> y Cinta lee en voz alta desde donde estás, hasta el final del capítulo, y sigue con el siguiente. Usa las voces que ya tiene tu sistema (sin internet) y elige una del idioma del libro si existe. Pulsa <span class=\"btn\">Detener</span> para parar. La página no se mueve mientras lee.</p>"
    "<h2>Al seleccionar texto</h2>"
    "<p>Aparece una barra con los colores para resaltar y estas acciones: <b>Nota</b>, <b>Copiar</b> (copia la cita entre comillas con el título del libro) y <b>Buscar</b> (busca esa frase en todo el libro).</p>"
    "<h2>Contenido y Buscar</h2>"
    "<ul><li><b>Contenido</b> abre un panel con tres pestañas: <i>Contenido</i> (capítulos), <i>Marcadores</i> y <i>Resaltados</i>. Toca un elemento para ir a él.</li>"
    "<li><b>Buscar</b> revisa todo el libro capítulo por capítulo y muestra hasta 300 resultados. Toca uno para saltar a su posición.</li></ul>"
    + tip("En libros muy grandes, el porcentaje aparece unos segundos después de abrir: Cinta está calculando las ubicaciones.")
)))

# ===== 7. PDF =====
CH.append(("pdf", "Leer un PDF", page(
    "Capítulo 6", "Leer un PDF",
    "Desplazamiento continuo, zoom suave y las mismas herramientas que en el EPUB.",
    "<h2>Moverte y acercar</h2>"
    + table(["Haz esto", "Y ocurre esto"], [
        ["<b>Deslizar hacia arriba o abajo</b>", "Recorres el documento de forma continua."],
        ["<b>Pellizcar</b>", "Zoom, con vista previa inmediata y nitidez al soltar."],
        ["<b>Doble toque</b>", "Alterna entre 100 % y 200 %, hacia el punto que tocaste."],
        ["<b>Un toque</b>", "Muestra u oculta las barras."],
        ["<kbd>Ctrl</kbd> + rueda del ratón", "Zoom con ratón."],
    ])
    + "<p>El zoom va del 50 % al 400 %. Con <span class=\"btn\">Aa</span> puedes subirlo o bajarlo de 10 en 10 %, o pulsar <b>Ajustar al ancho</b>.</p>"
    "<h2>Temas</h2>"
    "<p>En <span class=\"btn\">Aa</span> elige Claro, Sepia, Gris u Oscuro. Los temas tiñen la página para cansar menos la vista. Un PDF no puede reajustar su texto, por eso aquí no hay tipografía ni interlineado.</p>"
    "<h2>Contenido: cuatro pestañas</h2>"
    "<ul><li><b>Contenido:</b> el índice del PDF, si lo tiene.</li>"
    "<li><b>Páginas:</b> miniaturas para saltar visualmente. Si el PDF no tiene índice, el panel abre aquí.</li>"
    "<li><b>Marcadores</b> y <b>Resaltados</b>.</li></ul>"
    "<h2>Buscar</h2>"
    "<p>Pulsa <span class=\"btn\">Buscar</span> o " + kb("Ctrl", "F") + ". Cada resultado muestra «Página N» y un fragmento; al tocarlo vas a la página y la palabra queda resaltada.</p>"
    + note("Cinta guarda la página en la que te quedaste y la recupera al reabrir el PDF.")
)))

# ===== 8. Anotaciones =====
CH.append(("anotaciones", "Marcadores, resaltados y notas", page(
    "Capítulo 7", "Marcadores, resaltados y notas",
    "Deja huella en lo que lees. Todo se guarda y vuelve a aparecer cuando reabres el libro.",
    "<h2>Marcadores</h2>"
    "<p>Toca <kbd>☆</kbd> en la barra superior para marcar la página que ves; se vuelve <kbd>★</kbd>. Tócala otra vez para quitarlo. Los marcadores se listan en la pestaña <i>Marcadores</i> del panel Contenido.</p>"
    "<h2>Resaltados</h2>"
    '<ol class="pasos">'
    "<li><b>Selecciona texto</b>Con ratón, con el dedo (pulsación larga) o con un lápiz.</li>"
    "<li><b>Elige un color</b>Aparece una barra flotante con cuatro colores: "
    '<span class="sw" style="background:#f6d94b"></span>amarillo, <span class="sw" style="background:#7bd389"></span>verde, <span class="sw" style="background:#6aa3ea"></span>azul y <span class="sw" style="background:#f28fb1"></span>rosa.</li>'
    "<li><b>Cámbialo cuando quieras</b>Toca un resaltado para cambiar su color o quitarlo.</li></ol>"
    "<h2>Notas</h2>"
    "<p>En la barra de selección pulsa <span class=\"btn\">Nota</span>. Se abre un editor con el texto citado: escribe y guarda con " + kb("Ctrl", "Enter") + ", o cancela con " + kb("Esc") + ". Puedes añadir o editar una nota de un resaltado existente tocándolo.</p>"
    "<p>En la pestaña <i>Resaltados</i> verás todo en orden de lectura, con tus notas en cursiva. Toca uno para ir a él, o la <kbd>✕</kbd> para eliminarlo.</p>"
    "<h2>El lápiz (en PDF)</h2>"
    "<p>Pulsa <span class=\"btn\">Lápiz</span> en la barra superior de un PDF para escribir o dibujar a mano alzada.</p>"
    "<ul><li>El grosor del trazo depende de la presión del lápiz.</li>"
    "<li>Elige entre cuatro colores en la barra flotante.</li>"
    "<li>Con <b>Borrar</b> (o el botón borrador del lápiz) eliminas el trazo que toques.</li>"
    "<li>Mientras el lápiz está activo, tu dedo sigue moviendo la página.</li>"
    "<li>Pulsa <b>Listo</b> al terminar.</li></ul>"
    "<p>Los trazos y resaltados se anclan al documento: no se mueven aunque cambies el zoom.</p>"
    + note("Por ahora el trazo a mano está disponible en PDF. En EPUB, el texto se reajusta y solo hay resaltados, notas y marcadores.")
)))

# ===== 9. Texto, cómics, audio =====
CH.append(("otros", "Texto, cómics y audiolibros", page(
    "Capítulo 8", "Texto, cómics y audiolibros",
    "Cada tipo de archivo tiene un lector hecho a su medida.",
    "<h2>Lector de texto</h2>"
    "<p>Para MOBI, AZW3, FB2, DOCX, TXT y HTML. Cinta los convierte al abrirlos y los muestra con tema Claro, Sepia u Oscuro, tamaño de letra ajustable y barra deslizante para moverte.</p>"
    "<ul><li><b>Contenido:</b> el índice se arma solo a partir de los títulos del documento.</li>"
    "<li><b>Buscar, marcadores y resaltados con notas:</b> igual que en EPUB.</li></ul>"
    "<h2>Cómics (CBZ y CBR)</h2>"
    "<ul><li>Toca los bordes o usa las flechas para cambiar de página; " + kb("Inicio") + " y " + kb("Fin") + " saltan a la primera y última.</li>"
    "<li><span class=\"btn\">Ajuste: alto</span> / <span class=\"btn\">Ajuste: ancho</span> cambia cómo encaja la página.</li>"
    "<li><span class=\"btn\">Manga ←</span> invierte la lectura de derecha a izquierda.</li>"
    "<li>La barra inferior muestra «página / total» y te deja desplazarte.</li></ul>"
    "<h2>Audiolibros (M4B, M4A, MP3)</h2>"
    + table(["Control", "Qué hace"], [
        ["<b>Reproducir / pausar</b>", "Botón central o " + kb("Espacio") + "."],
        ["<b>↺ 15 · 30 ↻</b>", "Retrocede 15 segundos o adelanta 30 (también con " + kb("←") + " y " + kb("→") + ")."],
        ["<b>Velocidad</b>", "De 0,75× a 2×. Cinta recuerda tu elección."],
        ["<b>Temporizador</b>", "Pausa solo a los 15, 30, 45 o 60 minutos, ideal para dormir."],
        ["<b>☆ Marcar</b>", "Guarda este momento. Verás la lista en <i>Marcadores</i>."],
    ])
    + "<p>Funcionan las teclas multimedia de tu teclado o auriculares, y Cinta reanuda justo donde lo dejaste.</p>"
    + note("Un audiolibro se carga completo en memoria al abrirlo, así que los archivos muy grandes pueden tardar unos segundos.")
)))

# ===== 10. Gestos y atajos =====
CH.append(("atajos", "Gestos y atajos de un vistazo", page(
    "Capítulo 9", "Gestos y atajos de un vistazo",
    "Tu hoja de referencia rápida. Pulsa <kbd>F1</kbd> o <kbd>?</kbd> en la biblioteca para ver los atajos dentro de la app.",
    "<h2>Biblioteca</h2>"
    + table(["Atajo", "Acción"], [
        [kb("Ctrl", "F") + " o <kbd>/</kbd>", "Buscar"],
        [kb("Ctrl", "O"), "Agregar libros"],
        [kb("Ctrl", "Mayús", "O"), "Abrir un archivo sin agregarlo"],
        [kb("Ctrl", "Mayús", "A"), "Agregar una carpeta"],
        [kb("Ctrl", "1") + " … " + kb("6"), "Inicio, Quiero leer, Terminados, Libros, Audiolibros, PDF"],
        [kb("Alt", "1") + " / " + kb("Alt", "2"), "Vista de cuadrícula / de lista"],
        [kb("Ctrl", ","), "Apariencia: temas de color y fondo"],
        [kb("F1") + " o <kbd>?</kbd>", "Mostrar la ayuda de atajos"],
        [kb("Esc"), "Cerrar ventana, menú o detalle"],
    ])
    + "<h2>Lectores de EPUB, PDF y texto</h2>"
    + table(["Atajo", "Acción"], [
        [kb("←") + " " + kb("→") + " / " + kb("Re Pág") + " " + kb("Av Pág"), "Cambiar de página o desplazar"],
        [kb("Ctrl", "F"), "Buscar (en PDF)"],
        [kb("Esc"), "Cierra primero el panel o ventana abierta y luego vuelve a la biblioteca"],
    ])
    + "<h2>Audiolibros</h2>"
    + table(["Atajo", "Acción"], [
        [kb("Espacio"), "Reproducir / pausar"],
        [kb("←") + " / " + kb("→"), "Retroceder 15 s / adelantar 30 s"],
        ["Teclas multimedia", "Reproducir, pausar y saltar"],
    ])
    + "<h2>Cómics</h2>"
    + table(["Atajo", "Acción"], [
        [kb("←") + " " + kb("→") + " / " + kb("Re Pág") + " " + kb("Av Pág"), "Página anterior / siguiente (invertido en modo manga)"],
        [kb("Inicio") + " / " + kb("Fin"), "Primera / última página"],
    ])
    + "<h2>Gestos táctiles</h2>"
    + table(["Dónde", "Gesto", "Resultado"], [
        ["EPUB", "Deslizar", "Cambiar de página"],
        ["EPUB", "Tocar borde / centro", "Página / barras"],
        ["EPUB", "Pellizcar", "Tamaño de letra"],
        ["PDF", "Pellizcar", "Zoom"],
        ["PDF", "Doble toque", "Zoom 100 % ↔ 200 %"],
        ["Biblioteca", "Pulsación larga en un libro", "Menú ⋯"],
        ["Cualquiera", "Pulsación larga en texto", "Seleccionar"],
    ])
)))

# ===== 11. Datos y privacidad =====
CH.append(("privacidad", "Tus datos y privacidad", page(
    "Capítulo 10", "Tus datos y privacidad",
    "Cinta no te pide nada y no envía nada. Todo se queda contigo.",
    "<ul><li><b>Sin cuentas</b> ni registro.</li><li><b>Sin nube</b> ni sincronización: solo archivos locales.</li><li><b>Sin telemetría:</b> Cinta no mide ni reporta lo que haces.</li></ul>"
    "<h2>Dónde vive todo</h2>"
    "<p>Cinta es portable: un solo programa, sin instalador. Tu biblioteca y tus ajustes se guardan en una carpeta llamada <code>CintaData</code>, junto al programa.</p>"
    + table(["Dentro de CintaData", "Contiene"], [
        ["<code>library.db</code>", "Tu biblioteca, colecciones, progreso, marcadores, resaltados y notas."],
        ["<code>Libros</code>", "Las copias de los libros que agregaste."],
        ["<code>Fondos</code>", "La imagen de fondo personalizado, ya reducida (si elegiste una)."],
        ["Ajustes del lector", "Tema, tamaño, zoom y demás preferencias."],
    ])
    + "<p>Si Cinta no puede escribir junto al programa (por ejemplo, en una carpeta protegida), usa <code>%APPDATA%\\com.cinta.reader</code> como alternativa.</p>"
    "<h2>Llevarla a otro lugar</h2>"
    "<ul><li><b>Copia de seguridad:</b> copia la carpeta <code>CintaData</code> completa.</li>"
    "<li><b>Mover o llevar en un USB:</b> mueve el programa junto con <code>CintaData</code>. Como las copias usan rutas relativas, tu biblioteca sigue funcionando en otra carpeta, unidad u otro equipo.</li></ul>"
    + warn("Cierra Cinta antes de copiar la carpeta o de quitar el USB, para que la base de datos termine de guardarse.")
    + "<h2>Comodidad y accesibilidad</h2>"
    "<ul><li>La biblioteca sigue el tema claro u oscuro de Windows, o el que elijas en <b>Apariencia</b> (Claro, Oscuro, Sepia guinda, Medianoche o tu propio fondo).</li>"
    "<li>Si activas «Reducir movimiento» en Windows, Cinta desactiva sus animaciones, y con «Reducir transparencia» los paneles sobre un fondo personalizado se ven opacos y sin desenfoque.</li>"
    "<li>Los botones táctiles miden al menos 44 px para tocarlos sin errores.</li></ul>"
    "<p>Cinta necesita WebView2, que ya viene incluido en Windows 11.</p>"
)))

# ===== 12. FAQ =====
CH.append(("faq", "Problemas frecuentes", page(
    "Capítulo 11", "Problemas frecuentes",
    "Respuestas rápidas a lo que más se pregunta.",
    "<h3>Un libro aparece atenuado con «Archivo no encontrado»</h3>"
    "<p>Abre su menú ⋯ y elige <b>Localizar archivo…</b>. Conservas tu progreso y tus colecciones.</p>"
    "<h3>Mi PDF no tiene portada, solo un color</h3>"
    "<p>Las portadas de PDF se generan en segundo plano, una a una. Si una no se puede dibujar, queda la portada de color y se reintenta al abrir la app.</p>"
    "<h3>No veo el porcentaje en un EPUB grande</h3>"
    "<p>Aparece tras unos segundos, cuando Cinta termina de calcular las ubicaciones.</p>"
    "<h3>La búsqueda en un PDF no encuentra nada</h3>"
    "<p>Probablemente es un PDF escaneado: son imágenes y no tienen texto que buscar.</p>"
    "<h3>Mis atajos no responden dentro de un libro</h3>"
    "<p>Los atajos de la biblioteca se desactivan al leer; cada lector tiene sus propias teclas. Pulsa " + kb("Esc") + " para volver y se reactivan.</p>"
    "<h3>Mi archivo CBR no abre</h3>"
    "<p>Si es un RAR de verdad, conviértelo a CBZ. Los CBR que en realidad son ZIP sí funcionan.</p>"
    "<h3>Abrí otro libro con «Abrir con» y no se abrió otra ventana</h3>"
    "<p>Es lo normal: Cinta usa una sola ventana y envía el libro nuevo a la que ya está abierta.</p>"
    "<h3>La app no abre o se queda en blanco</h3>"
    "<p>Comprueba que tengas WebView2 instalado y actualizado. Viene con Windows 11 y con Windows 10 actualizado.</p>"
    "<h3>Quiero quitar un libro sin perder mi archivo</h3>"
    "<p>Usa <b>Eliminar de la biblioteca</b>: borra solo la copia de Cinta, no tu archivo original.</p>"
    "<h3>Eliminé esta guía y quiero recuperarla</h3>"
    "<p>Cierra Cinta, borra el archivo <code>.guia</code> de la carpeta <code>CintaData</code> y vuelve a abrir Cinta: la guía regresa a tu biblioteca.</p>"
)))

# ===== 13. Acerca de =====
CH.append(("acerca", "Acerca de Cinta", page(
    "Final", "Acerca de Cinta",
    "Hecha desde cero, abierta para todos.",
    "<p>Cinta es un lector de libros libre y gratuito para Windows y Linux, en versiones nativas para x64 y ARM64, pensado para pantallas táctiles. Tus libros, tus notas y tu progreso se quedan en tu equipo: sin cuentas, sin nube y sin telemetría.</p>"
    "<ul><li><b>Licencia MIT:</b> puedes usarla, estudiarla, modificarla y compartirla.</li>"
    "<li><b>Hecha desde cero:</b> el código, los íconos y los textos son propios. Se basa en especificaciones abiertas como EPUB y PDF.</li>"
    "<li><b>Construida con:</b> Tauri 2, React, epub.js, pdf.js y SQLite, entre otras piezas libres. Sus licencias están en el archivo <code>THIRD_PARTY_LICENSES.md</code>.</li>"
    "<li><b>Colaborar:</b> las normas para contribuir están en <code>CONTRIBUTING.md</code>.</li></ul>"
    "<p class=\"fin\">Gracias por leer con Cinta.<br/><b>Buena lectura.</b></p>"
)))

# ---------- cubierta ----------
COVER_X = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es" lang="es">
<head><meta charset="utf-8"/><title>Portada</title><link rel="stylesheet" type="text/css" href="css/style.css"/></head>
<body><div class="cover"><img src="images/cover.jpg" alt="Portada: Guía de Cinta. Todo lo que necesitas para leer"/></div></body>
</html>"""

# ---------- paquete ----------
manifest = ['<item id="css" href="css/style.css" media-type="text/css"/>',
            '<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
            '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
            '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
            '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>']
spine = ['<itemref idref="cover"/>']
for fid, t, _ in CH:
    manifest.append('<item id="%s" href="%s.xhtml" media-type="application/xhtml+xml"/>' % (fid, fid))
    spine.append('<itemref idref="%s"/>' % fid)

OPF = """<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="es">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">%s</dc:identifier>
<dc:title>%s</dc:title>
<dc:creator>Cinta</dc:creator>
<dc:language>es</dc:language>
<dc:subject>Manual de usuario</dc:subject>
<dc:description>%s</dc:description>
<meta property="dcterms:modified">2026-11-12T00:00:00Z</meta>
<meta name="cover" content="cover-image"/>
</metadata>
<manifest>
%s
</manifest>
<spine toc="ncx">
%s
</spine>
<guide><reference type="cover" title="Portada" href="cover.xhtml"/></guide>
</package>""" % (UID, TITLE, SUB, "\n".join(manifest), "\n".join(spine))

NAV = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es" lang="es">
<head><meta charset="utf-8"/><title>Contenido</title></head>
<body>
<nav epub:type="toc" id="toc"><h1>Contenido</h1><ol>
<li><a href="cover.xhtml">Portada</a></li>
%s
</ol></nav>
</body>
</html>""" % "\n".join('<li><a href="%s.xhtml">%s</a></li>' % (f, t) for f, t, _ in CH)

pts = ['<navPoint id="n0" playOrder="1"><navLabel><text>Portada</text></navLabel><content src="cover.xhtml"/></navPoint>']
for i, (f, t, _) in enumerate(CH, 2):
    pts.append('<navPoint id="n%d" playOrder="%d"><navLabel><text>%s</text></navLabel><content src="%s.xhtml"/></navPoint>' % (i, i, t, f))
NCX = """<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="%s"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
<docTitle><text>%s</text></docTitle>
<navMap>
%s
</navMap>
</ncx>""" % (UID, TITLE, "\n".join(pts))

CONTAINER = """<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>"""

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, "w") as z:
    z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
    def add(name, data):
        z.writestr(name, data, compress_type=zipfile.ZIP_DEFLATED)
    add("META-INF/container.xml", CONTAINER)
    add("OEBPS/content.opf", OPF)
    add("OEBPS/nav.xhtml", NAV)
    add("OEBPS/toc.ncx", NCX)
    add("OEBPS/css/style.css", CSS)
    add("OEBPS/images/cover.jpg", COVER)
    add("OEBPS/cover.xhtml", COVER_X)
    for f, t, html in CH:
        add("OEBPS/%s.xhtml" % f, html)
print("OK", OUT, os.path.getsize(OUT), "bytes")
