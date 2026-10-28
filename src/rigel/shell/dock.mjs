// Yörünge Dock düzeni: ince üst başlık şeridi (36 px) + altta yüzen dock (68 px).
// Dock'ta sekmeler, adres düğmesi (palet) ve araçlar var. Firefox'un sekme şeridi gizli.

import {
  Disposer, adoptNavBarTools, bindTab, clusterTabs, doCmd, el, favicon, groupChip, icon, isPrivate, liveTabs, navButtons,
  openAddress, tabLabel, tabUri, toggleTabsDrawer, uriParts, watchTabs, windowButtons,
} from "./common.mjs";
import { shownHost } from "./urlsimple.mjs";
import { enableTabDnD } from "./tabdnd.mjs";

const MAX = 16;

export function init(win) {
  const doc = win.document;
  const { gBrowser } = win;
  const d = new Disposer();
  const priv = isPrivate(win);

  // Üst şerit
  const title = el(doc, "div", { class: "rigel-title" });
  const top = el(doc, "div", { id: "rigel-docktop", class: "rigel-bar" },
    navButtons(win, d), title, windowButtons(win, d));
  const toolbox = doc.getElementById("navigator-toolbox");
  toolbox.insertBefore(top, doc.getElementById("TabsToolbar"));
  d.add(() => top.remove());

  // Alt dock
  const seg = el(doc, "div", { class: "rigel-seg", role: "tablist" });
  const omni = el(doc, "button", {
    class: "rigel-omni", title: "Ara ya da adres yaz (Ctrl+L)", onclick: () => openAddress(win),
  });
  const tools = el(doc, "div", { class: "rigel-tools" });
  const dock = el(doc, "div", { id: "rigel-dock", class: "rigel-bar" },
    el(doc, "div", { class: "rigel-dock-body" },
      seg,
      el(doc, "span", { class: "rigel-vsep" }),
      omni,
      tools,
      el(doc, "button", { class: "rigel-tool", title: "Sekme paneli (Ctrl+Shift+A)", onclick: e => toggleTabsDrawer(win, e) }, icon(doc, "tab"))));
  const browser = doc.getElementById("browser");
  browser.after(dock);
  d.add(() => dock.remove());
  adoptNavBarTools(win, d, tools);
  d.add(enableTabDnD(win, seg, { axis: "x" }));

  const render = () => {
    const sel = gBrowser.selectedTab;
    const parts = uriParts(tabUri(sel));

    // Başlık
    const t = [];
    if (parts.secure) t.push(el(doc, "span", { class: "lock" }, icon(doc, "lock", 13)));
    t.push(el(doc, "b", { text: tabLabel(sel) }));
    if (parts.host) t.push(el(doc, "span", { text: `· ${parts.host}` }));
    title.replaceChildren(...t);
    const busy = sel.hasAttribute("busy");
    const prog = top.querySelector(".rigel-progress");
    if (busy && !prog) top.append(el(doc, "span", { class: "rigel-progress" }));
    else if (!busy && prog) prog.remove();

    // Sekmeler (gruplar: renkli bölüm = çip + üyeler; düz çocuklar, sürükle-bırak için)
    const tabs = liveTabs(gBrowser);
    const nodes = [];
    let shown = 0;
    let hiddenTabs = 0;
    const makeTab = tab => {
      const node = el(doc, "div", {
        class: "rigel-dtab", role: "tab", title: tabLabel(tab) + (tab.hasAttribute("pending") ? " · uyuyor" : ""),
        "aria-selected": String(tab.selected),
      });
      node.classList.toggle("on", tab.selected);
      node.classList.toggle("private", priv);
      node.classList.toggle("asleep", tab.hasAttribute("pending") || tab.hasAttribute("discarded"));
      const fav = el(doc, "span", { class: "fav" },
        tab.hasAttribute("busy") ? el(doc, "span", { class: "spin" }) : favicon(doc, tab, 20));
      if (tab.hasAttribute("soundplaying") || tab.hasAttribute("muted")) {
        fav.append(el(doc, "span", { class: "rigel-badge" },
          icon(doc, tab.hasAttribute("muted") ? "volumeOff" : "volume", 9)));
      }
      node.append(fav);
      if (tab.selected && !tab.pinned) node.append(el(doc, "span", { class: "lbl", text: tabLabel(tab) }));
      bindTab(win, node, tab);
      return node;
    };
    for (const c of clusterTabs(tabs)) {
      if (shown >= MAX) {
        hiddenTabs += c.group ? c.tabs.length : 1;
        continue;
      }
      if (!c.group) {
        nodes.push(makeTab(c.tab));
        shown++;
        const next = tabs[tabs.indexOf(c.tab) + 1];
        if (c.tab.pinned && next && !next.pinned) nodes.push(el(doc, "span", { class: "rigel-pinsep" }));
        continue;
      }
      const members = c.group.collapsed ? c.tabs.filter(t => t.selected) : c.tabs;
      const take = members.slice(0, Math.max(1, MAX - shown));
      hiddenTabs += c.group.collapsed ? 0 : members.length - take.length;
      const chip = groupChip(win, c.group, c.tabs.length, { hasSelected: c.tabs.some(t => t.selected) });
      chip.classList.add("gs");
      if (!take.length) chip.classList.add("solo");
      nodes.push(chip);
      take.forEach((tab, i) => {
        const node = makeTab(tab);
        node.classList.add("gm");
        if (i === take.length - 1) node.classList.add("ge");
        nodes.push(node);
      });
      shown += take.length;
    }
    if (hiddenTabs > 0) {
      nodes.push(el(doc, "button", {
        class: "rigel-dtab more", text: `+${hiddenTabs}`, title: "Tüm sekmeler",
        onclick: e => toggleTabsDrawer(win, e),
      }));
    }
    nodes.push(el(doc, "button", {
      class: "rigel-dtab", title: "Yeni sekme (Ctrl+T)", onclick: () => doCmd(doc, "cmd_newNavigatorTab"),
    }, icon(doc, "plus")));
    seg.replaceChildren(...nodes);

    // Adres düğmesi
    omni.replaceChildren(icon(doc, "search", 15),
      parts.host ? el(doc, "b", { text: shownHost(tabUri(sel), parts.host) }) : el(doc, "span", { text: "Ara ya da adres yaz" }),
      el(doc, "kbd", { text: "Ctrl K" }));
  };

  watchTabs(win, d, render);
  win.dump("[rigel] dock hazır\n");
  return () => d.run();
}
