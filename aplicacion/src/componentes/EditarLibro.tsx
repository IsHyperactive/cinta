// Hoja para corregir título, autor y portada de un libro de la biblioteca (v0.5.1).
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export default function EditarLibro({
  book, onClose, onSaved,
}: {
  book: { id: number; title: string; author: string | null; series: string | null; seriesIndex: number | null };
  onClose: () => void;
  /** `portadaCambiada` = hay que refrescar la portada en pantalla */
  onSaved: (portadaCambiada: boolean) => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");
  const [serie, setSerie] = useState(book.series ?? "");
  const [numero, setNumero] = useState(book.seriesIndex != null ? String(book.seriesIndex) : "");
  const [portada, setPortada] = useState<string | null>(null);
  const [error, setError] = useState("");

  const elegirPortada = async () => {
    const f = await open({ multiple: false, filters: [{ name: "Imágenes", extensions: ["jpg", "jpeg", "png", "webp"] }] });
    if (typeof f === "string") setPortada(f);
  };

  const guardar = async () => {
    try {
      await invoke("set_book_info", { id: book.id, title: title.trim() || null, author: author.trim(),
        // "" quita el libro de su serie; el número es opcional
        series: serie.trim(),
        seriesIndex: serie.trim() && numero.trim() !== "" && !Number.isNaN(Number(numero.replace(",", "."))) ? Number(numero.replace(",", ".")) : null,
      });
      if (portada) await invoke("set_book_cover_file", { id: book.id, path: portada });
      onSaved(portada !== null);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet editar-libro" role="dialog" aria-label="Editar información">
        <h3>Editar información</h3>
        <label className="campo">Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="campo">Autor
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Sin autor" />
        </label>
        <label className="campo">Serie
          <input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Sin serie" />
        </label>
        {serie.trim() && (
          <label className="campo">Número en la serie
            <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="decimal" placeholder="1" />
          </label>
        )}
        <button className="secondary" onClick={elegirPortada}>
          {portada ? "Portada elegida ✓ (cambiar)" : "Cambiar portada…"}
        </button>
        {error && <p className="muted lost">{error}</p>}
        <button className="primary" onClick={guardar}>Guardar</button>
        <button className="secondary" onClick={onClose}>Cancelar</button>
      </div>
    </>
  );
}
