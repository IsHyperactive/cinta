// Conversores a HTML para los formatos "reflowables" extra (TXT, HTML, DOCX, FB2, MOBI/AZW3).
// Todo en JS propio o en librerías de JS puro (ARM64 seguro). Sala limpia: solo especificaciones públicas.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type Converted = { html: string; title?: string };

function decode(buf: ArrayBuffer | Uint8Array, encoding?: string): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (encoding) {
    try {
      return new TextDecoder(encoding).decode(u8);
    } catch {
      /* se prueba el modo automático */
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(u8);
  } catch {
    return new TextDecoder("windows-1252").decode(u8);
  }
}

function b64(u: Uint8Array): string {
  let s = "";
  const k = 0x8000;
  for (let i = 0; i < u.length; i += k) s += String.fromCharCode(...u.subarray(i, i + k));
  return btoa(s);
}

/** Limpia HTML ajeno: sin scripts, marcos, formularios, estilos propios ni manejadores de eventos. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, iframe, object, embed, form, link, meta, base, noscript, audio, video").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase();
      const v = a.value.trim().toLowerCase();
      if (n.startsWith("on") || n === "style") el.removeAttribute(a.name);
      else if ((n === "href" || n === "src" || n === "xlink:href") && (v.startsWith("javascript:") || (n !== "src" && v.startsWith("data:")))) el.removeAttribute(a.name);
    }
  });
  return doc.body.innerHTML;
}

// ---------------------------------------------------------------- TXT
export function txtToHtml(buf: ArrayBuffer): Converted {
  const text = decode(buf).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const html = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return { html };
}

// ---------------------------------------------------------------- HTML
export function htmlFileToHtml(buf: ArrayBuffer): Converted {
  const raw = decode(buf);
  const title = new DOMParser().parseFromString(raw, "text/html").title || undefined;
  return { html: sanitizeHtml(raw), title };
}

// ---------------------------------------------------------------- DOCX (mammoth, JS puro)
export async function docxToHtml(buf: ArrayBuffer): Promise<Converted> {
  const mammoth: any = await import("mammoth/mammoth.browser");
  const r = await (mammoth.default ?? mammoth).convertToHtml({ arrayBuffer: buf });
  return { html: sanitizeHtml(r.value) };
}

// ---------------------------------------------------------------- FB2
export function fb2ToHtml(buf: ArrayBuffer): Converted {
  const head = decode(buf.slice(0, 200), "ascii");
  const enc = /encoding=["']([\w-]+)["']/i.exec(head)?.[1];
  const xml = new DOMParser().parseFromString(decode(buf, enc), "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("El archivo FB2 está dañado.");

  const bins = new Map<string, string>();
  xml.querySelectorAll("binary").forEach((b) => {
    const id = b.getAttribute("id");
    if (id) bins.set(id, `data:${b.getAttribute("content-type") || "image/jpeg"};base64,${(b.textContent || "").replace(/\s+/g, "")}`);
  });
  const href = (el: Element) => {
    for (const a of Array.from(el.attributes)) if (a.name.endsWith("href")) return a.value.replace(/^#/, "");
    return "";
  };
  const kids = (el: Element): string => Array.from(el.childNodes).map(node).join("");
  const node = (n: Node): string => {
    if (n.nodeType === 3) return esc(n.textContent || "");
    if (n.nodeType !== 1) return "";
    const el = n as Element;
    switch (el.localName) {
      case "section": return `<section>${kids(el)}</section>`;
      case "title": return `<h2>${Array.from(el.children).map((c) => kids(c)).join("<br>") || kids(el)}</h2>`;
      case "subtitle": return `<h3>${kids(el)}</h3>`;
      case "p": return `<p>${kids(el)}</p>`;
      case "empty-line": return "<br>";
      case "strong": return `<strong>${kids(el)}</strong>`;
      case "emphasis": return `<em>${kids(el)}</em>`;
      case "strikethrough": return `<s>${kids(el)}</s>`;
      case "sub": return `<sub>${kids(el)}</sub>`;
      case "sup": return `<sup>${kids(el)}</sup>`;
      case "code": return `<code>${kids(el)}</code>`;
      case "a": return kids(el);
      case "epigraph": return `<blockquote class="epi">${kids(el)}</blockquote>`;
      case "cite": return `<blockquote>${kids(el)}</blockquote>`;
      case "text-author": return `<p class="ta">${kids(el)}</p>`;
      case "poem": return `<div class="poem">${kids(el)}</div>`;
      case "stanza": return `<div class="stanza">${kids(el)}</div>`;
      case "v": return `<p class="v">${kids(el)}</p>`;
      case "image": {
        const src = bins.get(href(el));
        return src ? `<img src="${src}" alt="">` : "";
      }
      case "table": return `<table>${kids(el)}</table>`;
      case "tr": return `<tr>${kids(el)}</tr>`;
      case "td": case "th": return `<${el.localName}>${kids(el)}</${el.localName}>`;
      default: return kids(el);
    }
  };

  const info = xml.querySelector("description > title-info");
  const title = info?.querySelector("book-title")?.textContent?.trim() || undefined;
  const author = Array.from(info?.querySelectorAll("author") ?? [])
    .map((a) => ["first-name", "middle-name", "last-name"].map((t) => a.querySelector(t)?.textContent?.trim()).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(", ");
  const cover = info?.querySelector("coverpage image");
  const coverSrc = cover ? bins.get(href(cover)) : "";
  const bodies = Array.from(xml.querySelectorAll("FictionBook > body")).map((b) => kids(b)).join("");
  const front = `${coverSrc ? `<img class="cover" src="${coverSrc}" alt="">` : ""}${title ? `<h1>${esc(title)}</h1>` : ""}${author ? `<p class="ta">${esc(author)}</p>` : ""}`;
  return { html: sanitizeHtml(front + bodies), title };
}

// ---------------------------------------------------------------- MOBI / AZW3 (MOBI 6 sin DRM, compresión PalmDOC)
function palmDecompress(inp: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < inp.length) {
    const c = inp[i++];
    if (c === 0 || (c >= 9 && c <= 0x7f)) out.push(c);
    else if (c >= 1 && c <= 8) for (let k = 0; k < c && i < inp.length; k++) out.push(inp[i++]);
    else if (c >= 0xc0) out.push(0x20, c ^ 0x80);
    else {
      const w = (c << 8) | inp[i++];
      const dist = (w >> 3) & 0x7ff;
      const len = (w & 7) + 3;
      for (let k = 0; k < len; k++) out.push(out[out.length - dist]);
    }
  }
  return Uint8Array.from(out);
}

/** Bytes de datos extra al final de cada registro de texto (según las banderas del encabezado MOBI). */
function trailingSize(data: Uint8Array, flags: number): number {
  const entry = (size: number) => {
    let bit = 0, result = 0, p = size;
    for (;;) {
      const v = data[p - 1];
      result |= (v & 0x7f) << bit;
      bit += 7;
      p--;
      if ((v & 0x80) !== 0 || bit >= 28 || p === 0) return result;
    }
  };
  let num = 0;
  let f = flags >> 1;
  while (f) {
    if (f & 1) num += entry(data.length - num);
    f >>= 1;
  }
  if (flags & 1) num += (data[data.length - num - 1] & 3) + 1;
  return num;
}

export function mobiToHtml(buf: ArrayBuffer): Converted {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  const n = dv.getUint16(76);
  if (n < 2) throw new Error("Archivo MOBI no válido.");
  const off: number[] = [];
  for (let i = 0; i < n; i++) off.push(dv.getUint32(78 + i * 8));
  off.push(u8.length);
  const rec = (i: number) => u8.subarray(off[i], off[i + 1]);

  const r0 = rec(0);
  const d0 = new DataView(r0.buffer, r0.byteOffset, r0.byteLength);
  const comp = d0.getUint16(0);
  const count = d0.getUint16(8);
  if (d0.getUint16(12) !== 0) throw new Error("Este libro tiene protección (DRM) y no se puede abrir.");
  if (comp === 17480) throw new Error("Este MOBI usa compresión HUFF/CDIC, que aún no está soportada.");
  if (comp !== 1 && comp !== 2) throw new Error("Compresión de MOBI desconocida.");
  const isMobi = String.fromCharCode(...r0.subarray(16, 20)) === "MOBI";
  const hlen = isMobi ? d0.getUint32(20) : 0;
  if (isMobi && d0.getUint32(36) === 8)
    throw new Error("Este AZW3 es KF8 puro; aún solo se leen MOBI y AZW3 con parte MOBI 6 incluida.");
  const encoding = isMobi && d0.getUint32(28) === 65001 ? "utf-8" : "windows-1252";
  const extra = isMobi && hlen >= 228 ? d0.getUint16(242) : 0;

  const parts: Uint8Array[] = [];
  let total = 0;
  for (let i = 1; i <= count && i < n; i++) {
    let r = rec(i);
    if (extra) r = r.subarray(0, Math.max(0, r.length - trailingSize(r, extra)));
    const t = comp === 2 ? palmDecompress(r) : r;
    parts.push(t);
    total += t.length;
  }
  const all = new Uint8Array(total);
  let p = 0;
  for (const t of parts) {
    all.set(t, p);
    p += t.length;
  }
  let html = decode(all, encoding);

  // Imágenes: <img recindex="00001"> → registro de imagen número (primera imagen + n − 1)
  const firstImg = isMobi ? d0.getUint32(108) : 0;
  if (firstImg > 0 && firstImg < n) {
    html = html.replace(/<img([^>]*?)recindex=["']?0*(\d+)["']?([^>]*)>/gi, (_m, a: string, idx: string, b: string) => {
      const r = firstImg + Number(idx) - 1;
      if (r >= n) return "";
      const d = rec(r);
      const mime = d[0] === 0xff && d[1] === 0xd8 ? "image/jpeg" : d[0] === 0x89 && d[1] === 0x50 ? "image/png" : d[0] === 0x47 && d[1] === 0x49 ? "image/gif" : "";
      return mime ? `<img${a}${b} src="data:${mime};base64,${b64(d)}">` : "";
    });
  }
  html = html.replace(/<mbp:pagebreak\s*\/?>/gi, "<hr>").replace(/\sfilepos=["']?\d+["']?/gi, "");

  let title: string | undefined;
  if (isMobi) {
    const o = d0.getUint32(84), l = d0.getUint32(88);
    if (l > 0 && o + l <= r0.length) title = decode(r0.subarray(o, o + l), encoding).trim() || undefined;
  }
  return { html: sanitizeHtml(html), title };
}

/** Punto único de entrada según el formato. */
export async function convertToHtml(format: string, buf: ArrayBuffer): Promise<Converted> {
  switch (format) {
    case "txt": return txtToHtml(buf);
    case "html": return htmlFileToHtml(buf);
    case "docx": return docxToHtml(buf);
    case "fb2": return fb2ToHtml(buf);
    case "mobi":
    case "azw3": return mobiToHtml(buf);
    default: throw new Error(`Formato no soportado: ${format}`);
  }
}
