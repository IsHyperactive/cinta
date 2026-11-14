import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjs } from "../utilidades/pdf";
import NoteDialog from "../componentes/NoteDialog";
import InkLayer, { type InkStroke } from "../componentes/InkLayer";
import { HL_COLORS, INK_COLORS, reduceMotion, type Ann } from "../utilidades/annot";
import Icon from "../componentes/AppleIcon";
import { crearGestoRueda } from "../utilidades/gestos";

type PdfBook = { id: number; title: string; path?: string; progressCfi: string | null };
type Hit = { page: number; snippet: string };
type OutlineItem = { title: string; dest: any; depth: number };
type Tab = "toc" | "pages" | "marks" | "notes";
type Mark = { id: number; color: string; rects: number[][] };
type Sel = { mode: "new"; page: number; rects: number[][]; text: string } | { mode: "edit"; id: number };
const NO_MARKS: Mark[] = [];
const NO_INK: InkStroke[] = [];
type Panel = null | "toc" | "search" | "look";
type ThemeId = "claro" | "sepia" | "gris" | "oscuro";
type Box = { x: number; y: number; w: number; h: number };

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const FOLD: Record<string, string> = {
  á: "a", à: "a", ä: "a", â: "a", é: "e", è: "e", ë: "e", ê: "e",
  í: "i", ì: "i", ï: "i", î: "i", ó: "o", ò: "o", ö: "o", ô: "o",
  ú: "u", ù: "u", ü: "u", û: "u",
};
// Misma longitud que el original, para poder usar los índices en el texto real
const fold = (s: string) => s.toLowerCase().replace(/[áàäâéèëêíìïîóòöôúùüû]/g, (c) => FOLD[c]);

// Mismos 4 temas que el lector EPUB. bg/fg = muestra del botón redondo; la página se tiñe con CSS (.t-sepia, etc.)
const THEMES: Record<ThemeId, { bg: string; fg: string; label: string }> = {
  claro: { bg: "#ffffff", fg: "#1b1d22", label: "Claro" },
  sepia: { bg: "#f1e7d0", fg: "#3b2f1e", label: "Sepia" },
  gris: { bg: "#d9dadd", fg: "#25272c", label: "Gris" },
  oscuro: { bg: "#121316", fg: "#d8dbe2", label: "Oscuro" },
};

function loadPrefs(): { theme: ThemeId; zoom: number } {
  try {
    const o = JSON.parse(localStorage.getItem("cinta.pdf") || "{}");
    // Compatibilidad: antes había solo "modo noche" (night: true) → tema Oscuro
    const theme: ThemeId = o.theme in THEMES ? o.theme : o.night ? "oscuro" : "claro";
    return { theme, zoom: typeof o.zoom === "number" ? o.zoom : 1 };
  } catch {
    return { theme: "claro", zoom: 1 };
  }
}

/** Resaltado de PDF: `p<página>|<JSON [[x,y,w,h],…]>` en puntos de PDF (independiente del zoom). */
function parseLoc(loc: string): { page: number; rects: number[][] } | null {
  const m = /^p(\d+)(?:\|(.*))?$/.exec(loc);
  if (!m) return null;
  let rects: number[][] = [];
  try {
    if (m[2]) rects = JSON.parse(m[2]);
  } catch {
    rects = [];
  }
  return { page: Number(m[1]), rects };
}

/** Quita los rectángulos duplicados o contenidos en otro (el navegador devuelve uno por elemento y por texto). */
function dedupeRects(rs: number[][]): number[][] {
  return rs.filter((a, i) =>
    !rs.some((b, j) => j !== i && b[0] <= a[0] + 0.5 && b[1] <= a[1] + 0.5 && b[0] + b[2] >= a[0] + a[2] - 0.5 && b[1] + b[3] >= a[1] + a[3] - 0.5 && (b[2] * b[3] > a[2] * a[3] || (b[2] * b[3] === a[2] * a[3] && j < i)))
  );
}

function flattenOutline(items: any[] | null | undefined, depth = 0): OutlineItem[] {
  return (items || []).flatMap((i) => [
    { title: String(i.title || "").trim(), dest: i.dest, depth },
    ...flattenOutline(i.items, depth + 1),
  ]);
}

// ---------------------------------------------------------------- Página
const PageView = memo(function PageView(props: {
  pdf: PDFDocumentProxy;
  index: number;
  scale: number;
  baseW: number;
  baseH: number;
  query: string;
  marks: Mark[];
  ink: InkStroke[];
  pen: { on: boolean; eraser: boolean; color: string; onStroke: (page: number, w: number, pts: number[][]) => void; onErase: (id: number) => void; panBy: (dx: number, dy: number) => void };
  register: (i: number, el: HTMLDivElement | null) => void;
}) {
  const { pdf, index, scale, baseW, baseH, query, marks, ink, pen, register } = props;
  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [hl, setHl] = useState<Box[]>([]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Dibuja la página (en un lienzo aparte para evitar choques al cambiar el zoom)
  useEffect(() => {
    const c = canvas.current;
    if (!visible) {
      if (c) {
        c.width = 0;
        c.height = 0;
      }
      return;
    }
    let dead = false;
    let task: any;
    (async () => {
      try {
        const page = await pdf.getPage(index + 1);
        if (dead) return;
        const base = page.getViewport({ scale: 1 });
        setDims({ w: base.width, h: base.height });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pixelScale = Math.min(scale * dpr, 4096 / base.width);
        const vp = page.getViewport({ scale: pixelScale });
        const off = document.createElement("canvas");
        off.width = Math.floor(vp.width);
        off.height = Math.floor(vp.height);
        task = page.render({ canvasContext: off.getContext("2d")!, viewport: vp });
        await task.promise;
        if (dead || !c) return;
        c.width = off.width;
        c.height = off.height;
        c.style.width = `${base.width * scale}px`;
        c.style.height = `${base.height * scale}px`;
        c.getContext("2d")!.drawImage(off, 0, 0);
      } catch {
        /* render cancelado */
      }
    })();
    return () => {
      dead = true;
      task?.cancel();
    };
  }, [visible, scale, pdf, index]);

  // Capa de texto (invisible) para poder seleccionar y resaltar
  useEffect(() => {
    const c = textRef.current;
    if (!c) return;
    c.replaceChildren();
    if (!visible) return;
    let dead = false;
    let layer: any;
    (async () => {
      try {
        const page = await pdf.getPage(index + 1);
        if (dead) return;
        c.style.setProperty("--scale-factor", String(scale));
        c.style.setProperty("--total-scale-factor", String(scale));
        const tc = await page.getTextContent();
        if (dead) return;
        layer = new pdfjs.TextLayer({ textContentSource: tc, container: c, viewport: page.getViewport({ scale }) });
        await layer.render();
      } catch {
        /* cancelado */
      }
    })();
    return () => {
      dead = true;
      try {
        layer?.cancel();
      } catch {
        /* nada */
      }
    };
  }, [visible, scale, pdf, index]);

  // Resaltado de la búsqueda (marca el fragmento de texto que contiene la coincidencia)
  useEffect(() => {
    if (!visible || !query) return setHl([]);
    let dead = false;
    (async () => {
      const page = await pdf.getPage(index + 1);
      const tc = await page.getTextContent();
      const vp = page.getViewport({ scale });
      const q = fold(query);
      const out: Box[] = [];
      for (const it of tc.items as any[]) {
        if (typeof it.str !== "string" || !it.str) continue;
        const f = fold(it.str);
        let at = f.indexOf(q);
        while (at !== -1) {
          // El ancho del fragmento se reparte por caracteres (aproximado, suficiente para marcar la palabra)
          const xa = it.transform[4] + (it.width * at) / it.str.length;
          const xb = it.transform[4] + (it.width * (at + q.length)) / it.str.length;
          const [x1, y1, x2, y2] = vp.convertToViewportRectangle([xa, it.transform[5], xb, it.transform[5] + (it.height || 10)]);
          out.push({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
          at = f.indexOf(q, at + q.length);
        }
      }
      if (!dead) setHl(out);
    })();
    return () => {
      dead = true;
    };
  }, [visible, query, scale, pdf, index]);

  return (
    <div
      className="pdf-page"
      data-index={index}
      ref={(el) => {
        wrap.current = el;
        register(index, el);
      }}
      style={{ width: (dims ? dims.w : baseW) * scale, height: (dims ? dims.h : baseH) * scale }}
    >
      <canvas ref={canvas} />
      {marks.map((m) =>
        m.rects.map((r, k) => (
          <div
            key={`${m.id}-${k}`}
            className="amark"
            style={{ left: r[0] * scale, top: r[1] * scale, width: r[2] * scale, height: r[3] * scale, background: (HL_COLORS[m.color] ?? HL_COLORS.amarillo).hex }}
          />
        ))
      )}
      <div className="textLayer" ref={textRef} />
      {(ink.length > 0 || pen.on) && (
        <InkLayer page={index + 1} scale={scale} strokes={ink} penOn={pen.on} eraser={pen.eraser} color={pen.color} onStroke={pen.onStroke} onErase={pen.onErase} panBy={pen.panBy} />
      )}
      {hl.map((b, k) => (
        <div key={k} className="hl" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
      ))}
    </div>
  );
});

// ---------------------------------------------------------------- Miniatura
function Thumb(props: { pdf: PDFDocumentProxy; index: number; baseW: number; current: boolean; onGo: (p: number) => void }) {
  const { pdf, index, baseW, current, onGo } = props;
  const btn = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = btn.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setShow(true);
        io.disconnect();
      }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!show) return;
    let dead = false;
    let task: any;
    (async () => {
      try {
        const page = await pdf.getPage(index + 1);
        if (dead) return;
        const vp = page.getViewport({ scale: 120 / baseW });
        const c = canvas.current!;
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        task = page.render({ canvasContext: c.getContext("2d")!, viewport: vp });
        await task.promise;
      } catch {
        /* cancelado */
      }
    })();
    return () => {
      dead = true;
      task?.cancel();
    };
  }, [show, pdf, index, baseW]);

  return (
    <button ref={btn} className={"thumb" + (current ? " on" : "")} onClick={() => onGo(index + 1)} aria-label={`Ir a la página ${index + 1}`}>
      <canvas ref={canvas} width={120} height={156} />
      <span>{index + 1}</span>
    </button>
  );
}

// ---------------------------------------------------------------- Lector
export default function PdfReader({ book, onClose, onAdd }: { book: PdfBook; onClose: () => void; onAdd?: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const pagesEl = useRef<HTMLDivElement>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const prefs0 = useRef(loadPrefs());

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [base, setBase] = useState({ w: 612, h: 792 });
  const [fitW, setFitW] = useState(800);
  const [zoom, setZoom] = useState<number>(prefs0.current.zoom);
  const [theme, setTheme] = useState<ThemeId>(prefs0.current.theme);
  const [page, setPage] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [tab, setTab] = useState<Tab>("toc");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const searchToken = useRef(0);

  // ---- Fase 5: marcadores y resaltados ----
  const annKey = book.id < 0 ? `p:${book.path}` : `b:${book.id}`;
  const [anns, setAnns] = useState<Ann[]>([]);
  const annsRef = useRef<Ann[]>([]);
  annsRef.current = anns;
  const [sel, setSel] = useState<Sel | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const marksByPage = useMemo(() => {
    const m: Record<number, Mark[]> = {};
    for (const a of anns) {
      if (a.kind !== "highlight") continue;
      const l = parseLoc(a.loc);
      if (l && l.rects.length) (m[l.page] ??= []).push({ id: a.id, color: a.color, rects: l.rects });
    }
    return m;
  }, [anns]);
  const inkByPage = useMemo(() => {
    const m: Record<number, InkStroke[]> = {};
    for (const a of anns) {
      if (a.kind !== "ink") continue;
      const mm = /^p(\d+)\|(.*)$/.exec(a.loc);
      if (!mm) continue;
      try {
        const o = JSON.parse(mm[2]);
        if (Array.isArray(o.pts) && o.pts.length) (m[Number(mm[1])] ??= []).push({ id: a.id, color: a.color, w: Number(o.w) || 1.8, pts: o.pts });
      } catch {
        /* trazo dañado: se ignora */
      }
    }
    return m;
  }, [anns]);
  const [penOn, setPenOn] = useState(false);
  const [eraser, setEraser] = useState(false);
  const [penColor, setPenColor] = useState("tinta");
  const addStroke = useCallback(
    async (pg: number, w: number, pts: number[][]) => {
      const loc = `p${pg}|${JSON.stringify({ w, pts })}`;
      const color = penColorRef.current;
      const id = await invoke<number>("add_annotation", { key: annKey, kind: "ink", loc, text: "Dibujo", color, note: "" }).catch(() => null);
      if (id !== null) setAnns((l) => [...l, { id, kind: "ink", loc, text: "Dibujo", color, note: "", created: Date.now() / 1000 }]);
    },
    [annKey]
  );
  const eraseStroke = useCallback(async (id: number) => {
    await invoke("delete_annotation", { id }).catch(() => {});
    setAnns((l) => l.filter((x) => x.id !== id));
  }, []);
  const penColorRef = useRef(penColor);
  penColorRef.current = penColor;
  const panBy = useCallback((dx: number, dy: number) => scroller.current?.scrollBy(dx, dy), []);
  const pen = useMemo(
    () => ({ on: penOn, eraser, color: penColor, onStroke: addStroke, onErase: eraseStroke, panBy }),
    [penOn, eraser, penColor, addStroke, eraseStroke, panBy]
  );
  const marked = anns.some((a) => a.kind === "bookmark" && a.loc === `p${page}`);

  const total = pdf?.numPages ?? 0;
  const scale = (fitW / base.w) * zoom;

  // ---- progreso guardado (página actual) ----
  const pending = useRef<{ page: number; pct: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const s = pending.current;
    if (!s) return;
    pending.current = null;
    await invoke("set_progress", { id: book.id, cfi: `p${s.page}`, pct: s.pct, path: book.id < 0 ? book.path : null }).catch(() => {});
  }, [book.id]);
  const queueSave = (p: number, n: number) => {
    pending.current = { page: p, pct: n ? p / n : 0 };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 700);
  };
  const close = async () => {
    await flush();
    onClose();
  };

  // Guarda al instante si se cierra la ventana o la app pasa a segundo plano (no esperar al retraso de 0,7 s)
  useEffect(() => {
    const now = () => void flush();
    const hidden = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("beforeunload", now);
    window.addEventListener("pagehide", now);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", now);
      window.removeEventListener("pagehide", now);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [flush]);

  // ---- cargar el PDF ----
  useEffect(() => {
    let alive = true;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const buf = await invoke<ArrayBuffer>("read_book_file", { id: book.id, path: book.id < 0 ? book.path : null });
        doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        if (!alive) return void doc.destroy();
        const p1 = await doc.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        setBase({ w: vp.width, h: vp.height });
        const ol = await doc.getOutline().catch(() => null);
        setOutline(flattenOutline(ol as any));
        const saved = await invoke<Ann[]>("list_annotations", { key: annKey }).catch(() => [] as Ann[]);
        if (!alive) return; // el visor se cerró mientras se cargaba: el cleanup ya destruyó el documento
        setAnns(saved);
        setPdf(doc);
      } catch (e) {
        if (alive) setError(`No se pudo abrir este PDF: ${e}`);
      }
    })();
    return () => {
      alive = false;
      flush();
      doc?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // ---- ancho disponible ----
  useEffect(() => {
    const s = scroller.current;
    if (!s) return;
    const ro = new ResizeObserver(() => setFitW(Math.max(200, s.clientWidth - 24)));
    ro.observe(s);
    return () => ro.disconnect();
  }, []);

  const register = useCallback((i: number, el: HTMLDivElement | null) => {
    pageEls.current[i] = el;
  }, []);

  const goToPage = useCallback((n: number) => {
    const s = scroller.current;
    const el = pageEls.current[clamp(n, 1, pageEls.current.length) - 1];
    if (!s || !el || !pagesEl.current) return;
    const top = pagesEl.current.offsetTop + el.offsetTop - 8;
    // Saltos cortos con desplazamiento suave; los largos (más de 3 pantallas) directos
    const near = Math.abs(top - s.scrollTop) < s.clientHeight * 3;
    s.scrollTo({ top, behavior: near && !reduceMotion() ? "smooth" : "auto" });
  }, []);

  // ---- reabrir en la última página ----
  const restored = useRef(false);
  useEffect(() => {
    if (!pdf || restored.current) return;
    restored.current = true;
    const m = /^p(\d+)$/.exec(book.progressCfi || "");
    if (m) requestAnimationFrame(() => goToPage(Number(m[1])));
  }, [pdf, book.progressCfi, goToPage]);

  // ---- página actual según el scroll ----
  const raf = useRef(0);
  const onScroll = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const s = scroller.current;
      const top0 = pagesEl.current?.offsetTop ?? 0;
      if (!s) return;
      const y = s.scrollTop + s.clientHeight * 0.35;
      let cur = 1;
      for (let i = 0; i < pageEls.current.length; i++) {
        const el = pageEls.current[i];
        if (!el) continue;
        if (top0 + el.offsetTop <= y) cur = i + 1;
        else break;
      }
      setPage(cur);
      queueSave(cur, pageEls.current.length);
    });
  };

  // ---- zoom (botones, Ctrl + rueda, pellizco) conservando el centro ----
  const adjust = useRef<{ ratio: number; cx: number; cy: number } | null>(null);
  const applyZoom = (next: number, cx?: number, cy?: number) => {
    const s = scroller.current;
    const nz = clamp(Math.round(next * 100) / 100, 0.5, 4);
    if (nz === zoom) return;
    adjust.current = { ratio: nz / zoom, cx: cx ?? (s ? s.clientWidth / 2 : 0), cy: cy ?? (s ? s.clientHeight / 2 : 0) };
    setZoom(nz);
  };
  const applyRef = useRef(applyZoom);
  applyRef.current = applyZoom;
  const pageRef = useRef(1);
  pageRef.current = page;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useLayoutEffect(() => {
    const a = adjust.current;
    const s = scroller.current;
    if (!a || !s) return;
    adjust.current = null;
    s.scrollTop = (s.scrollTop + a.cy) * a.ratio - a.cy;
    s.scrollLeft = (s.scrollLeft + a.cx) * a.ratio - a.cx;
  }, [zoom]);

  useEffect(() => {
    try {
      localStorage.setItem("cinta.pdf", JSON.stringify({ theme, zoom }));
    } catch {
      /* sin almacenamiento: las preferencias solo duran esta sesión */
    }
  }, [theme, zoom]);

  useEffect(() => {
    const s = scroller.current;
    if (!s) return;
    // Dos dedos en el touchpad de lado: página anterior / siguiente (el desplazamiento vertical sigue siendo continuo)
    const gesto = crearGestoRueda((dir) => goToPage(pageRef.current + dir), { activo: () => s.scrollWidth <= s.clientWidth + 2 } /* con zoom y desborde lateral, de lado = mover la página */);
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) { gesto(e); return; }
      e.preventDefault();
      const r = s.getBoundingClientRect();
      applyRef.current(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
    };
    s.addEventListener("wheel", onWheel, { passive: false });
    return () => s.removeEventListener("wheel", onWheel);
  }, []);

  // ---- toque: tocar un resaltado lo edita; doble toque = zoom; un toque = barras ----
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const chromeTimer = useRef<number | undefined>(undefined);
  const onTap = (e: React.MouseEvent) => {
    const now = Date.now();
    const lt = lastTap.current;
    const s = scroller.current;
    if (s && now - lt.t < 300 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) {
      window.clearTimeout(chromeTimer.current);
      lastTap.current = { t: 0, x: 0, y: 0 };
      window.getSelection()?.removeAllRanges(); // el doble toque no debe dejar una palabra seleccionada
      const r = s.getBoundingClientRect();
      applyZoom(zoom > 1.05 ? 1 : 2, e.clientX - r.left, e.clientY - r.top);
      return;
    }
    if (window.getSelection()?.toString()) return;
    const pageEl = (e.target as HTMLElement).closest?.(".pdf-page") as HTMLElement | null;
    if (pageEl) {
      const pr = pageEl.getBoundingClientRect();
      const px = (e.clientX - pr.left) / scale;
      const py = (e.clientY - pr.top) / scale;
      const hit = (marksByPage[Number(pageEl.dataset.index) + 1] ?? NO_MARKS).find((m) =>
        m.rects.some((r) => px >= r[0] && px <= r[0] + r[2] && py >= r[1] && py <= r[1] + r[3])
      );
      if (hit) {
        setSel({ mode: "edit", id: hit.id });
        return;
      }
    }
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    window.clearTimeout(chromeTimer.current);
    chromeTimer.current = window.setTimeout(() => {
      setSel(null);
      setChrome((c) => !c);
    }, 260);
  };

  // ---- selección de texto → barra de colores ----
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  useEffect(() => {
    let t: number | undefined;
    const check = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const sl = window.getSelection();
        if (!sl || sl.isCollapsed || !sl.rangeCount) return setSel((x) => (x && x.mode === "new" ? null : x));
        const range = sl.getRangeAt(0);
        const n = range.startContainer;
        const node = n.nodeType === 1 ? (n as Element) : n.parentElement;
        const pageEl = node?.closest(".pdf-page") as HTMLElement | null;
        const text = sl.toString().trim();
        if (!pageEl || !text) return;
        const pr = pageEl.getBoundingClientRect();
        const sc = scaleRef.current;
        const raw = Array.from(range.getClientRects())
          .filter((r) => r.width > 1 && r.height > 1 && r.left < pr.right && r.right > pr.left && r.top >= pr.top - 2 && r.bottom <= pr.bottom + 2)
          .map((r) => [(r.left - pr.left) / sc, (r.top - pr.top) / sc, r.width / sc, r.height / sc].map((v) => Math.round(v * 10) / 10));
        const rects = dedupeRects(raw);
        if (rects.length) setSel({ mode: "new", page: Number(pageEl.dataset.index) + 1, rects, text: text.slice(0, 500) });
      }, 300);
    };
    document.addEventListener("selectionchange", check);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("selectionchange", check);
    };
  }, []);

  const toggleBookmark = async () => {
    const here = annsRef.current.filter((a) => a.kind === "bookmark" && a.loc === `p${page}`);
    if (here.length) {
      for (const a of here) await invoke("delete_annotation", { id: a.id }).catch(() => {});
      setAnns((l) => l.filter((x) => !here.some((h) => h.id === x.id)));
      return;
    }
    const text = `Página ${page}`;
    const loc = `p${page}`;
    const id = await invoke<number>("add_annotation", { key: annKey, kind: "bookmark", loc, text, color: "amarillo", note: "" }).catch(() => null);
    if (id !== null) setAnns((l) => [...l, { id, kind: "bookmark", loc, text, color: "amarillo", note: "", created: Date.now() / 1000 }]);
  };
  const addHighlight = async (color: string, thenNote = false) => {
    if (!sel || sel.mode !== "new") return;
    const loc = `p${sel.page}|${JSON.stringify(sel.rects)}`;
    const id = await invoke<number>("add_annotation", { key: annKey, kind: "highlight", loc, text: sel.text, color, note: "" }).catch(() => null);
    if (id === null) return;
    setAnns((l) => [...l, { id, kind: "highlight", loc, text: sel.text, color, note: "", created: Date.now() / 1000 }]);
    window.getSelection()?.removeAllRanges();
    setSel(null);
    if (thenNote) setNoteFor(id);
  };
  const recolor = async (color: string) => {
    if (!sel || sel.mode !== "edit") return;
    await invoke("update_annotation", { id: sel.id, color, note: null }).catch(() => {});
    setAnns((l) => l.map((a) => (a.id === sel.id ? { ...a, color } : a)));
    setSel(null);
  };
  const saveNote = async (note: string) => {
    const id = noteFor;
    setNoteFor(null);
    if (id === null) return;
    await invoke("update_annotation", { id, color: null, note }).catch(() => {});
    setAnns((l) => l.map((a) => (a.id === id ? { ...a, note } : a)));
  };
  const removeAnn = async (a: Ann) => {
    await invoke("delete_annotation", { id: a.id }).catch(() => {});
    setAnns((l) => l.filter((x) => x.id !== a.id));
    setSel(null);
  };

  const pinch = useRef<{ d0: number; cx: number; cy: number; ratio: number } | null>(null);
  const dist = (e: React.TouchEvent) =>
    Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !scroller.current) return;
    const r = scroller.current.getBoundingClientRect();
    pinch.current = {
      d0: dist(e),
      cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
      cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
      ratio: 1,
    };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const p = pinch.current;
    const s = scroller.current;
    const el = pagesEl.current;
    if (!p || !s || !el || e.touches.length !== 2) return;
    p.ratio = clamp(dist(e) / p.d0, 0.4, 4);
    el.style.transformOrigin = `${p.cx + s.scrollLeft}px ${p.cy + s.scrollTop - el.offsetTop}px`;
    el.style.transform = `scale(${p.ratio})`; // vista previa inmediata; al soltar se vuelve a dibujar nítido
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const p = pinch.current;
    if (!p || e.touches.length >= 2) return;
    pinch.current = null;
    if (pagesEl.current) pagesEl.current.style.transform = "";
    if (Math.abs(p.ratio - 1) > 0.03) applyZoom(zoom * p.ratio, p.cx, p.cy);
  };

  // ---- teclado ----
  const onKey = (e: KeyboardEvent) => {
    const s = scroller.current;
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setPanel("search");
      return;
    }
    if (e.key === "+" || e.key === "=") applyZoom(zoom * 1.2);
    else if (e.key === "-") applyZoom(zoom / 1.2);
    else if (e.key === "PageDown" && s) s.scrollBy({ top: s.clientHeight * 0.9 });
    else if (e.key === "PageUp" && s) s.scrollBy({ top: -s.clientHeight * 0.9 });
    else if (e.key === "Escape") (panel ? setPanel(null) : close());
  };
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---- búsqueda en todo el documento ----
  const runSearch = async () => {
    const q = fold(query.trim());
    if (!pdf || !q) return;
    const token = ++searchToken.current;
    setHits([]);
    setProgress(0);
    setSearching(true);
    setActiveQuery(query.trim());
    const out: Hit[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      if (token !== searchToken.current) return;
      const pg = await pdf.getPage(i);
      const tc = await pg.getTextContent();
      const text = (tc.items as any[]).map((it) => it.str ?? "").join(" ");
      const nt = fold(text);
      let idx = nt.indexOf(q);
      let n = 0;
      while (idx !== -1 && n < 5) {
        out.push({ page: i, snippet: text.slice(Math.max(0, idx - 30), idx + q.length + 50) });
        idx = nt.indexOf(q, idx + q.length);
        n++;
      }
      if (i % 10 === 0 || i === pdf.numPages || out.length >= 300) {
        setHits([...out]);
        setProgress(i);
      }
      if (out.length >= 300) break;
    }
    if (token === searchToken.current) setSearching(false);
  };

  const goOutline = async (o: OutlineItem) => {
    if (!pdf) return;
    try {
      const dest = typeof o.dest === "string" ? await pdf.getDestination(o.dest) : o.dest;
      if (!dest) return;
      const idx = await pdf.getPageIndex(dest[0]);
      goToPage(idx + 1);
      setPanel(null);
    } catch {
      /* destino no válido */
    }
  };

  const goPanel = (n: number) => {
    goToPage(n);
    setPanel(null);
  };
  const openToc = () => {
    setTab(outline.length ? "toc" : "pages");
    setPanel("toc");
  };

  return (
    <div className={"reader pdfr t-" + theme}>
      <div
        className="pdf-scroll"
        ref={scroller}
        onScroll={onScroll}
        onClick={onTap}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="pdf-pages" ref={pagesEl}>
          {pdf &&
            Array.from({ length: total }, (_, i) => (
              <PageView
                key={i}
                pdf={pdf}
                index={i}
                scale={scale}
                baseW={base.w}
                baseH={base.h}
                query={activeQuery}
                marks={marksByPage[i + 1] ?? NO_MARKS}
                ink={inkByPage[i + 1] ?? NO_INK}
                pen={pen}
                register={register}
              />
            ))}
        </div>
      </div>
      {error && <div className="reader-error">{error}</div>}
      {!pdf && !error && <div className="reader-error">Abriendo…</div>}

      <header className={"rbar top" + (chrome ? "" : " hidden")}>
        <button className="rbtn icon-only" onClick={close} aria-label="Volver" title="Volver"><Icon name="back" /><span className="reader-mobile-label">Volver</span></button>
        <span className="rtitle">{book.title}</span>
        {onAdd && <button className="rbtn" onClick={onAdd}>Agregar a la biblioteca</button>}
        <button className="rbtn icon-only" onClick={openToc} aria-label="Contenido" title="Contenido"><Icon name="contents" /><span className="reader-mobile-label">Contenido</span></button>
        <button className="rbtn icon-only" onClick={() => setPanel("search")} aria-label="Buscar" title="Buscar"><Icon name="search" /><span className="reader-mobile-label">Buscar</span></button>
        <button className={"rbtn bm" + (marked ? " on" : "")} onClick={toggleBookmark} aria-label={marked ? "Quitar marcador" : "Agregar marcador"} aria-pressed={marked}>
          <Icon name="bookmark" active={marked} /><span className="reader-mobile-label">{marked ? "★" : "☆"}</span>
        </button>
        <button className={"rbtn" + (penOn ? " on" : "")} onClick={() => { setPenOn((v) => !v); setEraser(false); window.getSelection()?.removeAllRanges(); }} aria-pressed={penOn}><Icon name="pencil" /><span className="reader-mobile-label">Lápiz</span></button>
        <button className="rbtn aa" onClick={() => setPanel(panel === "look" ? null : "look")} aria-label="Apariencia y zoom">Aa</button>
      </header>

      <footer className={"rbar bottom" + (chrome ? "" : " hidden")}>
        <input
          type="range"
          min={1}
          max={Math.max(1, total)}
          step={1}
          value={page}
          style={{ "--p": `${total > 1 ? ((page - 1) / (total - 1)) * 100 : 0}%` } as CSSProperties}
          disabled={!total}
          aria-label="Página"
          onChange={(e) => setPage(Number(e.target.value))}
          onPointerUp={() => goToPage(page)}
          onKeyUp={() => goToPage(page)}
        />
        <span className="rpct">{total ? `${page} / ${total}` : "…"}</span>
      </footer>

      {penOn && (
        <div className="selbar penbar" role="toolbar" aria-label="Lápiz">
          {Object.entries(INK_COLORS).map(([id, c]) => (
            <button key={id} className={"selc" + (!eraser && penColor === id ? " sel" : "")} style={{ background: c.hex }} aria-label={c.label} title={c.label} onClick={() => { setPenColor(id); setEraser(false); }} />
          ))}
          <button className={"selx" + (eraser ? " on" : "")} onClick={() => setEraser((v) => !v)} aria-pressed={eraser}>Borrar</button>
          <button className="selx" onClick={() => { setPenOn(false); setEraser(false); }}>Listo</button>
        </div>
      )}

      {noteFor !== null && (() => {
        const a = anns.find((x) => x.id === noteFor);
        return <NoteDialog initial={a?.note ?? ""} quote={a?.text ?? ""} onSave={saveNote} onCancel={() => setNoteFor(null)} />;
      })()}

      {sel && (
        <div className="selbar" role="toolbar" aria-label="Resaltar" onPointerDown={(e) => e.preventDefault()}>
          {Object.entries(HL_COLORS).map(([id, c]) => (
            <button
              key={id}
              className="selc"
              style={{ background: c.hex }}
              aria-label={c.label}
              title={c.label}
              onClick={() => (sel.mode === "new" ? addHighlight(id) : recolor(id))}
            />
          ))}
          <button className="selx" onClick={() => (sel.mode === "new" ? addHighlight("amarillo", true) : (setNoteFor(sel.id), setSel(null)))}>Nota</button>
          {sel.mode === "edit" && (
            <button className="selx" onClick={() => { const a = anns.find((x) => x.id === sel.id); if (a) removeAnn(a); }}>Quitar</button>
          )}
          <button className="selx" onClick={() => { window.getSelection()?.removeAllRanges(); setSel(null); }} aria-label="Cerrar">✕</button>
        </div>
      )}

      {panel === "look" && (
        <>
          <div className="scrim clear" onClick={() => setPanel(null)} />
          <div className="pop" role="dialog" aria-label="Apariencia y zoom">
            <div className="stepper">
              <button onClick={() => applyZoom(zoom - 0.1)} aria-label="Alejar">
                <span style={{ fontSize: 14 }}>A</span>
              </button>
              <span>{Math.round(zoom * 100)} %</span>
              <button onClick={() => applyZoom(zoom + 0.1)} aria-label="Acercar">
                <span style={{ fontSize: 22 }}>A</span>
              </button>
            </div>
            <div className="themes">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => (
                <button
                  key={id}
                  className={"tswatch" + (theme === id ? " on" : "")}
                  style={{ background: THEMES[id].bg, color: THEMES[id].fg }}
                  onClick={() => setTheme(id)}
                  aria-label={THEMES[id].label}
                  title={THEMES[id].label}
                >
                  Aa
                </button>
              ))}
            </div>
            <div className="row">
              <button onClick={() => applyZoom(1)}>Ajustar al ancho</button>
            </div>
          </div>
        </>
      )}

      {(panel === "toc" || panel === "search") && pdf && (
        <>
          <div className="scrim" onClick={() => setPanel(null)} />
          <aside className="side" role="dialog">
            {panel === "toc" ? (
              <>
                <div className="tabs">
                  {([["toc", "Contenido"], ["pages", "Páginas"], ["marks", "Marcadores"], ["notes", "Resaltados"]] as [Tab, string][]).map(([id, label]) => (
                    <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
                  ))}
                </div>
                {tab === "marks" || tab === "notes" ? (
                  (() => {
                    const kind = tab === "marks" ? "bookmark" : "highlight";
                    const list = anns
                      .filter((a) => a.kind === kind)
                      .map((a) => ({ a, pg: parseLoc(a.loc)?.page ?? 0 }))
                      .sort((x, y) => x.pg - y.pg || x.a.created - y.a.created);
                    return (
                      <>
                        {list.length === 0 && (
                          <p className="muted">
                            {kind === "bookmark" ? "Aún no hay marcadores. Toca ☆ en la barra superior para marcar la página." : "Aún no hay resaltados. Selecciona texto para resaltarlo."}
                          </p>
                        )}
                        {list.map(({ a, pg }) => (
                          <div key={a.id} className="ann">
                            <button className="hit" onClick={() => goPanel(pg)}>
                              <b className="hit-page">Página {pg}</b>
                              {kind === "highlight" && <i className="dot" style={{ background: (HL_COLORS[a.color] ?? HL_COLORS.amarillo).hex }} />}
                              {kind === "highlight" ? a.text : "Marcador"}
                            {a.note && <span className="ann-note">{a.note}</span>}
                            </button>
                            <button className="ann-del" onClick={() => removeAnn(a)} aria-label="Eliminar">✕</button>
                          </div>
                        ))}
                      </>
                    );
                  })()
                ) : tab === "pages" ? (
                  <div className="thumbs">
                    {Array.from({ length: total }, (_, i) => (
                      <Thumb key={i} pdf={pdf} index={i} baseW={base.w} current={page === i + 1} onGo={goPanel} />
                    ))}
                  </div>
                ) : (
                  <>
                    {outline.length === 0 && <p className="muted">Este PDF no incluye tabla de contenidos.</p>}
                    {outline.map((o, k) => (
                      <button key={k} className="toc-item" style={{ paddingLeft: 16 + o.depth * 18 }} onClick={() => goOutline(o)}>
                        {o.title}
                      </button>
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                <h3>Buscar en el documento</h3>
                <form
                  className="search-box"
                  onSubmit={(e) => {
                    e.preventDefault();
                    runSearch();
                  }}
                >
                  <input autoFocus type="search" placeholder="Palabra o frase" value={query} onChange={(e) => setQuery(e.target.value)} />
                  <button className="primary" type="submit">Buscar</button>
                </form>
                {searching && <p className="muted">Buscando… {progress} de {total} páginas</p>}
                {!searching && activeQuery && hits.length === 0 && (
                  <p className="muted">Sin resultados. Si el PDF es un escaneo, no tiene texto que buscar.</p>
                )}
                {hits.map((h, k) => (
                  <button key={k} className="hit" onClick={() => goPanel(h.page)}>
                    <b className="hit-page">Página {h.page}</b>
                    …{h.snippet.trim()}…
                  </button>
                ))}
                {hits.length >= 300 && <p className="muted">Se muestran los primeros 300 resultados.</p>}
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
