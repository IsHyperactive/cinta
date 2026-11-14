# Documentación de Cinta

- [Mapa de carpetas](MAPA-DE-CARPETAS.md) — dónde está cada cosa.
- **guias/** — [Compilar](guias/COMPILAR.md) · [Compilaciones](guias/COMPILACIONES.md) · [Firma de código](guias/SIGNING.md) · [OpenCode en Linux](guias/OPENCODE-LINUX.md) · [Prompt para OpenCode](guias/PROMPT-PARA-OPENCODE.md)
- **proyecto/** — [Contexto y decisiones](proyecto/CONTEXT.md) · [Diseño de escritorio](proyecto/apple-books-desktop-design.md)
- **legal/** — [Licencias de terceros](legal/THIRD_PARTY_LICENSES.md)
- [Cómo contribuir](../.github/CONTRIBUTING.md) · [Registros y pendientes](../registro/)

Scripts de compilación: [`../herramientas/compilacion/`](../herramientas/compilacion/). Paquetes de Linux:

```bash
npm --prefix aplicacion run tauri build -- --bundles deb,appimage
```
