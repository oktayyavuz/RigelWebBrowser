// Sekme grupları: Firefox'un yerel sekme grupları. Burada yönetim var: Rigel grup düzenleyicisi (ad, renk, alan),
// grup menüsü, sekme bağlam menüsü öğeleri, palet komutları, tercihler. Görünüm: Ada/Dock/Komuta/çekmece kendi
// çiplerini çizer (shell/common.mjs groupChip, drawers/tabs.mjs); Yan Panel ve Klasik'te Firefox'un kendi şeridi
// (zen/zen.css). Alanlarla uyum (grup tek alanda yaşar) zen/spaces.mjs'te.
//
// Gruplar kalıcıdır: "Grubu kapat" grubu Firefox'un saklanan gruplarına (SessionStore.savedGroups) koyar, son
// sekmesi kapanan grup da kendiliğinden saklanır. Saklananlar "Gruplar" menüsünden ve paletten geri açılır.
//
// API: Rigel.groups = { colors, list, create, edit, addTo, removeFrom, toggle, collapse, ungroup, close, remove,
//                       moveToSpace, menu(olay, grup), addMenu(olay, sekmeler), saved(), openSaved(id),
//                       forgetSaved(id), savedMenu(olay), nativeStrip }
// Tercihler: rigel.groups.showLabels (varsayılan true), rigel.groups.collapseOnSwitch (varsayılan false).

import { toast } from "./util.mjs";
import { GROUP_COLORS, GROUP_PREFS, el, groupName, icon } from "../shell/common.mjs";
import { getDialog } from "../shell/dialog.mjs";

const NATIVE_ITEMS = ["context_moveTabToNewGroup", "context_moveTabToGroup", "context_ungroupTab",
  "context_moveSplitViewToNewGroup", "context_ungroupSplitView"];

export function init(win) {
  const doc = win.document;
  const root = doc.documentElement;
  const { gBrowser } = win;
  const listeners = [];
  const on = (t, type, fn, opts) => {
    t.addEventListener(type, fn, opts);
    listeners.push(() => t.removeEventListener(type, fn, opts));
  };
  const P = Services.prefs;
  const def = P.getDefaultBranch("");
  def.setBoolPref(GROUP_PREFS.labels, true);
  def.setBoolPref(GROUP_PREFS.collapseOnSwitch, false);

  const groups = () => (gBrowser.tabGroups ?? []).filter(g => !g.hidden);
  const sel = () => gBrowser.selectedTab;
  const spaces = () => win.Rigel?.spaces;
  const groupable = () => {
    const tabs = gBrowser.selectedTabs?.length ? gBrowser.selectedTabs : [sel()];
    return tabs.filter(t => t && !t.pinned && !t.hidden && !t.closing);
  };
  const changed = () => win.dispatchEvent(new win.CustomEvent("rigel:groups-changed"));
  const dlg = () => win.Rigel?.dialog ?? getDialog(win);
  const colorLabel = id => GROUP_COLORS.find(c => c.id === id)?.label ?? id;

  // Yerel sekme şeridi görünüyor mu? (Yan Panel, Klasik; kompakt modda gizli.) Görünüyorsa Firefox'un kendi
  // bağlam menüsü öğeleri ve grup başlığı çalışır; değilse Rigel'inkiler kullanılır.
  const stripVisible = () => {
    const layout = root.getAttribute("data-rigel-layout");
    return (layout === "yanpanel" || layout === "klasik") && !root.hasAttribute("data-rigel-compact");
  };

  // --- Düzenleyici -------------------------------------------------------------------
  const colorField = value => ({
    key: "color", type: "pick", label: "Renk", value, columns: GROUP_COLORS.length, custom: false,
    options: GROUP_COLORS.map(c => ({ value: c.id, label: "", title: c.label })),
  });
  const nextColor = () => {
    const used = new Set((gBrowser.tabGroups ?? []).map(g => g.color));
    return (GROUP_COLORS.find(c => !used.has(c.id)) ?? GROUP_COLORS[(gBrowser.tabGroups?.length ?? 0) % GROUP_COLORS.length]).id;
  };

  async function newGroup(tabs = groupable()) {
    tabs = tabs.filter(t => !t.pinned && !t.closing);
    if (!tabs.length) {
      toast(win, "Sabitlenmiş sekme gruplanamaz");
      return null;
    }
    const r = await dlg().form({
      title: "Yeni grup", okLabel: "Oluştur",
      message: tabs.length > 1 ? `${tabs.length} sekme gruplanacak` : undefined,
      fields: [
        { key: "name", type: "text", label: "Ad", placeholder: "ör. İş, Okuma listesi" },
        colorField(nextColor()),
      ],
    });
    if (!r) return null;
    // Kutu açıkken sekmeler değişmiş olabilir.
    const live = tabs.filter(t => t.isConnected && !t.closing && !t.pinned);
    if (!live.length) return null;
    const g = gBrowser.addTabGroup(live, { insertBefore: live[0], label: r.name, color: r.color });
    changed();
    return g;
  }

  const spaceOfGroup = g => {
    const t = (g.tabs ?? []).find(x => !x.pinned);
    return t ? spaces()?.spaceOf?.(t) ?? "" : "";
  };

  async function editGroup(group = sel()?.group) {
    if (!group?.isConnected) return false;
    const list = spaces()?.list?.() ?? [];
    const fields = [
      { key: "name", type: "text", label: "Ad", value: group.label ?? "", placeholder: "Grup adı" },
      colorField(group.color),
    ];
    const curSpace = spaceOfGroup(group);
    if (list.length > 1) {
      fields.push({
        key: "space", type: "pick", label: "Alan", value: curSpace || list[0].id, columns: Math.min(list.length, 8),
        custom: false, options: list.map(s => ({ value: s.id, label: s.icon, title: s.name })),
      });
    }
    const r = await dlg().form({ title: "Grubu düzenle", okLabel: "Kaydet", fields });
    if (!r || !group.isConnected) return false;
    if (r.name !== (group.label ?? "")) group.label = r.name;
    if (r.color && r.color !== group.color) group.color = r.color;
    if (r.space && curSpace && r.space !== curSpace) spaces()?.moveGroup?.(group, r.space);
    changed();
    return true;
  }

  // --- Eylemler ----------------------------------------------------------------------
  function addTo(group, tabs = groupable()) {
    tabs = tabs.filter(t => t.group !== group && !t.pinned && !t.closing);
    for (const t of tabs) gBrowser.moveTabToExistingGroup(t, group);
    if (tabs.length) toast(win, `Gruba eklendi: ${groupName(group)}`);
    changed();
  }
  function removeFrom(tabs = groupable()) {
    for (const t of tabs) if (t.group) gBrowser.ungroupTab(t);
    changed();
  }
  function collapse(group, value) {
    if (!group?.isConnected) return;
    group.collapsed = value;
    changed();
  }
  const toggle = group => collapse(group, !group.collapsed);
  function ungroup(group) {
    if (!group?.isConnected) return;
    if (typeof group.ungroupTabs === "function") group.ungroupTabs();
    else for (const t of [...group.tabs]) gBrowser.ungroupTab(t);
    changed();
  }
  // --- Saklanan gruplar --------------------------------------------------------------
  const SS = () => win.SessionStore;
  const privateWin = win.PrivateBrowsingUtils?.isWindowPrivate?.(win) ?? root.hasAttribute("privatebrowsingmode");
  const saved = () => (privateWin ? [] : [...(SS()?.savedGroups ?? [])].sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)));
  const isSaved = id => saved().some(g => g.id === id);
  const deleting = new WeakSet();
  function saveGroup(group) {
    if (privateWin || !group?.isConnected || isSaved(group.id)) return false;
    try {
      group.save();
      return true;
    } catch (e) {
      console.error("Rigel: grup saklanamadı", e);
      return false;
    }
  }
  function openSaved(id) {
    try {
      const g = SS().openSavedTabGroup(id, win);
      g?.tabs?.[0] && (gBrowser.selectedTab = g.tabs[0]);
    } catch (e) {
      console.error("Rigel: saklanan grup açılamadı", e);
    }
    later();
    changed();
  }
  function forgetSaved(id) {
    try { SS().forgetSavedTabGroup(id); } catch {}
    later();
    changed();
  }

  /** Grubu kapatır ama silmez: Gruplar menüsünden geri açılır. Gizli pencerede saklanamaz, düz kapatılır. */
  function closeGroup(group) {
    if (!group?.isConnected) return;
    if (privateWin) return removeGroup(group);
    const name = groupName(group);
    if (typeof group.saveAndClose === "function") group.saveAndClose();
    else {
      saveGroup(group);
      gBrowser.removeTabGroup(group, { animate: true });
    }
    toast(win, `Grup saklandı: ${name}. Gruplar menüsünden geri açabilirsin.`);
    later();
    changed();
  }
  /** Grubu ve sekmelerini kalıcı olarak kapatır (saklanmaz). */
  async function removeGroup(group) {
    if (!group?.isConnected) return;
    const n = group.tabs?.length ?? 0;
    if (n > 1) {
      const ok = await dlg().confirm({
        title: "Grubu sil", danger: true, okLabel: "Sil",
        message: `"${groupName(group)}" grubu ve içindeki ${n} sekme kapatılacak; grup saklanmayacak.`,
      });
      if (!ok || !group.isConnected) return;
    }
    deleting.add(group);
    gBrowser.removeTabGroup(group, { animate: true });
    changed();
  }

  // Son sekmesi kapanan grup kaybolmasın: kapanmadan hemen önce saklanır. (Başka pencereye taşınan sekme hariç.)
  on(gBrowser.tabContainer, "TabClose", e => {
    const group = e.target.group;
    if (!group || deleting.has(group) || e.detail?.adoptedBy || win.closed || win.gBrowser?._windowIsClosing) return;
    const left = (group.tabs ?? []).filter(t => t !== e.target && !t.closing);
    if (!left.length && saveGroup(group)) {
      toast(win, `Grup saklandı: ${groupName(group)}. Gruplar menüsünden geri açabilirsin.`);
      later();
      win.setTimeout(changed, 0);
    }
  });
  function moveToSpace(group, id) {
    spaces()?.moveGroup?.(group, id);
    changed();
  }

  // --- Menüler -----------------------------------------------------------------------
  let menuEl = null;
  function closeMenu() {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    win.removeEventListener("mousedown", onOutside, true);
    win.removeEventListener("keydown", onMenuKey, true);
    win.removeEventListener("blur", closeMenu);
  }
  function onOutside(e) {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
  }
  function onMenuKey(e) {
    if (menuEl && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    }
  }
  const anchorOf = e => {
    if (e?.type === "contextmenu" && e.clientX) return { x: e.clientX, y: e.clientY, top: e.clientY };
    const r = (e?.currentTarget ?? e?.target)?.getBoundingClientRect?.();
    return r ? { x: r.left, y: r.bottom + 4, top: r.top } : { x: e?.clientX ?? 20, y: e?.clientY ?? 60, top: e?.clientY ?? 60 };
  };
  /** items: { label, icon, run, danger, hint, color } | { sep: true } | { header: "metin", color } */
  function popMenu(event, items) {
    closeMenu();
    const anchor = anchorOf(event);
    const m = el(doc, "div", { class: "rgl-menu rgl-gmenu", role: "menu" });
    for (const it of items) {
      if (it.sep) {
        m.append(el(doc, "span", { class: "sep" }));
      } else if (it.header) {
        m.append(el(doc, "div", { class: "ghd", "data-rigel-group": it.color || "" },
          el(doc, "span", { class: "gdot" }), el(doc, "span", { class: "l", text: it.header })));
      } else {
        m.append(el(doc, "button", {
          role: "menuitem", class: it.danger ? "danger" : "",
          onclick: e => {
            e.stopPropagation();
            closeMenu();
            it.run();
          },
        }, it.color
          ? el(doc, "span", { class: "gdot", "data-rigel-group": it.color })
          : icon(doc, it.icon ?? "blank", 15),
        el(doc, "span", { class: "l", text: it.label }), it.hint ? el(doc, "kbd", { text: it.hint }) : null));
      }
    }
    root.append(m);
    menuEl = m;
    const r = m.getBoundingClientRect();
    let y = anchor.y;
    if (y + r.height > win.innerHeight - 6) y = Math.max(6, anchor.top - r.height - 4);
    m.style.left = `${Math.max(6, Math.min(anchor.x, win.innerWidth - r.width - 6))}px`;
    m.style.top = `${Math.max(6, y)}px`;
    win.addEventListener("mousedown", onOutside, true);
    win.addEventListener("keydown", onMenuKey, true);
    win.addEventListener("blur", closeMenu);
  }

  /** Grup yönetim menüsü (çip/başlık tıklaması). */
  function groupMenu(event, group) {
    if (!group?.isConnected) return;
    const n = (group.tabs ?? []).length;
    const addable = groupable().filter(t => t.group !== group);
    const items = [{ header: `${groupName(group)} · ${n} sekme`, color: group.color }];
    items.push({ label: "Düzenle…", icon: "edit", run: () => editGroup(group) });
    items.push({
      label: group.collapsed ? "Genişlet" : "Daralt", icon: "chevron",
      run: () => toggle(group),
    });
    if (addable.length) {
      items.push({
        label: addable.length > 1 ? `${addable.length} seçili sekmeyi ekle` : "Etkin sekmeyi gruba ekle",
        icon: "plus", run: () => addTo(group, addable),
      });
    }
    items.push({ sep: true });
    items.push({ label: "Grubu dağıt", icon: "ungroup", run: () => ungroup(group) });
    items.push({ label: privateWin ? "Grubu kapat" : "Grubu kapat ve sakla", icon: "close", run: () => closeGroup(group) });
    items.push({ label: "Grubu sil", icon: "close", danger: true, run: () => removeGroup(group) });
    popMenu(event, items);
  }

  /** Gruplar menüsü: açık gruplar (tıkla: geç) ve saklanan gruplar (tıkla: geri aç). */
  function savedMenu(event) {
    const open = groups();
    const kept = saved();
    const items = [];
    if (open.length) {
      items.push({ header: "Açık gruplar" });
      for (const g of open) {
        items.push({
          label: groupName(g), color: g.color || "gray", hint: `${g.tabs?.length ?? 0} sekme`,
          run: () => {
            if (g.collapsed) g.collapsed = false;
            const t = g.tabs?.find(x => !x.hidden) ?? g.tabs?.[0];
            if (t) gBrowser.selectedTab = t;
          },
        });
      }
    }
    if (kept.length) {
      if (items.length) items.push({ sep: true });
      items.push({ header: "Saklanan gruplar" });
      for (const g of kept) {
        items.push({ label: g.name || "Adsız grup", color: g.color || "gray", hint: `${g.tabs?.length ?? 0} sekme · aç`, run: () => openSaved(g.id) });
      }
      items.push({ sep: true });
      items.push({ label: "Saklanan bir grubu sil…", icon: "close", danger: true, run: () => forgetMenu(event) });
    }
    if (!items.length) items.push({ header: "Henüz grup yok" });
    popMenu(event, items);
  }
  function forgetMenu(event) {
    const items = [{ header: "Kalıcı olarak silinecek grubu seç" }];
    for (const g of saved()) items.push({ label: g.name || "Adsız grup", color: g.color || "gray", danger: true, run: () => forgetSaved(g.id) });
    popMenu(event, items);
  }

  /** "Gruba ekle" listesi: yeni grup + mevcut gruplar. */
  function addMenu(event, tabs = groupable()) {
    const items = [{ label: "Yeni grup…", icon: "plus", run: () => newGroup(tabs) }];
    const targets = groups().filter(g => tabs.some(t => t.group !== g));
    if (targets.length) items.push({ sep: true });
    for (const g of targets) items.push({ label: groupName(g), color: g.color || "gray", run: () => addTo(g, tabs) });
    popMenu(event, items);
  }

  // --- Sekme bağlam menüsü (#tabContextMenu): Ada/Dock/Komuta/çekmecede Firefox'un grup öğeleri yerine ----
  const xul = (tag, attrs = {}) => {
    const e = doc.createXULElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const dotUri = hex => "data:image/svg+xml," +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="5.5" fill="${hex}"/></svg>`);
  let ctxTabs = [];
  const ctxMenu = doc.getElementById("tabContextMenu");
  if (ctxMenu) {
    const addItem = xul("menu", { id: "rigel-tabctx-group", label: "Gruba ekle" });
    const addPopup = xul("menupopup", { id: "rigel-tabctx-group-popup" });
    addItem.append(addPopup);
    const outItem = xul("menuitem", { id: "rigel-tabctx-ungroup", label: "Gruptan çıkar" });
    const editItem = xul("menuitem", { id: "rigel-tabctx-groupedit", label: "Grubu düzenle…" });
    const anchor = doc.getElementById("context_moveTabOptions") ?? ctxMenu.firstElementChild;
    anchor?.after(editItem, outItem, addItem);
    listeners.push(() => {
      addItem.remove();
      outItem.remove();
      editItem.remove();
    });
    outItem.addEventListener("command", () => removeFrom(ctxTabs));
    editItem.addEventListener("command", () => editGroup(ctxTabs[0]?.group));
    on(ctxMenu, "popupshowing", e => {
      if (e.target !== ctxMenu) return;
      const t = win.TabContextMenu?.contextTab;
      ctxTabs = !t ? [] : t.multiselected ? [...gBrowser.selectedTabs] : [t];
      const strip = stripVisible();
      for (const id of NATIVE_ITEMS) doc.getElementById(id)?.toggleAttribute("rigel-hide", !strip);
      const ok = !strip && ctxTabs.length > 0;
      addItem.hidden = !ok || ctxTabs.some(x => x.pinned);
      outItem.hidden = !ok || !ctxTabs.some(x => x.group);
      editItem.hidden = !ok || !ctxTabs[0]?.group;
    });
    on(addPopup, "popupshowing", e => {
      if (e.target !== addPopup) return;
      addPopup.replaceChildren();
      const neu = xul("menuitem", { label: "Yeni grup…" });
      neu.addEventListener("command", () => newGroup(ctxTabs));
      addPopup.append(neu);
      const targets = groups().filter(g => ctxTabs.some(t => t.group !== g));
      if (targets.length) addPopup.append(xul("menuseparator"));
      for (const g of targets) {
        const hex = GROUP_COLORS.find(c => c.id === g.color)?.hex ?? "#8d96a8";
        const it = xul("menuitem", { label: groupName(g), class: "menuitem-iconic", image: dotUri(hex) });
        it.addEventListener("command", () => addTo(g, ctxTabs));
        addPopup.append(it);
      }
    });
  }

  // --- Tercih: sekme seçilince diğer grupları daralt ----------------------------------------
  on(gBrowser.tabContainer, "TabSelect", () => {
    if (!P.getBoolPref(GROUP_PREFS.collapseOnSwitch, false)) return;
    const g = sel()?.group;
    if (!g) return;
    if (g.collapsed) g.collapsed = false;
    for (const o of groups()) if (o !== g && !o.collapsed) o.collapsed = true;
  });

  // --- Palet komutları -------------------------------------------------------------------
  const flip = (pref, dflt) => P.setBoolPref(pref, !P.getBoolPref(pref, dflt));
  let lastIds = [];
  function commandList() {
    const out = [
      { id: "zen.group.new", label: "Yeni grup", sub: "seçili sekmelerle", icon: "folder", when: () => groupable().length > 0, run: () => newGroup() },
      { id: "zen.group.edit", label: "Grubu düzenle", sub: "ad, renk, alan", icon: "folder", when: () => !!sel()?.group, run: () => editGroup(sel()?.group) },
      {
        id: "zen.group.ungroup", label: "Sekmeyi gruptan çıkar", icon: "folder",
        when: () => !!sel()?.group, run: () => removeFrom([sel()]),
      },
      {
        id: "zen.group.collapse",
        label: () => (sel()?.group?.collapsed ? "Grubu genişlet" : "Grubu daralt"), icon: "folder",
        when: () => !!sel()?.group, run: () => toggle(sel()?.group),
      },
      { id: "zen.group.ungroupAll", label: "Grubu dağıt", sub: "sekmeler açık kalır", icon: "folder", when: () => !!sel()?.group, run: () => ungroup(sel()?.group) },
      { id: "zen.group.close", label: "Grubu kapat ve sakla", sub: "sonra Gruplar'dan geri açılır", icon: "folder", when: () => !!sel()?.group, run: () => closeGroup(sel()?.group) },
      { id: "zen.group.delete", label: "Grubu sil", sub: "sekmeleri kapatır, saklamaz", icon: "folder", when: () => !!sel()?.group, run: () => removeGroup(sel()?.group) },
      { id: "zen.group.menu", label: "Gruplar", sub: "açık ve saklanan gruplar", icon: "folder", run: () => savedMenu(null) },
      {
        id: "zen.group.collapseAll", label: "Tüm grupları daralt", icon: "folder",
        when: () => groups().some(g => !g.collapsed), run: () => groups().forEach(g => collapse(g, true)),
      },
      {
        id: "zen.group.expandAll", label: "Tüm grupları genişlet", icon: "folder",
        when: () => groups().some(g => g.collapsed), run: () => groups().forEach(g => collapse(g, false)),
      },
      {
        id: "zen.group.labels",
        label: () => (P.getBoolPref(GROUP_PREFS.labels, true) ? "Grup adlarını gizle" : "Grup adlarını göster"),
        sub: "Ada, Dock, Komuta, sekme paneli", icon: "folder", run: () => flip(GROUP_PREFS.labels, true),
      },
      {
        id: "zen.group.collapseOnSwitch",
        label: () => (P.getBoolPref(GROUP_PREFS.collapseOnSwitch, false) ? "Diğer grupları kendiliğinden daraltmayı kapat" : "Sekme seçince diğer grupları daralt"),
        icon: "folder", run: () => flip(GROUP_PREFS.collapseOnSwitch, false),
      },
    ];
    for (const g of saved()) {
      out.push({
        id: `zen.group.saved.${g.id}`,
        label: `Saklanan grubu aç: ${g.name || "Adsız grup"}`, sub: `${g.tabs?.length ?? 0} sekme`, icon: "folder",
        when: () => isSaved(g.id), run: () => openSaved(g.id),
      });
    }
    for (const g of gBrowser.tabGroups ?? []) {
      const live = () => g.isConnected && !g.hidden;
      out.push({
        id: `zen.group.add.${g.id}`,
        label: () => `Sekmeleri gruba ekle: ${groupName(g)}`, icon: "folder",
        when: () => live() && groupable().some(t => t.group !== g),
        run: () => addTo(g),
      });
      out.push({
        id: `zen.group.edit.${g.id}`,
        label: () => `Grubu düzenle: ${groupName(g)}`, icon: "folder", when: live, run: () => editGroup(g),
      });
      out.push({
        id: `zen.group.toggle.${g.id}`,
        label: () => `${g.collapsed ? "Genişlet" : "Daralt"}: ${groupName(g)}`, icon: "folder", when: live, run: () => toggle(g),
      });
    }
    return out;
  }
  function refresh() {
    const list = commandList();
    const ids = new Set(list.map(c => c.id));
    for (const id of lastIds) if (!ids.has(id)) win.Rigel?.commands?.unregister?.(id);
    lastIds = [...ids];
    win.Rigel?.zenRefreshCommands?.();
  }
  let queued = false;
  const later = () => {
    if (queued) return;
    queued = true;
    win.setTimeout(() => {
      queued = false;
      refresh();
    }, 50);
  };
  for (const ev of ["TabGroupCreate", "TabGroupRemoved", "TabGroupSaved"]) on(win, ev, later);

  win.Rigel ??= {};
  const api = {
    colors: GROUP_COLORS, list: () => groups(), create: newGroup, edit: editGroup, addTo, removeFrom, toggle, collapse,
    ungroup, close: closeGroup, remove: removeGroup, moveToSpace, menu: groupMenu, addMenu, nativeStrip: stripVisible, changed,
    saved, openSaved, forgetSaved, savedMenu,
  };
  win.Rigel.groups = api;

  return {
    commands: () => {
      const list = commandList();
      lastIds = list.map(c => c.id);
      return list;
    },
    destroy() {
      closeMenu();
      for (const off of listeners.splice(0)) off();
      if (win.Rigel?.groups === api) delete win.Rigel.groups;
    },
  };
}
