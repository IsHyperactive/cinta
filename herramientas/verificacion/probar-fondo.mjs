// Prueba, sin dependencias, la lógica de colores adaptativos del fondo personalizado (aplicacion/src/utilidades/fondo.ts).
// Uso (desde la raíz del repositorio):  node herramientas/verificacion/probar-fondo.mjs
// Necesita Node ≥ 22.18 (ejecuta TypeScript «borrable» directamente).
//
// Para cada imagen sintética (muy clara, muy oscura, muy colorida, gris medio, mitad blanca y mitad negra, ruido):
//  - calcula la paleta con la atenuación por defecto y con la atenuación más baja que pida el usuario (0 %, que se sube al mínimo);
//  - comprueba, por separado y SIN usar la lógica del módulo, que ≥ 94,9 % de los píxeles dejan --text y --muted a ≥ 4,5:1,
//    tanto con el texto suelto sobre la imagen como con la barra lateral (panel translúcido al 66 %);
//  - comprueba acento ≥ 3:1 contra la superficie y --accent-text ≥ 4,5:1 contra el acento.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const f = await import(pathToFileURL(resolve("aplicacion/src/utilidades/fondo.ts")).href);

// --- utilidades independientes (copia deliberada, para no validar el módulo con sí mismo)
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const C = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hexA = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);

let semilla = 12345;
const rnd = () => ((semilla = (semilla * 1664525 + 1013904223) >>> 0) / 4294967296);

const N = 48;
function imagen(gen) {
  const d = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const [r, g, b] = gen(x, y);
    const i = (y * N + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  return d;
}
const hsv = (h, s, v) => {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};
const casos = {
  "muy clara (nieve)": imagen(() => { const v = 225 + rnd() * 30; return [v, v, v - rnd() * 6]; }),
  "blanco puro": imagen(() => [255, 255, 255]),
  "muy oscura (noche)": imagen(() => { const v = rnd() * 30; return [v, v, v + 8]; }),
  "negro puro": imagen(() => [0, 0, 0]),
  "muy colorida (neón)": imagen(() => hsv(rnd() * 360, 0.95 + rnd() * 0.05, 0.85 + rnd() * 0.15)),
  "colorida por bandas": imagen((x) => hsv((x / N) * 360, 1, 1)),
  "gris medio (el peor)": imagen(() => [128, 128, 128]),
  "gris medio con ruido": imagen(() => { const v = 100 + rnd() * 60; return [v, v, v]; }),
  "mitad blanca, mitad negra": imagen((x) => (x < N / 2 ? [255, 255, 255] : [0, 0, 0])),
  "atardecer (degradado cálido)": imagen((x, y) => hsv(10 + (y / N) * 45, 0.85, 0.35 + (y / N) * 0.65)),
  "ruido total": imagen(() => [rnd() * 255, rnd() * 255, rnd() * 255]),
};

let fallos = 0;
const ok = (m) => console.log("  ✔ " + m);
const mal = (m) => { fallos++; console.log("  ✘ " + m); };

for (const [nombre, datos] of Object.entries(casos)) {
  const an = f.analizar(datos, N, N);
  console.log(`\n${nombre}: lum media ${an.lumMedia.toFixed(2)} (lateral ${an.lumLateral.toFixed(2)}, principal ${an.lumPrincipal.toFixed(2)})`);
  for (const [etiqueta, elegida] of [["por defecto", null], ["usuario pide 0 %", 0], ["usuario pide 100 %", 1]]) {
    const p = f.calcularPaleta(an, elegida, 14);
    const texto = hexA(p.vars["--text"]);
    const sec = hexA(p.vars["--muted"]);
    const velo = p.modo === "oscuro" ? [0, 0, 0] : [255, 255, 255];
    const panel = p.vars["--fondo-panel"].split(" ").map(Number);
    let pasan = 0, pasanPanel = 0;
    const n = N * N;
    for (let i = 0; i < n; i++) {
      const px = [datos[i * 4], datos[i * 4 + 1], datos[i * 4 + 2]];
      const s = mix(px, velo, p.atenuacion);
      const sp = mix(s, panel, 0.66);
      if (C(texto, s) >= 4.5 && C(sec, s) >= 4.5) pasan++;
      if (C(texto, sp) >= 4.5 && C(sec, sp) >= 4.5) pasanPanel++;
    }
    const pc = (pasan / n) * 100, pcp = (pasanPanel / n) * 100;
    const resumen = `${etiqueta}: modo ${p.modo}, mín ${(p.minAtenuacion * 100).toFixed(0)} %, aplicada ${(p.atenuacion * 100).toFixed(0)} %, ` +
      `texto suelto ${pc.toFixed(1)} % de píxeles ≥ 4,5:1, en panel ${pcp.toFixed(1)} %, acento ${p.contrasteAcento.toFixed(2)}:1, sobre-acento ${p.contrasteSobreAcento.toFixed(2)}:1`;
    const bien = pc >= 94.9 && pcp >= 94.9 && p.contrasteAcento >= 3 && p.contrasteSobreAcento >= 4.5 && p.atenuacion >= p.minAtenuacion - 1e-9;
    (bien ? ok : mal)(resumen);
    if (elegida === 0 && Math.abs(p.atenuacion - p.minAtenuacion) > 1e-9) mal("pedir 0 % debió quedarse en el mínimo");
  }
}

// El percentil debe pesar más que el promedio: una foto con un 10 % de píxeles blancos y el resto negro, en modo oscuro,
// necesita velo aunque su promedio sea muy oscuro.
{
  const datos = imagen((x, y) => (rnd() < 0.1 ? [255, 255, 255] : [5, 5, 5]));
  const an = f.analizar(datos, N, N);
  const m = f.minimaAtenuacion(an, "oscuro");
  m > 0.3 ? ok(`el percentil manda: foto casi negra con 10 % de blancos exige ≥ ${(m * 100).toFixed(0)} % de atenuación en modo oscuro`) : mal(`el percentil no pesó (${m})`);
}

console.log(fallos ? `\n${fallos} comprobación(es) fallida(s).` : "\nTodo correcto.");
process.exit(fallos ? 1 : 0);
