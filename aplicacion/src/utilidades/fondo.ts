// Fondo personalizado (0.6.1): análisis de la imagen y colores adaptativos. TODO local, sin red.
// Este archivo es lógica pura (sin DOM): lo prueba herramientas/verificacion/probar-fondo.mjs con Node.
// Solo usa sintaxis TypeScript «borrable» (sin enums ni importaciones) para poder ejecutarse así.
//
// Cómo garantiza la legibilidad:
//  1. Se calcula la luminancia relativa (WCAG) de cada píxel de una miniatura de ~48×48.
//  2. Se elige el modo del texto: «oscuro» (texto claro sobre velo negro) o «claro» (texto oscuro sobre velo blanco),
//     el que necesite MENOS atenuación; si empatan, el que más se parezca a la luminancia media de la foto.
//  3. La atenuación mínima es la menor opacidad del velo con la que el PEOR caso (percentil 95 de las zonas más claras
//     en modo oscuro, percentil 5 de las más oscuras en modo claro; no el promedio) llega a ≥ 4,7:1 (margen sobre 4,5)
//     con --muted, que es el texto secundario y el menos contrastado. Con --text sobra.
//  4. Con el velo ya aplicado se ajusta el acento hasta ≥ 3:1 contra la superficie y su texto (--accent-text) a ≥ 4,5:1.
//  5. El usuario puede subir la atenuación, nunca bajarla del mínimo (lo aplica `atenuacionEfectiva`).

export type RGB = [number, number, number];

export type Analisis = {
  ancho: number;
  alto: number;
  /** Luminancia relativa media (0 negro … 1 blanco) de toda la imagen, de la zona bajo la barra lateral y del área principal. */
  lumMedia: number;
  lumLateral: number;
  lumPrincipal: number;
  /** Colores representativos. */
  dominante: RGB;
  saturado: RGB;
  /** Tono (0–360) y saturación (0–1) del color más saturado. */
  tono: number;
  saturacion: number;
  /** Colores del peor caso por percentil, por zona: el píxel claro (p95) y el oscuro (p5) con el que se calcula el contraste. */
  claroPrincipal: RGB;
  oscuroPrincipal: RGB;
  claroLateral: RGB;
  oscuroLateral: RGB;
};

export type Modo = "oscuro" | "claro";

export type Paleta = {
  modo: Modo;
  /** Atenuación mínima (0–1) que garantiza el contraste. */
  minAtenuacion: number;
  /** Valor por defecto cuando el usuario aún no ha tocado el deslizador. */
  atenuacionDefecto: number;
  /** La que realmente se aplica: max(elegida ?? defecto, mínima). */
  atenuacion: number;
  /** Variables CSS para poner en <html style>. */
  vars: Record<string, string>;
  /** Contrastes resultantes (para mostrar y para las pruebas). */
  contrasteTexto: number;
  contrasteSecundario: number;
  contrasteAcento: number;
  contrasteSobreAcento: number;
};

export const FRACCION_LATERAL = 0.22; // la barra lateral ocupa ≈ 248 de ~1100 px
export const PERCENTIL = 0.95;
export const MARGEN = 4.7; // objetivo (el requisito WCAG es 4,5; el margen cubre la mezcla en espacio sRGB y el redondeo)
export const ALFA_PANEL_MIN = 0.66; // opacidad más baja que usa el CSS en la barra lateral (temas.css)

const TEXTO = { oscuro: "#f5f5f7", claro: "#1d1d1f" } as const;
const SECUNDARIO = { oscuro: "#c3c6ce", claro: "#4a4d55" } as const;
const SOBRE_ACENTO = { oscuro: "#101820", claro: "#101820" } as const;

// ---------------------------------------------------------------- color

export const hex = (c: RGB): string =>
  "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
export const deHex = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
/** Luminancia relativa WCAG de un color sRGB de 0–255. */
export const luminancia = (c: RGB): number => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const contraste = (a: RGB, b: RGB): number => {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Mezcla `a` con `b` (t = 0 → a, t = 1 → b) en espacio sRGB, igual que hace el navegador al componer capas. */
export const mezclar = (a: RGB, b: RGB, t: number): RGB => [
  a[0] * (1 - t) + b[0] * t,
  a[1] * (1 - t) + b[1] * t,
  a[2] * (1 - t) + b[2] * t,
];

function aHsl(c: RGB): [number, number, number] {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (mx === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}
function deHsl(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// ---------------------------------------------------------------- análisis

/** Analiza una miniatura RGBA (por ejemplo, 48×48 sacada de un canvas). */
export function analizar(datos: ArrayLike<number>, ancho: number, alto: number): Analisis {
  const n = ancho * alto;
  const corteX = Math.max(1, Math.round(ancho * FRACCION_LATERAL));
  const px: RGB[] = [];
  const lum: number[] = [];
  const lat: number[] = []; // índices de píxeles bajo la barra lateral
  const pri: number[] = []; // índices del área principal
  let sumaL = 0, sumaLat = 0, sumaPri = 0;
  for (let i = 0; i < n; i++) {
    const a = (datos[i * 4 + 3] ?? 255) / 255;
    // la transparencia se compone sobre gris medio (el JPEG final no tiene alfa)
    const c: RGB = [
      datos[i * 4] * a + 128 * (1 - a),
      datos[i * 4 + 1] * a + 128 * (1 - a),
      datos[i * 4 + 2] * a + 128 * (1 - a),
    ];
    const l = luminancia(c);
    px.push(c);
    lum.push(l);
    sumaL += l;
    if (i % ancho < corteX) { lat.push(i); sumaLat += l; } else { pri.push(i); sumaPri += l; }
  }
  const media = (s: number, k: number) => (k ? s / k : sumaL / Math.max(1, n));

  // Para el contraste en TODA la pantalla (en ≤ 820 px la barra va arriba y el contenido ocupa todo el ancho)
  // el «área principal» para la garantía es la imagen entera; las medias por zona se informan aparte.
  const todos = Array.from({ length: n }, (_, i) => i);
  const porLum = (idx: number[]) => [...idx].sort((a, b) => lum[a] - lum[b]);
  const percentil = (ord: number[], p: number): RGB => px[ord[Math.min(ord.length - 1, Math.max(0, Math.round((ord.length - 1) * p)))]];
  const ordTodos = porLum(todos);
  const ordLat = lat.length ? porLum(lat) : ordTodos;

  // color dominante: el cubo más poblado de un histograma de 16 niveles por canal
  const cubos = new Map<number, { k: number; r: number; g: number; b: number }>();
  for (const c of px) {
    const key = ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4);
    const e = cubos.get(key) ?? { k: 0, r: 0, g: 0, b: 0 };
    e.k++; e.r += c[0]; e.g += c[1]; e.b += c[2];
    cubos.set(key, e);
  }
  let mejor = { k: 0, r: 0, g: 0, b: 0 };
  for (const e of cubos.values()) if (e.k > mejor.k) mejor = e;
  const dominante: RGB = mejor.k ? [mejor.r / mejor.k, mejor.g / mejor.k, mejor.b / mejor.k] : [128, 128, 128];

  // color más saturado: promedio del 2 % de píxeles con más croma (ignora casi-negros y casi-blancos, donde el tono es ruido)
  const croma = px.map((c, i) => {
    const mx = Math.max(...c), mn = Math.min(...c);
    const l = lum[i];
    return l < 0.01 || l > 0.9 ? 0 : (mx - mn) / 255;
  });
  const topN = Math.max(1, Math.round(n * 0.02));
  const top = todos.sort((a, b) => croma[b] - croma[a]).slice(0, topN);
  let sx = 0, sy = 0, sr = 0, sg = 0, sb = 0;
  for (const i of top) {
    const [h] = aHsl(px[i]);
    sx += Math.cos((h * Math.PI) / 180); sy += Math.sin((h * Math.PI) / 180);
    sr += px[i][0]; sg += px[i][1]; sb += px[i][2];
  }
  const saturado: RGB = [sr / topN, sg / topN, sb / topN];
  const mediaCroma = top.reduce((s, i) => s + croma[i], 0) / topN;
  const tono = (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;

  return {
    ancho, alto,
    lumMedia: sumaL / n,
    lumLateral: media(sumaLat, lat.length),
    lumPrincipal: media(sumaPri, pri.length),
    dominante, saturado, tono, saturacion: mediaCroma,
    claroPrincipal: percentil(ordTodos, PERCENTIL),
    oscuroPrincipal: percentil(ordTodos, 1 - PERCENTIL),
    claroLateral: percentil(ordLat, PERCENTIL),
    oscuroLateral: percentil(ordLat, 1 - PERCENTIL),
  };
}

// ---------------------------------------------------------------- paleta

const velo = (modo: Modo): RGB => (modo === "oscuro" ? [0, 0, 0] : [255, 255, 255]);

/** Superficie que ve el texto: la imagen con el velo de atenuación `a` y, si `panel`, con el panel translúcido encima. */
export function superficie(pixel: RGB, modo: Modo, a: number, panel?: { color: RGB; alfa: number }): RGB {
  const s = mezclar(pixel, velo(modo), a);
  return panel ? mezclar(s, panel.color, panel.alfa) : s;
}

function colorPanel(an: Analisis, modo: Modo): RGB {
  // el panel toma el tono dominante de la foto, muy oscuro (modo oscuro) o muy claro (modo claro)
  return modo === "oscuro" ? mezclar(an.dominante, [0, 0, 0], 0.88) : mezclar(an.dominante, [255, 255, 255], 0.9);
}

/** Menor atenuación (0–1, redondeada hacia arriba al 1 %) con la que el peor caso cumple `MARGEN` con texto y secundario. */
export function minimaAtenuacion(an: Analisis, modo: Modo): number {
  const textos = [deHex(TEXTO[modo]), deHex(SECUNDARIO[modo])];
  const panel = { color: colorPanel(an, modo), alfa: ALFA_PANEL_MIN };
  const peorP = modo === "oscuro" ? an.claroPrincipal : an.oscuroPrincipal; // sin panel: texto suelto sobre la imagen
  const peorL = modo === "oscuro" ? an.claroLateral : an.oscuroLateral; // con panel: barra lateral
  const cumple = (a: number) =>
    textos.every((t) => contraste(t, superficie(peorP, modo, a)) >= MARGEN) &&
    textos.every((t) => contraste(t, superficie(peorL, modo, a, panel)) >= MARGEN);
  if (cumple(0)) return 0;
  let lo = 0, hi = 1; // con a = 1 la superficie es negro/blanco puro y siempre cumple
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (cumple(mid)) hi = mid; else lo = mid;
  }
  return Math.min(1, Math.ceil(hi * 100) / 100);
}

/** Elige el modo que necesita menos atenuación; en empate técnico, el más cercano a la luminancia media. */
export function elegirModo(an: Analisis): Modo {
  const d = minimaAtenuacion(an, "oscuro");
  const c = minimaAtenuacion(an, "claro");
  if (Math.abs(d - c) < 0.08) return an.lumMedia < 0.35 ? "oscuro" : "claro";
  return d < c ? "oscuro" : "claro";
}

export function atenuacionEfectiva(minimo: number, defecto: number, elegida: number | null): number {
  const v = elegida === null || !isFinite(elegida) ? defecto : elegida;
  return Math.min(1, Math.max(minimo, v, 0));
}

const css = (c: RGB) => `${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])}`;

/**
 * Calcula la paleta completa.
 * @param elegida atenuación que pidió el usuario (0–1) o null para usar la de por defecto
 * @param desenfoque px de desenfoque de la IMAGEN de fondo (0–24). El de los paneles (cristal esmerilado) es fijo y vive en temas.css.
 *   El desenfoque solo suaviza píxeles, así que nunca empeora el contraste calculado con los píxeles nítidos (el peor caso ya está cubierto).
 */
export function calcularPaleta(an: Analisis, elegida: number | null, desenfoque: number): Paleta {
  const modo = elegirModo(an);
  const minAtenuacion = minimaAtenuacion(an, modo);
  const atenuacionDefecto = Math.min(0.92, Math.max(0.3, minAtenuacion + 0.12));
  const atenuacion = atenuacionEfectiva(minAtenuacion, atenuacionDefecto, elegida);

  const texto = deHex(TEXTO[modo]);
  const secundario = deHex(SECUNDARIO[modo]);
  const panelBase = colorPanel(an, modo);
  const peor = modo === "oscuro" ? an.claroPrincipal : an.oscuroPrincipal;
  const peorSuperficie = superficie(peor, modo, atenuacion);
  const peorPanel = superficie(peor, modo, atenuacion, { color: panelBase, alfa: ALFA_PANEL_MIN });

  // Acento: tono del color más saturado (o azul si la foto es casi gris), con la luminosidad movida
  // hasta ≥ 3:1 contra la superficie más exigente y con texto encima a ≥ 4,5:1.
  const gris = an.saturacion < 0.12;
  const h = gris ? 212 : an.tono;
  const s = gris ? 0.78 : Math.min(0.85, Math.max(0.55, aHsl(an.saturado)[1]));
  const claroSobre = deHex("#ffffff");
  const oscuroSobre = deHex(SOBRE_ACENTO[modo]);
  const sobreAcento = (a: RGB) => (contraste(a, claroSobre) >= contraste(a, oscuroSobre) ? claroSobre : oscuroSobre);
  const paso = modo === "oscuro" ? 0.01 : -0.01;
  let l = modo === "oscuro" ? 0.55 : 0.38;
  let acento = deHsl(h, s, l);
  for (let i = 0; i < 100; i++) {
    acento = deHsl(h, s, l);
    const ok =
      contraste(acento, peorSuperficie) >= 3.2 &&
      contraste(acento, peorPanel) >= 3.2 &&
      contraste(acento, sobreAcento(acento)) >= 4.6;
    if (ok || l <= 0.05 || l >= 0.97) break;
    l += paso;
  }
  const textoAcento = sobreAcento(acento);

  const fondoBase = modo === "oscuro" ? mezclar(an.dominante, [0, 0, 0], 0.82) : mezclar(an.dominante, [255, 255, 255], 0.86);
  const panelOpaco = mezclar(fondoBase, texto, 0.07);
  const borde = `rgb(${css(texto)} / .18)`;

  const vars: Record<string, string> = {
    "--bg": hex(fondoBase),
    "--panel": hex(panelOpaco),
    "--text": hex(texto),
    "--muted": hex(secundario),
    "--accent": hex(acento),
    "--accent-text": hex(textoAcento),
    "--border": borde,
    "--desktop-sidebar": hex(panelBase),
    "--desktop-card": hex(panelOpaco),
    "--desktop-shadow": modo === "oscuro" ? "0 14px 38px rgb(0 0 0 / .45)" : "0 12px 34px rgb(30 30 40 / .16)",
    "--fondo-panel": css(panelBase),
    "--fondo-velo": modo === "oscuro" ? "0 0 0" : "255 255 255",
    "--fondo-velo-a": atenuacion.toFixed(3),
    "--fondo-img-blur": `${Math.max(0, Math.min(24, Math.round(desenfoque)))}px`,
  };

  return {
    modo, minAtenuacion, atenuacionDefecto, atenuacion, vars,
    contrasteTexto: Math.min(contraste(texto, peorSuperficie), contraste(texto, peorPanel)),
    contrasteSecundario: Math.min(contraste(secundario, peorSuperficie), contraste(secundario, peorPanel)),
    contrasteAcento: Math.min(contraste(acento, peorSuperficie), contraste(acento, peorPanel)),
    contrasteSobreAcento: contraste(acento, textoAcento),
  };
}
