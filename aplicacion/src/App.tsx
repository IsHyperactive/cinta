import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { extractPdfInfo } from "./utilidades/pdf";
import Reader from "./lectores/Reader";
import PdfReader from "./lectores/PdfReader";
import AudioPlayer from "./lectores/AudioPlayer";
import DocReader from "./lectores/DocReader";
import ComicReader from "./lectores/ComicReader";
import Icon from "./componentes/AppleIcon";
import Notas from "./vistas/Notas";
import EditarLibro from "./componentes/EditarLibro";
import CopiaSeguridad from "./componentes/CopiaSeguridad";
import Apariencia from "./componentes/Apariencia";
import MetaLectura from "./componentes/MetaLectura";
import { cargarRegistro, estadisticasLibro, registrarSegundos } from "./utilidades/metas";
import "./estilos/styles.css";

type Book = {
  id: number;
  title: string;
  author: string | null;
  path: string;
  format: string;
  addedAt: number;
  coverMime: string | null;
  collectionIds: number[];
  progressCfi: string | null;
  progressPct: number;
  lastReadAt: number;
  want: boolean;
  missing: boolean;
  series: string | null;
  seriesIndex: number | null;
};
type Collection = { id: number; name: string };
// "home" | "want" | "done" | "books" | "audio" | "pdf" | "c:<id>"
type Filter = string;
type Sort = "recent" | "title" | "author" | "read" | "progress" | "series";
type View = "grid" | "list";

// Mantener sincronizado con SUPPORTED en aplicacion/src-tauri/src/lib.rs
const EXTENSIONS = [
  "epub", "pdf", "mobi", "azw3", "fb2", "cbz", "cbr",
  "txt", "html", "docx", "m4b", "m4a", "mp3", "ibooks",
];

const AUDIO = ["m4b", "m4a", "mp3"];
const DOCS = ["txt", "html", "docx", "fb2", "mobi", "azw3"];
const COMICS = ["cbz", "cbr"];
const READABLE = ["epub", "pdf", ...AUDIO, ...DOCS, ...COMICS];
const NAV_TOP = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "reading", label: "Leyendo", icon: "reading" },
  { id: "want", label: "Quiero leer", icon: "want" },
  { id: "done", label: "Terminados", icon: "done" },
  { id: "notes", label: "Notas", icon: "notes" },
];
const NAV_LIB = [
  { id: "books", label: "Libros", icon: "books" },
  { id: "audio", label: "Audiolibros", icon: "audio" },
  { id: "pdf", label: "PDF", icon: "pdf" },
];
const TITLES: Record<string, string> = Object.fromEntries([...NAV_TOP, ...NAV_LIB].map((n) => [n.id, n.label]));

// Iconografía de biblioteca: trazos monolineales, proporciones y remates coherentes.
function loadSort(): Sort {
  try {
    const v = localStorage.getItem("cinta.sort");
    if (v === "title" || v === "author" || v === "read" || v === "progress" || v === "series") return v;
  } catch {}
  return "recent";
}

function coverHue(title: string) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

type CoverImg = { url: string; ratio: number };
const coverCache = new Map<number, CoverImg>();

/** Decodifica la portada y la reduce a ~640 px de alto (rápido y nítido en pantallas de alta densidad). */
// Máximo 3 portadas decodificándose a la vez: la biblioteca grande no congela la interfaz
let coverActive = 0;
const coverWaiters: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (coverActive >= 3) await new Promise<void>((r) => coverWaiters.push(r));
  coverActive++;
  try {
    return await fn();
  } finally {
    coverActive--;
    coverWaiters.shift()?.();
  }
}

async function loadCover(id: number, mime: string): Promise<CoverImg> {
  const buf = await invoke<ArrayBuffer>("get_cover", { id });
  const blob = new Blob([buf], { type: mime });
  try {
    const bmp = await createImageBitmap(blob);
    const ratio = bmp.width / bmp.height;
    if (bmp.height <= 700) {
      bmp.close();
      return { url: URL.createObjectURL(blob), ratio };
    }
    const h = 640;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(h * ratio));
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const small = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.9));
    return { url: URL.createObjectURL(small ?? blob), ratio };
  } catch {
    return { url: URL.createObjectURL(blob), ratio: 2 / 3 };
  }
}

/** Portada al estilo de Apple Books: respeta la proporción real, apoyada abajo, con lomo y sombra suave. */
function loadView(): View {
  try {
    if (localStorage.getItem("cinta.view") === "list") return "list";
  } catch {}
  return "grid";
}

const FORMAT_NAMES: Record<string, string> = {
  epub: "EPUB", pdf: "PDF", mobi: "MOBI", azw3: "AZW3", fb2: "FB2", cbz: "Cómic CBZ", cbr: "Cómic CBR",
  txt: "Texto", html: "HTML", docx: "Word", m4b: "Audiolibro M4B", m4a: "Audiolibro M4A", mp3: "Audiolibro MP3", ibooks: "iBooks",
};
const fmtDate = (secs: number) => (secs > 0 ? new Date(secs * 1000).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "—");

// Al cambiar la portada se sube la versión para que la tarjeta vuelva a cargarla
const coverVer = new Map<number, number>();
function Cover({ book }: { book: Book }) {
  return <CoverInner key={coverVer.get(book.id) ?? 0} book={book} />;
}

function CoverInner({ book }: { book: Book }) {
  const [img, setImg] = useState<CoverImg | null>(coverCache.get(book.id) ?? null);
  const slot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(coverCache.has(book.id));

  // La portada solo se carga cuando está cerca de la pantalla
  useEffect(() => {
    if (near || !book.coverMime) return;
    const el = slot.current;
    if (!el || typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near, book.coverMime]);

  useEffect(() => {
    if (!book.coverMime || !near) return;
    const cached = coverCache.get(book.id);
    if (cached) return setImg(cached);
    let alive = true;
    limited(() => loadCover(book.id, book.coverMime!))
      .then((c) => {
        coverCache.set(book.id, c);
        if (alive) setImg(c);
      })
      .catch(() => {
        /* sin portada legible: se queda la portada generada */
      });
    return () => {
      alive = false;
    };
  }, [book.id, book.coverMime, near]);

  const badge = book.format !== "epub" ? <span className="badge">{book.format}</span> : null;

  return (
    <div className="cover-slot" ref={slot} title={book.path}>
      {img ? (
        <div
          className="cover real"
          style={{ aspectRatio: String(img.ratio), [img.ratio >= 2 / 3 ? "width" : "height"]: "100%" }}
        >
          <img src={img.url} alt="" draggable={false} />
          {badge}
        </div>
      ) : (
        <div className="cover" style={{ ["--hue" as string]: coverHue(book.title) }}>
          <span className="cover-title">{book.title}</span>
          {badge}
        </div>
      )}
    </div>
  );
}

const serieTexto = (b: { series: string | null; seriesIndex: number | null }) =>
  b.series ? `${b.series}${b.seriesIndex != null ? ` · n.º ${b.seriesIndex}` : ""}` : "";

const fmtTiempo = (seg: number) => {
  const min = Math.round(seg / 60);
  if (min < 1) return seg > 0 ? "menos de 1 min" : "—";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
};

function progressLabel(pct: number) {
  if (pct >= 0.99) return "Terminado";
  if (pct > 0) return `${Math.round(pct * 100)} %`;
  return "";
}

function BookCard({ book, onOpen, onMenu }: { book: Book; onOpen: () => void; onMenu: () => void }) {
  const label = book.missing ? "" : progressLabel(book.progressPct);
  return (
    <article
      className={"book" + (book.missing ? " missing" : "")}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu();
      }}
    >
      <button className="cover-btn" onClick={onOpen} aria-label={`Abrir ${book.title}`}>
        <Cover book={book} />
      </button>
      <div className="meta">
        <div className="titles">
          <span className="name">{book.title}</span>
          {book.author && <span className="author">{book.author}</span>}
          {book.series && <span className="author serie">{serieTexto(book)}</span>}
          {book.missing && <span className="author lost">Archivo no encontrado</span>}
          {label && <span className="author prog">{label}</span>}
        </div>
        <button className="more" onClick={onMenu} aria-label={`Opciones de ${book.title}`}>
          ⋯
        </button>
      </div>
    </article>
  );
}

/** Fila de la vista de lista: portada pequeña, título, autor, formato y progreso. */
function BookRow({ book, onOpen, onMenu }: { book: Book; onOpen: () => void; onMenu: () => void }) {
  const label = book.missing ? "Archivo no encontrado" : progressLabel(book.progressPct);
  return (
    <div
      className={"row" + (book.missing ? " missing" : "")}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu();
      }}
    >
      <button className="row-main" onClick={onOpen} aria-label={`Abrir ${book.title}`}>
        <span className="row-cover">
          <Cover book={book} />
        </span>
        <span className="row-text">
          <span className="name">{book.title}</span>
          <span className="author">{book.author ?? "Autor desconocido"}{book.series ? ` · ${serieTexto(book)}` : ""}</span>
        </span>
        <span className="row-fmt">{FORMAT_NAMES[book.format] ?? book.format.toUpperCase()}</span>
        <span className="row-prog">
          {!book.missing && book.progressPct > 0 && book.progressPct < 0.99 && (
            <i className="bar"><b style={{ width: `${Math.round(book.progressPct * 100)}%` }} /></i>
          )}
          {label}
        </span>
        <span className="row-date">{fmtDate(book.addedAt)}</span>
      </button>
      <button className="more" onClick={onMenu} aria-label={`Opciones de ${book.title}`}>
        ⋯
      </button>
    </div>
  );
}

/** Detalle del libro: portada grande, datos y acciones rápidas. */
function BookDetail({
  book,
  collections,
  onClose,
  onOpen,
  onWant,
  onCollection,
}: {
  book: Book;
  collections: Collection[];
  onClose: () => void;
  onOpen: () => void;
  onWant: () => void;
  onCollection: (cid: number) => void;
}) {
  const pct = Math.round(book.progressPct * 100);
  const done = book.progressPct >= 0.99;
  const isAudio = AUDIO.includes(book.format);
  const est = estadisticasLibro(book.id);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="detail" role="dialog" aria-label={`Detalles de ${book.title}`}>
        <button className="detail-x" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className="detail-cover">
          <Cover book={book} />
        </div>
        <div className="detail-body">
          <h2>{book.title}</h2>
          <p className="detail-author">{book.author ?? "Autor desconocido"}</p>
          <div className="detail-actions">
            <button className="primary" onClick={onOpen} disabled={book.missing}>
              {isAudio ? "Escuchar" : done ? "Leer de nuevo" : book.progressPct > 0 ? "Continuar" : "Leer"}
            </button>
            <button className="secondary" onClick={onWant} aria-pressed={book.want}>
              {book.want ? "✓ Quiero leer" : "Quiero leer"}
            </button>
          </div>
          {book.missing && <p className="muted lost">Archivo no encontrado. Usa ⋯ → «Localizar archivo…».</p>}
          {book.progressPct > 0 && (
            <div className="detail-prog" aria-label={`Progreso ${pct} %`}>
              <i className="bar"><b style={{ width: `${pct}%` }} /></i>
              <span>{done ? "Terminado" : `${pct} % leído`}</span>
            </div>
          )}
          <dl className="detail-info">
            <dt>Formato</dt><dd>{FORMAT_NAMES[book.format] ?? book.format.toUpperCase()}</dd>
            <dt>Agregado</dt><dd>{fmtDate(book.addedAt)}</dd>
            {book.series && (<><dt>Serie</dt><dd>{serieTexto(book)}</dd></>)}
            <dt>Última lectura</dt><dd>{fmtDate(book.lastReadAt)}</dd>
            <dt>Tiempo de lectura</dt><dd>{fmtTiempo(est.seg)}{est.dias > 0 ? ` en ${est.dias} ${est.dias === 1 ? "día" : "días"}` : ""}</dd>
            <dt>Ubicación</dt><dd className="path">{book.path}</dd>
          </dl>
          {collections.length > 0 && (
            <>
              <h4>Colecciones</h4>
              <div className="detail-cols">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    className={"chip" + (book.collectionIds.includes(c.id) ? " on" : "")}
                    aria-pressed={book.collectionIds.includes(c.id)}
                    onClick={() => onCollection(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const SHORTCUTS: [string, [string, string][]][] = [
  ["Biblioteca", [
    ["Ctrl + F  o  /", "Buscar"],
    ["Ctrl + O", "Agregar libros"],
    ["Ctrl + Mayús + O", "Abrir un archivo sin agregarlo"],
    ["Ctrl + Mayús + A", "Agregar una carpeta"],
    ["Ctrl + 1 … 6", "Inicio, Quiero leer, Terminados, Libros, Audiolibros, PDF"],
    ["Alt + 1 / Alt + 2", "Vista de cuadrícula / de lista"],
    ["Ctrl + ,", "Apariencia: temas de color y fondo"],
    ["F1  o  ?", "Mostrar esta ayuda"],
    ["Esc", "Cerrar ventana o menú"],
  ]],
  ["Lectores EPUB, PDF y texto", [
    ["← →  /  Re Pág Av Pág", "Cambiar de página o desplazar"],
    ["Esc", "Volver a la biblioteca"],
  ]],
  ["Audiolibros", [
    ["Espacio", "Reproducir / pausar"],
    ["←  /  →", "Retroceder 15 s / adelantar 30 s"],
    ["Teclas multimedia", "Reproducir, pausar, saltar"],
  ]],
  ["Cómics", [
    ["← →  /  Re Pág Av Pág", "Página anterior / siguiente (invertido en modo manga)"],
    ["Inicio / Fin", "Primera / última página"],
  ]],
];

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="detail help" role="dialog" aria-label="Atajos de teclado">
        <button className="detail-x" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className="help-body">
          <h2>Atajos de teclado</h2>
          {SHORTCUTS.map(([group, rows]) => (
            <section key={group}>
              <h4>{group}</h4>
              <dl className="detail-info">
                {rows.map(([k, d]) => (
                  <div key={k} className="help-row">
                    <dt><kbd>{k}</kbd></dt>
                    <dd>{d}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

/** Estante horizontal con título y "Ver todo", como en la pantalla de inicio de Apple Books. */
function Shelf({
  title,
  books,
  onAll,
  onOpen,
  onMenu,
}: {
  title: string;
  books: Book[];
  onAll?: () => void;
  onOpen: (b: Book) => void;
  onMenu: (b: Book) => void;
}) {
  if (!books.length) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>{title}</h2>
        {onAll && (
          <button className="link" onClick={onAll}>
            Ver todo ›
          </button>
        )}
      </div>
      <div className="shelf-row">
        {books.map((b) => (
          <BookCard key={b.id} book={b} onOpen={() => onOpen(b)} onMenu={() => onMenu(b)} />
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filter, setFilter] = useState<Filter>("home");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(loadSort);
  const [notice, setNotice] = useState("");
  const [newCol, setNewCol] = useState<string | null>(null); // null = campo oculto
  const [reading, setReading] = useState<Book | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [view, setView] = useState<View>(loadView);
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [aparienciaOpen, setAparienciaOpen] = useState(false);
  const [metaVer, setMetaVer] = useState(0);

  // Registro de lectura guardado en la base de datos (0.6.0)
  useEffect(() => {
    void cargarRegistro().then(() => setMetaVer((v) => v + 1));
  }, []);

  // Tiempo de lectura para la meta diaria: cada 15 s con un libro abierto, la ventana visible y en primer plano
  useEffect(() => {
    if (!reading) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) registrarSegundos(15, reading.id);
    }, 15000);
    return () => {
      clearInterval(t);
      setMetaVer((v) => v + 1);
    };
  }, [reading?.id]);

  const refresh = useCallback(async () => {
    try {
      setBooks(await invoke<Book[]>("list_books"));
      setCollections(await invoke<Collection[]>("list_collections"));
    } catch (e) {
      setNotice(`No se pudo leer la biblioteca: ${e}`);
    }
  }, []);

  const addPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return;
      try {
        const added = await invoke<number>("add_books", { paths });
        setNotice(
          added
            ? `${added} ${added === 1 ? "libro agregado" : "libros agregados"}`
            : "No se encontraron libros nuevos en esa selección"
        );
      } catch (e) {
        setNotice(`No se pudo agregar: ${e}`);
      }
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);


  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === "drop") addPaths(e.payload.paths);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addPaths]);

  // Portadas y metadatos de PDF: uno a la vez, en segundo plano
  const attempted = useRef(new Set<number>());
  const busy = useRef(false);
  useEffect(() => {
    if (busy.current) return;
    const next = books.find((b) => b.format === "pdf" && !b.coverMime && !attempted.current.has(b.id));
    if (!next) return;
    busy.current = true;
    attempted.current.add(next.id);
    extractPdfInfo(next.id)
      .then((i) =>
        invoke("set_book_info", { id: next.id, title: i.title, author: i.author, coverBase64: i.cover })
      )
      .catch(() => {})
      .finally(async () => {
        busy.current = false;
        await refresh();
      });
  }, [books, refresh]);

  const pickFiles = async () => {
    const sel = await open({ multiple: true, filters: [{ name: "Libros", extensions: EXTENSIONS }] });
    if (Array.isArray(sel)) addPaths(sel);
  };

  const pickFolder = async () => {
    const sel = await open({ directory: true });
    if (typeof sel === "string") addPaths([sel]);
  };

  const remove = async (id: number) => {
    try {
      await invoke("remove_book", { id });
    } catch (e) {
      setNotice(`No se pudo eliminar: ${e}`);
    }
    await refresh();
  };

  const createCollection = async () => {
    const name = (newCol ?? "").trim();
    setNewCol(null);
    if (!name) return;
    try {
      await invoke("create_collection", { name });
      await refresh();
    } catch (e) {
      setNotice(String(e));
    }
  };

  const deleteCollection = async (c: Collection) => {
    await invoke("delete_collection", { id: c.id });
    if (filter === `c:${c.id}`) setFilter("home");
    await refresh();
  };

  const toggleCollection = async (book: Book, collectionId: number) => {
    const member = !book.collectionIds.includes(collectionId);
    await invoke("set_book_collection", { bookId: book.id, collectionId, member });
    await refresh();
  };

  const relink = async (book: Book) => {
    const sel = await open({ multiple: false, filters: [{ name: "Libros", extensions: EXTENSIONS }] });
    if (typeof sel !== "string") return;
    try {
      await invoke("relink_book", { id: book.id, path: sel });
      setNotice("Archivo localizado");
      setMenuId(null);
      await refresh();
    } catch (e) {
      setNotice(String(e));
    }
  };

  const toggleWant = async (book: Book) => {
    await invoke("set_want", { id: book.id, want: !book.want });
    await refresh();
  };

  /** Marca un libro como terminado (100 %) o como no leído (0 %, sin posición). */
  const markRead = async (book: Book, done: boolean) => {
    try {
      await invoke("set_progress", { id: book.id, cfi: done ? book.progressCfi ?? "" : "", pct: done ? 1 : 0, path: null });
      await refresh();
      setNotice(done ? "Marcado como terminado" : "Marcado como no leído");
    } catch (e) {
      setNotice(`No se pudo actualizar: ${e}`);
    }
    setMenuId(null);
  };

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem("cinta.view", v);
    } catch {}
  };

  const changeSort = (v: Sort) => {
    setSort(v);
    try {
      localStorage.setItem("cinta.sort", v);
    } catch {}
  };

  /** Abre un archivo directamente desde su ubicación, SIN agregarlo a la biblioteca (no se copia; sí se guarda por ruta la posición, los marcadores, resaltados, notas y trazos). */
  const openExternal = useCallback(async (path: string) => {
    const name = path.split(/[\\/]/).pop() ?? path;
    const dot = name.lastIndexOf(".");
    const format = (dot > 0 ? name.slice(dot + 1) : "").toLowerCase();
    if (!READABLE.includes(format)) {
      setNotice(`El lector de ${format.toUpperCase()} llegará en una fase próxima`);
      return;
    }
    // Se recuerda la posición por ruta aunque el libro no esté en la biblioteca
    const prog = await invoke<{ cfi: string; pct: number } | null>("get_external_progress", { path }).catch(() => null);
    setReading({
      id: -1, title: dot > 0 ? name.slice(0, dot) : name, author: null, path, format,
      addedAt: 0, coverMime: null, collectionIds: [], progressCfi: prog?.cfi ?? null, progressPct: prog?.pct ?? 0,
      lastReadAt: 0, want: false, missing: false, series: null, seriesIndex: null,
    });
  }, []);

  useEffect(() => {
    invoke<string | null>("startup_file")
      .then((p) => {
        if (p) void openExternal(p);
      })
      .catch(() => {});
  }, [openExternal]);

  // Progreso de importaciones grandes y archivos enviados por «Abrir con» a la ventana ya abierta
  useEffect(() => {
    const subs = [
      listen<[number, number]>("import-progress", (e) => setNotice(`Importando ${e.payload[0]} de ${e.payload[1]}…`)),
      listen<string>("open-file", (e) => void openExternal(e.payload)),
    ];
    return () => {
      subs.forEach((p) => p.then((fn) => fn()));
    };
  }, [openExternal]);

  const pickOne = async () => {
    const sel = await open({ multiple: false, filters: [{ name: "Libros", extensions: ["epub", "pdf"] }] });
    if (typeof sel === "string") openExternal(sel);
  };

  /** Abre un libro en la posición de una nota (EPUB: CFI; PDF: `p<página>`); en otros formatos solo lo abre. */
  const openBookAt = (b: Book, loc?: string) => {
    if (!loc || b.missing || (b.format !== "epub" && b.format !== "pdf")) return openBook(b);
    const pos = b.format === "pdf" ? /^p\d+/.exec(loc)?.[0] : loc;
    if (!pos) return openBook(b);
    setReading({ ...b, progressCfi: pos });
  };

  const openBook = (b: Book) => {
    if (b.missing) {
      setNotice("No se encontró el archivo de este libro. Usa ⋯ → «Localizar archivo».");
      setMenuId(b.id);
      return;
    }
    if (READABLE.includes(b.format)) setReading(b);
    else setNotice(`El lector de ${b.format.toUpperCase()} llegará en una fase próxima`);
  };

  // ---- atajos de teclado de la biblioteca ----
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (e.key === "Escape") {
      if (aparienciaOpen) setAparienciaOpen(false);
      else if (help) setHelp(false);
      else if (detailId !== null) setDetailId(null);
      else if (menuId !== null) setMenuId(null);
      return;
    }
    if (reading) return;
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey) {
      if (!e.shiftKey && e.key === ",") { e.preventDefault(); setAparienciaOpen(true); return; }
      if (!e.shiftKey && k === "f") { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return; }
      if (!e.shiftKey && k === "o") { e.preventDefault(); void pickFiles(); return; }
      if (e.shiftKey && k === "o") { e.preventDefault(); void pickOne(); return; }
      if (e.shiftKey && k === "a") { e.preventDefault(); void pickFolder(); return; }
      const idx = ["home", "want", "done", "books", "audio", "pdf"][Number(e.key) - 1];
      if (!e.shiftKey && idx) { e.preventDefault(); setFilter(idx); setQuery(""); return; }
    }
    if (e.altKey && !mod && (e.key === "1" || e.key === "2")) { e.preventDefault(); changeView(e.key === "1" ? "grid" : "list"); return; }
    if (e.key === "F1") { e.preventDefault(); setHelp(true); return; }
    if (typing) return;
    if (e.key === "?") { setHelp(true); return; }
    if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const closeReader = () => {
    setReading(null);
    refresh();
  };

  const searching = query.trim() !== "";
  const isHome = filter === "home" && !searching;
  const isNotes = filter === "notes" && !searching;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (b: Book) => {
      if (q) return `${b.title} ${b.author ?? ""} ${b.series ?? ""}`.toLowerCase().includes(q); // la búsqueda abarca toda la biblioteca
      switch (filter) {
        case "want": return b.want;
        case "reading": return b.progressPct > 0 && b.progressPct < 0.99;
        case "done": return b.progressPct >= 0.99;
        case "books": return b.format !== "pdf" && !AUDIO.includes(b.format);
        case "audio": return AUDIO.includes(b.format);
        case "pdf": return b.format === "pdf";
        default:
          return filter.startsWith("c:") ? b.collectionIds.includes(Number(filter.slice(2))) : true;
      }
    };
    const list = books.filter(match);
    const byTitle = (x: Book, y: Book) => x.title.localeCompare(y.title, "es", { sensitivity: "base" });
    if (sort === "title") return list.sort(byTitle);
    if (sort === "author")
      return list.sort((x, y) => (x.author ?? "~").localeCompare(y.author ?? "~", "es", { sensitivity: "base" }) || byTitle(x, y));
    if (sort === "series")
      return list.sort(
        (x, y) =>
          (x.series ?? "~").localeCompare(y.series ?? "~", "es", { sensitivity: "base" }) ||
          (x.seriesIndex ?? 1e9) - (y.seriesIndex ?? 1e9) ||
          byTitle(x, y),
      );
    if (sort === "read") return list.sort((x, y) => y.lastReadAt - x.lastReadAt || byTitle(x, y));
    if (sort === "progress") return list.sort((x, y) => y.progressPct - x.progressPct || byTitle(x, y));
    if (filter === "done" || filter === "reading") return list.sort((x, y) => y.lastReadAt - x.lastReadAt);
    return list.sort((x, y) => y.addedAt - x.addedAt || y.id - x.id);
  }, [books, filter, query, sort]);

  const shelves = useMemo(
    () => ({
      continuing: books
        .filter((b) => b.progressPct > 0 && b.progressPct < 0.99)
        .sort((x, y) => y.lastReadAt - x.lastReadAt),
      wants: books.filter((b) => b.want && b.progressPct < 0.99),
      recent: [...books].sort((x, y) => y.addedAt - x.addedAt || y.id - x.id).slice(0, 14),
    }),
    [books]
  );

  const pageTitle = searching
    ? "Resultados"
    : TITLES[filter] ?? collections.find((c) => `c:${c.id}` === filter)?.name ?? "Biblioteca";

  const menuBook = books.find((b) => b.id === menuId) ?? null;
  const detailBook = books.find((b) => b.id === detailId) ?? null;
  const editBook = books.find((b) => b.id === editId) ?? null;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="brand">Cinta</h1>
        <nav>
          {NAV_TOP.map((f) => (
            <button
              key={f.id}
              className={"nav-item" + (filter === f.id ? " active" : "")}
              onClick={() => {
                setFilter(f.id);
                setQuery("");
              }}
            >
              <Icon name={f.icon} active={filter === f.id} />
              {f.label}
            </button>
          ))}
          <div className="nav-group">Biblioteca</div>
          {NAV_LIB.map((f) => (
            <button
              key={f.id}
              className={"nav-item" + (filter === f.id ? " active" : "")}
              onClick={() => {
                setFilter(f.id);
                setQuery("");
              }}
            >
              <Icon name={f.icon} active={filter === f.id} />
              {f.label}
            </button>
          ))}
        </nav>

        <div className="nav-head">
          <span>Colecciones</span>
          <button className="link new-col-trigger" onClick={() => setNewCol("")} aria-label="Nueva colección" title="Nueva colección">
            <Icon name="plus" /><span className="new-col-label">Nueva</span>
          </button>
        </div>
        {newCol !== null && (
          <input
            className="new-col"
            autoFocus
            placeholder="Nombre de la colección"
            value={newCol}
            onChange={(e) => setNewCol(e.target.value)}
            onBlur={createCollection}
            onKeyDown={(e) => {
              if (e.key === "Enter") createCollection();
              if (e.key === "Escape") setNewCol(null);
            }}
          />
        )}
        {collections.map((c) => (
          <div key={c.id} className="col-row">
            <button
              className={"nav-item" + (filter === `c:${c.id}` ? " active" : "")}
              onClick={() => {
                setFilter(`c:${c.id}`);
                setQuery("");
              }}
            >
              <Icon name="collection" />{c.name}
            </button>
            <button className="link del" onClick={() => deleteCollection(c)} aria-label={`Eliminar ${c.name}`}>
              Eliminar
            </button>
          </div>
        ))}
        <div className="nav-group">Datos</div>
        <button className="nav-item" onClick={() => setBackupOpen(true)}>
          <Icon name="backup" />Copia de seguridad
        </button>
        <button className="nav-item nav-pie" onClick={() => setAparienciaOpen(true)} aria-label="Apariencia: temas y fondo" title="Apariencia (Ctrl + ,)">
          <Icon name="appearance" />Apariencia
        </button>
      </aside>

      <main className="main">
        <header className="toolbar">
          <div className="search-wrap">
            <Icon name="search" />
            <input
              ref={searchRef}
              className="search"
              type="search"
              placeholder="Buscar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {!isHome && !isNotes && (
            <select className="sort" value={sort} onChange={(e) => changeSort(e.target.value as Sort)} aria-label="Ordenar">
              <option value="recent">Recientes</option>
              <option value="title">Título</option>
              <option value="author">Autor</option>
              <option value="read">Última lectura</option>
              <option value="progress">Progreso</option>
              <option value="series">Serie</option>
            </select>
          )}
          {!isHome && !isNotes && (
            <div className="seg" role="group" aria-label="Vista">
              <button className={view === "grid" ? "on" : ""} aria-pressed={view === "grid"} onClick={() => changeView("grid")} aria-label="Vista de cuadrícula" title="Cuadrícula"><Icon name="grid" /><span className="mobile-view-glyph">▦</span></button>
              <button className={view === "list" ? "on" : ""} aria-pressed={view === "list"} onClick={() => changeView("list")} aria-label="Vista de lista" title="Lista"><Icon name="list" /><span className="mobile-view-glyph">☰</span></button>
            </div>
          )}
          <button className="secondary" onClick={() => setHelp(true)} aria-label="Atajos de teclado" title="Atajos de teclado (F1)"><Icon name="keyboard" /><span className="mobile-keyboard-glyph">⌨</span></button>
          <button className="secondary" onClick={pickOne} title="Leer un archivo sin agregarlo a la biblioteca">
            Abrir archivo
          </button>
          <button className="secondary" onClick={pickFolder}>
            Agregar carpeta
          </button>
          <button className="primary" onClick={pickFiles}>
            Agregar libros
          </button>
        </header>

        <h2 className="page-title">{pageTitle}</h2>

        {books.length === 0 ? (
          <div className="empty">
            <h2>Tu biblioteca está vacía</h2>
            <p>Arrastra archivos o carpetas aquí, o elígelos desde tu equipo.</p>
            <button className="primary" onClick={pickFiles}>
              Agregar libros
            </button>
          </div>
        ) : isHome ? (
          <>
            <MetaLectura version={metaVer} />
            <Shelf title="Continuar" books={shelves.continuing} onOpen={openBook} onMenu={(b) => setMenuId(b.id)} />
            <Shelf
              title="Quiero leer"
              books={shelves.wants}
              onAll={() => setFilter("want")}
              onOpen={openBook}
              onMenu={(b) => setMenuId(b.id)}
            />
            <Shelf
              title="Agregados recientemente"
              books={shelves.recent}
              onAll={() => setFilter("books")}
              onOpen={openBook}
              onMenu={(b) => setMenuId(b.id)}
            />
          </>
        ) : isNotes ? (
          <Notas
            books={books}
            onOpen={(id, loc) => {
              const b = books.find((x) => x.id === id);
              if (b) openBookAt(b, loc);
            }}
          />
        ) : visible.length === 0 ? (
          <div className="empty">
            <h2>{searching ? "Sin resultados" : "Aquí no hay nada todavía"}</h2>
            <p>
              {searching
                ? "Prueba con otra búsqueda."
                : filter === "want"
                  ? "Usa ⋯ en un libro y marca «Quiero leer» para guardarlo aquí."
                  : filter === "reading"
                    ? "Los libros que empieces a leer aparecerán aquí."
                  : filter === "done"
                    ? "Los libros que termines de leer aparecerán aquí."
                    : "No hay libros en esta sección."}
            </p>
          </div>
        ) : (
          view === "list" ? (
            <div className="list" role="list">
              {visible.map((b) => (
                <BookRow key={b.id} book={b} onOpen={() => openBook(b)} onMenu={() => setMenuId(b.id)} />
              ))}
            </div>
          ) : (
            <div className="grid">
              {visible.map((b) => (
                <BookCard key={b.id} book={b} onOpen={() => openBook(b)} onMenu={() => setMenuId(b.id)} />
              ))}
            </div>
          )
        )}

        {notice && <div className="toast" role="status">{notice}</div>}
      </main>

      {backupOpen && <CopiaSeguridad onClose={() => setBackupOpen(false)} />}
      {aparienciaOpen && <Apariencia onClose={() => setAparienciaOpen(false)} />}
      {editBook && (
        <EditarLibro
          book={editBook}
          onClose={() => setEditId(null)}
          onSaved={async (portada) => {
            if (portada) {
              coverCache.delete(editBook.id);
              coverVer.set(editBook.id, (coverVer.get(editBook.id) ?? 0) + 1);
            }
            setEditId(null);
            await refresh();
            setNotice("Información actualizada");
          }}
        />
      )}
      {menuBook && (
        <>
          <div className="scrim" onClick={() => setMenuId(null)} />
          <div className="sheet" role="dialog" aria-label={menuBook.title}>
            <h3>{menuBook.title}</h3>
            {menuBook.author && <p className="muted">{menuBook.author}</p>}
            <button className="secondary" onClick={() => { setDetailId(menuBook.id); setMenuId(null); }}>
              Ver detalles
            </button>
            <button className="secondary" onClick={() => { setEditId(menuBook.id); setMenuId(null); }}>
              Editar información…
            </button>
            {menuBook.missing && (
              <button className="primary" onClick={() => relink(menuBook)}>
                Localizar archivo…
              </button>
            )}
            <label className="check">
              <input type="checkbox" checked={menuBook.want} onChange={() => toggleWant(menuBook)} />
              Quiero leer
            </label>
            {READABLE.includes(menuBook.format) && (
              <button className="secondary" onClick={() => markRead(menuBook, menuBook.progressPct < 0.99)}>
                {menuBook.progressPct < 0.99 ? "Marcar como terminado" : "Marcar como no leído"}
              </button>
            )}
            {collections.length > 0 && <h4>Colecciones</h4>}
            {collections.map((c) => (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  checked={menuBook.collectionIds.includes(c.id)}
                  onChange={() => toggleCollection(menuBook, c.id)}
                />
                {c.name}
              </label>
            ))}
            <p className="muted">
              {/^([A-Za-z]:|[\\/])/.test(menuBook.path)
                ? "Solo se quita de la lista; tu archivo no se toca."
                : "Se elimina la copia guardada por Cinta. Tu archivo original no se toca."}
            </p>
            <button
              className="danger"
              onClick={async () => {
                await remove(menuBook.id);
                setMenuId(null);
              }}
            >
              Eliminar de la biblioteca
            </button>
            <button className="secondary" onClick={() => setMenuId(null)}>
              Cerrar
            </button>
          </div>
        </>
      )}

      {help && <ShortcutsHelp onClose={() => setHelp(false)} />}

      {detailBook && (
        <BookDetail
          book={detailBook}
          collections={collections}
          onClose={() => setDetailId(null)}
          onOpen={() => { setDetailId(null); openBook(detailBook); }}
          onWant={() => toggleWant(detailBook)}
          onCollection={(cid) => toggleCollection(detailBook, cid)}
        />
      )}

      {reading && (() => {
        const add = reading.id < 0 ? () => addPaths([reading.path]) : undefined;
        if (AUDIO.includes(reading.format))
          return <AudioPlayer key={reading.id} book={reading} cover={<Cover book={reading} />} onClose={closeReader} onAdd={add} />;
        if (DOCS.includes(reading.format)) return <DocReader key={reading.id} book={reading} onClose={closeReader} onAdd={add} />;
        if (COMICS.includes(reading.format)) return <ComicReader key={reading.id} book={reading} onClose={closeReader} onAdd={add} />;
        return reading.format === "pdf" ? (
          <PdfReader key={reading.id} book={reading} onClose={closeReader} onAdd={add} />
        ) : (
          <Reader key={reading.id} book={reading} onClose={closeReader} onAdd={add} />
        );
      })()}
    </div>
  );
}
