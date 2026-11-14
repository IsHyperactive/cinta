# Documentación de Cinta

Aquí está todo lo que fui aprendiendo mientras construía Cinta: cómo compilarla, de dónde sale cada paquete, cómo firmarla y por qué tomé ciertas decisiones. Si vienes a tocar algo, empieza por el mapa de carpetas y por `AGENTS.md` (en la raíz); te ahorrará un par de tropiezos.

- [Mapa de carpetas](MAPA-DE-CARPETAS.md) — dónde vive cada cosa.
- **guias/** — [Compilar](guias/COMPILAR.md) · [Compilaciones](guias/COMPILACIONES.md) · [Firma de código](guias/SIGNING.md) · [OpenCode en Linux](guias/OPENCODE-LINUX.md) · [Prompt para OpenCode](guias/PROMPT-PARA-OPENCODE.md)
- **proyecto/** — [Contexto y decisiones](proyecto/CONTEXT.md) · [Diseño de escritorio](proyecto/apple-books-desktop-design.md)
- **legal/** — [Licencias de terceros](legal/THIRD_PARTY_LICENSES.md)
- [Cómo contribuir](../.github/CONTRIBUTING.md) · [Registros y pendientes](../registro/)

Los scripts de compilación viven en [`../herramientas/compilacion/`](../herramientas/compilacion/). Para armar los paquetes de Linux, por ejemplo:

```bash
npm --prefix aplicacion run tauri build -- --bundles deb,appimage
```
