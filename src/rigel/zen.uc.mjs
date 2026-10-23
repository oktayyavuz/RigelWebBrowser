// ==UserScript==
// @name           Rigel Zen özellikleri
// @description    Göz at (glance), kompakt mod, alanlar (workspace) ve Essentials
// ==/UserScript==

// Zen Browser'ın özellikleri, Rigel tasarımıyla ve derlemesiz (yamasız Firefox üstünde).
// Her parça zen/ altında kendi modülünde; burada yalnız yüklenir ve komutlar kaydedilir.
// Ortak API: Rigel.glance, Rigel.compact, Rigel.spaces. Ayrıca sekme grupları ve kapsayıcı komutları.

const BASE = "chrome://userscripts/content/";
const Rigel = (window.Rigel ??= {});

window.windowUtils.loadSheetUsingURIString(BASE + "zen/zen.css", window.windowUtils.AUTHOR_SHEET);

function whenStartedUp() {
  if (window.gBrowserInit?.delayedStartupFinished) return Promise.resolve();
  return new Promise(resolve => {
    const topic = "browser-delayed-startup-finished";
    const obs = subject => {
      if (subject !== window) return;
      Services.obs.removeObserver(obs, topic);
      resolve();
    };
    Services.obs.addObserver(obs, topic);
  });
}

const parts = [];

async function start() {
  await whenStartedUp();
  const mods = await Promise.all(["glance", "compact", "spaces", "groups", "containers"].map(n => import(`${BASE}zen/${n}.mjs`)));
  for (const mod of mods) {
    try {
      parts.push(mod.init(window));
    } catch (e) {
      dump(`[rigel] zen modülü kurulamadı: ${e}\n${e.stack}\n`);
    }
  }
  // Kurulum sırasında (ör. ilk açılışta alan listesi yazılırken) kayıt erken tetiklenmiş olabilir;
  // o zaman henüz tüm modüller yoktu. Hepsi hazırken yeniden kaydet.
  registered = false;
  registerCommands();
  document.documentElement.setAttribute("rigel-zen", "ready");
  window.dispatchEvent(new CustomEvent("rigel:zen-ready"));
}

// Komutlar her modülün `commands()` listesinden gelir; palet hangi sırada yüklenirse yüklensin kaydedilir.
let registered = false;
function registerCommands() {
  const reg = window.Rigel?.commands?.register;
  if (!reg || registered || !parts.length) return;
  registered = true;
  for (const part of parts) {
    for (const spec of part?.commands?.() ?? []) {
      try {
        reg(spec);
      } catch (e) {
        dump(`[rigel] zen komutu kaydedilemedi (${spec.id}): ${e}\n`);
      }
    }
  }
}
// Alan listesi değişince (yeni/silinen alan) "Alan: <ad>" komutları yeniden kurulur.
Rigel.zenRefreshCommands = () => {
  registered = false;
  registerCommands();
};
window.addEventListener("rigel:components-ready", registerCommands);

window.addEventListener("unload", () => {
  for (const part of parts) {
    try {
      part?.destroy?.();
    } catch {}
  }
}, { once: true });

start().catch(e => dump(`[rigel] zen yüklenemedi: ${e}\n${e.stack}\n`));
