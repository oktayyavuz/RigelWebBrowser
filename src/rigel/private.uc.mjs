// ==UserScript==
// @name           Rigel gizli pencere
// @description    Gizli pencere: Rigel gizli sekme sayfası, mor vurgu ve "Gizli" etiketi, pencere başlığı, komutlar
// ==/UserScript==

// Gizli pencerede (PrivateBrowsingUtils.isWindowPrivate) şunları yapar:
//  1. Kökte data-rigel-private (theme/private.css: mor vurgu, mora çalan yüzeyler, Firefox göstergesi gizli).
//  2. Yeni sekme ve about:privatebrowsing yüklemelerini chrome://rigel/content/private/private.html'e yönlendirir.
//     Neden böyle: gizli pencerede BROWSER_NEW_TAB_URL (değiştirilemez, configurable değil) ya "about:privatebrowsing"
//     ya da AboutNewTab.newTabURL'dir (Rigel yeni sekmesi); AboutNewTab genel olduğundan pencereye göre ayrılamaz.
//     Yeni gizli pencere de BrowserWindowTracker üzerinden doğrudan "about:privatebrowsing" ile açılır. İkisini de
//     sekme ilerleme dinleyicisiyle (STATE_START) yakalayıp aynı sekmede geçmişi değiştirerek yeniden yüklüyoruz.
//  3. Adres çubuğu bu sayfada boş; sekme ikonu/başlığı sayfanınkinden gelir; gInitialPages'e eklenir.
//  4. Her düzende kendi şeridine "Gizli" etiketi (pill) koyar; pencere başlığı "… — Gizli Pencere — Rigel".
// Komutlar (tüm pencerelerde): "Gizli pencereleri kapat". ("Yeni gizli pencere" commands/builtin.mjs'te.)

const BASE = "chrome://userscripts/content/";
const PRIVATE_URL = "chrome://rigel/content/private/private.html";
const NEWTAB_URL = "chrome://rigel/content/newtab/newtab.html";
const Rigel = (window.Rigel ??= {});
const root = document.documentElement;
const isPrivate = !!window.PrivateBrowsingUtils?.isWindowPrivate(window);
const sysPrincipal = () => Services.scriptSecurityManager.getSystemPrincipal();

const privateWindows = () =>
  [...Services.wm.getEnumerator("navigator:browser")].filter(w => !w.closed && w.PrivateBrowsingUtils?.isWindowPrivate(w));

Rigel.private = {
  URL: PRIVATE_URL,
  isPrivate: () => isPrivate,
  windows: privateWindows,
  closeAll() {
    const wins = privateWindows();
    for (const w of wins) w.close();
    return wins.length;
  },
};

// --- Komutlar ---------------------------------------------------------------------
let commandsRegistered = false;
function registerCommands() {
  const reg = window.Rigel?.commands?.register;
  if (!reg || commandsRegistered) return;
  commandsRegistered = true;
  try {
    reg({
      id: "private.closeAll", label: "Gizli pencereleri kapat", icon: "mask", sub: "geçmiş ve çerezler silinir",
      when: () => privateWindows().length > 0,
      run: () => {
        const n = Rigel.private.closeAll();
        if (n) Rigel.toast?.(`${n} gizli pencere kapatıldı`);
      },
    });
  } catch (e) {
    dump(`[rigel] gizli pencere komutları kaydedilemedi: ${e}\n`);
  }
}
window.addEventListener("rigel:components-ready", registerCommands);
registerCommands();

if (isPrivate) setUpPrivateWindow();

function setUpPrivateWindow() {
  const utils = window.windowUtils;
  root.setAttribute("data-rigel-private", "true");
  utils.loadSheetUsingURIString(BASE + "theme/private.css", utils.AUTHOR_SHEET);

  const whenStartedUp = fn => {
    if (window.gBrowserInit?.delayedStartupFinished) return fn();
    const topic = "browser-delayed-startup-finished";
    const obs = subject => {
      if (subject !== window) return;
      Services.obs.removeObserver(obs, topic);
      fn();
    };
    Services.obs.addObserver(obs, topic);
  };

  // --- Yönlendirme ----------------------------------------------------------------
  const REDIRECT = new Set(["about:privatebrowsing", NEWTAB_URL]);
  const redirect = browser => {
    try {
      browser.loadURI(Services.io.newURI(PRIVATE_URL), {
        triggeringPrincipal: sysPrincipal(),
        loadFlags: Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY,
      });
    } catch (e) {
      dump(`[rigel] gizli sayfa yönlendirilemedi: ${e}\n`);
    }
  };
  const listener = {
    onStateChange(browser, webProgress, request, flags) {
      const { STATE_START, STATE_IS_DOCUMENT } = Ci.nsIWebProgressListener;
      if (!webProgress.isTopLevel || !(flags & STATE_START) || !(flags & STATE_IS_DOCUMENT)) return;
      try {
        const ch = request.QueryInterface(Ci.nsIChannel);
        if (REDIRECT.has(ch.originalURI.spec) || REDIRECT.has(ch.URI.spec)) redirect(browser);
      } catch {}
    },
    onLocationChange(browser, webProgress, request, location) {
      if (webProgress.isTopLevel && location && REDIRECT.has(location.spec)) redirect(browser);
    },
  };

  // --- Adres çubuğu (gizli sekmede boş) ----------------------------------------------
  function cleanUrlbar() {
    const bar = window.gURLBar;
    if (!bar || bar.__rigelPrivate) return;
    bar.__rigelPrivate = true;
    const orig = bar.setURI;
    bar.setURI = function (...args) {
      const r = orig.apply(this, args);
      try {
        const a = args[0];
        const spec = (a?.uri ?? (a?.spec ? a : null) ?? window.gBrowser.selectedBrowser?.currentURI)?.spec;
        if (spec?.startsWith(PRIVATE_URL)) {
          this.value = "";
          this.setPageProxyState?.("invalid");
        }
      } catch {}
      return r;
    };
  }

  // --- Pencere başlığı ----------------------------------------------------------------
  let titling = false;
  function fixTitle() {
    if (titling) return;
    titling = true;
    try {
      const label = window.gBrowser?.selectedTab?.label ?? "";
      const page = label && label !== "Gizli sekme" && !/^(about:|chrome:\/\/)/.test(label) ? `${label} — ` : "";
      const title = `${page}Gizli Pencere — Rigel`;
      if (document.title !== title) document.title = title;
    } finally {
      titling = false;
    }
  }

  // --- "Gizli" etiketi: düzene göre yer ---------------------------------------------
  const PLACE = {
    yanpanel: pill => document.querySelector("#rigel-side-top .rigel-brand")?.after(pill),
    ada: pill => document.querySelector("#rigel-ada .rigel-left .rigel-logo")?.after(pill),
    dock: pill => document.querySelector("#rigel-docktop .rigel-nav")?.after(pill),
    komuta: pill => document.querySelector("#rigel-komuta .rigel-komuta-logo")?.after(pill),
    klasik: pill => document.getElementById("rigel-klasik-wctl")?.before(pill),
  };
  let iconFn = null;
  function placePill() {
    document.querySelectorAll(".rigel-private-pill").forEach(n => n.remove());
    const layout = root.getAttribute("data-rigel-layout");
    if (!layout || !PLACE[layout] || !iconFn) return;
    const pill = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    pill.className = "rigel-private-pill";
    pill.title = "Gizli pencere: geçmiş ve çerezler pencere kapanınca silinir";
    pill.append(iconFn(document, "mask", 14), document.createTextNode("Gizli"));
    PLACE[layout](pill);
  }

  whenStartedUp(() => {
    const { gBrowser } = window;
    gBrowser.addTabsProgressListener(listener);
    window.addEventListener("unload", () => gBrowser.removeTabsProgressListener(listener), { once: true });
    // Pencere ilk sekmesini dinleyicimizden önce yüklemeye başlamış olabilir.
    for (const tab of gBrowser.tabs) {
      const spec = tab.linkedBrowser?.currentURI?.spec;
      if (REDIRECT.has(spec)) redirect(tab.linkedBrowser);
    }
    try {
      window.gInitialPages?.push(PRIVATE_URL);
    } catch {}
    cleanUrlbar();
    for (const ev of ["TabSelect", "TabAttrModified"]) gBrowser.tabContainer.addEventListener(ev, fixTitle);
    new MutationObserver(fixTitle).observe(root, { attributes: true, attributeFilter: ["title"] });
    fixTitle();
  });

  import(BASE + "shell/common.mjs").then(m => {
    iconFn = m.icon;
    placePill();
  }).catch(e => dump(`[rigel] gizli etiket yüklenemedi: ${e}\n`));
  window.addEventListener("rigel:layout-changed", placePill);
  root.setAttribute("data-rigel-private", "true");
}
