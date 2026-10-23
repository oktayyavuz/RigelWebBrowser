// Göz at (glance): bağlantıyı sayfanın üstünde yüzen bir kartta açar (Zen Browser'dan fikir).
//
// Kart gerçek bir sekmedir: arka planda açılır, gizlenir (hideTab) ve paneli CSS ile seçili
// sayfanın üstünde gösterilir. Ana sekme seçili kalır, sayfası arkada canlı görünür.
// - Kapat (Esc, kartın dışına tık): sekme kapanır.
// - Tam sekme: sekme gösterilir, ana sekmenin yanına taşınır ve seçilir.
// - Bölünmüş görünüm: tam sekme + Firefox'un yerel split view'ı (ana sekme | kart).
// Oturum geri yükleme: kart sekmesi "rigelGlance" değeriyle işaretlenir. Kart açıkken çıkılırsa
// bir sonraki açılışta normal (görünür) bir sekme olarak döner.
//
// Tercih: rigel.glance.enabled (bool, varsayılan true). Alt+tık içerik aktörüyle yakalanır
// (zen/RigelGlanceChild.sys.mjs).

import { BASE, Disposer, el, icon, toast } from "./util.mjs";

const PREF = "rigel.glance.enabled";
const MARK = "rigelGlance";
const ACTOR = "RigelGlance";

function registerActor() {
  try {
    ChromeUtils.registerWindowActor(ACTOR, {
      parent: { esModuleURI: BASE + "zen/RigelGlanceParent.sys.mjs" },
      child: {
        esModuleURI: BASE + "zen/RigelGlanceChild.sys.mjs",
        events: { click: { capture: true } },
      },
      allFrames: true,
      messageManagerGroups: ["browsers"],
      // Çalışma anında kaydedilen aktörler bu bayrak olmadan web süreçlerine giremiyor.
      safeForUntrustedWebProcess: true,
    });
  } catch (e) {
    // Başka pencere zaten kaydetti (aynı süreç).
    if (e.name !== "NotSupportedError") dump(`[rigel] glance aktörü: ${e}\n`);
  }
}

export function init(win) {
  const doc = win.document;
  const root = doc.documentElement;
  const { gBrowser, SessionStore } = win;
  const d = new Disposer();
  Services.prefs.getDefaultBranch("").setBoolPref(PREF, true);
  registerActor();

  const enabled = () => Services.prefs.getBoolPref(PREF, true);
  const splitEnabled = () => Services.prefs.getBoolPref("browser.tabs.splitView.enabled", false);

  /** Görünen kart (seçili sekmenin kartı). @type {{tab, parent, browser, panel, bar}|null} */
  let cur = null;
  /** Ana sekme → kartı. Sekme değişince kart gizlenir, ana sekmeye dönünce yeniden görünür. */
  const byParent = new Map();

  function activate() {
    const b = cur?.browser;
    if (!b) return;
    try {
      b.docShellIsActive = true;
      b.renderLayers = true;
    } catch (e) {
      dump(`[rigel] glance etkinleştirilemedi: ${e}\n`);
    }
  }

  function buildBar() {
    const btn = (cls, title, iconName, run) =>
      el(doc, "button", { class: `rigel-glance-btn ${cls}`, title, onclick: e => { e.stopPropagation(); run(); } },
        icon(doc, iconName, 16));
    const title = el(doc, "span", { class: "rigel-glance-host" });
    const bar = el(doc, "div", { class: "rigel-glance-bar" },
      btn("close", "Kapat (Esc)", "close", () => close()),
      btn("expand", "Tam sekmede aç", "expand", () => expand()),
      splitEnabled() && !cur?.parent?.pinned
        ? btn("split", "Bölünmüş görünümde aç", "split", () => split()) : null);
    return { bar, title };
  }

  function hostOf(browser) {
    try {
      const u = browser.currentURI;
      return /^https?$/.test(u.scheme) ? u.host.replace(/^www\./, "") : u.spec;
    } catch {
      return "";
    }
  }

  /** Kartı açar; zaten açıksa adresi kartta yükler. */
  function open(url, { triggeringPrincipal, parent = gBrowser.selectedTab } = {}) {
    if (!enabled() || !url) return null;
    triggeringPrincipal ??= Services.scriptSecurityManager.getSystemPrincipal();
    if (cur && cur.parent === parent) {
      cur.browser.fixupAndLoadURIString(url, { triggeringPrincipal });
      return cur.tab;
    }
    if (!parent || parent.closing) return null;
    const existing = byParent.get(parent);
    if (existing) {
      if (cur) hideCard(cur);
      showCard(existing);
      existing.browser.fixupAndLoadURIString(url, { triggeringPrincipal });
      return existing.tab;
    }
    if (cur) hideCard(cur);
    let tab;
    try {
      tab = gBrowser.addTab(url, {
        triggeringPrincipal,
        ownerTab: parent,
        userContextId: parent.userContextId,
        skipAnimation: true,
        index: parent.pinned ? undefined : parent._tPos + 1,
      });
    } catch (e) {
      dump(`[rigel] glance sekmesi açılamadı: ${e}\n`);
      return null;
    }
    tab.setAttribute("rigel-glance", "true");
    SessionStore.setCustomTabValue(tab, MARK, "1");
    gBrowser.hideTab(tab, "rigel-glance");

    const browser = tab.linkedBrowser;
    const panel = browser.closest(".browserSidebarContainer");
    const g = { tab, parent, browser, panel, bar: null };
    byParent.set(parent, g);
    cur = g;
    g.bar = buildBar().bar;
    panel.append(g.bar);
    showCard(g);
    win.dispatchEvent(new CustomEvent("rigel:glance", { detail: { state: "open", url } }));
    return tab;
  }

  function showCard(g) {
    cur = g;
    g.panel.setAttribute("rigel-glance", "true");
    root.setAttribute("rigel-glance", "open");
    activate();
    win.requestAnimationFrame(() => {
      if (cur !== g) return;
      activate();
      g.browser.focus();
    });
  }

  /** Kartı gizler ama sekmesini ve ana sekmeye bağını korur. */
  function hideCard(g) {
    if (cur === g) {
      cur = null;
      root.removeAttribute("rigel-glance");
    }
    g.panel?.removeAttribute("rigel-glance");
    try {
      if (!g.tab.closing) g.browser.docShellIsActive = false;
    } catch {}
  }

  /** Bağı çözer, sekmeyi döndürür (kapatmaz). */
  function detach(c = cur) {
    if (!c) return null;
    byParent.delete(c.parent);
    if (cur === c) {
      cur = null;
      root.removeAttribute("rigel-glance");
    }
    c.panel?.removeAttribute("rigel-glance");
    c.bar?.remove();
    c.tab.removeAttribute("rigel-glance");
    if (!c.tab.closing) {
      try {
        SessionStore.deleteCustomTabValue(c.tab, MARK);
      } catch {}
    }
    return c;
  }

  function close(g = cur) {
    const c = detach(g);
    if (!c) return;
    if (!c.tab.closing) {
      try {
        c.browser.docShellIsActive = false;
      } catch {}
      gBrowser.removeTab(c.tab, { animate: false, skipSessionStore: true, closeWindowWithLastTab: false });
    }
    if (gBrowser.selectedTab === c.parent && !cur) gBrowser.selectedBrowser?.focus();
    win.dispatchEvent(new CustomEvent("rigel:glance", { detail: { state: "closed" } }));
  }

  function expand() {
    const c = detach();
    if (!c || c.tab.closing) return null;
    gBrowser.showTab(c.tab);
    if (!c.parent.closing && !c.parent.pinned) gBrowser.moveTabAfter(c.tab, c.parent);
    gBrowser.selectedTab = c.tab;
    win.dispatchEvent(new CustomEvent("rigel:glance", { detail: { state: "expanded" } }));
    return c;
  }

  function split() {
    const parent = cur?.parent;
    const c = expand();
    if (!c) return;
    if (!splitEnabled() || !parent || parent.pinned || parent.closing) {
      toast(win, "Bölünmüş görünüm kullanılamıyor; tam sekmede açıldı");
      return;
    }
    try {
      if (parent.splitview) parent.splitview.unsplitTabs?.();
      gBrowser.addTabSplitView([parent, c.tab], { insertBefore: parent });
      gBrowser.selectedTab = c.tab;
    } catch (e) {
      dump(`[rigel] glance split: ${e}\n`);
    }
  }

  // Seçim başka sekmeye geçerse kart kapanır; kart sekmesi seçilirse (ör. paletten) tam sekme olur.
  d.on(gBrowser.tabContainer, "TabSelect", () => {
    const sel = gBrowser.selectedTab;
    if (cur && sel === cur.tab) {
      expand();
      return;
    }
    for (const g of byParent.values()) {
      if (g.tab === sel) {
        // Gizli kart sekmesi doğrudan seçildi (palet): tam sekme olsun.
        detach(g);
        gBrowser.showTab(g.tab);
        return;
      }
    }
    if (cur && sel !== cur.parent) hideCard(cur);
    const g = byParent.get(sel);
    if (g && cur !== g) showCard(g);
  });
  d.on(gBrowser.tabContainer, "TabClose", e => {
    const parentGlance = byParent.get(e.target);
    if (parentGlance) {
      close(parentGlance);
      return;
    }
    for (const g of byParent.values()) {
      if (g.tab === e.target) {
        detach(g);
        break;
      }
    }
  });
  // Süreç değişince (yeni frameLoader) çizim yeniden açılmalı.
  const progress = {
    onLocationChange(browser) {
      if (browser === cur?.browser) activate();
    },
    onStateChange(browser) {
      if (browser === cur?.browser) activate();
    },
  };
  gBrowser.addTabsProgressListener(progress);
  d.add(() => gBrowser.removeTabsProgressListener(progress));
  d.on(win, "DidChangeBrowserRemoteness", e => {
    if (e.target === cur?.browser) activate();
  }, true);

  // Esc kapatır (içerikten gelen tuşlar da önce üst pencereden geçer).
  d.on(win, "keydown", e => {
    if (!cur || e.key !== "Escape" || e.defaultPrevented) return;
    if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
    // Açık bir açılır menü/palet varsa önce o kapansın.
    if (win.Rigel?.palette?.isOpen?.() || win.Rigel?.drawers?.isOpen?.()) return;
    if (doc.querySelector("menupopup[open], panel[open]")) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }, true);

  d.pref(PREF, () => {
    if (!enabled()) for (const g of [...byParent.values()]) close(g);
  });

  // --- Oturumdan kalan kart sekmeleri normal sekmeye döner ---------------------
  function adoptLeftovers() {
    for (const tab of gBrowser.tabs) {
      if ([...byParent.values()].some(g => g.tab === tab)) continue;
      let v = "";
      try {
        v = SessionStore.getCustomTabValue(tab, MARK);
      } catch {}
      if (!v) continue;
      try {
        SessionStore.deleteCustomTabValue(tab, MARK);
      } catch {}
      tab.removeAttribute("rigel-glance");
      gBrowser.showTab(tab);
    }
  }
  SessionStore.promiseAllWindowsRestored?.then(adoptLeftovers).catch(() => {});
  d.on(win, "SSWindowRestored", () => win.setTimeout(adoptLeftovers, 0));

  // --- Sağ tık menüsü: "Bağlantıya göz at" -------------------------------------
  const menu = doc.getElementById("contentAreaContextMenu");
  if (menu) {
    const item = doc.createXULElement("menuitem");
    item.id = "rigel-context-glance";
    item.setAttribute("label", "Bağlantıya göz at");
    item.setAttribute("accesskey", "z");
    item.addEventListener("command", () => {
      const cm = win.gContextMenu;
      if (!cm?.linkURL) return;
      const fromGlance = cm.browser === cur?.browser;
      open(cm.linkURL, { triggeringPrincipal: cm.principal, parent: fromGlance ? cur.parent : gBrowser.selectedTab });
    });
    const anchor = doc.getElementById("context-openlinkinsplitview") ?? doc.getElementById("context-openlinkintab");
    anchor ? anchor.after(item) : menu.append(item);
    d.add(() => item.remove());
    d.on(menu, "popupshowing", e => {
      if (e.target !== menu) return;
      const cm = win.gContextMenu;
      item.hidden = !(enabled() && cm?.onLink && !cm.onMailtoLink && !cm.onTelLink && /^https?:/.test(cm.linkURL ?? ""));
    });
  }

  function readClipboardUrl() {
    try {
      const text = win.readFromClipboard?.() ?? "";
      const t = text.trim();
      if (/^https?:\/\/\S+$/i.test(t)) return t;
      if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) return "https://" + t;
    } catch {}
    return "";
  }

  const api = {
    open: (url, opts) => open(url, opts),
    /** İçerik aktöründen: hangi tarayıcıda Alt+tıklandıysa onun sekmesinin kartı. */
    openFromBrowser(browser, url, principal) {
      if (browser === cur?.browser) return open(url, { triggeringPrincipal: principal });
      const tab = gBrowser.getTabForBrowser(browser);
      if (!tab) return null;
      if (tab !== gBrowser.selectedTab) gBrowser.selectedTab = tab;
      return open(url, { triggeringPrincipal: principal, parent: tab });
    },
    close,
    expand: () => void expand(),
    split,
    isOpen: () => !!cur,
    current: () => (cur ? { tab: cur.tab, parent: cur.parent, url: cur.browser.currentURI?.spec ?? "" } : null),
  };
  (win.Rigel ??= {}).glance = api;

  return {
    commands: () => [
      {
        id: "zen.glance.clipboard", label: "Göz at: panodaki bağlantı", icon: "link", sub: "Alt+tık bağlantı",
        when: () => enabled() && !!readClipboardUrl(),
        run: () => open(readClipboardUrl()),
      },
      { id: "zen.glance.close", label: "Göz atmayı kapat", icon: "close", keys: ["Escape"], when: () => !!cur, run: close },
      { id: "zen.glance.expand", label: "Göz atılan sayfayı tam sekmede aç", icon: "tab", when: () => !!cur, run: () => expand() },
      {
        id: "zen.glance.split", label: "Göz atılan sayfayı bölünmüş görünümde aç", icon: "split",
        when: () => !!cur && splitEnabled(), run: split,
      },
      {
        id: "zen.glance.toggle",
        label: () => (enabled() ? "Göz atmayı (Alt+tık) kapat" : "Göz atmayı (Alt+tık) aç"),
        icon: "link", run: () => Services.prefs.setBoolPref(PREF, !enabled()),
      },
    ],
    destroy() {
      for (const g of [...byParent.values()]) close(g);
      d.run();
      if (win.Rigel?.glance === api) delete win.Rigel.glance;
    },
  };
}
