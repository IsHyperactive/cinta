// Temas de color y fondo personalizado (0.6.1).
// - El tema se guarda en localStorage («cinta.tema») y se aplica con el atributo data-tema de <html>.
//   «Automático» NO pone atributo: así la app se ve exactamente igual que en la 0.6.0.
// - El script de index.html aplica el tema (y la última paleta del fondo) antes del primer render para que no parpadee;
//   `iniciarTema()` lo repite y, si el tema es «fondo», carga la imagen.
// - El fondo: la imagen se guarda reducida en «Fondos» (Rust), se decodifica UNA vez en un único <img> fijo detrás de la app
//   y de ese mismo elemento se saca la miniatura de 48×48 para calcular los colores (utilidades/fondo.ts).
import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { analizar, atenuacionEfectiva, calcularPaleta, type Analisis, type Paleta } from "./fondo";

export type TemaId = "auto" | "claro" | "oscuro" | "sepia" | "medianoche" | "fondo";

type Muestra = { bg: string; panel: string; lateral: string; text: string; muted: string; accent: string };
/** Colores para las miniaturas de la hoja «Apariencia». Deben coincidir con estilos/temas.css (el contraste se verifica allí). */
export const TEMAS: { id: Exclude<TemaId, "fondo">; nombre: string; muestra: Muestra | [Muestra, Muestra] }[] = [
  {
    id: "auto", nombre: "Automático",
    // 0.6.0 en escritorio: claro y oscuro del sistema (mitad y mitad)
    muestra: [
      { bg: "#f7f7f5", panel: "#ffffff", lateral: "#f0f0ee", text: "#202124", muted: "#777b83", accent: "#3269a8" },
      { bg: "#171819", panel: "#202223", lateral: "#1d1f20", text: "#f2f1ee", muted: "#a1a3a5", accent: "#83b6f0" },
    ],
  },
  { id: "claro", nombre: "Claro", muestra: { bg: "#ffffff", panel: "#ffffff", lateral: "#f5f5f7", text: "#1d1d1f", muted: "#6e6e73", accent: "#0071e3" } },
  { id: "oscuro", nombre: "Oscuro", muestra: { bg: "#1c1c1e", panel: "#2c2c2e", lateral: "#242426", text: "#f5f5f7", muted: "#98989d", accent: "#83b6f0" } },
  { id: "sepia", nombre: "Sepia guinda", muestra: { bg: "#f1e7d0", panel: "#f8f0de", lateral: "#e8dcc0", text: "#3b2f1e", muted: "#655a41", accent: "#8c2f3e" } },
  { id: "medianoche", nombre: "Medianoche", muestra: { bg: "#121316", panel: "#1d1f24", lateral: "#17181b", text: "#d8dbe2", muted: "#8a90a0", accent: "#6aa3ea" } },
];

const VALIDOS: TemaId[] = ["auto", "claro", "oscuro", "sepia", "medianoche", "fondo"];
const K_TEMA = "cinta.tema";
const K_ANTERIOR = "cinta.tema.anterior";
const K_AJUSTES = "cinta.fondo"; // { atenuacion: number | null (0–1), desenfoque: number (px) }
const K_PALETA = "cinta.fondo.paleta"; // caché para que el script de index.html pinte el fondo sin esperar a la imagen
export const MINIATURA = 48;
const LADO_MAX = 1920;
const DESENFOQUE_DEF = 14;

const leer = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento: no pasa nada */ }
};
const esTema = (v: unknown): v is TemaId => typeof v === "string" && (VALIDOS as string[]).includes(v);

export type EstadoTema = {
  tema: TemaId;
  /** Último tema que no era «fondo»: a él se vuelve si la imagen falta, está corrupta o se quita. */
  anterior: Exclude<TemaId, "fondo">;
  /** Hay una imagen de fondo cargada y analizada. */
  hayFondo: boolean;
  fondoUrl: string | null;
  cargando: boolean;
  /** Mensaje para mostrar en la hoja «Apariencia» (errores y avisos); vacío si no hay. */
  aviso: string;
  /** Atenuación pedida por el usuario (0–1) o null = la sugerida. */
  atenuacionElegida: number | null;
  desenfoque: number;
  paleta: Paleta | null;
};

function ajustesGuardados(): { atenuacion: number | null; desenfoque: number } {
  try {
    const j = JSON.parse(leer(K_AJUSTES) ?? "null");
    const a = typeof j?.atenuacion === "number" ? Math.min(1, Math.max(0, j.atenuacion)) : null;
    const d = typeof j?.desenfoque === "number" ? Math.min(24, Math.max(0, j.desenfoque)) : DESENFOQUE_DEF;
    return { atenuacion: a, desenfoque: d };
  } catch {
    return { atenuacion: null, desenfoque: DESENFOQUE_DEF };
  }
}

const temaInicial = (): TemaId => { const t = leer(K_TEMA); return esTema(t) ? t : "auto"; };
const anteriorInicial = (): Exclude<TemaId, "fondo"> => {
  const t = leer(K_ANTERIOR);
  return esTema(t) && t !== "fondo" ? t : "auto";
};

let estado: EstadoTema = {
  tema: temaInicial(),
  anterior: anteriorInicial(),
  hayFondo: false,
  fondoUrl: null,
  cargando: false,
  aviso: "",
  atenuacionElegida: ajustesGuardados().atenuacion,
  desenfoque: ajustesGuardados().desenfoque,
  paleta: null,
};
const oyentes = new Set<() => void>();
function poner(parcial: Partial<EstadoTema>) {
  estado = { ...estado, ...parcial };
  oyentes.forEach((f) => f());
}
export function useTema(): EstadoTema {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f); }; }, () => estado);
}

// ---------------------------------------------------------------- DOM

let imagen: HTMLImageElement | null = null;
let analisis: Analisis | null = null;
let capa: HTMLDivElement | null = null;
/** Todas las variables que puede poner el fondo; se quitan siempre juntas, también las que puso el script de index.html. */
const VARS_FONDO = [
  "--bg", "--panel", "--text", "--muted", "--accent", "--accent-text", "--border", "--desktop-sidebar", "--desktop-card",
  "--desktop-shadow", "--fondo-panel", "--fondo-velo", "--fondo-velo-a", "--fondo-blur",
];

function asegurarCapa(): HTMLDivElement {
  if (capa && capa.isConnected) return capa;
  capa = document.createElement("div");
  capa.className = "fondo-capa";
  capa.setAttribute("aria-hidden", "true");
  const velo = document.createElement("div");
  velo.className = "fondo-velo";
  capa.appendChild(velo);
  document.body.appendChild(capa);
  return capa;
}

function limpiarVariables() {
  const el = document.documentElement;
  for (const k of VARS_FONDO) el.style.removeProperty(k);
  el.removeAttribute("data-fondo-modo");
}

/** Pone en <html> el atributo y las variables que corresponden al estado actual. */
function aplicarAlDocumento() {
  // «fondo» todavía sin colores: se deja lo que haya puesto el script de index.html (o nada) hasta tener la paleta
  if (estado.tema === "fondo" && !estado.paleta) return;
  const el = document.documentElement;
  limpiarVariables();
  if (estado.tema === "auto") el.removeAttribute("data-tema");
  else el.setAttribute("data-tema", estado.tema);
  if (estado.tema === "fondo" && estado.paleta) {
    for (const [k, v] of Object.entries(estado.paleta.vars)) el.style.setProperty(k, v);
    el.setAttribute("data-fondo-modo", estado.paleta.modo);
    const c = asegurarCapa();
    if (imagen && imagen.parentElement !== c) c.insertBefore(imagen, c.firstChild);
    c.classList.add("lista");
  } else if (capa) {
    capa.classList.remove("lista");
  }
}

function paletaGuardada(p: Paleta) {
  escribir(K_PALETA, JSON.stringify({ vars: p.vars, modo: p.modo }));
}

function recalcular() {
  if (!analisis) return;
  const p = calcularPaleta(analisis, estado.atenuacionElegida, estado.desenfoque);
  poner({ paleta: p });
  paletaGuardada(p);
}

// ---------------------------------------------------------------- imagen

function tipoPorContenido(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49) return "image/webp";
  return "";
}

function liberarImagen() {
  if (imagen) {
    if (imagen.src.startsWith("blob:")) URL.revokeObjectURL(imagen.src);
    imagen.remove();
  }
  imagen = null;
  analisis = null;
}

/** Decodifica la imagen guardada (UNA vez) y calcula su análisis. Devuelve false si falta o está corrupta. */
async function cargarFondoGuardado(): Promise<boolean> {
  let buf: ArrayBuffer;
  try {
    buf = await invoke<ArrayBuffer>("get_background");
  } catch {
    return false;
  }
  if (!buf || buf.byteLength < 16) return false;
  const tipo = tipoPorContenido(new Uint8Array(buf, 0, 4));
  if (!tipo) return false;
  const url = URL.createObjectURL(new Blob([buf], { type: tipo }));
  const img = new Image();
  img.decoding = "async";
  img.alt = "";
  img.src = url;
  try {
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("vacía");
    const cv = document.createElement("canvas");
    cv.width = cv.height = MINIATURA;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    if (!cx) throw new Error("sin canvas");
    cx.drawImage(img, 0, 0, MINIATURA, MINIATURA);
    const datos = cx.getImageData(0, 0, MINIATURA, MINIATURA).data;
    const an = analizar(datos, MINIATURA, MINIATURA);
    liberarImagen();
    imagen = img;
    analisis = an;
    return true;
  } catch {
    URL.revokeObjectURL(url);
    return false;
  }
}

/** Reduce a ≤ 1920 px y JPEG 0,85 la imagen recién elegida (guardada como «pendiente» por Rust) y la confirma. */
async function reducirYGuardar(): Promise<void> {
  const buf = await invoke<ArrayBuffer>("get_background", { pendiente: true });
  if (!buf || buf.byteLength < 16) throw new Error("No se pudo leer la imagen");
  const bmp = await createImageBitmap(new Blob([buf])); // falla si la imagen está corrupta
  try {
    const k = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d");
    if (!cx) throw new Error("No se pudo preparar la imagen");
    cx.fillStyle = "#808080"; // las transparencias del PNG/WebP se componen sobre gris medio
    cx.fillRect(0, 0, w, h);
    cx.imageSmoothingQuality = "high";
    cx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/jpeg", 0.85));
    cv.width = cv.height = 0;
    if (!blob) throw new Error("No se pudo reducir la imagen");
    await invoke("save_background", new Uint8Array(await blob.arrayBuffer()));
  } finally {
    bmp.close();
  }
}

// ---------------------------------------------------------------- acciones

function volverAlAnterior(aviso: string) {
  const t = estado.anterior;
  escribir(K_TEMA, t);
  escribir(K_PALETA, null);
  liberarImagen();
  poner({ tema: t, hayFondo: false, fondoUrl: null, paleta: null, cargando: false, aviso });
  aplicarAlDocumento();
}

/** Arranque: aplica el tema guardado antes de pintar y, si es «fondo», carga la imagen. Si falla, vuelve al tema anterior sin error. */
export function iniciarTema() {
  aplicarAlDocumento();
  if (estado.tema !== "fondo") return;
  poner({ cargando: true });
  void cargarFondoGuardado().then((ok) => {
    if (!ok) { volverAlAnterior(""); return; }
    poner({ hayFondo: true, fondoUrl: imagen?.src ?? null, cargando: false });
    recalcular();
    aplicarAlDocumento();
  });
}

export async function elegirTema(id: TemaId): Promise<void> {
  if (id === "fondo") {
    // sin imagen cargada, «Fondo personalizado» abre el selector
    if (!estado.hayFondo) {
      if (!(await cargarFondoGuardado())) return void (await elegirImagen());
      poner({ hayFondo: true, fondoUrl: imagen?.src ?? null });
      recalcular();
    }
    escribir(K_TEMA, "fondo");
    poner({ tema: "fondo", aviso: "" });
    aplicarAlDocumento();
    return;
  }
  const anterior = id;
  escribir(K_TEMA, id);
  escribir(K_ANTERIOR, anterior);
  poner({ tema: id, anterior, aviso: "" });
  aplicarAlDocumento();
}

/** Abre el diálogo de archivos, reduce la imagen, la guarda y activa «Fondo personalizado». */
export async function elegirImagen(): Promise<void> {
  const f = await open({ multiple: false, filters: [{ name: "Imágenes", extensions: ["jpg", "jpeg", "png", "webp"] }] });
  if (typeof f !== "string") return;
  poner({ cargando: true, aviso: "" });
  try {
    await invoke("set_background", { path: f });
    await reducirYGuardar();
    if (!(await cargarFondoGuardado())) throw new Error("La imagen no se puede mostrar");
  } catch (e) {
    // La imagen nueva no sirve: se descarta y se conserva lo que había (el fondo anterior o el tema anterior).
    try { await invoke("clear_background", { soloPendiente: true }); } catch { /* ya no existe */ }
    const conserva = estado.hayFondo && !!imagen;
    poner({ cargando: false, aviso: conserva ? "No se pudo usar esa imagen; se conserva el fondo anterior." : "No se pudo usar esa imagen (¿está dañada?). Prueba con otra en jpg, png o webp." });
    return;
  }
  const t = estado.tema === "fondo" ? estado.anterior : (estado.tema as Exclude<TemaId, "fondo">);
  escribir(K_ANTERIOR, t);
  escribir(K_TEMA, "fondo");
  poner({ tema: "fondo", anterior: t, hayFondo: true, fondoUrl: imagen?.src ?? null, cargando: false, aviso: "" });
  recalcular();
  aplicarAlDocumento();
}

export async function quitarFondo(): Promise<void> {
  try { await invoke("clear_background"); } catch { /* nada que borrar */ }
  escribir(K_PALETA, null);
  if (estado.tema === "fondo") volverAlAnterior("");
  else { liberarImagen(); poner({ hayFondo: false, fondoUrl: null, paleta: null, aviso: "" }); }
}

/**
 * Ajusta atenuación (0–1) y desenfoque (px) con los deslizadores.
 * Devuelve `true` si se pidió una atenuación menor que el mínimo que garantiza el contraste (y se dejó el mínimo).
 */
export function ajustarFondo(cambio: { atenuacion?: number; desenfoque?: number }): boolean {
  let limitado = false;
  let elegida = estado.atenuacionElegida;
  if (cambio.atenuacion !== undefined && analisis) {
    const p = calcularPaleta(analisis, null, estado.desenfoque);
    elegida = atenuacionEfectiva(p.minAtenuacion, p.atenuacionDefecto, cambio.atenuacion);
    limitado = cambio.atenuacion < p.minAtenuacion - 1e-9;
  }
  const desenfoque = cambio.desenfoque !== undefined ? Math.min(24, Math.max(0, cambio.desenfoque)) : estado.desenfoque;
  escribir(K_AJUSTES, JSON.stringify({ atenuacion: elegida, desenfoque }));
  poner({
    atenuacionElegida: elegida,
    desenfoque,
    aviso: limitado && analisis ? "Más bajo no se podría leer el texto sobre esta imagen: se mantiene la atenuación mínima." : "",
  });
  recalcular();
  if (estado.tema === "fondo") aplicarAlDocumento();
  return limitado;
}
