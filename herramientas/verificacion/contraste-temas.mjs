// Comprueba el contraste de las paletas de aplicacion/src/estilos/temas.css (la fuente de verdad), sin dependencias.
// Uso (desde la raíz del repositorio):  node herramientas/verificacion/contraste-temas.mjs
// Reglas: texto normal ≥ 4,5:1 contra cada fondo donde se escribe; acento ≥ 3:1; --accent-text ≥ 4,5:1 sobre el acento.
import { readFileSync } from "node:fs";

const css = readFileSync("aplicacion/src/estilos/temas.css", "utf8");
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

let fallos = 0;
for (const tema of ["claro", "oscuro", "sepia", "medianoche"]) {
  const bloque = css.match(new RegExp(`html\\[data-tema="${tema}"\\]\\s*\\{([^}]*)\\}`))?.[1];
  if (!bloque) { console.log(`✘ no encuentro el tema ${tema}`); fallos++; continue; }
  const v = Object.fromEntries([...bloque.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  const fondos = { "--bg": v["--bg"], "--panel": v["--panel"], "--desktop-sidebar": v["--desktop-sidebar"], "--desktop-card": v["--desktop-card"] };
  console.log(`\n${tema}`);
  const prueba = (nombre, a, b, minimo) => {
    const c = cr(a, b);
    const bien = c >= minimo;
    if (!bien) fallos++;
    console.log(`  ${bien ? "✔" : "✘"} ${nombre}: ${c.toFixed(2)}:1 (mín ${minimo})`);
  };
  for (const [n, f] of Object.entries(fondos)) {
    prueba(`--text sobre ${n}`, v["--text"], f, 4.5);
    prueba(`--muted sobre ${n}`, v["--muted"], f, 4.5);
    prueba(`--accent sobre ${n}`, v["--accent"], f, 3);
  }
  prueba("--accent-text sobre --accent", v["--accent-text"], v["--accent"], 4.5);
}
console.log(fallos ? `\n${fallos} comprobación(es) fallida(s).` : "\nTodas las paletas cumplen.");
process.exit(fallos ? 1 : 0);
