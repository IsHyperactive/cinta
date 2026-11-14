import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  House, BookmarkSimple, CheckCircle, Books, Headphones, FileText, Folder, Plus,
  MagnifyingGlass, SquaresFour, ListBullets, Keyboard, ArrowLeft, List, ArrowUUpLeft,
  HighlighterCircle, X, PencilSimple, Eraser, Play, Pause, SkipBack, SkipForward,
  Timer, Gauge, NotePencil, FloppyDisk, BookOpen, Palette, Image as ImageIcon,
} from "@phosphor-icons/react";

// Paquete de iconos: Phosphor Icons (MIT). Un solo trazo coherente, con variante
// «fill» para el elemento activo, como hace Apple Books con SF Symbols.
const ICONS: Record<string, ComponentType<IconProps>> = {
  home: House,
  want: BookmarkSimple,
  done: CheckCircle,
  books: Books,
  audio: Headphones,
  pdf: FileText,
  collection: Folder,
  plus: Plus,
  search: MagnifyingGlass,
  grid: SquaresFour,
  list: ListBullets,
  keyboard: Keyboard,
  back: ArrowLeft,
  contents: List,
  bookmark: BookmarkSimple,
  undo: ArrowUUpLeft,
  highlighter: HighlighterCircle,
  close: X,
  pencil: PencilSimple,
  eraser: Eraser,
  play: Play,
  pause: Pause,
  skipBack: SkipBack,
  skipForward: SkipForward,
  timer: Timer,
  speed: Gauge,
  notes: NotePencil,
  backup: FloppyDisk,
  reading: BookOpen,
  appearance: Palette,
  image: ImageIcon,
};
const FILLED = new Set(["play", "pause", "skipBack", "skipForward"]);

export type AppleIconName = keyof typeof ICONS;
export default function AppleIcon({
  name, className = "", active = false,
}: { name: AppleIconName | string; className?: string; active?: boolean }) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  const weight = active || FILLED.has(name) ? "fill" : "regular";
  return <Cmp className={`ico ico-apple pico ${className}`} weight={weight} aria-hidden="true" focusable="false" />;
}
