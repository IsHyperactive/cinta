import { useState } from "react";

/** Editor de nota de texto para un resaltado (EPUB y PDF). */
export default function NoteDialog({
  initial,
  quote,
  onSave,
  onCancel,
}: {
  initial: string;
  quote: string;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <>
      <div className="scrim" onClick={onCancel} />
      <div className="notebox" role="dialog" aria-label="Nota">
        {quote && <blockquote className="notequote">{quote.length > 160 ? quote.slice(0, 160) + "…" : quote}</blockquote>}
        <textarea
          autoFocus
          rows={5}
          value={text}
          maxLength={4000}
          placeholder="Escribe tu nota…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSave(text.trim());
          }}
        />
        <div className="noterow">
          <button className="selx" onClick={onCancel}>Cancelar</button>
          <button className="primary" onClick={() => onSave(text.trim())}>Guardar</button>
        </div>
      </div>
    </>
  );
}
