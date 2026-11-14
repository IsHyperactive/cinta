import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import ePub from "epubjs";
import NoteDialog from "../componentes/NoteDialog";
import AppleIcon from "../componentes/AppleIcon";
import { HL_COLORS, reduceMotion, type Ann } from "../utilidades/annot";

type ReaderBook = { id: number; title: string; path?: string; progressCfi: string | null };
type TocItem = { label: string; href: string; depth: number };
type ThemeId = "claro" | "sepia" | "gris" | "oscuro";
type Margen = "estrecho" | "normal" | "ancho";
type Prefs = { theme: ThemeId; size: number; font: string; line: number; justify: boolean; scroll: boolean; margen: Margen; rate: number };
type Hit = { cfi: string; excerpt: string };
type Sel = { mode: "new"; cfiRange: string; text: string } | { mode: "edit"; id: number };
type TocTab = "toc" | "marks" | "notes";

const THEMES: Record<ThemeId, { bg: string; fg: string; label: string }> = {
  claro: { bg: "#ffffff", fg: "#1b1d22", label: "Claro" },
  sepia: { bg: "#f1e7d0", fg: "#3b2f1e", label: "Sepia" },
  gris: { bg: "#d9dadd", fg: "#25272c", label: "Gris" },
  oscuro: { bg: "#121316", fg: "#d8dbe2", label: "Oscuro" },
};
const FONTS = ["Georgia", "Cambria", "Palatino Linotype", "Segoe UI", "Verdana"];
// line = 0 respeta el interlineado original del libro
const LINES = [
  { v: 0, label: "Original" },
  { v: 1.3, label: "Compacto" },
  { v: 1.6, label: "Normal" },
  { v: 2, label: "Amplio" },
];
const DEFAULT_PREFS: Prefs = { theme: "claro", size: 100, font: "Georgia", line: 0, justify: false, scroll: false, margen: "normal", rate: 1 };
const MARGENES: { v: Margen; label: string }[] = [
  { v: "estrecho", label: "Estrecho" },
  { v: "normal", label: "Normal" },
  { v: "ancho", label: "Ancho" },
];
const VELOCIDADES = [0.8, 1, 1.25, 1.5];

/** Parte el texto en frases cortas: las voces del sistema fallan con párrafos muy largos. */
function trocear(t: string): string[] {
  const frases = t.replace(/\s+/g, " ").match(/[^.!?…]+[.!?…]*\s*/g) ?? [];
  return frases
    .flatMap((f) => (f.length <= 240 ? [f] : f.match(/.{1,240}(\s|$)/g) ?? [f]))
    .map((f) => f.trim())
    .filter(Boolean);
}
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem("cinta.reader") || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

function flatten(items: any[], depth: number): TocItem[] {
  return items.flatMap((i) => [
    { label: String(i.label || "").trim(), href: i.href as string, depth },
    ...flatten(i.subitems || [], depth + 1),
  ]);
}

function applyPrefs(r: any, p: Prefs) {
  const t = THEMES[p.theme] ?? THEMES.claro;
  const flow: Record<string, string> = {};
  if (p.line) flow["line-height"] = `${p.line} !important`;
  if (p.justify) flow["text-align"] = "justify !important";
  r.themes.register("cinta", {
    "p, li, blockquote": flow,
    body: { background: `${t.bg} !important`, color: `${t.fg} !important`, "touch-action": p.scroll ? "pan-y" : "none" },
    "p, li, h1, h2, h3, h4, h5, h6, span, div, blockquote": {
      color: `${t.fg} !important`,
      background: "transparent !important",
    },
    a: { color: "inherit !important" },
    img: { "max-width": "100% !important" },
  });
  r.themes.select("cinta");
  r.themes.fontSize(`${p.size}%`);
  r.themes.font(p.font);
}

export default function Reader({ book, onClose, onAdd }: { book: ReaderBook; onClose: () => void; onAdd?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const rendition = useRef<any>(null);
  const epub = useRef<any>(null);
  const tocRef = useRef<TocItem[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const [toc, setToc] = useState<TocItem[]>([]);
  const [panel, setPanel] = useState<null | "toc" | "look" | "search">(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchId = useRef(0);
  const [chrome, setChrome] = useState(true);
  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);
  const [chapter, setChapter] = useState("");
  const [error, setError] = useState("");

  // ---- Fase 5: marcadores y resaltados ----
  const annKey = book.id < 0 ? `p:${book.path}` : `b:${book.id}`;
  const [anns, setAnns] = useState<Ann[]>([]);
  const annsRef = useRef<Ann[]>([]);
  annsRef.current = anns;
  const [tocTab, setTocTab] = useState<TocTab>("toc");
  const [sel, setSel] = useState<Sel | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [marked, setMarked] = useState(false);
  const [voz, setVoz] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const vozRef = useRef(false);
  const vozGen = useRef(0);
  const scrollAplicado = useRef(prefs.scroll);
  const selContents = useRef<any>(null);
  const hlClickAt = useRef(0);
  // Historial de posiciones anteriores al abrir referencias y notas al pie del EPUB.
  const referenceHistory = useRef<string[]>([]);
  const [canReturnToReference, setCanReturnToReference] = useState(false);
  const cmpCfi = (a: string, b: string): number => {
    try {
      return new (ePub as any).CFI().compare(a, b);
    } catch {
      return 0;
    }
  };
  /** Marcadores que caen dentro de la(s) página(s) visible(s). */
  const bookmarksHere = () => {
    const loc = rendition.current?.currentLocation?.();
    if (!loc?.start || !loc?.end) return [] as Ann[];
    return annsRef.current.filter(
      (a) => a.kind === "bookmark" && cmpCfi(a.loc, loc.start.cfi) >= 0 && cmpCfi(a.loc, loc.end.cfi) <= 0
    );
  };
  const refreshMarked = () => setMarked(bookmarksHere().length > 0);
  const refreshMarkedRef = useRef(refreshMarked);
  refreshMarkedRef.current = refreshMarked;
  useEffect(() => refreshMarked(), [anns]);

  /** Regresa a la posición exacta desde la que se abrió una referencia interna del EPUB. */
  const returnToReference = async () => {
    const previous = referenceHistory.current.pop();
    if (!previous) {
      setCanReturnToReference(false);
      return;
    }
    try {
      await rendition.current?.display(previous);
      setCanReturnToReference(referenceHistory.current.length > 0);
    } catch (e) {
      referenceHistory.current.push(previous);
      setCanReturnToReference(true);
      setError(`No se pudo volver a la referencia: ${e}`);
    }
  };

  const paintHighlight = (a: Ann) => {
    const r = rendition.current;
    if (!r) return;
    const hex = (HL_COLORS[a.color] ?? HL_COLORS.amarillo).hex;
    try {
      r.annotations.remove(a.loc, "highlight");
      r.annotations.highlight(
        a.loc,
        { id: a.id },
        () => {
          hlClickAt.current = Date.now();
          setSel({ mode: "edit", id: a.id });
        },
        "cinta-hl",
        { fill: hex, "fill-opacity": "0.4" }
      );
    } catch {
      /* CFI no válido: se ignora */
    }
  };

  const toggleBookmark = async () => {
    const r = rendition.current;
    const here = bookmarksHere();
    if (here.length) {
      for (const a of here) await invoke("delete_annotation", { id: a.id }).catch(() => {});
      setAnns((l) => l.filter((x) => !here.some((h) => h.id === x.id)));
      return;
    }
    const loc = r?.currentLocation?.();
    if (!loc?.start) return;
    const text = `${chapter || book.title}${ready ? ` · ${Math.round(pct * 100)} %` : ""}`;
    const id = await invoke<number>("add_annotation", {
      key: annKey, kind: "bookmark", loc: loc.start.cfi, text, color: "amarillo", note: "",
    }).catch(() => null);
    if (id !== null) setAnns((l) => [...l, { id, kind: "bookmark", loc: loc.start.cfi, text, color: "amarillo", note: "", created: Date.now() / 1000 }]);
  };

  const addHighlight = async (color: string, thenNote = false) => {
    if (!sel || sel.mode !== "new") return;
    const id = await invoke<number>("add_annotation", {
      key: annKey, kind: "highlight", loc: sel.cfiRange, text: sel.text, color, note: "",
    }).catch(() => null);
    if (id === null) return;
    const a: Ann = { id, kind: "highlight", loc: sel.cfiRange, text: sel.text, color, note: "", created: Date.now() / 1000 };
    setAnns((l) => [...l, a]);
    paintHighlight(a);
    try { selContents.current?.window.getSelection()?.removeAllRanges(); } catch { /* ya no hay selección */ }
    setSel(null);
    if (thenNote) setNoteFor(id);
  };
  const recolor = async (color: string) => {
    if (!sel || sel.mode !== "edit") return;
    await invoke("update_annotation", { id: sel.id, color, note: null }).catch(() => {});
    const cur = annsRef.current.find((a) => a.id === sel.id);
    if (cur) paintHighlight({ ...cur, color });
    setAnns((l) => l.map((a) => (a.id === sel.id ? { ...a, color } : a)));
    setSel(null);
  };
  const saveNote = async (note: string) => {
    const id = noteFor;
    if (id === null) return;
    try {
      await invoke("update_annotation", { id, color: null, note });
      setAnns((l) => l.map((a) => (a.id === id ? { ...a, note } : a)));
      setNoteFor(null);
      setError("");
    } catch (e) {
      setError(`No se pudo guardar la nota: ${e}`);
    }
  };
  const removeAnn = async (a: Ann) => {
    await invoke("delete_annotation", { id: a.id }).catch(() => {});
    if (a.kind === "highlight") try { rendition.current?.annotations.remove(a.loc, "highlight"); } catch { /* nada que quitar */ }
    setAnns((l) => l.filter((x) => x.id !== a.id));
    setSel(null);
  };

  // ---- guardado de progreso (con retraso para no escribir en cada página) ----
  const pending = useRef<{ cfi: string; p: number | null } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const s = pending.current;
    if (!s) return;
    pending.current = null;
    await invoke("set_progress", { id: book.id, cfi: s.cfi, pct: s.p, path: book.id < 0 ? book.path : null }).catch(() => {});
  }, [book.id]);
  const queueSave = (cfi: string, p: number | null) => {
    pending.current = { cfi, p };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 700);
  };

  const close = async () => {
    detenerVoz();
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
  /** Pasa de página con una pequeña animación de deslizamiento (como Apple Books). */
  const turn = async (dir: 1 | -1) => {
    const r = rendition.current;
    const el = host.current;
    if (!r) return;
    try {
      await (dir > 0 ? r.next() : r.prev());
    } catch {
      /* sin más páginas */
    }
    if (!el || reduceMotion()) {
      if (el) { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; }
      return;
    }
    el.style.transition = "none";
    el.style.transform = `translateX(${dir * 28}px)`;
    el.style.opacity = "0.15";
    void el.offsetWidth; // fuerza el reflujo para que arranque la transición
    el.style.transition = "transform .3s cubic-bezier(.32,.72,0,1), opacity .22s ease-out";
    el.style.transform = "";
    el.style.opacity = "";
  };
  const springBack = () => {
    const el = host.current;
    if (!el) return;
    el.style.transition = "transform .32s cubic-bezier(.32,.72,0,1)";
    el.style.transform = "";
  };
  const next = () => turn(1);
  const prev = () => turn(-1);

  // ---- gestos táctiles: deslizar, tocar bordes, pellizcar ----
  const registerGestures = (r: any) => {
    let sx = 0, sy = 0, t0 = 0, d0 = 0, d1 = 0, multi = false, dragging = false;
    const dist = (e: TouchEvent) =>
      Math.hypot(e.touches[0].screenX - e.touches[1].screenX, e.touches[0].screenY - e.touches[1].screenY);

    r.on("touchstart", (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        multi = true;
        d0 = d1 = dist(e);
        return;
      }
      multi = false;
      dragging = false;
      if (host.current) host.current.style.transition = "none";
      sx = e.changedTouches[0].screenX;
      sy = e.changedTouches[0].screenY;
      t0 = Date.now();
    });
    r.on("touchmove", (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        d1 = dist(e);
        return;
      }
      const el = host.current;
      if (multi || !el || prefsRef.current.scroll) return; // en desplazamiento continuo no se arrastra la página
      try {
        if (e.view?.getSelection()?.toString()) return; // seleccionando texto: no arrastrar la página
      } catch { /* sin acceso a la selección */ }
      const dx = e.changedTouches[0].screenX - sx;
      const dy = e.changedTouches[0].screenY - sy;
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        dragging = true;
        el.style.transform = `translateX(${dx * 0.3}px)`; // la página sigue al dedo con resistencia
      }
    });
    r.on("touchend", (e: TouchEvent) => {
      if (multi) {
        if (e.touches.length === 0) {
          multi = false;
          const ratio = d1 / (d0 || 1);
          if (Math.abs(ratio - 1) > 0.08)
            setPrefs((p) => ({ ...p, size: clamp(Math.round((p.size * ratio) / 5) * 5, 70, 220) }));
        }
        return;
      }
      const dx = e.changedTouches[0].screenX - sx;
      const dy = e.changedTouches[0].screenY - sy;
      const swipe = Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && (Date.now() - t0 < 800 || Math.abs(dx) > 110);
      if (swipe && !prefsRef.current.scroll) turn(dx < 0 ? 1 : -1);
      else if (dragging) springBack();
      dragging = false;
    });
    // Tocar (o hacer clic): bordes pasan de página, centro muestra u oculta las barras
    r.on("click", (e: MouseEvent) => {
      try {
        // Los enlaces EPUB (incluidos #anclas y destinos en otros XHTML) deben
        // conservar su navegación nativa de epub.js; nunca tratarlos como paginación.
        const target = e.target instanceof Element ? e.target : null;
        if (target?.closest('a[href], area[href], button, input, select, textarea, [role="button"], [contenteditable="true"]')) return;
        if (e.view?.getSelection()?.toString()) return;
        if (Date.now() - hlClickAt.current < 400) return; // se tocó un resaltado: no pasar de página
        const scrollLeft = r.manager?.container?.scrollLeft ?? 0;
        const w = host.current?.clientWidth || 1;
        const x = (e.clientX - scrollLeft) / w;
        if (prefsRef.current.scroll) setChrome((c) => !c);
        else if (x < 0.25) turn(-1);
        else if (x > 0.75) turn(1);
        else setChrome((c) => !c);
      } catch {
        setChrome((c) => !c);
      }
    });
    // El atajo se atiende en keydown para impedir que WebView interprete Alt + ← como «Atrás».
    r.on("keydown", (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowLeft" && referenceHistory.current.length) {
        e.preventDefault();
        void returnToReference();
      }
    });
    // onKeyRef: así siempre usa el estado actual (si no, Escape cerraría el libro aunque hubiera un panel abierto)
    r.on("keyup", (e: KeyboardEvent) => onKeyRef.current(e));
    // Seleccionar texto (ratón, dedo o lápiz) muestra la barra de colores para resaltar
    r.on("selected", (cfiRange: string, contents: any) => {
      selContents.current = contents;
      const text = String(contents?.window?.getSelection?.()?.toString() ?? "").trim();
      if (text) setSel({ mode: "new", cfiRange, text });
    });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") next();
    else if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
    else if (e.key === "Escape") (panel ? setPanel(null) : close());
  };
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowLeft" && referenceHistory.current.length) {
        e.preventDefault();
        void returnToReference();
        return;
      }
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return; // escribiendo en el buscador
      onKeyRef.current(e);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---- abrir el libro ----
  useEffect(() => {
    let alive = true;
    let b: any;
    (async () => {
      try {
        const buf = await invoke<ArrayBuffer>("read_book_file", { id: book.id, path: book.id < 0 ? book.path : null });
        b = ePub();
        await b.open(buf, "binary");
        if (!alive) return b.destroy();
        epub.current = b;

        const r = b.renderTo(host.current!, {
          width: "100%",
          height: "100%",
          flow: prefsRef.current.scroll ? "scrolled-doc" : "paginated",
          spread: prefsRef.current.scroll ? "none" : "auto",
        });
        rendition.current = r;

        // Capturar la posición antes de que epub.js procese el enlace. El listener
        // en fase de captura conserva también enlaces #ancla y notas en otro XHTML.
        r.hooks.content.register((contents: any) => {
          const rememberReference = (event: MouseEvent) => {
            // Los nodos del EPUB viven en un iframe: no usar instanceof Element
            // del documento principal porque los constructores pertenecen a otro realm.
            const clicked = event.target as Element | null;
            const target = clicked && typeof clicked.closest === "function"
              ? clicked.closest("a[href]") as HTMLAnchorElement | null
              : null;
            if (!target) return;
            const href = (target.getAttribute("href") || "").trim();
            if (!href || href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return;

            let cfi = "";
            try {
              const range = contents.document.createRange();
              range.selectNodeContents(target);
              range.collapse(true);
              cfi = contents.cfiFromRange(range);
            } catch {
              cfi = r.currentLocation()?.start?.cfi || "";
            }
            if (!cfi) return;
            referenceHistory.current.push(cfi);
            setCanReturnToReference(true);
          };
          contents.document.addEventListener("click", rememberReference, true);
        });

        applyPrefs(r, prefsRef.current);
        registerGestures(r);

        r.on("relocated", (loc: any) => {
          const cfi: string = loc.start.cfi;
          const hasLoc = b.locations.length() > 0;
          const p = hasLoc ? b.locations.percentageFromCfi(cfi) : null;
          if (alive) {
            if (p !== null) setPct(p);
            const base = (h: string) => h.split("#")[0];
            const hit = tocRef.current.find((t) => base(t.href).endsWith(base(loc.start.href)) || base(loc.start.href).endsWith(base(t.href)));
            if (hit) setChapter(hit.label);
          }
          queueSave(cfi, p);
          refreshMarkedRef.current();
          setSel((x) => (x && x.mode === "new" ? null : x));
        });

        await r.display(book.progressCfi || undefined);
        const saved = await invoke<Ann[]>("list_annotations", { key: annKey }).catch(() => [] as Ann[]);
        if (alive) {
          setAnns(saved);
          saved.filter((a) => a.kind === "highlight").forEach(paintHighlight);
          refreshMarkedRef.current();
        }
        const nav = await b.loaded.navigation;
        tocRef.current = flatten(nav.toc, 0);
        if (alive) setToc(tocRef.current);

        await b.locations.generate(1600);
        if (!alive) return;
        setReady(true);
        const cur = r.currentLocation();
        if (cur?.start) {
          const p = b.locations.percentageFromCfi(cur.start.cfi);
          setPct(p);
          queueSave(cur.start.cfi, p);
        }
      } catch (e) {
        if (alive) setError(`No se pudo abrir este libro: ${e}`);
      }
    })();
    return () => {
      alive = false;
      flush();
      try {
        rendition.current?.destroy();
        b?.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // ---- aplicar y recordar preferencias ----
  useEffect(() => {
    try {
      localStorage.setItem("cinta.reader", JSON.stringify(prefs));
    } catch {
      /* sin almacenamiento: las preferencias solo duran esta sesión */
    }
    const r = rendition.current;
    if (r) {
      applyPrefs(r, prefs);
      // Cambio entre páginas y desplazamiento continuo: se recoloca en el mismo punto del libro
      if (scrollAplicado.current !== prefs.scroll) {
        scrollAplicado.current = prefs.scroll;
        try {
          const cfi = r.currentLocation()?.start?.cfi;
          r.flow(prefs.scroll ? "scrolled-doc" : "paginated");
          r.spread(prefs.scroll ? "none" : "auto");
          if (cfi) void r.display(cfi);
        } catch {
          /* si epub.js no admite el cambio en caliente, se aplica al reabrir el libro */
        }
      }
    }
  }, [prefs]);

  // Ancho del texto: al cambiar la clase del contenedor hay que pedirle a epub.js que recalcule las páginas
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        rendition.current?.resize();
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, [prefs.margen]);

  // ---- leer en voz alta (voces del sistema; sin internet) ----
  const textoDesdeAqui = (): string => {
    const r = rendition.current;
    const c = r?.getContents?.()?.[0];
    if (!c) return "";
    const doc: Document = c.document;
    try {
      const cfi = r.currentLocation()?.start?.cfi;
      const inicio: Range | null = cfi ? c.range(cfi) : null;
      const rg = doc.createRange();
      rg.selectNodeContents(doc.body);
      if (inicio) rg.setStart(inicio.startContainer, inicio.startOffset);
      return rg.toString();
    } catch {
      return doc.body?.innerText ?? "";
    }
  };

  const detenerVoz = useCallback(() => {
    vozRef.current = false;
    vozGen.current++;
    setVoz(false);
    try {
      window.speechSynthesis?.cancel();
    } catch {}
  }, []);

  const hablar = async () => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setError("Este equipo no tiene voces para leer en voz alta.");
      return;
    }
    const gen = ++vozGen.current;
    vozRef.current = true;
    setVoz(true);
    const idioma = String(epub.current?.packaging?.metadata?.language || "es");
    const vigente = () => vozRef.current && gen === vozGen.current;
    while (vigente()) {
      const voces = synth.getVoices();
      const voice = voces.find((v) => v.lang.toLowerCase().startsWith(idioma.slice(0, 2).toLowerCase())) ?? null;
      for (const frase of trocear(textoDesdeAqui())) {
        if (!vigente()) return;
        await new Promise<void>((ok) => {
          const u = new SpeechSynthesisUtterance(frase);
          u.lang = voice?.lang ?? idioma;
          if (voice) u.voice = voice;
          u.rate = prefsRef.current.rate;
          u.onend = () => ok();
          u.onerror = () => ok();
          synth.speak(u);
        });
      }
      if (!vigente()) return;
      // Al terminar el capítulo, sigue con el siguiente
      const r = rendition.current;
      const href = r?.currentLocation()?.start?.href;
      const sig = href ? epub.current?.spine?.get(href)?.next?.() : null;
      if (!r || !sig) break;
      try {
        await r.display(sig.href);
      } catch {
        break;
      }
      await new Promise((ok) => setTimeout(ok, 400));
    }
    if (gen === vozGen.current) detenerVoz();
  };

  useEffect(() => () => detenerVoz(), [detenerVoz]);

  const commitSlider = () => {
    const b = epub.current;
    if (!b || !ready) return;
    rendition.current?.display(b.locations.cfiFromPercentage(pct));
  };

  /** Busca en todo el libro, capítulo por capítulo, y va mostrando los resultados a medida que aparecen. */
  const runSearch = async (override?: string) => {
    const b = epub.current;
    const term = (override ?? q).trim();
    if (!b || term.length < 2) return;
    const id = ++searchId.current;
    setSearching(true);
    setHits([]);
    const out: Hit[] = [];
    for (const item of b.spine.spineItems) {
      if (id !== searchId.current) return;
      try {
        await item.load(b.load.bind(b));
        const found = item.find(term) as { cfi: string; excerpt: string }[];
        item.unload();
        out.push(...found.map((x) => ({ cfi: x.cfi, excerpt: String(x.excerpt).trim() })));
        setHits([...out]);
        if (out.length >= 300) break;
      } catch {}
    }
    if (id === searchId.current) setSearching(false);
  };

  const t = THEMES[prefs.theme] ?? THEMES.claro;
  return (
    <div className={"reader m-" + prefs.margen + (prefs.scroll ? " modo-scroll" : "")} style={{ ["--rbg" as string]: t.bg, ["--rfg" as string]: t.fg }}>
      <div className="stage" ref={host} />
      {error && <div className="reader-error">{error}</div>}

      <header className={"rbar top" + (chrome ? "" : " hidden")}>
        <button className="rbtn icon-only" onClick={close} aria-label="Volver a la biblioteca" title="Volver a la biblioteca"><AppleIcon name="back" /><span className="reader-mobile-label">Volver</span></button>
        <span className="rtitle">{chapter || book.title}</span>
        {onAdd && <button className="rbtn" onClick={onAdd}>Agregar a la biblioteca</button>}
        <button className="rbtn icon-only" onClick={() => { setTocTab("toc"); setPanel("toc"); }} aria-label="Tabla de contenido" title="Tabla de contenido"><AppleIcon name="contents" /><span className="reader-mobile-label">Contenido</span></button>
        {canReturnToReference && (
          <button className="rbtn reference-back" onClick={() => void returnToReference()} aria-label="Volver a la referencia anterior" aria-keyshortcuts="Alt+ArrowLeft" title="Volver a la referencia anterior (Alt + ←)">
            <AppleIcon name="undo" /><span className="reader-mobile-label">Referencia</span>
          </button>
        )}
        <button className={"rbtn bm" + (marked ? " on" : "")} onClick={toggleBookmark} aria-label={marked ? "Quitar marcador" : "Agregar marcador"} aria-pressed={marked}>
          <AppleIcon name="bookmark" /><span className="reader-mobile-label">{marked ? "★" : "☆"}</span>
        </button>
        <button className="rbtn icon-only" onClick={() => setPanel("search")} aria-label="Buscar en el libro" title="Buscar en el libro"><AppleIcon name="search" /><span className="reader-mobile-label">Buscar</span></button>
        <button className={"rbtn" + (voz ? " on" : "")} onClick={() => (voz ? detenerVoz() : void hablar())} aria-pressed={voz} aria-label="Leer en voz alta" title="Leer en voz alta">{voz ? "Detener" : "Voz"}</button>
        <button className="rbtn aa" onClick={() => setPanel(panel === "look" ? null : "look")} aria-label="Apariencia y texto" title="Apariencia y texto">Aa</button>
      </header>

      <footer className={"rbar bottom" + (chrome ? "" : " hidden")}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={pct}
          style={{ "--p": `${pct * 100}%` } as CSSProperties}
          disabled={!ready}
          aria-label="Progreso de lectura"
          onChange={(e) => setPct(Number(e.target.value))}
          onPointerUp={commitSlider}
          onKeyUp={commitSlider}
        />
        <span className="rpct">{ready ? `${Math.round(pct * 100)} %` : "…"}</span>
      </footer>

      {noteFor !== null && (() => {
        const a = anns.find((x) => x.id === noteFor);
        return <NoteDialog initial={a?.note ?? ""} quote={a?.text ?? ""} onSave={saveNote} onCancel={() => setNoteFor(null)} />;
      })()}

      {sel && (
        <div className="selbar" role="toolbar" aria-label="Resaltar">
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
          {sel.mode === "new" && (
            <>
              <button
                className="selx"
                onClick={() => {
                  const cita = `“${sel.text}”\n— ${book.title}`;
                  navigator.clipboard?.writeText(cita).then(() => {
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 1600);
                  }).catch(() => {});
                }}
              >
                {copiado ? "Copiado" : "Copiar"}
              </button>
              <button
                className="selx"
                onClick={() => {
                  const t = sel.text.slice(0, 80);
                  setQ(t);
                  setSel(null);
                  setPanel("search");
                  void runSearch(t);
                }}
              >
                Buscar
              </button>
            </>
          )}
          <button className="selx" onClick={() => (sel.mode === "new" ? addHighlight("amarillo", true) : (setNoteFor(sel.id), setSel(null)))}>Nota</button>
          {sel.mode === "edit" && (
            <button className="selx" onClick={() => { const a = anns.find((x) => x.id === sel.id); if (a) removeAnn(a); }}>Quitar</button>
          )}
          <button className="selx" onClick={() => setSel(null)} aria-label="Cerrar">✕</button>
        </div>
      )}

      {panel === "look" && (
        <>
          <div className="scrim clear" onClick={() => setPanel(null)} />
          <div className="pop" role="dialog" aria-label="Apariencia y texto">
            <div className="stepper">
              <button onClick={() => setPrefs((p) => ({ ...p, size: clamp(p.size - 10, 70, 220) }))} aria-label="Letra más pequeña">
                <span style={{ fontSize: 14 }}>A</span>
              </button>
              <span>{prefs.size} %</span>
              <button onClick={() => setPrefs((p) => ({ ...p, size: clamp(p.size + 10, 70, 220) }))} aria-label="Letra más grande">
                <span style={{ fontSize: 22 }}>A</span>
              </button>
            </div>
            <div className="themes">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => (
                <button
                  key={id}
                  className={"tswatch" + (prefs.theme === id ? " on" : "")}
                  style={{ background: THEMES[id].bg, color: THEMES[id].fg }}
                  onClick={() => setPrefs((p) => ({ ...p, theme: id }))}
                  aria-label={THEMES[id].label}
                  title={THEMES[id].label}
                >
                  Aa
                </button>
              ))}
            </div>
            <div className="seg col">
              {FONTS.map((f) => (
                <button
                  key={f}
                  className={"fontbtn" + (prefs.font === f ? " on" : "")}
                  style={{ fontFamily: f }}
                  onClick={() => setPrefs((p) => ({ ...p, font: f }))}
                >
                  {f}
                </button>
              ))}
            </div>
            <div>
              <h4 className="pop-h">Interlineado</h4>
              <div className="row">
                {LINES.map((l) => (
                  <button
                    key={l.v}
                    className={prefs.line === l.v ? "on" : ""}
                    onClick={() => setPrefs((p) => ({ ...p, line: l.v }))}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="pop-h">Ancho del texto</h4>
              <div className="row">
                {MARGENES.map((m) => (
                  <button key={m.v} className={prefs.margen === m.v ? "on" : ""} onClick={() => setPrefs((p) => ({ ...p, margen: m.v }))}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="pop-h">Velocidad de la voz</h4>
              <div className="row">
                {VELOCIDADES.map((v) => (
                  <button key={v} className={prefs.rate === v ? "on" : ""} onClick={() => setPrefs((p) => ({ ...p, rate: v }))}>
                    ×{v}
                  </button>
                ))}
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={prefs.scroll} onChange={(e) => setPrefs((p) => ({ ...p, scroll: e.target.checked }))} />
              Desplazamiento continuo
            </label>
            <label className="check">
              <input type="checkbox" checked={prefs.justify} onChange={(e) => setPrefs((p) => ({ ...p, justify: e.target.checked }))} />
              Justificar texto
            </label>
          </div>
        </>
      )}

      {(panel === "toc" || panel === "search") && (
        <>
          <div className="scrim" onClick={() => setPanel(null)} />
          <aside className="side" role="dialog">
            {panel === "toc" ? (
              <>
                <div className="tabs">
                  {([["toc", "Contenido"], ["marks", "Marcadores"], ["notes", "Resaltados"]] as [TocTab, string][]).map(([id, label]) => (
                    <button key={id} className={tocTab === id ? "on" : ""} onClick={() => setTocTab(id)}>{label}</button>
                  ))}
                </div>
                {tocTab === "toc" && (
                  <>
                    {toc.length === 0 && <p className="muted">Este libro no tiene tabla de contenidos.</p>}
                    {toc.map((i, k) => (
                      <button
                        key={k}
                        className="toc-item"
                        style={{ paddingLeft: 16 + i.depth * 18 }}
                        onClick={() => {
                          rendition.current?.display(i.href);
                          setPanel(null);
                        }}
                      >
                        {i.label}
                      </button>
                    ))}
                  </>
                )}
                {tocTab !== "toc" && (() => {
                  const kind = tocTab === "marks" ? "bookmark" : "highlight";
                  const list = anns.filter((a) => a.kind === kind).sort((a, b) => cmpCfi(a.loc, b.loc));
                  return (
                    <>
                      {list.length === 0 && (
                        <p className="muted">
                          {kind === "bookmark" ? "Aún no hay marcadores. Toca ☆ en la barra superior para marcar la página." : "Aún no hay resaltados. Selecciona texto para resaltarlo."}
                        </p>
                      )}
                      {list.map((a) => (
                        <div key={a.id} className="ann">
                          <button
                            className="hit"
                            onClick={() => {
                              rendition.current?.display(a.loc);
                              setPanel(null);
                            }}
                          >
                            {kind === "highlight" && <i className="dot" style={{ background: (HL_COLORS[a.color] ?? HL_COLORS.amarillo).hex }} />}
                            {a.text}
                            {a.note && <span className="ann-note">{a.note}</span>}
                          </button>
                          <button className="ann-del" onClick={() => removeAnn(a)} aria-label="Eliminar">✕</button>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                <h3>Buscar en el libro</h3>
                <form
                  className="search-box"
                  onSubmit={(e) => {
                    e.preventDefault();
                    runSearch();
                  }}
                >
                  <input autoFocus type="search" placeholder="Palabra o frase" value={q} onChange={(e) => setQ(e.target.value)} />
                  <button className="primary" type="submit">Buscar</button>
                </form>
                {searching && <p className="muted">Buscando…</p>}
                {!searching && hits.length === 0 && q.trim().length >= 2 && searchId.current > 0 && (
                  <p className="muted">Sin resultados.</p>
                )}
                {hits.map((h, k) => (
                  <button
                    key={k}
                    className="hit"
                    onClick={() => {
                      rendition.current?.display(h.cfi);
                      setPanel(null);
                    }}
                  >
                    …{h.excerpt}…
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
