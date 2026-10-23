// ==UserScript==
// @name           Rigel sağ tık menüleri
// @description    İçerik, sekme ve araç çubuğu sağ tık menüleri: ayıklanmış, ikonlu, Rigel öğeleriyle
// ==/UserScript==

// Her menü kendi modülünde (menus/content.mjs, tab.mjs, toolbar.mjs). Firefox menüleri yeniden kursa da
// öğeler `popupshowing` ile her açılışta güncellenir; öğeler yalnız bir kez eklenir.

const BASE = "chrome://userscripts/content/";
const Rigel = (window.Rigel ??= {});

function whenStartedUp() {
  if (window.gBrowserInit?.delayedStartupFinished) return Promise.resolve();
  return new Promise((resolve) => {
    const topic = "browser-delayed-startup-finished";
    const obs = (subject) => {
      if (subject !== window) return;
      Services.obs.removeObserver(obs, topic);
      resolve();
    };
    Services.obs.addObserver(obs, topic);
  });
}

const parts = [];
const utils = window.windowUtils;

async function start() {
  await whenStartedUp();
  const common = await import(BASE + "menus/common.mjs");
  utils.loadSheetUsingURIString(BASE + "menus/menus.css", utils.AUTHOR_SHEET);
  utils.loadSheetUsingURIString("data:text/css," + encodeURIComponent(common.iconCss()), utils.AUTHOR_SHEET);
  const mods = await Promise.all(["content", "tab", "toolbar", "appmenu"].map((n) => import(`${BASE}menus/${n}.mjs`)));
  for (const mod of mods) {
    try {
      parts.push(mod.init(window));
    } catch (e) {
      dump(`[rigel] menü modülü kurulamadı: ${e}\n${e.stack}\n`);
    }
  }
  document.documentElement.setAttribute("rigel-menus", "ready");
  window.dispatchEvent(new CustomEvent("rigel:menus-ready"));
}

Rigel.menus = { ready: false };

window.addEventListener("unload", () => {
  for (const p of parts) {
    try {
      p?.destroy?.();
    } catch {}
  }
}, { once: true });

start().then(() => (Rigel.menus.ready = true)).catch((e) => dump(`[rigel] menüler yüklenemedi: ${e}\n${e.stack}\n`));
