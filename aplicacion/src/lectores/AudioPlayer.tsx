import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Ann } from "../utilidades/annot";
import Icon from "../componentes/AppleIcon";

type AudioBook = { id: number; title: string; author: string | null; path: string; format: string; progressCfi: string | null };

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SLEEP = [0, 15, 30, 45, 60]; // minutos; 0 = apagado
const MIME: Record<string, string> = { m4b: "audio/mp4", m4a: "audio/mp4", mp3: "audio/mpeg" };

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return (h ? `${h}:${String(m).padStart(2, "0")}` : String(m)) + `:${String(ss).padStart(2, "0")}`;
};

/** Reproductor de audiolibros (M4B, M4A, MP3): saltos, velocidad, temporizador, marcadores y progreso guardado. */
export default function AudioPlayer({
  book,
  cover,
  onClose,
  onAdd,
}: {
  book: AudioBook;
  cover: ReactNode;
  onClose: () => void;
  onAdd?: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(() => {
    try {
      const v = Number(localStorage.getItem("cinta.audio.speed"));
      return SPEEDS.includes(v) ? v : 1;
    } catch {
      return 1;
    }
  });
  const [sleepEnd, setSleepEnd] = useState(0); // marca de tiempo (ms) en que se pausa; 0 = sin temporizador
  const [now, setNow] = useState(Date.now());
  const [panel, setPanel] = useState<"sleep" | "marks" | null>(null);
  const annKey = book.id < 0 ? `p:${book.path}` : `b:${book.id}`;
  const [marks, setMarks] = useState<Ann[]>([]);
  const dragging = useRef(false);

  // ---- carga del archivo ----
  useEffect(() => {
    let dead = false;
    let u = "";
    (async () => {
      try {
        const buf = await invoke<ArrayBuffer>("read_book_file", { id: book.id, path: book.id < 0 ? book.path : null });
        if (dead) return;
        u = URL.createObjectURL(new Blob([buf], { type: MIME[book.format] ?? "audio/mpeg" }));
        setUrl(u);
      } catch (e) {
        if (!dead) setError("No se pudo abrir el audiolibro: " + String(e));
      }
    })();
    invoke<Ann[]>("list_annotations", { key: annKey })
      .then((l) => !dead && setMarks(l.filter((a) => a.kind === "bookmark" && a.loc.startsWith("t"))))
      .catch(() => {});
    return () => {
      dead = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [book.id, book.path, book.format, annKey]);

  // ---- guardado de progreso ----
  const save = useCallback(() => {
    const a = audio.current;
    if (!a || !isFinite(a.duration) || a.duration <= 0) return;
    const pct = a.ended ? 1 : Math.min(1, a.currentTime / a.duration);
    invoke("set_progress", { id: book.id, cfi: `t${Math.floor(a.currentTime)}`, pct, path: book.id < 0 ? book.path : null }).catch(() => {});
  }, [book.id, book.path]);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const t = window.setInterval(() => {
      if (audio.current && !audio.current.paused) saveRef.current();
    }, 5000);
    return () => {
      window.clearInterval(t);
      saveRef.current();
    };
  }, []);

  const onLoaded = () => {
    const a = audio.current;
    if (!a) return;
    setDur(a.duration);
    a.playbackRate = speed;
    const m = /^t(\d+)$/.exec(book.progressCfi ?? "");
    if (m && Number(m[1]) < a.duration - 2) a.currentTime = Number(m[1]);
    setTime(a.currentTime);
  };

  const seekBy = useCallback((d: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d));
    setTime(a.currentTime);
  }, []);
  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }, []);

  const changeSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
    try {
      localStorage.setItem("cinta.audio.speed", String(next));
    } catch {
      /* sin almacenamiento */
    }
  };

  // ---- temporizador de sueño ----
  useEffect(() => {
    if (!sleepEnd) return;
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= sleepEnd) {
        audio.current?.pause();
        setSleepEnd(0);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [sleepEnd]);

  // ---- teclado y teclas multimedia ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowLeft") seekBy(-15);
      else if (e.key === "ArrowRight") seekBy(30);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seekBy, onClose]);
  useEffect(() => {
    const ms = (navigator as any).mediaSession;
    if (!ms) return;
    try {
      ms.metadata = new (window as any).MediaMetadata({ title: book.title, artist: book.author ?? "" });
      ms.setActionHandler("play", toggle);
      ms.setActionHandler("pause", toggle);
      ms.setActionHandler("seekbackward", () => seekBy(-15));
      ms.setActionHandler("seekforward", () => seekBy(30));
    } catch {
      /* el motor no soporta Media Session */
    }
    return () => {
      try {
        for (const k of ["play", "pause", "seekbackward", "seekforward"]) ms.setActionHandler(k, null);
      } catch {
        /* nada */
      }
    };
  }, [book.title, book.author, toggle, seekBy]);

  // ---- marcadores ----
  const addMark = async () => {
    const a = audio.current;
    if (!a) return;
    const sec = Math.floor(a.currentTime);
    const loc = `t${sec}`;
    if (marks.some((m) => m.loc === loc)) return;
    const text = fmt(sec);
    const id = await invoke<number>("add_annotation", { key: annKey, kind: "bookmark", loc, text, color: "amarillo", note: "" }).catch(() => null);
    if (id !== null) setMarks((l) => [...l, { id, kind: "bookmark" as const, loc, text, color: "amarillo", note: "", created: Date.now() / 1000 }].sort((x, y) => Number(x.loc.slice(1)) - Number(y.loc.slice(1))));
  };
  const delMark = async (id: number) => {
    await invoke("delete_annotation", { id }).catch(() => {});
    setMarks((l) => l.filter((m) => m.id !== id));
  };

  const remaining = sleepEnd ? Math.max(0, Math.round((sleepEnd - now) / 1000)) : 0;

  return (
    <div className="reader audior" role="dialog" aria-label={`Audiolibro: ${book.title}`}>
      <header className="rbar top">
        <button className="rbtn icon-only" onClick={onClose} aria-label="Volver" title="Volver"><Icon name="back" /><span className="reader-mobile-label">Volver</span></button>
        <span className="rtitle">{book.title}</span>
        {onAdd && <button className="rbtn" onClick={onAdd}>Agregar a la biblioteca</button>}
        <button className="rbtn icon-only" onClick={() => setPanel(panel === "marks" ? null : "marks")} aria-label="Marcadores" title="Marcadores"><Icon name="bookmark" /><span className="reader-mobile-label">Marcadores</span></button>
      </header>

      <div className="audio-body">
        <div className="audio-cover">{cover}</div>
        <h2 className="audio-title">{book.title}</h2>
        {book.author && <p className="audio-author">{book.author}</p>}

        {error ? (
          <p className="reader-error">{error}</p>
        ) : !url ? (
          <p className="muted">Abriendo…</p>
        ) : (
          <>
            <audio
              ref={audio}
              src={url}
              preload="metadata"
              onLoadedMetadata={onLoaded}
              onTimeUpdate={() => !dragging.current && setTime(audio.current?.currentTime ?? 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => { setPlaying(false); save(); }}
              onEnded={() => { setPlaying(false); save(); }}
              onError={() => setError("Este audio no se puede reproducir (formato o códec no compatible).")}
            />
            <div className="audio-seek">
              <span>{fmt(time)}</span>
              <input
                type="range"
                min={0}
                max={dur || 1}
                step={1}
                value={Math.min(time, dur || 1)}
                style={{ "--p": `${(Math.min(time, dur || 1) / (dur || 1)) * 100}%` } as CSSProperties}
                aria-label="Posición"
                onPointerDown={() => (dragging.current = true)}
                onChange={(e) => setTime(Number(e.target.value))}
                onPointerUp={(e) => {
                  dragging.current = false;
                  if (audio.current) audio.current.currentTime = Number((e.target as HTMLInputElement).value);
                }}
                onKeyUp={(e) => {
                  if (audio.current) audio.current.currentTime = Number((e.target as HTMLInputElement).value);
                }}
              />
              <span>-{fmt(Math.max(0, dur - time))}</span>
            </div>
            <div className="audio-ctrl">
              <button className="abtn" onClick={() => seekBy(-15)} aria-label="Retroceder 15 segundos"><Icon name="skipBack" /><span className="reader-mobile-label">↺ 15</span></button>
              <button className="abtn play" onClick={toggle} aria-label={playing ? "Pausar" : "Reproducir"}><Icon name={playing ? "pause" : "play"} /><span className="reader-mobile-label">{playing ? "❚❚" : "▶"}</span></button>
              <button className="abtn" onClick={() => seekBy(30)} aria-label="Adelantar 30 segundos"><Icon name="skipForward" /><span className="reader-mobile-label">30 ↻</span></button>
            </div>
            <div className="audio-extra">
              <button className="chip" onClick={changeSpeed} aria-label="Velocidad" title="Velocidad"><Icon name="speed" /><span className="reader-mobile-label">{speed}×</span></button>
              <button className={"chip" + (sleepEnd ? " on" : "")} onClick={() => setPanel(panel === "sleep" ? null : "sleep")} aria-label="Temporizador" title="Temporizador">
                <Icon name="timer" /><span className="reader-mobile-label">{sleepEnd ? `Dormir ${fmt(remaining)}` : "Temporizador"}</span>
              </button>
              <button className="chip" onClick={addMark}><Icon name="bookmark" /><span className="reader-mobile-label">☆ Marcar</span></button>
            </div>
          </>
        )}
      </div>

      {panel && (
        <>
          <div className="scrim clear" onClick={() => setPanel(null)} />
          <div className="pop audio-pop" role="dialog" aria-label={panel === "sleep" ? "Temporizador" : "Marcadores"}>
            {panel === "sleep" ? (
              <>
                <h3>Pausar automáticamente</h3>
                {SLEEP.map((m) => (
                  <button
                    key={m}
                    className="hit"
                    onClick={() => {
                      setSleepEnd(m ? Date.now() + m * 60000 : 0);
                      setNow(Date.now());
                      setPanel(null);
                    }}
                  >
                    {m ? `En ${m} minutos` : "Apagado"}
                  </button>
                ))}
              </>
            ) : (
              <>
                <h3>Marcadores</h3>
                {marks.length === 0 && <p className="muted">Aún no hay marcadores. Toca «☆ Marcar» para guardar este momento.</p>}
                {marks.map((m) => (
                  <div key={m.id} className="ann">
                    <button
                      className="hit"
                      onClick={() => {
                        if (audio.current) audio.current.currentTime = Number(m.loc.slice(1));
                        setPanel(null);
                      }}
                    >
                      {m.text}
                    </button>
                    <button className="ann-del" onClick={() => delMark(m.id)} aria-label="Eliminar">✕</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
