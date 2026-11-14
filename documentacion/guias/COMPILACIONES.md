# Compilaciones de Cinta

El workflow `.github/workflows/build.yml` genera, en cada push a `main` o al subir una etiqueta `vX.Y.Z`:

| Plataforma | Archivo |
|---|---|
| Windows x64 | `Cinta-Setup-x64.exe` |
| Windows ARM64 | `Cinta-Setup-ARM64.exe` |
| Linux x64 | `.deb` (Debian/Ubuntu), `.rpm` (Fedora/openSUSE) y `.AppImage` |
| Linux ARM64 | `.deb`, `.rpm` y `.AppImage` |

En total son **8 archivos** más `SHA256SUMS.txt`. La idea es no marear: un instalador por arquitectura en Windows y tres formas de instalar (o no instalar) en Linux.

Para publicar una versión: sube la etiqueta (`git tag v0.4.3 && git push origin v0.4.3`) o haz un commit en `main` cuyo mensaje empiece con `release:`. Los archivos aparecen en *Releases*.

Los instaladores de Windows necesitan WebView2 (ya viene con Windows 10/11). En Linux hace falta WebKitGTK 4.1; el AppImage ya es portable por sí mismo.
