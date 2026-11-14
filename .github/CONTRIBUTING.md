# Cómo contribuir a Cinta

Gracias por pasarte por aquí. Cinta es un proyecto pequeño y cualquier ayuda cuenta:
un reporte de un fallo, una idea, una prueba en otro equipo o un cambio de código.

## Antes de nada: cuéntame qué necesitas

- Si encontraste un **fallo**, abre un [issue](https://github.com/IsHyperactive/cinta/issues/new).
  Incluye el sistema operativo, la versión de Cinta, el formato del libro y los pasos para repetirlo.
- Si tienes una **idea** o quieres comentar cómo usas la app, entra en
  [Discussions](https://github.com/IsHyperactive/cinta/discussions).
- Si vas a hacer un **cambio grande**, abre primero un issue para hablarlo. Así evitamos que
  trabajes en algo que no encaja con el rumbo del proyecto.

No hace falta programar para contribuir. Probar la app en Windows, ARM64 o distintas
distribuciones de Linux, revisar la redacción de la guía o avisar de una pantalla confusa
también ayuda mucho.

## Regla de sala limpia (obligatoria)

Cinta se construye desde cero. **No se aceptan** aportes que contengan o deriven de:

- código, recursos, iconos, fuentes, textos o capturas copiados de aplicaciones propietarias
  (incluida Apple Books);
- resultados de descompilar, desensamblar o extraer archivos de otras aplicaciones.

**Sí se acepta** trabajo basado en especificaciones abiertas (EPUB, PDF, etc.), documentación
pública, las funciones que cualquier usuario ve al usar un lector de libros, y diseño e
ilustraciones originales. El nombre, el icono y la identidad visual de Cinta son propios y no
deben imitar marcas ajenas.

## Antes de enviar un cambio

1. Declara en la descripción que el trabajo es tuyo y que respeta la regla anterior.
2. Si agregas una dependencia, debe tener licencia compatible con MIT, compilar en
   `aarch64-pc-windows-msvc` y quedar anotada en
   [`documentacion/legal/THIRD_PARTY_LICENSES.md`](../documentacion/legal/THIRD_PARTY_LICENSES.md).
3. Cada pantalla nueva debe cumplir las reglas táctiles de
   [`documentacion/proyecto/CONTEXT.md`](../documentacion/proyecto/CONTEXT.md) (sección 3B).
4. Sin telemetría ni conexiones de red ocultas.
5. Actualiza [`documentacion/proyecto/CONTEXT.md`](../documentacion/proyecto/CONTEXT.md) con una entrada nueva en el registro de
   actualizaciones.

## Compilar y comprobar

Desde la raíz del repositorio:

```bash
npm --prefix aplicacion install
npm --prefix aplicacion run typecheck
npm --prefix aplicacion run build
```

Para los ejecutables de Windows y los paquetes de Linux, consulta
[`documentacion/guias/COMPILAR.md`](../documentacion/guias/COMPILAR.md) y los scripts de [`herramientas/compilacion/`](../herramientas/compilacion/).

Si el cambio toca la interfaz, pruébalo también con ventana estrecha y con el tema oscuro.
Si toca Rust, ejecuta `cargo check` antes de abrir el pull request.

## Qué reviso en un pull request

- Que el cambio resuelva un problema real y no rompa lo que ya funciona.
- Que mantenga el comportamiento táctil y el almacenamiento local.
- Que los textos estén en español y las variables en inglés, como el resto del código.
- Que no añada dependencias innecesarias ni conexiones de red.

No busco perfección. Un cambio pequeño, bien explicado y probado vale más que uno enorme
sin contexto. Si algo no queda claro, lo hablamos en el issue o en el propio pull request.
