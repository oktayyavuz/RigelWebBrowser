// ==UserScript==
// @name           Rigel bileşenleri
// @description    Palet, sağ çekmeceler (sekmeler, indirmeler), komutlar, adres çubuğunda !bang
// ==/UserScript==

// Ortak API: Rigel.commands, Rigel.palette, Rigel.drawers, Rigel.toast.
// Hazır olunca `rigel:components-ready` olayı gönderilir.

const BASE = "chrome://userscripts/content/";
const Rigel = (window.Rigel ??= {});

for (const sheet of ["palette/palette.css", "drawers/drawers.css"]) {
  window.windowUtils.loadSheetUsingURIString(BASE + sheet, window.windowUtils.AUTHOR_SHEET);
}

// Firefox'un kendi indirme paneli yerine Rigel çekmecesi açılır (varsayılan dal; kullanıcı değiştirebilir).
Services.prefs.getDefaultBranch("").setBoolPref("browser.download.alwaysOpenPanel", false);

// Komut kaydı hemen hazır olsun ki diğer modüller erken kayıt yapabilsin.
const { createRegistry } = await import(BASE + "commands/registry.mjs");
const registry = createRegistry(window);
Rigel.commands = {
  register: (spec) => registry.register(spec),
  unregister: (id) => registry.unregister(id),
  list: (o) => registry.list(o),
  run: (id, o) => registry.run(id, o),
};

function whenStartedUp(fn) {
  if (window.gBrowserInit?.delayedStartupFinished) {
    fn();
    return;
  }
  const topic = "browser-delayed-startup-finished";
  const obs = (subject) => {
    if (subject !== window) return;
    Services.obs.removeObserver(obs, topic);
    fn();
  };
  Services.obs.addObserver(obs, topic);
}

whenStartedUp(async () => {
  try {
    const [ui, builtin, palette, drawers, urlbar] = await Promise.all([
      import(BASE + "commands/ui.mjs"),
      import(BASE + "commands/builtin.mjs"),
      import(BASE + "palette/palette.mjs"),
      import(BASE + "drawers/drawers.mjs"),
      import(BASE + "palette/urlbar-bang.mjs"),
    ]);
    Rigel.toast = (text, o) => ui.toast(window, text, o);
    Rigel.palette = palette.createPalette(window, registry);
    Rigel.drawers = drawers.createDrawers(window);
    builtin.registerBuiltins(window, registry);
    urlbar.hookUrlbarBangs(window);
    document.documentElement.setAttribute("rigel-components", "ready");
    window.dispatchEvent(new CustomEvent("rigel:components-ready"));
  } catch (e) {
    dump(`[rigel] bileşenler yüklenemedi: ${e}\n${e.stack}\n`);
    console.error(e);
  }
});
