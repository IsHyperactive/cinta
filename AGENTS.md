# Instrucciones para agentes (OpenCode, Claude Code, etc.)

Proyecto: **Cinta**, lector de libros de escritorio (Tauri 2 + React + Rust) para Windows y Linux, x64 y ARM64.
Repositorio: https://github.com/IsHyperactive/cinta — rama única: `main`.

## Reglas que NO se rompen
1. **No reemplaces `.github/workflows/build.yml` por texto explicativo.** Debe ser YAML válido de GitHub Actions. Una versión anterior se perdió así y nunca compiló.
2. **Las versiones deben coincidir en 5 sitios:** `aplicacion/package.json`, `aplicacion/package-lock.json`, `aplicacion/src-tauri/tauri.conf.json`, `aplicacion/src-tauri/Cargo.toml` y `aplicacion/src-tauri/Cargo.lock`. El workflow usa `cargo check --locked`: si `Cargo.lock` no coincide, falla.
3. **No borres ramas ni reescribas historial** (nada de `push --force`, `reset --hard` sobre `main`). Todo se sube como un commit nuevo encima de `main`.
4. **No cambies el diseño ni los iconos** (Phosphor Icons, ver `aplicacion/src/AppleIcon.tsx`) salvo que se pida.
5. **No toques `documentacion/proyecto/CONTEXT.md` salvo para añadir** una entrada al registro de cambios.

## Antes de subir (siempre)
```
node herramientas/verificacion/verificar-release.mjs      # versiones sincronizadas y build.yml real
cd aplicacion && npm ci && npm run typecheck && npm run build
```
Si algo falla, corrígelo; no subas con errores.

## Subir y compilar
Sigue `documentacion/guias/PROMPT-PARA-OPENCODE.md` (en la raíz): contiene los pasos exactos, incluida la etiqueta `vX.Y.Z` que dispara la compilación y la publicación en Releases.

## Qué compila el workflow
Windows x64 y ARM64 (un único `.exe` portable, sin instalador) y Linux x64 y ARM64 (`.deb` para Debian/Ubuntu, `.rpm` para Fedora/openSUSE y `.AppImage`, que es universal). En total son **9 archivos**: 8 binarios más `SHA256SUMS.txt`, siempre los mismos nombres. Detalle en `documentacion/guias/COMPILACIONES.md`.
