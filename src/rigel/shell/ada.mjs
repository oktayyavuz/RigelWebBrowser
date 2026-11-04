// Ada düzeni: tek üst şerit (48 px). Solda sekmeler yuvarlak ikonlar (sabitlenmişler önde),
// ortada sayfanın kimliğini taşıyan "ada" (tıklayınca palet), sağda araçlar ve pencere düğmeleri.
// Firefox'un yatay sekme şeridi gizli kalır; sekme durumu gBrowser'dan okunur.

import {
  Disposer, adoptNavBarTools, bindTab, clusterTabs, containerOf, el, favicon, groupChip, groupLabelsOn, icon, isNewTabSpec, isPrivate,
  liveTabs, logo, navButtons, openAddress, tabLabel, tabUri, toggleTabsDrawer, uriParts, watchTabs, windowButtons, doCmd,
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

  // --- Sekme yıldızları: sekme başına tek düğüm, yerinde güncellenir (yeniden kurulmaz) -----------
  // Ses/yükleme gibi sık değişen öznitelikler düğümü yenilemez: simge yeniden yüklenmez, üzerine gelme ve
  // animasyon durumu bozulmaz. Yeni düğüm girişte büyür, kapanan küçülüp çıkar.
  const stars$ = new WeakMap();
  const chips$ = new Map();
  const addBtn = el(doc, "button", {
    class: "rigel-add", title: "Yeni sekme (Ctrl+T)", onclick: () => doCmd(doc, "cmd_newNavigatorTab"),
  }, icon(doc, "plus", 15));
  const moreBtn = el(doc, "button", { class: "rigel-more", title: "Tüm sekmeler", onclick: e => toggleTabsDrawer(win, e) });
  // Saklanan gruplar varsa şeritte bir "Gruplar" düğmesi durur: kapanan gruplar buradan geri açılır.
  const groupsBtn = el(doc, "button", {
    class: "rigel-more rigel-groupsbtn", onclick: e => win.Rigel?.groups?.savedMenu?.(e),
  }, icon(doc, "folder", 14));
  const groupsCount = el(doc, "span", { class: "rigel-groupsn" });
  groupsBtn.append(groupsCount);
  const pinSep = el(doc, "span", { class: "rigel-pinsep" });
  const left = bar.querySelector(".rigel-left");
  let firstRender = true;
  let schedule = () => {};

  const favKey = tab => {
    const spec = tabUri(tab)?.spec ?? "";
    const priv = /^(about|chrome):/.test(spec) || isNewTabSpec(spec);
    return `${tab.getAttribute("image") || ""}|${priv ? spec : uriParts(tabUri(tab)).host}|${tab.label?.charAt(0) ?? ""}`;
  };
  const tooltip = tab => {
    const label = tabLabel(tab);
    const host = uriParts(tabUri(tab)).host;
    const lines = [label];
    if (host && host !== label) lines.push(shownHost(tabUri(tab), host));
    if (tab.hasAttribute("muted")) lines.push("Sessize alındı · tıkla: sesi aç");
    else if (tab.hasAttribute("soundplaying")) lines.push("Ses çalıyor · tıkla: sessize al");
    if (tab.pinned) lines.push("Sabitlenmiş");
    const c = containerOf(win, tab);
    if (c) lines.push(c.label);
    return lines.join("\n");
  };

  const syncBadge = (star, tab) => {
    const muted = tab.hasAttribute("muted");
    const playing = tab.hasAttribute("soundplaying");
    let badge = star.querySelector(":scope > .rigel-badge");
    if (!muted && !playing) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = el(doc, "span", { class: "rigel-badge", role: "button", "aria-label": "Sesi aç/kapat" });
      // Rozet sesi açıp kapatır; sekmeyi seçmez, sürüklemeyi başlatmaz.
      badge.addEventListener("click", e => {
        e.stopPropagation();
        e.preventDefault();
        star.tab?.toggleMuteAudio?.();
      });
      badge.addEventListener("mousedown", e => e.stopPropagation());
      badge.addEventListener("dblclick", e => e.stopPropagation());
      badge.setAttribute("draggable", "false");
      star.append(badge);
    }
    const state = muted ? "muted" : "playing";
    if (badge.dataset.state !== state) {
      badge.dataset.state = state;
      badge.replaceChildren(icon(doc, muted ? "volumeOff" : "volume", 9));
    }
  };

  const updateStar = (star, tab) => {
    star.tab = tab;
    star.title = tooltip(tab);
    star.setAttribute("aria-selected", String(tab.selected));
    star.classList.toggle("on", tab.selected);
    star.classList.toggle("loading", tab.hasAttribute("busy"));
    star.classList.toggle("asleep", tab.hasAttribute("pending") || tab.hasAttribute("discarded"));
    star.classList.toggle("pinned", tab.pinned);
    star.classList.toggle("private", priv);
    star.classList.toggle("playing", tab.hasAttribute("soundplaying") && !tab.hasAttribute("muted"));
    star.classList.toggle("muted", tab.hasAttribute("muted"));
    if (tab.group) star.setAttribute("data-rigel-group", tab.group.color || "");
    else star.removeAttribute("data-rigel-group");
    const key = favKey(tab);
    if (star.dataset.fav !== key) {
      star.dataset.fav = key;
      const old = star.querySelector(":scope > .rigel-fav");
      const neu = favicon(doc, tab, 18, true);
      if (old) old.replaceWith(neu);
      else star.prepend(neu);
    }
    syncBadge(star, tab);
    return star;
  };

  const makeStar = tab => {
    let star = stars$.get(tab);
    if (star) return updateStar(star, tab);
    star = el(doc, "div", { class: "rigel-star", role: "tab" });
    stars$.set(tab, star);
    bindTab(win, star, tab);
    star.addEventListener("mouseenter", () => {
      hovered = star.tab;
      renderIsland();
    });
    star.addEventListener("mouseleave", () => {
      hovered = null;
      renderIsland();
    });
    updateStar(star, tab);
    if (!firstRender) star.classList.add("entering");
    star.addEventListener("animationend", e => {
      if (e.animationName === "rigel-star-in") star.classList.remove("entering");
    });
    return star;
  };

  const chipFor = (c, take) => {
    const hasSel = c.tabs.some(t => t.selected);
    const sig = [c.group.label, c.group.color, c.tabs.length, !!c.group.collapsed, hasSel, groupLabelsOn(), !take.length].join("|");
    const hit = chips$.get(c.group);
    if (hit?.sig === sig) return hit.chip;
    const chip = groupChip(win, c.group, c.tabs.length, { hasSelected: hasSel });
    chip.classList.add("gs");
    if (!take.length) chip.classList.add("solo");
    chips$.set(c.group, { chip, sig });
    return chip;
  };

  const leave = node => {
    node.tab = null;
    node.classList.remove("entering");
    node.classList.add("leaving");
    node.style.pointerEvents = "none";
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      node.remove();
      schedule();
    };
    node.addEventListener("transitionend", e => e.propertyName === "width" && end());
    win.setTimeout(end, 260);
  };

  const reconcile = desired => {
    const want = new Set(desired);
    for (const n of [...stars.children]) {
      if (want.has(n) || n.classList.contains("leaving")) continue;
      const closing = n.classList.contains("rigel-star") && n.tab && (n.tab.closing || !n.tab.isConnected);
      if (closing && !firstRender) leave(n);
      else n.remove();
    }
    let cur = stars.firstElementChild;
    for (const n of desired) {
      while (cur && cur.classList.contains("leaving") && cur !== n) cur = cur.nextElementSibling;
      if (cur === n) {
        cur = cur.nextElementSibling;
        continue;
      }
      stars.insertBefore(n, cur);
    }
  };

  const build = cap => {
    const tabs = liveTabs(gBrowser);
    const nodes = [];
    let shown = 0;
    let hiddenTabs = 0;
    for (const c of clusterTabs(tabs)) {
      const hasSel = c.group ? c.tabs.some(t => t.selected) : c.tab.selected;
      // Sığmayan sekmeler "+N" olur; etkin sekme her zaman görünür kalır.
      if (shown >= cap && !hasSel) {
        hiddenTabs += c.group ? c.tabs.length : 1;
        continue;
      }
      if (!c.group) {
        nodes.push(makeStar(c.tab));
        shown++;
        // Sabitlenmişler grubunun sonunu ince bir çizgi ayırır.
        const next = tabs[tabs.indexOf(c.tab) + 1];
        if (c.tab.pinned && next && !next.pinned) nodes.push(pinSep);
        continue;
      }
      // Grup: renkli kapsül. Düz kalır (sürükle-bırak çocukları doğrudan tarar): çip + üyeler, sınıflarla birleşir.
      // Daraltılmışsa yalnız çip (etkin sekme grubun içindeyse o da görünür, Firefox gibi).
      const members = c.group.collapsed ? c.tabs.filter(t => t.selected) : c.tabs;
      const room = cap - shown;
      let take = shown >= cap ? members.filter(t => t.selected) : members.slice(0, Math.max(1, room));
      if (shown < cap && !take.some(t => t.selected) && hasSel && !c.group.collapsed) take = [...take.slice(0, -1), c.tabs.find(t => t.selected)];
      hiddenTabs += c.group.collapsed ? 0 : members.length - take.length;
      nodes.push(chipFor(c, take));
      take.forEach((tab, i) => {
        const star = makeStar(tab);
        star.classList.add("gm");
        star.classList.toggle("ge", i === take.length - 1);
        nodes.push(star);
      });
      shown += take.length;
    }
    // gm/ge yalnız grup üyelerinde kalsın (sekme gruptan çıkınca düğüm yeniden kullanılır).
    for (const n of nodes) {
      if (n.classList.contains("rigel-star") && !n.tab?.group) n.classList.remove("gm", "ge");
    }
    if (hiddenTabs > 0) {
      moreBtn.textContent = `+${hiddenTabs}`;
      moreBtn.title = `Tüm sekmeler (${hiddenTabs} sekme daha)`;
      nodes.push(moreBtn);
    }
    const kept = win.Rigel?.groups?.saved?.().length ?? 0;
    if (kept) {
      groupsCount.textContent = String(kept);
      groupsBtn.title = `Gruplar: ${kept} saklanan grup`;
      nodes.push(groupsBtn);
    }
    nodes.push(addBtn);
    return nodes;
  };

  // Şeride kaç sekme sığar: ilk tahmin genişlikten, sonra taşma kalmayana dek azaltılır.
  const render = () => {
    const avail = left.getBoundingClientRect().right - stars.getBoundingClientRect().left - 12;
    let cap = avail > 0 ? Math.max(3, Math.min(MAX_STARS, Math.floor(avail / 30))) : MAX_STARS;
    for (let tries = 0; ; tries++) {
      reconcile(build(cap));
      const edge = stars.getBoundingClientRect().right + 0.5;
      const over = [...stars.children].some(n => !n.classList.contains("leaving") && n.getBoundingClientRect().right > edge);
      if (!over || cap <= 3 || tries > 8) break;
      cap--;
    }
    for (const [g, v] of chips$) if (!g.isConnected) chips$.delete(g);
    firstRender = false;
    renderIsland();
  };

  const watcher = watchTabs(win, d, render);
  schedule = watcher;
  const ro = new win.ResizeObserver(() => schedule());
  ro.observe(left);
  d.add(() => ro.disconnect());
  win.dump("[rigel] ada hazır\n");
  return () => d.run();
}
