// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Göz at (glance) içerik tarafı: Alt+tık bir bağlantıdaysa sayfanın gezinmesini durdurur ve
// adresi üst sürece gönderir. Fikir Zen Browser'ın ZenGlanceChild.sys.mjs dosyasından.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
});

const PREF = "rigel.glance.enabled";

export class RigelGlanceChild extends JSWindowActorChild {
  handleEvent(event) {
    if (event.type !== "click" || !event.isTrusted || event.button !== 0) return;
    if (!event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;
    if (!Services.prefs.getBoolPref(PREF, true)) return;
    const [href, , principal] = lazy.BrowserUtils.hrefAndLinkNodeForClickEvent(event);
    if (!href || !principal) return;
    try {
      if (Services.io.extractScheme(href) === "javascript") return;
      Services.scriptSecurityManager.checkLoadURIStrWithPrincipal(principal, href);
    } catch {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.sendAsyncMessage("RigelGlance:Open", { url: href });
  }
}
