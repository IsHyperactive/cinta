
# Cinta

**Tu biblioteca personal, táctil y sin nube.**

Lector de libros para **Windows y Linux**. Sin cuentas, sin sincronización y sin telemetría:
tus libros, tus notas y tu progreso se quedan en tu equipo.

---

## Descargar

Cinta está disponible para Windows x64, Windows ARM64 y Linux x64. Elige el archivo que corresponda a tu equipo:

| Plataforma | Sin instalar | Instalador | Paquete adicional |
| :--- | :--- | :--- | :--- |
| **Windows x64** (Intel/AMD) | [Cinta-portable-x64.exe](https://github.com/IsHyperactive/cinta/releases/latest/download/Cinta-portable-x64.exe) | [Cinta-Setup-x64.exe](https://github.com/IsHyperactive/cinta/releases/latest/download/Cinta-Setup-x64.exe) | [Cinta-x64.msi](https://github.com/IsHyperactive/cinta/releases/latest/download/Cinta-x64.msi) |
| **Windows ARM64** | [Cinta-portable-ARM64.exe](https://github.com/IsHyperactive/cinta/releases/latest/download/Cinta-portable-ARM64.exe) | [Cinta-Setup-ARM64.exe](https://github.com/IsHyperactive/cinta/releases/latest/download/Cinta-Setup-ARM64.exe) | [Cinta-ARM64.msi](https://github.com/IsHyperactive/cinta/releases/latest/download/Cinta-ARM64.msi) |
| **Linux x64** | [Cinta-linux-x64.AppImage](https://github.com/IsHyperactive/cinta/releases/latest/download/Cinta-linux-x64.AppImage) | [Cinta-linux-x64.deb](https://github.com/IsHyperactive/cinta/releases/latest/download/Cinta-linux-x64.deb) (Debian/Ubuntu) | [Cinta-linux-x64.rpm](https://github.com/IsHyperactive/cinta/releases/latest/download/Cinta-linux-x64.rpm) (Fedora/openSUSE) |

### ¿Qué es cada archivo?

- **Portable (EXE):** No se instala. ¡Descomprímelo donde quieras y ejecútalo! La biblioteca queda en `CintaData`, junto al `.exe`. Úsalo en cualquier computadora o en un USB.
- **Instalador (Setup .exe):** Crea accesos directos en el menú Inicio y agrega Cinta como una aplicación más de tu sistema. En Windows 11 ya viene WebView2 integrado; el instalador puede descargarlo si falta.
- **MSI:** El instalador tradicional de Windows, ideal para entornos corporativos o si prefieres ese tipo de instalación.
- **AppImage:** ¡Funciona sin instalar! Dale permiso de ejecución (`chmod +x`) y ábrelo como cualquier otro programa.
- **DEB:** Paquete para Debian y Ubuntu. Se instala con tu gestor de paquetes habitual.
- **RPM:** Paquete para Fedora y openSUSE.

### Linux

- **AppImage:** Dale permiso de ejecución y ábrelo. No necesita instalación.
- **DEB:** Para Debian y Ubuntu.
- **RPM:** Para Fedora y openSUSE.
- Necesitas WebKitGTK 4.1 en Linux (`libwebkit2gtk-4.1-0` en Debian/Ubuntu).

**¿Cómo instalo en Linux?**

```bash
chmod +x Cinta-linux-x64.AppImage
./Cinta-linux-x64.AppImage

# O, en Debian/Ubuntu:
sudo apt install ./Cinta-linux-x64.deb
```

### Novedades de la versión 0.6.1

- **Apariencia:** botón al pie de la barra lateral (o `Ctrl + ,`) para elegir tema: Automático (el de siempre), Claro, Oscuro, Sepia guinda o Medianoche. Solo cambian los colores.
- **Fondo personalizado:** pon tu propia imagen detrás de la biblioteca. Cinta la reduce, adapta el color del texto y del acento a la foto (todo en tu equipo, sin internet) y garantiza que se lea, con atenuación y desenfoque ajustables. El lector no usa la imagen.

### Novedades de la versión 0.6.0

- **Series:** agrupa libros en una serie con su número (Editar información) y ordénalos por «Serie».
- **Tiempo de lectura:** se guarda en la base de datos (entra en la copia de seguridad) y el detalle de cada libro muestra el total y los días leídos.
- **Lector EPUB:** leer en voz alta con las voces del sistema, desplazamiento continuo, ancho del texto ajustable, y «Copiar» y «Buscar» al seleccionar texto.
- Biblioteca más ágil con muchos libros (índices y carga diferida).

### ¿Qué puedes hacer con Cinta?

**Ordenar tu biblioteca**

- Importa libros con el botón, arrastrándolos a la ventana o pasando una carpeta completa.
- Crea colecciones, agrupa en series, busca por título, autor o serie y cambia entre vista de cuadrícula y lista.
- Cinta guarda una copia de cada libro en su carpeta de datos. Tu archivo original se queda donde está.

**Leer**

- **EPUB:** paginación o desplazamiento continuo, índice, búsqueda, temas, tipografías, ancho del texto, lectura en voz alta, gestos táctiles y progreso guardado.
- **PDF:** desplazamiento continuo, zoom, miniaturas, índice, búsqueda y modo noche.
- **Cómics CBZ/CBR:** lector de páginas con ajuste de imagen y modo manga.
- **Documentos:** TXT, HTML, DOCX, FB2, MOBI y AZW3 convertidos para leer dentro de la app.
- **Audiolibros:** M4B, M4A y MP3 con velocidad, temporizador, marcadores y controles multimedia.

**Anotar**

- Marcadores, resaltados en cuatro colores y notas de texto.
- Trazos a mano con lápiz o stylus.
- Todo queda asociado al libro y se recupera al volver a abrirlo.

**Usarla con el dedo**

- Botones grandes, gestos y menús pensados para pantalla táctil.
- Se adapta a horizontal, vertical y ventanas estrechas.
- Tema claro u oscuro según el sistema.

### Empezar sin manual

- Cinta incluye su propia **Guía de Cinta** como libro de bienvenida, dentro del ejecutable.
- La primera vez que abres la app, la guía aparece ya en tu biblioteca.

**Privacidad**

Cinta no tiene servidores. No hay cuentas, ni inicio de sesión, ni telemetría, ni conexiones en segundo plano para "mejorar el servicio".

- Solo trabaja con archivos de tu equipo.
- Si añades un libro, guarda una copia en su carpeta de datos; el original sigue donde estaba.
- Si eliminas un libro de la biblioteca, borra su copia, nunca tu archivo.
- También puedes abrir un archivo sin añadirlo a la biblioteca.

---

**¿Necesitas ayuda?** Visita [https://github.com/IsHyperactive/cinta](https://github.com/IsHyperactive/cinta) o abre la **Guía de Cinta** dentro de la aplicación.

