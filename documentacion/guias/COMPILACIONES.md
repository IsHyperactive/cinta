# Compilaciones de Cinta

El workflow `.github/workflows/build.yml` genera, en cada push a `main` o al subir una etiqueta `vX.Y.Z`:

| Plataforma | Archivos |
|---|---|
| Windows x64 | `Cinta-Setup-x64.exe`, `Cinta-Setup-x64.msi`, `Cinta-portable-x64.exe` |
| Windows ARM64 | `Cinta-Setup-ARM64.exe`, `Cinta-Setup-ARM64.msi`, `Cinta-portable-ARM64.exe` |
| Linux x64 | `.deb` (Debian/Ubuntu), `.rpm` (Fedora), `.AppImage`, `-portable.tar.gz` |
| Linux ARM64 | `.deb`, `.rpm`, `.AppImage`, `-portable.tar.gz` |

Para publicar una versión: sube la etiqueta (`git tag v0.4.3 && git push origin v0.4.3`) o haz un commit en `main` cuyo mensaje empiece con `release:`. Los archivos aparecen en *Releases* junto con `SHA256SUMS.txt`.

Los portables de Windows necesitan WebView2 (ya viene con Windows 10/11). El portable de Linux necesita WebKitGTK 4.1 instalado; el AppImage ya es portable por sí mismo.
