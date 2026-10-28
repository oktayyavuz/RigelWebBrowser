// Sade adres görünümü. Tercih: rigel.urlbar.simple (bool, varsayılan true).
// Adres çubuğuna odak yokken ve sayfanın adresi gösterilirken (pageproxystate="valid") input metni
// görünmez olur, üstüne ortalanmış bir etiket (#rigel-urlbar-simple) yalnız alan adını gösterir.
// Tıklayınca/odaklanınca Firefox'un kendi davranışı (tam adres, seçili) aynen çalışır: input'un değerine
// ve gURLBar durumuna dokunulmaz; etiket pointer-events:none. Kurallar layouts/base.css'te.
// Ada/Dock/Komuta kendi adres kutusunu çizer: tercih açıkken kökte [rigel-url-simple] olur, o düzenlerin
// CSS'i başlık/yol kısmını gizleyip yalnız alan adını ortalar (layouts/ada.css, dock.css, komuta.css).

import { el } from "./common.mjs";

const PREF = "rigel.urlbar.simple";

const RIGEL_PAGES = {
  settings: "Rigel · Ayarlar",
  library: "Rigel · Kitaplık",
  store: "Rigel · Mod mağazası",
  welcome: "Rigel · Hoş geldin",
};

/** Adresin kısa, okunaklı adı; boş dize = sade görünüm yok (yeni sekme vb.). */
export function simpleName(uri) {
  const spec = uri?.spec ?? "";
  if (!spec || /^about:(blank|newtab|home|privatebrowsing)$/.test(spec)) return "";
  const rigel = spec.match(/^chrome:\/\/rigel\/content\/([a-z]+)\//);
  if (rigel) return RIGEL_PAGES[rigel[1]] ?? "";
  const scheme = uri.scheme;
  if (scheme === "http" || scheme === "https") {
    let host = "";
    try {
      host = uri.displayHost || uri.host;
    } catch {}
    return host.replace(/^www\./, "");
  }
  if (scheme === "file") {
    const parts = decodeURIComponent(uri.filePath || uri.pathQueryRef || "").split("/").filter(Boolean);
    return parts.at(-1) || "/";
  }
  if (scheme === "about") return "about:" + (uri.filePath || spec.slice(6)).split(/[?#]/)[0];
  if (scheme === "view-source") return "Kaynak: " + simpleName(Services.io.newURI(spec.slice(12)));
  if (scheme === "data") return "data:";
  if (scheme === "moz-extension") return "Eklenti sayfası";
  if (scheme === "chrome" || scheme === "resource") {
    try {
      return `${scheme}://${uri.host}`;
    } catch {}
  }
  return spec.length > 40 ? spec.slice(0, 40) + "…" : spec;
}

/** Ada/Dock/Komuta adres kutusundaki alan adı yazısı: sade görünüm açıksa simpleName, değilse uriParts'ın host'u. */
export function shownHost(uri, host) {
  if (!host || !Services.prefs.getBoolPref(PREF, true)) return host;
  return simpleName(uri) || host;
}

export function init(win) {
  const doc = win.document;
  const urlbar = doc.getElementById("urlbar");
  const { gBrowser } = win;
  if (!urlbar || !gBrowser) return () => {};
  const label = el(doc, "span", { id: "rigel-urlbar-simple", "aria-hidden": "true" });
  urlbar.append(label);

  const update = () => {
    const on = Services.prefs.getBoolPref(PREF, true);
    doc.documentElement.toggleAttribute("rigel-url-simple", on);
    const name = on ? simpleName(gBrowser.currentURI) : "";
    label.textContent = name;
    urlbar.toggleAttribute("rigel-simple", !!name);
  };

  const progress = {
    onLocationChange: (browser) => {
      if (browser === gBrowser.selectedBrowser) update();
    },
  };
  gBrowser.addTabsProgressListener(progress);
  gBrowser.tabContainer.addEventListener("TabSelect", update);
  const obs = { observe: () => update() };
  Services.prefs.addObserver(PREF, obs);
  update();

  return () => {
    gBrowser.removeTabsProgressListener(progress);
    gBrowser.tabContainer.removeEventListener("TabSelect", update);
    Services.prefs.removeObserver(PREF, obs);
    urlbar.removeAttribute("rigel-simple");
    doc.documentElement.removeAttribute("rigel-url-simple");
    label.remove();
  };
}
