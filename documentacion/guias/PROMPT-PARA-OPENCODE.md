# Cómo usar este zip con OpenCode

Este zip es el proyecto completo de Cinta, versión **V0.6.0**. OpenCode debe subirlo a GitHub y dejar que GitHub Actions compile los paquetes.

## Paso 0 — Tú (una sola vez)
1. Ten tu repositorio clonado en una carpeta (por ejemplo `cinta`), con tu sesión de Git/GitHub ya iniciada (`git push` debe funcionar; `gh auth status` también, si usas la CLI de GitHub).
2. Descomprime este zip **en otra carpeta** (por ejemplo `CintaV0.6.0`).
3. Abre OpenCode **dentro de la carpeta clonada de tu repositorio** y pégale el prompt de abajo.

## Prompt para pegar en OpenCode

```
Estoy en el repositorio clonado de Cinta (https://github.com/IsHyperactive/cinta).
La carpeta con la nueva versión es: <RUTA A LA CARPETA DESCOMPRIMIDA CintaV0.6.0>

Haz exactamente esto, en orden, y detente y avísame si algo falla:

1. git fetch origin && git checkout main && git pull --ff-only origin main
2. Sincroniza el contenido de la carpeta nueva sobre este repositorio, borrando lo que ya no exista allí pero SIN tocar .git:
   rsync -a --delete --exclude '.git' "<RUTA>/" ./
   (en Windows sin rsync: robocopy "<RUTA>" . /MIR /XD .git)
3. Lee AGENTS.md y respeta sus reglas.
4. Ejecuta: node herramientas/verificacion/verificar-release.mjs
   y luego: cd aplicacion && npm ci && npm run typecheck && npm run build && cd ..
   Si algo falla, corrígelo sin cambiar el diseño ni borrar nada y repite.
5. git add -A && git commit -m "release: Cinta 0.6.0"
6. git push origin main        (sin --force; debe ser un push normal)
7. git tag v0.6.0 && git push origin v0.6.0
8. Vigila la compilación en GitHub Actions (gh run watch, o gh run list --limit 5).
   Si algún job falla, lee el log (gh run view --log-failed), corrige el código o el workflow,
   haz un commit nuevo "fix: ..." y vuelve a subir. Si ya existe la etiqueta, muévela:
   git tag -f v0.6.0 && git push -f origin v0.6.0  (solo la etiqueta, nunca main).
9. Cuando termine, muéstrame la lista de archivos de la release v0.6.0:
   gh release view v0.6.0 --json assets --jq '.assets[].name'
```

## Qué deberías ver al final en GitHub → Releases → v0.6.0
- Windows: `Cinta-Setup-x64.exe` y `Cinta-Setup-ARM64.exe`
- Linux x64: `Cinta-linux-x64.deb` (Debian/Ubuntu), `.rpm` (Fedora/openSUSE) y `.AppImage`
- Linux ARM64: los mismos tres con `arm64`
- `SHA256SUMS.txt`

## Si falla algo
Pásame el mensaje de error de la pestaña **Actions** (o lo que te diga OpenCode) y lo corrijo en la siguiente versión.
