mod epub;

use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{params, Connection};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Response, Emitter, Manager, State};
use walkdir::WalkDir;

struct Db(Mutex<Connection>);
/// Carpeta de datos de Cinta (portable: "CintaData" junto al .exe). Los libros copiados viven en "Libros".
struct Lib(PathBuf);

/// Modo portable: carpeta "CintaData" junto al .exe, solo si se puede escribir en ella.
/// Si no (por ejemplo, instalado en Archivos de programa o en una unidad de solo lectura) devuelve `None`
/// y la app usa la carpeta de datos del usuario (%APPDATA%\com.cinta.reader).
fn portable_dir() -> Option<PathBuf> {
    let dir = std::env::current_exe().ok()?.parent()?.join("CintaData");
    fs::create_dir_all(&dir).ok()?;
    let probe = dir.join(".escritura");
    fs::write(&probe, b"").ok()?;
    let _ = fs::remove_file(&probe);
    Some(dir)
}

fn books_dir(lib: &Lib) -> PathBuf {
    lib.0.join("Libros")
}

/// Las rutas relativas (copias) se resuelven contra la carpeta de datos, así la app sigue funcionando si se mueve a otra unidad.
fn resolve(lib: &Lib, stored: &str) -> PathBuf {
    let p = Path::new(stored);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        lib.0.join(p)
    }
}

fn supported_ext(p: &Path) -> Option<String> {
    let ext = p.extension()?.to_str()?.to_lowercase();
    SUPPORTED.contains(&ext.as_str()).then_some(ext)
}

/// Nombre libre dentro de `dir`: "libro.epub", "libro (2).epub", ...
fn unique_dest(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let p = Path::new(name);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("libro");
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("");
    let mut n = 2;
    loop {
        let c = dir.join(format!("{stem} ({n}).{ext}"));
        if !c.exists() {
            return c;
        }
        n += 1;
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Book {
    id: i64,
    title: String,
    author: Option<String>,
    path: String,
    format: String,
    added_at: i64,
    cover_mime: Option<String>,
    collection_ids: Vec<i64>,
    progress_cfi: Option<String>,
    progress_pct: f64,
    last_read_at: i64,
    want: bool,
    /// El archivo del libro ya no existe (borrado o movido a mano).
    missing: bool,
    /// Serie a la que pertenece (por ejemplo «Fundación») y su número dentro de ella.
    series: Option<String>,
    series_index: Option<f64>,
}

#[derive(Serialize)]
struct Annotation {
    id: i64,
    /// "bookmark" o "highlight"
    kind: String,
    /// CFI del EPUB (o `p<página>` en PDF)
    loc: String,
    text: String,
    color: String,
    note: String,
    created: i64,
}

#[derive(Serialize)]
struct Collection {
    id: i64,
    name: String,
}

// Extensiones aceptadas al importar. Mantener sincronizado con EXTENSIONS en src/App.tsx.
const SUPPORTED: &[&str] = &[
    "epub", "pdf", "mobi", "azw3", "fb2", "cbz", "cbr", "txt", "html", "docx", "m4b", "m4a",
    "mp3", "ibooks",
];

fn err<E: ToString>(e: E) -> String {
    e.to_string()
}

/// Guía de Cinta: el libro que viene por defecto. Va incluida DENTRO del ejecutable (include_bytes!),
/// así queda en el .exe portable sin archivos sueltos. Fuente y generador: carpeta `herramientas/guia-incluida/` del proyecto.
/// Si cambias la guía, vuelve a generarla y sube GUIDE_VERSION para que se actualice la copia de quien ya la tiene.
const GUIDE_EPUB: &[u8] = include_bytes!("../assets/Guia-de-Cinta.epub");
const GUIDE_FILE: &str = "Guia-de-Cinta.epub";
/// Valor de `books.source` que identifica la guía (así no se duplica y se puede reconocer).
const GUIDE_SOURCE: &str = "cinta:guia";
const GUIDE_VERSION: &str = "4";

/// Instala la guía en la biblioteca la primera vez que se abre Cinta (marca `.guia` en la carpeta de datos).
/// - Si el usuario la elimina, no vuelve a aparecer (para recuperarla: borrar `.guia` y abrir Cinta).
/// - Si una versión nueva de Cinta trae una guía actualizada y el usuario aún la tiene, se reemplaza su copia.
/// Nunca es fatal: si algo falla, la app arranca igual.
fn install_guide(conn: &Connection, dir: &Path) {
    let marker = dir.join(".guia");
    let seen = fs::read_to_string(&marker).unwrap_or_default();
    if seen.trim() == GUIDE_VERSION {
        return;
    }
    let existing: Option<(i64, String)> = conn
        .query_row("SELECT id, path FROM books WHERE source = ?1", params![GUIDE_SOURCE], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .ok();
    // Marca presente pero sin la guía en la biblioteca = el usuario la quitó: se respeta.
    if existing.is_none() && !seen.trim().is_empty() {
        let _ = fs::write(&marker, GUIDE_VERSION);
        return;
    }
    let books = dir.join("Libros");
    if fs::create_dir_all(&books).is_err() {
        return;
    }
    let (dest, stored) = match &existing {
        Some((_, p)) => (dir.join(p), p.clone()),
        None => {
            let d = unique_dest(&books, GUIDE_FILE);
            let s = format!("Libros/{}", d.file_name().and_then(|n| n.to_str()).unwrap_or(GUIDE_FILE));
            (d, s)
        }
    };
    if fs::write(&dest, GUIDE_EPUB).is_err() {
        return;
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let (title, author, cover, mime) = match epub::read_meta(&dest) {
        Some(m) => {
            let (c, mt) = match m.cover {
                Some((mt, data)) => (Some(data), Some(mt)),
                None => (None, None),
            };
            (m.title, m.author, c, mt)
        }
        None => (None, None, None, None),
    };
    let id = match existing {
        Some((id, _)) => id,
        None => {
            let n = conn
                .execute(
                    "INSERT OR IGNORE INTO books (title, path, format, added_at, source) VALUES (?1, ?2, 'epub', ?3, ?4)",
                    params![title.clone().unwrap_or_else(|| "Guía de Cinta".to_string()), stored, now, GUIDE_SOURCE],
                )
                .unwrap_or(0);
            if n == 0 {
                return;
            }
            conn.last_insert_rowid()
        }
    };
    let _ = conn.execute(
        "UPDATE books SET title = COALESCE(?1, title), author = ?2, cover = ?3, cover_mime = ?4 WHERE id = ?5",
        params![title, author, cover, mime, id],
    );
    let _ = fs::write(&marker, GUIDE_VERSION);
}

fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    // WAL mejora el rendimiento, pero algunas unidades (USB exFAT/FAT, carpetas de red) no lo permiten: no es fatal.
    let _ = conn.query_row("PRAGMA journal_mode = WAL", [], |r| r.get::<_, String>(0));
    let v: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if v < 1 {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS books (
                 id       INTEGER PRIMARY KEY AUTOINCREMENT,
                 title    TEXT    NOT NULL,
                 path     TEXT    NOT NULL UNIQUE,
                 format   TEXT    NOT NULL,
                 added_at INTEGER NOT NULL
             );
             PRAGMA user_version = 1;",
        )?;
    }
    if v < 2 {
        conn.execute_batch(
            "ALTER TABLE books ADD COLUMN author TEXT;
             ALTER TABLE books ADD COLUMN cover BLOB;
             ALTER TABLE books ADD COLUMN cover_mime TEXT;
             CREATE TABLE IF NOT EXISTS collections (
                 id   INTEGER PRIMARY KEY AUTOINCREMENT,
                 name TEXT NOT NULL UNIQUE
             );
             CREATE TABLE IF NOT EXISTS collection_books (
                 collection_id INTEGER NOT NULL,
                 book_id       INTEGER NOT NULL,
                 PRIMARY KEY (collection_id, book_id)
             );
             PRAGMA user_version = 2;",
        )?;
    }
    if v < 3 {
        conn.execute_batch(
            "ALTER TABLE books ADD COLUMN progress_cfi TEXT;
             ALTER TABLE books ADD COLUMN progress_pct REAL NOT NULL DEFAULT 0;
             ALTER TABLE books ADD COLUMN last_read_at INTEGER NOT NULL DEFAULT 0;
             PRAGMA user_version = 3;",
        )?;
    }
    if v < 4 {
        conn.execute_batch(
            "ALTER TABLE books ADD COLUMN want INTEGER NOT NULL DEFAULT 0;
             PRAGMA user_version = 4;",
        )?;
    }
    if v < 5 {
        conn.execute_batch(
            "ALTER TABLE books ADD COLUMN source TEXT;
             PRAGMA user_version = 5;",
        )?;
    }
    if v < 6 {
        // Posición de lectura de archivos abiertos SIN agregar a la biblioteca (clave: ruta del archivo)
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS ext_progress (
                 path    TEXT PRIMARY KEY,
                 cfi     TEXT NOT NULL,
                 pct     REAL NOT NULL DEFAULT 0,
                 updated INTEGER NOT NULL
             );
             PRAGMA user_version = 6;",
        )?;
    }
    if v < 7 {
        // Fase 5: marcadores y resaltados (y notas). key = "b:<id>" (libro de la biblioteca) o "p:<ruta>" (abierto sin agregar)
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS annotations (
                 id      INTEGER PRIMARY KEY AUTOINCREMENT,
                 key     TEXT    NOT NULL,
                 kind    TEXT    NOT NULL,
                 loc     TEXT    NOT NULL,
                 text    TEXT    NOT NULL DEFAULT '',
                 color   TEXT    NOT NULL DEFAULT 'amarillo',
                 note    TEXT    NOT NULL DEFAULT '',
                 created INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_annotations_key ON annotations(key);
             PRAGMA user_version = 7;",
        )?;
    }
    if v < 8 {
        // 0.6.0: series de libros y registro del tiempo de lectura (antes solo en localStorage)
        conn.execute_batch(
            "ALTER TABLE books ADD COLUMN series TEXT;
             ALTER TABLE books ADD COLUMN series_index REAL;
             CREATE TABLE IF NOT EXISTS reading_log (
                 day     TEXT    NOT NULL,
                 book_id INTEGER NOT NULL,
                 seconds INTEGER NOT NULL DEFAULT 0,
                 PRIMARY KEY (day, book_id)
             );
             CREATE INDEX IF NOT EXISTS idx_collection_books_book ON collection_books(book_id);
             CREATE INDEX IF NOT EXISTS idx_books_series ON books(series);
             PRAGMA user_version = 8;",
        )?;
    }
    Ok(())
}

fn collect_files(p: &Path, out: &mut Vec<PathBuf>) {
    if p.is_dir() {
        for e in WalkDir::new(p).into_iter().filter_map(Result::ok) {
            if e.file_type().is_file() {
                out.push(e.into_path());
            }
        }
    } else {
        out.push(p.to_path_buf());
    }
}

#[tauri::command]
fn list_books(db: State<Db>, lib: State<Lib>) -> Result<Vec<Book>, String> {
    let conn = db.0.lock().map_err(err)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, author, path, format, added_at, cover_mime,
                    (SELECT group_concat(collection_id) FROM collection_books WHERE book_id = books.id),
                    progress_cfi, progress_pct, last_read_at, want, series, series_index
             FROM books ORDER BY added_at DESC, id DESC",
        )
        .map_err(err)?;
    let rows = stmt
        .query_map([], |r| {
            let ids: Option<String> = r.get(7)?;
            Ok(Book {
                id: r.get(0)?,
                title: r.get(1)?,
                author: r.get(2)?,
                path: r.get(3)?,
                format: r.get(4)?,
                added_at: r.get(5)?,
                cover_mime: r.get(6)?,
                collection_ids: ids
                    .unwrap_or_default()
                    .split(',')
                    .filter_map(|s| s.parse().ok())
                    .collect(),
                progress_cfi: r.get(8)?,
                progress_pct: r.get(9)?,
                last_read_at: r.get(10)?,
                want: r.get::<_, i64>(11)? != 0,
                missing: false,
                series: r.get(12)?,
                series_index: r.get(13)?,
            })
        })
        .map_err(err)?;
    let mut books = rows.collect::<Result<Vec<_>, _>>().map_err(err)?;
    for b in books.iter_mut() {
        b.missing = !resolve(&lib, &b.path).exists();
    }
    Ok(books)
}

/// Agrega archivos o carpetas completas (busca dentro de subcarpetas).
/// Como en Apple Books, cada libro se COPIA a la biblioteca de Cinta (`Libros`); el original no se toca nunca.
#[tauri::command]
async fn add_books(
    paths: Vec<String>,
    app: tauri::AppHandle,
    db: State<'_, Db>,
    lib: State<'_, Lib>,
) -> Result<usize, String> {
    let dir = books_dir(&lib);
    fs::create_dir_all(&dir).map_err(err)?;
    let dir_canon = fs::canonicalize(&dir).unwrap_or_else(|_| dir.clone());
    let mut files = Vec::new();
    for p in &paths {
        collect_files(Path::new(p), &mut files);
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    let total = files.iter().filter(|f| supported_ext(f).is_some()).count();
    let mut done = 0;
    let mut added = 0;
    for src in files {
        let Some(ext) = supported_ext(&src) else { continue };
        done += 1;
        if total > 3 {
            let _ = app.emit("import-progress", (done, total)); // la interfaz muestra «Importando 4 de 20…»
        }
        // Ya está dentro de la carpeta de Cinta (por ejemplo, arrastrado desde ahí): no se duplica.
        if fs::canonicalize(&src).map(|c| c.starts_with(&dir_canon)).unwrap_or(false) {
            continue;
        }
        let src_s = src.to_string_lossy().to_string();
        {
            let conn = db.0.lock().map_err(err)?;
            let dup: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM books WHERE source = ?1 OR path = ?1)",
                    params![src_s],
                    |r| r.get(0),
                )
                .map_err(err)?;
            if dup {
                continue;
            }
        }
        // La copia se hace sin tener bloqueada la base de datos (los libros pueden ser grandes).
        let name = src.file_name().and_then(|n| n.to_str()).unwrap_or("libro").to_string();
        let dest = unique_dest(&dir, &name);
        if fs::copy(&src, &dest).is_err() {
            let _ = fs::remove_file(&dest);
            continue;
        }
        let stored = format!("Libros/{}", dest.file_name().and_then(|n| n.to_str()).unwrap_or("libro"));
        let title = src
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Sin título")
            .to_string();

        let conn = db.0.lock().map_err(err)?;
        let n = conn
            .execute(
                "INSERT OR IGNORE INTO books (title, path, format, added_at, source) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![title, stored, ext, now, src_s],
            )
            .map_err(err)?;
        if n == 0 {
            let _ = fs::remove_file(&dest);
            continue;
        }
        added += 1;
        let id = conn.last_insert_rowid();
        // Si ese archivo ya se había leído sin agregarlo, conserva su posición.
        conn.execute(
            "UPDATE books SET progress_cfi = (SELECT cfi FROM ext_progress WHERE path IN (?1, ?3) ORDER BY updated DESC LIMIT 1),
                              progress_pct = COALESCE((SELECT pct FROM ext_progress WHERE path IN (?1, ?3) ORDER BY updated DESC LIMIT 1), 0),
                              last_read_at = COALESCE((SELECT updated FROM ext_progress WHERE path IN (?1, ?3) ORDER BY updated DESC LIMIT 1), 0)
             WHERE id = ?2",
            params![src_s, id, norm_ext_path(&src_s)],
        )
        .map_err(err)?;
        // Al agregar un libro que antes se abrió sin importar, conserva también sus marcadores,
        // resaltados, notas y trazos. La clave externa usa la ruta original exacta.
        conn.execute(
            "UPDATE annotations SET key = ?1 WHERE key = ?2 OR key = ?3",
            params![format!("b:{id}"), format!("p:{src_s}"), format!("p:{}", norm_ext_path(&src_s))],
        )
        .map_err(err)?;

        if ext == "epub" {
            if let Some(m) = epub::read_meta(&dest) {
                let (cover, mime) = match m.cover {
                    Some((mime, data)) => (Some(data), Some(mime)),
                    None => (None, None),
                };
                conn.execute(
                    "UPDATE books SET title = COALESCE(?1, title), author = ?2, cover = ?3, cover_mime = ?4 WHERE id = ?5",
                    params![m.title, m.author, cover, mime, id],
                )
                .map_err(err)?;
            }
        }
    }
    Ok(added)
}

/// Lo usa la interfaz para guardar título, autor y portada de un PDF (generados con pdf.js).
#[tauri::command]
fn set_book_info(
    id: i64,
    title: Option<String>,
    author: Option<String>,
    cover_base64: Option<String>,
    series: Option<String>,
    series_index: Option<f64>,
    db: State<Db>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(err)?;
    // `series` = None → no tocar; Some("") → quitar de la serie; Some(nombre) → asignar (con su número, si lo hay)
    if let Some(sr) = series {
        let sr = sr.trim().to_string();
        if sr.is_empty() {
            conn.execute("UPDATE books SET series = NULL, series_index = NULL WHERE id = ?1", params![id]).map_err(err)?;
        } else {
            conn.execute("UPDATE books SET series = ?1, series_index = ?2 WHERE id = ?3", params![sr, series_index, id]).map_err(err)?;
        }
    }
    let cover = match cover_base64 {
        Some(b) => Some(STANDARD.decode(b).map_err(err)?),
        None => None,
    };
    let mime = cover.as_ref().map(|_| "image/jpeg".to_string());
    conn.execute(
        "UPDATE books SET title = COALESCE(?1, title), author = COALESCE(?2, author),
                          cover = COALESCE(?3, cover), cover_mime = COALESCE(?4, cover_mime)
         WHERE id = ?5",
        params![title, author, cover, mime, id],
    )
    .map_err(err)?;
    Ok(())
}

#[tauri::command]
async fn get_cover(id: i64, db: State<'_, Db>) -> Result<Response, String> {
    let conn = db.0.lock().map_err(err)?;
    let data: Option<Vec<u8>> = conn
        .query_row("SELECT cover FROM books WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(err)?;
    Ok(Response::new(data.unwrap_or_default()))
}

/// Devuelve los bytes de un libro. Con `id >= 0` es un libro de la biblioteca (por id, nunca por ruta libre).
/// Con `id < 0` es un archivo abierto SIN agregar a la biblioteca: se lee directamente de su ubicación y no se guarda nada.
#[tauri::command]
async fn read_book_file(id: i64, path: Option<String>, db: State<'_, Db>, lib: State<'_, Lib>) -> Result<Response, String> {
    let file: PathBuf = if id < 0 {
        let p = PathBuf::from(path.ok_or("Falta la ruta del archivo")?);
        if supported_ext(&p).is_none() {
            return Err("Formato no soportado".into());
        }
        p
    } else {
        let stored: String = {
            let conn = db.0.lock().map_err(err)?;
            conn.query_row("SELECT path FROM books WHERE id = ?1", params![id], |r| r.get(0))
                .map_err(err)?
        };
        resolve(&lib, &stored)
    };
    let bytes = fs::read(&file).map_err(|e| format!("No se pudo leer {}: {e}", file.display()))?;
    Ok(Response::new(bytes))
}

/// Reconecta un libro cuyo archivo se perdió: copia el archivo elegido a la biblioteca y lo usa en su lugar.
#[tauri::command]
async fn relink_book(id: i64, path: String, db: State<'_, Db>, lib: State<'_, Lib>) -> Result<(), String> {
    let src = PathBuf::from(&path);
    if supported_ext(&src).is_none() {
        return Err("Formato no soportado".into());
    }
    let dir = books_dir(&lib);
    fs::create_dir_all(&dir).map_err(err)?;
    let name = src.file_name().and_then(|n| n.to_str()).unwrap_or("libro").to_string();
    let dest = unique_dest(&dir, &name);
    fs::copy(&src, &dest).map_err(err)?;
    let stored = format!("Libros/{}", dest.file_name().and_then(|n| n.to_str()).unwrap_or("libro"));
    let conn = db.0.lock().map_err(err)?;
    conn.execute("UPDATE books SET path = ?1, source = ?2 WHERE id = ?3", params![stored, path, id])
        .map_err(err)?;
    Ok(())
}

/// Archivo con el que se abrió la app (arrastrado sobre el .exe o "Abrir con"), si lo hay.
#[tauri::command]
fn startup_file() -> Option<String> {
    // args_os: `args()` entra en pánico si una ruta tiene caracteres que no son Unicode válido.
    std::env::args_os().skip(1).filter_map(|a| a.into_string().ok()).find(|a| {
        let p = Path::new(a);
        p.is_file() && supported_ext(p).is_some()
    })
}

/// Quita un libro de la biblioteca. Si es una copia hecha por Cinta (`Libros/...`) se borra SOLO esa copia;
/// los archivos originales y los enlaces antiguos con ruta absoluta nunca se borran.
#[tauri::command]
fn remove_book(id: i64, db: State<Db>, lib: State<Lib>) -> Result<(), String> {
    let conn = db.0.lock().map_err(err)?;
    let stored: Option<String> = conn
        .query_row("SELECT path FROM books WHERE id = ?1", params![id], |r| r.get(0))
        .ok();
    conn.execute("DELETE FROM collection_books WHERE book_id = ?1", params![id]).map_err(err)?;
    conn.execute("DELETE FROM annotations WHERE key = ?1", params![format!("b:{id}")]).map_err(err)?;
    conn.execute("DELETE FROM books WHERE id = ?1", params![id]).map_err(err)?;
    if let Some(stored) = stored {
        let p = Path::new(&stored);
        if p.is_relative() {
            if let (Ok(f), Ok(d)) = (fs::canonicalize(lib.0.join(p)), fs::canonicalize(books_dir(&lib))) {
                if f.starts_with(&d) && f != d {
                    // fs::copy conserva el atributo «solo lectura» del original; en Windows eso impediría borrar la copia.
                    if let Ok(m) = fs::metadata(&f) {
                        let mut perm = m.permissions();
                        if perm.readonly() {
                            perm.set_readonly(false);
                            let _ = fs::set_permissions(&f, perm);
                        }
                    }
                    let _ = fs::remove_file(&f);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn list_collections(db: State<Db>) -> Result<Vec<Collection>, String> {
    let conn = db.0.lock().map_err(err)?;
    let mut stmt = conn.prepare("SELECT id, name FROM collections ORDER BY name COLLATE NOCASE").map_err(err)?;
    let rows = stmt
        .query_map([], |r| Ok(Collection { id: r.get(0)?, name: r.get(1)? }))
        .map_err(err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(err)
}

#[tauri::command]
fn create_collection(name: String, db: State<Db>) -> Result<i64, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre no puede estar vacío".into());
    }
    let conn = db.0.lock().map_err(err)?;
    conn.execute("INSERT INTO collections (name) VALUES (?1)", params![name])
        .map_err(|_| "Ya existe una colección con ese nombre".to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn delete_collection(id: i64, db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(err)?;
    conn.execute("DELETE FROM collection_books WHERE collection_id = ?1", params![id]).map_err(err)?;
    conn.execute("DELETE FROM collections WHERE id = ?1", params![id]).map_err(err)?;
    Ok(())
}

#[tauri::command]
fn set_book_collection(book_id: i64, collection_id: i64, member: bool, db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(err)?;
    if member {
        conn.execute(
            "INSERT OR IGNORE INTO collection_books (collection_id, book_id) VALUES (?1, ?2)",
            params![collection_id, book_id],
        )
    } else {
        conn.execute(
            "DELETE FROM collection_books WHERE collection_id = ?1 AND book_id = ?2",
            params![collection_id, book_id],
        )
    }
    .map_err(err)?;
    Ok(())
}

/// Forma estable de la ruta de un archivo abierto sin agregar: sin prefijo `\\?\`, con `/` y, en Windows,
/// en minúsculas. Así «Abrir archivo», «Abrir con» y el arrastrar y soltar dan la MISMA clave y la memoria
/// (posición, marcadores, resaltados, notas) no se pierde por diferencias de mayúsculas o barras.
fn norm_ext_path(p: &str) -> String {
    let s = p.strip_prefix("\\\\?\\").unwrap_or(p).replace('\\', "/");
    if cfg!(windows) { s.to_lowercase() } else { s }
}

/// Igual que `norm_ext_path` pero para claves de anotaciones: solo toca las de la forma «p:<ruta>».
fn norm_ann_key(key: &str) -> String {
    match key.strip_prefix("p:") {
        Some(p) => format!("p:{}", norm_ext_path(p)),
        None => key.to_string(),
    }
}

#[derive(Serialize)]
struct ExtProgress {
    cfi: String,
    pct: f64,
}

/// Guarda la posición de lectura (CFI de EPUB o `p<página>` de PDF) y el porcentaje. `pct` puede faltar mientras se calculan las ubicaciones.
/// Con `id < 0` (archivo abierto sin agregar) la posición se guarda por ruta del archivo.
#[tauri::command]
fn set_progress(id: i64, cfi: String, pct: Option<f64>, path: Option<String>, db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(err)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    if id < 0 {
        if let Some(raw) = path {
            let path = norm_ext_path(&raw);
            conn.execute(
                "INSERT INTO ext_progress (path, cfi, pct, updated) VALUES (?1, ?2, COALESCE(?3, 0), ?4)
                 ON CONFLICT(path) DO UPDATE SET cfi = ?2, pct = COALESCE(?3, pct), updated = ?4",
                params![path, cfi, pct, now],
            )
            .map_err(err)?;
            // Una fila antigua con la ruta sin normalizar ya no hace falta
            if raw != path {
                conn.execute("DELETE FROM ext_progress WHERE path = ?1", params![raw]).map_err(err)?;
            }
        }
        return Ok(());
    }
    conn.execute(
        "UPDATE books SET progress_cfi = ?1, progress_pct = COALESCE(?2, progress_pct), last_read_at = ?3 WHERE id = ?4",
        params![cfi, pct, now, id],
    )
    .map_err(err)?;
    Ok(())
}

/// Última posición guardada de un archivo abierto sin agregar.
#[tauri::command]
fn get_external_progress(path: String, db: State<Db>) -> Result<Option<ExtProgress>, String> {
    let conn = db.0.lock().map_err(err)?;
    let norm = norm_ext_path(&path);
    let mut stmt = conn
        .prepare("SELECT cfi, pct FROM ext_progress WHERE path = ?1 OR path = ?2 ORDER BY updated DESC LIMIT 1")
        .map_err(err)?;
    let mut rows = stmt
        .query_map(params![path, norm], |r| Ok(ExtProgress { cfi: r.get(0)?, pct: r.get(1)? }))
        .map_err(err)?;
    Ok(rows.next().transpose().map_err(err)?)
}

/// Marcadores y resaltados de un libro (`key` = "b:<id>" o "p:<ruta>").
#[tauri::command]
fn list_annotations(key: String, db: State<Db>) -> Result<Vec<Annotation>, String> {
    let conn = db.0.lock().map_err(err)?;
    let mut stmt = conn
        .prepare("SELECT id, kind, loc, text, color, note, created FROM annotations WHERE key = ?1 OR key = ?2 ORDER BY created, id")
        .map_err(err)?;
    let rows = stmt
        .query_map(params![key, norm_ann_key(&key)], |r| {
            Ok(Annotation {
                id: r.get(0)?,
                kind: r.get(1)?,
                loc: r.get(2)?,
                text: r.get(3)?,
                color: r.get(4)?,
                note: r.get(5)?,
                created: r.get(6)?,
            })
        })
        .map_err(err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(err)
}

#[derive(Serialize)]
struct NoteRow {
    #[serde(rename = "bookId")]
    book_id: i64,
    id: i64,
    kind: String,
    loc: String,
    text: String,
    color: String,
    note: String,
    created: i64,
}

/// Todos los resaltados, notas y marcadores de los libros de la biblioteca (sin trazos de lápiz), más recientes primero.
#[tauri::command]
fn list_all_annotations(db: State<Db>) -> Result<Vec<NoteRow>, String> {
    let conn = db.0.lock().map_err(err)?;
    let mut stmt = conn
        .prepare("SELECT key, id, kind, loc, text, color, note, created FROM annotations WHERE key LIKE 'b:%' AND kind <> 'ink' ORDER BY created DESC, id DESC")
        .map_err(err)?;
    let rows = stmt
        .query_map([], |r| {
            let key: String = r.get(0)?;
            Ok((
                key,
                NoteRow {
                    book_id: 0,
                    id: r.get(1)?,
                    kind: r.get(2)?,
                    loc: r.get(3)?,
                    text: r.get(4)?,
                    color: r.get(5)?,
                    note: r.get(6)?,
                    created: r.get(7)?,
                },
            ))
        })
        .map_err(err)?;
    let mut out = Vec::new();
    for row in rows {
        let (key, mut n) = row.map_err(err)?;
        if let Ok(id) = key[2..].parse::<i64>() {
            n.book_id = id;
            out.push(n);
        }
    }
    Ok(out)
}

/// Guarda texto en la ruta elegida por el usuario (exportar notas).
#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(err)
}

/// Cambia la portada de un libro por una imagen (JPG, PNG o WebP) elegida por el usuario.
#[tauri::command]
fn set_book_cover_file(id: i64, path: String, db: State<Db>) -> Result<(), String> {
    let mime = match Path::new(&path).extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).as_deref() {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        _ => return Err("Usa una imagen JPG, PNG o WebP".into()),
    };
    let bytes = fs::read(&path).map_err(err)?;
    if bytes.len() > 15_000_000 {
        return Err("La imagen es demasiado grande (máximo 15 MB)".into());
    }
    let conn = db.0.lock().map_err(err)?;
    conn.execute("UPDATE books SET cover = ?1, cover_mime = ?2 WHERE id = ?3", params![bytes, mime, id])
        .map_err(err)?;
    Ok(())
}

/// Carpeta de fondos personalizados («Fondos» dentro de la carpeta de datos; en modo portable queda junto al .exe).
fn fondos_dir(lib: &Lib) -> PathBuf {
    lib.0.join("Fondos")
}

/// Archivo único del fondo actual. No lleva extensión: el WebView detecta el formato por el contenido.
fn fondo_file(lib: &Lib) -> PathBuf {
    fondos_dir(lib).join("fondo")
}

/// Imagen recién elegida, todavía sin reducir ni comprobar: no sustituye al fondo actual hasta que `save_background` la confirma.
fn fondo_pendiente(lib: &Lib) -> PathBuf {
    fondos_dir(lib).join("fondo.nuevo")
}

/// Fondo personalizado, paso 1: copia la imagen elegida (jpg, png o webp) a «Fondos» como «pendiente».
/// El frontend la lee con `get_background(pendiente: true)`, la reduce con un canvas y envía la versión ligera con
/// `save_background`. Si la imagen está corrupta, el fondo anterior sigue intacto.
#[tauri::command]
fn set_background(path: String, lib: State<Lib>) -> Result<(), String> {
    let src = PathBuf::from(&path);
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if !["jpg", "jpeg", "png", "webp"].contains(&ext.as_str()) {
        return Err("Formato de imagen no soportado (usa jpg, png o webp)".into());
    }
    let meta = fs::metadata(&src).map_err(err)?;
    if !meta.is_file() || meta.len() > 60_000_000 {
        return Err("La imagen es demasiado grande (máximo 60 MB)".into());
    }
    fs::create_dir_all(fondos_dir(&lib)).map_err(err)?;
    fs::copy(&src, fondo_pendiente(&lib)).map_err(err)?;
    Ok(())
}

/// Fondo personalizado, paso 2: guarda la imagen ya reducida (JPEG) que envía el frontend como cuerpo binario,
/// sustituye al fondo actual y descarta la imagen pendiente.
#[tauri::command]
fn save_background(request: tauri::ipc::Request<'_>, lib: State<Lib>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("Se esperaba el contenido de la imagen".into());
    };
    if bytes.is_empty() || bytes.len() > 30_000_000 {
        return Err("Imagen no válida".into());
    }
    let dir = fondos_dir(&lib);
    fs::create_dir_all(&dir).map_err(err)?;
    let tmp = dir.join("fondo.tmp");
    fs::write(&tmp, bytes).map_err(err)?;
    fs::rename(&tmp, fondo_file(&lib)).map_err(err)?;
    let _ = fs::remove_file(fondo_pendiente(&lib));
    Ok(())
}

/// Devuelve los bytes del fondo (mismo patrón que `get_cover`; no se usan protocolos de archivo del WebView).
/// Con `pendiente: true` devuelve la imagen recién elegida (antes de reducirla). Si no existe o no se puede leer,
/// devuelve vacío y el frontend vuelve al tema anterior sin mostrar error.
#[tauri::command]
async fn get_background(pendiente: Option<bool>, lib: State<'_, Lib>) -> Result<Response, String> {
    let file = if pendiente.unwrap_or(false) { fondo_pendiente(&lib) } else { fondo_file(&lib) };
    Ok(Response::new(fs::read(file).unwrap_or_default()))
}

/// Quita el fondo personalizado (no falla si ya no existe). Con `solo_pendiente: true` solo descarta la imagen recién
/// elegida y deja el fondo anterior.
#[tauri::command]
fn clear_background(solo_pendiente: Option<bool>, lib: State<Lib>) -> Result<(), String> {
    let _ = fs::remove_file(fondo_pendiente(&lib));
    let _ = fs::remove_file(fondos_dir(&lib).join("fondo.tmp"));
    if !solo_pendiente.unwrap_or(false) {
        let _ = fs::remove_file(fondo_file(&lib));
    }
    Ok(())
}

/// Copia de seguridad: un .zip con la base de datos (copia consistente) y la carpeta «Libros». Devuelve el tamaño en bytes.
#[tauri::command]
fn backup_library(dest: String, db: State<Db>, lib: State<Lib>) -> Result<u64, String> {
    let tmp = lib.0.join("copia-temporal.db");
    let _ = fs::remove_file(&tmp);
    {
        let conn = db.0.lock().map_err(err)?;
        conn.execute("VACUUM INTO ?1", params![tmp.to_string_lossy().to_string()]).map_err(err)?;
    }
    let file = fs::File::create(&dest).map_err(err)?;
    let mut zw = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .large_file(true);
    zw.start_file("library.db", opts).map_err(err)?;
    std::io::copy(&mut fs::File::open(&tmp).map_err(err)?, &mut zw).map_err(err)?;
    let _ = fs::remove_file(&tmp);
    let base = books_dir(&lib);
    if base.is_dir() {
        for e in WalkDir::new(&base).into_iter().filter_map(|e| e.ok()).filter(|e| e.file_type().is_file()) {
            let rel = e.path().strip_prefix(&lib.0).map_err(err)?.to_string_lossy().replace('\\', "/");
            zw.start_file(rel, opts).map_err(err)?;
            std::io::copy(&mut fs::File::open(e.path()).map_err(err)?, &mut zw).map_err(err)?;
        }
    }
    let fondos = fondos_dir(&lib);
    if fondos.is_dir() {
        for e in WalkDir::new(&fondos).into_iter().filter_map(|e| e.ok()).filter(|e| e.file_type().is_file()) {
            if e.file_name().to_str() != Some("fondo") {
                continue; // ni la imagen pendiente ni temporales
            }
            let rel = e.path().strip_prefix(&lib.0).map_err(err)?.to_string_lossy().replace('\\', "/");
            zw.start_file(rel, opts).map_err(err)?;
            std::io::copy(&mut fs::File::open(e.path()).map_err(err)?, &mut zw).map_err(err)?;
        }
    }
    zw.finish().map_err(err)?;
    Ok(fs::metadata(&dest).map_err(err)?.len())
}

/// Restaurar: extrae los libros ahora y deja la base como `library.db.restaurar`; se aplica al reiniciar Cinta.
#[tauri::command]
fn restore_library(src: String, lib: State<Lib>) -> Result<(), String> {
    let mut za = zip::ZipArchive::new(fs::File::open(&src).map_err(err)?).map_err(err)?;
    if za.by_name("library.db").is_err() {
        return Err("El archivo no es una copia de Cinta".into());
    }
    for i in 0..za.len() {
        let mut f = za.by_index(i).map_err(err)?;
        let Some(rel) = f.enclosed_name().map(|p| p.to_path_buf()) else { continue };
        if f.is_dir() {
            continue;
        }
        let target = if rel == Path::new("library.db") {
            lib.0.join("library.db.restaurar")
        } else if rel.starts_with("Libros") || rel.starts_with("Fondos") {
            lib.0.join(&rel)
        } else {
            continue;
        };
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(err)?;
        }
        std::io::copy(&mut f, &mut fs::File::create(&target).map_err(err)?).map_err(err)?;
    }
    Ok(())
}

#[tauri::command]
fn add_annotation(
    key: String,
    kind: String,
    loc: String,
    text: String,
    color: String,
    note: String,
    db: State<Db>,
) -> Result<i64, String> {
    if kind != "bookmark" && kind != "highlight" && kind != "ink" {
        return Err("tipo de anotación no válido".into());
    }
    let key = norm_ann_key(&key);
    let conn = db.0.lock().map_err(err)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    conn.execute(
        "INSERT INTO annotations (key, kind, loc, text, color, note, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![key, kind, loc, text, color, note, now],
    )
    .map_err(err)?;
    Ok(conn.last_insert_rowid())
}

/// Cambia el color y/o la nota de una anotación (lo que venga como `None` no se toca).
#[tauri::command]
fn update_annotation(id: i64, color: Option<String>, note: Option<String>, db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(err)?;
    conn.execute(
        "UPDATE annotations SET color = COALESCE(?1, color), note = COALESCE(?2, note) WHERE id = ?3",
        params![color, note, id],
    )
    .map_err(err)?;
    Ok(())
}

#[tauri::command]
fn delete_annotation(id: i64, db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(err)?;
    conn.execute("DELETE FROM annotations WHERE id = ?1", params![id]).map_err(err)?;
    Ok(())
}

/// Marca o desmarca un libro en "Quiero leer".
#[tauri::command]
fn set_want(id: i64, want: bool, db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(err)?;
    conn.execute("UPDATE books SET want = ?1 WHERE id = ?2", params![want as i64, id]).map_err(err)?;
    Ok(())
}

/// Suma segundos de lectura de un libro en un día (clave «AAAA-MM-DD», hora local de la interfaz).
#[tauri::command]
fn log_reading(book_id: i64, day: String, seconds: i64, db: State<Db>) -> Result<(), String> {
    if seconds <= 0 || day.len() != 10 {
        return Ok(());
    }
    let conn = db.0.lock().map_err(err)?;
    conn.execute(
        "INSERT INTO reading_log (day, book_id, seconds) VALUES (?1, ?2, ?3)
         ON CONFLICT(day, book_id) DO UPDATE SET seconds = seconds + excluded.seconds",
        params![day, book_id, seconds],
    )
    .map_err(err)?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadingRow {
    day: String,
    book_id: i64,
    seconds: i64,
}

/// Todo el registro de lectura (una fila por día y libro). Son pocas filas: como mucho una por libro y día.
#[tauri::command]
fn reading_log_all(db: State<Db>) -> Result<Vec<ReadingRow>, String> {
    let conn = db.0.lock().map_err(err)?;
    let mut stmt = conn
        .prepare("SELECT day, book_id, seconds FROM reading_log ORDER BY day")
        .map_err(err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ReadingRow { day: r.get(0)?, book_id: r.get(1)?, seconds: r.get(2)? })
        })
        .map_err(err)?;
    let out = rows.collect::<Result<Vec<_>, _>>().map_err(err)?;
    Ok(out)
}

pub fn run() {
    let portable = portable_dir();
    if let Some(dir) = &portable {
        // Debe fijarse antes de crear la ventana: así localStorage y la caché de WebView2 también quedan junto al .exe.
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", dir.join("WebView2"));
    }
    tauri::Builder::default()
        // Debe ir primero. Si se abre otro libro con «Abrir con», se envía a la ventana que ya está abierta.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(f) = args.iter().skip(1).find(|a| {
                let p = Path::new(a);
                p.is_file() && supported_ext(p).is_some()
            }) {
                let _ = app.emit("open-file", f.clone());
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            let dir = match portable {
                Some(d) => d,
                None => app.path().app_data_dir()?,
            };
            fs::create_dir_all(&dir)?;
            // Restauración pendiente (ver `restore_library`): se aplica antes de abrir la base
            let pendiente = dir.join("library.db.restaurar");
            if pendiente.exists() {
                let _ = fs::copy(dir.join("library.db"), dir.join("library.db.anterior"));
                for sufijo in ["-wal", "-shm", "-journal"] {
                    let _ = fs::remove_file(dir.join(format!("library.db{sufijo}")));
                }
                let _ = fs::rename(&pendiente, dir.join("library.db"));
            }
            let conn = Connection::open(dir.join("library.db"))?;
            migrate(&conn)?;
            install_guide(&conn, &dir); // libro por defecto: «Guía de Cinta»
            app.manage(Db(Mutex::new(conn)));
            app.manage(Lib(dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_books,
            add_books,
            set_book_info,
            get_cover,
            read_book_file,
            remove_book,
            list_collections,
            create_collection,
            delete_collection,
            set_book_collection,
            set_progress,
            set_want,
            startup_file,
            relink_book,
            get_external_progress,
            list_annotations,
            add_annotation,
            update_annotation,
            delete_annotation,
            list_all_annotations,
            set_book_cover_file,
            backup_library,
            restore_library,
            save_text_file,
            log_reading,
            reading_log_all,
            set_background,
            save_background,
            get_background,
            clear_background
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Cinta");
}
