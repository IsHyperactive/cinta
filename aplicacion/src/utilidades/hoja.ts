// Animación de página «Hoja de libro» (lector EPUB).
//
// Cómo funciona (aproximación al pase de hoja de Apple Books, sin la curvatura de la hoja):
//  · Apple Books pasa la hoja con una malla que se deforma alrededor de un cilindro, con luz y sombra en vivo. Aquí no
//    hay malla: la hoja es plana y gira sobre el lomo con perspectiva (CSS 3D), con tres cosas que dan sensación de papel:
//    la hoja se oscurece al girar, proyecta una sombra sobre la página que queda debajo y la página de debajo se asienta
//    con un movimiento leve.
//  · Para que la hoja lleve el TEXTO de la página (y no una hoja en blanco) se guardan, ya cargadas, dos copias del capítulo
//    visible (A y B). Son copias del documento del capítulo, no de una página: pasar de página dentro del capítulo no obliga
//    a rehacerlas; solo se desplazan a la posición correcta. Se rehacen al cambiar de capítulo, de ajustes o de tamaño.
//  · Adelante: la hoja es la copia A (página que se deja) y gira de 0° a 90° (de canto); debajo está la página nueva real.
//  · Atrás: debajo queda la copia A (página que se deja) y la copia B, desplazada a la página anterior, vuelve girando de
//    90° a 0° y se posa encima. Si la página anterior está en otro capítulo no hay copia de ella: la página que se deja
//    se desvanece y deja ver la nueva.
//  · Si las copias aún no están listas (p. ej. justo al abrir el libro), `pasar` devuelve false y el lector usa otra
//    animación para ese giro; así nunca se ve una hoja en blanco.
//  · La página real (epub.js) NO se gira nunca durante el giro de hoja, solo se escala un 2,5 %: epub.js calcula la
//    ubicación y el progreso midiendo el contenedor, y un contenedor girado en 3D falsearía esas medidas.
//  · La animación se mueve con requestAnimationFrame y solo toca transform y opacity (capas de GPU).

export type OpcionesHoja = {
  /** Escenario donde epub.js dibuja el libro. */
  host: HTMLElement;
  /** Cadena que cambia cuando cambia el aspecto del capítulo (tema, tamaño, fuente, interlineado, márgenes, tamaño de ventana). */
  firma: () => string;
  /** Devuelve false cuando la animación no está elegida o el libro está en desplazamiento continuo. */
  activo: () => boolean;
};

type Entrada = { orig: HTMLIFrameElement; a: HTMLIFrameElement; b: HTMLIFrameElement };
type Copia = { firma: string; entradas: Entrada[]; lista: boolean };
type Capa = { raiz: HTMLDivElement; cont: HTMLDivElement; brillo: HTMLDivElement; oscuro: HTMLDivElement; lomo: HTMLDivElement };

const DUR_ADELANTE = 540; // ms
const DUR_ATRAS = 480; // ms
const DUR_FUNDIDO = 240; // ms
const ESCALA_ASIENTO = 0.025; // la página de debajo pasa de 97,5 % a 100 %
const MAX_HTML = 4_000_000; // capítulos más pesados que esto no se copian (se usa otra animación)

const suave = (t: number) => t * t * (3 - 2 * t); // arranca y frena con suavidad
const aterriza = (t: number) => 1 - Math.pow(1 - t, 3); // llega rápido y se posa despacio
const aGrados = (r: number) => (r * 180) / Math.PI;

export function crearHoja(op: OpcionesHoja) {
  const { host } = op;
  const lector = host.parentElement as HTMLElement;
  const mk = (cls: string) => {
    const d = document.createElement("div");
    d.className = cls;
    return d;
  };
  const armar = (): Capa => {
    const raiz = mk("hoja-hoja");
    const cont = mk("hoja-cont");
    const brillo = mk("hoja-brillo");
    const oscuro = mk("hoja-oscuro");
    const lomo = mk("hoja-lomo");
    raiz.append(cont, brillo, oscuro, lomo);
    return { raiz, cont, brillo, oscuro, lomo };
  };

  const capa = mk("hoja-capa");
  const sombraCaja = mk("hoja-sombra-caja");
  const sombra = mk("hoja-sombra");
  sombraCaja.append(sombra);
  const A = armar();
  const B = armar();
  capa.append(sombraCaja, A.raiz, B.raiz);
  capa.setAttribute("aria-hidden", "true");
  lector.appendChild(capa);

  let copia: Copia | null = null;
  let temporizador = 0;
  let inactivo = 0;
  let activa: { raf: number } | null = null;
  let ficha = 0;
  let muerto = false;
  const ids = new WeakMap<Element, number>();
  let siguienteId = 1;
  const idDe = (e: Element) => {
    let n = ids.get(e);
    if (!n) ids.set(e, (n = siguienteId++));
    return n;
  };

  /** Iframes de libro (capítulos) que se ven ahora en el escenario. */
  const visibles = (): HTMLIFrameElement[] => {
    const base = host.getBoundingClientRect();
    return Array.from(host.querySelectorAll("iframe")).filter((f) => {
      const r = f.getBoundingClientRect();
      return r.right > base.left + 1 && r.left < base.right - 1 && r.bottom > base.top + 1 && r.top < base.bottom - 1;
    });
  };
  const mismos = (a: Element[], b: Element[]) => a.length === b.length && a.every((e, i) => e === b[i]);
  /** Qué capítulos se ven y en qué posición: cambia cuando cambia la página mostrada. */
  const clavePosicion = () =>
    visibles()
      .map((f) => `${idDe(f)}:${Math.round(f.getBoundingClientRect().left)}:${Math.round(f.getBoundingClientRect().top)}`)
      .join("|");

  const vaciar = () => {
    A.cont.replaceChildren();
    B.cont.replaceChildren();
    copia = null;
  };

  const serializar = (f: HTMLIFrameElement): string | null => {
    try {
      const d = f.contentDocument;
      if (!d?.documentElement) return null;
      const html = d.documentElement.outerHTML;
      if (html.length > MAX_HTML) return null;
      const tipo = d.doctype ? new XMLSerializer().serializeToString(d.doctype) : "<!DOCTYPE html>";
      return tipo + html.replace(/<script[\s\S]*?<\/script>/gi, "");
    } catch {
      return null;
    }
  };

  const construir = (vis: HTMLIFrameElement[], firma: string) => {
    if (!vis.length) return;
    const entradas: Entrada[] = [];
    let pendientes = 0;
    const nueva: Copia = { firma, entradas, lista: false };
    for (const orig of vis) {
      const html = serializar(orig);
      if (html === null) {
        vaciar();
        return;
      }
      const crear = () => {
        const f = document.createElement("iframe");
        f.setAttribute("sandbox", "allow-same-origin"); // sin scripts
        f.setAttribute("scrolling", "no");
        f.tabIndex = -1;
        pendientes++;
        f.addEventListener("load", () => {
          if (--pendientes === 0 && copia === nueva) nueva.lista = true;
        });
        f.srcdoc = html;
        return f;
      };
      entradas.push({ orig, a: crear(), b: crear() });
    }
    copia = nueva;
    for (const e of entradas) {
      A.cont.appendChild(e.a);
      B.cont.appendChild(e.b);
    }
  };

  const reconciliar = () => {
    inactivo = 0;
    if (muerto) return;
    if (!op.activo()) {
      vaciar();
      return;
    }
    if (activa) return void sincronizar(300); // en pleno giro: se reintenta
    const vis = visibles();
    const firma = op.firma();
    if (copia && copia.firma === firma && mismos(vis, copia.entradas.map((e) => e.orig))) return;
    vaciar();
    construir(vis, firma);
  };

  /** Pide (con retraso) que las copias del capítulo estén al día. Se llama tras cambiar de página, de ajustes o de tamaño. */
  const sincronizar = (demora = 220) => {
    window.clearTimeout(temporizador);
    if (inactivo && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(inactivo);
    temporizador = window.setTimeout(() => {
      const ric = (window as any).requestIdleCallback as undefined | ((f: () => void, o: { timeout: number }) => number);
      if (ric) inactivo = ric(reconciliar, { timeout: 800 });
      else reconciliar();
    }, demora);
  };

  /** Coloca las copias de una capa sobre la posición actual de sus capítulos reales. */
  const colocar = (c: Capa, cual: "a" | "b") => {
    if (!copia) return;
    const base = host.getBoundingClientRect();
    for (const e of copia.entradas) {
      const f = e[cual];
      if (!e.orig.isConnected) {
        f.style.visibility = "hidden";
        continue;
      }
      const r = e.orig.getBoundingClientRect();
      f.style.visibility = "";
      f.style.left = `${r.left - base.left}px`;
      f.style.top = `${r.top - base.top}px`;
      f.style.width = `${r.width}px`;
      f.style.height = `${r.height}px`;
    }
    void c;
  };

  const reponer = (c: Capa) => {
    c.raiz.style.cssText = "";
    c.brillo.style.opacity = "0";
    c.oscuro.style.opacity = "0";
  };
  const limpiarVisual = () => {
    capa.classList.remove("on");
    reponer(A);
    reponer(B);
    sombra.style.opacity = "0";
    host.style.transform = "";
    host.style.transformOrigin = "";
    host.style.transition = "";
  };
  const terminar = () => {
    if (!activa) return;
    cancelAnimationFrame(activa.raf);
    activa = null;
    ficha++;
    limpiarVisual();
  };

  const correr = (dur: number, pintar: (p: number) => void) =>
    new Promise<void>((fin) => {
      const marca = { raf: 0 };
      activa = marca;
      let t0 = -1;
      const paso = (ahora: number) => {
        if (activa !== marca) return fin();
        if (t0 < 0) t0 = ahora;
        const p = Math.min(1, (ahora - t0) / dur);
        pintar(p);
        if (p < 1) marca.raf = requestAnimationFrame(paso);
        else fin();
      };
      marca.raf = requestAnimationFrame(paso);
    });

  /**
   * Pasa de página con el efecto de hoja. `cambiar` es quien pasa realmente la página (epub.js).
   * Devuelve false (sin haber cambiado nada) si no se puede hacer el efecto; el lector debe entonces pasar de página
   * con otra animación.
   */
  const pasar = async (dir: 1 | -1, cambiar: () => Promise<void>): Promise<boolean> => {
    if (muerto) return false;
    terminar();
    const vis0 = visibles();
    const buena = !!copia && copia.lista && copia.firma === op.firma() && mismos(vis0, copia.entradas.map((e) => e.orig));
    if (!buena) {
      sincronizar(60);
      return false;
    }
    const mia = ++ficha;
    const W = host.clientWidth;
    const H = host.clientHeight;
    const P = Math.max(2200, W * 4.5); // distancia de la perspectiva: grande = giro suave, pequeño = exagerado
    const papel = getComputedStyle(lector).backgroundColor || "#fff";
    Object.assign(capa.style, { left: `${host.offsetLeft}px`, top: `${host.offsetTop}px`, width: `${W}px`, height: `${H}px` });
    A.raiz.style.background = papel;
    B.raiz.style.background = papel;
    colocar(A, "a");
    const clave0 = clavePosicion();

    // Estado inicial: la copia A tapa la página real (idéntica, no se nota) mientras epub.js cambia de página debajo
    A.raiz.style.zIndex = dir > 0 ? "2" : "1";
    sombraCaja.style.zIndex = "2";
    B.raiz.style.zIndex = "3";
    A.raiz.style.transformOrigin = dir > 0 ? "0 50%" : "50% 50%";
    B.raiz.style.visibility = "hidden";
    capa.classList.add("on");
    activa = { raf: 0 };

    await cambiar();
    if (ficha !== mia) return true; // otro giro tomó el relevo
    if (clavePosicion() === clave0) {
      terminar(); // no había más páginas
      return true;
    }

    const sombrear = (u: number, xe: number, rad: number, hoja: Capa) => {
      hoja.oscuro.style.opacity = String(0.42 * Math.pow(Math.sin(rad), 1.2));
      hoja.brillo.style.opacity = String(Math.min(1, Math.sin(rad) * 1.3));
      sombra.style.width = `${W * (0.2 + 0.14 * u)}px`;
      sombra.style.transform = `translateX(${xe}px)`;
      sombra.style.opacity = String(0.55 * Math.pow(Math.sin(Math.PI * u), 0.8));
    };
    const giro = (hoja: Capa, u: number) => {
      const rad = (Math.PI / 2) * u;
      const xe = (W * Math.cos(rad)) / (1 - (W / P) * Math.sin(rad)); // borde derecho proyectado
      hoja.raiz.style.transform = `perspective(${P}px) rotateY(${-aGrados(rad)}deg)`;
      sombrear(u, xe, rad, hoja);
    };

    activa = null;
    if (dir > 0) {
      host.style.transformOrigin = "50% 50%";
      await correr(DUR_ADELANTE, (p) => {
        giro(A, suave(p));
        host.style.transform = `scale(${1 - ESCALA_ASIENTO * (1 - aterriza(p))})`;
      });
    } else {
      const vis1 = visibles();
      const hayB = !!copia && mismos(vis1, copia.entradas.map((e) => e.orig));
      if (hayB) {
        colocar(B, "b");
        B.raiz.style.visibility = "visible";
        giro(B, 1);
        await correr(DUR_ATRAS, (p) => {
          const e = aterriza(p);
          giro(B, 1 - e);
          A.raiz.style.transform = `scale(${1 - ESCALA_ASIENTO * e})`;
        });
      } else {
        // La página anterior está en otro capítulo y no hay copia de ella: la que se deja se desvanece
        await correr(DUR_FUNDIDO, (p) => {
          A.raiz.style.opacity = String(1 - suave(p));
        });
      }
    }
    if (ficha === mia) {
      limpiarVisual();
      activa = null;
      sincronizar(200);
    }
    return true;
  };

  const alRedimensionar = () => sincronizar(300);
  window.addEventListener("resize", alRedimensionar);

  return {
    pasar,
    sincronizar,
    /** Libera las copias del capítulo (cuando la animación deja de estar elegida). */
    liberar: () => {
      terminar();
      vaciar();
    },
    destruir: () => {
      muerto = true;
      window.clearTimeout(temporizador);
      window.removeEventListener("resize", alRedimensionar);
      terminar();
      vaciar();
      capa.remove();
    },
  };
}

export type Hoja = ReturnType<typeof crearHoja>;
