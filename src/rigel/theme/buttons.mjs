// Araç düğmeleri: nav-bar düğmelerini göster/gizle/sırala. Firefox'un CustomizableUI
// API'si kullanılır (yerleşimler Firefox'ta kalıcı, tüm pencerelere uygulanır). ☰ menüsü CustomizableUI
// dışında olduğundan yalnız `rigel.look.buttons.hideMenu` ile gizlenir (look.css).
// CustomizableUI'nin kaldırılamaz saydığı düğmeler (Firefox 158: geri, ileri, eklentiler) yerinde kalır,
// look.mjs bunları CSS ile gizler. `rigel.look.buttons` = { orig?: [ilk değişiklikten önceki nav-bar
// sırası], hidden?: [CSS ile gizlenen kimlikler], hideMenu?: bool }.
import { BUTTONS_PREF } from "chrome://userscripts/content/theme/look.mjs";

// Firefox 158'de modül moz-src altında; eski yol ve pencere nesnesi yedek.
function loadCUI() {
  for (const url of ["moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs", "resource:///modules/CustomizableUI.sys.mjs"]) {
    try { return ChromeUtils.importESModule(url).CustomizableUI; } catch {}
  }
  return Services.wm.getMostRecentWindow("navigator:browser")?.CustomizableUI;
}
const CUI = loadCUI();
const P = Services.prefs;
export const AREA = CUI.AREA_NAVBAR;
const ADDONS = CUI.AREA_ADDONS;
export const CUI_API = CUI;

const NAMES = {
  "back-button": "Geri", "forward-button": "İleri", "stop-reload-button": "Yenile / durdur", "home-button": "Ana sayfa",
  "urlbar-container": "Adres çubuğu", "downloads-button": "İndirmeler", "unified-extensions-button": "Eklentiler",
  "rigel-mods-button": "Rigel modları", "library-button": "Kitaplık", "bookmarks-menu-button": "Yer imleri menüsü",
  "history-panelmenu": "Geçmiş", "print-button": "Yazdır", "screenshot-button": "Ekran görüntüsü",
  "new-window-button": "Yeni pencere", "fullscreen-button": "Tam ekran", "developer-button": "Geliştirici araçları",
  "zoom-controls": "Yakınlaştırma", "edit-controls": "Düzen (kes/kopyala)", "save-to-pocket-button": "Pocket",
  "preferences-button": "Ayarlar", "logins-button": "Parolalar", "privatebrowsing-button": "Gizli pencere",
};
// Gizliyken de listede görünecek düğmeler (kullanıcı geri açabilsin).
const KNOWN = ["back-button", "forward-button", "stop-reload-button", "home-button", "downloads-button", "unified-extensions-button",
  "rigel-mods-button", "library-button", "history-panelmenu", "bookmarks-menu-button", "screenshot-button", "print-button", "new-window-button"];
export const FIXED = new Set(["urlbar-container"]);
// Rigel'in zaten gizlediği ya da düğme olmayan öğeler listede gösterilmez.
const IGNORE = new Set(["vertical-spacer", "sidebar-button", "fxa-toolbar-menu-button", "reset-pbm-toolbar-button", "firefox-view-button", "alltabs-button"]);
const visibleIds = () => CUI.getWidgetIdsInArea(AREA).filter(id => !CUI.isSpecialWidget(id) && !IGNORE.has(id));
const cssHidden = () => { const h = state().hidden; return new Set(Array.isArray(h) ? h : []); };

function state() {
  try { return JSON.parse(P.getStringPref(BUTTONS_PREF, "{}")) ?? {}; } catch { return {}; }
}
function setState(s) {
  const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== false));
  P.setStringPref(BUTTONS_PREF, JSON.stringify(clean));
}
const isExtension = id => /-browser-action$/.test(id) || CUI.getWidget(id)?.provider === CUI.PROVIDER_API && !!CUI.getWidget(id)?.extensionId;

/** İlk değişiklikten önce nav-bar'ın sırası saklanır ("Varsayılana dön" buna döner). */
function remember() {
  const s = state();
  if (!s.orig) { s.orig = CUI.getWidgetIdsInArea(AREA); setState(s); }
}

function labelOf(id, win) {
  if (NAMES[id]) return NAMES[id];
  const w = CUI.getWidget(id);
  let l = typeof w?.label === "string" ? w.label : "";
  if (!l && win) {
    const node = w?.forWindow?.(win)?.node;
    l = node?.getAttribute("label") || node?.getAttribute("tooltiptext") || "";
  }
  return l || id;
}

/**
 * Liste: görünenler nav-bar sırasıyla, ardından gizliler. Öğe: { id, label, shown, removable, extension, fixed }.
 * Özel öğeler (boşluk/ayraç) gösterilmez ama sıra hesabında korunur.
 */
export function list(win) {
  const ids = visibleIds();
  const hid = cssHidden();
  const shownSet = new Set(ids);
  const exists = id => {
    const w = CUI.getWidget(id);
    if (!w) return false;
    if (w.provider === CUI.PROVIDER_API) return true;
    try { return !!w.forWindow(win)?.node; } catch { return false; }
  };
  const hidden = [...KNOWN, ...CUI.getWidgetIdsInArea(ADDONS)].filter(id => !shownSet.has(id) && exists(id));
  const item = (id, inArea) => ({
    id, inArea, shown: inArea && !hid.has(id), label: labelOf(id, win), fixed: FIXED.has(id), extension: isExtension(id),
    removable: !FIXED.has(id),
  });
  return [...ids.map(id => item(id, true)), ...[...new Set(hidden)].map(id => item(id, false))];
}

export function show(id, on) {
  if (FIXED.has(id)) return;
  remember();
  const place = CUI.getPlacementOfWidget(id);
  const hid = cssHidden();
  if (hid.has(id) || (!on && place?.area === AREA && !CUI.isWidgetRemovable(id))) {
    if (on) hid.delete(id); else hid.add(id);
    setState({ ...state(), hidden: hid.size ? [...hid] : undefined });
    if (on || hid.has(id)) return;
  }
  if (on) {
    if (place?.area !== AREA) CUI.addWidgetToArea(id, AREA);
  } else if (place?.area === AREA) {
    if (isExtension(id)) CUI.addWidgetToArea(id, ADDONS);
    else CUI.removeWidgetFromArea(id);
  }
}

/** `id`'yi görünen listede `beforeId`'nin önüne (null: sona) taşır. */
export function moveBefore(id, beforeId) {
  remember();
  const all = CUI.getWidgetIdsInArea(AREA);
  if (!all.includes(id)) return;
  const pos = beforeId && all.includes(beforeId) ? all.indexOf(beforeId) : all.length;
  CUI.moveWidgetWithinArea(id, pos);
}
/** Görünen komşusuyla yer değiştirir (dir: -1 yukarı, +1 aşağı). */
export function step(id, dir) {
  const vis = visibleIds();
  const i = vis.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= vis.length) return;
  moveBefore(id, dir < 0 ? vis[j] : vis[j + 1] ?? null);
}

export const menuHidden = () => !!state().hideMenu;
export function hideMenu(on) {
  setState({ ...state(), hideMenu: !!on });
}
export const changed = () => { const s = state(); return !!(s.orig || s.hideMenu || s.hidden?.length); };

/** Saklanan ilk sıraya döner; sonradan eklenen düğmeleri kaldırır, ☰'yi geri getirir. */
export function reset() {
  const s = state();
  if (s.orig) {
    const orig = s.orig.filter(id => CUI.getWidget(id));
    for (const id of CUI.getWidgetIdsInArea(AREA)) {
      if (!orig.includes(id) && !CUI.isSpecialWidget(id) && CUI.isWidgetRemovable(id)) show(id, false);
    }
    orig.forEach((id, i) => {
      const place = CUI.getPlacementOfWidget(id);
      if (place?.area !== AREA) CUI.addWidgetToArea(id, AREA, i);
      else if (place.position !== i) CUI.moveWidgetWithinArea(id, i);
    });
  }
  P.setStringPref(BUTTONS_PREF, "{}");
}

/** CustomizableUI değişikliklerini izler; kaldırma işlevi döndürür. */
export function listen(fn) {
  const l = { onWidgetAdded: fn, onWidgetRemoved: fn, onWidgetMoved: fn, onWidgetDestroyed: fn, onWidgetCreated: fn };
  CUI.addListener(l);
  return () => CUI.removeListener(l);
}
