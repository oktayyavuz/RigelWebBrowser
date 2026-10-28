// ==UserScript==
// @name           Rigel modları
// @description    Kullanıcı CSS modları: arayüzü ve web sayfalarını canlı yeniden biçimlendirir (Zen Mods karşılığı)
// ==/UserScript==

// Yönetici: mods/manager.sys.mjs (tek örnek). Bu dosya her pencerede onu bağlar ve palet komutlarını kaydeder.
// API: Rigel.mods.list(), .setEnabled(id, bool), .toggle(id) (betikli modda onay ister), .reload(). Ayrıntı için manager.sys.mjs başlığı.
// Tercihler: rigel.mods.enabled, rigel.mods.values, rigel.mods.seeded.

const Rigel = (window.Rigel ??= {});
const { enableWithConsent } = ChromeUtils.importESModule("chrome://userscripts/content/mods/consent.sys.mjs");
const { Mods } = ChromeUtils.importESModule("chrome://userscripts/content/mods/manager.sys.mjs");

const STORE_URL = "chrome://rigel/content/store/store.html";
const sysPrincipal = () => Services.scriptSecurityManager.getSystemPrincipal();

/** Mod mağazasını açar; açıksa o sekmeye geçer. hash: "#kur=<adres>" gibi isteğe bağlı rota. */
function openStore(hash) {
  const url = STORE_URL + (hash ? (hash.startsWith("#") ? hash : "#" + hash) : "");
  for (const tab of gBrowser.tabs) {
    const spec = tab.linkedBrowser?.currentURI?.spec ?? "";
    if (!spec.startsWith(STORE_URL)) continue;
    gBrowser.selectedTab = tab;
    if (hash && spec !== url) tab.linkedBrowser.loadURI(Services.io.newURI(url), { triggeringPrincipal: sysPrincipal() });
    return tab;
  }
  const tab = gBrowser.addTab(url, { triggeringPrincipal: sysPrincipal(), inBackground: false });
  gBrowser.selectedTab = tab;
  return tab;
}

// Adres çubuğu mağaza sayfasında boş (yer tutucu görünür), ayarlardaki gibi.
function cleanUrlbar() {
  const bar = window.gURLBar;
  if (!bar || bar.__rigelStore) return;
  bar.__rigelStore = true;
  const orig = bar.setURI;
  bar.setURI = function (...args) {
    const r = orig.apply(this, args);
    try {
      const a = args[0];
      const spec = (a?.uri ?? (a?.spec ? a : null) ?? gBrowser.selectedBrowser?.currentURI)?.spec;
      if (spec?.startsWith(STORE_URL)) {
        this.value = "";
        this.setPageProxyState?.("invalid");
      }
    } catch {}
    return r;
  };
}
if (window.gBrowserInit?.delayedStartupFinished) cleanUrlbar();
else {
  const topic = "browser-delayed-startup-finished";
  const obs = subject => {
    if (subject !== window) return;
    Services.obs.removeObserver(obs, topic);
    cleanUrlbar();
  };
  Services.obs.addObserver(obs, topic);
}

Rigel.mods = {
  openStore,
  STORE_URL,
  list: () => Mods.list(),
  setEnabled: (id, on) => Mods.setEnabled(id, on),
  toggle: id => enableWithConsent(window, Mods, id, !Mods.isEnabled(id)),
  reload: () => Mods.reload(),
  manager: Mods,
};

const toast = text => Rigel.toast?.(text);
const registered = new Set(); // bu pencerede kayıtlı mod komut kimlikleri
let manageDone = false;

function syncCommands() {
  const cmds = Rigel.commands;
  if (!cmds?.register) return;
  const mods = Mods.list();
  const live = new Set(mods.map(m => "mod.toggle." + m.id));
  for (const id of [...registered]) {
    if (!live.has(id)) { cmds.unregister?.(id); registered.delete(id); }
  }
  for (const m of mods) {
    const cid = "mod.toggle." + m.id;
    if (registered.has(cid)) continue;
    registered.add(cid);
    cmds.register({
      id: cid,
      label: () => `Mod: ${Mods.get(m.id)?.meta.name ?? m.name} ${Mods.isEnabled(m.id) ? "kapat" : "aç"}`,
      sub: () => (Mods.isEnabled(m.id) ? "açık" : "kapalı"),
      icon: "bolt",
      run: async () => {
        const on = !Mods.isEnabled(m.id);
        if (!(await enableWithConsent(window, Mods, m.id, on))) return;
        const name = Mods.get(m.id)?.meta.name ?? m.name;
        // Çakışan açık mod varsa kısa uyarı (engellemez).
        const c = on ? Mods.conflictsOf(m.id) : [];
        toast(c.length ? `${name}: açık. Uyarı: ${c.map(o => o.name).join(", ")} ile çakışıyor` : `${name}: ${on ? "açık" : "kapalı"}`);
      },
    });
  }
  if (!manageDone) {
    manageDone = true;
    cmds.register({ id: "mod.store", label: "Mod mağazası", sub: "hazır modlara göz at ve kur", icon: "bolt", run: () => openStore() });
    cmds.register({ id: "mod.manage", label: "Modları yönet", sub: "CSS modları", icon: "bolt", run: () => Rigel.settings?.open("modlar") });
    cmds.register({ id: "mod.reload", label: "Modları yeniden yükle", sub: "diskteki değişiklikleri oku", icon: "bolt", run: async () => { await Mods.reload(); toast("Modlar yenilendi"); } });
  }
}

const listObs = { observe: () => syncCommands() };
Services.obs.addObserver(listObs, "rigel-mods-list");
window.addEventListener("unload", () => Services.obs.removeObserver(listObs, "rigel-mods-list"), { once: true });

Mods.attachWindow(window);
// Davranış modları (chrome.mjs): pencere başına çalışma zamanı. Hata yalıtımlı; bkz. mods/runtime.mjs.
import("chrome://userscripts/content/mods/runtime.mjs").then(m => m.init(window)).catch(e => console.error("[rigel] mod çalışma zamanı yüklenemedi", e));
syncCommands();
window.addEventListener("rigel:components-ready", syncCommands);
Mods.init().then(syncCommands);
