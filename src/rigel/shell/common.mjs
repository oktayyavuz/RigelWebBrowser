// Düzenlerin ortak parçaları: ikonlar, el(), pencere düğmeleri, marka, sekme görünümü yardımcıları.
// Sekme durumu her zaman Firefox'ta (gBrowser) kalır; özel görünümler yalnız onu yansıtır.

import { afterTabDrag } from "./tabdnd.mjs";

export const BASE = "chrome://userscripts/content/";

export const ICONS = {
  back: '<path d="M15 6l-6 6 6 6"/>',
  forward: '<path d="M9 6l6 6-6 6"/>',
  reload: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  stop: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="5.5" y="11" width="13" height="9" rx="2"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.7 2.5 13.3 0 16M12 4c-2.5 2.7-2.5 13.3 0 16"/>',
  min: '<path d="M6 12h12"/>',
  max: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  restore: '<rect x="5.5" y="8.5" width="10" height="10" rx="1.5"/><path d="M9 5.5h7.5A2 2 0 0 1 18.5 7.5V15"/>',
  tab: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M8 6V4.5"/>',
  mask: '<path d="M3 10c3-1 6-1.5 9-1.5s6 .5 9 1.5c0 4-2 7-5 7-1.6 0-2.4-1.5-4-1.5S9.6 17 8 17c-3 0-5-3-5-7z"/><circle cx="8.5" cy="12" r="1.2"/><circle cx="15.5" cy="12" r="1.2"/>',
  volume: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  volumeOff: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  dots: '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
  edit: '<path d="M14.5 5.5l4 4L8 20H4v-4z"/>',
  ungroup: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/><path d="M14 7h6M4 17h6"/>',
  blank: "",
};

const SVG_NS = "http://www.w3.org/2000/svg";

export function icon(doc, name, size = 16) {
  const svg = doc.createElementNS(SVG_NS, "svg");
  for (const [k, v] of Object.entries({
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true",
  })) svg.setAttribute(k, v);
  // Sabit, güvenilir yol verisi; dış girdi yok.
  const tmp = new DOMParser().parseFromString(
    `<svg xmlns="${SVG_NS}">${ICONS[name] ?? ""}</svg>`, "image/svg+xml");
  for (const n of [...tmp.documentElement.childNodes]) svg.append(doc.importNode(n, true));
  return svg;
}

/** HTML öğesi kurar. props: class, on<olay>, text, diğerleri öznitelik. */
export function el(doc, tag, props = {}, ...children) {
  const e = doc.createElementNS("http://www.w3.org/1999/xhtml", tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...children.filter(c => c != null && c !== false));
  return e;
}

export function doCmd(doc, id) {
  doc.getElementById(id)?.doCommand();
}

/** Dinleyici ve geri alma işlerini toplar; run() hepsini ters sırayla geri alır. */
export class Disposer {
  #fns = [];
  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.#fns.push(() => target.removeEventListener(type, fn, opts));
    return fn;
  }
  add(fn) {
    this.#fns.push(fn);
  }
  run() {
    for (const fn of this.#fns.splice(0).reverse()) {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    }
  }
}

/** Düğümü başka yere taşır; geri alma işlevi onu eski yerine koyar. */
export function moveNode(node, parent, before = null) {
  const oldParent = node.parentNode;
  const oldNext = node.nextSibling;
  parent.insertBefore(node, before);
  return () => {
    if (!oldParent) return;
    oldParent.insertBefore(node, oldNext?.parentNode === oldParent ? oldNext : null);
  };
}

export function logo(doc, size = 18) {
  return el(doc, "img", { class: "rigel-logo", src: BASE + "theme/logo.svg", width: size, height: size, alt: "" });
}

export function brand(doc, { size = 18, label = true } = {}) {
  return el(doc, "span", { class: "rigel-brand" }, logo(doc, size), label ? "Rigel" : null);
}

/** Küçült / büyüt / kapat. */
export function windowButtons(win, d) {
  const doc = win.document;
  const maxBtn = el(doc, "button", {
    class: "rigel-wbtn", title: "Büyüt",
    onclick: () => doCmd(doc, win.windowState === win.STATE_MAXIMIZED ? "cmd_restoreWindow" : "cmd_maximizeWindow"),
  });
  const syncMax = () => {
    const maxed = win.windowState === win.STATE_MAXIMIZED;
    maxBtn.replaceChildren(icon(doc, maxed ? "restore" : "max", 14));
    maxBtn.title = maxed ? "Geri yükle" : "Büyüt";
  };
  d.on(win, "sizemodechange", syncMax);
  syncMax();
  return el(doc, "div", { class: "rigel-wctl" },
    el(doc, "button", { class: "rigel-wbtn", title: "Küçült", onclick: () => doCmd(doc, "cmd_minimizeWindow") }, icon(doc, "min", 14)),
    maxBtn,
    el(doc, "button", { class: "rigel-wbtn rigel-wclose", title: "Kapat", onclick: () => doCmd(doc, "cmd_closeWindow") }, icon(doc, "close", 14)));
}

/** Geri / ileri / yenile-durdur. Firefox'un komut öğelerindeki disabled durumunu izler. */
export function navButtons(win, d, cls = "rigel-tool") {
  const doc = win.document;
  const mk = (title, iconName, cmd) =>
    el(doc, "button", { class: cls, title, onclick: () => doCmd(doc, cmd) }, icon(doc, iconName));
  const back = mk("Geri (Alt+←)", "back", "Browser:Back");
  const fwd = mk("İleri (Alt+→)", "forward", "Browser:Forward");
  const reload = el(doc, "button", { class: cls, title: "Yenile (Ctrl+R)" });
  reload.addEventListener("click", e => {
    if (reload.dataset.loading) doCmd(doc, "Browser:Stop");
    else win.BrowserCommands?.reloadOrDuplicate?.(e) ?? doCmd(doc, "Browser:Reload");
  });
  const sync = () => {
    back.disabled = doc.getElementById("Browser:Back")?.hasAttribute("disabled") ?? false;
    fwd.disabled = doc.getElementById("Browser:Forward")?.hasAttribute("disabled") ?? false;
    const loading = !(doc.getElementById("Browser:Stop")?.hasAttribute("disabled") ?? true);
    if (Boolean(reload.dataset.loading) !== loading || !reload.firstChild) {
      if (loading) reload.dataset.loading = "1";
      else delete reload.dataset.loading;
      reload.replaceChildren(icon(doc, loading ? "stop" : "reload"));
      reload.title = loading ? "Durdur (Esc)" : "Yenile (Ctrl+R)";
    }
  };
  const mo = new win.MutationObserver(sync);
  for (const id of ["Browser:Back", "Browser:Forward", "Browser:Stop"]) {
    const c = doc.getElementById(id);
    if (c) mo.observe(c, { attributes: true, attributeFilter: ["disabled"] });
  }
  d.add(() => mo.disconnect());
  sync();
  return el(doc, "div", { class: "rigel-nav" }, back, fwd, reload);
}

// --- Sekme bilgisi ---------------------------------------------------------------

// Yeni sekme sayfaları: Firefox'unkiler ve Rigel'in kendi sayfası (C: chrome://rigel/content/newtab/).
export function isNewTabSpec(spec) {
  return spec === "" || /^about:(newtab|home|blank)$/.test(spec) || /^chrome:\/\/rigel\/content\/(newtab|settings|welcome|private|library|store)\//.test(spec);
}

export function uriParts(uri) {
  const spec = uri?.spec ?? "";
  if (isNewTabSpec(spec)) return { secure: false, host: "", rest: "", spec };
  if (/^https?:/.test(spec)) {
    try {
      const u = new URL(spec);
      const bare = u.pathname === "/" && !u.search && !u.hash;
      return {
        secure: u.protocol === "https:",
        host: u.host.replace(/^www\./, ""),
        rest: (bare ? "" : u.pathname) + u.search + u.hash,
        spec,
      };
    } catch {}
  }
  return { secure: false, host: spec, rest: "", spec };
}

export function tabUri(tab) {
  return tab.linkedBrowser?.currentURI ?? null;
}

export function tabLabel(tab) {
  const spec = tabUri(tab)?.spec ?? "";
  if (isNewTabSpec(spec) && !/^about:blank$|^chrome:\/\/rigel\/content\/(settings|welcome|private|library|store)\//.test(spec)) return "Yeni sekme";
  return tab.label || uriParts(tabUri(tab)).host || spec;
}

// --- Sekme grupları ----------------------------------------------------------------
// Firefox'un yerel sekme grupları; Ada/Dock/Komuta/çekmece kendi görünümünü çizer, yönetim
// win.Rigel.groups'ta (zen/groups.mjs): düzenleyici, menü, sürükle-bırak ile uyumlu.

export const GROUP_COLORS = [
  { id: "blue", label: "Mavi", hex: "#5b9bf0" },
  { id: "purple", label: "Mor", hex: "#a78bfa" },
  { id: "cyan", label: "Turkuaz", hex: "#4fd1d9" },
  { id: "orange", label: "Turuncu", hex: "#f2a06b" },
  { id: "yellow", label: "Sarı", hex: "#e8c94f" },
  { id: "pink", label: "Pembe", hex: "#e879b0" },
  { id: "green", label: "Yeşil", hex: "#4fbf8f" },
  { id: "gray", label: "Gri", hex: "#8d96a8" },
  { id: "red", label: "Kırmızı", hex: "#e5484d" },
];
export const GROUP_PREFS = {
  labels: "rigel.groups.showLabels",
  collapseOnSwitch: "rigel.groups.collapseOnSwitch",
};
export const groupLabelsOn = () => Services.prefs.getBoolPref(GROUP_PREFS.labels, true);

const GROUP_EVENTS = ["TabGroupCreate", "TabGroupRemoved", "TabGroupUpdate", "TabGroupMoved", "TabGrouped",
  "TabUngrouped", "TabGroupCollapse", "TabGroupExpand", "rigel:groups-changed"];

/** Ardışık sekmeleri gruplarına göre kümeler: { tab } ya da { group, tabs }. */
export function clusterTabs(tabs) {
  const out = [];
  for (const tab of tabs) {
    const g = tab.group;
    const last = out.at(-1);
    if (g && last?.group === g) last.tabs.push(tab);
    else out.push(g ? { group: g, tabs: [tab] } : { tab });
  }
  return out;
}

export const groupName = g => g.label || "Adsız grup";

/**
 * Grup çipi (Ada, Dock, Komuta): renk noktası, ad (rigel.groups.showLabels), daraltılmışsa sekme sayısı.
 * Sol tık: daralt/genişlet (opts.menuOnClick ise menü), sağ tık: yönetim menüsü.
 * Çip bir `.tab` taşımaz; sürükle-bırak onu sekme saymaz.
 */
export function groupChip(win, group, count, { menuOnClick = false, hasSelected = false } = {}) {
  const doc = win.document;
  const collapsed = !!group.collapsed;
  const R = () => win.Rigel?.groups;
  const chip = el(doc, "button", {
    class: "rigel-gchip", "data-rigel-group": group.color || "", "aria-expanded": String(!collapsed),
    title: `${groupName(group)} · ${count} sekme\n` +
      (menuOnClick ? "Tıkla: grup seçenekleri" : `Tıkla: ${collapsed ? "genişlet" : "daralt"} · Sağ tık: grup seçenekleri`),
  }, el(doc, "span", { class: "gdot" }));
  if (groupLabelsOn() && group.label) chip.append(el(doc, "span", { class: "gname", text: group.label }));
  if (collapsed || menuOnClick) chip.append(el(doc, "span", { class: "gcount", text: String(count) }));
  chip.classList.toggle("collapsed", collapsed);
  chip.classList.toggle("has-sel", hasSelected);
  chip.group = group;
  chip.addEventListener("click", e => {
    e.stopPropagation();
    if (menuOnClick) R()?.menu(e, group);
    else R()?.toggle(group);
  });
  chip.addEventListener("contextmenu", e => {
    e.preventDefault();
    e.stopPropagation();
    R()?.menu(e, group);
  });
  return chip;
}

/** Görünür, kapanmayan sekmeler (sabitlenmişler önde: gBrowser sırası zaten böyle). */
export function liveTabs(gBrowser) {
  return gBrowser.tabs.filter(t => !t.hidden && !t.closing);
}

function avatar(tab) {
  const source = uriParts(tabUri(tab)).host || tab.label || "?";
  let h = 0;
  for (const ch of source) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return { letter: source.charAt(0).toLocaleUpperCase("tr"), hue: h % 360 };
}

/** Sekme ikonu: sitenin favicon'u, Firefox marka ikonu yerine Rigel logosu, yoksa harf. */
export function favicon(doc, tab, size = 16, round = false) {
  let src = tab.getAttribute("image") || "";
  const spec = tabUri(tab)?.spec ?? "";
  // Firefox marka ikonu ve ayrıcalıklı sayfalar (about:, chrome:) Rigel logosuyla görünür.
  if (src.startsWith("chrome://branding/") || isNewTabSpec(spec) || (!src && /^(about|chrome):/.test(spec))) {
    src = BASE + "theme/logo.svg";
  }
  const cls = "rigel-fav" + (round ? " round" : "");
  if (src) {
    const img = el(doc, "img", { class: cls, src, width: size, height: size, alt: "", draggable: "false" });
    img.addEventListener("error", () => img.replaceWith(letter()), { once: true });
    return img;
  }
  return letter();
  function letter() {
    const av = avatar(tab);
    const s = el(doc, "span", { class: cls + " letter", text: av.letter });
    s.style.cssText = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px;background:hsl(${av.hue} 45% 42%)`;
    return s;
  }
}

/** Sekme olaylarında (ve adres değişince) render'ı bir kare sonra bir kez çağırır. */
export function watchTabs(win, d, render) {
  const { gBrowser } = win;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(() => {
      queued = false;
      // Sürükleme sürerken çizme: sürüklenen düğme DOM'dan giderse sürükleme yarım kalır.
      afterTabDrag(win, render);
    });
  };
  for (const ev of ["TabOpen", "TabClose", "TabSelect", "TabAttrModified", "TabPinned", "TabUnpinned",
    "TabMove", "TabShow", "TabHide", "TabBrowserDiscarded", "TabBrowserInserted", "TabGroupCollapse", "TabGroupExpand"]) {
    d.on(gBrowser.tabContainer, ev, schedule);
  }
  const progress = { onLocationChange: schedule };
  gBrowser.addTabsProgressListener(progress);
  d.add(() => gBrowser.removeTabsProgressListener(progress));
  // Gruplar: oluşturma, ad/renk değişimi, daraltma (olaylar pencereye kadar kabarır) ve etiket tercihi.
  for (const ev of GROUP_EVENTS) d.on(win, ev, schedule);
  const prefObs = { observe: () => schedule() };
  Services.prefs.addObserver(GROUP_PREFS.labels, prefObs);
  d.add(() => Services.prefs.removeObserver(GROUP_PREFS.labels, prefObs));
  render();
  return schedule;
}

/** Firefox'un sekme bağlam menüsünü verilen sekme için açar. */
export function openTabMenu(win, event, tab) {
  event.preventDefault();
  const menu = win.document.getElementById("tabContextMenu");
  if (!menu) return;
  // Firefox menünün metinlerini yalnız kendi sekme şeridinden açılınca yükler; biz doğrudan açıyoruz.
  win.gBrowser.translateTabContextMenu?.();
  // TabContextMenu, triggerNode.tab üzerinden sekmeyi bulur.
  event.currentTarget.tab = tab;
  event.target.tab = tab;
  menu.openPopupAtScreen(event.screenX, event.screenY, true, event);
}

/** Kapsayıcı (container) sekmesi: Firefox renk adı ve etiketi; değilse null. */
export function containerOf(win, tab) {
  const id = tab?.userContextId;
  if (!id) return null;
  const CIS = win.ContextualIdentityService;
  const ident = CIS?.getPublicIdentityFromId(id);
  return ident ? { color: ident.color, label: CIS.getUserContextLabel(id) } : null;
}

/** Kapsayıcı sekmesini işaretler (renk zen/zen.css'te, Firefox'un identity-color-* sınıflarından). */
export function markContainer(win, node, tab) {
  const c = containerOf(win, tab);
  if (!c) return;
  node.classList.add(`identity-color-${c.color}`);
  node.setAttribute("data-rigel-container", c.label);
  if (node.title) node.title += ` · ${c.label}`;
}

/** Özel sekme düğmesi davranışları: tıkla seç, orta tıkla kapat, sağ tık menü. */
export function bindTab(win, node, tab) {
  node.tab = tab;
  node.setAttribute("draggable", "true"); // sıralama: shell/tabdnd.mjs
  if (tab.group) node.setAttribute("data-rigel-group", tab.group.color || "");
  markContainer(win, node, tab);
  node.addEventListener("click", e => {
    if (e.button === 0) win.gBrowser.selectedTab = tab;
  });
  node.addEventListener("auxclick", e => {
    if (e.button === 1 && !tab.pinned) win.gBrowser.removeTab(tab, { animate: true });
  });
  node.addEventListener("contextmenu", e => openTabMenu(win, e, tab));
}

// --- Palet / çekmece köprüleri ---------------------------------------------------

/** Adres "adası" tıklaması: palet, yoksa urlbar (gizliyse yüzen olarak açılır). */
export function openAddress(win, opts) {
  const pal = win.Rigel?.palette;
  if (pal?.open) {
    pal.open(opts);
    return;
  }
  revealUrlbar(win);
}

export function revealUrlbar(win) {
  const root = win.document.documentElement;
  if (root.getAttribute("data-rigel-urlbar") === "hidden") {
    root.setAttribute("data-rigel-urlbar-reveal", "true");
    const urlbar = win.document.getElementById("urlbar");
    const hide = () => {
      // Açılır liste kapanınca da gizle
      win.setTimeout(() => {
        if (!urlbar?.hasAttribute("focused")) root.removeAttribute("data-rigel-urlbar-reveal");
      }, 0);
    };
    urlbar?.addEventListener("blur", hide, { once: true, capture: true });
  }
  win.gURLBar?.select();
}

export function toggleTabsDrawer(win, event) {
  const R = win.Rigel;
  if (R?.drawers?.toggle) return R.drawers.toggle("tabs");
  if (R?.palette?.open) return R.palette.open({ mode: "tabs" });
  try {
    win.gTabsPanel?.showAllTabsPanel(event);
  } catch (e) {
    win.dump(`[rigel] sekme paneli açılamadı: ${e}\n`);
  }
}

/** nav-bar'ı (uzantılar, indirmeler, menü) verilen kaba araç kutusu olarak taşır. */
export function adoptNavBarTools(win, d, slot) {
  const navBar = win.document.getElementById("nav-bar");
  if (!navBar) return;
  d.add(moveNode(navBar, slot));
}

export function isPrivate(win) {
  return win.PrivateBrowsingUtils?.isWindowPrivate(win) ?? false;
}
