// Önceki oturumu geri yükleme: "Rigel açılınca › Yeni sekme aç" seçiliyken eski sekmeler kaybolmasın.
// Firefox son oturumu (SessionStore.canRestoreLastSession) zaten saklar; burada iki yol sunulur:
//  - açılıştan sonra ilk pencerede, önceki oturum varsa küçük bir şerit: "Geri yükle" / kapat;
//  - palet komutu "Önceki oturumu geri yükle" (oturum varken).
// Ayar değişimi hiçbir açık sekmeyi kapatmaz (Ayarlar yalnız browser.startup.page tercihini yazar).

import { toast } from "./util.mjs";
import { icon } from "../shell/common.mjs";

const BASE = "chrome://userscripts/content/";
const HTML = "http://www.w3.org/1999/xhtml";
const SHOW_MS = 30000;

const canRestore = () => {
  try {
    return SessionStore.canRestoreLastSession === true;
  } catch {
    return false;
  }
};

export function init(win) {
  const doc = win.document;
  const utils = win.windowUtils;
  const sheet = `${BASE}zen/session.css`;
  utils.loadSheetUsingURIString(sheet, utils.AUTHOR_SHEET);
  let bar = null;
  let timer = 0;
  let destroyed = false;

  const privateWin = () => win.PrivateBrowsingUtils?.isWindowPrivate(win) ?? false;

  function hide() {
    win.clearTimeout(timer);
    bar?.classList.add("leaving");
    const b = bar;
    bar = null;
    win.setTimeout(() => b?.remove(), 220);
  }

  function restore() {
    if (!canRestore()) {
      toast(win, "Geri yüklenecek oturum yok");
      return;
    }
    try {
      SessionStore.restoreLastSession();
      toast(win, "Önceki oturum geri yüklendi");
    } catch (e) {
      win.dump(`[rigel] oturum geri yüklenemedi: ${e}\n`);
      toast(win, "Oturum geri yüklenemedi");
    }
  }

  function show() {
    if (bar || destroyed) return;
    const mk = (tag, props = {}, ...kids) => {
      const e = doc.createElementNS(HTML, tag);
      for (const [k, v] of Object.entries(props)) {
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      }
      e.append(...kids);
      return e;
    };
    bar = mk("div", { id: "rigel-session-bar", role: "status" },
      icon(doc, "history", 16),
      mk("span", { class: "msg", text: "Önceki oturumun sekmeleri geri yüklenebilir" }),
      mk("button", { class: "go", text: "Geri yükle", onclick: () => { hide(); restore(); } }),
      mk("button", { class: "x", title: "Kapat", "aria-label": "Kapat", onclick: hide }, icon(doc, "close", 13)));
    doc.documentElement.append(bar);
    timer = win.setTimeout(hide, SHOW_MS);
  }

  // Yalnız uygulama açılışındaki ilk (tek) normal pencerede, oturum zaten geri yüklenmiyorsa.
  async function offer() {
    try {
      await SessionStore.promiseAllWindowsRestored;
    } catch {}
    if (destroyed || privateWin()) return;
    if (Services.prefs.getIntPref("browser.startup.page", 1) === 3) return;
    // Uygulama başına bir kez (pencereler arası bayrak: süreç ortamı; Linux'ta hiddenDOMWindow yok).
    if (Services.env.exists("RIGEL_SESSION_OFFERED")) return;
    const wins = [...Services.wm.getEnumerator("navigator:browser")];
    const upMs = Date.now() - Services.startup.getStartupInfo().process.getTime();
    if (wins.length !== 1 || wins[0] !== win || upMs > 120000) return;
    Services.env.set("RIGEL_SESSION_OFFERED", "1");
    // Son oturum durumu SessionStore'a pencere göründükten biraz sonra yazılır; kısa süre bekle.
    for (let i = 0; i < 25 && !canRestore() && !destroyed; i++) await new Promise(r => win.setTimeout(r, 200));
    if (canRestore()) show();
  }
  offer();

  return {
    commands: () => [{
      id: "session.restoreLast", label: "Önceki oturumu geri yükle", sub: "son kapanıştaki pencereler ve sekmeler", icon: "history",
      keywords: "oturum geri yükle kaldığım yerden önceki sekmeler session restore",
      when: canRestore, run: restore,
    }],
    destroy() {
      destroyed = true;
      win.clearTimeout(timer);
      bar?.remove();
      try {
        utils.removeSheetUsingURIString(sheet, utils.AUTHOR_SHEET);
      } catch {}
    },
  };
}
