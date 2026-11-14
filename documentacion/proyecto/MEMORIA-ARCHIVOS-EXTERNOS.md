# Archivos abiertos sin agregar a la biblioteca: deben recordarlo todo

«Abrir archivo» (y «Abrir con», y arrastrar y soltar) lee el libro desde su ubicación sin copiarlo a la biblioteca.
Aun así, al cerrarlo y volver a abrirlo debe comportarse **como un libro de la biblioteca**:

- Posición de lectura y porcentaje (tabla `ext_progress`, clave = ruta normalizada).
- Marcadores, resaltados, notas y trazos de lápiz (tabla `annotations`, clave `p:<ruta normalizada>`).
- Se aplica a todos los lectores: EPUB, PDF, documentos de texto, cómics y audiolibros.

## Reglas
1. La ruta se normaliza siempre con `norm_ext_path` (`src-tauri/src/lib.rs`): sin `\\?\`, con `/` y, en Windows, en minúsculas.
   Nunca uses la ruta cruda como clave: «Abrir archivo», «Abrir con» y arrastrar dan texto distinto para el mismo archivo.
2. Los datos guardados con la ruta sin normalizar (versiones anteriores) se siguen leyendo.
3. Si luego el usuario agrega ese libro a la biblioteca, su posición y todas sus anotaciones pasan a `b:<id>` (ver `add_books`).
4. Quitar un libro de la biblioteca borra sus anotaciones `b:<id>`; las de archivos externos no se borran solas.

## Pendiente (no hecho)
Mostrar las anotaciones de archivos externos en la vista «Notas» y listar esos archivos en «Leyendo» / inicio.
