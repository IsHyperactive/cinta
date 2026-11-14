// Tiempo de lectura por día y por libro, meta diaria y racha.
// Desde 0.6.0 el registro vive en la base de datos (tabla reading_log), así entra en la copia de seguridad.
// Se mantiene una copia en memoria para que Inicio pueda calcular de forma síncrona.
import { invoke } from "@tauri-apps/api/core";

const K_DIAS = "cinta.lectura.dias"; // formato anterior (0.5.2–0.5.4): se migra una sola vez a la base de datos
const K_MIGRADO = "cinta.lectura.migrado";
const K_META = "cinta.lectura.meta";
export const METAS_MIN = [5, 10, 15, 20, 30, 45, 60, 90];

type Fila = { day: string; bookId: number; seconds: number };
let porDia: Record<string, number> = {};
let porLibro: Record<number, { seg: number; dias: Set<string> }> = {};

function acumular(f: Fila) {
  porDia[f.day] = (porDia[f.day] ?? 0) + f.seconds;
  if (f.bookId > 0) {
    const l = (porLibro[f.bookId] ??= { seg: 0, dias: new Set() });
    l.seg += f.seconds;
    l.dias.add(f.day);
  }
}

export const claveDia = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function metaMinutos(): number {
  try {
    const n = Number(localStorage.getItem(K_META));
    if (METAS_MIN.includes(n)) return n;
  } catch {}
  return 15;
}

export function guardarMeta(min: number) {
  try {
    localStorage.setItem(K_META, String(min));
  } catch {}
}

/** Lee el registro de la base de datos (y migra el formato anterior de localStorage, una sola vez). */
export async function cargarRegistro(): Promise<void> {
  try {
    try {
      if (!localStorage.getItem(K_MIGRADO)) {
        const viejo = JSON.parse(localStorage.getItem(K_DIAS) || "{}") as Record<string, number>;
        for (const [day, seg] of Object.entries(viejo)) {
          if (typeof seg === "number" && seg > 0) await invoke("log_reading", { bookId: 0, day, seconds: Math.round(seg) });
        }
        localStorage.setItem(K_MIGRADO, "1");
      }
    } catch {}
    const filas = await invoke<Fila[]>("reading_log_all");
    porDia = {};
    porLibro = {};
    for (const f of filas) acumular(f);
  } catch {}
}

/** Suma segundos de lectura de un libro al día de hoy. */
export function registrarSegundos(seg: number, bookId: number) {
  const f: Fila = { day: claveDia(), bookId, seconds: Math.round(seg) };
  acumular(f);
  invoke("log_reading", { bookId: f.bookId, day: f.day, seconds: f.seconds }).catch(() => {});
}

/** Estadísticas de un libro: tiempo total y días en que se leyó. */
export function estadisticasLibro(id: number): { seg: number; dias: number } {
  const l = porLibro[id];
  return { seg: l?.seg ?? 0, dias: l?.dias.size ?? 0 };
}

export type EstadoLectura = {
  hoySeg: number;
  metaSeg: number;
  racha: number;
  /** últimos 7 días, el más antiguo primero */
  semana: { clave: string; letra: string; seg: number }[];
};

export function estadoLectura(): EstadoLectura {
  const dias = porDia;
  const metaSeg = metaMinutos() * 60;
  const dia = (atras: number) => new Date(Date.now() - atras * 86400000);
  const hoySeg = dias[claveDia()] ?? 0;
  // Racha: días seguidos que cumplieron la meta; si hoy aún no se cumple, se cuenta desde ayer.
  let racha = 0;
  for (let i = hoySeg >= metaSeg ? 0 : 1; i < 400; i++) {
    if ((dias[claveDia(dia(i))] ?? 0) >= metaSeg) racha++;
    else break;
  }
  const semana = [6, 5, 4, 3, 2, 1, 0].map((i) => {
    const d = dia(i);
    return { clave: claveDia(d), letra: d.toLocaleDateString("es", { weekday: "narrow" }), seg: dias[claveDia(d)] ?? 0 };
  });
  return { hoySeg, metaSeg, racha, semana };
}
