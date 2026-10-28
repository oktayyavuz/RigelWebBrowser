// Komuta düzeni: kalıcı sekme listesi yok. 44 px şerit: logo, gezinme, adres kırıntısı (palet),
// sekme sayacı (sağ sekme paneli), araçlar ve pencere düğmeleri. Her şey Ctrl+K ve Ctrl+Shift+A ile.

import {
  Disposer, adoptNavBarTools, clusterTabs, containerOf, el, favicon, groupChip, icon, liveTabs, logo, navButtons, openAddress,
  tabLabel, tabUri, toggleTabsDrawer, uriParts, watchTabs, windowButtons,
} from "./common.mjs";
import { shownHost } from "./urlsimple.mjs";
import { enableLinkDrop } from "./tabdnd.mjs";

export function init(win) {
  const doc = win.document;
  const { gBrowser } = win;
  const d = new Disposer();

  const crumb = el(doc, "button", {
    class: "rigel-crumb", title: "Ara ya da adres yaz (Ctrl+L)", onclick: () => openAddress(win),
  });
  const counter = el(doc, "button", {
    class: "rigel-counter", title: "Sekme paneli (Ctrl+Shift+A)", onclick: e => toggleTabsDrawer(win, e),
  });
  const tools = el(doc, "div", { class: "rigel-tools" });
  // Gruplar: sayacın yanında küçük çipler (tıklayınca grup menüsü). Kalıcı sekme şeridi olmadığından başka yer yok.
  const gstrip = el(doc, "div", { class: "rigel-gstrip", role: "group", "aria-label": "Sekme grupları" });
  const bar = el(doc, "div", { id: "rigel-komuta", class: "rigel-bar" },
    el(doc, "span", { class: "rigel-komuta-logo" }, logo(doc, 20)),
    navButtons(win, d),
    crumb,
    gstrip,
    counter,
    tools,
    windowButtons(win, d));
  const toolbox = doc.getElementById("navigator-toolbox");
  toolbox.insertBefore(bar, doc.getElementById("TabsToolbar"));
  d.add(() => bar.remove());
  adoptNavBarTools(win, d, tools);
  // Kalıcı sekme şeridi yok: bağlantı sürükleyip adres ya da sayaç üstüne bırakınca yeni sekmede açılır.
  d.add(enableLinkDrop(win, crumb));
  d.add(enableLinkDrop(win, counter));

  const render = () => {
    const sel = gBrowser.selectedTab;
    const parts = uriParts(tabUri(sel));
    if (parts.host) {
      crumb.replaceChildren(
        parts.secure ? el(doc, "span", { class: "lock" }, icon(doc, "lock", 14)) : icon(doc, "globe", 14),
        el(doc, "b", { text: shownHost(tabUri(sel), parts.host) }),
        el(doc, "span", { class: "path", text: parts.rest }),
        el(doc, "span", { class: "t", text: tabLabel(sel) }));
      const ctr = containerOf(win, sel);
      if (ctr) {
        crumb.prepend(el(doc, "span", { class: `rigel-ctr identity-color-${ctr.color}`, text: ctr.label }));
      }
    } else {
      crumb.replaceChildren(icon(doc, "search", 14),
        el(doc, "span", { class: "path", text: "Ara ya da adres yaz" }),
        el(doc, "kbd", { text: "Ctrl K" }));
    }

    const tabs = liveTabs(gBrowser);
    const chips = clusterTabs(tabs).filter(c => c.group).map(c =>
      groupChip(win, c.group, c.tabs.length, { menuOnClick: true, hasSelected: c.tabs.some(t => t.selected) }));
    gstrip.replaceChildren(...chips);
    gstrip.hidden = !chips.length;
    const stack = el(doc, "span", { class: "stack" },
      ...tabs.slice(0, 3).map(t => el(doc, "span", { class: "s" }, favicon(doc, t, 16, true))));
    const kids = [stack, el(doc, "span", { class: "n", text: String(tabs.length) })];
    if (tabs.some(t => t.hasAttribute("soundplaying") && !t.hasAttribute("muted") && !t.selected)) {
      kids.push(el(doc, "span", { class: "snd", title: "Arka planda ses çalan sekme var" }, icon(doc, "volume", 13)));
    }
    counter.replaceChildren(...kids);

    const busy = sel.hasAttribute("busy");
    const prog = bar.querySelector(".rigel-progress");
    if (busy && !prog) bar.append(el(doc, "span", { class: "rigel-progress" }));
    else if (!busy && prog) prog.remove();
  };

  watchTabs(win, d, render);
  win.dump("[rigel] komuta hazır\n");
  return () => d.run();
}
