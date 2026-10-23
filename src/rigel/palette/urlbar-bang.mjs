// Firefox adres çubuğunda !bang: `!yt kedi` ya da `kedi !yt` Enter'da doğrudan siteye gider.
// gURLBar.handleNavigation (Enter) ve pickResult (sezgisel satıra tıklama) sarılır; yalnızca yazılan metin
// (sezgisel sonuç seçiliyken) ve arama kipi yokken devreye girer. Diğer her şey Firefox'a kalır.
import { parseBang } from "../search/bangs.mjs";
import { bangSettings } from "./settings.mjs";

export function hookUrlbarBangs(win) {
  const bar = win.gURLBar;
  if (!bar || bar.__rigelBangs) return;
  bar.__rigelBangs = true;

  function tryBang(event, result) {
    if (bar.searchMode) return false;
    if (result && !result.heuristic) return false;
    const s = bangSettings();
    if (!s.bangs) return false;
    const hit = parseBang(bar.value, s.customBangs);
    if (!hit) return false;
    let where = "current";
    try {
      where = bar.controller.whereToOpen(event);
    } catch {}
    if (where === "current" && event?.altKey) where = "tab";
    bar.handleRevert();
    bar.view?.close();
    win.openTrustedLinkIn(hit.url, where);
    win.gBrowser.selectedBrowser.focus();
    return true;
  }

  const origNav = bar.handleNavigation;
  bar.handleNavigation = function (params = {}) {
    try {
      const result = this.view?.getResultFromElement?.(this.view.selectedElement) ?? null;
      if (!params.oneOffParams && tryBang(params.event, result)) return;
    } catch (e) {
      win.console.error("[rigel] urlbar bang", e);
    }
    return origNav.call(this, params);
  };

  const origPick = bar.pickResult;
  bar.pickResult = function (params = {}) {
    try {
      if (params.result?.heuristic && tryBang(params.event, params.result)) return;
    } catch (e) {
      win.console.error("[rigel] urlbar bang", e);
    }
    return origPick.call(this, params);
  };
}
