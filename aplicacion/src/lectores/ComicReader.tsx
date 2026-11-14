import { crearGestoRueda } from "../utilidades/gestos";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import JSZip from "jszip";
import Icon from "../componentes/AppleIcon";

type ComicBook = { id: number; title: string; path: string; format: string; progressCfi: string | null };
type Page = { name: string; entry: JSZip.JSZipObject };

const IMG = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif", bmp: "image/bmp" };
const natural = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** Lector de cómics CBZ (y CBR que en realidad sean ZIP): una página a la vez, ajuste, modo manga y progreso. */
export default function ComicReader({ book, onClose, onAdd }: { book: ComicBook; onClose: () => void; onAdd?: () => void }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [i, setI] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [fit, setFit] = useState<"alto" | "ancho">(() => (localStorage.getItem("cinta.comic.fit") === "ancho" ? "ancho" : "alto"));
  const [rtl, setRtl] = useState(() => localStorage.getItem("cinta.comic.rtl") === "1");
  const [chrome, setChrome] = useState(true);
  const cache = useRef(new Map<number, string>());

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const buf = await invoke<ArrayBuffer>("read_book_file", { id: book.id, path: book.id < 0 ? book.path : null });
        const head = new Uint8Array(buf.slice(0, 4));
        if (head[0] === 0x52 && head[1] === 0x61 && head[2] === 0x72) throw new Error("Este CBR es un archivo RAR, que aún no se puede leer. Conviértelo a CBZ (ZIP) y vuelve a abrirlo.");
        const zip = await JSZip.loadAsync(buf);
        const list = Object.values(zip.files)
          .filter((f) => !f.dir && IMG.test(f.name) && !f.name.includes("__MACOSX"))
          .sort((a, b) => natural.compare(a.name, b.name))
          .map((f) => ({ name: f.name, entry: f }));
        if (!list.length) throw new Error("No se encontraron páginas en este archivo.");
        if (dead) return;
        setPages(list);
        const m = /^p(\d+)$/.exec(book.progressCfi ?? "");
        if (m) setI(Math.min(list.length - 1, Number(m[1])));
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : "No se pudo abrir el archivo (¿está dañado?).");
      }
    })();
    const c = cache.current;
    return () => {
      dead = true;
      c.forEach((u) => URL.revokeObjectURL(u));
      c.clear();
    };
  }, [book.id, book.path]);

  const blobFor = useCallback(
    async (idx: number): Promise<string> => {
      const hit = cache.current.get(idx);
      if (hit) return hit;
      const p = pages[idx];
      const ext = p.name.split(".").pop()!.toLowerCase();
      const b = await p.entry.async("blob");
      const u = URL.createObjectURL(new Blob([b], { type: MIME[ext] ?? "image/jpeg" }));
      cache.current.set(idx, u);
      return u;
    },
    [pages]
  );

  // Muestra la página actual y precarga la siguiente; libera las lejanas
  useEffect(() => {
    if (!pages.length) return;
    let dead = false;
    blobFor(i).then((u) => !dead && setUrl(u)).catch(() => !dead && setError("No se pudo leer esta página."));
    if (i + 1 < pages.length) blobFor(i + 1).catch(() => {});
    cache.current.forEach((u, k) => {
      if (Math.abs(k - i) > 3) {
        URL.revokeObjectURL(u);
        cache.current.delete(k);
      }
    });
    return () => {
      dead = true;
    };
  }, [i, pages, blobFor]);

  // Progreso
  useEffect(() => {
    if (!pages.length) return;
    const t = window.setTimeout(() => {
      invoke("set_progress", { id: book.id, cfi: `p${i}`, pct: (i + 1) / pages.length, path: book.id < 0 ? book.path : null }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(t);
  }, [i, pages.length, book.id, book.path]);

  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(pages.length - 1, x + d))), [pages.length]);
  const next = () => go(rtl ? -1 : 1);
  const prev = () => go(rtl ? 1 : -1);

  // Dos dedos en el touchpad de lado: página siguiente / anterior (respeta el modo manga)
  const goRef = useRef(go);
  goRef.current = go;
  const rtlRef = useRef(rtl);
  rtlRef.current = rtl;
  useEffect(() => {
    const h = crearGestoRueda((dir) => goRef.current(rtlRef.current ? -dir : dir));
    window.addEventListener("wheel", h, { passive: false });
    return () => window.removeEventListener("wheel", h);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") (rtl ? go(-1) : go(1));
      else if (e.key === "ArrowLeft") (rtl ? go(1) : go(-1));
      else if (e.key === "PageDown" || e.key === " ") go(1);
      else if (e.key === "PageUp") go(-1);
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(pages.length - 1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, rtl, pages.length, onClose]);

  const setPref = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* sin almacenamiento */
    }
  };

  return (
    <div className="reader comicr" role="dialog" aria-label={book.title}>
      <div
        className={"comic-stage fit-" + fit}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          if (x < 0.25) prev();
          else if (x > 0.75) next();
          else setChrome((c) => !c);
        }}
      >
        {error ? <div className="reader-error">{error}</div> : url ? <img src={url} alt={`Página ${i + 1}`} draggable={false} /> : <div className="reader-error">Abriendo…</div>}
      </div>

      <header className={"rbar top" + (chrome ? "" : " hidden")}>
        <button className="rbtn icon-only" onClick={onClose} aria-label="Volver" title="Volver"><Icon name="back" /><span className="reader-mobile-label">Volver</span></button>
        <span className="rtitle">{book.title}</span>
        {onAdd && <button className="rbtn" onClick={onAdd}>Agregar a la biblioteca</button>}
        <button className="rbtn" onClick={() => { const v = fit === "alto" ? "ancho" : "alto"; setFit(v); setPref("cinta.comic.fit", v); }}>
          Ajuste: {fit === "alto" ? "alto" : "ancho"}
        </button>
        <button className={"rbtn" + (rtl ? " on" : "")} aria-pressed={rtl} onClick={() => { setRtl(!rtl); setPref("cinta.comic.rtl", rtl ? "0" : "1"); }}>
          Manga ←
        </button>
      </header>

      <footer className={"rbar bottom" + (chrome ? "" : " hidden")}>
        <input
          type="range"
          min={1}
          max={Math.max(1, pages.length)}
          value={i + 1}
          style={{ "--p": `${pages.length > 1 ? (i / (pages.length - 1)) * 100 : 0}%`, "--dir": rtl ? "to left" : "to right", ...(rtl ? { direction: "rtl" } : {}) } as CSSProperties}
          aria-label="Página"
          onChange={(e) => setI(Number(e.target.value) - 1)}
        />
        <span className="rpct">{pages.length ? `${i + 1} / ${pages.length}` : "…"}</span>
      </footer>
    </div>
  );
}
