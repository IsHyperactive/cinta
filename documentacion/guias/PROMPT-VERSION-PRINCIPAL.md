# Reemplazar las versiones publicadas por esta, que pasa a ser la versión principal

**Decisión del dueño del proyecto:** las versiones que hay publicadas en GitHub (**v0.7.0** y **v0.7.1**) quedan
**descontinuadas porque tienen fallos**. Hay que **eliminarlas** y publicar en su lugar la **0.7.2**, que será
la **versión principal**. A partir de ella saldrán todas las versiones nuevas.

Esta autorización es solo para lo que dice este archivo. Todo lo demás de `AGENTS.md` sigue en pie.

## Por qué se retiran la 0.7.0 y la 0.7.1
| Versión | Fallo |
|---|---|
| `0.7.0` | La animación «Hoja de libro» era rígida, giraba plana con perspectiva, se salía del borde de la página y mostraba un reverso gris; no igualaba el pase de hoja de Apple Books. Además, el deslizador «Desenfoque» solo afectaba al cristal de los paneles y nunca difuminaba la imagen del fondo. |
| `0.7.1` | Retiró la animación «Hoja de libro» y arregló la lista de la guía, pero seguía arrastrando el fallo del desenfoque: con la atenuación alta el control parecía no hacer nada. |
| `0.7.2` | Reúne lo bueno de las dos anteriores y corrige el desenfoque: el deslizador difumina la propia imagen (`--fondo-img-blur`) y sigue actuando al mover la atenuación. Es la única que debe quedar publicada. |

## Qué se elimina y qué NO
| Sí se elimina | No se toca nunca |
|---|---|
| La *Release* `v0.7.0` y su etiqueta `v0.7.0` | La rama `main` (no se borra ni se reescribe) |
| La *Release* `v0.7.1` y su etiqueta `v0.7.1` | El historial de commits (nada de `push --force` ni `reset --hard` sobre `main`) |
| | Cualquier otra rama, etiqueta o release que no sean esas dos |

La versión nueva se sube como **un commit nuevo encima de `main`**, con un push normal.

## Número de versión
La versión nueva es **0.7.2** (cámbiala aquí si quieres otra: `NUEVA_VERSION=0.7.2`). Debe quedar igual en los 5 sitios que
exige `AGENTS.md`: `aplicacion/package.json`, `aplicacion/package-lock.json`, `aplicacion/src-tauri/tauri.conf.json`,
`aplicacion/src-tauri/Cargo.toml` y `aplicacion/src-tauri/Cargo.lock`. No reutilices 0.7.0 ni 0.7.1.

## Prompt para pegar en OpenCode

```
Estoy en el repositorio clonado de Cinta (https://github.com/IsHyperactive/cinta).
La carpeta con la versión nueva (será la versión principal) es: <RUTA A LA CARPETA DESCOMPRIMIDA>
NUEVA_VERSION = 0.7.2

Contexto: las releases v0.7.0 y v0.7.1 están descontinuadas por tener fallos (la 0.7.0 por la animación «Hoja de
libro» y el desenfoque del fondo; la 0.7.1 por seguir con el desenfoque roto). Hay que eliminarlas y publicar esta
versión como la principal. Haz exactamente esto, en orden. Detente y avísame si algo falla o si algo no coincide
con lo que describo; no improvises.

A. Comprobaciones previas (no cambian nada)
1. gh auth status   y   git fetch origin --tags && git checkout main && git pull --ff-only origin main
2. gh release list --limit 50   y   git tag -l
   Confirma que existen v0.7.0 y v0.7.1. Muéstrame la lista completa de releases y etiquetas.
   Si hay otras releases o etiquetas distintas de esas dos, NO las toques; solo avísame de que existen.

B. Preparar la versión nueva (todavía no se borra nada en GitHub)
3. Lee AGENTS.md y VERSIONES-PERMITIDAS.md y respétalos.
4. Sincroniza la carpeta nueva sobre este repositorio sin tocar .git:
   rsync -a --delete --exclude '.git' "<RUTA>/" ./
   (en Windows sin rsync: robocopy "<RUTA>" . /MIR /XD .git)
5. Confirma que la versión ya es NUEVA_VERSION en los 5 sitios de AGENTS.md. En Cargo.lock cambia solo la entrada
   del paquete de Cinta (sin tocar dependencias) y comprueba con: cd aplicacion/src-tauri && cargo check --locked
6. Revisa la entrada de NUEVA_VERSION en registro/REGISTRO-DE-CAMBIOS.md y añade lo que falte, con las cuatro
   secciones (Añadido / Cambiado / Corregido / Falta por hacer), indicando:
   - Cambiado: esta versión pasa a ser la única publicada; v0.7.0 y v0.7.1 se eliminaron por descontinuadas.
     Explica los motivos: la 0.7.0 por la animación «Hoja de libro» y el desenfoque que no difuminaba la imagen;
     la 0.7.1 por seguir arrastrando el desenfoque roto.
   - Corregido: el desenfoque ahora difumina la propia imagen y sigue funcionando al mover la atenuación.
   - Falta por hacer: probar el desenfoque con fotos reales en la app real (WebView2 y WebKitGTK).
   En registro/REGISTRO-DE-VERSIONES.md marca 0.7.2 como principal y 0.7.0/0.7.1 como eliminadas, y actualiza
   registro/PENDIENTES.md. No borres entradas viejas. En documentacion/proyecto/CONTEXT.md solo añade una entrada
   al registro de cambios.
7. Verifica:
   node herramientas/verificacion/verificar-release.mjs
   cd aplicacion && npm ci && npm run typecheck && npm run build && cd ..
   Si algo falla, corrígelo sin cambiar el diseño ni borrar nada y repite. NO sigas al paso C hasta que todo esté en verde.

C. Subir la versión nueva
8. git add -A && git commit -m "release: Cinta NUEVA_VERSION (versión principal; sustituye a 0.7.0 y 0.7.1)"
9. git push origin main        (push normal, sin --force)

D. Eliminar las versiones descontinuadas (solo v0.7.0 y v0.7.1)
10. gh release delete v0.7.0 --cleanup-tag --yes
    gh release delete v0.7.1 --cleanup-tag --yes
    Si alguna release no existe pero su etiqueta sí, borra solo la etiqueta:
    git push origin --delete v0.7.0   /   git push origin --delete v0.7.1   y   git tag -d v0.7.0 v0.7.1
11. Comprueba: gh release list y git ls-remote --tags origin. No deben aparecer v0.7.0 ni v0.7.1.

E. Publicar la versión principal
12. git tag vNUEVA_VERSION && git push origin vNUEVA_VERSION   (la etiqueta dispara la compilación y la release)
13. Vigila GitHub Actions: gh run watch (o gh run list --limit 5). Si un job falla: gh run view --log-failed,
    corrige el código o el workflow, haz un commit nuevo "fix: ..." y vuelve a subir. Si hay que mover la etiqueta:
    git tag -f vNUEVA_VERSION && git push -f origin vNUEVA_VERSION   (solo la etiqueta, nunca main).
14. Cuando termine, muéstrame: gh release view vNUEVA_VERSION --json assets --jq '.assets[].name'
    Deben ser exactamente los 9 archivos de VERSIONES-PERMITIDAS.md. Si falta uno o sobra otro, corrige el workflow.
15. Marca vNUEVA_VERSION como la release «Latest» (gh release edit vNUEVA_VERSION --latest), escribe las notas en
    español explicando por qué se retiraron la 0.7.0 y la 0.7.1, y dime la URL final.
```

## Orden y por qué
Primero se prepara y se verifica todo (pasos A–B), después se sube (C) y solo entonces se borran las dos versiones viejas (D). Así, si la
verificación falla, las versiones antiguas siguen ahí y no te quedas sin ninguna publicada.

## Después de esto
Desde esta versión salen todas las nuevas: se parte de `main`, se sube la versión en los 5 sitios y se sigue `PROMPT-PARA-OPENCODE.md`.
