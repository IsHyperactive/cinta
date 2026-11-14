//! Lectura de metadatos y portada de un EPUB (2 y 3). Solo Rust puro.
use roxmltree::{Document, ParsingOptions};
use std::{fs::File, io::Read, path::Path};
use zip::ZipArchive;

pub struct EpubMeta {
    pub title: Option<String>,
    pub author: Option<String>,
    /// (tipo MIME, bytes de la imagen)
    pub cover: Option<(String, Vec<u8>)>,
}

fn read_entry(z: &mut ZipArchive<File>, name: &str) -> Option<Vec<u8>> {
    let mut f = z.by_name(name).ok()?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).ok()?;
    Some(buf)
}

fn parse(bytes: &[u8]) -> Option<String> {
    Some(String::from_utf8_lossy(bytes).trim_start_matches('\u{feff}').to_string())
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            let v = std::str::from_utf8(&b[i + 1..i + 3])
                .ok()
                .and_then(|h| u8::from_str_radix(h, 16).ok());
            if let Some(v) = v {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

/// Resuelve `href` relativo a la carpeta del archivo OPF dentro del zip.
fn resolve(opf_dir: &str, href: &str) -> String {
    let href = href.split(['#', '?']).next().unwrap_or("");
    let href = percent_decode(href);
    let mut parts: Vec<&str> = opf_dir.split('/').filter(|p| !p.is_empty()).collect();
    for seg in href.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            s => parts.push(s),
        }
    }
    parts.join("/")
}

fn clean(s: Option<&str>) -> Option<String> {
    s.map(|t| t.trim().to_string()).filter(|t| !t.is_empty())
}

pub fn read_meta(path: &Path) -> Option<EpubMeta> {
    let mut z = ZipArchive::new(File::open(path).ok()?).ok()?;
    let opts = ParsingOptions { allow_dtd: true, ..Default::default() };

    let container = parse(&read_entry(&mut z, "META-INF/container.xml")?)?;
    let cdoc = Document::parse_with_options(&container, opts).ok()?;
    let opf_path = cdoc
        .descendants()
        .find(|n| n.has_tag_name("rootfile"))?
        .attribute("full-path")?
        .to_string();

    let opf = parse(&read_entry(&mut z, &opf_path)?)?;
    let doc = Document::parse_with_options(&opf, opts).ok()?;
    let opf_dir = opf_path.rsplit_once('/').map(|(d, _)| d).unwrap_or("");

    let first_text = |tag: &str| {
        doc.descendants()
            .find(|n| n.is_element() && n.has_tag_name(tag))
            .and_then(|n| clean(n.text()))
    };
    let title = first_text("title");
    let author = first_text("creator");

    // Portada: EPUB 3 (properties="cover-image") o EPUB 2 (<meta name="cover" content="id">)
    let items: Vec<_> = doc.descendants().filter(|n| n.has_tag_name("item")).collect();
    let by_property = items
        .iter()
        .find(|n| n.attribute("properties").map_or(false, |p| p.split_whitespace().any(|x| x == "cover-image")));
    let cover_id = doc
        .descendants()
        .find(|n| n.has_tag_name("meta") && n.attribute("name") == Some("cover"))
        .and_then(|n| n.attribute("content"));
    let by_meta = cover_id.and_then(|id| items.iter().find(|n| n.attribute("id") == Some(id)));

    let cover = by_property.or(by_meta).and_then(|item| {
        let href = item.attribute("href")?;
        let mime = item.attribute("media-type").unwrap_or("image/jpeg").to_string();
        if !mime.starts_with("image/") {
            return None;
        }
        let bytes = read_entry(&mut z, &resolve(opf_dir, href))?;
        Some((mime, bytes))
    });

    Some(EpubMeta { title, author, cover })
}
