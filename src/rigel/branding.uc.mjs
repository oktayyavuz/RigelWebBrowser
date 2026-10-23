// ==UserScript==
// @name           Rigel marka (pencere)
// @description    Her tarayıcı penceresinde Firefox'a özgü öğeleri gizler. Uygulama düzeyi işler branding.sys.mjs'te.
// ==/UserScript==

window.windowUtils.loadSheetUsingURIString(
  "chrome://userscripts/content/branding/browser.css",
  window.windowUtils.AUTHOR_SHEET
);

// distribution.ini değerleri başlangıçta (branding.sys.mjs'ten sonra) uygulanabilir; pencere açılınca bir daha boşalt.
{
  const { DEFAULT_PREFS } = ChromeUtils.importESModule("chrome://userscripts/content/l10n/overrides.mjs");
  const branch = Services.prefs.getDefaultBranch("");
  for (const [name, value] of Object.entries(DEFAULT_PREFS)) {
    if (name.startsWith("distribution.") && typeof value === "string") branch.setCharPref(name, value);
  }
}
