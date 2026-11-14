
# Cinta lista para trabajar desde Linux

Este documento te ayudará a tener Cinta lista para tu uso, ya sea que quieras compilarla localmente o confiar en la compilación automática en GitHub.

## Ya está preparado en este proyecto

Los siguientes elementos ya vienen configurados para que todo funcione:

- `.github/workflows/build.yml`: Este archivo verifica que la interfaz funcione en Ubuntu, genera los paquetes para Linux (`.deb`, `.rpm` y AppImage) y compila Cinta en Windows para procesadores x64 y ARM64.
- `COMPILAR.md`: Aquí tienes los pasos detallados para compilar desde Linux si lo necesitas.
- `COMPILAR.md` también explica el flujo completo desde Linux.

## Procedimiento obligatorio

Después de subir los cambios autorizados a la rama principal o master:

1. **Abre la pestaña Actions** del repositorio en GitHub.
2. **Ejecuta "Compilar Cinta"** (también se inicia solo al hacer push o abrir un pull request).
3. **Cuando ambos trabajos terminen correctamente**, abre la ejecución y descarga los artefactos.

### Artefactos que se descargarán

- **Cinta-Linux-x64:** Contiene los paquetes `.deb`, `.rpm`, AppImage y portable `.tar.gz` para Linux.
- **Cinta-Windows-x64:** Contiene el ejecutable portable, el instalador NSIS y el paquete MSI para Windows de 64 bits.
- **Cinta-Windows-ARM64:** Igual que el anterior, pero para procesadores ARM64.

Dentro de cada paquete de Windows encontrarás el ejecutable portable (no necesita instalación), el instalador NSIS y el paquete MSI.

Los artefactos de compilación se conservan durante 30 días en la plataforma de GitHub Actions.

---

### ¿No eres desarrollador?

Si solo quieres usar Cinta, los paquetes ya compilados están disponibles en la [sección de releases](https://github.com/IsHyperactive/cinta/releases/latest) del repositorio. No necesitas compilar nada — solo descarga el archivo que corresponda a tu sistema operativo y comienza a usarlo.

---

### ¿Cómo compilo yo mismo en Linux?

Si tienes un equipo con Linux y quieres compilar Cinta localmente:

1. **Instala los requisitos:**
   - Node.js 22 LTS
   - Rust (a través de rustup)
   - Herramientas de compilación: `build-essential`, `libwebkit2gtk-4.1-dev`, etc.

2. **Ejecuta los pasos de compilación:**
   - `npm --prefix aplicacion install`
   - `npm --prefix aplicacion run typecheck`
   - `npm --prefix aplicacion run build`
   - `npm --prefix aplicacion run tauri build --bundles deb,appimage` (para Linux)
   - O usa el script completo: `../../herramientas/compilacion/compilar-todo.ps1` (considera que requiere entorno Windows para los `.exe`)

3. **Los paquetes se generarán** en la carpeta `aplicacion/src-tauri/target/release/bundle/`.

**¿Aún tienes dudas?** Revisa el archivo `documentacion/guias/COMPILAR.md` o abre una discusión en el repositorio.
