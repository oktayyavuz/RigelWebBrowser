// ==UserScript==
// @name           Rigel ayarları ve sihirbaz
// @description    Ayarlar sayfasını açar (menü ve komutlar), ilk açılışta kurulum sihirbazını gösterir, adres çubuğunu temiz tutar
// ==/UserScript==

// Sayfalar: pages/settings/ (chrome://rigel/content/settings/settings.html#bölüm), pages/welcome/.
// API: Rigel.settings.open(bölüm?), Rigel.settings.openWelcome().

const Rigel = (window.Rigel ??= {});
const SETTINGS_URL = "chrome://rigel/content/settings/settings.html";
const WELCOME_URL = "chrome://rigel/content/welcome/welcome.html";
const NEWTAB_URL = "chrome://rigel/content/newtab/newtab.html";
const sysPrincipal = () => Services.scriptSecurityManager.getSystemPrincipal();
const ownUrl = spec => spec?.startsWith(SETTINGS_URL) || spec?.startsWith(WELCOME_URL);

/** Ayarları açar; açıksa o sekmeye geçer. section: "gizlilik" gibi bölüm kimliği. */
function openPage(base, hash) {
  const url = base + (hash ? "#" + hash : "");
  for (const tab of gBrowser.tabs) {
    const spec = tab.linkedBrowser?.currentURI?.spec ?? "";
    if (!spec.startsWith(base)) continue;
    gBrowser.selectedTab = tab;
    if (hash && spec !== url) tab.linkedBrowser.loadURI(Services.io.newURI(url), { triggeringPrincipal: sysPrincipal() });
    return tab;
  }
  const tab = gBrowser.addTab(url, { triggeringPrincipal: sysPrincipal(), inBackground: false });
  // Sayfa yüklenmeden adres henüz about:blank; odak kipi hedef adrese göre karar verebilsin.
  tab._rigelTarget = url;
  gBrowser.selectedTab = tab;
  return tab;
}

Rigel.settings = {
  open: section => openPage(SETTINGS_URL, section),
  openWelcome: () => openPage(WELCOME_URL),
  SETTINGS_URL,
  WELCOME_URL,
};

// Menüdeki "Ayarlar" ve Ctrl+, : bölüm verilmeyen çağrılar Rigel ayarlarına gider.
// Başka yerlerden bölümle gelenler (ör. "privacy-sitedata") Firefox'un sayfasında kalır.
const nativeOpenPreferences = window.openPreferences;
window.openPreferences = function (paneID, ...rest) {
  if (paneID === undefined || paneID === null) {
    if (window.closed || window.PrivateBrowsingUtils?.permanentPrivateBrowsing) return nativeOpenPreferences?.call(window, paneID, ...rest);
    return Rigel.settings.open();
  }
  return nativeOpenPreferences.call(window, paneID, ...rest);
};

// Adres çubuğu: Rigel sayfalarında boş (yer tutucu görünür), yeni sekme sayfasındaki gibi.
function cleanUrlbar() {
  const bar = window.gURLBar;
  if (!bar || bar.__rigelSettings) return;
  bar.__rigelSettings = true;
  const orig = bar.setURI;
  // Firefox 158: setURI({ uri, dueToTabSwitch, … }); uri verilmezse seçili sekmenin adresi.
  bar.setURI = function (...args) {
    const r = orig.apply(this, args);
    try {
      const a = args[0];
      const spec = (a?.uri ?? (a?.spec ? a : null) ?? gBrowser.selectedBrowser?.currentURI)?.spec;
      if (ownUrl(spec)) {
        this.value = "";
        this.setPageProxyState?.("invalid");
      }
    } catch {}
    return r;
  };
}

// Odak kipi: sihirbaz seçiliyken bütün tarayıcı arayüzü gizlenir (theme/focus.css, kökte data-rigel-focus).
// Yalnız pencere düğmeleri ve sürükleme şeridi (#rigel-focus-bar) kalır. Başka sekmeye geçince ya da
// sihirbaz kapanınca/bitince arayüz geri gelir.
let focusBar = null;
// İlk açılışta sihirbaz birkaç yüz ms sonra açılır; o ana kadar da arayüz gizli kalsın (titreme olmasın).
let pendingWelcome = !Services.prefs.getBoolPref("rigel.welcome.done", false)
  && !window.PrivateBrowsingUtils?.isWindowPrivate(window)
  && [...Services.wm.getEnumerator("navigator:browser")].length <= 1;
if (pendingWelcome) document.documentElement.setAttribute("data-rigel-focus", "");
async function ensureFocusBar() {
  if (focusBar?.isConnected) return;
  const { windowButtons, el, Disposer } = await import("chrome://userscripts/content/shell/common.mjs");
  if (focusBar?.isConnected) return;
  const d = new Disposer();
  focusBar = el(document, "div", { id: "rigel-focus-bar" }, windowButtons(window, d));
  document.documentElement.append(focusBar);
  window.addEventListener("unload", () => d.run(), { once: true });
}
function updateFocus() {
  const sel = gBrowser.selectedTab;
  let spec = gBrowser.selectedBrowser?.currentURI?.spec ?? "";
  if ((spec === "about:blank" || !spec) && sel?._rigelTarget) spec = sel._rigelTarget;
  const on = pendingWelcome || spec.startsWith(WELCOME_URL);
  const root = document.documentElement;
  if (on) {
    ensureFocusBar().catch(e => dump(`[rigel] odak çubuğu: ${e}\n`));
    root.setAttribute("data-rigel-focus", "");
  } else root.removeAttribute("data-rigel-focus");
}
function initFocus() {
  const tc = gBrowser.tabContainer;
  for (const ev of ["TabSelect", "TabClose", "TabAttrModified"]) tc.addEventListener(ev, updateFocus);
  gBrowser.addTabsProgressListener({
    onLocationChange(browser) {
      if (browser === gBrowser.selectedBrowser) updateFocus();
    },
  });
  updateFocus();
}

// Komutlar: "Kurulum sihirbazı". Komut kaydı hazır olunca (ya da hemen) eklenir.
function registerCommands() {
  const reg = Rigel.commands?.register;
  if (!reg || Rigel.__settingsCmds) return;
  Rigel.__settingsCmds = true;
  Rigel.commands.register({ id: "welcome", label: "Kurulum sihirbazı", icon: "arrow", sub: "ilk açılış adımları", run: () => Rigel.settings.openWelcome() });
}
registerCommands();
window.addEventListener("rigel:components-ready", registerCommands);

// Helium (net.imput.helium) Chromium tabanlıdır; Firefox'un "Chromium" içe aktarıcısı onu da bulsun.
// Gerçek Chromium kuruluysa ona dokunulmaz. Veri klasörü yalnızca okunur.
// Helium, Firefox'un içe aktarma sihirbazında kendi adı ve simgesiyle görünür (migration/helium.sys.mjs).
async function teachMigratorAboutHelium() {
  try {
    const { installHeliumMigrator } = ChromeUtils.importESModule("chrome://userscripts/content/migration/helium.sys.mjs");
    installHeliumMigrator();
  } catch (e) {
    console.error("[rigel] Helium içe aktarıcısı", e);
  }
}

// İlk açılış: rigel.welcome.done false ise sihirbazı aç (ilk tarayıcı penceresinde, bir kez).
function maybeShowWelcome() {
  try {
    showWelcomeOnce();
  } finally {
    pendingWelcome = false;
    updateFocus();
  }
}
function showWelcomeOnce() {
  if (Services.prefs.getBoolPref("rigel.welcome.done", false)) return;
  if (window.PrivateBrowsingUtils?.isWindowPrivate(window) || !window.toolbar?.visible) return;
  // Yalnızca ilk pencerede ve yalnız bir kez.
  const wins = [...Services.wm.getEnumerator("navigator:browser")];
  if (wins.length > 1 || wins.some(w => w.Rigel?.__welcomeShown)) return;
  Rigel.__welcomeShown = true;
  const tab = openPage(WELCOME_URL);
  // İlk açılışta yalnız sihirbaz kalsın: boş/yeni sekme açılış sekmelerini ve eklentilerin
  // (Dark Reader, SponsorBlock) kendiliğinden açtığı tanıtım sekmelerini kapat.
  const isStartupTab = spec => /^(about:(blank|newtab|home)|chrome:\/\/rigel\/content\/newtab\/.*)$/.test(spec);
  const isAddonIntro = spec => /^moz-extension:\/\/[^/]+\/help\/|^https:\/\/darkreader\.org\/help\//.test(spec);
  const sweep = (introOnly = false) => {
    let lostFocus = false;
    for (const t of [...gBrowser.tabs]) {
      if (t === tab || t.pinned) continue;
      const spec = t.linkedBrowser?.currentURI?.spec ?? "";
      if ((!introOnly && isStartupTab(spec)) || isAddonIntro(spec)) {
        if (t.selected) lostFocus = true;
        gBrowser.removeTab(t);
      }
    }
    if (tab.isConnected && (!introOnly || lostFocus)) gBrowser.selectedTab = tab;
  };
  sweep();
  // Eklentiler kurulumdan birkaç saniye sonra kendi tanıtım sekmelerini açıp öne getirir; bu da
  // sihirbazın (odak kipi) bir an kaybolmasına yol açıyordu. İlk 30 sn boyunca:
  //  - kendiliğinden açılan sekme seçilirse sihirbaz hemen geri seçilir (arayüz hiç görünmez),
  //  - tanıtım sayfası adresi belli olur olmaz sekme kapatılır.
  const autoTabs = new WeakSet();
  const onOpen = e => autoTabs.add(e.target);
  const onSelect = () => {
    const sel = gBrowser.selectedTab;
    if (sel !== tab && autoTabs.has(sel) && tab.isConnected) gBrowser.selectedTab = tab;
  };
  const progress = {
    onLocationChange(browser, _wp, _req, location) {
      const t = gBrowser.getTabForBrowser(browser);
      if (t && t !== tab && autoTabs.has(t) && isAddonIntro(location?.spec ?? "")) {
        window.setTimeout(() => t.isConnected && gBrowser.removeTab(t), 0);
      }
    },
  };
  gBrowser.tabContainer.addEventListener("TabOpen", onOpen);
  gBrowser.tabContainer.addEventListener("TabSelect", onSelect);
  gBrowser.addTabsProgressListener(progress);
  window.setTimeout(() => {
    gBrowser.tabContainer.removeEventListener("TabOpen", onOpen);
    gBrowser.tabContainer.removeEventListener("TabSelect", onSelect);
    gBrowser.removeTabsProgressListener(progress);
    sweep(true);
  }, 30000);
}

function whenStartedUp(fn) {
  if (window.gBrowserInit?.delayedStartupFinished) return fn();
  const topic = "browser-delayed-startup-finished";
  const obs = subject => {
    if (subject !== window) return;
    Services.obs.removeObserver(obs, topic);
    fn();
  };
  Services.obs.addObserver(obs, topic);
}

whenStartedUp(() => {
  cleanUrlbar();
  initFocus();
  teachMigratorAboutHelium();
  // Oturum geri yükleme, sekmeleri kurduktan sonra çalışsın.
  window.setTimeout(maybeShowWelcome, 1200);
});
