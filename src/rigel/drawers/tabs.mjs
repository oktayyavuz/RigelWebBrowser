// Sekme paneli (TabsPanel.svelte): aranabilir dikey liste, sabitlenmiş grubu, sekme başına menü (TabMenu.svelte).
// ↑/↓ gez, Enter geç, Delete kapat, Esc kapat. Firefox sekme olaylarını dinler; yalnız açıkken çizer.
import { el, icon, favicon, hostOf } from "../commands/ui.mjs";
import { afterTabDrag, enableTabDnD } from "../shell/tabdnd.mjs";
import { groupLabelsOn, groupName } from "../shell/common.mjs";

const fold = (s) => String(s ?? "").toLocaleLowerCase("tr").replace(/ı/g, "i");
// Grup olayları pencereye kabarır; rigel:groups-changed zen/groups.mjs'in kendi bildirimi.
const GROUP_EVENTS = ["TabGroupCreate", "TabGroupRemoved", "TabGroupUpdate", "TabGroupMoved", "TabGrouped", "TabUngrouped", "TabGroupCollapse", "TabGroupExpand", "rigel:groups-changed"];
const EVENTS = ["TabOpen", "TabClose", "TabSelect", "TabMove", "TabPinned", "TabUnpinned", "TabAttrModified", "TabBrowserDiscarded", "TabSplitViewActivate", "TabSplitViewDeactivate"];

export function createTabsPanel(win, drawers) {
  const doc = win.document;
  const { gBrowser } = win;
  const isPrivate = win.PrivateBrowsingUtils?.isWindowPrivate(win);
  let shown = false;
  let selIdx = 0;
  let tabs = [];
  let raf = 0;
  let menu = null;

  const search = el(doc, "input", { type: "text", placeholder: "Sekmelerde ara", spellcheck: "false", oninput: () => { selIdx = 0; render(); }, onkeydown: onKey });
  const count = el(doc, "span", { class: "rgl-count" });
  // Etkin alan (Z: Rigel.spaces); alan modülü yoksa boş kalır.
  const spaceEl = el(doc, "span", { class: "rgl-space" });
  const listEl = el(doc, "div", { class: "rgl-dr-list", role: "listbox" });
  const element = el(doc, "section", { class: "rgl-panel rgl-tabs" },
    el(doc, "header", {},
      el(doc, "h2", { text: "Sekmeler" }), count, spaceEl,
      el(doc, "button", { class: "rgl-tool rgl-close", title: "Kapat (Esc)", onclick: () => drawers.close() }, icon(doc, "close", 14))),
    el(doc, "label", { class: "rgl-search" }, icon(doc, "search", 15), search),
    listEl,
    el(doc, "footer", {},
      el(doc, "button", { onclick: () => { drawers.close(); win.BrowserCommands.openTab(); } }, icon(doc, "plus"), "Yeni sekme"),
      el(doc, "button", { class: "priv", onclick: () => { drawers.close(); win.OpenBrowserWindow({ private: true }); } }, icon(doc, "mask"), "Gizli pencere"),
      el(doc, "button", { title: "Kapatılan sekmeyi geri aç (Ctrl+Shift+T)", onclick: () => doc.getElementById("History:UndoCloseTab")?.doCommand() }, icon(doc, "undo"))));

  // Sürükle-bırak ile sıralama (shell/tabdnd.mjs): satırlar `.tab` taşır.
  enableTabDnD(win, listEl, { axis: "y" });

  const onTabEvent = () => {
    if (!shown || raf) return;
    // Sürükleme sürerken çizme (satır DOM'dan giderse sürükleme yarım kalır); bitince çizilir.
    raf = win.requestAnimationFrame(() => { raf = 0; afterTabDrag(win, render); });
  };

  function show() {
    shown = true;
    for (const t of EVENTS) gBrowser.tabContainer.addEventListener(t, onTabEvent);
    for (const t of GROUP_EVENTS) win.addEventListener(t, onTabEvent);
    search.value = "";
    selIdx = Math.max(0, live().filter((t) => !t.group?.collapsed || t.selected).indexOf(gBrowser.selectedTab));
    render();
    search.focus();
  }
  function hide() {
    shown = false;
    closeMenu();
    for (const t of EVENTS) gBrowser.tabContainer.removeEventListener(t, onTabEvent);
    for (const t of GROUP_EVENTS) win.removeEventListener(t, onTabEvent);
  }

  const urlOf = (t) => t.linkedBrowser?.currentURI?.spec ?? "";
  const asleep = (t) => t.hasAttribute("pending") || !t.linkedPanel;

  // visibleTabs daraltılmış grupların sekmelerini saymaz; çekmece onları da (grup başlığıyla) gösterir.
  const live = () => gBrowser.tabs.filter((t) => !t.hidden && !t.closing);
  function filtered() {
    const q = fold(search.value.trim());
    const all = live();
    return q ? all.filter((t) => fold(`${t.label} ${urlOf(t)}`).includes(q)) : all;
  }

  function render() {
    const all = filtered();
    const q = search.value.trim();
    // Daraltılmış grubun sekmeleri gizlenir (etkin sekme ve arama sonuçları hariç); klavye gezintisi görünenlerde.
    tabs = all.filter((t) => q || !t.group?.collapsed || t.selected);
    if (selIdx >= tabs.length) selIdx = Math.max(0, tabs.length - 1);
    count.textContent = String(live().length);
    const sp = win.Rigel?.spaces;
    const cur = sp?.list?.().length > 1 ? sp.current?.() : null;
    spaceEl.textContent = cur?.name ? `${cur.icon} ${cur.name}` : "";
    spaceEl.hidden = !spaceEl.textContent;
    const anyPinned = all.some((t) => t.pinned);
    const frag = doc.createDocumentFragment();
    let ri = 0;
    all.forEach((tab, j) => {
      const prev = all[j - 1];
      if (!q && anyPinned && (j === 0 || tab.pinned !== prev.pinned)) {
        frag.append(el(doc, "div", { class: "rgl-grp", text: tab.pinned ? "SABİTLENMİŞ" : "SEKMELER" }));
      }
      if (tab.group && tab.group !== prev?.group) frag.append(groupHead(tab.group, tab.group.tabs.filter((t) => !t.hidden).length));
      if (tabs.includes(tab)) frag.append(row(tab, ri++));
    });
    if (!tabs.length) frag.append(el(doc, "p", { class: "rgl-empty", text: "Eşleşen sekme yok" }));
    listEl.replaceChildren(frag);
    listEl.querySelector(".rgl-row.sel")?.scrollIntoView({ block: "nearest" });
  }

  // Grup başlığı: renk noktası, ad, sekme sayısı. Tıkla: daralt/genişlet; sağ tık ya da ⋯: yönetim menüsü.
  function groupHead(group, n) {
    const R = win.Rigel?.groups;
    const collapsed = !!group.collapsed;
    const head = el(doc, "div", {
      class: "rgl-ghead" + (collapsed ? " collapsed" : ""), "data-rigel-group": group.color || "",
      role: "button", tabindex: "-1", "aria-expanded": String(!collapsed),
      title: `${groupName(group)}: tıkla ${collapsed ? "genişlet" : "daralt"}, sağ tık seçenekler`,
      onclick: () => R?.toggle(group),
      oncontextmenu: (e) => { e.preventDefault(); R?.menu(e, group); },
    },
    icon(doc, "down", 13),
    el(doc, "span", { class: "gdot" }),
    el(doc, "span", { class: "gname" + (group.label ? "" : " empty"), text: groupLabelsOn() || !group.label ? groupName(group) : "" }),
    el(doc, "span", { class: "gcount", text: String(n) }),
    el(doc, "button", {
      class: "rgl-x act gmore", title: "Grup seçenekleri",
      onclick: (e) => { e.stopPropagation(); R?.menu(e, group); },
    }, icon(doc, "dots", 13)));
    return head;
  }

  function row(tab, i) {
    const url = urlOf(tab);
    const ctr = tab.userContextId ? win.ContextualIdentityService?.getPublicIdentityFromId(tab.userContextId) : null;
    const cls = ["rgl-row", i === selIdx && "sel", tab.selected && "on", asleep(tab) && "asleep",
      tab.group && "ing", ctr && `identity-color-${ctr.color}`].filter(Boolean).join(" ");
    const fav = tab.hasAttribute("busy") ? el(doc, "span", { class: "rgl-spin" }) : favicon(doc, { url, image: tab.getAttribute("image") }, 18);
    const btn = (cls_, title, name, fn) => el(doc, "button", {
      class: "rgl-x " + cls_, title, onclick: (e) => { e.stopPropagation(); fn(e); },
    }, icon(doc, name, 13));
    const audio = tab.soundPlaying || tab.muted
      ? el(doc, "button", { class: "rgl-audio" + (tab.muted ? " muted" : ""), title: tab.muted ? "Sesi aç" : "Sesi kapat",
        onclick: (e) => { e.stopPropagation(); tab.toggleMuteAudio(); } }, icon(doc, tab.muted ? "volumeOff" : "volume", 14))
      : null;
    const rowEl = el(doc, "div", {
      class: cls, role: "option", "data-i": i, draggable: "true",
      "data-rigel-group": tab.group ? tab.group.color || "" : null,
      "data-rigel-container": ctr ? win.ContextualIdentityService.getUserContextLabel(tab.userContextId) : null,
      onmousemove: () => setSel(i),
      onclick: () => activate(tab),
      onauxclick: (e) => { if (e.button === 1) gBrowser.removeTab(tab, { animate: true }); },
      oncontextmenu: (e) => { e.preventDefault(); openMenu(e, tab); },
    },
    el(doc, "span", { class: "fav" }, fav),
    el(doc, "span", { class: "txt" },
      el(doc, "span", { class: "t", text: tab.label || url }),
      el(doc, "span", { class: "h", text: (hostOf(url) || "Rigel") + (asleep(tab) ? " · uyuyor" : "") })),
    audio,
    isPrivate ? el(doc, "span", { class: "rgl-private-dot", title: "Gizli pencere" }) : null,
    tab.splitview ? el(doc, "span", { class: "rgl-pair", title: "Bölünmüş görünümde" }, icon(doc, "split", 13)) : null,
    btn("act" + (tab.pinned ? " pinned" : ""), tab.pinned ? "Sabitlemeyi kaldır" : "Sabitle", "thumbtack", () => togglePin(tab)),
    btn("act", "Diğer eylemler", "dots", (e) => openMenu(e, tab)),
    btn("", "Kapat", "close", () => gBrowser.removeTab(tab, { animate: true })));
    rowEl.tab = tab;
    return rowEl;
  }

  function setSel(i) {
    if (i === selIdx) return;
    selIdx = i;
    for (const r of listEl.querySelectorAll(".rgl-row")) r.classList.toggle("sel", +r.dataset.i === i);
  }

  function activate(tab) {
    gBrowser.selectedTab = tab;
    drawers.close();
  }

  function togglePin(tab) {
    if (tab.pinned) gBrowser.unpinTab(tab);
    else gBrowser.pinTab(tab);
  }

  function onKey(e) {
    if (menu) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((selIdx + 1) % Math.max(tabs.length, 1)); scrollSel(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((selIdx - 1 + tabs.length) % Math.max(tabs.length, 1)); scrollSel(); }
    else if (e.key === "Enter" && tabs[selIdx]) { e.preventDefault(); activate(tabs[selIdx]); }
    else if (e.key === "Delete" && tabs[selIdx] && !search.value) { e.preventDefault(); gBrowser.removeTab(tabs[selIdx], { animate: false }); }
  }
  const scrollSel = () => listEl.querySelector(".rgl-row.sel")?.scrollIntoView({ block: "nearest" });

  // --- sekme menüsü (TabMenu.svelte "menu" türü) ---------------------------------------------------
  function actions(tab) {
    const all = gBrowser.visibleTabs;
    const i = all.indexOf(tab);
    const kbd = (k) => (tab.selected ? k : undefined);
    const out = [
      { label: tab.pinned ? "Sabitlemeyi kaldır" : "Sabitle", icon: "thumbtack", kbd: kbd("Alt+Shift+P"), run: () => togglePin(tab) },
      { label: tab.muted ? "Sesi aç" : "Sesi kapat", icon: tab.muted ? "volume" : "volumeOff", kbd: kbd("Ctrl+M"), run: () => tab.toggleMuteAudio() },
      { label: "Çoğalt", icon: "copy", kbd: kbd("Alt+Shift+D"), run: () => win.duplicateTabIn(tab, "tab") },
    ];
    if (!tab.pinned) {
      out.push({ label: "Gruba ekle", icon: "folder", group: "add" });
      if (tab.group) {
        out.push({ label: "Gruptan çıkar", icon: "folder", run: () => gBrowser.ungroupTab(tab) });
        out.push({ label: "Grubu düzenle…", icon: "folder", run: () => win.Rigel?.groups?.edit(tab.group) });
      }
    }
    if (!tab.selected && !asleep(tab)) out.push({ label: "Uyut", icon: "moon", run: () => gBrowser.explicitUnloadTabs([tab]) });
    if (all.some((t) => t !== tab && !t.pinned)) out.push({ label: "Diğer sekmeleri kapat", icon: "close", run: () => gBrowser.removeAllTabsBut(tab) });
    if (all.slice(i + 1).some((t) => !t.pinned)) out.push({ label: "Alttaki sekmeleri kapat", icon: "down", run: () => gBrowser.removeTabsToTheEndFrom(tab) });
    out.push({ label: "Kapat", icon: "close", kbd: kbd("Ctrl+W"), danger: true, run: () => gBrowser.removeTab(tab, { animate: true }) });
    return out;
  }

  function openMenu(e, tab) {
    closeMenu();
    menu = el(doc, "div", { class: "rgl-menu", role: "menu" });
    for (const a of actions(tab)) {
      if (a.danger) menu.append(el(doc, "span", { class: "sep" }));
      menu.append(el(doc, "button", {
        role: "menuitem", class: a.danger ? "danger" : "",
        onclick: (ev) => {
          ev.stopPropagation();
          const sub = a.group === "add";
          const rect = ev.currentTarget.getBoundingClientRect();
          closeMenu();
          // "Gruba ekle": yeni grup + mevcut gruplar listesi, tıklanan sekme için.
          if (sub) win.Rigel?.groups?.addMenu({ clientX: rect.left, clientY: rect.bottom, type: "x" }, tab.multiselected ? gBrowser.selectedTabs : [tab]);
          else { a.run(); search.focus(); }
        },
      }, icon(doc, a.icon, 15), el(doc, "span", { class: "l", text: a.label }), a.kbd ? el(doc, "kbd", { text: a.kbd }) : null));
    }
    doc.documentElement.append(menu);
    const r = menu.getBoundingClientRect();
    const x = e.clientX || e.target.getBoundingClientRect?.().left || 0;
    const y = e.clientY || e.target.getBoundingClientRect?.().bottom || 0;
    menu.style.left = Math.max(6, Math.min(x, win.innerWidth - r.width - 6)) + "px";
    menu.style.top = Math.max(6, Math.min(y, win.innerHeight - r.height - 6)) + "px";
    win.addEventListener("mousedown", onOutside, true);
    win.addEventListener("keydown", onMenuKey, true);
    win.addEventListener("blur", closeMenu);
  }
  function onOutside(e) {
    if (menu && !menu.contains(e.target)) closeMenu();
  }
  function onMenuKey(e) {
    if (menu && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(); search.focus(); }
  }
  function closeMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
    win.removeEventListener("mousedown", onOutside, true);
    win.removeEventListener("keydown", onMenuKey, true);
    win.removeEventListener("blur", closeMenu);
  }

  return { element, show, hide };
}
