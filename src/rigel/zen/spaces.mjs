// Alanlar (workspace) ve Essentials. Zen Browser'ın ZenSpaceManager'ından fikir, sade hali.
//
// - Alan listesi: rigel.spaces (JSON [{ id, name, icon }]). Etkin alan pencere başınadır ve
//   oturumda saklanır (SessionStore pencere değeri "rigelSpace").
// - Her sekmenin alanı SessionStore sekme değeri "rigelSpace"te (yeniden başlatınca korunur),
//   hızlı erişim için sekmede "rigel-space" özniteliği de var.
// - Geçiş: diğer alanların sekmeleri gBrowser.hideTab(tab, "rigel-space") ile gizlenir. Her alanın
//   son seçili sekmesi hatırlanır; boş alana geçince yeni sekme açılır.
// - Essentials = sabitlenmiş sekmeler: hiçbir alana ait değildir, her alanda görünür
//   (Firefox sabitlenmiş sekmeyi zaten gizlemez).
// - Başka alandaki bir sekme seçilirse (palet, sekme paneli) o alana geçilir.
// - Kısayollar: Ctrl+Alt+1..9 (Ctrl+1..9 Firefox'un sekme geçişi olarak kalır).
// - Sekme grupları (Firefox'un yerel grupları) tek bir alanda yaşar: gruba giren sekme grubun
//   alanına geçer; sekmeleri gizli olan grubun başlığı da gizlenir.
// - Alanın varsayılan kapsayıcısı (container, isteğe bağlı): rigel.spaces içindeki "container"
//   (userContextId). Yeni sekme (Ctrl+T, + düğmeleri) o alanda bu kapsayıcıda açılır.
// - Seçici: Yan Panel'in altında satır; Ada, Dock, Komuta ve Klasik'te düzenin şeridinde küçük düğme.

import { Disposer, el, toast } from "./util.mjs";
import { getDialog } from "../shell/dialog.mjs";

const PREF = "rigel.spaces";
const TAB_KEY = "rigelSpace";
const WIN_KEY = "rigelSpace";
const HIDE_SOURCE = "rigel-space";
const ICONS = ["🪐", "💼", "🎮", "📚", "🎵", "🧪", "🌙", "☕", "🛒", "✈️", "🎨", "💡"];
const DEFAULT = [{ id: "s-genel", name: "Kişisel", icon: "🪐" }];

function readSpaces() {
  try {
    const list = JSON.parse(Services.prefs.getStringPref(PREF, ""));
    const ok = Array.isArray(list) ? list.filter(s => s && typeof s.id === "string" && s.id) : [];
    if (ok.length) {
      return ok.map(s => ({
        id: s.id, name: String(s.name || "Alan"), icon: String(s.icon || "•"),
        container: Number.isInteger(s.container) && s.container > 0 ? s.container : 0,
      }));
    }
  } catch {}
  return DEFAULT.map(s => ({ ...s }));
}

function writeSpaces(list) {
  Services.prefs.setStringPref(PREF, JSON.stringify(list));
}

export function init(win) {
  const doc = win.document;
  const root = doc.documentElement;
  const { gBrowser, SessionStore } = win;
  const d = new Disposer();
  const isPrivate = win.PrivateBrowsingUtils?.isWindowPrivate(win) ?? false;

  let spaces = readSpaces();
  let active = spaces[0].id;
  let switching = 0;
  const lastSelected = new Map(); // alan → sekme

  const exists = id => spaces.some(s => s.id === id);
  const spaceById = id => spaces.find(s => s.id === id);
  const isManaged = tab => !tab.pinned && !tab.closing && !tab.hasAttribute("rigel-glance")
    && tab !== win.FirefoxViewHandler?.tab;

  function ssGet(tab) {
    try {
      return SessionStore.getCustomTabValue(tab, TAB_KEY) || "";
    } catch {
      return "";
    }
  }

  function assign(tab, id) {
    tab.setAttribute("rigel-space", id);
    try {
      SessionStore.setCustomTabValue(tab, TAB_KEY, id);
    } catch {}
  }

  function spaceOf(tab) {
    const id = tab.getAttribute("rigel-space") || ssGet(tab);
    return exists(id) ? id : "";
  }

  function tabsIn(id) {
    return gBrowser.tabs.filter(t => isManaged(t) && spaceOf(t) === id);
  }

  /** Sekme özniteliklerini oturum değerlerinden yeniler; alanı olmayanı etkin alana koyar. */
  function syncTab(tab) {
    if (tab.pinned) return;
    const stored = ssGet(tab);
    if (exists(stored)) tab.setAttribute("rigel-space", stored);
    else assign(tab, exists(tab.getAttribute("rigel-space")) ? tab.getAttribute("rigel-space") : active);
  }

  function apply() {
    switching++;
    try {
      const sel = gBrowser.selectedTab;
      if (isManaged(sel) && spaceOf(sel) !== active) {
        // Seçili sekme başka alanda kalmasın (gizlenemez).
        const pick = pickTab(active);
        gBrowser.selectedTab = pick;
      }
      for (const tab of gBrowser.tabs) {
        if (tab.pinned) continue;
        if (!isManaged(tab)) continue;
        const mine = spaceOf(tab) === active;
        if (mine && tab.hidden) gBrowser.showTab(tab);
        else if (!mine && !tab.hidden) gBrowser.hideTab(tab, HIDE_SOURCE);
      }
      syncGroups();
    } finally {
      switching--;
    }
  }

  /** Alana geçince seçilecek sekme: hatırlanan, yoksa son sekme, yoksa yeni sekme. */
  function pickTab(id) {
    const remembered = lastSelected.get(id);
    if (remembered && !remembered.closing && remembered.parentNode && spaceOf(remembered) === id && isManaged(remembered)) {
      if (remembered.hidden) gBrowser.showTab(remembered);
      return remembered;
    }
    const list = tabsIn(id);
    if (list.length) {
      const t = list.at(-1);
      if (t.hidden) gBrowser.showTab(t);
      return t;
    }
    const userContextId = isPrivate ? 0 : spaceById(id)?.container || 0;
    const tab = gBrowser.addTrustedTab(win.BROWSER_NEW_TAB_URL || "about:newtab", { skipAnimation: true, userContextId });
    assign(tab, id);
    return tab;
  }

  function saveActive() {
    try {
      SessionStore.setCustomWindowValue(win, WIN_KEY, active);
    } catch {}
  }

  function switchTo(id, { quiet = false, keepSelection = false } = {}) {
    if (!exists(id)) return;
    const sel = gBrowser.selectedTab;
    if (id === active && !keepSelection) {
      apply();
      return;
    }
    if (isManaged(sel) && spaceOf(sel) === active) lastSelected.set(active, sel);
    active = id;
    saveActive();
    switching++;
    try {
      if (!keepSelection) {
        const pick = pickTab(id);
        if (gBrowser.selectedTab !== pick) gBrowser.selectedTab = pick;
      }
      apply();
    } finally {
      switching--;
    }
    render();
    root.setAttribute("data-rigel-space", id);
    win.dispatchEvent(new CustomEvent("rigel:space-changed", { detail: { id } }));
    if (!quiet) {
      const s = spaceById(id);
      toast(win, `Alan: ${s.icon} ${s.name}`);
    }
  }

  function create({ name, icon } = {}) {
    const used = new Set(spaces.map(s => s.icon));
    const s = {
      id: "s-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: (name || "").trim() || `Alan ${spaces.length + 1}`,
      icon: (icon || "").trim() || ICONS.find(i => !used.has(i)) || ICONS[spaces.length % ICONS.length],
    };
    spaces = [...spaces, s];
    writeSpaces(spaces);
    switchTo(s.id);
    return s;
  }

  function update(id, patch) {
    const s = spaceById(id);
    if (!s) return;
    Object.assign(s, patch);
    writeSpaces(spaces);
  }

  function remove(id) {
    if (spaces.length < 2 || !exists(id)) return false;
    const rest = spaces.filter(s => s.id !== id);
    const target = rest[0].id;
    // Sekmeler kaybolmasın: ilk alana taşınır.
    for (const tab of tabsIn(id)) assign(tab, target);
    if (active === id) {
      active = target;
      saveActive();
    }
    spaces = rest;
    writeSpaces(spaces);
    switchTo(active, { quiet: true, keepSelection: true });
    return true;
  }

  function moveTab(tab, id) {
    if (!exists(id) || !tab || tab.pinned || spaceOf(tab) === id) return;
    // Grup tek alanda yaşar: taşınan sekme gruptan çıkar.
    if (tab.group) {
      try {
        gBrowser.ungroupTab(tab);
      } catch {}
    }
    assign(tab, id);
    if (tab.selected && id !== active) {
      switching++;
      try {
        lastSelected.delete(active);
        gBrowser.selectedTab = pickTab(active);
      } finally {
        switching--;
      }
    }
    lastSelected.set(id, tab);
    apply();
    toast(win, `Sekme taşındı: ${spaceById(id).icon} ${spaceById(id).name}`);
  }

  /** Bir grubu bütün sekmeleriyle başka alana taşır (grup bozulmaz). */
  function moveGroup(group, id) {
    if (!exists(id) || !group) return;
    const tabs = (group.tabs ?? []).filter(isManaged);
    if (!tabs.length || tabs.every(t => spaceOf(t) === id)) return;
    for (const t of tabs) assign(t, id);
    group.setAttribute("rigel-space", id);
    const sel = gBrowser.selectedTab;
    if (tabs.includes(sel) && id !== active) {
      switching++;
      try {
        lastSelected.delete(active);
        gBrowser.selectedTab = pickTab(active);
      } finally {
        switching--;
      }
    }
    if (tabs.includes(sel)) lastSelected.set(id, sel);
    apply();
    toast(win, `Grup taşındı: ${spaceById(id).icon} ${spaceById(id).name}`);
  }

  // --- Sekme grupları -----------------------------------------------------------
  /** Grubun alanı: içindeki (yönetilen) ilk sekmenin alanı. */
  function groupSpace(group, except = null) {
    for (const t of group.tabs ?? []) {
      if (t !== except && isManaged(t) && spaceOf(t)) return spaceOf(t);
    }
    return "";
  }
  function syncGroups() {
    for (const g of gBrowser.tabGroups ?? []) {
      const visible = (g.tabs ?? []).some(t => !t.hidden);
      if (visible === g.hidden) g.hidden = !visible;
      const id = groupSpace(g);
      if (id) g.setAttribute("rigel-space", id);
    }
  }

  // --- Sekme olayları ------------------------------------------------------------
  const tc = gBrowser.tabContainer;
  d.on(tc, "TabOpen", e => {
    const tab = e.target;
    if (tab.pinned) return;
    // Oturumdan gelen sekmelerin değeri birazdan yazılır (SSTabRestoring); şimdilik etkin alan.
    if (!tab.hasAttribute("rigel-space")) tab.setAttribute("rigel-space", active);
    win.setTimeout(() => {
      if (tab.closing || !tab.parentNode) return;
      syncTab(tab);
    }, 0);
  });
  d.on(tc, "SSTabRestoring", e => {
    const tab = e.target;
    const stored = ssGet(tab);
    if (exists(stored)) tab.setAttribute("rigel-space", stored);
    scheduleApply();
  });
  // Gruba giren sekme grubun alanına geçer (grubun başka sekmesi yoksa grup bu sekmenin alanında).
  d.on(win, "TabGrouped", e => {
    const tab = e.detail;
    const group = e.target;
    if (!tab || !isManaged(tab)) return;
    const id = groupSpace(group, tab);
    if (id && spaceOf(tab) !== id) {
      assign(tab, id);
      scheduleApply();
    } else {
      syncGroups();
    }
  });
  for (const ev of ["TabGroupCreate", "TabUngrouped", "TabGroupRemoved"]) d.on(win, ev, () => scheduleApply());
  d.on(tc, "TabUnpinned", e => {
    assign(e.target, active);
  });
  d.on(tc, "TabSelect", e => {
    if (switching) return;
    const tab = gBrowser.selectedTab;
    if (!isManaged(tab)) return;
    const id = spaceOf(tab);
    const prev = e.detail?.previousTab;
    if (prev && isManaged(prev) && spaceOf(prev) === active) lastSelected.set(active, prev);
    if (id && id !== active) switchTo(id, { keepSelection: true });
    else lastSelected.set(active, tab);
  });
  d.on(tc, "TabClose", e => {
    const tab = e.target;
    if (switching || !tab.selected || !isManaged(tab) || spaceOf(tab) !== active) return;
    if (gBrowser.tabs.length <= 1) return;
    const others = tabsIn(active).filter(t => t !== tab);
    if (others.length) return;
    // Alanın son sekmesi kapanıyor: alan boş kalmasın, yeni sekme açılır ve ona geçilir.
    const fresh = gBrowser.addTrustedTab(win.BROWSER_NEW_TAB_URL || "about:newtab", { skipAnimation: true });
    assign(fresh, active);
    gBrowser.setSuccessor(tab, fresh);
  });

  let applyQueued = false;
  function scheduleApply() {
    if (applyQueued) return;
    applyQueued = true;
    win.setTimeout(() => {
      applyQueued = false;
      apply();
      render();
    }, 0);
  }

  /** Oturum geri yüklenince etkin alanı ve sekme alanlarını oku. */
  function restore() {
    let id = "";
    try {
      id = SessionStore.getCustomWindowValue(win, WIN_KEY) || "";
    } catch {}
    const sel = gBrowser.selectedTab;
    const selSpace = isManaged(sel) ? ssGet(sel) : "";
    if (exists(selSpace)) id = selSpace;
    if (!exists(id)) id = spaces[0].id;
    active = id;
    for (const tab of gBrowser.tabs) syncTab(tab);
    saveActive();
    apply();
    render();
    root.setAttribute("data-rigel-space", active);
  }

  d.pref(PREF, () => {
    spaces = readSpaces();
    if (!exists(active)) {
      switchTo(spaces[0].id, { quiet: true });
    } else {
      apply();
      render();
    }
    refreshCommands();
  });

  // --- Yan Panel: alan seçici ------------------------------------------------------
  const bar = el(doc, "div", { id: "rigel-spaces", role: "tablist", "aria-label": "Alanlar" });
  const ctx = doc.createXULElement("menupopup");
  ctx.id = "rigel-spaces-menu";
  let ctxSpace = null;
  const mi = (label, fn) => {
    const m = doc.createXULElement("menuitem");
    m.setAttribute("label", label);
    m.addEventListener("command", () => ctxSpace && fn(ctxSpace));
    ctx.append(m);
    return m;
  };
  mi("Yeniden adlandır…", id => promptRename(id));
  mi("Simgeyi değiştir…", id => promptIcon(id));
  const ctxDelete = mi("Alanı sil", id => remove(id));
  ctx.append(doc.createXULElement("menuseparator"));
  mi("Yeni alan…", () => promptNew());
  (doc.getElementById("mainPopupSet") ?? doc.documentElement).append(ctx);
  d.add(() => ctx.remove());
  d.on(ctx, "popupshowing", () => {
    ctxDelete.disabled = spaces.length < 2;
  });

  function render() {
    const kids = spaces.map((s, i) => {
      const b = el(doc, "button", {
        class: "rigel-space" + (s.id === active ? " on" : ""), role: "tab",
        "aria-selected": String(s.id === active),
        title: `${s.name}${i < 9 ? ` (Ctrl+Alt+${i + 1})` : ""}`,
        onclick: () => switchTo(s.id),
        oncontextmenu: e => {
          e.preventDefault();
          ctxSpace = s.id;
          ctx.openPopupAtScreen(e.screenX, e.screenY, true, e);
        },
      }, el(doc, "span", { class: "ico", text: s.icon }));
      return b;
    });
    const cur = spaceById(active);
    for (const chip of chips) renderChip(chip);
    bar.replaceChildren(
      el(doc, "span", { class: "rigel-space-name", text: cur ? cur.name : "" }),
      el(doc, "div", { class: "rigel-space-list" }, ...kids,
        el(doc, "button", { class: "rigel-space add", title: "Yeni alan", onclick: () => promptNew() }, "+")));
  }

  // Düzen şeritlerindeki küçük seçici: Ada (yıldızların yanında), Dock (nokta grubu),
  // Komuta (logodan sonra), Klasik (araç çubuğunun başında).
  const pickMenu = doc.createXULElement("menupopup");
  pickMenu.id = "rigel-spaces-pick";
  (doc.getElementById("mainPopupSet") ?? doc.documentElement).append(pickMenu);
  d.add(() => pickMenu.remove());
  d.on(pickMenu, "popupshowing", e => {
    if (e.target !== pickMenu) return;
    const items = spaces.map((s, i) => {
      const m = doc.createXULElement("menuitem");
      m.setAttribute("type", "radio");
      m.setAttribute("label", `${s.icon}  ${s.name}`);
      if (i < 9) m.setAttribute("acceltext", `Ctrl+Alt+${i + 1}`);
      if (s.id === active) m.setAttribute("checked", "true");
      m.addEventListener("command", () => switchTo(s.id));
      return m;
    });
    const add = doc.createXULElement("menuitem");
    add.setAttribute("label", "Yeni alan…");
    add.addEventListener("command", () => promptNew());
    const manage = doc.createXULElement("menuitem");
    manage.setAttribute("label", "Etkin alanı yeniden adlandır…");
    manage.addEventListener("command", () => promptRename());
    pickMenu.replaceChildren(...items, doc.createXULElement("menuseparator"), add, manage);
  });

  const chips = new Set(); // { node, kind }
  function chipButton(kind) {
    const node = el(doc, "button", {
      class: "rigel-spacechip", "data-kind": kind, title: "Alanlar (Ctrl+Alt+1…9)",
      onclick: () => pickMenu.openPopup(node, kind === "dock" ? "before_start" : "after_start", 0, kind === "dock" ? -6 : 4),
      oncontextmenu: e => {
        e.preventDefault();
        ctxSpace = active;
        ctx.openPopupAtScreen(e.screenX, e.screenY, true, e);
      },
    });
    return node;
  }
  function chipDots() {
    return el(doc, "div", { class: "rigel-spacedots", "data-kind": "dock", role: "tablist", "aria-label": "Alanlar" });
  }
  function renderChip({ node, kind }) {
    const cur = spaceById(active);
    if (kind === "dock") {
      node.replaceChildren(...spaces.map((s, i) => el(doc, "button", {
        class: "rigel-spacedot" + (s.id === active ? " on" : ""), role: "tab", "aria-selected": String(s.id === active),
        title: `${s.name}${i < 9 ? ` (Ctrl+Alt+${i + 1})` : ""}`,
        onclick: () => switchTo(s.id),
        oncontextmenu: e => {
          e.preventDefault();
          ctxSpace = s.id;
          ctx.openPopupAtScreen(e.screenX, e.screenY, true, e);
        },
      }, el(doc, "span", { class: "ico", text: s.icon }))));
      return;
    }
    const kids = [el(doc, "span", { class: "ico", text: cur?.icon ?? "" })];
    if (kind === "komuta" || kind === "klasik") kids.push(el(doc, "span", { class: "name", text: cur?.name ?? "" }));
    node.replaceChildren(...kids);
    node.title = `Alan: ${cur?.name ?? ""} (Ctrl+Alt+1…9)`;
  }
  function placeChip(kind) {
    let node = null;
    let parent = null;
    let before = null;
    if (kind === "ada") {
      parent = doc.querySelector("#rigel-ada .rigel-left");
      before = parent?.querySelector(".rigel-stars") ?? null;
      node = chipButton(kind);
    } else if (kind === "dock") {
      parent = doc.querySelector("#rigel-dock .rigel-dock-body");
      before = parent?.firstChild ?? null;
      node = chipDots();
    } else if (kind === "komuta") {
      parent = doc.getElementById("rigel-komuta");
      before = parent?.querySelector(".rigel-komuta-logo")?.nextSibling ?? null;
      node = chipButton(kind);
    } else if (kind === "klasik") {
      parent = doc.getElementById("nav-bar");
      before = parent?.firstChild ?? null;
      node = chipButton(kind);
    }
    if (!parent || !node) return;
    parent.insertBefore(node, before);
    if (kind === "dock") parent.insertBefore(el(doc, "span", { class: "rigel-vsep rigel-spacesep" }), node.nextSibling);
    const chip = { node, kind };
    chips.add(chip);
    renderChip(chip);
  }
  function unmountChips() {
    for (const { node } of chips) {
      if (node.nextSibling?.classList?.contains("rigel-spacesep")) node.nextSibling.remove();
      node.remove();
    }
    chips.clear();
  }
  d.add(unmountChips);

  function mount() {
    const container = doc.getElementById("sidebar-container");
    const bottom = doc.getElementById("rigel-side-bottom");
    const layout = root.getAttribute("data-rigel-layout");
    if (layout === "yanpanel" && container) {
      if (bottom?.parentNode === container) container.insertBefore(bar, bottom);
      else container.append(bar);
    } else {
      bar.remove();
    }
    unmountChips();
    if (layout && layout !== "yanpanel" && !isPrivate) placeChip(layout);
  }
  d.on(win, "rigel:layout-changed", mount);
  d.add(() => bar.remove());

  // --- İstemler (Rigel iletişim kutuları: shell/dialog.mjs) -----------------------------------
  const dialog = () => getDialog(win);
  async function promptNew() {
    const used = new Set(spaces.map(s => s.icon));
    const r = await dialog().form({
      title: "Yeni alan", okLabel: "Oluştur",
      fields: [
        { key: "name", type: "text", label: "Alanın adı", placeholder: `Alan ${spaces.length + 1}` },
        { key: "icon", type: "pick", label: "Simge", options: ICONS, value: ICONS.find(i => !used.has(i)) ?? ICONS[0] },
      ],
    });
    if (r) create({ name: r.name, icon: r.icon });
  }
  async function promptRename(id = active) {
    const s = spaceById(id);
    if (!s) return;
    const name = await dialog().prompt({
      title: "Alanı yeniden adlandır", label: "Yeni ad", value: s.name, required: true, okLabel: "Kaydet",
    });
    if (name) update(id, { name });
  }
  async function promptIcon(id = active) {
    const s = spaceById(id);
    if (!s) return;
    const icon = await dialog().pick({ title: "Alan simgesi", label: `${s.name} için simge`, options: ICONS, value: s.icon, okLabel: "Kaydet" });
    if (icon) update(id, { icon });
  }

  // --- Komutlar --------------------------------------------------------------------
  let lastIds = [];
  function commandList() {
    const out = [];
    out.push({ id: "zen.space.new", label: "Yeni alan", icon: "plus", run: () => promptNew() });
    spaces.forEach((s, i) => {
      out.push({
        id: `zen.space.go.${s.id}`, label: `Alan: ${s.icon} ${s.name}`, icon: "layout",
        keys: i < 9 ? [`Ctrl+Alt+${i + 1}`] : [], bind: false,
        sub: () => (s.id === active ? "etkin" : ""),
        run: () => switchTo(s.id),
      });
      out.push({
        id: `zen.space.move.${s.id}`, label: `Sekmeyi alana taşı: ${s.icon} ${s.name}`, icon: "tab",
        when: () => s.id !== active && isManaged(gBrowser.selectedTab),
        run: () => moveTab(gBrowser.selectedTab, s.id),
      });
    });
    out.push(
      { id: "zen.space.next", label: "Sonraki alan", icon: "arrow", when: () => spaces.length > 1, run: () => cycle(1) },
      { id: "zen.space.prev", label: "Önceki alan", icon: "back", when: () => spaces.length > 1, run: () => cycle(-1) },
      { id: "zen.space.rename", label: "Alanı yeniden adlandır", icon: "gear", run: () => promptRename() },
      { id: "zen.space.icon", label: "Alanın simgesini değiştir", icon: "gear", run: () => promptIcon() },
      { id: "zen.space.delete", label: "Etkin alanı sil", sub: "sekmeleri ilk alana taşınır", icon: "close", when: () => spaces.length > 1, run: () => remove(active) },
    );
    // Ctrl+Alt+1..9: gizli, yalnız tuş.
    for (let n = 1; n <= 9; n++) {
      out.push({
        id: `zen.space.key${n}`, label: `Alan ${n}`, hidden: true, keys: [`Ctrl+Alt+${n}`], bind: true,
        run: () => spaces[n - 1] && switchTo(spaces[n - 1].id),
      });
    }
    return out;
  }
  function refreshCommands() {
    const list = commandList();
    const ids = new Set(list.map(c => c.id));
    for (const id of lastIds) if (!ids.has(id)) win.Rigel?.commands?.unregister?.(id);
    lastIds = [...ids];
    win.Rigel?.zenRefreshCommands?.();
  }
  function cycle(step) {
    const i = spaces.findIndex(s => s.id === active);
    switchTo(spaces[(i + step + spaces.length) % spaces.length].id);
  }

  // --- Alanın varsayılan kapsayıcısı -----------------------------------------------
  // Ctrl+T ve "+" düğmeleri BrowserCommands.openTab → openTrustedLinkIn(url, "tab") yolundan geçer.
  const origOpen = win.openTrustedLinkIn;
  if (typeof origOpen === "function") {
    win.openTrustedLinkIn = function (url, where, params = {}) {
      try {
        const ctr = spaceById(active)?.container ?? 0;
        const isNewTab = !url || url === win.BROWSER_NEW_TAB_URL || /^about:(newtab|home|blank)$/.test(url);
        if (ctr && where === "tab" && isNewTab && params && params.userContextId == null && !isPrivate) {
          params = { ...params, userContextId: ctr };
        }
      } catch {}
      return origOpen.call(this, url, where, params);
    };
    d.add(() => {
      win.openTrustedLinkIn = origOpen;
    });
  }

  // --- Başlangıç -------------------------------------------------------------------
  if (!Services.prefs.prefHasUserValue(PREF) && !isPrivate) writeSpaces(spaces);
  for (const tab of gBrowser.tabs) syncTab(tab);
  render();
  mount();
  root.setAttribute("data-rigel-space", active);
  if (SessionStore.promiseAllWindowsRestored) {
    SessionStore.promiseAllWindowsRestored.then(() => restore()).catch(() => {});
  }
  d.on(win, "SSWindowRestored", () => win.setTimeout(restore, 0));

  const api = {
    list: () => spaces.map(s => ({ ...s })),
    active: () => active,
    switchTo: id => switchTo(id),
    create,
    rename: (id, name) => update(id, { name }),
    setIcon: (id, icon) => update(id, { icon }),
    setContainer: (id, userContextId) => update(id, { container: Number(userContextId) || 0 }),
    current: () => ({ ...spaceById(active) }),
    remove,
    moveTab,
    moveGroup,
    spaceOf,
  };
  (win.Rigel ??= {}).spaces = api;

  return {
    commands: () => {
      const list = commandList();
      lastIds = list.map(c => c.id);
      return list;
    },
    destroy() {
      d.run();
      if (win.Rigel?.spaces === api) delete win.Rigel.spaces;
    },
  };
}
