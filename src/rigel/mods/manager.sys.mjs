// Rigel Modları: kullanıcı CSS'i ile tarayıcı arayüzünü (chrome) ve/veya web sayfalarını (content) yeniden biçimlendirir.
// Zen Mods'tan esinlenildi (MPL-2.0), kod sıfırdan. Tek örnek (modül tekili): tüm pencereler ve ayarlar sayfası aynı yöneticiyi kullanır.
//
// Depolama:   <profil>/rigel-mods/<id>/{mod.json, chrome.css, content.css}
// Tercihler:  rigel.mods.enabled  (JSON, etkin mod kimlikleri)
//             rigel.mods.values   (JSON, { "<id>": { "<anahtar>": değer } } mod ayarları)
//             rigel.mods.seeded   (JSON, ilk çalıştırmada kopyalanmış yerleşik mod kimlikleri)
// Uygulama:   chrome CSS -> her tarayıcı penceresinde windowUtils AUTHOR_SHEET
//             content CSS -> nsIStyleSheetService USER_SHEET (@-moz-document ile yalnız web adreslerine)
// Mod ayarları CSS'e: kökte `rigel-mod-<id>-<anahtar>` özniteliği (onay kutusu: "true", kapalıysa yok; seçim/metin: değer)
//             ve her iki hedefte `--rigel-mod-<id>-<anahtar>` CSS değişkeni (onay kutusu 1/0).
// Bildirimler: Services.obs "rigel-mods-list" (liste/dosya değişti), "rigel-mods-state" (etkin/ayar değişti).

import { fetchEntryFiles, compareVersions } from "chrome://userscripts/content/mods/store.sys.mjs";

const BUILTIN_BASE = "chrome://userscripts/content/mods/builtin/";
const PREF_ENABLED = "rigel.mods.enabled";
const PREF_VALUES = "rigel.mods.values";
const PREF_SEEDED = "rigel.mods.seeded";
const PREVIEW_ID = "__preview__";
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
    this.mods = new Map(); // id -> { meta, chrome, content }
    this.windows = new Set();
    this.windowSheets = new WeakMap(); // pencere -> [uri]
    this.contentSheets = []; // kayıtlı USER_SHEET adresleri
    this.preview = null; // { id, name?, target, chrome, content }
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
    return v === undefined ? pref.default : v;
  }
  /** Arayüz için liste (ad sırasıyla). */
  list() {
    return [...this.mods.values()].map(m => ({ ...m.meta, enabled: this.isEnabled(m.meta.id), hasChrome: !!m.chrome, hasContent: !!m.content }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }
  get(id) {
    const m = this.mods.get(id);
    return m ? { meta: { ...m.meta, enabled: this.isEnabled(id) }, chrome: m.chrome, content: m.content } : null;
  }

  setEnabled(id, on) {
    if (!this.mods.has(id)) return;
    const cur = this.enabledIds().filter(x => x !== id);
    if (on) cur.push(id);
    P.setStringPref(PREF_ENABLED, JSON.stringify(cur));
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
    const prefs = (Array.isArray(raw?.prefs) ? raw.prefs : []).filter(p => p && p.key && ["checkbox", "string", "dropdown"].includes(p.type))
      .map(p => ({
        key: safeKey(p.key), label: String(p.label ?? p.key), type: p.type,
        default: p.type === "checkbox" ? !!p.default : String(p.default ?? ""),
        options: p.type === "dropdown" ? (Array.isArray(p.options) ? p.options : []).map(o => (typeof o === "string" ? { value: o, label: o } : { value: String(o.value), label: String(o.label ?? o.value) })) : undefined,
      }));
    return {
      id, name: String(raw?.name ?? id), description: String(raw?.description ?? ""), author: String(raw?.author ?? ""),
      version: String(raw?.version ?? "1.0.0"), target, prefs, builtin: !!raw?.builtin,
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
    return { meta: this._normalize(raw, id), chrome: await read("chrome.css"), content: await read("content.css") };
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
      for (const f of [meta.target !== "content" && "chrome.css", meta.target !== "chrome" && "content.css"].filter(Boolean)) {
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

  async _writeMod(id, meta, chrome, content) {
    const base = PathUtils.join(this.dir, id);
    await IOUtils.makeDirectory(base, { ignoreExisting: true });
    const out = { id, name: meta.name, description: meta.description ?? "", author: meta.author ?? "", version: meta.version ?? "1.0.0", target: meta.target, enabled: false };
    for (const k of ["homepage", "license", "source"]) if (meta[k]) out[k] = meta[k];
    if (meta.prefs?.length) out.prefs = meta.prefs;
    if (meta.builtin) out.builtin = true;
    if (meta.store) out.store = meta.store;
    await IOUtils.writeUTF8(PathUtils.join(base, "mod.json"), JSON.stringify(out, null, 2));
    if (meta.target !== "content") await IOUtils.writeUTF8(PathUtils.join(base, "chrome.css"), chrome ?? "");
    else await IOUtils.remove(PathUtils.join(base, "chrome.css"), { ignoreAbsent: true });
    if (meta.target !== "chrome") await IOUtils.writeUTF8(PathUtils.join(base, "content.css"), content ?? "");
    else await IOUtils.remove(PathUtils.join(base, "content.css"), { ignoreAbsent: true });
  }

  /** Yeni mod oluşturur; kimliği adından türetir. Etkin olarak başlar. */
  async create({ name, description = "", author = "", target = "chrome", chrome = "", content = "", prefs = [], enable = true }) {
    await this.init();
    name = String(name ?? "").trim() || "Adsız mod";
    let id = slug(name) || "mod";
    for (let n = 2; this.mods.has(id) || (await IOUtils.exists(PathUtils.join(this.dir, id))); n++) id = `${slug(name) || "mod"}-${n}`;
    const meta = this._normalize({ name, description, author, target, prefs }, id);
    await this._writeMod(id, meta, chrome, content);
    this.mods.set(id, { meta, chrome: target === "content" ? "" : chrome, content: target === "chrome" ? "" : content });
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
    await this._writeMod(id, meta, chrome, content);
    this.mods.set(id, { meta, chrome: meta.target === "content" ? "" : chrome, content: meta.target === "chrome" ? "" : content });
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
    this._applyContent();
    this._applyAllWindows();
    this._notify("list");
  }

  // ---- mağaza (mods/store.sys.mjs, mods/STORE.md) ----
  /** Katalog girişinden kurar ya da günceller. Kimlik = giriş kimliği. Yeni kurulum varsayılan olarak açılır;
   *  güncellemede açık/kapalı durum ve mod ayarları korunur. Kimliği döndürür. */
  async installFromCatalog(entry, { enable = true } = {}) {
    await this.init();
    const id = String(entry?.id ?? "");
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) throw new Error("Geçersiz mod kimliği.");
    const cur = this.mods.get(id);
    if (cur && !cur.meta.store) throw new Error(`"${id}" kimliğinde mağazadan gelmeyen bir mod zaten var. Önce onu sil ya da yeniden adlandır.`);
    const got = await fetchEntryFiles(entry);
    const meta = this._normalize({
      ...got.meta, id,
      store: { id, version: got.meta.version, origin: entry.origin ?? "remote", source: entry.source ?? "" },
    }, id);
    await this._writeMod(id, meta, got.chrome, got.content);
    this.mods.set(id, { meta, chrome: meta.target === "content" ? "" : got.chrome, content: meta.target === "chrome" ? "" : got.content });
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
    if (!chrome && !content) throw new Error("Klasörde chrome.css, content.css ya da mod.json bulunamadı.");
    const target = raw?.target ?? (chrome && content ? "both" : content ? "content" : "chrome");
    const name = raw?.name ?? PathUtils.filename(path);
    return this.create({ ...(raw ?? {}), name, target, chrome, content, enable: false });
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
      if (on.has(m.meta.id)) out.push({ meta: m.meta, chrome: m.chrome, content: m.content });
    }
    if (pv) {
      const base = this.mods.get(pv.id)?.meta;
      out.push({ meta: { id: pv.id, target: pv.target, prefs: pv.prefs ?? base?.prefs ?? [] }, chrome: pv.chrome, content: pv.content });
    }
    return out;
  }
  _vars(mod) {
    const id = safeKey(mod.meta.id);
    const vals = this.values()[mod.meta.id] ?? {};
    const lines = [];
    for (const p of mod.meta.prefs ?? []) {
      const v = vals[p.key] ?? p.default;
      const name = `--rigel-mod-${id}-${p.key}`;
      lines.push(`${name}: ${p.type === "checkbox" ? (v ? 1 : 0) : cssValue(v) || "initial"};`);
    }
    return lines.length ? `:root { ${lines.join(" ")} }\n` : "";
  }
  _chromeCss(mod) {
    if (mod.meta.target === "content" || !mod.chrome?.trim()) return null;
    return `/* rigel-mod:${mod.meta.id} chrome */\n${this._vars(mod)}${mod.chrome}\n`;
  }
  _contentCss(mod) {
    if (mod.meta.target === "chrome" || !mod.content?.trim()) return null;
    return `/* rigel-mod:${mod.meta.id} content */\n@-moz-document regexp("${WEB_RE}") {\n${this._vars(mod)}${mod.content}\n}\n`;
  }

  /** Kökteki öznitelikler: rigel-mod-<id>-<anahtar>. */
  _syncAttributes(win) {
    const root = win.document?.documentElement;
    if (!root) return;
    for (const a of [...root.attributes]) if (a.name.startsWith("rigel-mod-")) root.removeAttribute(a.name);
    for (const mod of this._active()) {
      if (mod.meta.target === "content") continue;
      const vals = this.values()[mod.meta.id] ?? {};
      for (const p of mod.meta.prefs ?? []) {
        const v = vals[p.key] ?? p.default;
        const name = `rigel-mod-${safeKey(mod.meta.id)}-${p.key}`;
        if (p.type === "checkbox") { if (v) root.setAttribute(name, "true"); } else root.setAttribute(name, String(v));
      }
    }
  }

  _applyWindow(win) {
    const wu = win.windowUtils;
    if (!wu) return;
    for (const uri of this.windowSheets.get(win) ?? []) {
      try { wu.removeSheetUsingURIString(uri, wu.AUTHOR_SHEET); } catch {}
    }
    const loaded = [];
    for (const mod of this._active()) {
      const css = this._chromeCss(mod);
      if (!css) continue;
      const uri = cssUri(css);
      try { wu.loadSheetUsingURIString(uri, wu.AUTHOR_SHEET); loaded.push(uri); } catch (e) { console.error("[rigel] mod CSS yüklenemedi", mod.meta.id, e); }
    }
    this.windowSheets.set(win, loaded);
    this._syncAttributes(win);
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

  /** Tarayıcı penceresini kaydeder; CSS'i uygular ve pencere kapanınca bırakır. */
  attachWindow(win) {
    if (this.windows.has(win)) return;
    this.windows.add(win);
    win.addEventListener("unload", () => { this.windows.delete(win); this.windowSheets.delete(win); }, { once: true });
    this.init().then(() => this._applyWindow(win));
  }

  _onPref(name) {
    if (!this.ready) return;
    this._applyContent();
    this._applyAllWindows();
  }
  _notify(kind) {
    Services.obs.notifyObservers(null, "rigel-mods-" + kind);
  }
}

export const Mods = new ModManager();
