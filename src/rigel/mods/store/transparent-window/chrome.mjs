// Saydam pencere — Rigel modu (davranış). Firefox'un saydam pencere tercihlerini ayarlar; boyamayı chrome.css yapar.
//   widget.transparent-windows               : GTK pencere RGBA görsel (yalnız ilk pencere oluşurken okunur; kapalıysa yeniden başlatma gerekir)
//   browser.tabs.allow_transparent_browser   : yeni <browser>'lara transparent="true" (sayfa arka planı saydam olabilsin)
// Eski değerler `rigel.mods.transparent-window.saved` içinde saklanır; son etkin pencere temizlenince geri yüklenir.
export default function (api) {
  const { window: win, document: doc } = api;
  const root = doc.documentElement;
  const P = Services.prefs;
  const SAVED = "rigel.mods.transparent-window.saved";
  const ENV = "RIGEL_TW_STARTUP";
  const want = { "widget.transparent-windows": true };
  if (api.prefs.page) want["browser.tabs.allow_transparent_browser"] = true;

  const readSaved = () => { try { return JSON.parse(P.getStringPref(SAVED, "{}")) || {}; } catch { return {}; } };
  const restoreOne = (name, rec) => {
    try { if (rec.had) P.setBoolPref(name, !!rec.value); else P.clearUserPref(name); } catch (e) { api.log("tercih geri yüklenemedi", name, e); }
  };

  // İşlemin başlangıcındaki widget.transparent-windows değeri (bir kez yazılır)
  if (!Services.env.exists(ENV)) Services.env.set(ENV, P.getBoolPref("widget.transparent-windows", false) ? "1" : "0");
  const startupOk = Services.env.get(ENV) === "1";

  const saved = readSaved();
  for (const name of Object.keys(saved)) if (!(name in want)) { restoreOne(name, saved[name]); delete saved[name]; }
  for (const [name, val] of Object.entries(want)) {
    if (!(name in saved)) saved[name] = { had: P.prefHasUserValue(name), value: P.prefHasUserValue(name) ? P.getBoolPref(name, false) : null };
    try { if (P.getBoolPref(name, false) !== val) P.setBoolPref(name, val); } catch (e) { api.log("tercih ayarlanamadı", name, e); }
  }
  P.setStringPref(SAVED, JSON.stringify(saved));

  root.setAttribute("rigel-tw-active", "");
  if (startupOk) {
    root.setAttribute("rigel-tw", "");
  } else {
    api.toast("Saydam pencere için Rigel'i yeniden başlatın (pencere saydamlığı açılışta okunur).");
  }

  // Sayfa saydamsa var olan sekmelerin <browser>'ına da transparent ekle
  const marked = [];
  if (api.prefs.page) {
    for (const b of win.gBrowser.browsers) if (!b.hasAttribute("transparent")) { b.setAttribute("transparent", "true"); marked.push(b); }
    api.listen(win.gBrowser.tabContainer, "TabOpen", e => {
      const b = e.target.linkedBrowser;
      if (b && !b.hasAttribute("transparent")) { b.setAttribute("transparent", "true"); marked.push(b); }
    });
  }

  return () => {
    root.removeAttribute("rigel-tw");
    root.removeAttribute("rigel-tw-active");
    for (const b of marked) { try { b.removeAttribute("transparent"); } catch {} }
    marked.length = 0;
    // Başka etkin pencere kaldıysa tercihlere dokunma
    for (const w of Services.wm.getEnumerator("navigator:browser")) {
      if (w !== win && !w.closed && w.document.documentElement.hasAttribute("rigel-tw-active")) return;
    }
    const rec = readSaved();
    for (const [name, r] of Object.entries(rec)) restoreOne(name, r);
    try { P.clearUserPref(SAVED); } catch {}
  };
}
