// Tarjeta de Inicio: meta diaria de lectura, racha y últimos 7 días (v0.5.2).
import { useState } from "react";
import { estadoLectura, guardarMeta, metaMinutos, METAS_MIN } from "../utilidades/metas";
import "../estilos/metas.css";

const minutos = (seg: number) => Math.floor(seg / 60);

/** `version` cambia cuando termina una sesión de lectura, para recalcular. */
export default function MetaLectura({ version }: { version: number }) {
  const [meta, setMeta] = useState(metaMinutos());
  void version;
  const e = estadoLectura();
  const pct = Math.min(100, Math.round((e.hoySeg / e.metaSeg) * 100));
  const max = Math.max(e.metaSeg, ...e.semana.map((d) => d.seg));

  return (
    <section className="meta-lectura" aria-label="Meta de lectura">
      <div className="meta-cabecera">
        <div>
          <h3>Meta de hoy</h3>
          <p className="muted">
            {pct >= 100 ? "¡Meta cumplida!" : `${minutos(e.hoySeg)} de ${meta} min`}
            {e.racha > 0 ? ` · Racha de ${e.racha} ${e.racha === 1 ? "día" : "días"}` : ""}
          </p>
        </div>
        <label className="meta-selector">
          Meta
          <select
            value={meta}
            onChange={(ev) => {
              const n = Number(ev.target.value);
              guardarMeta(n);
              setMeta(n);
            }}
          >
            {METAS_MIN.map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </label>
      </div>
      <i className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><b style={{ width: `${pct}%` }} /></i>
      <div className="meta-semana" aria-hidden="true">
        {e.semana.map((d) => (
          <div key={d.clave} className={"meta-dia" + (d.seg >= e.metaSeg ? " ok" : "")} title={`${minutos(d.seg)} min`}>
            <span style={{ height: `${Math.max(4, Math.round((d.seg / max) * 40))}px` }} />
            <small>{d.letra}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
