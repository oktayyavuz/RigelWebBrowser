// Firefox panellerinin Rigel görünümünün JS tarafı (panels.css'in tamamlayıcısı):
//  1. İçerik/sekme iletişim kutuları (commonDialog.xhtml) ayrı bir belgedir; pencereye yüklenen yazar sayfası ona ulaşmaz.
//     panels-dialog.css bu belgeye KULLANICI sayfası olarak kaydedilir (@-moz-document ile yalnız commonDialog.xhtml),
//     Rigel belirteçleri de her açılışta kökten kopyalanır (böylece koyu/açık tema ve vurgu rengi izlenir).
//  2. İzin ve bildirim doorhanger'ları (PopupNotifications) içerik alanının üst-ortasında kart olarak açılır.

const DIALOG_SHEET = "chrome://userscripts/content/theme/panels-dialog.css";
const DIALOG_URL = "chrome://global/content/commonDialog.xhtml";
const VARS = [
  "--bg", "--bar", "--surface", "--surface-2", "--hover", "--border", "--border-2", "--text", "--text-dim", "--text-faint",
  "--shadow", "--shadow-sm", "--danger", "--on-danger", "--accent", "--accent-2", "--accent-ink", "--active", "--accent-wash",
  "--accent-line", "--scrim", "--font", "--mono",
];

function registerDialogSheet() {
  const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  const uri = Services.io.newURI(DIALOG_SHEET);
  if (!sss.sheetRegistered(uri, sss.USER_SHEET)) sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
}

export function init(win) {
  try {
    registerDialogSheet();
  } catch (e) {
    dump(`[rigel] iletişim kutusu stili kaydedilemedi: ${e}\n`);
  }

  // 1. Diyalog belgesine belirteçleri kopyala.
  const dialogObserver = {
    observe(subject) {
      try {
        if (!subject?.location?.href?.startsWith(DIALOG_URL)) return;
        if (subject.browsingContext?.topChromeWindow !== win) return;
        const cs = win.getComputedStyle(win.document.documentElement);
        const style = subject.document.documentElement.style;
        for (const v of VARS) style.setProperty(v, cs.getPropertyValue(v));
        subject.document.documentElement.setAttribute("data-rigel-theme", win.document.documentElement.getAttribute("data-rigel-theme") ?? "dark");
      } catch (e) {
        dump(`[rigel] iletişim kutusu belirteçleri kopyalanamadı: ${e}\n`);
      }
    },
  };
  Services.obs.addObserver(dialogObserver, "common-dialog-loaded");

  // 2. Doorhanger'lar: içerik alanının üst-ortasında kart.
  const panel = win.document.getElementById("notification-popup");
  if (panel && !panel._rglCentered) {
    panel._rglCentered = true;
    const orig = panel.openPopup;
    panel.openPopup = function (anchor, position, x, y, ...rest) {
      try {
        const b = win.gBrowser?.selectedBrowser;
        if (b?.isConnected && b.getBoundingClientRect().width > 360 && typeof position === "string") {
          return orig.call(this, b, "topcenter topcenter", 0, 14, ...rest);
        }
      } catch {}
      return orig.call(this, anchor, position, x, y, ...rest);
    };
  }

  win.addEventListener("unload", () => Services.obs.removeObserver(dialogObserver, "common-dialog-loaded"), { once: true });
}
