# Compilaciones de Cinta

El workflow `.github/workflows/build.yml` genera, en cada push a `main` o al subir una etiqueta `vX.Y.Z`:

| Plataforma | Archivos |
|---|---|
| Windows x64 | `Cinta-Setup-x64.exe`, `Cinta-Setup-x64.msi`, `Cinta-portable-x64.exe` |
| Windows ARM64 | `Cinta-Setup-ARM64.exe`, `Cinta-Setup-ARM64.msi`, `Cinta-portable-ARM64.exe` |
| Linux x64 | `Cinta-linux-x64.deb` (Debian/Ubuntu), `Cinta-linux-x64.rpm` (Fedora/openSUSE), `Cinta-linux-x64.AppImage`, `Cinta-linux-x64-portable.tar.gz` |
| Linux ARM64 | los mismos cuatro con `arm64` |

En total son **14 binarios** más `SHA256SUMS.txt`, siempre con los mismos nombres y en el mismo orden. Cada versión nueva publica ese conjunto completo; no se quitan formatos entre versiones.

Para publicar una versión: sube la etiqueta (`git tag v0.4.3 && git push origin v0.4.3`) o haz un commit en `main` cuyo mensaje empiece con `release:`. Los archivos aparecen en *Releases*.

Los portables de Windows necesitan WebView2 (ya viene con Windows 10/11). El portable de Linux necesita WebKitGTK 4.1 instalado; el AppImage ya es portable por sí mismo.
