// Ada düzeni: tek üst şerit (48 px). Solda sekmeler yuvarlak ikonlar (sabitlenmişler önde),
// ortada sayfanın kimliğini taşıyan "ada" (tıklayınca palet), sağda araçlar ve pencere düğmeleri.
// Firefox'un yatay sekme şeridi gizli kalır; sekme durumu gBrowser'dan okunur.

import {
  Disposer, adoptNavBarTools, bindTab, clusterTabs, el, favicon, groupChip, icon, isPrivate, liveTabs, logo, navButtons,
  openAddress, tabLabel, tabUri, toggleTabsDrawer, uriParts, watchTabs, windowButtons, doCmd,
} from "./common.mjs";
import { shownHost } from "./urlsimple.mjs";
import { enableTabDnD } from "./tabdnd.mjs";

const MAX_STARS = 14;

export function init(win) {
  const doc = win.document;
  const { gBrowser } = win;
  const d = new Disposer();
  const priv = isPrivate(win);

  const stars = el(doc, "div", { class: "rigel-stars", role: "tablist" });
  const identity = el(doc, "button", {
    class: "rigel-identity", title: "Ara ya da adres yaz (Ctrl+L)",
    onclick: () => openAddress(win),
  });
  const island = el(doc, "div", { class: "rigel-island" }, navButtons(win, d, "rigel-nb"), identity);
  const tools = el(doc, "div", { class: "rigel-tools" });
  const bar = el(doc, "div", { id: "rigel-ada", class: "rigel-bar" },
    el(doc, "div", { class: "rigel-left" }, logo(doc, 20), stars),
    island,
    el(doc, "div", { class: "rigel-right" },
      tools,
      el(doc, "button", { class: "rigel-tool", title: "Sekme paneli (Ctrl+Shift+A)", onclick: e => toggleTabsDrawer(win, e) }, icon(doc, "tab")),
      el(doc, "span", { class: "rigel-sep" }),
      windowButtons(win, d)));

  const toolbox = doc.getElementById("navigator-toolbox");
  toolbox.insertBefore(bar, doc.getElementById("TabsToolbar"));
  d.add(() => bar.remove());
  adoptNavBarTools(win, d, tools);

  let hovered = null;
  // Sürükle-bırak ile sıralama, bağlantı bırakma, dışarı sürükleyip yeni pencereye ayırma.
  d.add(enableTabDnD(win, stars, { axis: "x" }));
  d.on(stars, "dragstart", () => {
    hovered = null;
    renderIsland();
  });

  const renderIsland = () => {
    const sel = gBrowser.selectedTab;
    const shown = hovered && !hovered.closing && hovered.parentNode ? hovered : sel;
    island.classList.toggle("preview", shown !== sel);
    const parts = uriParts(tabUri(shown));
    const kids = [];
    if (parts.host) {
      kids.push(favicon(doc, shown, 16),
        el(doc, "span", { class: "title", text: tabLabel(shown) }),
        el(doc, "span", { class: "host", text: shownHost(tabUri(shown), parts.host) }));
    } else {
      kids.push(icon(doc, "search", 14), el(doc, "span", { class: "placeholder", text: "Ara ya da adres yaz" }));
    }
    kids.push(el(doc, "kbd", { text: "Ctrl L" }));
    identity.replaceChildren(...kids);
    const busy = sel.hasAttribute("busy");
    const prog = island.querySelector(".rigel-progress");
    if (busy && !prog) island.append(el(doc, "span", { class: "rigel-progress" }));
    else if (!busy && prog) prog.remove();
  };

  const makeStar = tab => {
    const star = el(doc, "div", {
      class: "rigel-star", role: "tab", title: tabLabel(tab),
      "aria-selected": String(tab.selected),
    }, favicon(doc, tab, 18, true));
    star.classList.toggle("on", tab.selected);
    star.classList.toggle("loading", tab.hasAttribute("busy"));
    star.classList.toggle("asleep", tab.hasAttribute("pending") || tab.hasAttribute("discarded"));
    star.classList.toggle("private", priv);
    if (tab.hasAttribute("soundplaying") || tab.hasAttribute("muted")) {
      star.append(el(doc, "span", { class: "rigel-badge" },
        icon(doc, tab.hasAttribute("muted") ? "volumeOff" : "volume", 9)));
    }
    bindTab(win, star, tab);
    star.addEventListener("mouseenter", () => {
      hovered = tab;
      renderIsland();
    });
    star.addEventListener("mouseleave", () => {
      hovered = null;
      renderIsland();
    });
    return star;
  };

  const render = () => {
    const tabs = liveTabs(gBrowser);
    const nodes = [];
    let shown = 0;
    let hiddenTabs = 0;
    for (const c of clusterTabs(tabs)) {
      if (shown >= MAX_STARS) {
        hiddenTabs += c.group ? c.tabs.length : 1;
        continue;
      }
      if (!c.group) {
        nodes.push(makeStar(c.tab));
        shown++;
        // Sabitlenmişler grubunun sonunu ince bir çizgi ayırır.
        const next = tabs[tabs.indexOf(c.tab) + 1];
        if (c.tab.pinned && next && !next.pinned) nodes.push(el(doc, "span", { class: "rigel-pinsep" }));
        continue;
      }
      // Grup: renkli kapsül. Düz kalır (sürükle-bırak çocukları doğrudan tarar): çip + üyeler, sınıflarla birleşir.
      // Daraltılmışsa yalnız çip (etkin sekme grubun içindeyse o da görünür, Firefox gibi).
      const members = c.group.collapsed ? c.tabs.filter(t => t.selected) : c.tabs;
      const room = MAX_STARS - shown;
      const take = members.slice(0, Math.max(1, room));
      hiddenTabs += c.group.collapsed ? 0 : members.length - take.length;
      const chip = groupChip(win, c.group, c.tabs.length, { hasSelected: c.tabs.some(t => t.selected) });
      chip.classList.add("gs");
      nodes.push(chip);
      if (!take.length) chip.classList.add("solo");
      take.forEach((tab, i) => {
        const star = makeStar(tab);
        star.classList.add("gm");
        if (i === take.length - 1) star.classList.add("ge");
        nodes.push(star);
      });
      shown += take.length;
    }
    if (hiddenTabs > 0) {
      nodes.push(el(doc, "button", {
        class: "rigel-more", title: "Tüm sekmeler", text: `+${hiddenTabs}`,
        onclick: e => toggleTabsDrawer(win, e),
      }));
    }
    nodes.push(el(doc, "button", {
      class: "rigel-add", title: "Yeni sekme (Ctrl+T)", onclick: () => doCmd(doc, "cmd_newNavigatorTab"),
    }, icon(doc, "plus", 15)));
    stars.replaceChildren(...nodes);
    renderIsland();
  };

  watchTabs(win, d, render);
  win.dump("[rigel] ada hazır\n");
  return () => d.run();
}
