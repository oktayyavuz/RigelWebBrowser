// Yerleşik komutlar. Kısayollar keymap.mjs varsayılanlarından; Firefox'un aynı tuşla aynı işi yaptığı
// yerlerde (Ctrl+T, Ctrl+W, Ctrl+D, Ctrl+F…) tuşu Firefox'a bırakıyoruz (`bind: false`), palette yalnız gösteriliyor.
import { ACTIONS } from "../search/keymap.mjs";
import { cleanUrl } from "../search/cleanurl.mjs";
import { toast } from "./ui.mjs";

const keysOf = (id) => [...(ACTIONS.find((a) => a.id === id)?.keys ?? [])];

export function registerBuiltins(win, registry) {
  const { gBrowser, document: doc } = win;
  const doCmd = (id) => doc.getElementById(id)?.doCommand();
  const sel = () => gBrowser.selectedTab;
  const selURL = () => gBrowser.selectedBrowser?.currentURI?.spec ?? "";
  const isWeb = () => /^https?:/.test(selURL());
  const R = () => win.Rigel;

  const C = (id, label, icon, run, extra = {}) =>
    registry.register({ id, label, icon, run, keys: keysOf(id), ...extra }, { builtin: true });

  // Gizli (yalnız tuş) girişler
  C("palette", "Komut paleti", "search", () => R().palette.toggle(), { hidden: true });
  C("address", "Adres çubuğu", "search", () => {
    if (doc.documentElement.getAttribute("data-rigel-urlbar") === "hidden") R().palette.open();
    else doCmd("Browser:OpenLocation");
  }, { hidden: true, keys: ["Ctrl+L", "Alt+D"] });

  C("newTab", "Yeni sekme", "plus", () => doCmd("cmd_newNavigatorTab"), { bind: false });
  C("newPrivateTab", "Yeni gizli pencere", "mask", () => win.OpenBrowserWindow({ private: true }));
  C("reopenTab", "Kapatılan sekmeyi geri aç", "undo", () => doCmd("History:UndoCloseTab"), { bind: false });
  C("tabsPanel", "Sekme paneli", "tab", () => R().drawers.toggle("tabs"));
  C("split", () => (sel()?.splitview ? "Bölünmüş görünümü kapat" : "Bölünmüş görünüm"), "split", () => {
    if (sel()?.splitview) doCmd("Browser:SeparateTabSplitView");
    else if (sel()?.pinned) toast(win, "Sabitlenmiş sekme bölünemez");
    else doCmd("Browser:AddTabSplitView");
  }, { when: () => win.Services.prefs.getBoolPref("browser.tabs.splitView.enabled", false) });
  C("translate", () => (translatedPair() ? "Orijinali göster" : `Sayfayı çevir: ${langName(targetLang())}`), "translate",
    () => translate(), { when: isWeb });
  C("bookmark", "Yer imlerine ekle / düzenle", "star", () => doCmd("Browser:AddBookmarkAs"), { bind: false, when: isWeb });
  // Geçmiş / yer imleri / indirmeler: Rigel kitaplığı (library.uc.mjs). Kitaplık yoksa Firefox'un penceresi.
  const lib = (route, native) => () => (R().library ? R().library.open(route) : win.PlacesCommandHook.showPlacesOrganizer(native));
  C("history", "Geçmiş", "history", lib("gecmis", "History"));
  C("bookmarks", "Yer imleri", "bookmark", lib("yer-imleri", "AllBookmarks"));
  C("downloads", "İndirmeler", "download", lib("indirmeler", "Downloads"));
  C("downloadsPanel", "Son indirmeler (çekmece)", "download", () => R().drawers.toggle("downloads"), { sub: "sağ panel" });
  C("find", "Sayfada bul", "search", () => doCmd("cmd_find"), { bind: false });
  C("pip", "Resim içinde resim", "pip", () => togglePip(), { keys: ["Ctrl+Shift+]"], bind: false, sub: "videoyu ayır" });
  C("copyUrl", "Adresi kopyala", "link", () => {
    const url = cleanUrl(selURL());
    Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(url);
    toast(win, "Adres kopyalandı");
  }, { when: isWeb });
  C("capturePage", "Ekran görüntüsü al", "capture", () => doCmd("Browser:Screenshot"), { when: isWeb });
  C("settings", "Ayarlar", "gear", () => (R().settings ? R().settings.open() : win.openPreferences()));
  C("home", "Ana sayfa", "home", () => win.BrowserCommands.home(), { bind: false });
  C("reload", "Yenile", "reload", () => doCmd("Browser:Reload"), { bind: false });
  C("hardReload", "Önbelleği atlayarak yenile", "reload", () => doCmd("Browser:ReloadSkipCache"), { bind: false });
  C("fullscreen", "Tam ekran", "fullscreen", () => doCmd("View:FullScreen"), { bind: false });
  C("zoomReset", "Yakınlaştırmayı sıfırla", "search", () => doCmd("cmd_fullZoomReset"), {
    bind: false, sub: () => `%${Math.round((gBrowser.selectedBrowser?.fullZoom ?? 1) * 100)}`,
  });
  C("print", "Yazdır", "printer", () => doCmd("cmd_print"), { bind: false });
  C("viewSource", "Sayfa kaynağı", "code", () => win.BrowserCommands.viewSource(gBrowser.selectedBrowser), { bind: false, when: isWeb });
  C("devtools", "Geliştirici araçları", "code", () => {
    const k = doc.getElementById("key_toggleToolboxF12") ?? doc.getElementById("key_toggleToolbox");
    k?.doCommand();
  }, { bind: false });

  // Sekme eylemleri
  C("closeTab", "Sekmeyi kapat", "close", () => gBrowser.removeTab(sel(), { animate: true }), { bind: false });
  C("pinTab", () => (sel()?.pinned ? "Sekmeyi sabitlemeyi kaldır" : "Sekmeyi sabitle"), "thumbtack", () => togglePin(sel()));
  C("muteTab", () => (sel()?.muted ? "Sekmenin sesini aç" : "Sekmenin sesini kapat"),
    () => (sel()?.muted ? "volume" : "volumeOff"), () => sel()?.toggleMuteAudio(), { bind: false });
  C("duplicateTab", "Sekmeyi çoğalt", "copy", () => win.duplicateTabIn(sel(), "tab"));
  C("sleepTab", "Sekmeyi uyut", "moon", () => gBrowser.explicitUnloadTabs([sel()]), {
    sub: "bellek tasarrufu", when: () => gBrowser.visibleTabs.length > 1,
  });
  C("sleepTabs", "Arka plandaki sekmeleri uyut", "moon", () => {
    const n = sleepOthers();
    toast(win, n ? `${n} sekme uyutuldu` : "Uyutulacak sekme yok");
  }, { sub: "bellek tasarrufu" });
  C("closeOtherTabs", "Diğer sekmeleri kapat", "close", () => gBrowser.removeAllTabsBut(sel()));
  C("closeTabsRight", "Sağdaki sekmeleri kapat", "forward", () => gBrowser.removeTabsToTheEndFrom(sel()));
  C("restart", "Rigel'i yeniden başlat", "power", () => {
    const cancel = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
    Services.obs.notifyObservers(cancel, "quit-application-requested", "restart");
    if (!cancel.data) Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
  });
  C("quit", "Rigel'i kapat", "power", () => doCmd("cmd_quitApplication"), { bind: false });

  // Firefox'ta palet/kısayolun karşılığı olmayan tuşları sonradan ekleyen modüller (DevTools) için.
  win.setTimeout(() => registry.suppressConflicts(), 3000);

  function togglePin(tab) {
    if (!tab) return;
    if (tab.pinned) gBrowser.unpinTab(tab);
    else gBrowser.pinTab(tab);
  }

  function sleepOthers() {
    let n = 0;
    for (const t of gBrowser.tabs) {
      const visibleSplit = t.splitview && t.splitview === sel()?.splitview;
      if (t.selected || visibleSplit || t.hasAttribute("pending") || !t.linkedPanel) continue;
      try {
        if (gBrowser.discardBrowser(t)) n++;
      } catch {}
    }
    return n;
  }

  // Sayfa çevirisi: Firefox'un cihazda çalışan çevirisi. Dil algılandıysa doğrudan hedef dile çevirir,
  // algılanmadıysa Firefox'un çeviri panelini açar.
  function translationsActor() {
    try {
      const TP = win.TranslationsParent
        ?? ChromeUtils.importESModule("resource://gre/actors/TranslationsParent.sys.mjs").TranslationsParent;
      return TP.getTranslationsActor(gBrowser.selectedBrowser);
    } catch {
      return null;
    }
  }
  function translatedPair() {
    return translationsActor()?.languageState?.requestedLanguagePair ?? null;
  }
  function targetLang() {
    return Services.prefs.getStringPref("rigel.translate.to", "tr");
  }
  function langName(tag) {
    try {
      return new Intl.DisplayNames(["tr"], { type: "language" }).of(tag) ?? tag;
    } catch { return tag; }
  }
  async function translate() {
    const actor = translationsActor();
    if (!actor) {
      toast(win, "Bu sayfa çevrilemez");
      return;
    }
    if (translatedPair()) {
      actor.restorePage();
      return;
    }
    const doc_ = actor.languageState?.detectedLanguages?.docLangTag;
    const to = targetLang();
    if (doc_ && doc_ === to) {
      toast(win, `Sayfa zaten ${langName(to)}`, { error: false });
      return;
    }
    if (doc_) {
      toast(win, `Çevriliyor: ${langName(doc_)} → ${langName(to)}`, { error: false });
      await actor.translate({ sourceLanguage: doc_, targetLanguage: to }, false);
    } else {
      doCmd("cmd_translate");
    }
  }

  // Resim içinde resim: seçili sekmedeki (alt çerçeveler dahil) oynayan videoyu ayırır ya da geri alır.
  // Firefox'un PiP modülünü kullanır; içerik odağı gerekmez (paletten de çalışır).
  function togglePip() {
    const PiP = win.PictureInPicture;
    const browser = gBrowser.selectedBrowser;
    if (!PiP || !Services.prefs.getBoolPref("media.videocontrols.picture-in-picture.enabled", true)) {
      toast(win, "Resim içinde resim kapalı");
      return;
    }
    let target = null;
    try {
      for (const { windowGlobal, pipCount } of PiP.windowGlobalPipCountGenerator(browser)) {
        if (pipCount > 0) {
          target = windowGlobal;
          break;
        }
      }
    } catch {}
    target ??= browser.browsingContext?.currentWindowGlobal;
    if (!target) {
      toast(win, "Bu sekmede video bulunamadı");
      return;
    }
    try {
      target.getActor("PictureInPictureLauncher").sendAsyncMessage("PictureInPicture:KeyToggle");
    } catch (e) {
      win.console.error("[rigel] PiP", e);
      toast(win, "Resim içinde resim açılamadı");
    }
  }
}
