// Sağ tık menüleri için ortak parçalar: çizgi ikonlar (--menuitem-icon olarak), öğe yardımcıları,
// ayraç temizleme ve öğe gizleme. Menüler Firefox'un kendi öğeleridir; biz yalnız onların üstüne
// işaret koyar (rigel-icon, rigel-hide) ve gerektiğinde kendi öğelerimizi ekleriz.
// Firefox her açılışta öğelerin `hidden` durumunu kendisi hesaplar; bu yüzden kalıcı gizleme `rigel-hide`
// özniteliğiyle (menus.css: display:none !important) yapılır, ayraçlar `rigel-collapse` ile kapatılır.

// Rigel çizgi ikon stili (shell/common.mjs ICONS ile aynı): 24x24, 1.7 çizgi, yuvarlak uç.
export const ICONS = {
  blank: "",
  back: '<path d="M15 6l-6 6 6 6"/>',
  forward: '<path d="M9 6l6 6-6 6"/>',
  reload: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  stop: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bookmark: '<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4-6 4V5.5a1 1 0 0 1 1-1z"/>',
  star: '<path d="M12 4.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.8l5-.7z"/>',
  external: '<path d="M14 5h5v5M19 5l-8 8M17 13v4.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 17.5v-9A1.5 1.5 0 0 1 6.5 7H11"/>',
  tab: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M8 6V4.5"/>',
  window: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 9.5h17"/>',
  mask: '<path d="M3 10c3-1 6-1.5 9-1.5s6 .5 9 1.5c0 4-2 7-5 7-1.6 0-2.4-1.5-4-1.5S9.6 17 8 17c-3 0-5-3-5-7z"/><circle cx="8.5" cy="12" r="1.2"/><circle cx="15.5" cy="12" r="1.2"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  cleanlink: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/><path d="M4 4l2 2M3.5 8H6M8 3.5V6" />',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  translate: '<path d="M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5.5 7M12 6c-.5 3-3 6-7.5 8"/><path d="M12.5 20l4-9 4 9M14 17h5"/>',
  code: '<path d="M8.5 8l-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13"/>',
  inspect: '<path d="M4.5 9V6.5a2 2 0 0 1 2-2H9M15 4.5h2.5a2 2 0 0 1 2 2V9M4.5 15v2.5a2 2 0 0 0 2 2H9"/><path d="M12 12l7 2.5-3 1.2-1.2 3z"/>',
  download: '<path d="M12 4.5v11M7.5 11.5L12 16l4.5-4.5M5 19.5h14"/>',
  capture: '<path d="M4.5 9V6.5a2 2 0 0 1 2-2H9M15 4.5h2.5a2 2 0 0 1 2 2V9M19.5 15v2.5a2 2 0 0 1-2 2H15M9 19.5H6.5a2 2 0 0 1-2-2V15"/><circle cx="12" cy="12" r="2.5"/>',
  pip: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><rect x="12" y="11.5" width="6.5" height="4.5" rx="1"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20 16l-4.5-4.5L7 19"/>',
  video: '<rect x="3.5" y="6" width="12" height="12" rx="2.5"/><path d="M15.5 10.5L20.5 8v8l-5-2.5"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  volume: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  volumeOff: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  loop: '<path d="M17 4l3 3-3 3M4 11V9.5A2.5 2.5 0 0 1 6.5 7H20M7 20l-3-3 3-3M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H4"/>',
  speed: '<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 13l4-4"/>',
  expand: '<path d="M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5L13 11M4.5 19.5L11 13"/>',
  cut: '<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.5 8.5L20 18M8.5 15.5L20 6"/>',
  paste: '<rect x="5.5" y="5" width="13" height="15.5" rx="2"/><path d="M9 5v-.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V5"/>',
  selectall: '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5" stroke-dasharray="2.6 2.6"/>',
  undo: '<path d="M9 6.5L4.5 11 9 15.5M4.5 11H15a4.5 4.5 0 0 1 0 9h-3"/>',
  redo: '<path d="M15 6.5L19.5 11 15 15.5M19.5 11H9a4.5 4.5 0 0 0 0 9h3"/>',
  trash: '<path d="M5 7h14M9.5 7V5h5v2M7 7l1 12h8l1-12"/>',
  print: '<path d="M7 9V4.5h10V9"/><rect x="4.5" y="9" width="15" height="8" rx="2"/><path d="M7 14.5h10v5H7z"/>',
  layout: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
  space: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  container: '<path d="M12 3.5l8 4v9l-8 4-8-4v-9z"/><path d="M4 7.5l8 4 8-4M12 11.5v9"/>',
  moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/>',
  pin: '<path d="M9 4.5h6l-1 5 3 3H7l3-3zM12 12.5v7"/>',
  history: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.7 2.5 13.3 0 16M12 4c-2.5 2.7-2.5 13.3 0 16"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
  phone: '<rect x="7" y="3.5" width="10" height="17" rx="2.5"/><path d="M11 17.5h2"/>',
  key: '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M16 7l3 3"/>',
  info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8v.01"/>',
  text: '<path d="M5 6.5h14M12 6.5v12M9 18.5h6"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2H10l2 2.5h6.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M18 6l-1.8 1.8M7.8 16.2L6 18"/>',
  compact: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 8.5h17"/>',
  wand: '<path d="M5 19l9-9M14.5 4.5v3M13 6h3M18.5 10v2M17.5 11h2"/>',
  note: '<path d="M6.5 4.5h11a1 1 0 0 1 1 1V15l-4.5 4.5H6.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z"/><path d="M14 19.5V16h4.5"/>',
  brush: '<path d="M14 5.5l4.5 4.5-7.5 7.5-4.5.5.5-4.5z"/><path d="M4.5 19.5c2-.2 2.8-1.2 3-2"/>',
  bag: '<path d="M5 8h14l-1 11.5H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  highlight: '<path d="M4 20h6M13.5 5.5l5 5-8 8-4.5.5.5-4.5z"/>',
};

const svgUri = (inner) => "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" ` +
  `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`);

/** Her ikon için `[rigel-icon="ad"]` kuralı (Firefox ikonu `.menu-icon` üstünde `content: var(--menuitem-icon)` ile çizer). Çizgi rengi bağlam özelliği olan `stroke`tan gelir (menus.css). */
export function iconCss() {
  return Object.entries(ICONS)
    .map(([name, inner]) => `:is(menupopup, panelview) [rigel-icon="${name}"], toolbarbutton[rigel-icon="${name}"]{--rigel-mi:url("${svgUri(inner)}")}`)
    .join("\n");
}

export const byId = (doc, id) => doc.getElementById(id);

/** Öğeye ikon verir (menuitem-iconic / menu-iconic sınıfı + rigel-icon). */
export function setIcon(el, name) {
  if (!el) return;
  const t = el.getAttribute("type");
  if (t === "checkbox" || t === "radio") return; // onay işareti ikon yuvasını kullanır
  el.setAttribute("rigel-icon", name);
  const cls = el.localName === "menu" ? "menu-iconic" : "menuitem-iconic";
  el.classList.add(cls);
}

/** { öğe_kimliği: ikon_adı } */
export function applyIcons(doc, map) {
  for (const [id, name] of Object.entries(map)) setIcon(doc.getElementById(id), name);
}

/** Kalıcı olarak gizlenecek öğeler (Firefox'a özgü / gürültü). */
export function hideAll(doc, ids) {
  for (const id of ids) doc.getElementById(id)?.setAttribute("rigel-hide", "");
}

/** Etiketi (ve verildiyse erişim tuşunu) yazar; tuş etiketteki harflerle uyuşmazsa Firefox "(Z)" eki gösterir. */
export function setLabel(el, text, key) {
  if (!el) return;
  if (el.getAttribute("label") !== text) el.setAttribute("label", text);
  if (key && el.getAttribute("accesskey") !== key) el.setAttribute("accesskey", key);
}

/** Etkin görünürlük: Firefox'un `hidden`ı, bizim kalıcı gizlememiz ya da ayraç kapatmamız yok. */
export function isShown(el) {
  if (el.hidden || el.hasAttribute("rigel-hide") || el.hasAttribute("rigel-collapse")) return false;
  if (el.localName === "menugroup") return [...el.children].some((c) => !c.hidden && !c.hasAttribute("rigel-hide"));
  return true;
}

/**
 * Baştaki, sondaki ve art arda gelen ayraçları kapatır (Firefox öğeleri gizleyince ayraçlar takılı kalır).
 * Ayraç gizleme `rigel-collapse` ile yapılır; Firefox'un `hidden`ına dokunulmaz.
 */
export function tidySeparators(popup) {
  let lastWasSep = true; // başta ayraç istemiyoruz
  let trailing = null;
  for (const el of popup.children) {
    if (el.localName === "script") continue;
    if (el.localName === "menuseparator") {
      el.removeAttribute("rigel-collapse");
      if (el.hidden || el.hasAttribute("rigel-hide")) continue;
      if (lastWasSep) el.setAttribute("rigel-collapse", "");
      else {
        lastWasSep = true;
        trailing = el;
      }
      continue;
    }
    if (isShown(el)) {
      lastWasSep = false;
      trailing = null;
    }
  }
  if (lastWasSep && trailing) trailing.setAttribute("rigel-collapse", "");
}

/** İkonsuz görünen öğelere boş ikon verir ki metinler hizalı kalsın (onay/radyo öğelerine dokunmaz). */
export function padIcons(popup) {
  for (const el of popup.children) {
    if (el.localName !== "menuitem" && el.localName !== "menu") continue;
    if (el.hasAttribute("rigel-icon")) continue;
    const t = el.getAttribute("type");
    if (t === "checkbox" || t === "radio") continue;
    setIcon(el, "blank");
  }
}

/** Panoya düz metin kopyalar. */
export function copyText(text) {
  Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(text);
}

/** Yeni XUL öğesi. */
export function xul(doc, tag, attrs = {}) {
  const e = doc.createXULElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v === true ? "true" : v);
  return e;
}

export const isHttp = (u) => /^https?:/i.test(u ?? "");

export function truncate(s, n) {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}
