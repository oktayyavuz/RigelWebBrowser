// Araç çubuğu / sekme şeridi sağ tık menüsü (#toolbar-context-menu).
//  - Rigel düzenleri dikey sekmeleri ve kenar çubuğunu kendisi yönetir; çakışan öğeler gizlenir
//    (dikey sekmeler, kenar çubuğunu özelleştir, yer imleri/başlık çubuğu görünürlük anahtarları).
//  - "Özelleştir" yalnız Firefox'un araç çubuğunu olduğu gibi gösteren düzenlerde (Klasik, Yan Panel) kalır.
//  - Eklenenler: "Düzen ›" (5 düzen, radyo) ve "Kompakt mod" (onay).
import { Disposer } from "../zen/util.mjs";
import { applyIcons, hideAll, padIcons, setLabel, tidySeparators, xul } from "./common.mjs";

const HIDE = ["toolbar-context-toggle-vertical-tabs", "toolbar-context-customize-sidebar", "sidebarRevampSeparator"];
const NATIVE_TOOLBAR_LAYOUTS = new Set(["klasik", "yanpanel"]);

const ICONS = {
  "toolbar-context-openANewTab": "plus", "toolbar-context-reloadSelectedTab": "reload",
  "toolbar-context-reloadSelectedTabs": "reload", "toolbar-context-bookmarkSelectedTab": "bookmark",
  "toolbar-context-bookmarkSelectedTabs": "bookmark", "toolbar-context-selectAllTabs": "selectall",
  "toolbar-context-undoCloseTab": "undo", "toolbar-context-customize": "gear",
  "toolbar-context-remove-from-toolbar": "close", "toolbar-context-move-to-panel": "arrow",
  "toolbar-context-pin-to-toolbar": "pin", "toolbar-context-manage-extension": "gear",
  "toolbar-context-remove-extension": "trash",
  "rigel-tb-layout": "layout", "rigel-tb-mods": "brush", "rigel-tb-store": "bag",
};

export function init(win) {
  const doc = win.document;
  const menu = doc.getElementById("toolbar-context-menu");
  if (!menu) return { destroy() {} };
  const d = new Disposer();
  const R = () => win.Rigel;

  hideAll(doc, HIDE);

  const layoutMenu = xul(doc, "menu", { id: "rigel-tb-layout", label: "Düzen" });
  const layoutPopup = xul(doc, "menupopup", { id: "rigel-tb-layout-popup" });
  layoutMenu.append(layoutPopup);
  const compact = xul(doc, "menuitem", { id: "rigel-tb-compact", label: "Kompakt mod", type: "checkbox", acceltext: "Ctrl+Alt+C" });
  compact.addEventListener("command", () => R()?.compact?.toggle?.());
  const modsItem = xul(doc, "menuitem", { id: "rigel-tb-mods", label: "Modlar" });
  modsItem.addEventListener("command", () => R()?.settings?.open("modlar"));
  const storeItem = xul(doc, "menuitem", { id: "rigel-tb-store", label: "Mod mağazası" });
  storeItem.addEventListener("command", () => R()?.mods?.openStore?.());
  const sep = xul(doc, "menuseparator", { id: "rigel-tb-sep" });
  const anchor = doc.getElementById("customizationMenuSeparator");
  for (const el of [layoutMenu, compact, modsItem, storeItem, sep]) {
    if (anchor) anchor.before(el);
    else menu.append(el);
    d.add(() => el.remove());
  }

  d.on(layoutPopup, "popupshowing", (e) => {
    if (e.target !== layoutPopup) return;
    layoutPopup.replaceChildren();
    const L = R()?.layout;
    if (!L) return;
    const cur = L.current();
    for (const name of L.names()) {
      const it = xul(doc, "menuitem", { label: L.label(name), type: "radio", name: "rigel-layout", checked: name === cur });
      it.addEventListener("command", () => L.set(name));
      layoutPopup.append(it);
    }
  });

  applyIcons(doc, ICONS);

  const update = (e) => {
    if (e.target !== menu) return;
    const hasLayout = !!R()?.layout;
    layoutMenu.hidden = !hasLayout;
    const hasCompact = !!R()?.compact;
    compact.hidden = !hasCompact;
    modsItem.hidden = !R()?.settings;
    storeItem.hidden = !R()?.mods?.openStore;
    sep.hidden = !(hasLayout || hasCompact || !modsItem.hidden);
    if (hasCompact) {
      if (R().compact.isOn()) compact.setAttribute("checked", "true");
      else compact.removeAttribute("checked");
    }
    if (hasLayout) setLabel(layoutMenu, `Düzen: ${R().layout.label(R().layout.current())}`);

    // Firefox'un araç çubuğu görünürlük anahtarları (Yer imleri çubuğu, Menü çubuğu, Başlık çubuğu) menüye açılışta eklenir.
    for (const el of menu.children) {
      if ((el.localName === "menuitem" || el.localName === "menu") && (el.hasAttribute("toolbarId") || /^toggle_/.test(el.id))) el.setAttribute("rigel-hide", "");
    }
    // Özelleştirme kipi Rigel'in kendi çizdiği düzenlerde anlamsız.
    const cust = doc.getElementById("toolbar-context-customize");
    if (cust) cust.toggleAttribute("rigel-hide", hasLayout && !NATIVE_TOOLBAR_LAYOUTS.has(R().layout.current()));

    padIcons(menu);
    tidySeparators(menu);
  };
  // Araç çubuğu görünürlük anahtarlarını Firefox menü açılırken (bazen popupshowing'den sonra) ekler.
  const hideToggles = () => {
    for (const el of menu.children) {
      if ((el.localName === "menuitem" || el.localName === "menu") && (el.hasAttribute("toolbarId") || /^toggle_/.test(el.id))) {
        el.setAttribute("rigel-hide", "");
      }
    }
  };
  const mo = new win.MutationObserver(() => {
    hideToggles();
    tidySeparators(menu);
  });
  mo.observe(menu, { childList: true });
  d.add(() => mo.disconnect());
  d.on(menu, "popupshowing", update);
  d.on(menu, "popupshown", (e) => {
    if (e.target === menu) tidySeparators(menu);
  });

  return { destroy: () => d.run() };
}
