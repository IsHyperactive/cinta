# Versiones (compilaciones) permitidas de Cinta

> **Para OpenCode y cualquier otro agente:** este archivo manda sobre cualquier otra idea de empaquetado.
> Cinta solo puede existir en **estas 9 salidas**, con **estos nombres exactos**. No añadas, quites ni
> renombres ninguna, y no cambies `.github/workflows/build.yml` para producir otras.

## Lista cerrada (9 archivos por versión)

| # | Archivo | Plataforma |
|---|---|---|
| 1 | `Cinta-portable-x64.exe` | Windows x64 (portable, sin instalador) |
| 2 | `Cinta-portable-ARM64.exe` | Windows ARM64 (portable, sin instalador) |
| 3 | `Cinta-linux-x64.AppImage` | Linux x64 (universal) |
| 4 | `Cinta-linux-x64.deb` | Linux x64 (Debian/Ubuntu) |
| 5 | `Cinta-linux-x64.rpm` | Linux x64 (Fedora/openSUSE) |
| 6 | `Cinta-linux-arm64.AppImage` | Linux ARM64 (universal) |
| 7 | `Cinta-linux-arm64.deb` | Linux ARM64 (Debian/Ubuntu) |
| 8 | `Cinta-linux-arm64.rpm` | Linux ARM64 (Fedora/openSUSE) |
| 9 | `SHA256SUMS.txt` | Sumas de verificación de los 8 anteriores |

## Prohibido
- Instaladores de Windows (`.msi`, NSIS `-setup.exe`) o cualquier `.exe` que no sea uno de los dos portables.
- macOS (`.dmg`, `.app`), Android, iOS, `.zip`/`.tar.gz` de binarios, Flatpak, Snap u otros formatos.
- Otras arquitecturas (x86 de 32 bits, RISC-V, etc.).
- Cambiar los nombres, el orden o la cantidad de archivos entre versiones: cada versión publica el conjunto completo y solo ese.

## Comprobación antes de publicar
Una versión es válida únicamente si su *Release* tiene exactamente los 9 archivos de la tabla.
Si falta uno o sobra otro, corrige el workflow; no publiques así.
