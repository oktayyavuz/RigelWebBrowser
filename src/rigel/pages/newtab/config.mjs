// Yeni sekme ayarları: tek tercih `rigel.newtab` (JSON). Yeni sekme sayfası (newtab.mjs, edit.mjs) ve
// Ayarlar › Yeni sekme (settings/newtab.mjs) aynı modülü kullanır. Tercih yoksa varsayılanlar koddadır.
//
// Şema (normalize hepsini doğrular, eksikleri tamamlar):
//   { layout: "center|left|minimal",
//     widgets: { logo, clock, greeting, date, search, shortcuts },   (bool)
//     hour12: false, name: "",                                         (karşılama adı, isteğe bağlı)
//     grid: { cols 2–8, rows 1–4 },
//     shortcutMode: "auto" (sık ziyaret edilenler) | "custom" (elle), shortcuts: [{ title, url }],
//     bg: { type: "theme|browser|solid|gradient|image", color, from, to, angle, file, dim 0–80, blur 0–40 } }
// Fotoğraf, tarayıcı arka planıyla aynı yolu kullanır (theme/bg.mjs): profil/rigel-bg/ içine kopyalanır,
// `bg.file` yalnız dosya adıdır; bulanıklık önceden üretilmiş `<ad>.b<px>.jpg` kopyasıdır.
import { bgFileName, bgFileUrl, blurName, luminance, PREF as LOOK_PREF, UNDO_PREF, PACKS_PREF } from "chrome://userscripts/content/theme/look.mjs";
import * as Bg from "chrome://userscripts/content/theme/bg.mjs";

export const PREF = "rigel.newtab";
export const TOPSITES_PREF = "rigel.newtab.topsites";
export const LAYOUTS = [["center", "Ortada"], ["left", "Sol üstte"], ["minimal", "Sade"]];
export const WIDGETS = [
  ["logo", "Logo"], ["clock", "Saat"], ["greeting", "Karşılama"], ["date", "Tarih"], ["search", "Arama kutusu"], ["shortcuts", "Kısayollar"],
];
export const BG_TYPES = [["theme", "Tema"], ["browser", "Tarayıcı"], ["solid", "Düz renk"], ["gradient", "Gradyan"], ["image", "Fotoğraf"]];
export const MAX_SHORTCUTS = 48;

export const DEFAULTS = Object.freeze({
  layout: "center",
  widgets: { logo: true, clock: true, greeting: false, date: true, search: true, shortcuts: true },
  hour12: false,
  name: "",
  grid: { cols: 4, rows: 2 },
  shortcutMode: "auto",
  shortcuts: [],
  bg: { type: "theme", color: "#101624", from: "#1d3557", to: "#0c0f16", angle: 160, file: "", dim: 30, blur: 0 },
});

const P = Services.prefs;
const clamp = (v, lo, hi, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def;
};
const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v, def) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : def);

/** Kısayol adresi: şemasızsa https:// eklenir; yalnız http(s). Geçersizse "". */
export function cleanUrl(v) {
  let s = String(v ?? "").trim();
  if (!s || /\s/.test(s)) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    return /^https?:$/.test(u.protocol) && u.hostname ? u.href : "";
  } catch {
    return "";
  }
}
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return String(url);
  }
}

export function normalize(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const D = DEFAULTS;
  const w = r.widgets && typeof r.widgets === "object" ? r.widgets : {};
  const widgets = {};
  for (const [k] of WIDGETS) widgets[k] = typeof w[k] === "boolean" ? w[k] : D.widgets[k];
  const g = r.grid && typeof r.grid === "object" ? r.grid : {};
  const b = r.bg && typeof r.bg === "object" ? r.bg : {};
  const bg = {
    type: BG_TYPES.some(([k]) => k === b.type) ? b.type : D.bg.type,
    color: hex(b.color, D.bg.color), from: hex(b.from, D.bg.from), to: hex(b.to, D.bg.to),
    angle: clamp(b.angle, 0, 360, D.bg.angle), file: bgFileName(b.file),
    dim: clamp(b.dim, 0, 80, D.bg.dim), blur: clamp(b.blur, 0, 40, 0),
  };
  if (bg.type === "image" && !bg.file) bg.type = "theme";
  const seen = new Set();
  const shortcuts = [];
  for (const s of Array.isArray(r.shortcuts) ? r.shortcuts : []) {
    const url = cleanUrl(s?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    shortcuts.push({ title: String(s.title ?? "").trim().slice(0, 40) || hostOf(url), url });
    if (shortcuts.length >= MAX_SHORTCUTS) break;
  }
  return {
    layout: LAYOUTS.some(([k]) => k === r.layout) ? r.layout : D.layout,
    widgets,
    hour12: !!r.hour12,
    name: String(r.name ?? "").trim().slice(0, 30),
    grid: { cols: clamp(g.cols, 2, 8, D.grid.cols), rows: clamp(g.rows, 1, 4, D.grid.rows) },
    shortcutMode: r.shortcutMode === "custom" ? "custom" : "auto",
    shortcuts,
    bg,
  };
}

export function read() {
  try {
    return normalize(JSON.parse(P.getStringPref(PREF, "{}") || "{}"));
  } catch {
    return normalize({});
  }
}
export function write(cfg) {
  const s = JSON.stringify(normalize(cfg));
  if (P.getStringPref(PREF, "{}") !== s) P.setStringPref(PREF, s);
}
/** `fn(cfg)` ayarı yerinde değiştirir (ya da yenisini döndürür); sonuç doğrulanıp yazılır. */
export function patch(fn) {
  const c = read();
  write(fn(c) ?? c);
}
export function reset() {
  P.setStringPref(PREF, "{}");
}

export function watch(fn, extraPrefs = []) {
  const obs = { observe: fn };
  const names = [PREF, TOPSITES_PREF, ...extraPrefs];
  for (const n of names) P.addObserver(n, obs);
  return () => { for (const n of names) try { P.removeObserver(n, obs); } catch {} };
}

// ---- Arka plan ----
export const fileUrl = bgFileUrl;
/** Tarayıcının görünümündeki (rigel.look.bg) arka planı özetler; "tarayıcı" türü için okunaklılık rengi gerekir. */
function lookBg() {
  try {
    return JSON.parse(P.getStringPref(LOOK_PREF, "{}"))?.bg ?? null;
  } catch {
    return null;
  }
}
const mean = (a, b) => (luminance(a) + luminance(b)) / 2;

/**
 * Arka planın CSS'i ve yazı rengi: { css, ink: "light" | "dark" | null, kind }.
 * ink: zemin temadan bağımsız koyu/açıksa yazılar buna göre; null = tema renkleri.
 */
export function backdrop(cfg = read()) {
  const b = cfg.bg;
  const dim = b.dim / 100;
  const inkOf = lum => (lum > 0.4 ? "dark" : "light");
  switch (b.type) {
    case "solid":
      return { css: b.color, ink: inkOf(luminance(b.color)), kind: "solid" };
    case "gradient":
      return { css: `linear-gradient(${b.angle}deg, ${b.from}, ${b.to})`, ink: inkOf(mean(b.from, b.to)), kind: "gradient" };
    case "image": {
      const layer = f => `url("${bgFileUrl(f)}") center / cover no-repeat`;
      const css = [`linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim}))`,
        ...(b.blur > 0 ? [layer(blurName(b.file, b.blur))] : []), layer(b.file)].join(", ");
      return { css, ink: "light", kind: "image" };
    }
    case "browser": {
      const lb = lookBg();
      const css = "var(--rigel-bg-image, linear-gradient(var(--bg), var(--bg)))";
      if (lb?.type === "image") return { css, ink: "light", kind: "image" };
      if (lb?.type === "solid" && HEX.test(lb.color)) return { css, ink: inkOf(luminance(lb.color)), kind: "solid" };
      if (lb?.type === "gradient" && HEX.test(lb.from) && HEX.test(lb.to)) return { css, ink: inkOf(mean(lb.from, lb.to)), kind: "gradient" };
      return { css, ink: null, kind: "theme" };
    }
    default:
      return { css: "", ink: null, kind: "theme" };
  }
}

// ---- Fotoğraf (tarayıcı arka planıyla aynı klasör ve işlemler) ----
/** Hâlâ kullanılan görseller (tarayıcı görünümü, kullanıcı paketleri, geri al yedeği, yeni sekme): bunlar silinmez. */
export function keepFiles() {
  const keep = [read().bg.file];
  const j = (name, def) => { try { return JSON.parse(P.getStringPref(name, "")) ?? def; } catch { return def; } };
  keep.push(j(LOOK_PREF, {})?.bg?.file, j(UNDO_PREF, {})?.look?.bg?.file);
  const packs = j(PACKS_PREF, []);
  if (Array.isArray(packs)) for (const p of packs) keep.push(p?.look?.bg?.file);
  return keep.filter(Boolean);
}
export const pruneLater = () => setTimeout(() => Bg.prune(keepFiles()).catch(() => {}), 500);

/** Dosya seçtirir, rigel-bg/ içine kopyalar ve arka planı "fotoğraf" yapar. Seçilen dosya adı ya da iptalse null. */
export async function pickPhoto(win, doc) {
  const path = await Bg.pick(win, "Yeni sekme arka planı seç");
  if (!path) return null;
  const file = await Bg.importImage(path);
  const { blur } = read().bg;
  if (blur) await Bg.ensureBlur(doc, file, blur);
  patch(c => { c.bg = { ...c.bg, type: "image", file }; });
  pruneLater();
  return file;
}
/** Bulanıklık: kopya (yoksa) üretilir, sonra ayar yazılır. */
export async function setBlur(doc, px) {
  const { file } = read().bg;
  if (file && px) await Bg.ensureBlur(doc, file, px);
  patch(c => { c.bg.blur = px; });
}

// ---- Karşılama ----
export function greeting(date = new Date(), name = "") {
  const h = date.getHours();
  const g = h < 5 ? "İyi geceler" : h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
  return name ? `${g}, ${name}` : g;
}
