// Rigel yeni sekme. Sayfa chrome:// olduğu için ana süreçte ayrıcalıklı çalışır; geçmişe NewTabUtils ile erişir.
// Gizli pencerede sık ziyaret edilenler gösterilmez. Kapatmak için: rigel.newtab.topsites = false.

const { NewTabUtils } = ChromeUtils.importESModule("resource://gre/modules/NewTabUtils.sys.mjs");

const MAX_SITES = 8;
const $ = id => document.getElementById(id);

function tick() {
  const now = new Date();
  $("time").textContent = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  $("date").textContent = now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function topSitesEnabled() {
  return (
    Services.prefs.getBoolPref("rigel.newtab.topsites", true) &&
    !window.browsingContext?.usePrivateBrowsing
  );
}

async function loadSites() {
  const nav = $("sites");
  if (!topSitesEnabled()) {
    nav.hidden = true;
    return;
  }
  let links = [];
  try {
    links = await NewTabUtils.activityStreamLinks.getTopSites({ numItems: MAX_SITES * 2, onePerDomain: true });
  } catch (e) {
    console.error("[rigel-newtab] getTopSites", e);
  }
  const sites = links.filter(l => /^https?:/.test(l.url)).slice(0, MAX_SITES);
  const tpl = $("site-tpl").content;
  nav.replaceChildren(
    ...sites.map(s => {
      const el = tpl.cloneNode(true).firstElementChild;
      const a = el.querySelector("a");
      const host = hostOf(s.url);
      a.href = s.url;
      a.title = s.title ? `${s.title}\n${s.url}` : s.url;
      el.querySelector(".name").textContent = host;
      const img = el.querySelector("img");
      const letter = el.querySelector(".letter");
      letter.textContent = host.charAt(0);
      letter.hidden = true;
      img.onerror = () => {
        img.hidden = true;
        letter.hidden = false;
      };
      img.src = `page-icon:${s.url}`;
      el.querySelector(".hide").addEventListener("click", () => {
        NewTabUtils.activityStreamLinks.blockURL({ url: s.url });
        loadSites();
      });
      return el;
    })
  );
  nav.hidden = !sites.length;
}

tick();
setInterval(tick, 15 * 1000);
loadSites();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  tick();
  loadSites();
});

// Alt bağlantılar: açık olan ayarlar/mağaza sekmesine geç (yoksa bu sekmede açılır).
for (const a of document.querySelectorAll(".quick a")) {
  a.addEventListener("click", e => {
    try {
      const R = window.browsingContext?.topChromeWindow?.Rigel;
      const href = a.getAttribute("href");
      if (href.includes("/store/")) R?.mods?.openStore?.();
      else if (R?.settings) R.settings.open(href.split("#")[1]);
      else return;
      e.preventDefault();
    } catch {}
  });
}
