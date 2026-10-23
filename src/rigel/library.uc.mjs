// ==UserScript==
// @name           Rigel kitaplığı
// @description    Geçmiş / yer imleri / indirmeler sayfasını (chrome://rigel/content/library/) açar; Firefox'un Kitaplık penceresi ve kısayollarını ona yönlendirir
// ==/UserScript==

// Sayfa: pages/library/ (library.html#gecmis | #yer-imleri[/klasör] | #indirmeler).
// API: Rigel.library.open(rota?, param?), Rigel.library.openNative(öğe) (Firefox'un Kitaplık penceresi).
// Yönlendirme: PlacesCommandHook.showPlacesOrganizer(öğe) tek giriş noktasıdır; Ctrl+Shift+H / Ctrl+Shift+O,
// menülerdeki "tüm geçmişi / yer imlerini yönet" ve "tüm indirmeleri göster" hepsi buradan geçer.
// Ctrl+H ve Ctrl+J, commands/builtin.mjs komutlarıyla bağlanır.

const Rigel = (window.Rigel ??= {});
const LIBRARY_URL = "chrome://rigel/content/library/library.html";
const sysPrincipal = () => Services.scriptSecurityManager.getSystemPrincipal();
const ROUTES = ["gecmis", "yer-imleri", "indirmeler"];

function openPage(route, param) {
  const hash = route + (param ? "/" + encodeURIComponent(param) : "");
  const url = `${LIBRARY_URL}#${hash}`;
  for (const tab of gBrowser.tabs) {
    const spec = tab.linkedBrowser?.currentURI?.spec ?? "";
    if (!spec.startsWith(LIBRARY_URL)) continue;
    gBrowser.selectedTab = tab;
    if (spec !== url) tab.linkedBrowser.loadURI(Services.io.newURI(url), { triggeringPrincipal: sysPrincipal() });
    return tab;
  }
  const tab = gBrowser.addTab(url, { triggeringPrincipal: sysPrincipal(), inBackground: false });
  gBrowser.selectedTab = tab;
  return tab;
}

let nativeShow = null; // Firefox'un özgün showPlacesOrganizer'ı

// Firefox'un Kitaplık öğesi → Rigel rotası
function routeOf(item) {
  switch (item) {
    case "History": return ["gecmis"];
    case "Downloads": return ["indirmeler"];
    case "BookmarksToolbar": return ["yer-imleri", PlacesUtils.bookmarks.toolbarGuid];
    case "BookmarksMenu": return ["yer-imleri", PlacesUtils.bookmarks.menuGuid];
    default: return ["yer-imleri"]; // AllBookmarks, UnfiledBookmarks
  }
}

Rigel.library = {
  URL: LIBRARY_URL,
  /** rota: "gecmis" | "yer-imleri" | "indirmeler" (varsayılan gecmis). Açıksa o sekmeye geçer. */
  open(route = "gecmis", param) {
    if (!ROUTES.includes(route)) route = "gecmis";
    return openPage(route, param);
  },
  /** Firefox'un kendi Kitaplık penceresi: "History" | "AllBookmarks" | "Downloads" | … */
  openNative(item = "AllBookmarks") {
    return nativeShow ? nativeShow.call(window.PlacesCommandHook, item) : window.PlacesCommandHook?.showPlacesOrganizer(item);
  },
};

function hookPlaces() {
  const hook = window.PlacesCommandHook;
  if (!hook || hook.__rigelLibrary) return;
  hook.__rigelLibrary = true;
  nativeShow = hook.showPlacesOrganizer;
  hook.showPlacesOrganizer = function (item) {
    // Gizli pencerede indirmeler kendi (oturumluk) listesinde kalsın: Firefox'un yoluna dokunma.
    if (item === "Downloads" && window.PrivateBrowsingUtils?.isWindowPrivate(window)) return nativeShow.call(this, item);
    const [route, param] = routeOf(item);
    return Rigel.library.open(route, param);
  };
}

// Geçmiş kenar çubuğu (Ctrl+H'nin Firefox karşılığı, menüler): kitaplığa gider. Yalnız `toggle` (kullanıcı eylemi);
// `show` oturum geri yüklenirken de çağrıldığı için dokunulmaz.
function hookSidebar() {
  const sc = window.SidebarController;
  if (!sc || sc.__rigelLibrary) return;
  sc.__rigelLibrary = true;
  const orig = sc.toggle;
  sc.toggle = function (id, ...rest) {
    if ((id ?? "") === "viewHistorySidebar") return Rigel.library.open("gecmis");
    return orig.call(this, id, ...rest);
  };
}

// Adres çubuğu: kitaplıkta boş (yer tutucu görünür), ayarlardaki gibi.
function cleanUrlbar() {
  const bar = window.gURLBar;
  if (!bar || bar.__rigelLibrary) return;
  bar.__rigelLibrary = true;
  const orig = bar.setURI;
  bar.setURI = function (...args) {
    const r = orig.apply(this, args);
    try {
      const a = args[0];
      const spec = (a?.uri ?? (a?.spec ? a : null) ?? gBrowser.selectedBrowser?.currentURI)?.spec;
      if (spec?.startsWith(LIBRARY_URL)) {
        this.value = "";
        this.setPageProxyState?.("invalid");
      }
    } catch {}
    return r;
  };
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

hookPlaces();
whenStartedUp(() => {
  hookPlaces();
  hookSidebar();
  cleanUrlbar();
});
