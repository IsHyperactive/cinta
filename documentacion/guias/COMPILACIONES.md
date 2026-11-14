# Compilaciones de Cinta

El workflow `.github/workflows/build.yml` genera, en cada push a `main` o al subir una etiqueta `vX.Y.Z`:

| Plataforma | Archivos |
|---|---|
| Windows x64 | `Cinta-portable-x64.exe` (portable, sin instalador) |
| Windows ARM64 | `Cinta-portable-ARM64.exe` (portable, sin instalador) |
| Linux x64 | `Cinta-linux-x64.deb` (Debian/Ubuntu), `Cinta-linux-x64.rpm` (Fedora/openSUSE), `Cinta-linux-x64.AppImage` (universal) |
| Linux ARM64 | los mismos tres con `arm64` |

En total son **9 archivos**: 8 binarios más `SHA256SUMS.txt`, siempre con los mismos nombres y en el mismo orden. Cada versión nueva publica ese conjunto completo; no se quitan ni se añaden formatos entre versiones.

Para publicar una versión: sube la etiqueta (`git tag v0.4.3 && git push origin v0.4.3`) o haz un commit en `main` cuyo mensaje empiece con `release:`. Los archivos aparecen en *Releases*.

Los portables de Windows necesitan WebView2 (ya viene con Windows 10/11). En Linux, el AppImage es portable por sí mismo; el `.deb` y el `.rpm` instalan Cinta y usan WebKitGTK 4.1.
