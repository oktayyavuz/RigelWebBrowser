// Rigel Mod Mağazası: katalog okuma, doğrulama ve güvenli dosya indirme.
// Biçim: mods/STORE.md. Yönetici (manager.sys.mjs) kurulumu bunun üstüne yapar; bu modül diske yazmaz
// (yalnız profildeki katalog önbelleğine).
//
// Güvenlik ilkeleri:
//  - İndirilen dosyalar: .json, .css ve (yalnız mod.json'da `script: true` ise) tek bir `chrome.mjs`. Betik tam yetkili
//    tarayıcı kodudur: paketle gelen (bundled) katalogdan doğrudan, uzak/bağlantı kaynaklarından yalnız çağıran
//    `allowScript: true` verirse (kullanıcı "Bu mod kod çalıştırır" uyarısını onayladıktan sonra) indirilir.
//    Aksi halde fetchEntryFiles `code = "script-consent"` hatası fırlatır.
//  - Uzak adresler yalnız http/https; yönlendirmeler dahil. Zaman aşımı + boyut sınırı.
//  - CSS'te uzak kaynak (url(http…), @import, yazı tipi vb.), kaçış dizileri, -moz-binding ve dengesiz
//    küme parantezi (kapsayıcı @-moz-document'ten çıkma) reddedilir; @import satırları ayıklanır.
//  - Kimlikler ve dosya adları beyaz listeden gelir (yol gezintisi yok).

import { setTimeout, clearTimeout } from "resource://gre/modules/Timer.sys.mjs";

export const BUNDLED_INDEX = "chrome://userscripts/content/mods/store/index.json";
export const PREF_STORE_URL = "rigel.mods.storeUrl";
export const LIMITS = { index: 768 * 1024, modJson: 32 * 1024, prefs: 32 * 1024, css: 256 * 1024, script: 128 * 1024, entries: 400, timeout: 9000 };
export const LAYOUTS = ["ada", "dock", "komuta", "yanpanel", "klasik"];
const LAYOUT_CSS = LAYOUTS.map(l => `chrome.${l}.css`);
const FILE_KEYS = ["mod.json", "chrome.css", "content.css", "preferences.json", "chrome.mjs", ...LAYOUT_CSS];
const TARGETS = ["chrome", "content", "both"];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const CACHE_DIR = () => PathUtils.join(PathUtils.profileDir, "rigel-mods-cache");

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ---- adresler ----
function schemeOf(url) {
  try { return Services.io.newURI(url).scheme; } catch { return ""; }
}
export const isRemote = url => ["http", "https"].includes(schemeOf(url));
const isBundled = url => url.startsWith("chrome://userscripts/content/mods/store/");

function resolve(rel, base) {
  try {
    return Services.io.newURI(String(rel), null, base ? Services.io.newURI(base) : null).spec;
  } catch {
    return "";
  }
}

/** GitHub arayüz adreslerini ham dosya adresine çevirir (github.com/k/r/tree/dal/yol → raw.githubusercontent.com/k/r/dal/yol). */
export function normalizeInputUrl(input) {
  let u = String(input ?? "").trim();
  if (!u) throw new Error("Adres boş.");
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u;
  if (!isRemote(u)) throw new Error("Yalnız http/https adresleri kabul edilir.");
  let url;
  try { url = new URL(u); } catch { throw new Error("Adres geçersiz."); }
  if (url.hostname === "github.com") {
    const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:tree|blob)\/([^/]+)\/?(.*)$/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`.replace(/\/+$/, "");
  }
  url.hash = "";
  return url.href;
}

// ---- ağ ----
async function getFetch() {
  let f = globalThis.fetch;
  if (!f) {
    try { Cu.importGlobalProperties(["fetch"]); f = globalThis.fetch; } catch {}
  }
  f ??= (w => w?.fetch.bind(w))(Services.wm.getMostRecentWindow("navigator:browser"));
  if (!f) throw new Error("Ağ erişimi yok.");
  return f;
}

/** Sınırlı, zaman aşımlı metin indirme. chrome:// (paket içi) ve http(s) kabul eder. */
export async function fetchText(url, limit, { allowMissing = false } = {}) {
  const remote = isRemote(url);
  if (!remote && !isBundled(url)) throw new Error("İzin verilmeyen adres: " + url);
  const f = await getFetch();
  let ctl = null;
  try { ctl = new AbortController(); } catch {}
  const timer = setTimeout(() => ctl?.abort(), LIMITS.timeout);
  try {
    const r = await f(url, { signal: ctl?.signal, credentials: "omit", cache: remote ? "no-store" : "default", referrerPolicy: "no-referrer" });
    if (remote && r.url && !isRemote(r.url)) throw new Error("Yönlendirme reddedildi.");
    if (!r.ok) {
      if (allowMissing && r.status === 404) return null;
      throw new Error(`${url.split("/").slice(-2).join("/")}: HTTP ${r.status}`);
    }
    const len = Number(r.headers?.get?.("content-length") ?? 0);
    if (len > limit) throw new Error("Dosya çok büyük: " + url.split("/").pop());
    const text = await r.text();
    if (text.length > limit) throw new Error("Dosya çok büyük: " + url.split("/").pop());
    return text;
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("Zaman aşımı: sunucu yanıt vermedi.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
async function fetchJSON(url, limit, opts) {
  const t = await fetchText(url, limit, opts);
  if (t == null) return null;
  try { return JSON.parse(t); } catch { throw new Error("Geçersiz JSON: " + url.split("/").pop()); }
}

// ---- CSS doğrulama ----
const SAFE_URL = [
  /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i,
  /^chrome:\/\/(global|browser|branding|userscripts|rigel)\//i,
  /^#[\w-]+$/,
];
const BAD_URL_STR = /^\s*(https?:|ftp:|file:|javascript:|resource:|moz-extension:|\/\/)/i;

/** Yorumları siler. Dizelerin içindeki "/*" yorum sayılmaz. */
function stripComments(css) {
  let out = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c && css[j] !== "\n") j += css[j] === "\\" ? 2 : 1;
      out += css.slice(i, j + 1);
      i = j;
    } else if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end < 0) { i = css.length; } else { i = end + 1; }
      out += " ";
    } else {
      out += c;
    }
  }
  return out;
}

/**
 * Bir mod CSS'ini doğrular. Döndürür: { css, notes } ya da hata fırlatır.
 * @import satırları ayıklanır (nota yazılır); uzak url(), kaçış dizisi, -moz-binding ve dengesiz
 * parantez reddedilir.
 */
export function sanitizeCss(raw, label = "css") {
  if (typeof raw !== "string") throw new Error(`${label}: metin değil`);
  if (raw.length > LIMITS.css) throw new Error(`${label}: çok büyük`);
  const notes = [];
  let css = stripComments(raw.replace(/^﻿/, ""));
  // Dosyanın en başındaki tek yorum (lisans ve atıf bloğu) olduğu gibi korunur: MIT gibi lisanslar telif
  // notunun kopyalarda kalmasını ister. Yalnız ilk "*/"a kadar alınır; içinde başka yorum açılışı olamaz.
  const lead = raw.replace(/^\uFEFF/, "").match(/^\s*(\/\*[^]*?\*\/)/);
  const header = lead && lead[1].length <= 8192 && !lead[1].slice(2).includes("/*") ? lead[1] + "\n" : "";
  // @import ifadeleri (noktalı virgüle kadar) ayıklanır.
  css = css.replace(/@import\b[^;{}]*;?/gi, () => {
    notes.push("@import kaldırıldı");
    return "";
  });
  // Dizeleri boşaltıp iskelet çıkar: dengeyi ve kaçışları buradan denetle.
  let skeleton = "";
  const strings = [];
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) {
        if (css[j] === "\n") throw new Error(`${label}: kapanmamış dize`);
        j += css[j] === "\\" ? 2 : 1;
      }
      if (j >= css.length) throw new Error(`${label}: kapanmamış dize`);
      strings.push(css.slice(i + 1, j));
      skeleton += '""';
      i = j;
    } else {
      skeleton += c;
    }
  }
  if (skeleton.includes("\\")) throw new Error(`${label}: kaçış dizisi (\\) dizelerin dışında desteklenmez`);
  if (/-moz-binding|expression\s*\(|(?:^|[\s;{])behavior\s*:|@namespace/i.test(skeleton)) throw new Error(`${label}: izin verilmeyen özellik`);
  let depth = 0;
  for (const ch of skeleton) {
    if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) throw new Error(`${label}: dengesiz küme parantezi`);
  }
  if (depth !== 0) throw new Error(`${label}: dengesiz küme parantezi`);
  let paren = 0;
  for (const ch of skeleton) {
    if (ch === "(") paren++;
    else if (ch === ")" && --paren < 0) throw new Error(`${label}: dengesiz parantez`);
  }
  if (paren !== 0) throw new Error(`${label}: dengesiz parantez`);
  // Dize içindeki uzak adresler (image-set("https://…"), src("…") vb.)
  for (const s of strings) if (BAD_URL_STR.test(s)) throw new Error(`${label}: uzak kaynak: ${s.slice(0, 40)}`);
  // url(...) çağrıları
  const urlRe = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;
  for (const m of css.matchAll(urlRe)) {
    const u = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!SAFE_URL.some(r => r.test(u))) throw new Error(`${label}: izin verilmeyen url(): ${u.slice(0, 40)}`);
  }
  if (/url\(/i.test(skeleton.replace(urlRe, "")) ) throw new Error(`${label}: çözümlenemeyen url()`);
  return { css: header + css.trim() + "\n", notes };
}

// ---- mod.json / giriş doğrulama ----
const PREF_TYPES = ["checkbox", "string", "dropdown", "range", "color"];
const fnum = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
export function validatePrefs(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const p of list.slice(0, 24)) {
    // Zen biçimi (property / defaultValue) de kabul edilir.
    const key = str(p?.key ?? p?.property, 40).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
    if (!key || seen.has(key) || !PREF_TYPES.includes(p?.type)) continue;
    seen.add(key);
    const o = { key, label: str(p.label, 80) || key, type: p.type };
    const def = p.default ?? p.defaultValue;
    if (p.type === "checkbox") o.default = !!def;
    else if (p.type === "range") {
      o.min = fnum(p.min, 0); o.max = fnum(p.max, 100); if (o.max <= o.min) o.max = o.min + 1;
      o.step = fnum(p.step, 1) > 0 ? fnum(p.step, 1) : 1;
      o.unit = String(p.unit ?? "").replace(/[^a-z%]/gi, "").slice(0, 6);
      o.default = Math.min(o.max, Math.max(o.min, fnum(def, o.min)));
    } else if (p.type === "color") o.default = /^#[0-9a-f]{6}$/i.test(String(def)) ? String(def).toLowerCase() : "#7c9cff";
    else o.default = str(String(def ?? ""), 120);
    if (p.type === "dropdown") {
      o.options = (Array.isArray(p.options) ? p.options : []).slice(0, 24).map(x => (typeof x === "string"
        ? { value: str(x, 80), label: str(x, 80) }
        : { value: str(String(x?.value ?? ""), 80), label: str(String(x?.label ?? x?.value ?? ""), 80) })).filter(x => x.value);
      if (!o.options.length) continue;
    }
    out.push(o);
  }
  return out;
}

/** Katalog girişini doğrular; geçersizse null. base: göreli adreslerin çözüleceği adres. */
export function normalizeEntry(raw, base, origin) {
  if (!raw || typeof raw !== "object") return null;
  const id = str(raw.id, 48).toLowerCase();
  if (!ID_RE.test(id)) return null;
  const target = TARGETS.includes(raw.target) ? raw.target : "chrome";
  const files = {};
  for (const k of FILE_KEYS) {
    const v = raw.files?.[k];
    if (typeof v !== "string" || !v) continue;
    const url = resolve(v, base);
    if (!url) continue;
    if (origin === "bundled" ? !isBundled(url) : !isRemote(url)) return null;
    files[k] = url;
  }
  if (!files["mod.json"]) return null;
  const hasLayoutCss = LAYOUT_CSS.some(k => files[k]);
  if (target !== "content" && !files["chrome.css"] && !hasLayoutCss && !files["chrome.mjs"]) return null;
  if (target !== "chrome" && !files["content.css"]) return null;
  let preview = "";
  if (typeof raw.preview === "string" && raw.preview) {
    preview = resolve(raw.preview, base);
    if (!(origin === "bundled" ? isBundled(preview) : isRemote(preview))) preview = "";
  }
  let homepage = str(raw.homepage, 300);
  if (homepage && !isRemote(homepage)) homepage = "";
  // Uyarlanan modlar: lisans (SPDX) ve özgün kaynağın adresi (ör. Zen theme-store klasörü).
  const license = str(raw.license, 40);
  let upstream = str(raw.source, 300);
  if (upstream && !isRemote(upstream)) upstream = "";
  const tags = (Array.isArray(raw.tags) ? raw.tags : []).map(t => str(t, 24).toLocaleLowerCase("tr")).filter(Boolean).slice(0, 6);
  return {
    id, name: str(raw.name, 60) || id, description: str(raw.description, 400), author: str(raw.author, 60),
    version: str(raw.version, 20) || "1.0.0", tags, target, homepage, preview, files, origin, license, upstream,
    layouts: (Array.isArray(raw.layouts) ? raw.layouts : []).filter(l => LAYOUTS.includes(l)),
    script: !!files["chrome.mjs"],
  };
}

/** Sürüm karşılaştırma ("1.2.10" > "1.2.9"). a>b ise 1. */
export function compareVersions(a, b) {
  const pa = String(a ?? "0").split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const pb = String(b ?? "0").split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function parseIndex(json, base, origin) {
  const list = Array.isArray(json) ? json : json?.mods;
  if (!Array.isArray(list)) throw new Error("Dizin biçimi geçersiz (mods listesi yok).");
  const out = [];
  const seen = new Set();
  for (const raw of list.slice(0, LIMITS.entries)) {
    const e = normalizeEntry(raw, base, origin);
    if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
  }
  return out;
}

// ---- katalog ----
let cache = null; // { at, result }
const cacheFile = () => PathUtils.join(CACHE_DIR(), "index.json");

async function readCache() {
  try { return JSON.parse(await IOUtils.readUTF8(cacheFile())); } catch { return null; }
}

/**
 * Paket içi + (varsa) uzak katalog. Döndürür: { entries, remote: { url, state: "none"|"ok"|"cached"|"error", error?, count? } }.
 * Uzak katalog ulaşılamazsa profildeki son başarılı kopya kullanılır.
 */
export async function loadCatalog({ refresh = false } = {}) {
  if (cache && !refresh && Date.now() - cache.at < 60_000) return cache.result;
  const map = new Map();
  for (const e of parseIndex(await fetchJSON(BUNDLED_INDEX, LIMITS.index), BUNDLED_INDEX, "bundled")) map.set(e.id, e);
  const remote = { url: "", state: "none" };
  const url = Services.prefs.getStringPref(PREF_STORE_URL, "").trim();
  if (url) {
    remote.url = url;
    let list = null;
    try {
      const norm = normalizeInputUrl(url);
      const json = await fetchJSON(norm, LIMITS.index);
      list = parseIndex(json, norm, "remote");
      remote.state = "ok";
      try {
        await IOUtils.makeDirectory(CACHE_DIR(), { ignoreExisting: true });
        await IOUtils.writeJSON(cacheFile(), { url: norm, at: Date.now(), index: json });
      } catch {}
    } catch (e) {
      remote.error = String(e?.message ?? e);
      const c = await readCache();
      if (c?.index) {
        try { list = parseIndex(c.index, c.url, "remote"); remote.state = "cached"; } catch {}
      }
      if (!list) remote.state = "error";
    }
    remote.count = list?.length ?? 0;
    for (const e of list ?? []) {
      const cur = map.get(e.id);
      if (!cur || compareVersions(e.version, cur.version) >= 0) map.set(e.id, e);
    }
  }
  const entries = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const result = { entries, remote };
  cache = { at: Date.now(), result };
  return result;
}
export function invalidateCatalog() { cache = null; }

/**
 * Bir mod dosyalarını indirir ve doğrular. Döndürür: { meta (mod.json, ham), chrome, content, notes }.
 * meta.prefs, mod.json ile preferences.json'ın birleşimidir.
 */
export async function fetchEntryFiles(entry, { allowScript = false } = {}) {
  const f = entry.files;
  const meta = await fetchJSON(f["mod.json"], LIMITS.modJson);
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) throw new Error("mod.json geçersiz.");
  let prefs = validatePrefs(meta.prefs);
  if (f["preferences.json"]) {
    const extra = await fetchJSON(f["preferences.json"], LIMITS.prefs, { allowMissing: true });
    const list = Array.isArray(extra) ? extra : extra?.prefs;
    const have = new Set(prefs.map(p => p.key));
    for (const p of validatePrefs(list)) if (!have.has(p.key)) prefs.push(p);
  }
  const target = TARGETS.includes(meta.target) ? meta.target : entry.target;
  const notes = [];
  let chrome = "";
  let content = "";
  const layoutCss = {};
  let script = "";
  if (f["chrome.mjs"] && target !== "content") {
    if (!allowScript) {
      const err = new Error("Bu mod kod çalıştırır; kurmak için onay gerekir.");
      err.code = "script-consent";
      throw err;
    }
    script = await fetchText(f["chrome.mjs"], LIMITS.script);
    if (!script.trim()) script = "";
  }
  if (target !== "content") {
    if (f["chrome.css"]) {
      const t = await fetchText(f["chrome.css"], LIMITS.css, { allowMissing: true });
      if (t != null) { const r = sanitizeCss(t, "chrome.css"); chrome = r.css; notes.push(...r.notes); }
    }
    for (const l of LAYOUTS) {
      if (!f[`chrome.${l}.css`]) continue;
      const t = await fetchText(f[`chrome.${l}.css`], LIMITS.css, { allowMissing: true });
      if (t == null) continue;
      const r = sanitizeCss(t, `chrome.${l}.css`);
      if (r.css.trim()) layoutCss[l] = r.css;
      notes.push(...r.notes);
    }
  }
  if (target !== "chrome") {
    const t = await fetchText(f["content.css"], LIMITS.css);
    const r = sanitizeCss(t, "content.css");
    content = r.css; notes.push(...r.notes);
  }
  if (!chrome.trim() && !content.trim() && !script && !Object.keys(layoutCss).length) throw new Error("Mod CSS'i boş.");
  return {
    meta: {
      name: str(meta.name, 60) || entry.name, description: str(meta.description, 400) || entry.description,
      author: str(meta.author, 60) || entry.author, version: str(meta.version, 20) || entry.version, target, prefs,
      layouts: (Array.isArray(meta.layouts) ? meta.layouts : entry.layouts ?? []).filter(l => LAYOUTS.includes(l)),
      priority: meta.priority === "normal" ? "normal" : "override",
      homepage: isRemote(str(meta.homepage, 300)) ? str(meta.homepage, 300) : entry.homepage || "",
      license: str(meta.license, 40) || entry.license || "",
      source: isRemote(str(meta.source, 300)) ? str(meta.source, 300) : entry.upstream || "",
    },
    chrome, content, layoutCss, script, notes,
  };
}

/**
 * "URL'den kur": kullanıcının yapıştırdığı adresi giriş listesine çevirir.
 *  - dizin (mods listesi olan .json)           → tüm girişler
 *  - tek giriş (files alanlı .json)             → o giriş
 *  - mod.json ya da klasör adresi (GitHub dahil) → yanındaki chrome.css / content.css / preferences.json ile tek giriş
 */
export async function resolveUrl(input) {
  const url = normalizeInputUrl(input);
  const isJson = /\.json$/i.test(url.split("?")[0]);
  const dir = (isJson ? url.replace(/[^/]*$/, "") : url.replace(/\/+$/, "") + "/");
  const modJsonUrl = isJson && !/\/(index|themes|catalog)\.json$/i.test(url) ? url : dir + "mod.json";
  const json = await fetchJSON(isJson ? url : modJsonUrl, LIMITS.index);
  if (json && (Array.isArray(json) || Array.isArray(json.mods))) {
    const list = parseIndex(json, url, "remote");
    if (!list.length) throw new Error("Dizinde geçerli mod yok.");
    return list.map(e => ({ ...e, origin: "url", source: url }));
  }
  if (json?.files) {
    const e = normalizeEntry(json, url, "remote");
    if (!e) throw new Error("Giriş geçersiz (kimlik, hedef ve dosya adresleri gerekli).");
    return [{ ...e, origin: "url", source: url }];
  }
  // mod.json: yanındaki dosyaları varsay
  const meta = json;
  if (!meta || typeof meta !== "object" || !meta.name) throw new Error("mod.json bulunamadı ya da 'name' alanı yok.");
  const base = modJsonUrl.replace(/[^/]*$/, "");
  const target = TARGETS.includes(meta.target) ? meta.target : "chrome";
  const id = str(meta.id || meta.name, 48).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const files = { "mod.json": modJsonUrl };
  if (target !== "content") files["chrome.css"] = base + "chrome.css";
  if (target !== "chrome") files["content.css"] = base + "content.css";
  files["preferences.json"] = base + "preferences.json";
  if (meta.script) files["chrome.mjs"] = base + "chrome.mjs";
  for (const l of Array.isArray(meta.layouts) ? meta.layouts : []) if (LAYOUTS.includes(l) && target !== "content") files[`chrome.${l}.css`] = base + `chrome.${l}.css`;
  const e = normalizeEntry({ ...meta, id, files, preview: meta.preview ? meta.preview : undefined }, base, "remote");
  if (!e) throw new Error("Geçerli bir mod kimliği çıkarılamadı.");
  return [{ ...e, origin: "url", source: base }];
}
