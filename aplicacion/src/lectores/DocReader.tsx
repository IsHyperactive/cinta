import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertToHtml } from "../utilidades/convert";
import NoteDialog from "../componentes/NoteDialog";
import { HL_COLORS, type Ann } from "../utilidades/annot";
import Icon from "../componentes/AppleIcon";

type DocBook = { id: number; title: string; author: string | null; path: string; format: string; progressCfi: string | null };

const THEMES = {
  claro: { bg: "#ffffff", fg: "#1b1d22", label: "Claro" },
  sepia: { bg: "#f4ecd8", fg: "#5b4636", label: "Sepia" },
  oscuro: { bg: "#1c1c1e", fg: "#e5e5ea", label: "Oscuro" },
} as const;
type ThemeId = keyof typeof THEMES;
const THEME_IDS = Object.keys(THEMES) as ThemeId[];

type Prefs = { theme: ThemeId; size: number };
function loadPrefs(): Prefs {
  try {
    const o = JSON.parse(localStorage.getItem("cinta.doc") ?? "{}");
    return { theme: o.theme in THEMES ? o.theme : "claro", size: typeof o.size === "number" ? Math.min(32, Math.max(12, o.size)) : 19 };
  } catch {
    return { theme: "claro", size: 19 };
  }
}

type Sel = { mode: "new"; a: number; b: number; text: string } | { mode: "edit"; id: number };
type Head = { text: string; level: number };
type Hit = { a: number; b: number; snippet: string };
type Tab = "toc" | "marks" | "notes";

// Posiciones dentro del documento = desplazamiento en el texto concatenado del <body> (no depende del zoom ni del tema)
const textNodes = (d: Document): Text[] => {
  const out: Text[] = [];
  const w = d.createTreeWalker(d.body, 4 /* NodeFilter.SHOW_TEXT */);
  let n: Node | null;
  while ((n = w.nextNode())) out.push(n as Text);
  return out;
};
const offsetOf = (d: Document, node: Node, off: number): number => {
  const r = d.createRange();
  r.setStart(d.body, 0);
  r.setEnd(node, off);
  return r.toString().length;
};
const rangeFromOffsets = (d: Document, a: number, b: number): Range | null => {
  const nodes = textNodes(d);
  let acc = 0;
  let sn: Text | null = null, so = 0, en: Text | null = null, eo = 0;
  for (const n of nodes) {
    const end = acc + n.length;
    if (!sn && a < end) { sn = n; so = a - acc; }
    if (!en && b <= end) { en = n; eo = b - acc; }
    if (sn && en) break;
    acc = end;
  }
  if (!sn || !en) return null;
  const r = d.createRange();
  r.setStart(sn, Math.max(0, so));
  r.setEnd(en, Math.max(0, eo));
  return r;
};
const unwrapMarks = (d: Document) => {
  d.querySelectorAll("mark[data-ann]").forEach((m) => {
    const p = m.parentNode;
    if (!p) return;
    while (m.firstChild) p.insertBefore(m.firstChild, m);
    p.removeChild(m);
  });
  d.body.normalize();
};
const wrapRange = (d: Document, a: number, b: number, id: number, hex: string, hasNote: boolean) => {
  let acc = 0;
  for (const n of textNodes(d)) {
    const len = n.length;
    const lo = Math.max(a, acc), hi = Math.min(b, acc + len);
    acc += len;
    if (hi <= lo) continue;
    let t: Text = n;
    const s0 = lo - (acc - len), e0 = hi - (acc - len);
    if (e0 < t.length) t.splitText(e0);
    if (s0 > 0) t = t.splitText(s0);
    const m = d.createElement("mark");
    m.setAttribute("data-ann", String(id));
    m.setAttribute("style", `background:${hex}66;color:inherit;border-radius:2px;cursor:pointer;${hasNote ? `border-bottom:2px dotted ${hex};` : ""}`);
    t.parentNode!.insertBefore(m, t);
    m.appendChild(t);
  }
};

const CSS = `
html{background:var(--bg);color:var(--fg)}
body{margin:0 auto;max-width:40em;padding:28px 22px 90px;font:var(--fs)px/1.65 Georgia,"Times New Roman",serif;font-size:calc(var(--fs) * 1px);overflow-wrap:anywhere}
img{max-width:100%;height:auto}img.cover{display:block;margin:0 auto 24px;max-height:70vh}
a{color:inherit}h1,h2,h3{line-height:1.25}h1{font-size:1.6em}h2{font-size:1.35em;margin-top:2em}h3{font-size:1.15em}
p{margin:.9em 0}blockquote{margin:1em 0;padding-left:1em;border-left:3px solid color-mix(in srgb,var(--fg) 30%,transparent)}
.epi{font-style:italic}.ta{text-align:right;font-style:italic}.poem{margin:1.2em 0 1.2em 1.5em}.stanza{margin:1em 0}.v{margin:.1em 0}
hr{border:0;border-top:1px solid color-mix(in srgb,var(--fg) 25%,transparent);margin:2em 0}
table{border-collapse:collapse;max-width:100%}td,th{border:1px solid color-mix(in srgb,var(--fg) 30%,transparent);padding:4px 8px}
pre,code{white-space:pre-wrap}
`;

/** Lector de texto reflowable (TXT, HTML, DOCX, FB2, MOBI/AZW3): temas, tamaño, índice, búsqueda, marcadores y resaltados con notas. */
export default function DocReader({ book, onClose, onAdd }: { book: DocBook; onClose: () => void; onAdd?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState("");
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [pct, setPct] = useState(0);
  const [title, setTitle] = useState(book.title);
  const [loaded, setLoaded] = useState(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const pctRef = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  // anotaciones
  const annKey = book.id < 0 ? `p:${book.path}` : `b:${book.id}`;
  const [anns, setAnns] = useState<Ann[]>([]);
  const annsRef = useRef<Ann[]>([]);
  annsRef.current = anns;
  const [sel, setSel] = useState<Sel | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [panel, setPanel] = useState<"toc" | "search" | null>(null);
  const [tab, setTab] = useState<Tab>("toc");
  const [heads, setHeads] = useState<Head[]>([]);
  const headEls = useRef<HTMLElement[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState(false);
  const suppressSel = useRef(0);

  const doc = () => frame.current?.contentDocument ?? null;
  const scrollEl = () => doc()?.scrollingElement as HTMLElement | null | undefined;
  const fractionOf = (el: HTMLElement) => {
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
  };

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const buf = await invoke<ArrayBuffer>("read_book_file", { id: book.id, path: book.id < 0 ? book.path : null });
        const r = await convertToHtml(book.format, buf);
        if (dead) return;
        if (r.title) setTitle(r.title);
        const t = THEMES[prefsRef.current.theme];
        setSrcDoc(
          `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--bg:${t.bg};--fg:${t.fg};--fs:${prefsRef.current.size}}${CSS}</style></head><body>${r.html || "<p>(Documento vacío)</p>"}</body></html>`
        );
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    invoke<Ann[]>("list_annotations", { key: annKey })
      .then((l) => !dead && setAnns(l.filter((a) => (a.kind === "bookmark" && a.loc.startsWith("s")) || (a.kind === "highlight" && /^o\d+-\d+$/.test(a.loc)))))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [book.id, book.path, book.format, annKey]);

  const save = useCallback(() => {
    invoke("set_progress", { id: book.id, cfi: `s${pctRef.current.toFixed(4)}`, pct: pctRef.current, path: book.id < 0 ? book.path : null }).catch(() => {});
  }, [book.id, book.path]);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    saveRef.current();
  }, []);

  // ---- resaltados: se repintan todos desde cero cuando cambian ----
  useEffect(() => {
    const d = doc();
    if (!d || !loaded) return;
    unwrapMarks(d);
    for (const a of annsRef.current) {
      if (a.kind !== "highlight") continue;
      const m = /^o(\d+)-(\d+)$/.exec(a.loc);
      if (m) wrapRange(d, Number(m[1]), Number(m[2]), a.id, (HL_COLORS[a.color] ?? HL_COLORS.amarillo).hex, !!a.note);
    }
  }, [anns, loaded]);

  const onLoad = () => {
    const d = doc();
    const el = scrollEl();
    if (!d || !el) return;
    const m = /^s([\d.]+)$/.exec(book.progressCfi ?? "");
    const restore = () => {
      if (!m) return;
      el.scrollTop = Number(m[1]) * Math.max(0, el.scrollHeight - el.clientHeight);
    };
    restore();
    window.setTimeout(restore, 400); // las imágenes cambian la altura al cargar
    d.addEventListener("scroll", () => {
      const f = fractionOf(el);
      pctRef.current = f;
      setPct(f);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => saveRef.current(), 800);
    });
    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape") onClose();
    });
    d.addEventListener("click", (e) => {
      if (d.getSelection()?.toString()) return;
      const mk = (e.target as Element | null)?.closest?.("mark[data-ann]");
      if (mk) setSel({ mode: "edit", id: Number(mk.getAttribute("data-ann")) });
    });
    // selección de texto → barra de colores
    let st: number | undefined;
    d.addEventListener("selectionchange", () => {
      window.clearTimeout(st);
      st = window.setTimeout(() => {
        if (Date.now() - suppressSel.current < 800) return;
        const s = d.getSelection();
        if (!s || s.isCollapsed || !s.rangeCount) return setSel((x) => (x && x.mode === "new" ? null : x));
        const r = s.getRangeAt(0);
        const text = s.toString().trim();
        const a = offsetOf(d, r.startContainer, r.startOffset);
        const b = offsetOf(d, r.endContainer, r.endOffset);
        if (text && b > a) setSel({ mode: "new", a, b, text: text.slice(0, 500) });
      }, 250);
    });
    // índice: títulos del documento
    const hs = (Array.from(d.querySelectorAll("h1,h2,h3")) as HTMLElement[]).filter((h) => (h.textContent ?? "").trim());
    headEls.current = hs;
    setHeads(hs.map((h) => ({ text: (h.textContent ?? "").trim().slice(0, 120), level: Number(h.tagName[1]) })));
    if (m) setPct(Number(m[1]));
    setLoaded(true);
  };

  // Tema y tamaño: se cambian las variables sin recargar (no se pierde la posición)
  useEffect(() => {
    try {
      localStorage.setItem("cinta.doc", JSON.stringify(prefs));
    } catch {
      /* sin almacenamiento */
    }
    const root = doc()?.documentElement;
    if (!root) return;
    const el = scrollEl();
    const f = el ? fractionOf(el) : 0;
    const t = THEMES[prefs.theme];
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--fg", t.fg);
    root.style.setProperty("--fs", String(prefs.size));
    if (el) el.scrollTop = f * Math.max(0, el.scrollHeight - el.clientHeight);
  }, [prefs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ---- navegación ----
  const goOffset = (a: number, b: number, select: boolean) => {
    const d = doc();
    if (!d) return;
    const r = rangeFromOffsets(d, a, b);
    if (!r) return;
    if (select) {
      suppressSel.current = Date.now();
      const s = d.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    }
    r.startContainer.parentElement?.scrollIntoView({ block: "center" });
    setPanel(null);
  };

  // ---- marcadores (posición en la página; se marca lo que está en pantalla) ----
  const bookmarksHere = () => {
    const el = scrollEl();
    if (!el || !el.scrollHeight) return [] as Ann[];
    const lo = el.scrollTop / el.scrollHeight, hi = (el.scrollTop + el.clientHeight) / el.scrollHeight;
    return annsRef.current.filter((a) => a.kind === "bookmark" && Number(a.loc.slice(1)) >= lo - 0.0005 && Number(a.loc.slice(1)) <= hi);
  };
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    setMarked(bookmarksHere().length > 0);
  }, [anns, pct]);
  const toggleBookmark = async () => {
    const el = scrollEl();
    if (!el) return;
    const here = bookmarksHere();
    if (here.length) {
      for (const a of here) await invoke("delete_annotation", { id: a.id }).catch(() => {});
      setAnns((l) => l.filter((x) => !here.some((h) => h.id === x.id)));
      return;
    }
    const loc = `s${(el.scrollTop / Math.max(1, el.scrollHeight)).toFixed(4)}`;
    const head = [...headEls.current].reverse().find((h) => h.getBoundingClientRect().top <= 4);
    const text = `${head?.textContent?.trim().slice(0, 80) || title} · ${Math.round(pctRef.current * 100)} %`;
    const id = await invoke<number>("add_annotation", { key: annKey, kind: "bookmark", loc, text, color: "amarillo", note: "" }).catch(() => null);
    if (id !== null) setAnns((l) => [...l, { id, kind: "bookmark", loc, text, color: "amarillo", note: "", created: Date.now() / 1000 }]);
  };

  // ---- resaltados y notas ----
  const clearSelection = () => doc()?.getSelection()?.removeAllRanges();
  const addHighlight = async (color: string, thenNote = false) => {
    if (!sel || sel.mode !== "new") return;
    const loc = `o${sel.a}-${sel.b}`;
    const id = await invoke<number>("add_annotation", { key: annKey, kind: "highlight", loc, text: sel.text, color, note: "" }).catch(() => null);
    if (id === null) return;
    setAnns((l) => [...l, { id, kind: "highlight", loc, text: sel.text, color, note: "", created: Date.now() / 1000 }]);
    clearSelection();
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

  // ---- búsqueda ----
  const runSearch = () => {
    const d = doc();
    const query = q.trim();
    if (!d || query.length < 2) return;
    const full = textNodes(d).map((n) => n.data).join("");
    const hay = full.toLowerCase().length === full.length ? full.toLowerCase() : full;
    const needle = hay === full ? query : query.toLowerCase();
    const out: Hit[] = [];
    let at = hay.indexOf(needle);
    while (at !== -1 && out.length < 300) {
      out.push({ a: at, b: at + needle.length, snippet: full.slice(Math.max(0, at - 40), at + needle.length + 60).replace(/\s+/g, " ") });
      at = hay.indexOf(needle, at + needle.length);
    }
    setHits(out);
    setSearched(true);
  };

  const t = THEMES[prefs.theme];
  const bookmarks = anns.filter((a) => a.kind === "bookmark").sort((x, y) => Number(x.loc.slice(1)) - Number(y.loc.slice(1)));
  const notes = anns
    .filter((a) => a.kind === "highlight")
    .map((a) => ({ a, at: Number(/^o(\d+)/.exec(a.loc)?.[1] ?? 0) }))
    .sort((x, y) => x.at - y.at);

  return (
    <div className="reader docr" style={{ background: t.bg, color: t.fg }} role="dialog" aria-label={title}>
      <header className="rbar top">
        <button className="rbtn icon-only" onClick={onClose} aria-label="Volver" title="Volver"><Icon name="back" /><span className="reader-mobile-label">Volver</span></button>
        <span className="rtitle">{title}</span>
        {onAdd && <button className="rbtn" onClick={onAdd}>Agregar a la biblioteca</button>}
        <button className="rbtn icon-only" onClick={() => setPanel("toc")} aria-label="Contenido" title="Contenido"><Icon name="contents" /><span className="reader-mobile-label">Contenido</span></button>
        <button className="rbtn icon-only" onClick={() => setPanel("search")} aria-label="Buscar" title="Buscar"><Icon name="search" /><span className="reader-mobile-label">Buscar</span></button>
        <button className={"rbtn bm" + (marked ? " on" : "")} onClick={toggleBookmark} aria-pressed={marked} aria-label={marked ? "Quitar marcador" : "Agregar marcador"}>
          <Icon name="bookmark" /><span className="reader-mobile-label">{marked ? "★" : "☆"}</span>
        </button>
        <button className="rbtn" onClick={() => setPrefs((p) => ({ ...p, size: Math.max(12, p.size - 2) }))} aria-label="Letra más pequeña">A−</button>
        <button className="rbtn" onClick={() => setPrefs((p) => ({ ...p, size: Math.min(32, p.size + 2) }))} aria-label="Letra más grande">A+</button>
        <button
          className="rbtn"
          onClick={() => setPrefs((p) => ({ ...p, theme: THEME_IDS[(THEME_IDS.indexOf(p.theme) + 1) % THEME_IDS.length] }))}
          aria-label="Cambiar tema"
        >
          {t.label}
        </button>
      </header>

      {error ? (
        <div className="reader-error">{error}</div>
      ) : !srcDoc ? (
        <div className="reader-error">Abriendo…</div>
      ) : (
        <iframe ref={frame} className="doc-frame" title={title} sandbox="allow-same-origin" srcDoc={srcDoc} onLoad={onLoad} />
      )}

      <footer className="rbar bottom">
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(pct * 1000)}
          style={{ "--p": `${pct * 100}%` } as CSSProperties}
          aria-label="Progreso de lectura"
          onChange={(e) => {
            const el = scrollEl();
            const f = Number(e.target.value) / 1000;
            if (el) el.scrollTop = f * Math.max(0, el.scrollHeight - el.clientHeight);
            setPct(f);
          }}
        />
        <span className="rpct">{Math.round(pct * 100)} %</span>
      </footer>

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
          <button className="selx" onClick={() => { clearSelection(); setSel(null); }} aria-label="Cerrar">✕</button>
        </div>
      )}

      {panel && (
        <>
          <div className="scrim" onClick={() => setPanel(null)} />
          <aside className="side" role="dialog">
            {panel === "toc" ? (
              <>
                <div className="tabs">
                  {([["toc", "Contenido"], ["marks", "Marcadores"], ["notes", "Resaltados"]] as [Tab, string][]).map(([id, label]) => (
                    <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
                  ))}
                </div>
                {tab === "toc" && (
                  <>
                    {heads.length === 0 && <p className="muted">Este documento no tiene títulos para armar un índice.</p>}
                    {heads.map((h, k) => (
                      <button
                        key={k}
                        className="toc-item"
                        style={{ paddingLeft: 16 + (h.level - 1) * 18 }}
                        onClick={() => {
                          headEls.current[k]?.scrollIntoView({ block: "start" });
                          setPanel(null);
                        }}
                      >
                        {h.text}
                      </button>
                    ))}
                  </>
                )}
                {tab === "marks" && (
                  <>
                    {bookmarks.length === 0 && <p className="muted">Aún no hay marcadores. Toca ☆ en la barra superior para marcar lo que ves en pantalla.</p>}
                    {bookmarks.map((a) => (
                      <div key={a.id} className="ann">
                        <button
                          className="hit"
                          onClick={() => {
                            const el = scrollEl();
                            if (el) el.scrollTop = Number(a.loc.slice(1)) * el.scrollHeight;
                            setPanel(null);
                          }}
                        >
                          {a.text}
                        </button>
                        <button className="ann-del" onClick={() => removeAnn(a)} aria-label="Eliminar">✕</button>
                      </div>
                    ))}
                  </>
                )}
                {tab === "notes" && (
                  <>
                    {notes.length === 0 && <p className="muted">Aún no hay resaltados. Selecciona texto para resaltarlo o añadirle una nota.</p>}
                    {notes.map(({ a }) => {
                      const m = /^o(\d+)-(\d+)$/.exec(a.loc)!;
                      return (
                        <div key={a.id} className="ann">
                          <button className="hit" onClick={() => goOffset(Number(m[1]), Number(m[2]), false)}>
                            <i className="dot" style={{ background: (HL_COLORS[a.color] ?? HL_COLORS.amarillo).hex }} />
                            {a.text}
                            {a.note && <span className="ann-note">{a.note}</span>}
                          </button>
                          <button className="ann-del" onClick={() => removeAnn(a)} aria-label="Eliminar">✕</button>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            ) : (
              <>
                <h3>Buscar en el documento</h3>
                <form className="search-box" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
                  <input autoFocus type="search" placeholder="Palabra o frase" value={q} onChange={(e) => setQ(e.target.value)} />
                  <button className="primary" type="submit">Buscar</button>
                </form>
                {searched && hits.length === 0 && <p className="muted">Sin resultados.</p>}
                {hits.map((h, k) => (
                  <button key={k} className="hit" onClick={() => goOffset(h.a, h.b, true)}>…{h.snippet.trim()}…</button>
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
