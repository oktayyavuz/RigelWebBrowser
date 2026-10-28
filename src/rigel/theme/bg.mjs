// Görsel arka plan dosyaları. Seçilen görsel profilde `rigel-bg/` klasörüne kopyalanır;
// `rigel.look` yalnız dosya adını tutar (theme/look.mjs → file:// URL). Bulanıklık çalışma anında
// CSS filter ile değil, bir kez tuvalde üretilen `<ad>.b<px>.jpg` kopyasıyla verilir.
import { BG_DIR, bgFileName, blurName, bgFileUrl } from "chrome://userscripts/content/theme/look.mjs";

const MAX_BYTES = 40 * 1024 * 1024;
export const dirPath = () => PathUtils.join(PathUtils.profileDir, BG_DIR);

/** Dosya seçici (yalnız resimler). Seçilen yolu ya da null döndürür. */
export function pick(win, title = "Arka plan görseli seç") {
  const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  fp.init(win.browsingContext, title, Ci.nsIFilePicker.modeOpen);
  fp.appendFilters(Ci.nsIFilePicker.filterImages);
  return new Promise(resolve => fp.open(rv => resolve(rv === Ci.nsIFilePicker.returnOK && fp.file ? fp.file.path : null)));
}

/** Görseli rigel-bg/ içine benzersiz, güvenli bir adla kopyalar; dosya adını döndürür. */
export async function importImage(path) {
  const st = await IOUtils.stat(path);
  if (st.type !== "regular") throw new Error("Dosya değil.");
  if (st.size > MAX_BYTES) throw new Error("Görsel 40 MB'den büyük.");
  const base = PathUtils.filename(path);
  const ext = (base.match(/\.(png|jpe?g|webp|gif|avif)$/i)?.[1] ?? "").toLowerCase();
  if (!ext) throw new Error("Desteklenen biçimler: PNG, JPEG, WebP, GIF, AVIF.");
  const stem = base.slice(0, -ext.length - 1).normalize("NFD").replace(/[^\w-]+/g, "-").replace(/^[-_]+|-+$/g, "").slice(0, 40) || "gorsel";
  const name = `${stem}-${Date.now().toString(36)}.${ext}`;
  if (!bgFileName(name)) throw new Error("Geçersiz dosya adı.");
  await IOUtils.makeDirectory(dirPath(), { ignoreExisting: true });
  await IOUtils.copy(path, PathUtils.join(dirPath(), name));
  return name;
}

export const exists = name => IOUtils.exists(PathUtils.join(dirPath(), name));

/** Bulanık kopyayı (yoksa) üretir. `doc`: tuval oluşturulabilecek herhangi bir belge. */
export async function ensureBlur(doc, name, px) {
  if (!px || !bgFileName(name)) return;
  const out = PathUtils.join(dirPath(), blurName(name, px));
  if (await IOUtils.exists(out)) return;
  const img = doc.createElementNS("http://www.w3.org/1999/xhtml", "img");
  img.src = bgFileUrl(name);
  await img.decode();
  const scale = Math.min(1, 1920 / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = doc.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  // Kenarlar şeffaflaşmasın: görsel bulanıklık payı kadar taşırılarak çizilir.
  const m = px * 2;
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(img, -m, -m, w + 2 * m, h + 2 * m);
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
  await IOUtils.write(out, new Uint8Array(await blob.arrayBuffer()));
}

/** Kullanılmayan görselleri siler (`keep`: tutulacak dosya adları; bulanık kopyaları da tutulur). */
export async function prune(keep) {
  const stems = [...keep].filter(Boolean).map(n => n.replace(/\.[^.]+$/, ""));
  let kids = [];
  try { kids = await IOUtils.getChildren(dirPath()); } catch { return; }
  for (const p of kids) {
    const f = PathUtils.filename(p);
    if (!stems.some(s => f === s || f.startsWith(s + "."))) await IOUtils.remove(p).catch(() => {});
  }
}
