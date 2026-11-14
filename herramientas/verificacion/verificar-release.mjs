// Comprueba, sin dependencias, que el proyecto está listo para compilar y publicar.
// Uso (desde la raíz del repositorio):  node herramientas/verificacion/verificar-release.mjs
import { readFileSync, existsSync } from "node:fs";

const leer = (p) => readFileSync(p, "utf8");
const errores = [];
const ok = (m) => console.log("  ✔ " + m);
const fallo = (m) => { errores.push(m); console.log("  ✘ " + m); };

const pkg = JSON.parse(leer("aplicacion/package.json")).version;
const lock = JSON.parse(leer("aplicacion/package-lock.json"));
const tauri = JSON.parse(leer("aplicacion/src-tauri/tauri.conf.json")).version;
const cargo = leer("aplicacion/src-tauri/Cargo.toml").match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const cargoLock = leer("aplicacion/src-tauri/Cargo.lock").match(/name = "cinta"\nversion = "([^"]+)"/)?.[1];

console.log(`Versión en package.json: ${pkg}`);
const versiones = {
  "package-lock.json": lock.version,
  "package-lock.json (raíz)": lock.packages?.[""]?.version,
  "tauri.conf.json": tauri,
  "Cargo.toml": cargo,
  "Cargo.lock": cargoLock,
};
for (const [archivo, v] of Object.entries(versiones)) {
  v === pkg ? ok(`${archivo} = ${v}`) : fallo(`${archivo} tiene ${v} y debería tener ${pkg} (cargo --locked fallará si Cargo.lock no coincide)`);
}

const regPath = "registro/REGISTRO-DE-CAMBIOS.md";
if (!existsSync(regPath)) fallo("Falta " + regPath);
else leer(regPath).includes(`[${pkg}]`) ? ok(`El registro de cambios tiene la entrada [${pkg}]`) : fallo(`Falta la entrada [${pkg}] en ${regPath}`);

const wfPath = ".github/workflows/build.yml";
if (!existsSync(wfPath)) fallo("Falta " + wfPath);
else {
  const wf = leer(wfPath);
  const lineas = wf.split("\n");
  const prosa = lineas.findIndex((l) => /^\s*(pasos|estrategia|cuándo se ejecuta)\s*:\s*$/.test(l) || /^\s*\d+\.\s+\*\*/.test(l));
  prosa >= 0 ? fallo(`build.yml parece texto explicativo y no un workflow (línea ${prosa + 1}). Restáuralo desde el repositorio.`) : ok("build.yml no es prosa");
  for (const clave of ["\non:", "\njobs:", "runs-on:", "ubuntu-22.04-arm", "windows-latest", "--bundles deb,rpm,appimage", "--bundles nsis,msi", "Cinta-linux-$arch-portable.tar.gz", "Cinta-portable-$arch.exe", "Cinta-Setup-$arch.msi"]) {
    wf.includes(clave) || (clave === "\non:" && wf.startsWith("on:")) ? ok(`build.yml contiene «${clave.trim()}»`) : fallo(`build.yml no contiene «${clave.trim()}»`);
  }
}

if (errores.length) { console.log(`\n${errores.length} problema(s). Corrígelos antes de subir.`); process.exit(1); }
console.log(`\nTodo en orden. Para publicar: git tag v${pkg} && git push origin main v${pkg}`);
