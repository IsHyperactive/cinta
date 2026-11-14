import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { invoke } from "@tauri-apps/api/core";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Lee título, autor y la primera página (como portada JPEG en base64) de un PDF de la biblioteca. */
export async function extractPdfInfo(id: number) {
  const buf = await invoke<ArrayBuffer>("read_book_file", { id, path: null });
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  try {
    const meta = await pdf.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as Record<string, unknown>;

    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 600 / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    return {
      title: text(info.Title),
      author: text(info.Author),
      cover: canvas.toDataURL("image/jpeg", 0.82).split(",")[1],
    };
  } finally {
    await pdf.destroy();
  }
}

export { pdfjs };
