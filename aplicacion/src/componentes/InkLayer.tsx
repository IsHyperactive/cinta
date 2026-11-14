import { memo, useRef, useState } from "react";
import { INK_COLORS } from "../utilidades/annot";

export type InkStroke = { id: number; color: string; w: number; pts: number[][] };

const pathOf = (pts: number[][], k: number) =>
  pts.length === 1
    ? `M${pts[0][0] * k} ${pts[0][1] * k}l0.01 0`
    : "M" + pts.map((p) => `${(p[0] * k).toFixed(1)} ${(p[1] * k).toFixed(1)}`).join("L");

/** Capa de dibujo a mano de una página PDF. Lápiz y ratón dibujan; el dedo desplaza la página. */
export default memo(function InkLayer(props: {
  page: number;
  scale: number;
  strokes: InkStroke[];
  penOn: boolean;
  eraser: boolean;
  color: string;
  onStroke: (page: number, w: number, pts: number[][]) => void;
  onErase: (id: number) => void;
  panBy: (dx: number, dy: number) => void;
}) {
  const { page, scale, strokes, penOn, eraser, color, onStroke, onErase, panBy } = props;
  const [live, setLive] = useState<number[][] | null>(null);
  const liveRef = useRef<number[][] | null>(null);
  const press = useRef<number[]>([]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const hex = (INK_COLORS[color] ?? INK_COLORS.tinta).hex;

  const pt = (e: { clientX: number; clientY: number }, svg: SVGSVGElement) => {
    const r = svg.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / scale) * 10) / 10, Math.round(((e.clientY - r.top) / scale) * 10) / 10];
  };
  const add = (p: number[]) => {
    const cur = liveRef.current!;
    const last = cur[cur.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.6) return; // descarta puntos casi iguales
    cur.push(p);
  };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!penOn) return;
    e.stopPropagation();
    if (e.pointerType === "touch") {
      touch.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (eraser || (e.buttons & 32) !== 0) return; // borrador: lo resuelve el trazo tocado
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = [e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5];
    liveRef.current = [pt(e, e.currentTarget)];
    setLive([...liveRef.current]);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!penOn) return;
    if (e.pointerType === "touch") {
      const t = touch.current;
      if (t) {
        panBy(t.x - e.clientX, t.y - e.clientY);
        touch.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }
    if (!liveRef.current) return;
    const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    for (const c of evs.length ? evs : [e.nativeEvent]) {
      add(pt(c, e.currentTarget));
      if (e.pointerType === "pen" && c.pressure > 0) press.current.push(c.pressure);
    }
    setLive([...liveRef.current]);
  };
  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    touch.current = null;
    const pts = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (!penOn || !pts) return;
    const avg = press.current.reduce((a, b) => a + b, 0) / Math.max(1, press.current.length);
    const w = e.pointerType === "pen" ? Math.round((1 + 2.4 * avg) * 10) / 10 : 1.8;
    if (pts.length > 0) onStroke(page, w, pts);
  };

  return (
    <svg
      className={"ink" + (penOn ? " on" : "")}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClick={(e) => penOn && e.stopPropagation()}
    >
      {strokes.map((s) => (
        <path
          key={s.id}
          d={pathOf(s.pts, scale)}
          stroke={(INK_COLORS[s.color] ?? INK_COLORS.tinta).hex}
          strokeWidth={s.w * scale}
          className={penOn && eraser ? "erasable" : undefined}
          onPointerDown={penOn && eraser ? (e) => { e.stopPropagation(); onErase(s.id); } : undefined}
        />
      ))}
      {live && <path d={pathOf(live, scale)} stroke={hex} strokeWidth={1.8 * scale} />}
    </svg>
  );
});
