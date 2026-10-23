// ==UserScript==
// @name           Rigel sekme etkileşimi
// @description    Rigel iletişim kutuları: Rigel.dialog.prompt / confirm / pick / form
// ==/UserScript==

// Ortak API: window.Rigel.dialog. Sekme sürükle-bırak shell/ ve drawers/ içinde,
// düzenler kendi kurar; burada yalnız iletişim kutusu API'si erken yayımlanır.

const BASE = "chrome://userscripts/content/";
const Rigel = (window.Rigel ??= {});

try {
  const { getDialog } = await import(BASE + "shell/dialog.mjs");
  getDialog(window);
  window.dispatchEvent(new CustomEvent("rigel:dialog-ready"));
} catch (e) {
  dump(`[rigel] iletişim kutusu yüklenemedi: ${e}\n${e.stack}\n`);
  Rigel.dialog ??= null;
}
