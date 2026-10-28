// Rigel sayfaları (chrome://rigel/content/…) için tema yardımcısı. Sayfa şöyle kullanır:
//   <link rel="stylesheet" href="chrome://userscripts/content/theme/tokens.css">
//   <script type="module">import "chrome://userscripts/content/theme/page.mjs";</script>
// <html> üzerine çözülmüş data-rigel-theme (dark|light) ve data-rigel-accent yazar;
// rigel.theme / rigel.accent tercihlerini ve sistem renk tercihini canlı izler.
const THEMES = ["dark", "light", "system"];
const ACCENTS = ["rigel", "violet", "green", "orange", "pink", "teal", "indigo", "red", "amber", "lime", "slate"];
const root = document.documentElement;
const mq = window.matchMedia("(prefers-color-scheme: dark)");

function apply() {
  let theme = Services.prefs.getStringPref("rigel.theme", "dark");
  if (!THEMES.includes(theme)) theme = "dark";
  // Sistem modunda content-override sistemde olduğundan sayfanın kendi medya sorgusu sistemi yansıtır.
  if (theme === "system") theme = mq.matches ? "dark" : "light";
  let accent = Services.prefs.getStringPref("rigel.accent", "rigel");
  if (!ACCENTS.includes(accent)) accent = "rigel";
  root.setAttribute("data-rigel-theme", theme);
  root.setAttribute("data-rigel-accent", accent);
}

const observer = { observe: apply };
Services.prefs.addObserver("rigel.theme", observer);
Services.prefs.addObserver("rigel.accent", observer);
mq.addEventListener("change", apply);
window.addEventListener("unload", () => {
  Services.prefs.removeObserver("rigel.theme", observer);
  Services.prefs.removeObserver("rigel.accent", observer);
}, { once: true });
apply();

// Görünüm stüdyosu (rigel.look): yarıçap, yazı, vurgu vb. değişkenleri sayfaya da yazılır.
import("chrome://userscripts/content/theme/look.mjs").then(m => m.initPage(document)).catch(e => console.error("[rigel] görünüm", e));
