// Tipos y colores compartidos por los lectores EPUB y PDF (Fase 5)
export type Ann = {
  id: number;
  kind: "bookmark" | "highlight" | "ink";
  /** EPUB: CFI. PDF: `p<página>` (marcador), `p<página>|<JSON de rectángulos>` (resaltado) o `p<página>|{"w":grosor,"pts":[[x,y],…]}` (trazo de lápiz, kind "ink") */
  loc: string;
  text: string;
  color: string;
  note: string;
  created: number;
};

export const HL_COLORS: Record<string, { hex: string; label: string }> = {
  amarillo: { hex: "#ffd60a", label: "Amarillo" },
  verde: { hex: "#34c759", label: "Verde" },
  azul: { hex: "#0a84ff", label: "Azul" },
  rosa: { hex: "#ff6b9d", label: "Rosa" },
};

export const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Colores de tinta para el lápiz. */
export const INK_COLORS: Record<string, { hex: string; label: string }> = {
  tinta: { hex: "#1c1c1e", label: "Negro" },
  azul: { hex: "#0a84ff", label: "Azul" },
  rojo: { hex: "#ff3b30", label: "Rojo" },
  verde: { hex: "#248a3d", label: "Verde" },
};
