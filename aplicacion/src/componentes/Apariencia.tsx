// Hoja «Apariencia» (0.6.1): temas de color y fondo personalizado con colores adaptativos.
// Usa el patrón .sheet de la app. Toda la lógica está en utilidades/temas.ts y utilidades/fondo.ts.
import type { CSSProperties } from "react";
import Icon from "./AppleIcon";
import "../estilos/apariencia.css";
import { TEMAS, ajustarFondo, elegirImagen, elegirTema, quitarFondo, useTema, type TemaId } from "../utilidades/temas";

type Muestra = (typeof TEMAS)[number]["muestra"];
type Una = Exclude<Muestra, unknown[]>;

function Mini({ m }: { m: Una }) {
  return (
    <span className="ap-mini" style={{ background: m.bg }} aria-hidden="true">
      <i className="ap-lat" style={{ background: m.lateral }} />
      <i className="ap-card" style={{ background: m.panel, borderColor: m.muted }} />
      <i className="ap-l1" style={{ background: m.text }} />
      <i className="ap-l2" style={{ background: m.muted }} />
      <i className="ap-dot" style={{ background: m.accent }} />
    </span>
  );
}

function sinTransparencia(): boolean {
  try { return window.matchMedia("(prefers-reduced-transparency: reduce)").matches; } catch { return false; }
}

export default function Apariencia({ onClose }: { onClose: () => void }) {
  const t = useTema();
  const p = t.paleta;
  const minimo = p ? Math.round(p.minAtenuacion * 100) : 0;
  const valor = p ? Math.round(p.atenuacion * 100) : Math.round((t.atenuacionElegida ?? 0.4) * 100);
  const pulsar = (id: TemaId) => { void elegirTema(id); };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet ap-sheet" role="dialog" aria-label="Apariencia">
        <h3>Apariencia</h3>
        <p className="muted">Cambia solo los colores. El lector de libros conserva sus propios temas.</p>

        <h4>Tema</h4>
        <div className="ap-temas" role="radiogroup" aria-label="Tema de color">
          {TEMAS.map((x) => (
            <button
              key={x.id}
              role="radio"
              aria-checked={t.tema === x.id}
              className={"ap-tema" + (t.tema === x.id ? " on" : "")}
              onClick={() => pulsar(x.id)}
            >
              {Array.isArray(x.muestra)
                ? <span className="ap-dual"><Mini m={x.muestra[0]} /><Mini m={x.muestra[1]} /></span>
                : <Mini m={x.muestra} />}
              <span className="ap-nombre">{x.nombre}</span>
            </button>
          ))}
          <button
            role="radio"
            aria-checked={t.tema === "fondo"}
            className={"ap-tema" + (t.tema === "fondo" ? " on" : "")}
            onClick={() => pulsar("fondo")}
          >
            <span className="ap-mini ap-foto" aria-hidden="true">
              {t.fondoUrl ? <img src={t.fondoUrl} alt="" /> : <Icon name="image" />}
            </span>
            <span className="ap-nombre">Fondo personalizado</span>
          </button>
        </div>

        <h4>Fondo personalizado</h4>
        <div className="ap-acciones">
          <button className="secondary" onClick={() => void elegirImagen()} disabled={t.cargando}>Elegir imagen…</button>
          <button className="secondary" onClick={() => void quitarFondo()} disabled={!t.hayFondo || t.cargando}>Quitar fondo</button>
        </div>
        <p className="muted">
          Cinta reduce la imagen (jpg, png o webp) y la guarda en tu equipo; no sale a internet. Los colores del texto y del acento se adaptan
          a la foto. El lector no usa la imagen.
        </p>

        {t.hayFondo && p && (
          <div className="ap-prev" style={p.vars as CSSProperties} aria-label="Vista previa">
            <img src={t.fondoUrl ?? ""} alt="" />
            <span className="ap-prev-velo" />
            <span className="ap-prev-lat"><b /><b /><b /></span>
            <span className="ap-prev-main">
              <strong>Título del libro</strong>
              <span>Nombre del autor</span>
              <em>Leer</em>
            </span>
          </div>
        )}

        <label className="ap-ctl">
          <span>Atenuación <b>{valor} %</b></span>
          <input
            type="range" min={0} max={100} step={1} value={valor} disabled={!t.hayFondo}
            aria-describedby="ap-aviso"
            onChange={(e) => ajustarFondo({ atenuacion: Number(e.target.value) / 100 })}
          />
        </label>
        {t.hayFondo && <p className="muted ap-min">Mínimo para que el texto se lea con esta imagen: {minimo} %.</p>}
        <label className="ap-ctl">
          <span>Desenfoque de la imagen <b>{Math.round(t.desenfoque)} px</b></span>
          <input
            type="range" min={0} max={24} step={1} value={Math.round(t.desenfoque)} disabled={!t.hayFondo}
            onChange={(e) => ajustarFondo({ desenfoque: Number(e.target.value) })}
          />
        </label>
        {sinTransparencia() && t.hayFondo && (
          <p className="muted">Tu sistema pide menos transparencia: los paneles se ven opacos y sin desenfoque.</p>
        )}
        <p id="ap-aviso" className="ap-aviso" role="status" aria-live="polite">{t.cargando ? "Preparando la imagen…" : t.aviso}</p>

        <button className="secondary" onClick={onClose}>Cerrar</button>
      </div>
    </>
  );
}
