// Rigel Modları: kullanıcı CSS'i ile tarayıcı arayüzünü (chrome) ve/veya web sayfalarını (content) yeniden biçimlendirir.
// Zen Mods'tan esinlenildi (MPL-2.0), kod sıfırdan. Tek örnek (modül tekili): tüm pencereler ve ayarlar sayfası aynı yöneticiyi kullanır.
//
// Depolama:   <profil>/rigel-mods/<id>/{mod.json, chrome.css, content.css}
// Tercihler:  rigel.mods.enabled  (JSON, etkin mod kimlikleri)
//             rigel.mods.values   (JSON, { "<id>": { "<anahtar>": değer } } mod ayarları)
//             rigel.mods.seeded   (JSON, ilk çalıştırmada kopyalanmış yerleşik mod kimlikleri)
// Uygulama:   chrome CSS -> her tarayıcı penceresinde windowUtils, İKİ katmanda: AUTHOR_SHEET (normal kurallar, özgüllük
//             yarışı) + USER_SHEET (`!important` kuralları Rigel'in author `!important`'larını kesin yener; kaskad sırası:
//             user !important > author !important). mod.json `priority: "normal"` yalnız AUTHOR katmanında bırakır.
//             content CSS -> nsIStyleSheetService USER_SHEET (@-moz-document ile yalnız web adreslerine)
// Düzene göre: mod.json `layouts` (yalnız bu düzenlerde etkin) ve `chrome.<düzen>.css` (yalnız o düzen etkinken eklenir).
//             Düzen pencere kökündeki `data-rigel-layout` özniteliğinden izlenir (MutationObserver).
// Betik:      mod.json `script: true` + `chrome.mjs` (mods/runtime.mjs pencere başına çalıştırır). Yalnız güvenilen modlarda:
//             yerleşik / paketle gelen mağaza modu ya da kullanıcının onayladığı (`trust`) mod.
// Mod ayarları CSS'e: kökte `rigel-mod-<id>-<anahtar>` özniteliği (onay kutusu: "true", kapalıysa yok; seçim/metin/renk: değer;
//             kaydırıcı: sayı) ve `--rigel-mod-<id>-<anahtar>` CSS değişkeni (onay kutusu 1/0, kaydırıcı sayı+birim, renk #rrggbb,
//             ayrıca renk için `-rgb` değişkeni "r, g, b"). Chrome'da bunlar kök öğenin satır içi stilidir: ayar değişince
//             stil sayfaları yeniden yüklenmeden canlı güncellenir.
// Bildirimler: Services.obs "rigel-mods-list" (liste/dosya değişti), "rigel-mods-state" (etkin/ayar değişti).

import { fetchEntryFiles, compareVersions } from "chrome://userscripts/content/mods/store.sys.mjs";

const BUILTIN_BASE = "chrome://userscripts/content/mods/builtin/";
const PREF_ENABLED = "rigel.mods.enabled";
const PREF_VALUES = "rigel.mods.values";
const PREF_SEEDED = "rigel.mods.seeded";
const PREVIEW_ID = "__preview__";
export const LAYOUT_NAMES = ["ada", "dock", "komuta", "yanpanel", "klasik"];
const PREF_TYPES = ["checkbox", "string", "dropdown", "range", "color"];
const HEX_RE = /^#[0-9a-f]{6}$/i;
const WEB_RE = '^(https?|ftp|file|data|blob|moz-extension):.*';

const P = Services.prefs;
const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);

export const slug = s => String(s ?? "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const safeKey = s => slug(s) || "x";

function jsonPref(name, def) {
  try {
    const v = JSON.parse(P.getStringPref(name, ""));
    return v && typeof v === "object" ? v : def;
  } catch {
    return def;
  }
}
const cssUri = css => "data:text/css;charset=utf-8," + encodeURIComponent(css);
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
/** Ayar değerini türüne göre düzeltir (aralık dışı sayı, geçersiz renk vb.). */
export function coerceValue(p, v) {
  if (p.type === "checkbox") return v === "false" ? false : !!v;
  if (p.type === "range") return Math.min(p.max, Math.max(p.min, num(v, p.default)));
  if (p.type === "color") return HEX_RE.test(String(v)) ? String(v).toLowerCase() : p.default;
  return String(v ?? p.default ?? "");
}
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(", ");
const cssValue = v => String(v ?? "").replace(/[;{}<>\\\n\r]/g, "").trim();

async function fetchText(url) {
  let f = globalThis.fetch;
  if (!f) {
    try { Cu.importGlobalProperties(["fetch"]); f = globalThis.fetch; } catch {}
  }
  f ??= Services.wm.getMostRecentWindow("navigator:browser")?.fetch.bind(Services.wm.getMostRecentWindow("navigator:browser"));
  const r = await f(url);
  if (!r.ok) throw new Error(url + " okunamadı");
  return r.text();
}

class ModManager {
  constructor() {
    this.dir = PathUtils.join(PathUtils.profileDir, "rigel-mods");
    // Betikler ES modülü olarak import() edilir; pencere yükleyicisi file:/data:/blob: adreslerini reddeder, chrome:// kabul eder.
    // fx-autoconfig `chrome/resources` klasörünü chrome://userchrome/content/ olarak sunar: betiğin bir kopyası oraya yazılır.
    this.scriptRoot = PathUtils.join(PathUtils.profileDir, "chrome", "resources", "rigel-mods");
    this.mods = new Map(); // id -> { meta, chrome, content }
    this.windows = new Set();
    this.windowSheets = new WeakMap(); // pencere -> [{ uri, type }]
    this.windowVars = new WeakMap(); // pencere -> kökte yazılmış CSS değişken adları
    this.contentSheets = []; // kayıtlı USER_SHEET adresleri
    this.preview = null; // { id, name?, target, chrome, content }
    this.rev = 0; // betik/CSS dosyası değişimi sayacı (çalışma zamanı yeniden yüklensin diye)
    this.errors = new Map(); // mod kimliği -> son betik hatası (ayarlar gösterir)
    this.ready = null;
    const self = this;
    this._obs = { observe(_s, topic, data) { if (topic === "nsPref:changed") self._onPref(data); } };
    P.addObserver(PREF_ENABLED, this._obs);
    P.addObserver(PREF_VALUES, this._obs);
  }

  /** İlk çağrıda diskten okur, yerleşik modları kopyalar ve içerik CSS'ini uygular. */
  init() {
    return (this.ready ??= this._init());
  }
  async _init() {
    try {
      await IOUtils.makeDirectory(this.dir, { ignoreExisting: true });
      await this._seedBuiltins();
      await this._scan();
    } catch (e) {
      console.error("[rigel] mods başlatılamadı", e);
    }
    this._applyContent();
    this._applyAllWindows();
    this._notify("list");
  }

  // ---- durum ----
  enabledIds() {
    const v = jsonPref(PREF_ENABLED, []);
    return Array.isArray(v) ? v.filter(x => typeof x === "string") : [];
  }
  isEnabled(id) { return this.enabledIds().includes(id); }
  values() { return jsonPref(PREF_VALUES, {}); }
  getValue(id, pref) {
    const v = this.values()[id]?.[pref.key];
    return v === undefined ? pref.default : coerceValue(pref, v);
  }
  /** Arayüz için liste (ad sırasıyla). */
  list() {
    return [...this.mods.values()].map(m => ({ ...m.meta, enabled: this.isEnabled(m.meta.id), hasChrome: !!m.chrome || Object.keys(m.layoutCss ?? {}).length > 0, hasContent: !!m.content, needsConsent: this.needsConsent(m.meta.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }
  get(id) {
    const m = this.mods.get(id);
    return m ? { meta: { ...m.meta, enabled: this.isEnabled(id) }, chrome: m.chrome, content: m.content, layoutCss: m.layoutCss ?? {} } : null;
  }

  /** Betikli bir mod güvenilir mi? (yerleşik, paketle gelen mağaza modu ya da kullanıcının onayladığı.) */
  isTrusted(id) {
    const m = this.mods.get(id)?.meta;
    return !!m && (m.builtin || m.trust === "bundled" || m.trust === "user");
  }
  /** Etkinleştirmeden önce kullanıcı onayı gereken betikli mod. */
  needsConsent(id) {
    const m = this.mods.get(id)?.meta;
    return !!m?.script && !this.isTrusted(id);
  }
  /** Kullanıcı "bu mod kod çalıştırır" uyarısını onayladı: modu güvenilir işaretler (mod.json'a yazar). */
  async approveScript(id) {
    const m = this.mods.get(id);
    if (!m) return;
    m.meta.trust = "user";
    await this._writeMod(id, m.meta, m.chrome, m.content, { layoutCss: m.layoutCss, script: m.script });
    this.rev++;
    this._notify("list");
  }
  setEnabled(id, on) {
    if (!this.mods.has(id)) return false;
    if (on && this.needsConsent(id)) return false; // onaysız betikli mod açılmaz (arayüz önce onay ister)
    const cur = this.enabledIds().filter(x => x !== id);
    if (on) cur.push(id);
    P.setStringPref(PREF_ENABLED, JSON.stringify(cur));
    return true;
  }
  setValue(id, key, value) {
    const all = this.values();
    (all[id] ??= {})[key] = value;
    P.setStringPref(PREF_VALUES, JSON.stringify(all));
  }
  /** Tek mod için tüm ayarları varsayılana döndürür. */
  resetValues(id) {
    const all = this.values();
    delete all[id];
    P.setStringPref(PREF_VALUES, JSON.stringify(all));
  }

  // ---- disk ----
  _normalize(raw, id) {
    const target = ["chrome", "content", "both"].includes(raw?.target) ? raw.target : "chrome";
    const prefs = [];
    for (const p of Array.isArray(raw?.prefs) ? raw.prefs : []) {
      if (!p?.key || !PREF_TYPES.includes(p.type)) continue;
      const o = { key: safeKey(p.key), label: String(p.label ?? p.key), type: p.type };
      if (p.type === "checkbox") o.default = !!p.default;
      else if (p.type === "range") {
        o.min = num(p.min, 0); o.max = num(p.max, 100); if (o.max <= o.min) o.max = o.min + 1;
        o.step = num(p.step, 1) > 0 ? num(p.step, 1) : 1;
        o.unit = String(p.unit ?? "").replace(/[^a-z%]/gi, "").slice(0, 6);
        o.default = Math.min(o.max, Math.max(o.min, num(p.default, o.min)));
      } else if (p.type === "color") o.default = HEX_RE.test(String(p.default)) ? String(p.default).toLowerCase() : "#7c9cff";
      else o.default = String(p.default ?? "");
      if (p.type === "dropdown") o.options = (Array.isArray(p.options) ? p.options : []).map(x => (typeof x === "string" ? { value: x, label: x } : { value: String(x.value), label: String(x.label ?? x.value) }));
      prefs.push(o);
    }
    return {
      id, name: String(raw?.name ?? id), description: String(raw?.description ?? ""), author: String(raw?.author ?? ""),
      version: String(raw?.version ?? "1.0.0"), target, prefs, builtin: !!raw?.builtin,
      // Yalnız bu düzenlerde etkin (boş: hepsinde). Öncelik: "override" (varsayılan; user katmanı da) | "normal" (yalnız author).
      layouts: (Array.isArray(raw?.layouts) ? raw.layouts : []).map(String).filter(l => LAYOUT_NAMES.includes(l)),
      priority: raw?.priority === "normal" ? "normal" : "override",
      script: !!raw?.script, trust: ["bundled", "user"].includes(raw?.trust) ? raw.trust : undefined,
      // Uyarlanan modlar için atıf: ana sayfa, lisans (SPDX), özgün kaynak adresi.
      homepage: String(raw?.homepage ?? ""), license: String(raw?.license ?? ""), source: String(raw?.source ?? ""),
      // Mağazadan kurulduysa köken: { id, version, origin: "bundled"|"remote"|"url", source? }
      store: raw?.store && typeof raw.store === "object" ? { id: String(raw.store.id ?? id), version: String(raw.store.version ?? ""), origin: String(raw.store.origin ?? ""), source: String(raw.store.source ?? "") } : undefined,
    };
  }
  async _readMod(id) {
    const base = PathUtils.join(this.dir, id);
    let raw = {};
    try { raw = JSON.parse(await IOUtils.readUTF8(PathUtils.join(base, "mod.json"))); } catch { return null; }
    const read = async f => (await IOUtils.exists(PathUtils.join(base, f))) ? IOUtils.readUTF8(PathUtils.join(base, f)) : "";
    const layoutCss = {};
    for (const l of LAYOUT_NAMES) { const t = await read(`chrome.${l}.css`); if (t) layoutCss[l] = t; }
    const meta = this._normalize(raw, id);
    const script = meta.script ? await read("chrome.mjs") : "";
    if (meta.script && !script) meta.script = false;
    if (script) await this._mirrorScript(id, script);
    return { meta, chrome: await read("chrome.css"), content: await read("content.css"), layoutCss, script };
  }
  async _scan() {
    const next = new Map();
    let kids = [];
    try { kids = await IOUtils.getChildren(this.dir); } catch {}
    for (const p of kids) {
      const id = PathUtils.filename(p);
      if (id.startsWith(".")) continue;
      try {
        if ((await IOUtils.stat(p)).type !== "directory") continue;
        const m = await this._readMod(id);
        if (m) next.set(id, m);
      } catch (e) {
        console.warn("[rigel] mod okunamadı", id, e);
      }
    }
    this.mods = next;
  }
  async _seedBuiltins() {
    let index = [];
    try { index = JSON.parse(await fetchText(BUILTIN_BASE + "index.json")); } catch (e) { console.warn("[rigel] yerleşik mod dizini", e); return; }
    const seeded = new Set(jsonPref(PREF_SEEDED, []));
    for (const id of index) {
      const base = PathUtils.join(this.dir, id);
      const exists = await IOUtils.exists(base);
      let meta;
      try { meta = JSON.parse(await fetchText(`${BUILTIN_BASE}${id}/mod.json`)); } catch { continue; }
      if (!exists && seeded.has(id)) continue; // kullanıcı silmiş
      if (exists) {
        // Yerleşik mod yeni sürümse dosyalar güncellenir (kullanıcı düzenlemeleri bu sürümde kaybolur).
        let cur = {};
        try { cur = JSON.parse(await IOUtils.readUTF8(PathUtils.join(base, "mod.json"))); } catch {}
        if (!cur.builtin || cur.version === meta.version) continue;
      }
      await IOUtils.makeDirectory(base, { ignoreExisting: true });
      await IOUtils.writeUTF8(PathUtils.join(base, "mod.json"), JSON.stringify({ ...meta, id, builtin: true }, null, 2));
      for (const f of [meta.target !== "content" && "chrome.css", meta.target !== "chrome" && "content.css", meta.script && "chrome.mjs", ...(meta.layouts ?? []).map(l => `chrome.${l}.css`)].filter(Boolean)) {
        try { await IOUtils.writeUTF8(PathUtils.join(base, f), await fetchText(`${BUILTIN_BASE}${id}/${f}`)); } catch {}
      }
      seeded.add(id);
    }
    P.setStringPref(PREF_SEEDED, JSON.stringify([...seeded]));
  }

  async reload() {
    await this.init();
    await this._scan();
    this._applyContent();
    this._applyAllWindows();
    this._notify("list");
  }

  async _writeMod(id, meta, chrome, content, { layoutCss = {}, script = "" } = {}) {
    const base = PathUtils.join(this.dir, id);
    await IOUtils.makeDirectory(base, { ignoreExisting: true });
    const out = { id, name: meta.name, description: meta.description ?? "", author: meta.author ?? "", version: meta.version ?? "1.0.0", target: meta.target, enabled: false };
    for (const k of ["homepage", "license", "source"]) if (meta[k]) out[k] = meta[k];
    if (meta.prefs?.length) out.prefs = meta.prefs;
    if (meta.layouts?.length) out.layouts = meta.layouts;
    if (meta.priority === "normal") out.priority = "normal";
    if (script) { out.script = true; if (meta.trust) out.trust = meta.trust; }
    if (meta.builtin) out.builtin = true;
    if (meta.store) out.store = meta.store;
    await IOUtils.writeUTF8(PathUtils.join(base, "mod.json"), JSON.stringify(out, null, 2));
    const put = async (f, text, keep) => {
      if (keep && text) await IOUtils.writeUTF8(PathUtils.join(base, f), text);
      else await IOUtils.remove(PathUtils.join(base, f), { ignoreAbsent: true });
    };
    await put("chrome.css", chrome ?? "", meta.target !== "content");
    if (meta.target !== "content" && !chrome) await IOUtils.writeUTF8(PathUtils.join(base, "chrome.css"), "");
    await put("content.css", content ?? "", meta.target !== "chrome");
    if (meta.target !== "chrome" && !content) await IOUtils.writeUTF8(PathUtils.join(base, "content.css"), "");
    for (const l of LAYOUT_NAMES) await put(`chrome.${l}.css`, layoutCss[l] ?? "", meta.target !== "content");
    await put("chrome.mjs", script, true);
    await this._mirrorScript(id, script);
  }

  /** Yeni mod oluşturur; kimliği adından türetir. Etkin olarak başlar. */
  async create({ name, description = "", author = "", target = "chrome", chrome = "", content = "", prefs = [], layouts = [], priority, layoutCss = {}, script = "", enable = true }) {
    await this.init();
    name = String(name ?? "").trim() || "Adsız mod";
    let id = slug(name) || "mod";
    for (let n = 2; this.mods.has(id) || (await IOUtils.exists(PathUtils.join(this.dir, id))); n++) id = `${slug(name) || "mod"}-${n}`;
    // İçe aktarılan betik güvenilir değildir: kullanıcı onaylamadan çalışmaz (needsConsent).
    const meta = this._normalize({ name, description, author, target, prefs, layouts, priority, script: !!script }, id);
    await this._writeMod(id, meta, chrome, content, { layoutCss, script });
    this.mods.set(id, { meta, chrome: target === "content" ? "" : chrome, content: target === "chrome" ? "" : content, layoutCss: target === "content" ? {} : layoutCss, script });
    this.rev++;
    this.clearPreview(true);
    if (enable) this.setEnabled(id, true);
    this._applyContent();
    this._applyAllWindows();
    this._notify("list");
    return id;
  }

  /** Var olan modun adı, açıklaması, hedefi ve CSS'ini günceller. */
  async update(id, patch) {
    const m = this.mods.get(id);
    if (!m) throw new Error("mod yok: " + id);
    const meta = this._normalize({ ...m.meta, ...patch, prefs: patch.prefs ?? m.meta.prefs }, id);
    const chrome = patch.chrome ?? m.chrome;
    const content = patch.content ?? m.content;
    await this._writeMod(id, meta, chrome, content, { layoutCss: m.layoutCss, script: m.script });
    this.mods.set(id, { meta, chrome: meta.target === "content" ? "" : chrome, content: meta.target === "chrome" ? "" : content, layoutCss: m.layoutCss, script: m.script });
    this.rev++;
    this.clearPreview(true);
    this._applyContent();
    this._applyAllWindows();
    this._notify("list");
  }

  async remove(id) {
    if (!this.mods.has(id)) return;
    this.mods.delete(id);
    P.setStringPref(PREF_ENABLED, JSON.stringify(this.enabledIds().filter(x => x !== id)));
    this.resetValues(id);
    await IOUtils.remove(PathUtils.join(this.dir, id), { recursive: true, ignoreAbsent: true });
    await this._mirrorScript(id, "");
    this._applyContent();
    this._applyAllWindows();
    this._notify("list");
  }

  // ---- mağaza (mods/store.sys.mjs, mods/STORE.md) ----
  /** Katalog girişinden kurar ya da günceller. Kimlik = giriş kimliği. Yeni kurulum varsayılan olarak açılır;
   *  güncellemede açık/kapalı durum ve mod ayarları korunur. Kimliği döndürür. */
  async installFromCatalog(entry, { enable = true, allowScript = false } = {}) {
    await this.init();
    const id = String(entry?.id ?? "");
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) throw new Error("Geçersiz mod kimliği.");
    const cur = this.mods.get(id);
    if (cur && !cur.meta.store) throw new Error(`"${id}" kimliğinde mağazadan gelmeyen bir mod zaten var. Önce onu sil ya da yeniden adlandır.`);
    // Betikli mod: paketle gelen katalog güvenilir; uzak/bağlantı kaynakları kullanıcı onayı (allowScript) ister.
    const bundled = entry.origin === "bundled";
    const got = await fetchEntryFiles(entry, { allowScript: bundled || allowScript });
    const meta = this._normalize({
      ...got.meta, id, script: !!got.script,
      trust: got.script ? (bundled ? "bundled" : "user") : undefined,
      store: { id, version: got.meta.version, origin: entry.origin ?? "remote", source: entry.source ?? "" },
    }, id);
    await this._writeMod(id, meta, got.chrome, got.content, { layoutCss: got.layoutCss, script: got.script });
    this.mods.set(id, { meta, chrome: meta.target === "content" ? "" : got.chrome, content: meta.target === "chrome" ? "" : got.content, layoutCss: meta.target === "content" ? {} : got.layoutCss, script: got.script });
    this.rev++;
    if (!cur) {
      if (enable) this.setEnabled(id, true);
    }
    this.clearPreview(true);
    this._applyContent();
    this._applyAllWindows();
    this._notify("list");
    return { id, notes: got.notes, updated: !!cur };
  }
  /** Kurulu bir mağaza modunun, verilen girişe göre güncellenebilir olup olmadığı. */
  hasUpdate(entry) {
    const m = this.mods.get(entry?.id);
    return !!m?.meta.store && compareVersions(entry.version, m.meta.version) > 0;
  }
  isFromStore(id) { return !!this.mods.get(id)?.meta.store; }

  /** Klasörden içe aktarır: mod.json'lu klasör ya da içinde chrome.css/content.css/*.css olan klasör. Yeni kimliği döndürür. */
  async importFolder(path) {
    await this.init();
    let raw = null;
    const mj = PathUtils.join(path, "mod.json");
    if (await IOUtils.exists(mj)) raw = JSON.parse(await IOUtils.readUTF8(mj));
    const read = async f => (await IOUtils.exists(PathUtils.join(path, f))) ? IOUtils.readUTF8(PathUtils.join(path, f)) : "";
    let chrome = await read("chrome.css");
    let content = await read("content.css");
    if (!raw && !chrome && !content) {
      // Basit klasör: *.css dosyalarını birleştir (userChrome.css → chrome, userContent.css → content).
      chrome = (await read("userChrome.css")) || (await read("userchrome.css"));
      content = (await read("userContent.css")) || (await read("usercontent.css"));
    }
    const layoutCss = {};
    for (const l of LAYOUT_NAMES) { const t = await read(`chrome.${l}.css`); if (t) layoutCss[l] = t; }
    const script = raw?.script ? await read("chrome.mjs") : "";
    if (!chrome && !content && !script && !Object.keys(layoutCss).length) throw new Error("Klasörde chrome.css, content.css ya da mod.json bulunamadı.");
    const target = raw?.target ?? (chrome && content ? "both" : content ? "content" : "chrome");
    const name = raw?.name ?? PathUtils.filename(path);
    return this.create({ ...(raw ?? {}), name, target, chrome, content, layoutCss, script, enable: false });
  }

  /** Tek bir .css dosyasından mod oluşturur. */
  async importCss(path, target = "chrome") {
    const css = await IOUtils.readUTF8(path);
    const name = PathUtils.filename(path).replace(/\.css$/i, "");
    const t = ["chrome", "content", "both"].includes(target) ? target : "chrome";
    return this.create({ name, description: "İçe aktarılan CSS dosyası", target: t, chrome: t === "content" ? "" : css, content: t === "chrome" ? "" : css, enable: false });
  }

  revealFolder() {
    const f = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    f.initWithPath(this.dir);
    try {
      f.launch();
    } catch {
      Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService).loadURI(Services.io.newFileURI(f));
    }
  }

  // ---- önizleme (kaydedilmemiş CSS'in canlı uygulanması) ----
  /** id verilirse o modun CSS'i geçici olarak ezilir (kapalıysa da uygulanır); yoksa geçici bir mod gibi eklenir. */
  setPreview(p) {
    this.preview = p ? { id: p.id ?? PREVIEW_ID, target: p.target ?? "chrome", chrome: p.chrome ?? "", content: p.content ?? "", prefs: p.prefs } : null;
    this._applyContent();
    this._applyAllWindows();
  }
  clearPreview(silent = false) {
    if (!this.preview) return;
    this.preview = null;
    if (!silent) {
      this._applyContent();
      this._applyAllWindows();
    }
  }

  // ---- CSS üretimi ----
  _active() {
    const on = new Set(this.enabledIds());
    const out = [];
    const pv = this.preview;
    for (const m of this.mods.values()) {
      if (pv && pv.id === m.meta.id) continue;
      if (on.has(m.meta.id)) out.push({ meta: m.meta, chrome: m.chrome, content: m.content, layoutCss: m.layoutCss, script: m.script });
    }
    if (pv) {
      const base = this.mods.get(pv.id);
      out.push({ meta: { id: pv.id, target: pv.target, prefs: pv.prefs ?? base?.meta.prefs ?? [], layouts: base?.meta.layouts ?? [], priority: base?.meta.priority }, chrome: pv.chrome, content: pv.content, layoutCss: base?.layoutCss });
    }
    return out;
  }
  /** Modun ayarları: [{ key, css, attr, rgb? }]. css: CSS değişkeni değeri; attr: kök özniteliği değeri (null: öznitelik yok). */
  _prefVars(mod) {
    const id = safeKey(mod.meta.id);
    const vals = this.values()[mod.meta.id] ?? {};
    return (mod.meta.prefs ?? []).map(p => {
      const v = vals[p.key] === undefined ? p.default : coerceValue(p, vals[p.key]);
      const o = { name: `--rigel-mod-${id}-${p.key}`, attr: `rigel-mod-${id}-${p.key}` };
      if (p.type === "checkbox") { o.css = v ? "1" : "0"; o.attrValue = v ? "true" : null; }
      else if (p.type === "range") { o.css = `${v}${p.unit ?? ""}`; o.attrValue = String(v); }
      else if (p.type === "color") { o.css = v; o.attrValue = v; o.rgb = hexRgb(v); }
      else { o.css = cssValue(v) || "initial"; o.attrValue = String(v); }
      return o;
    });
  }
  _vars(mod) {
    // Yalnız içerik CSS'i için (web sayfalarında kök stili yok). Chrome'da kökün satır içi stili kullanılır.
    const lines = [];
    for (const o of this._prefVars(mod)) {
      lines.push(`${o.name}: ${o.css};`);
      if (o.rgb) lines.push(`${o.name}-rgb: ${o.rgb};`);
    }
    return lines.length ? `:root { ${lines.join(" ")} }\n` : "";
  }
  /** Bu pencerenin düzeni: kök özniteliği, yoksa rigel.layout tercihi. */
  layoutOf(win) {
    return win?.document?.documentElement?.getAttribute("data-rigel-layout") || P.getStringPref("rigel.layout", "yanpanel");
  }
  /** Mod bu düzende etkin mi? (`layouts` boşsa her düzende.) */
  allowedIn(mod, layout) {
    const l = mod.meta.layouts;
    return !l?.length || l.includes(layout);
  }
  /** Bu pencerede etkin modlar (etkin + düzene uygun). */
  activeFor(win) {
    const layout = this.layoutOf(win);
    return this._active().filter(m => this.allowedIn(m, layout));
  }
  _chromeCss(mod, layout) {
    if (mod.meta.target === "content") return null;
    const css = [mod.chrome, mod.layoutCss?.[layout]].filter(t => t?.trim()).join("\n");
    return css ? `/* rigel-mod:${mod.meta.id} chrome ${layout} */\n${css}\n` : null;
  }
  _contentCss(mod) {
    if (mod.meta.target === "chrome" || !mod.content?.trim()) return null;
    return `/* rigel-mod:${mod.meta.id} content */\n@-moz-document regexp("${WEB_RE}") {\n${this._vars(mod)}${mod.content}\n}\n`;
  }

  /** Kökteki öznitelikler ve satır içi CSS değişkenleri: canlı (stil sayfası yeniden yüklenmez). */
  _syncValues(win) {
    const root = win.document?.documentElement;
    if (!root) return;
    for (const a of [...root.attributes]) if (a.name.startsWith("rigel-mod-")) root.removeAttribute(a.name);
    const want = new Map();
    for (const mod of this.activeFor(win)) {
      if (mod.meta.target === "content") continue;
      for (const o of this._prefVars(mod)) {
        want.set(o.name, o.css);
        if (o.rgb) want.set(o.name + "-rgb", o.rgb);
        if (o.attrValue != null) root.setAttribute(o.attr, o.attrValue);
      }
    }
    const had = this.windowVars.get(win) ?? new Set();
    for (const n of had) if (!want.has(n)) root.style.removeProperty(n);
    for (const [n, v] of want) if (root.style.getPropertyValue(n) !== v) root.style.setProperty(n, v);
    this.windowVars.set(win, new Set(want.keys()));
  }

  _applyWindow(win) {
    const wu = win.windowUtils;
    if (!wu) return;
    for (const { uri, type } of this.windowSheets.get(win) ?? []) {
      try { wu.removeSheetUsingURIString(uri, type); } catch {}
    }
    const loaded = [];
    const layout = this.layoutOf(win);
    for (const mod of this.activeFor(win)) {
      const css = this._chromeCss(mod, layout);
      if (!css) continue;
      // İki katman: AUTHOR (normal kurallar, özgüllük yarışı) + USER (`!important` bildirimleri Rigel'in author `!important`'larını yener).
      const layers = [[css, wu.AUTHOR_SHEET]];
      if (mod.meta.priority !== "normal") layers.push([`/* user */\n${css}`, wu.USER_SHEET]);
      for (const [text, type] of layers) {
        const uri = cssUri(text);
        try { wu.loadSheetUsingURIString(uri, type); loaded.push({ uri, type }); } catch (e) { console.error("[rigel] mod CSS yüklenemedi", mod.meta.id, e); }
      }
    }
    this.windowSheets.set(win, loaded);
    this._syncValues(win);
  }
  _applyAllWindows() {
    for (const w of this.windows) this._applyWindow(w);
    this._notify("state");
  }
  _applyContent() {
    for (const uri of this.contentSheets) {
      try { const u = Services.io.newURI(uri); if (sss.sheetRegistered(u, sss.USER_SHEET)) sss.unregisterSheet(u, sss.USER_SHEET); } catch {}
    }
    this.contentSheets = [];
    for (const mod of this._active()) {
      const css = this._contentCss(mod);
      if (!css) continue;
      const uri = cssUri(css);
      try { sss.loadAndRegisterSheet(Services.io.newURI(uri), sss.USER_SHEET); this.contentSheets.push(uri); } catch (e) { console.error("[rigel] içerik CSS kaydedilemedi", mod.meta.id, e); }
    }
  }

  // ---- betik (mods/runtime.mjs bunları kullanır) ----
  /** Bu pencerede çalışması gereken betikli modlar: [{ id, name, rev, prefs, trusted }]. */
  scriptsFor(win) {
    return this.activeFor(win).filter(m => m.meta.script && this.isTrusted(m.meta.id)).map(m => ({ id: m.meta.id, name: m.meta.name, rev: this.rev, meta: m.meta }));
  }
  scriptUrl(id) { return `chrome://userchrome/content/rigel-mods/${id}/chrome.mjs`; }
  async _mirrorScript(id, script) {
    const dir = PathUtils.join(this.scriptRoot, id);
    try {
      if (script) {
        await IOUtils.makeDirectory(dir, { createAncestors: true, ignoreExisting: true });
        await IOUtils.writeUTF8(PathUtils.join(dir, "chrome.mjs"), script);
      } else await IOUtils.remove(dir, { recursive: true, ignoreAbsent: true });
    } catch (e) { console.warn("[rigel] mod betiği kopyalanamadı", id, e); }
  }
  scriptSource(id) { return this.mods.get(id)?.script ?? ""; }
  /** Mod ayarlarının güncel değerleri (tür düzeltilmiş) { anahtar: değer }. */
  valuesOf(id) {
    const m = this.mods.get(id);
    return Object.fromEntries((m?.meta.prefs ?? []).map(p => [p.key, this.getValue(id, p)]));
  }
  reportError(id, err) {
    this.errors.set(id, String(err?.message ?? err));
    this._notify("state");
  }

  /** Tarayıcı penceresini kaydeder; CSS'i uygular ve pencere kapanınca bırakır. */
  attachWindow(win) {
    if (this.windows.has(win)) return;
    this.windows.add(win);
    let mo = null;
    win.addEventListener("unload", () => { mo?.disconnect(); this.windows.delete(win); this.windowSheets.delete(win); this.windowVars.delete(win); }, { once: true });
    // Düzen değişince (kökte data-rigel-layout) düzene bağlı CSS/betikler yeniden seçilir.
    try {
      mo = new win.MutationObserver(() => { this._applyWindow(win); this._notify("state"); });
      mo.observe(win.document.documentElement, { attributes: true, attributeFilter: ["data-rigel-layout"] });
    } catch {}
    this.init().then(() => this._applyWindow(win));
  }

  _onPref(name) {
    if (!this.ready) return;
    if (name === PREF_VALUES) {
      // Ayar değişti: kök öznitelikleri/değişkenleri canlı güncelle; yalnız içerik CSS'i olan modlar için o sayfa yeniden kaydedilir.
      for (const w of this.windows) this._syncValues(w);
      if (this._active().some(m => m.content?.trim() && m.meta.prefs?.length)) this._applyContent();
      this._notify("state");
      return;
    }
    this._applyContent();
    this._applyAllWindows();
  }
  _notify(kind) {
    Services.obs.notifyObservers(null, "rigel-mods-" + kind);
  }
}

export const Mods = new ModManager();
