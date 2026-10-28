// ==UserScript==
// @name           Rigel
// @description    Rigel kabuğunun giriş noktası: tema ve düzenler (prototip: fx-autoconfig ile yüklenir)
// ==/UserScript==

// Düzenler çalışma anında değişir: her düzen modülü init(win) ile kurulur ve bir geri alma
// işlevi döndürür. Değiştirirken eski düzenin DOM'u geri taşınır, stil dosyası kaldırılır,
// sekme yönü (sidebar.verticalTabs) tercihle çevrilir.

const BASE = "chrome://userscripts/content/";
const PREF = "rigel.layout";
const DEFAULT = "yanpanel";
const ORDER = ["ada", "dock", "komuta", "yanpanel", "klasik"];
const LAYOUTS = {
  ada: { label: "Ada", vertical: false, urlbar: "hidden" },
  dock: { label: "Yörünge Dock", vertical: false, urlbar: "hidden" },
  komuta: { label: "Komuta", vertical: false, urlbar: "hidden" },
  yanpanel: { label: "Yan Panel", vertical: true, urlbar: "visible" },
  klasik: { label: "Klasik", vertical: false, urlbar: "visible" },
};
const sheetOf = name => `${BASE}layouts/${name}.css`;
const moduleOf = name => `${BASE}shell/${name}.mjs`;

const root = document.documentElement;
const utils = window.windowUtils;
const Rigel = (window.Rigel ??= {});

for (const sheet of ["theme/tokens.css", "theme/motion.css", "theme/focus.css", "theme/panels.css", "layouts/base.css"]) {
  utils.loadSheetUsingURIString(BASE + sheet, utils.AUTHOR_SHEET);
}
Services.prefs.getDefaultBranch("").setStringPref("rigel.theme", "dark");
Services.prefs.getDefaultBranch("").setStringPref("rigel.accent", "rigel");
// Tema: tercihler çalışma anında izlenir (theme/theme.mjs). İlk boyamadan önce doğru değer yazılsın.
{
  const t = Services.prefs.getStringPref("rigel.theme", "dark");
  root.setAttribute("data-rigel-theme", t === "light" ? "light" : t === "system" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  root.setAttribute("data-rigel-accent", Services.prefs.getStringPref("rigel.accent", "rigel"));
  import(BASE + "theme/theme.mjs").then(m => m.init(window)).catch(e => dump(`[rigel] tema yüklenemedi: ${e}\n${e.stack}\n`));
  import(BASE + "theme/panels.mjs").then(m => m.init(window)).catch(e => dump(`[rigel] paneller yüklenemedi: ${e}\n${e.stack}\n`));
}

// Yerel dikey sekmeler için yenilenmiş kenar çubuğu gerekli (varsayılan dal; kullanıcı ezebilir).
Services.prefs.getDefaultBranch("").setBoolPref("sidebar.revamp", true);
Services.prefs.getDefaultBranch("").setStringPref(PREF, DEFAULT);

function validName(name) {
  return Object.hasOwn(LAYOUTS, name) ? name : DEFAULT;
}

/** Sekme yönünü ve başlatıcı görünürlüğünü düzene göre ayarlar (genel tercihler; idempotent). */
function setTabPrefs(def) {
  const P = Services.prefs;
  if (P.getBoolPref("sidebar.verticalTabs", false) !== def.vertical) {
    P.setBoolPref("sidebar.verticalTabs", def.vertical);
  }
  // Yatayda başlatıcı (araç ikonları şeridi) hiç görünmesin.
  const vis = def.vertical ? "always-show" : "hide-launcher";
  if (P.getStringPref("sidebar.visibility", "") !== vis) P.setStringPref("sidebar.visibility", vis);
}

function whenStartedUp() {
  if (window.gBrowserInit?.delayedStartupFinished) return Promise.resolve();
  return new Promise(resolve => {
    const topic = "browser-delayed-startup-finished";
    const obs = subject => {
      if (subject !== window) return;
      Services.obs.removeObserver(obs, topic);
      resolve();
    };
    Services.obs.addObserver(obs, topic);
  });
}

async function waitFor(cond, ms = 2000) {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) {
    await new Promise(r => window.setTimeout(r, 16));
  }
}

let current = null; // { name, sheet, teardown }
let queue = Promise.resolve();

function setRootAttrs(name) {
  root.setAttribute("data-rigel-layout", name);
  if (LAYOUTS[name].urlbar === "hidden") root.setAttribute("data-rigel-urlbar", "hidden");
  else root.removeAttribute("data-rigel-urlbar");
}

function teardownCurrent() {
  if (!current) return;
  const { name, sheet, teardown } = current;
  current = null;
  try {
    teardown?.();
  } catch (e) {
    dump(`[rigel] düzen kaldırılamadı (${name}): ${e}\n${e.stack}\n`);
  }
  if (sheet) {
    try {
      utils.removeSheetUsingURIString(sheet, utils.AUTHOR_SHEET);
    } catch {}
  }
  for (const a of ["data-rigel-layout", "data-rigel-urlbar", "data-rigel-urlbar-reveal", "data-rigel-ready"]) {
    root.removeAttribute(a);
  }
}

async function applyLayout(name, { early = false } = {}) {
  name = validName(name);
  if (current?.name === name) return;
  const def = LAYOUTS[name];
  teardownCurrent();
  // İlk açılışta tercihler SidebarController hazır olunca değişir (gözlemcileri erken çalışmasın).
  // Tercihler prefs.js'te kalıcı olduğundan normalde zaten doğrudur.
  if (!early) setTabPrefs(def);
  const sheet = sheetOf(name);
  utils.loadSheetUsingURIString(sheet, utils.AUTHOR_SHEET);
  setRootAttrs(name);
  current = { name, sheet, teardown: null };
  if (early) {
    await whenStartedUp();
    setTabPrefs(def);
  }
  // CustomizableUI sekme şeridini taşır, SidebarController yönü çevirir; ikisini bekle.
  const tabs = window.gBrowser?.tabContainer;
  await waitFor(() => (tabs?.getAttribute("orient") === "vertical") === def.vertical);
  if (current?.name !== name) return;
  try {
    const mod = await import(moduleOf(name));
    if (current?.name !== name) return;
    const teardown = mod.init(window);
    current.teardown = typeof teardown === "function" ? teardown : null;
    root.setAttribute("data-rigel-ready", "true");
    window.dispatchEvent(new CustomEvent("rigel:layout-changed", { detail: { name } }));
  } catch (e) {
    dump(`[rigel] düzen yüklenemedi (${name}): ${e}\n${e.stack}\n`);
  }
}

function enqueue(name, opts) {
  queue = queue.then(() => applyLayout(name, opts)).catch(e => dump(`[rigel] düzen hatası: ${e}\n`));
  return queue;
}

// --- Genel API -------------------------------------------------------------------
let lastCycle = 0;
Rigel.layout = {
  names: () => [...ORDER],
  label: name => LAYOUTS[name]?.label ?? name,
  current: () => validName(Services.prefs.getStringPref(PREF, DEFAULT)),
  /** Tercihi değiştirir; tüm pencereler gözlemciyle uygular. Bu pencerenin işi bitince çözülür. */
  set(name) {
    if (!Object.hasOwn(LAYOUTS, name)) throw new Error(`bilinmeyen düzen: ${name}`);
    Services.prefs.setStringPref(PREF, name);
    return enqueue(name);
  },
  cycle() {
    // Aynı kısayol iki dinleyiciden gelirse bir kez say.
    const now = Date.now();
    if (now - lastCycle < 200) return queue;
    lastCycle = now;
    const i = ORDER.indexOf(this.current());
    return this.set(ORDER[(i + 1) % ORDER.length]);
  },
};

const prefObserver = {
  observe() {
    enqueue(Services.prefs.getStringPref(PREF, DEFAULT));
  },
};
Services.prefs.addObserver(PREF, prefObserver);

// Ctrl+Shift+L: düzenler arasında dolaş.
function onKey(e) {
  if (e.code === "KeyL" && e.shiftKey && (e.ctrlKey || e.metaKey) && !e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    Rigel.layout.cycle();
  }
}
window.addEventListener("keydown", onKey, true);

// Komut paleti kayıtları (B'nin modülü hangi sırada yüklenirse yüklensin).
let commandsRegistered = false;
function registerCommands() {
  const reg = window.Rigel?.commands?.register;
  if (!reg || commandsRegistered) return;
  commandsRegistered = true;
  try {
    reg({ id: "layout.cycle", label: "Düzeni değiştir (sıradaki)", keys: ["Ctrl+Shift+L"], icon: "layout", run: () => Rigel.layout.cycle() });
    for (const name of ORDER) {
      reg({ id: `layout.${name}`, label: `Düzen: ${LAYOUTS[name].label}`, icon: "layout", run: () => Rigel.layout.set(name) });
    }
  } catch (e) {
    dump(`[rigel] düzen komutları kaydedilemedi: ${e}\n`);
  }
}
window.addEventListener("rigel:components-ready", registerCommands);
registerCommands();
whenStartedUp().then(registerCommands);

window.addEventListener("unload", () => {
  Services.prefs.removeObserver(PREF, prefObserver);
  window.removeEventListener("keydown", onKey, true);
}, { once: true });

enqueue(Rigel.layout.current(), { early: true });

// Düzenden bağımsız kabuk parçaları: yer imi çubuğu ve sade adres görünümü.
whenStartedUp().then(() => {
  for (const name of ["bookmarks", "urlsimple"]) {
    import(`${BASE}shell/${name}.mjs`)
      .then(m => {
        const off = m.init(window);
        window.addEventListener("unload", () => off?.(), { once: true });
      })
      .catch(e => dump(`[rigel] ${name} yüklenemedi: ${e}\n${e.stack}\n`));
  }
});

// Firefox, fareyle sekme kapatınca yatay şeritte sekme genişliklerini fare şeritten çıkana kadar
// kilitler; "+" düğmesi eski yerine dönmez. Rigel'de sekmeler hemen yeniden boyutlanır
// (rigel.tabs.lockSizing = true ile Firefox davranışı geri gelir).
whenStartedUp().then(() => {
  const tabs = window.gBrowser?.tabContainer;
  const original = tabs?._lockTabSizing;
  if (typeof original !== "function") return;
  tabs._lockTabSizing = function (...args) {
    if (Services.prefs.getBoolPref("rigel.tabs.lockSizing", false)) return original.apply(this, args);
    this._unlockTabSizing?.();
  };
});
