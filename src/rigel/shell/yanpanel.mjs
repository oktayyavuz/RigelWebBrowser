// Yan Panel düzeni: Firefox'un yerel dikey sekmelerini kullanır, adres çubuğunu (nav-bar)
// sol sütuna taşır, üstte marka + pencere düğmeleri, altta yeni/gizli sekme ekler.
// Sekmelerin kendisi Firefox'ta kalır; oturum geri yükleme, sürükle-bırak, gruplar çalışır.

import { BASE, Disposer, brand, doCmd, el, icon, moveNode, windowButtons } from "./common.mjs";

function buildTop(win, d) {
  const doc = win.document;
  return el(doc, "div", { id: "rigel-side-top" }, brand(doc), windowButtons(win, d));
}

function buildBottom(win) {
  const doc = win.document;
  return el(doc, "div", { id: "rigel-side-bottom" },
    el(doc, "button", { class: "rigel-new", onclick: () => doCmd(doc, "cmd_newNavigatorTab") },
      icon(doc, "plus", 16), el(doc, "span", {}, "Yeni sekme"), el(doc, "kbd", {}, "Ctrl T")),
    el(doc, "button", { class: "rigel-new rigel-priv", onclick: () => doCmd(doc, "Tools:PrivateBrowsing") },
      icon(doc, "mask", 16), el(doc, "span", {}, "Gizli pencere"), el(doc, "kbd", {}, "Ctrl ⇧ P")));
}

// sidebar-main'in gölge DOM'una (araç düğmeleri vb.) stil eklemek için.
let sheetText = null;
async function styleSidebarMain(win, sidebarMain, d) {
  sheetText ??= await (await win.fetch(BASE + "shell/sidebar-main.css")).text();
  const sheet = new win.CSSStyleSheet();
  sheet.replaceSync(sheetText);
  let cancelled = false;
  d.add(() => {
    cancelled = true;
    const root = sidebarMain.shadowRoot;
    if (root) root.adoptedStyleSheets = root.adoptedStyleSheets.filter(s => s !== sheet);
  });
  const apply = () => {
    if (cancelled) return;
    const root = sidebarMain.shadowRoot;
    if (root && !root.adoptedStyleSheets.includes(sheet)) {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    }
  };
  apply();
  if (!sidebarMain.shadowRoot) win.requestAnimationFrame(apply);
}

function trackTabCount(win, d) {
  const { gBrowser } = win;
  const box = win.document.getElementById("tabbrowser-arrowscrollbox");
  const update = () => box?.setAttribute("data-rigel-count", String(gBrowser.visibleTabs.length));
  const later = () => win.setTimeout(update, 0);
  for (const ev of ["TabOpen", "TabClose", "TabPinned", "TabUnpinned", "TabShow", "TabHide"]) {
    d.on(gBrowser.tabContainer, ev, later);
  }
  d.add(() => box?.removeAttribute("data-rigel-count"));
  update();
}

export function init(win) {
  const doc = win.document;
  const d = new Disposer();
  const container = doc.getElementById("sidebar-container");
  const sidebarMain = container?.querySelector("sidebar-main");
  const navBar = doc.getElementById("nav-bar");
  if (!container || !sidebarMain || !navBar) {
    win.dump("[rigel] yanpanel: sidebar-container/nav-bar bulunamadı\n");
    return () => {};
  }
  if (!win.SidebarController?.sidebarVerticalTabsEnabled) {
    win.dump("[rigel] yanpanel: dikey sekmeler kapalı\n");
  }

  // Başlatıcıyı her zaman açık (geniş) tut: sekme adları görünsün.
  try {
    const state = win.SidebarController._state;
    if (state && !state.launcherVisible) state.launcherVisible = true;
    if (state && !state.launcherExpanded) state.launcherExpanded = true;
  } catch (e) {
    win.dump(`[rigel] yanpanel: launcher genişletilemedi: ${e}\n`);
  }

  const top = buildTop(win, d);
  const bottom = buildBottom(win);
  container.insertBefore(top, sidebarMain);
  // nav-bar bir <toolbar> olarak kalır: urlbar açılır listesi (popover) buna bağlı.
  d.add(moveNode(navBar, container, sidebarMain));
  container.append(bottom);
  d.add(() => {
    top.remove();
    bottom.remove();
  });

  styleSidebarMain(win, sidebarMain, d).catch(e => win.dump(`[rigel] sidebar-main stili: ${e}\n`));
  trackTabCount(win, d);
  win.dump("[rigel] yanpanel hazır\n");
  return () => d.run();
}
