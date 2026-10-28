// Rigel Mod çalışma zamanı: davranış modlarının (chrome.mjs) pencere başına çalıştırılması.
// Her tarayıcı penceresi için mods.uc.mjs `init(window)` çağırır. Yönetici (manager.sys.mjs) hangi modların bu pencerede
// çalışacağını söyler: etkin + düzene uygun + güvenilir (yerleşik / paketle gelen / kullanıcı onaylı).
//
// Mod betiği (mods/STORE.md "Betik API'si"):
//   export default function (api) { …; return () => temizlik }
// Hata yalıtımı: içe aktarma, başlatma, temizlik ve her olay işleyicisi try/catch içindedir; hata konsola
// `[rigel-mod:<id>]` önekiyle yazılır ve Ayarlar > Modlar'da modun yanında görünür. Pencere hiçbir zaman düşmez.

const { Mods } = ChromeUtils.importESModule("chrome://userscripts/content/mods/manager.sys.mjs");

const guard = (id, what, fn) => {
  try {
    const r = fn();
    if (r?.catch) r.catch(e => fail(id, what, e));
    return r;
  } catch (e) {
    fail(id, what, e);
  }
};
function fail(id, what, e) {
  try { console.error(`[rigel-mod:${id}] ${what}:`, e); } catch {}
  try { dump(`[rigel-mod:${id}] ${what}: ${e}\n`); } catch {}
  try { Mods.reportError(id, e); } catch {}
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Betik içe aktarma: yönetici betiği chrome://userchrome/content/rigel-mods/<id>/chrome.mjs altında sunar
 *  (pencere modül yükleyicisi yalnız chrome:// kabul eder; file:/data:/blob: reddedilir). Sürüm sorgusu önbelleği kırar. */
async function loadModule(win, id, rev) {
  if (!Mods.scriptSource(id)) throw new Error("chrome.mjs boş ya da okunamadı");
  return import(`${Mods.scriptUrl(id)}?v=${rev}-${++loadCounter}`);
}
let loadCounter = 0;

const TOOLBAR_HOSTS = ["#rigel-ada .rigel-right", "#rigel-docktop .rigel-tools", "#rigel-komuta .rigel-tools", "#nav-bar-customization-target"];

export function init(win) {
  if (win.__rigelModRuntime) return win.__rigelModRuntime;
  const doc = win.document;
  const running = new Map(); // id -> örnek
  const failedRev = new Map(); // id -> hatalı başlatılan sürüm (aynı sürüm yeniden denenmez)
  let lastLayout = Mods.layoutOf(win);
  let syncing = false;
  let again = false;

  // ---- ortak olay kaynakları ----
  const tabHandlers = new Set(); // { id, fn }
  const onTabSelect = e => {
    for (const h of [...tabHandlers]) guard(h.id, "onTabSelect", () => h.fn(e.target, e.detail?.previousTab ?? null));
  };
  win.gBrowser?.tabContainer?.addEventListener("TabSelect", onTabSelect);

  function makeApi(inst) {
    const { id } = inst;
    const own = fn => { inst.disposers.push(fn); return fn; };
    const live = () => inst.alive;
    const api = {
      id,
      window: win,
      document: doc,
      /** Modun güncel ayar değerleri (tür düzeltilmiş: checkbox bool, range sayı, color "#rrggbb"). */
      get prefs() { return inst.vals; },
      get layout() { return Mods.layoutOf(win); },
      onPrefChange(fn) {
        inst.prefHandlers.add(fn);
        return () => inst.prefHandlers.delete(fn);
      },
      onLayoutChange(fn) {
        inst.layoutHandlers.add(fn);
        return () => inst.layoutHandlers.delete(fn);
      },
      onTabSelect(fn) {
        const h = { id, fn };
        tabHandlers.add(h);
        return own(() => tabHandlers.delete(h));
      },
      /** Pencereye stil ekler (mod CSS'i gibi iki katmanda: `!important` Rigel'i yener). Kaldırma işlevi döndürür. */
      addStyle(css) {
        const wu = win.windowUtils;
        const text = `/* rigel-mod:${id} script */\n${css}`;
        const loaded = [];
        for (const [t, type] of [[text, wu.AUTHOR_SHEET], ["/* user */\n" + text, wu.USER_SHEET]]) {
          const uri = "data:text/css;charset=utf-8," + encodeURIComponent(t);
          try { wu.loadSheetUsingURIString(uri, type); loaded.push([uri, type]); } catch (e) { fail(id, "addStyle", e); }
        }
        const remove = () => { for (const [uri, type] of loaded.splice(0)) try { wu.removeSheetUsingURIString(uri, type); } catch {} };
        return own(remove);
      },
      commands: {
        /** Komut paletine komut ekler ({ id, label, keys?, icon?, run }). Kaldırma işlevi döndürür. */
        register(spec) {
          const cid = `mod.${id}.${spec.id}`;
          let off = null;
          let queued = false;
          const doIt = () => {
            const reg = win.Rigel?.commands;
            if (!reg?.register || off) return !!off;
            // Kayıt defterinde unregister yoksa komut gizli sarmalayıcıyla pasifleşir (live() yanlışsa çalışmaz).
            const wrapped = { ...spec, id: cid, run: (...a) => (live() ? spec.run(...a) : undefined) };
            try { off = reg.register(wrapped) ?? (() => reg.unregister?.(cid)); } catch (e) { fail(id, "commands.register", e); }
            return true;
          };
          if (!doIt() && !queued) {
            queued = true;
            const once = () => doIt();
            win.addEventListener("rigel:components-ready", once, { once: true });
            inst.disposers.push(() => win.removeEventListener("rigel:components-ready", once));
          }
          return own(() => { try { off?.(); win.Rigel?.commands?.unregister?.(cid); } catch {} off = null; });
        },
      },
      /** Araç çubuğuna düğme ekler: { id, icon (adres ya da kısa simge metni), label, onClick }. Kaldırma işlevi döndürür. */
      addToolbarButton({ id: bid, icon, label, onClick }) {
        const elId = `rigel-modbtn-${id}-${bid}`;
        const btn = doc.createXULElement("toolbarbutton");
        btn.id = elId;
        btn.className = "toolbarbutton-1 rigel-tool rigel-mod-btn";
        btn.setAttribute("tooltiptext", label ?? "");
        btn.setAttribute("aria-label", label ?? "");
        if (/^(chrome|data|resource):/.test(icon ?? "")) btn.setAttribute("image", icon);
        else btn.setAttribute("label", icon ?? "•");
        btn.addEventListener("command", () => guard(id, "toolbar button", () => onClick?.()));
        const place = () => {
          for (const sel of TOOLBAR_HOSTS) {
            const host = doc.querySelector(sel);
            if (host && host.getBoundingClientRect().width > 0) {
              if (btn.parentNode !== host) host.append(btn);
              return;
            }
          }
          btn.remove();
        };
        place();
        const lay = () => place();
        inst.layoutHandlers.add(lay);
        return own(() => { inst.layoutHandlers.delete(lay); btn.remove(); });
      },
      toast(msg) { win.Rigel?.toast?.(String(msg)); },
      /** Dinleyici ekler; temizlikte otomatik kaldırılır. */
      listen(target, type, fn, opts) {
        const w = e => guard(id, `olay ${type}`, () => fn(e));
        target.addEventListener(type, w, opts);
        return own(() => target.removeEventListener(type, w, opts));
      },
      /** Zamanlayıcılar (temizlikte otomatik durdurulur). */
      setTimeout(fn, ms) { const t = win.setTimeout(() => guard(id, "setTimeout", fn), ms); return own(() => win.clearTimeout(t)); },
      setInterval(fn, ms) { const t = win.setInterval(() => guard(id, "setInterval", fn), ms); return own(() => win.clearInterval(t)); },
      log: (...a) => console.log(`[rigel-mod:${id}]`, ...a),
    };
    return api;
  }

  async function start(desc) {
    const { id } = desc;
    const inst = { id, rev: desc.rev, layout: Mods.layoutOf(win), vals: Mods.valuesOf(id), alive: true, disposers: [], cleanup: null, prefHandlers: new Set(), layoutHandlers: new Set() };
    running.set(id, inst);
    Mods.errors.delete(id);
    try {
      const mod = await loadModule(win, id, desc.rev);
      if (!inst.alive) return;
      if (typeof mod.default !== "function") throw new Error("chrome.mjs `export default function (api)` vermeli");
      const out = await mod.default(makeApi(inst));
      if (typeof out === "function") inst.cleanup = out;
      if (!inst.alive) stop(inst);
    } catch (e) {
      fail(id, "başlatma", e);
      failedRev.set(id, inst.rev);
      stop(inst);
    }
  }

  function stop(inst) {
    if (!inst.alive && !inst.cleanup && !inst.disposers.length) { running.delete(inst.id); return; }
    inst.alive = false;
    if (running.get(inst.id) === inst) running.delete(inst.id);
    const c = inst.cleanup;
    inst.cleanup = null;
    if (c) guard(inst.id, "temizlik", c);
    for (const d of inst.disposers.splice(0).reverse()) try { d(); } catch (e) { fail(inst.id, "temizlik", e); }
    inst.prefHandlers.clear();
    inst.layoutHandlers.clear();
  }

  function sync() {
    if (syncing) { again = true; return; }
    syncing = true;
    try {
      const want = new Map(Mods.scriptsFor(win).map(d => [d.id, d]));
      for (const inst of [...running.values()]) {
        const d = want.get(inst.id);
        if (!d || d.rev !== inst.rev) stop(inst);
      }
      for (const id of [...failedRev.keys()]) if (!want.has(id)) failedRev.delete(id);
      for (const d of want.values()) if (!running.has(d.id) && failedRev.get(d.id) !== d.rev) start(d);
      // Düzen ve ayar değişimleri
      const layout = Mods.layoutOf(win);
      for (const inst of [...running.values()]) {
        if (inst.layout !== layout) {
          const prev = inst.layout;
          inst.layout = layout;
          for (const fn of [...inst.layoutHandlers]) guard(inst.id, "onLayoutChange", () => fn(layout, prev));
        }
        const vals = Mods.valuesOf(inst.id);
        if (!same(vals, inst.vals)) {
          const changed = Object.keys(vals).filter(k => !same(vals[k], inst.vals[k]));
          inst.vals = vals;
          if (inst.prefHandlers.size) for (const fn of [...inst.prefHandlers]) guard(inst.id, "onPrefChange", () => fn(vals, changed));
          else { // işleyici yoksa ayar yeni değerle yeniden başlatılır (temizlik + yeniden çalıştırma)
            const d = { id: inst.id, rev: inst.rev };
            stop(inst);
            start(d);
          }
        }
      }
      lastLayout = layout;
    } finally {
      syncing = false;
      if (again) { again = false; sync(); }
    }
  }

  const obs = { observe: () => sync() };
  Services.obs.addObserver(obs, "rigel-mods-state");
  Services.obs.addObserver(obs, "rigel-mods-list");
  win.addEventListener("unload", () => {
    Services.obs.removeObserver(obs, "rigel-mods-state");
    Services.obs.removeObserver(obs, "rigel-mods-list");
    win.gBrowser?.tabContainer?.removeEventListener("TabSelect", onTabSelect);
    for (const inst of [...running.values()]) stop(inst);
  }, { once: true });

  const api = { sync, running: () => [...running.keys()] };
  win.__rigelModRuntime = api;
  Mods.init().then(sync);
  return api;
}
