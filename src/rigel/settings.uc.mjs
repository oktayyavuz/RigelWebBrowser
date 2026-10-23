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
  const spec = gBrowser.selectedBrowser?.currentURI?.spec ?? "";
  const on = spec.startsWith(WELCOME_URL);
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
async function teachMigratorAboutHelium() {
  try {
    const { ChromeMigrationUtils } = ChromeUtils.importESModule("resource:///modules/ChromeMigrationUtils.sys.mjs");
    if (ChromeMigrationUtils.__rigelHelium) return;
    ChromeMigrationUtils.__rigelHelium = true;
    const orig = ChromeMigrationUtils.getDataPath.bind(ChromeMigrationUtils);
    ChromeMigrationUtils.getDataPath = async function (name = "Chrome") {
      const p = await orig(name);
      // Gerçek bir Chromium profili yoksa ("Local State" bulunmuyorsa) Helium'a bak.
      if (name === "Chromium" && !(p && (await IOUtils.exists(PathUtils.join(p, "Local State"))))) {
        const he = PathUtils.join(Services.dirsvc.get("Home", Ci.nsIFile).path, ".config", "net.imput.helium");
        if (await IOUtils.exists(he)) return he;
      }
      return p;
    };
  } catch (e) {
    console.error("[rigel] Helium içe aktarma yaması", e);
  }
}

// İlk açılış: rigel.welcome.done false ise sihirbazı aç (ilk tarayıcı penceresinde, bir kez).
function maybeShowWelcome() {
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
  // Eklentiler kurulumdan birkaç saniye sonra sekme açar; ilk 20 sn boyunca onları da topla.
  // Kullanıcının bu sürede açtığı yeni sekmelere dokunma: yalnız tanıtım sayfaları.
  const onOpen = () => window.setTimeout(() => sweep(true), 1500);
  gBrowser.tabContainer.addEventListener("TabOpen", onOpen);
  window.setTimeout(() => gBrowser.tabContainer.removeEventListener("TabOpen", onOpen), 20000);
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
