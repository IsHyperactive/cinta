// Vista «Notas»: todos los resaltados, notas y marcadores de la biblioteca en un solo lugar, con búsqueda y exportación.
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { HL_COLORS } from "../utilidades/annot";
import Icon from "../componentes/AppleIcon";
import "../estilos/notas.css";

type Nota = {
  bookId: number;
  id: number;
  kind: "bookmark" | "highlight";
  loc: string;
  text: string;
  color: string;
  note: string;
  created: number;
};
export type LibroMini = { id: number; title: string; author: string | null };
type Tipo = "todo" | "highlight" | "note" | "bookmark";

const TIPOS: { id: Tipo; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "highlight", label: "Resaltados" },
  { id: "note", label: "Con nota" },
  { id: "bookmark", label: "Marcadores" },
];

const fecha = (t: number) => new Date(t > 1e12 ? t : t * 1000).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });

export default function Notas({ books, onOpen }: { books: LibroMini[]; onOpen: (bookId: number, loc?: string) => void }) {
  const [rows, setRows] = useState<Nota[] | null>(null);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<Tipo>("todo");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    invoke<Nota[]>("list_all_annotations").then(setRows).catch(() => setRows([]));
  }, []);

  const grupos = useMemo(() => {
    const porLibro = new Map<number, LibroMini>(books.map((b) => [b.id, b]));
    const ql = q.trim().toLowerCase();
    const mapa = new Map<number, Nota[]>();
    for (const n of rows ?? []) {
      const libro = porLibro.get(n.bookId);
      if (!libro) continue; // libro eliminado
      if (tipo === "highlight" && n.kind !== "highlight") continue;
      if (tipo === "bookmark" && n.kind !== "bookmark") continue;
      if (tipo === "note" && !n.note) continue;
      if (ql && !`${n.text} ${n.note} ${libro.title}`.toLowerCase().includes(ql)) continue;
      mapa.set(n.bookId, [...(mapa.get(n.bookId) ?? []), n]);
    }
    return [...mapa.entries()].map(([id, items]) => ({ libro: porLibro.get(id)!, items }));
  }, [rows, books, q, tipo]);

  const total = grupos.reduce((s, g) => s + g.items.length, 0);

  const exportar = async () => {
    const md: string[] = ["# Mis notas de Cinta", ""];
    for (const { libro, items } of grupos) {
      md.push(`## ${libro.title}${libro.author ? ` — ${libro.author}` : ""}`, "");
      for (const n of items) {
        if (n.kind === "bookmark") md.push(`- 🔖 Marcador${n.text ? `: ${n.text}` : ""}`);
        else {
          md.push(`> ${n.text.replace(/\n+/g, " ")}`);
          if (n.note) md.push("", `**Nota:** ${n.note}`);
        }
        md.push("");
      }
    }
    try {
      const ruta = await save({ defaultPath: "Mis-notas-Cinta.md", filters: [{ name: "Markdown", extensions: ["md"] }] });
      if (!ruta) return;
      await invoke("save_text_file", { path: ruta, contents: md.join("\n") });
      setAviso("Notas exportadas.");
    } catch {
      setAviso("No se pudo exportar.");
    }
    setTimeout(() => setAviso(""), 3000);
  };

  return (
    <div className="notas">
      <div className="notas-barra">
        <input type="search" placeholder="Buscar en tus notas" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en tus notas" />
        <div className="seg" role="group" aria-label="Tipo">
          {TIPOS.map((t) => (
            <button key={t.id} className={tipo === t.id ? "on" : ""} aria-pressed={tipo === t.id} onClick={() => setTipo(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <button className="secondary" onClick={exportar} disabled={total === 0}>Exportar (.md)</button>
      </div>
      {aviso && <p className="notas-aviso" role="status">{aviso}</p>}
      {rows === null ? null : total === 0 ? (
        <div className="empty">
          <h2>Sin notas todavía</h2>
          <p>Resalta texto o agrega marcadores mientras lees y aparecerán aquí.</p>
        </div>
      ) : (
        grupos.map(({ libro, items }) => (
          <section key={libro.id} className="notas-libro">
            <h3>
              <button className="link" onClick={() => onOpen(libro.id)} title="Abrir libro">{libro.title}</button>
              <span>{libro.author ?? ""} · {items.length}</span>
            </h3>
            {items.map((n) => (
              <article key={n.id} className="nota" role="button" tabIndex={0} title="Ir a este pasaje" onClick={() => onOpen(libro.id, n.loc)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(libro.id, n.loc); }} style={{ borderLeftColor: n.kind === "highlight" ? HL_COLORS[n.color]?.hex ?? "#ffd60a" : "var(--accent)" }}>
                {n.kind === "bookmark" ? (
                  <p className="nota-texto"><Icon name="bookmark" /> Marcador{n.text ? `: ${n.text}` : ""}</p>
                ) : (
                  <p className="nota-texto">{n.text}</p>
                )}
                {n.note && <p className="nota-nota">{n.note}</p>}
                <small>{fecha(n.created)}</small>
              </article>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
