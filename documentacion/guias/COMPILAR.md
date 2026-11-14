
# Cómo compilar y exportar Cinta (para tu uso personal)

Cinta se distribuye para **Windows** (x64 y ARM64) y **Linux** (x64). Puedes desarrollar desde cualquier computadora con Linux: los paquetes de Linux se generan en tu equipo o en un servidor de compilación, y los ejecutables de Windows se compilan automáticamente en la nube. No necesitas tener Windows en tu computadora.

## 1. Requisitos en Linux (si quieres compilar localmente)

- Git.
- Node.js 22 (versión estándar) y npm.
- Para generar los paquetes de Linux: `libwebkit2gtk-4.1-dev` y herramientas básicas de compilación.
- Una cuenta de GitHub si quieres subir tu proyecto.

**¿Necesitas Rust?** No. GitHub Actions se encarga de compilar los ejecutables de Windows en sus servidores. Si también quieres compilar los paquetes Linux o hacer pruebas en Rust, puedes instalarlo localmente, pero no es obligatorio.

## 2. Compilación local en Linux (opcional)

Desde la carpeta principal del proyecto (donde está el archivo `package.json`):

```bash
node --version
npm --version
npm --prefix aplicacion install
npm --prefix aplicacion run typecheck
npm --prefix aplicacion run build
```

Estas órdenes instalan lo necesario y compilan la interfaz web. **No generan el `.exe` de Windows** — eso se hace en la nube.

Para generar los paquetes de **Linux** en tu equipo Debian/Ubuntu:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential
npm --prefix aplicacion run tauri build --bundles deb,appimage
```

Los paquetes se generarán en la carpeta `aplicacion/src-tauri/target/release/bundle/`:
- `deb/Cinta_<versión>_amd64.deb` — para instalar en Debian/Ubuntu
- `rpm/Cinta-<versión>-1.x86_64.rpm` — para Fedora/openSUSE
- `appimage/Cinta_<versión>_amd64.AppImage` — sin instalación necesaria

**¿Quieres un `.exe` de Windows?** No intentes compilarlo en Linux. El sistema de compilación automática de GitHub lo hará por ti usando herramientas de Windows.

## 3. Compilación automática en GitHub Actions

GitHub ya tiene un workflow listo para compilar Cinta cada vez que subes cambios a la rama principal.

1. **Sube tu proyecto** a GitHub (incluye la carpeta `.github`).
2. **Autentícate** con GitHub CLI (`gh auth login`) o desde la web.
3. **Sube los cambios** a la rama principal o master.
4. **Ve a la pestaña Actions** y haz clic en "Compilar Cinta". También se inicia solo al hacer push o abrir un pull request.

El workflow primero verifica que el código TypeScript esté correcto, y después compila en paralelo para:
- **Linux:** paquetes `.deb`, `.rpm` y AppImage.
- **Windows:** instaladores NSIS y MSI para x64 y ARM64.

Cuando los trabajos terminen, abre la ejecución en **Actions → Artifacts** y descarga los paquetes para tu sistema.

**¿Para qué sirve esto?** Si eres desarrollador, te permite tener los paquetes compilados localmente. Si solo quieres usar Cinta, los paquetes ya están listos en la sección de releases.

## ¿Cómo obtengo el ejecutable para Windows?

Después de subir los cambios a la rama principal, el workflow de GitHub compilará automáticamente los instaladores para Windows. Puedes descargarlos en la sección de **Releases** del repositorio.

Dentro de cada paquete de Windows encontrarás:
- **Ejecutable portable:** ¡No se instala! Descomprímelo donde quieras y ejecútalo.
- **Instalador NSIS:** El instalador tradicional que crea accesos directos.
- **Paquete MSI:** Instalador de Windows para entornos profesionales.

Los artefactos se conservan durante 30 días en la plataforma de GitHub Actions.

---

**¿No eres desarrollador?** ¡No te preocupa! Los paquetes ya compilados están disponibles en la [sección de releases](https://github.com/IsHyperactive/cinta/releases/latest) de Cinta. Solo necesitas descargar el archivo que corresponda a tu sistema operativo y comenzar a usarlo.
