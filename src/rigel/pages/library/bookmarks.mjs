// Yer imleri: klasör ağacı + liste, arama, ekle/düzenle/sil/taşı (sürükle-bırak dahil), HTML içe/dışa aktarma.
import { h, icon, favicon, hostOf, fold, whereOf, openUrl, toast, formDialog, pickFile, debounce, iconUrls } from "./ui.mjs";

const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
const B = PlacesUtils.bookmarks;
const ROOT_NAMES = {
  [B.toolbarGuid]: "Yer imleri çubuğu",
  [B.menuGuid]: "Yer imleri menüsü",
  [B.unfiledGuid]: "Diğer yer imleri",
  [B.mobileGuid]: "Mobil yer imleri",
};
const FOLDER = B.TYPE_FOLDER, ITEM = B.TYPE_BOOKMARK, SEP = B.TYPE_SEPARATOR;
const DND = "application/x-rigel-bookmark";

export function mount(root, ctx) {
  let tree = null; // kök düğüm
  const byGuid = new Map();
  const parentOf = new Map();
  let icons = new Set();
  let selected = ctx.param || B.toolbarGuid;
  let query = "";
  const expanded = new Set([B.toolbarGuid, B.menuGuid, B.unfiledGuid]);

  const nameOf = n => ROOT_NAMES[n.guid] ?? (n.title || "(adsız klasör)");
  const isFolder = n => n.typeCode === FOLDER;

  async function loadTree() {
    tree = await PlacesUtils.promiseBookmarksTree(B.rootGuid);
    icons = await iconUrls().catch(() => new Set());
    byGuid.clear();
    parentOf.clear();
    const walk = (n, p) => {
      byGuid.set(n.guid, n);
      if (p) parentOf.set(n.guid, p.guid);
      for (const c of n.children ?? []) walk(c, n);
    };
    walk(tree, null);
    if (!byGuid.has(selected) || !isFolder(byGuid.get(selected))) selected = B.toolbarGuid;
  }

  // ---- İskelet ----
  const search = h("input", { type: "search", placeholder: "Yer imlerinde ara", spellcheck: "false", "aria-label": "Yer imlerinde ara" });
  const treeEl = h("div", { class: "tree", role: "tree", "aria-label": "Klasörler" });
  const title = h("h2");
  const sub = h("p");
  const listEl = h("div", { class: "blist" });
  const empty = h("div", { class: "empty", hidden: true });
  const addBm = h("button", { class: "btn", onclick: () => addDialog(false) }, icon("plus", 15), "Yer imi ekle");
  const addFd = h("button", { class: "btn soft", onclick: () => addDialog(true) }, icon("folderPlus", 15), "Klasör ekle");
  const imp = h("button", { class: "btn soft", title: "HTML dosyasından içe aktar", onclick: importHtml }, icon("import", 15), "İçe aktar");
  const exp = h("button", { class: "btn soft", title: "HTML dosyasına dışa aktar", onclick: exportHtml }, icon("export", 15), "Dışa aktar");
  root.append(
    h("header", { class: "phead" }, h("div", { class: "ptitle" }, title, sub), h("div", { class: "tools" }, imp, exp, addFd, addBm)),
    h("label", { class: "search" }, icon("search", 15), search),
    h("div", { class: "split" }, h("aside", { class: "card treecard" }, treeEl), h("section", { class: "card listcard" }, listEl, empty)));

  // ---- Ağaç ----
  function treeRow(n, depth) {
    const kids = (n.children ?? []).filter(isFolder);
    const open = expanded.has(n.guid);
    const row = h("div", { class: "trow" + (n.guid === selected && !query ? " on" : ""), role: "treeitem", style: `--d:${depth}`, "aria-selected": String(n.guid === selected) },
      h("button", { class: "twist" + (kids.length ? "" : " none") + (open ? " open" : ""), tabindex: "-1", "aria-label": open ? "Daralt" : "Genişlet",
        onclick: e => { e.stopPropagation(); open ? expanded.delete(n.guid) : expanded.add(n.guid); drawTree(); } }, icon("chevron", 12)),
      icon(open && kids.length ? "folder" : "folder", 16),
      h("span", { class: "n", text: nameOf(n) }),
      h("span", { class: "c", text: String((n.children ?? []).filter(c => c.typeCode !== SEP).length) }));
    row.addEventListener("click", () => selectFolder(n.guid));
    dropTarget(row, n.guid);
    const out = [row];
    if (open) for (const k of kids) out.push(...treeRow(k, depth + 1));
    return out;
  }
  function drawTree() {
    const roots = (tree.children ?? []).filter(r => r.guid !== B.mobileGuid || r.children?.length);
    treeEl.replaceChildren(...roots.flatMap(r => treeRow(r, 0)));
  }

  function selectFolder(guid) {
    selected = guid;
    if (search.value) { search.value = ""; query = ""; }
    // Üst klasörleri aç
    for (let g = parentOf.get(guid); g; g = parentOf.get(g)) expanded.add(g);
    history.replaceState(null, "", "#yer-imleri/" + encodeURIComponent(guid));
    draw();
  }

  // ---- Liste ----
  function pathOf(guid) {
    const names = [];
    for (let g = parentOf.get(guid); g && g !== B.rootGuid; g = parentOf.get(g)) names.unshift(nameOf(byGuid.get(g)));
    return names.join(" › ");
  }

  function rowOf(n, withPath) {
    const folder = isFolder(n);
    const label = n.title || (folder ? "(adsız klasör)" : n.uri);
    const main = folder
      ? h("button", { class: "link", title: "Klasörü aç" }, h("span", { class: "fav" }, icon("folder", 18)), h("span", { class: "t", text: label }),
          h("span", { class: "h", text: `${(n.children ?? []).filter(c => c.typeCode !== SEP).length} öğe` }))
      : h("a", { class: "link", href: n.uri, title: n.uri }, favicon(n.uri, n.title, 18, icons.has(n.uri)), h("span", { class: "t", text: label }),
          h("span", { class: "h", text: withPath ? pathOf(n.guid) : hostOf(n.uri) }));
    if (folder) main.addEventListener("click", () => selectFolder(n.guid));
    else {
      main.addEventListener("click", e => { e.preventDefault(); openUrl(n.uri, whereOf(e)); });
      main.addEventListener("auxclick", e => { if (e.button === 1) { e.preventDefault(); openUrl(n.uri, "tabshifted"); } });
    }
    const row = h("div", { class: "lrow", draggable: "true" }, main,
      !folder && h("button", { class: "act", title: "Yeni sekmede aç", "aria-label": "Yeni sekmede aç", onclick: () => openUrl(n.uri, "tab") }, icon("tabPlus", 16)),
      h("button", { class: "act", title: "Düzenle", "aria-label": "Düzenle", onclick: () => editDialog(n) }, icon("edit", 15)),
      h("button", { class: "act del", title: "Sil", "aria-label": "Sil", onclick: () => removeNode(n) }, icon("trash", 15)));
    row.addEventListener("dragstart", e => { e.dataTransfer.setData(DND, n.guid); e.dataTransfer.effectAllowed = "move"; row.classList.add("drag"); });
    row.addEventListener("dragend", () => row.classList.remove("drag"));
    if (folder) dropTarget(row, n.guid);
    return row;
  }

  function draw() {
    drawTree();
    const cur = byGuid.get(selected);
    let nodes;
    if (query) {
      const needle = fold(query);
      nodes = [...byGuid.values()].filter(n => n.typeCode === ITEM && fold(`${n.title} ${n.uri}`).includes(needle));
      title.textContent = "Yer imleri";
      sub.textContent = `"${query}" için ${nodes.length} sonuç`;
      ctx.setTitle("Yer imleri");
    } else {
      nodes = (cur.children ?? []).filter(c => c.typeCode !== SEP);
      title.textContent = nameOf(cur);
      sub.textContent = parentOf.get(cur.guid) === B.rootGuid ? "Yer imlerini ara, düzenle, klasörler arasında sürükle." : pathOf(cur.guid) || " ";
      ctx.setTitle(nameOf(cur) + " · Yer imleri");
    }
    document.title = (query ? "Yer imleri" : `${nameOf(cur)} · Yer imleri`) + " · Kitaplık";
    addBm.hidden = addFd.hidden = !!query;
    listEl.replaceChildren(...nodes.map(n => rowOf(n, !!query)));
    empty.hidden = nodes.length > 0;
    if (!empty.hidden) empty.replaceChildren(icon("star", 34), query ? "Eşleşen yer imi yok." : "Bu klasör boş. Bir sayfada Ctrl+D'ye bas ya da “Yer imi ekle”yi kullan.");
  }

  // ---- Sürükle-bırak ----
  function dropTarget(el, guid) {
    el.addEventListener("dragover", e => {
      if (!e.dataTransfer.types.includes(DND)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.classList.add("drop");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drop"));
    el.addEventListener("drop", async e => {
      el.classList.remove("drop");
      const g = e.dataTransfer.getData(DND);
      if (!g) return;
      e.preventDefault();
      e.stopPropagation();
      if (g === guid || parentOf.get(g) === guid) return;
      try {
        await B.update({ guid: g, parentGuid: guid, index: B.DEFAULT_INDEX });
        toast(`“${byGuid.get(g)?.title || "Öğe"}” taşındı: ${nameOf(byGuid.get(guid))}`);
      } catch (err) {
        toast("Taşınamadı: " + (err.message ?? err), { error: true });
      }
    });
  }

  // ---- İşlemler ----
  /** Klasör seçeneği listesi (girintili). exclude: bu klasör ve altı çıkarılır. */
  function folderOptions(exclude) {
    const out = [];
    const walk = (n, d) => {
      if (n.guid === exclude) return;
      if (n.guid !== B.rootGuid && (n.guid !== B.mobileGuid || n.children?.length)) {
        out.push({ value: n.guid, label: " ".repeat(d) + nameOf(n) });
      }
      for (const c of n.children ?? []) if (isFolder(c)) walk(c, n.guid === B.rootGuid ? 0 : d + 1);
    };
    walk(tree, 0);
    return out;
  }
  const urlCheck = v => {
    try { const u = new URL(v); return /^(https?|ftp|file|about|chrome|moz-extension):/.test(u.protocol) ? "" : "Geçerli bir adres gir."; } catch { return "Geçerli bir adres gir (https://…)."; }
  };

  async function addDialog(folder) {
    const r = await formDialog({
      title: folder ? "Yeni klasör" : "Yeni yer imi",
      confirm: "Ekle",
      fields: [
        { name: "title", label: "Ad", required: folder, value: "" },
        !folder && { name: "url", label: "Adres", type: "url", required: true, value: "https://", validate: urlCheck },
        { name: "parent", label: "Klasör", type: "select", options: folderOptions(), value: selected },
      ].filter(Boolean),
    });
    if (!r) return;
    try {
      if (folder) await B.insert({ parentGuid: r.parent, type: FOLDER, title: r.title });
      else await B.insert({ parentGuid: r.parent, url: r.url, title: r.title || r.url });
      toast(folder ? "Klasör eklendi" : "Yer imi eklendi");
    } catch (e) {
      toast("Eklenemedi: " + (e.message ?? e), { error: true });
    }
  }

  async function editDialog(n) {
    const folder = isFolder(n);
    const r = await formDialog({
      title: folder ? "Klasörü düzenle" : "Yer imini düzenle",
      fields: [
        { name: "title", label: "Ad", value: n.title ?? "", required: folder },
        !folder && { name: "url", label: "Adres", type: "url", required: true, value: n.uri, validate: urlCheck },
        { name: "parent", label: "Klasör", type: "select", options: folderOptions(folder ? n.guid : null), value: parentOf.get(n.guid) },
      ].filter(Boolean),
    });
    if (!r) return;
    try {
      const upd = { guid: n.guid, title: r.title };
      if (!folder) { upd.title = r.title || r.url; upd.url = r.url; }
      if (r.parent !== parentOf.get(n.guid)) { upd.parentGuid = r.parent; upd.index = B.DEFAULT_INDEX; }
      await B.update(upd);
    } catch (e) {
      toast("Kaydedilemedi: " + (e.message ?? e), { error: true });
    }
  }

  const snapshot = n => isFolder(n)
    ? { type: FOLDER, title: n.title, children: (n.children ?? []).map(snapshot) }
    : n.typeCode === SEP ? { type: SEP } : { url: n.uri, title: n.title, dateAdded: new Date(n.dateAdded / 1000) };

  async function removeNode(n) {
    const parent = parentOf.get(n.guid);
    const snap = snapshot(n);
    const label = n.title || n.uri || "Öğe";
    try {
      await B.remove(n.guid);
    } catch (e) {
      toast("Silinemedi: " + (e.message ?? e), { error: true });
      return;
    }
    toast(`“${label}” silindi`, {
      action: "Geri al",
      onAction: async () => {
        try { await PlacesUtils.bookmarks.insertTree({ guid: parent, children: [snap] }); } catch (e) { toast("Geri alınamadı: " + (e.message ?? e), { error: true }); }
      },
    });
  }

  async function importHtml() {
    const path = await pickFile({ title: "Yer imlerini içe aktar", mode: "open" });
    if (!path) return;
    try {
      const { BookmarkHTMLUtils } = ChromeUtils.importESModule("resource://gre/modules/BookmarkHTMLUtils.sys.mjs");
      const n = await BookmarkHTMLUtils.importFromFile(path, { replace: false });
      toast(`${n ?? 0} öğe içe aktarıldı`);
    } catch (e) {
      toast("İçe aktarılamadı: " + (e.message ?? e), { error: true });
    }
  }
  async function exportHtml() {
    const path = await pickFile({ title: "Yer imlerini dışa aktar", mode: "save", defaultName: "yer-imleri.html" });
    if (!path) return;
    try {
      const { BookmarkHTMLUtils } = ChromeUtils.importESModule("resource://gre/modules/BookmarkHTMLUtils.sys.mjs");
      const n = await BookmarkHTMLUtils.exportToFile(path);
      toast(`${n ?? ""} yer imi dışa aktarıldı`.trim());
    } catch (e) {
      toast("Dışa aktarılamadı: " + (e.message ?? e), { error: true });
    }
  }

  // ---- Olaylar ----
  search.addEventListener("input", debounce(() => { query = search.value.trim(); draw(); }, 120));
  search.addEventListener("keydown", e => { if (e.key === "Escape" && search.value) { search.value = ""; query = ""; draw(); } });
  const onKey = e => {
    if ((e.ctrlKey && e.key === "f") || (e.key === "/" && !/^(input|select|textarea)$/i.test(e.target.tagName))) { e.preventDefault(); search.focus(); }
  };
  addEventListener("keydown", onKey);

  const refresh = debounce(async () => { try { await loadTree(); draw(); } catch (e) { console.error("[rigel-library] yer imleri", e); } }, 120);
  const events = ["bookmark-added", "bookmark-removed", "bookmark-moved", "bookmark-title-changed", "bookmark-url-changed"];
  const listener = () => refresh();
  PlacesUtils.observers.addListener(events, listener);

  loadTree().then(draw).catch(e => { console.error("[rigel-library] yer imleri", e); listEl.replaceChildren(h("p", { class: "hint", text: "Yer imleri okunamadı: " + e })); });
  return {
    setParam(p) { if (p && byGuid.has(p)) { selected = p; query = ""; search.value = ""; draw(); } },
    dispose() {
      PlacesUtils.observers.removeListener(events, listener);
      removeEventListener("keydown", onKey);
    },
  };
}
