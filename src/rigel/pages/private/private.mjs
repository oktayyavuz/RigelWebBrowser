// Rigel gizli sekme sayfası. Ana süreçte ayrıcalıklı çalışır (chrome://), bu yüzden Firefox'un arama hizmetine
// ve Rigel'in bang/adres çözümleyicisine doğrudan erişir.
// Arama kutusu gizli pencerenin varsayılan motorunu kullanır (Firefox: browser.search.separatePrivateDefault).

import { bangSettings } from "chrome://userscripts/content/palette/settings.mjs";
import { classify } from "chrome://userscripts/content/search/omnibox.mjs";
import { cleanUrl } from "chrome://userscripts/content/search/cleanurl.mjs";

const $ = id => document.getElementById(id);
const input = $("q");

const searchService = (() => {
  try {
    return ChromeUtils.importESModule("moz-src:///toolkit/components/search/SearchService.sys.mjs").SearchService;
  } catch {
    return Services.search;
  }
})();

let engine = null;
async function loadEngine() {
  try {
    engine = (await searchService.getDefaultPrivate?.()) ?? (await searchService.getDefault());
    $("engine").textContent = engine.name;
    $("engine").hidden = false;
    input.placeholder = `${engine.name} ile ara ya da adres yaz`;
  } catch (e) {
    console.error("[rigel-private] motor", e);
  }
}

function target(text) {
  const r = classify(text, bangSettings());
  if (!r) return null;
  if (r.type === "search" && engine) {
    try {
      return engine.getSubmission(r.query).uri.spec;
    } catch {}
  }
  return r.type === "url" ? cleanUrl(r.url) : r.url;
}

$("search").addEventListener("submit", e => {
  e.preventDefault();
  const url = target(input.value);
  if (url) location.href = url;
});

if (!window.browsingContext?.usePrivateBrowsing) $("warn").hidden = false;

// Tab'a basıp adres çubuğuna yazmaya başlayan kullanıcının odağını çalma: yalnız çubuk odakta değilse kutuya odaklan.
const chromeWin = window.browsingContext?.top?.embedderElement?.ownerGlobal;
if (!chromeWin?.gURLBar?.focused) input.focus();

loadEngine();
const prefObserver = { observe: loadEngine };
Services.prefs.addObserver("browser.search.separatePrivateDefault", prefObserver);
window.addEventListener("unload", () => Services.prefs.removeObserver("browser.search.separatePrivateDefault", prefObserver), { once: true });
