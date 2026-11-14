#!/usr/bin/env python3
"""Genera los 16 marcapáginas de Cinta como SVG (vectoriales).

Por qué SVG y no PNG: los recortes (la muesca, la punta, los bordes) son trazados matemáticos, no píxeles, así que
quedan nítidos al milímetro a cualquier tamaño y en pantallas de alta densidad. Todo lo que se pinta (satén, grosgrain,
trenzado, cuero, filos metálicos y costuras) está recortado por el mismo trazado de la cinta.

Uso (desde la raíz del repositorio):
    python3 herramientas/cintas/generar-cintas.py

Escribe aplicacion/public/cintas/c01.svg … c16.svg. No necesita dependencias.
"""
import math
import os

W, H = 120, 400  # lienzo de cada cinta (proporción 3:10)
SALIDA = os.path.join(os.path.dirname(__file__), "..", "..", "aplicacion", "public", "cintas")


# ---------- color ----------
def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hexa(c):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(v))) for v in c)


def mezcla(a, b, t):
    A, B = rgb(a), rgb(b)
    return hexa(tuple(A[i] + (B[i] - A[i]) * t for i in range(3)))


def claro(c, t):
    return mezcla(c, "#ffffff", t)


def oscuro(c, t):
    return mezcla(c, "#000000", t)


# ---------- forma ----------
def contorno(cola):
    """Puntos del borde sin la arista superior (izquierda ↓, cola, derecha ↑)."""
    if cola == "muesca":
        return [(0, 0), (0, H), (W / 2, H - 46), (W, H), (W, 0)]
    if cola == "punta":
        return [(0, 0), (0, H - 42), (W / 2, H), (W, H - 42), (W, 0)]
    r, n = 7, 8  # recto con esquinas redondeadas
    pts = [(0, 0), (0, H - r)]
    for i in range(1, n):
        a = math.pi / 2 * i / n
        pts.append((r - r * math.cos(a), H - r + r * math.sin(a)))
    pts += [(r, H), (W - r, H)]
    for i in range(1, n):
        a = math.pi / 2 * i / n
        pts.append((W - r + r * math.sin(a), H - r + r * math.cos(a)))
    pts += [(W, H - r), (W, 0)]
    return pts


def trazo(pts, cerrar=False):
    d = "M" + " L".join("%.3f %.3f" % p for p in pts)
    return d + (" Z" if cerrar else "")


def desplazar(pts, d):
    """Desplaza hacia dentro una polilínea abierta una distancia d (para filos, bordes y costuras)."""
    cx, cy = W / 2, H * 0.3
    rectas = []
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        nx, ny = -dy / L, dx / L
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if nx * (cx - mx) + ny * (cy - my) < 0:
            nx, ny = -nx, -ny
        rectas.append(((x1 + nx * d, y1 + ny * d), (x2 + nx * d, y2 + ny * d)))
    sal = [rectas[0][0]]
    for (a1, a2), (b1, b2) in zip(rectas, rectas[1:]):
        x1, y1 = a1; x2, y2 = a2; x3, y3 = b1; x4, y4 = b2
        den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if abs(den) < 1e-9:
            sal.append(a2)
        else:
            t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
            sal.append((x1 + t * (x2 - x1), y1 + t * (y2 - y1)))
    sal.append(rectas[-1][1])
    return sal


def cerrada(cola):
    p = contorno(cola)
    return trazo(p + [(0, 0)], True)


# ---------- materiales (devuelven (defs, capas)) ----------
def satin(base):
    luz, sombra = claro(base, .27), oscuro(base, .38)
    defs = f'''<linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="{oscuro(base, .5)}"/><stop offset=".07" stop-color="{sombra}"/><stop offset=".22" stop-color="{base}"/>
<stop offset=".34" stop-color="{luz}"/><stop offset=".5" stop-color="{base}"/><stop offset=".68" stop-color="{sombra}"/>
<stop offset=".84" stop-color="{claro(base, .22)}"/><stop offset="1" stop-color="{oscuro(base, .15)}"/></linearGradient>
<linearGradient id="h" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".1" stop-color="#000" stop-opacity=".04"/>
<stop offset=".4" stop-color="#fff" stop-opacity=".05"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/>
<stop offset=".9" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".36"/></linearGradient>'''
    capas = f'<rect width="{W}" height="{H}" fill="url(#v)"/><rect width="{W}" height="{H}" fill="url(#h)"/>'
    return defs, capas


def grosgrain(base):
    defs = f'''<pattern id="g" width="4" height="3.2" patternUnits="userSpaceOnUse">
<rect width="4" height="3.2" fill="{base}"/><rect y="0" width="4" height="1.5" fill="{claro(base, .2)}"/>
<rect y="1.5" width="4" height="1.1" fill="{oscuro(base, .28)}"/></pattern>
<linearGradient id="h" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#000" stop-opacity=".4"/><stop offset=".12" stop-color="#000" stop-opacity=".05"/>
<stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset=".88" stop-color="#000" stop-opacity=".07"/>
<stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".4"/>
<stop offset=".08" stop-color="#000" stop-opacity=".05"/><stop offset=".6" stop-color="#fff" stop-opacity=".05"/>
<stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>'''
    capas = f'<rect width="{W}" height="{H}" fill="url(#g)"/><rect width="{W}" height="{H}" fill="url(#h)"/><rect width="{W}" height="{H}" fill="url(#v)"/>'
    return defs, capas


def trenzado(crema, raya):
    defs = f'''<pattern id="t" width="15" height="11" patternUnits="userSpaceOnUse">
<rect width="15" height="11" fill="{crema}"/>
<path d="M-1 0.5 L7.5 9.5 L16 0.5" fill="none" stroke="{oscuro(crema, .2)}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M-1 0.5 L7.5 9.5 L16 0.5" fill="none" stroke="{claro(crema, .55)}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M-1 -4.5 L7.5 4.5 L16 -4.5 M-1 6.5 L7.5 15.5 L16 6.5" fill="none" stroke="{oscuro(crema, .2)}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M-1 -4.5 L7.5 4.5 L16 -4.5 M-1 6.5 L7.5 15.5 L16 6.5" fill="none" stroke="{claro(crema, .55)}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></pattern>
<pattern id="c" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
<rect width="8" height="8" fill="{raya}"/><rect width="8" height="3" fill="{claro(raya, .32)}"/><rect y="5" width="8" height="3" fill="{oscuro(raya, .38)}"/></pattern>
<linearGradient id="h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".3"/>
<stop offset=".1" stop-color="#000" stop-opacity="0"/><stop offset=".9" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/>
<stop offset=".08" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>'''
    capas = (f'<rect width="{W}" height="{H}" fill="url(#t)"/>'
             f'<rect x="9" width="8" height="{H}" fill="url(#c)"/><rect x="{W - 17}" width="8" height="{H}" fill="url(#c)"/>'
             f'<rect x="8.2" width=".8" height="{H}" fill="{oscuro(raya, .5)}" opacity=".7"/><rect x="17" width=".8" height="{H}" fill="{oscuro(raya, .5)}" opacity=".7"/>'
             f'<rect x="{W - 17.8}" width=".8" height="{H}" fill="{oscuro(raya, .5)}" opacity=".7"/><rect x="{W - 9}" width=".8" height="{H}" fill="{oscuro(raya, .5)}" opacity=".7"/>'
             f'<rect width="{W}" height="{H}" fill="url(#h)"/><rect width="{W}" height="{H}" fill="url(#v)"/>')
    return defs, capas


def cuero(base, cola):
    defs = f'''<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{oscuro(base, .34)}"/>
<stop offset=".1" stop-color="{base}"/><stop offset=".45" stop-color="{claro(base, .1)}"/><stop offset="1" stop-color="{oscuro(base, .3)}"/></linearGradient>
<linearGradient id="h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".32"/>
<stop offset=".08" stop-color="#000" stop-opacity="0"/><stop offset=".92" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>
<filter id="n" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="7"/>
<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.9 0 0 0 -.78"/></filter>
<filter id="m" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency=".07 .02" numOctaves="2" seed="2"/>
<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.2 0 0 0 -.5"/></filter>'''
    borde = desplazar(contorno(cola), 3.2)
    costura = desplazar(contorno(cola), 8.5)
    capas = (f'<rect width="{W}" height="{H}" fill="url(#v)"/>'
             f'<rect width="{W}" height="{H}" filter="url(#m)" opacity=".16"/>'
             f'<rect width="{W}" height="{H}" filter="url(#n)" opacity=".42"/>'
             f'<rect width="{W}" height="{H}" fill="url(#h)"/>'
             f'<path d="{trazo(borde)}" fill="none" stroke="{oscuro(base, .5)}" stroke-width="1.2" opacity=".75"/>'
             f'<path d="{trazo(borde)}" fill="none" stroke="{claro(base, .35)}" stroke-width=".7" opacity=".5" transform="translate(.9 .9)"/>'
             f'<path d="{trazo(costura)}" fill="none" stroke="{oscuro(base, .62)}" stroke-width="2.2" stroke-dasharray="5.5 4" stroke-linecap="round" stroke-linejoin="round" opacity=".55" transform="translate(.5 .8)"/>'
             f'<path d="{trazo(costura)}" fill="none" stroke="{claro(base, .62)}" stroke-width="1.5" stroke-dasharray="5.5 4" stroke-linecap="round" stroke-linejoin="round"/>')
    return defs, capas


def filo(metal, cola):
    """Filo metálico (oro o plata) que bordea los lados y la cola. Visible: 4,2 unidades."""
    if metal == "oro":
        pasos = ["#fff2b8", "#e9b83a", "#8c6410", "#f3d36b", "#a87a14", "#fbe9a0"]
    else:
        pasos = ["#ffffff", "#c9ccd1", "#7b7f87", "#e6e8eb", "#9a9ea6", "#f7f8fa"]
    n = len(pasos) - 1
    paradas = "".join(f'<stop offset="{i / n:.3f}" stop-color="{c}"/>' for i, c in enumerate(pasos))
    defs = f'<linearGradient id="m" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{W}" y2="{H}">{paradas}</linearGradient>'
    cont = contorno(cola)
    capas = (f'<path d="{trazo(cont)}" fill="none" stroke="url(#m)" stroke-width="8.4" stroke-linejoin="miter"/>'
             f'<path d="{trazo(desplazar(cont, 4.2))}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".9"/>'
             f'<path d="{trazo(desplazar(cont, 1.2))}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>')
    return defs, capas


# ---------- ensamblado ----------
def svg(cola, material, metal=None):
    d1, c1 = material
    d2, c2 = filo(metal, cola) if metal else ("", "")
    # ids del filo distintos para que no choquen con los del material
    d2 = d2.replace('id="m"', 'id="fm"'); c2 = c2.replace("url(#m)", "url(#fm)")
    forma = cerrada(cola)
    pliegue = f'''<linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>'''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" shape-rendering="geometricPrecision">
<defs><clipPath id="f"><path d="{forma}"/></clipPath>{d1}{d2}{pliegue}</defs>
<g clip-path="url(#f)">{c1}{c2}<rect width="{W}" height="26" fill="url(#p)"/>
<path d="{trazo(contorno(cola))}" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="1.2"/></g>
</svg>
'''


DISENOS = [
    ("c01", "muesca", satin("#7a1c36"), None),
    ("c02", "muesca", satin("#1f3a6b"), None),
    ("c03", "punta", grosgrain("#1f6b3a"), None),
    ("c04", "muesca", satin("#5a0b1f"), "oro"),
    ("c05", "recto", cuero("#7a4a2a", "recto"), None),
    ("c06", "muesca", trenzado("#ecdcb4", "#c1272d"), None),
    ("c07", "muesca", satin("#d9a521"), None),
    ("c08", "punta", satin("#1d1d20"), "plata"),
    ("c09", "muesca", cuero("#6b3f22", "muesca"), None),
    ("c10", "muesca", trenzado("#ecdcb4", "#1f3a6b"), None),
    ("c11", "muesca", satin("#0f5a43"), "oro"),
    ("c12", "muesca", satin("#232327"), "plata"),
    ("c13", "muesca", cuero("#8a2230", "muesca"), None),
    ("c14", "punta", trenzado("#ecdcb4", "#1f6b3a"), None),
    ("c15", "punta", satin("#5b3a8c"), "plata"),
    ("c16", "muesca", grosgrain("#d9644a"), None),
]


def main():
    os.makedirs(SALIDA, exist_ok=True)
    for ident, cola, mat, metal in DISENOS:
        with open(os.path.join(SALIDA, ident + ".svg"), "w", encoding="utf-8") as f:
            f.write(svg(cola, mat, metal))
    print("Escritos %d marcapáginas en %s" % (len(DISENOS), os.path.normpath(SALIDA)))


if __name__ == "__main__":
    main()
