// Gesto de rueda / touchpad para pasar de página.
//
// Un deslizamiento con dos dedos en el touchpad llega como una ráfaga de eventos «wheel» (con inercia al final).
// Se cuenta UN solo giro por ráfaga: se acumula el desplazamiento hasta superar el umbral, se pasa de página
// y se ignora el resto de la ráfaga (incluida la inercia). Una ráfaga nueva empieza tras 160 ms de silencio.
// Con una rueda de ratón cada «clic» de la rueda es una ráfaga y pasa una página.

export type OpcionesGesto = {
  /** Si devuelve false el gesto se ignora (p. ej. desplazamiento continuo o desactivado en ajustes). */
  activo?: () => boolean;
  /** Si devuelve true, el deslizamiento vertical también pasa de página (lectores paginados). */
  vertical?: () => boolean;
};

const UMBRAL = 60; // píxeles acumulados para disparar el giro
const SILENCIO = 160; // ms sin eventos = ráfaga nueva

export function crearGestoRueda(giro: (dir: 1 | -1) => void, opciones: OpcionesGesto = {}) {
  let acc = 0;
  let ultimo = 0;
  let disparado = false;
  return (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return; // pellizco (zoom) o atajo del sistema
    if (opciones.activo && !opciones.activo()) return;
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!horizontal && !opciones.vertical?.()) return;
    e.preventDefault(); // evita el «Atrás» del navegador y el rebote al deslizar de lado
    if (e.timeStamp - ultimo > SILENCIO) {
      acc = 0;
      disparado = false;
    }
    ultimo = e.timeStamp;
    if (disparado) return;
    acc += (horizontal ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 16 : 1);
    if (Math.abs(acc) >= UMBRAL) {
      disparado = true;
      giro(acc > 0 ? 1 : -1);
    }
  };
}
