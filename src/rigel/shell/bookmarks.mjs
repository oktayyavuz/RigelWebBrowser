// Yer imi çubuğu: Firefox'un kendi #PersonalToolbar'ı her düzende görünür olabilir.
// Görünürlük Firefox'ta kalır (browser.toolbars.bookmarks.visibility = always|newtab|never, `collapsed`
// özniteliği, Ctrl+Shift+B = BookmarkingUI.toggleBookmarksToolbar). Burada yalnız:
//  - Rigel'in yeni sekme / gizli sekme sayfaları "yeni sekme" sayılır (newtab modu),
//  - tercih değişince (ayarlar) açık pencerede hemen uygulanır,
//  - (Yan Panel'de çubuğu sayfa kartının üstüne shell/yanpanel.mjs taşır; diğerlerinde #navigator-toolbox'ta kalır),
//  - palete "Yer imi çubuğunu göster/gizle" komutu eklenir.
// Görünüm: layouts/base.css "Yer imi çubuğu" bölümü.

const PREF = "browser.toolbars.bookmarks.visibility";
const RIGEL_NEWTAB = /^chrome:\/\/rigel\/content\/(newtab|private)\//;

export function init(win) {
  const doc = win.document;
  const toolbar = doc.getElementById("PersonalToolbar");
  const BUI = win.BookmarkingUI;
  if (!toolbar || !BUI) return () => {};
  const undo = [];

  // 1) Rigel yeni sekmesi de "yeni sekme sayfası".
  const origIsNewTab = BUI.isOnNewTabPage;
  if (typeof origIsNewTab === "function") {
    BUI.isOnNewTabPage = function (uri) {
      if (uri?.spec && RIGEL_NEWTAB.test(uri.spec)) return true;
      return origIsNewTab.call(this, uri);
    };
    undo.push(() => (BUI.isOnNewTabPage = origIsNewTab));
  }

  // 2) Tercihi bu pencerede uygula (Firefox yalnız konum değişince yeniden bakar).
  const apply = () => {
    try {
      win.setToolbarVisibility?.(toolbar, Services.prefs.getCharPref(PREF, "newtab"), false, true);
    } catch (e) {
      win.dump(`[rigel] yer imi çubuğu: ${e}\n`);
    }
  };
  const obs = { observe: () => apply() };
  Services.prefs.addObserver(PREF, obs);
  undo.push(() => Services.prefs.removeObserver(PREF, obs));
  apply();

  // 4) Palet komutu (tuşu Firefox'un kendi viewBookmarksToolbarKb'si bağlar).
  let registered = false;
  const register = () => {
    const reg = win.Rigel?.commands?.register;
    if (!reg || registered) return;
    registered = true;
    try {
      reg({
        id: "bookmarks.toolbar",
        label: () => (toolbar.collapsed ? "Yer imi çubuğunu göster" : "Yer imi çubuğunu gizle"),
        sub: () => ({ always: "her zaman", newtab: "yalnız yeni sekmede", never: "gizli" })[Services.prefs.getCharPref(PREF, "newtab")] ?? "",
        keys: ["Ctrl+Shift+B"],
        icon: "star",
        run: () => BUI.toggleBookmarksToolbar("rigel-palette"),
      });
    } catch (e) {
      win.dump(`[rigel] yer imi komutu kaydedilemedi: ${e}\n`);
    }
  };
  win.addEventListener("rigel:components-ready", register);
  undo.push(() => win.removeEventListener("rigel:components-ready", register));
  register();

  return () => {
    for (const fn of undo.reverse()) {
      try {
        fn();
      } catch {}
    }
  };
}
