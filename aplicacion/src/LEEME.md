# src/ — Interfaz
- `main.tsx`, `App.tsx`: arranque y biblioteca.
- `vistas/`: pantallas completas de la biblioteca (Notas).
- `lectores/`: un lector por formato. `componentes/`: piezas reutilizables. `utilidades/`: lógica sin pantalla. `estilos/`: CSS (`temas.css` va siempre al final: paletas de color y fondo personalizado).
- `utilidades/fondo.ts`: análisis de la imagen y colores adaptativos (lógica pura, probada con `herramientas/verificacion/probar-fondo.mjs`). `utilidades/temas.ts`: tema, almacenamiento y carga del fondo.
