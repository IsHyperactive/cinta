// Crear y restaurar una copia de seguridad de la biblioteca (libros guardados por Cinta, anotaciones y progreso) (v0.5.1).
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

const FILTRO = [{ name: "Copia de Cinta", extensions: ["zip"] }];

export default function CopiaSeguridad({ onClose }: { onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const crear = async () => {
    const fecha = new Date().toISOString().slice(0, 10);
    const ruta = await save({ defaultPath: `Copia-Cinta-${fecha}.zip`, filters: FILTRO });
    if (!ruta) return;
    setOcupado(true);
    setMsg("Creando copia…");
    try {
      const bytes = await invoke<number>("backup_library", { dest: ruta });
      setMsg(`Copia creada (${(bytes / 1048576).toFixed(1)} MB).`);
    } catch (e) {
      setMsg(`No se pudo crear la copia: ${e}`);
    }
    setOcupado(false);
  };

  const elegir = async () => {
    const f = await open({ multiple: false, filters: FILTRO });
    if (typeof f === "string") setConfirmar(f);
  };

  const restaurar = async () => {
    if (!confirmar) return;
    setOcupado(true);
    setMsg("Restaurando…");
    try {
      await invoke("restore_library", { src: confirmar });
      setMsg("Copia lista. Cierra Cinta y vuelve a abrirla para aplicarla.");
    } catch (e) {
      setMsg(`No se pudo restaurar: ${e}`);
    }
    setConfirmar(null);
    setOcupado(false);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Copia de seguridad">
        <h3>Copia de seguridad</h3>
        <p className="muted">Guarda en un solo archivo .zip tu biblioteca, anotaciones y progreso. Los archivos que abriste sin agregar no se incluyen.</p>
        <button className="primary" onClick={crear} disabled={ocupado}>Crear copia…</button>
        {confirmar ? (
          <>
            <p className="muted lost">Restaurar reemplaza tu biblioteca actual (se guarda una copia como library.db.anterior). ¿Continuar?</p>
            <button className="danger" onClick={restaurar} disabled={ocupado}>Sí, restaurar</button>
            <button className="secondary" onClick={() => setConfirmar(null)}>No</button>
          </>
        ) : (
          <button className="secondary" onClick={elegir} disabled={ocupado}>Restaurar copia…</button>
        )}
        {msg && <p role="status">{msg}</p>}
        <button className="secondary" onClick={onClose}>Cerrar</button>
      </div>
    </>
  );
}
