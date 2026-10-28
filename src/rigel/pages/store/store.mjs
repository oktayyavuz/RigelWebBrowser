// Mod mağazası: katalog (yerleşik + uzak), arama, etiket süzgeçleri, kart ızgarası, ayrıntı paneli,
// kur / güncelle / kaldır ve "bağlantıdan kur". Yönetici: mods/manager.sys.mjs, katalog: mods/store.sys.mjs.
import { h, icon, logo, watch, onDispose, toggle, notify, chromeWin } from "../settings/ui.mjs";
import { prefControl, modToggle, layoutBadges, LAYOUT_LABELS } from "../settings/mods.mjs";

const { Mods } = ChromeUtils.importESModule("chrome://userscripts/content/mods/manager.sys.mjs");
const { confirmScript } = ChromeUtils.importESModule("chrome://userscripts/content/mods/consent.sys.mjs");
const Store = ChromeUtils.importESModule("chrome://userscripts/content/mods/store.sys.mjs");

const TARGETS = { chrome: "Arayüz", content: "Web sayfaları", both: "Arayüz + Web" };
const fold = s => String(s ?? "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

const $ = id => document.getElementById(id);
const state = { entries: [], remote: { state: "none" }, extra: [], q: "", chip: "all", busy: new Set(), selected: null, loading: true };
let armed = null;

// ---- üst kısım ----
$("q").previousElementSibling.append(icon("search", 16));
document.querySelector(".brand").append(logo(30), h("div", {}, h("h1", { text: "Mod Mağazası" }), h("p", { text: "Birkaç CSS dosyasıyla Rigel'i dilediğin gibi biçimlendir." })));
document.querySelector(".topact").append(
  h("button", { type: "button", class: "btn soft", onclick: () => reload(true) }, icon("undo", 14), "Yenile"),
  h("button", { type: "button", class: "btn soft", onclick: () => (chromeWin()?.Rigel?.settings?.open("modlar")) }, icon("brush", 14), "Modlarım"));
$("urlform").querySelector("button").append(icon("download", 14), "Bul");

const installed = id => Mods.get(id)?.meta ?? null;
function stateOf(e) {
  const m = installed(e.id);
  if (!m) return "none";
  if (!m.store) return "conflict";
  return Mods.hasUpdate(e) ? "update" : "installed";
}

// ---- veri ----
async function reload(force = false) {
  state.loading = true;
  render();
  try {
    await Mods.init();
    const res = await Store.loadCatalog({ refresh: force });
    state.entries = res.entries;
    state.remote = res.remote;
  } catch (e) {
    state.entries = [];
    state.remote = { state: "error", error: String(e.message ?? e) };
  }
  state.loading = false;
  render();
}

// ---- eylemler ----
async function install(e) {
  state.busy.add(e.id);
  render();
  try {
    // Uzak/bağlantıdan gelen betik: önce "kod çalıştırır" onayı. Paketle gelen katalog güvenilirdir.
    const needsOk = e.script && e.origin !== "bundled";
    if (needsOk && !(await confirmScript(chromeWin(), e))) throw new Error("Kod çalıştırma izni verilmedi.");
    const r = await Mods.installFromCatalog(e, { allowScript: needsOk });
    notify(r.updated ? `"${e.name}" güncellendi` : `"${e.name}" kuruldu ve açıldı`);
    if (r.notes?.length) notify(r.notes[0], true);
  } catch (err) {
    notify("Kurulamadı: " + (err.message ?? err), false);
  }
  state.busy.delete(e.id);
  render();
}
async function remove(e) {
  state.busy.add(e.id);
  render();
  await Mods.remove(e.id);
  notify(`"${e.name}" kaldırıldı`);
  state.busy.delete(e.id);
  if (state.selected === e.id) renderDetail();
  render();
}

// ---- yapı taşları ----
function preview(e, cls = "pv") {
  const box = h("div", { class: cls });
  const ph = h("span", { class: "ph", text: (e.name || "?").slice(0, 1).toLocaleUpperCase("tr") });
  box.append(ph);
  if (e.preview) {
    const img = h("img", { src: e.preview, alt: "", loading: "lazy", draggable: "false" });
    img.addEventListener("load", () => ph.remove(), { once: true });
    img.addEventListener("error", () => img.remove(), { once: true });
    box.append(img);
  }
  return box;
}
const targetBadge = e => h("span", { class: "tbadge " + e.target, text: TARGETS[e.target] });
// Çalıştığı düzenler ve "Kod çalıştırır" rozeti (betikli modlar).

// Uyarlanan modların kaynağı: "Kaynak: Zen mod mağazası — yazar (lisans)".
function sourceName(url) {
  if (!url) return "";
  if (/github\.com\/zen-browser\/theme-store/i.test(url)) return "Zen mod mağazası";
  try { return new URL(url).host; } catch { return ""; }
}
function sourceLine(e, cls = "src") {
  const name = sourceName(e.upstream);
  if (!name && !e.license) return null;
  const text = `Kaynak: ${[name, e.author].filter(Boolean).join(" — ")}${e.license ? ` (${e.license})` : ""}`;
  return h("span", { class: cls, title: e.upstream || "", text });
}

function actionButton(e, { sm = true } = {}) {
  const st = stateOf(e);
  const cls = "btn" + (sm ? " sm" : "");
  if (state.busy.has(e.id)) return h("button", { type: "button", class: cls + " soft", disabled: true }, h("span", { class: "spin" }), "Bekle…");
  if (st === "conflict") return h("button", { type: "button", class: cls + " soft", disabled: true, title: "Aynı kimlikte, mağazadan gelmeyen bir mod var" }, "Kimlik çakışıyor");
  if (st === "none") return h("button", { type: "button", class: cls, onclick: ev => { ev.stopPropagation(); install(e); } }, icon("download", 14), "Kur");
  if (st === "update") return h("button", { type: "button", class: cls, onclick: ev => { ev.stopPropagation(); install(e); } }, icon("undo", 14), "Güncelle");
  const key = "rm:" + e.id;
  const b = h("button", { type: "button", class: cls + " danger", title: "Modu kaldır" }, icon("trash", 14), armed === key ? "Emin misin?" : "Kaldır");
  if (armed === key) b.classList.add("armed");
  b.addEventListener("click", ev => {
    ev.stopPropagation();
    if (armed !== key) { armed = key; render(); renderDetail(); setTimeout(() => { if (armed === key) { armed = null; render(); renderDetail(); } }, 3000); return; }
    armed = null;
    remove(e);
  });
  return b;
}

function card(e) {
  const st = stateOf(e);
  const pv = preview(e);
  const open = () => openDetail(e.id);
  pv.addEventListener("click", open);
  if (st === "installed" || st === "update") pv.append(h("span", { class: "tbadge tag-installed " + (st === "update" ? "upd" : "kurulu") }, st === "update" ? "Güncelleme var" : "Kurulu"));
  const by = [e.author, "v" + e.version].filter(Boolean).join(" · ");
  const c = h("article", { class: "mcard", "data-id": e.id },
    pv,
    h("div", { class: "body", onclick: open },
      h("h3", { text: e.name }), h("span", { class: "by", text: by }), sourceLine(e), h("p", { text: e.description })),
    h("div", { class: "foot" },
      h("span", { class: "badges" }, targetBadge(e), layoutBadges(e), e.origin === "remote" && h("span", { class: "tbadge dim", text: "Uzak" })),
      actionButton(e)));
  return c;
}

// ---- liste ----
function filtered(list) {
  const q = fold(state.q.trim());
  return list.filter(e => {
    if (q && !fold(`${e.name} ${e.description} ${e.author} ${e.tags.join(" ")} ${TARGETS[e.target]}`).includes(q)) return false;
    const st = stateOf(e);
    switch (state.chip) {
      case "all": return true;
      case "installed": return st === "installed" || st === "update";
      case "update": return st === "update";
      case "t:chrome": return e.target !== "content";
      case "t:content": return e.target !== "chrome";
      default: return state.chip.startsWith("tag:") ? e.tags.includes(state.chip.slice(4)) : true;
    }
  });
}
function renderChips() {
  const all = [...state.entries, ...state.extra];
  const nInst = all.filter(e => ["installed", "update"].includes(stateOf(e))).length;
  const nUpd = all.filter(e => stateOf(e) === "update").length;
  const tags = [...new Set(all.flatMap(e => e.tags))].sort((a, b) => a.localeCompare(b, "tr"));
  const chip = (id, label, n) => {
    const b = h("button", { type: "button", class: "chip" + (state.chip === id ? " on" : ""), "aria-pressed": String(state.chip === id), onclick: () => { state.chip = state.chip === id && id !== "all" ? "all" : id; render(); } }, label, n != null && h("span", { class: "n", text: n }));
    return b;
  };
  $("chips").replaceChildren(...[
    chip("all", "Tümü", all.length), chip("installed", "Kurulu", nInst), nUpd ? chip("update", "Güncelleme var", nUpd) : null,
    h("span", { class: "chip sep" }),
    chip("t:chrome", "Arayüz"), chip("t:content", "Web sayfaları"),
    tags.length ? h("span", { class: "chip sep" }) : null,
    ...tags.map(t => chip("tag:" + t, t))].filter(Boolean));
}
function renderNotice() {
  const r = state.remote;
  const box = $("notice");
  if (r.state === "error") box.replaceChildren(h("div", { class: "notice", text: `Uzak mağazaya ulaşılamadı (${r.error}). Yerleşik mağaza gösteriliyor.` }));
  else if (r.state === "cached") box.replaceChildren(h("div", { class: "notice", text: `Uzak mağazaya ulaşılamadı (${r.error}). Son kaydedilen kopya gösteriliyor.` }));
  else if (r.state === "ok") box.replaceChildren(h("div", { class: "notice ok", text: `Uzak mağaza yüklendi: ${r.count} mod.` }));
  else box.replaceChildren();
}
function render() {
  renderChips();
  renderNotice();
  const main = $("main");
  if (state.loading && !state.entries.length) { main.replaceChildren(h("p", { class: "empty", text: "Mağaza yükleniyor…" })); return; }
  const list = filtered(state.entries);
  const parts = [];
  if (list.length) parts.push(h("div", { class: "grid" }, list.map(card)));
  else parts.push(h("p", { class: "empty", text: state.q || state.chip !== "all" ? "Bu süzgece uyan mod yok." : "Katalog boş." }));
  main.replaceChildren(...parts);
  // URL sonuçları
  const res = $("urlres");
  const ex = filtered(state.extra);
  if (state.extra.length) res.replaceChildren(h("div", { class: "sectitle", text: "Bağlantıdan bulunanlar" }), h("div", { class: "grid" }, (ex.length ? ex : state.extra).map(card)));
  else if (!res.querySelector(".err")) res.replaceChildren();
}

// ---- ayrıntı ----
function openDetail(id) {
  state.selected = id;
  renderDetail();
}
function closeDetail() {
  state.selected = null;
  $("detail").hidden = true;
}
function renderDetail() {
  const box = $("detail");
  const e = [...state.entries, ...state.extra].find(x => x.id === state.selected);
  if (!e) { box.hidden = true; return; }
  const st = stateOf(e);
  const meta = installed(e.id);
  const kids = [
    h("div", { class: "head" },
      h("button", { type: "button", class: "close", "aria-label": "Kapat", onclick: closeDetail }, icon("close", 16)),
      preview(e, "pvbig")),
    h("div", {}, h("h2", { text: e.name }),
      h("div", { class: "meta" }, e.author && h("span", { text: e.author }), h("span", { text: "v" + e.version }),
        meta?.store && meta.version !== e.version && h("span", { text: `kurulu: v${meta.version}` }), targetBadge(e),
        e.homepage && h("a", { href: e.homepage, onclick: ev => { ev.preventDefault(); chromeWin()?.openTrustedLinkIn?.(e.homepage, "tab"); } }, "Ana sayfa"),
        e.upstream && e.upstream !== e.homepage && h("a", { href: e.upstream, onclick: ev => { ev.preventDefault(); chromeWin()?.openTrustedLinkIn?.(e.upstream, "tab"); } }, "Özgün mod")),
      sourceLine(e, "src big")),
    h("p", { class: "desc", text: e.description }),
    e.layouts?.length ? h("p", { class: "layoutnote", text: "Yalnız şu düzenlerde çalışır: " + e.layouts.map(l => LAYOUT_LABELS[l] ?? l).join(", ") + "." }) : null,
    e.script && e.origin !== "bundled" ? h("div", { class: "codewarn", role: "alert" }, h("b", { text: "Bu mod kod çalıştırır." }), " Betiği tarayıcının tam yetkileriyle çalışır. Kurarken onayını isteriz; yalnız yazarına güveniyorsan kur.") : null,
    e.script && e.origin === "bundled" ? h("p", { class: "layoutnote", text: "Bu mod Rigel ile gelen, sınırlı bir betik çalıştırır (davranış değiştirir)." }) : null,
    e.tags.length && h("div", { class: "badges" }, e.tags.map(t => h("span", { class: "tbadge dim", text: t }))),
    h("div", { class: "acts" }, actionButton(e, { sm: false })),
  ];
  if (st === "installed" || st === "update") {
    const sw = modToggle(meta);
    sw.setAttribute("aria-label", "Etkin");
    kids.push(h("h4", { text: "Ayarlar" }),
      h("div", { class: "prefs" },
        h("div", { class: "prow" }, h("span", { class: "l", text: "Mod açık" }), sw),
        ...(meta.prefs ?? []).map(p => h("div", { class: "prow" }, h("span", { class: "l", text: p.label }), prefControl(meta, p))),
        meta.prefs?.length ? h("div", { class: "prow end" }, h("button", { type: "button", class: "btn ghost sm", onclick: () => Mods.resetValues(e.id) }, icon("undo", 13), "Varsayılanlara dön")) : null));
  }
  box.replaceChildren(h("div", { class: "panel", role: "dialog", "aria-label": e.name }, kids));
  box.hidden = false;
}
$("detail").addEventListener("mousedown", ev => { if (ev.target === $("detail")) closeDetail(); });
addEventListener("keydown", ev => { if (ev.key === "Escape" && state.selected) closeDetail(); });

// ---- bağlantıdan kur ----
async function findUrl(input) {
  const res = $("urlres");
  res.replaceChildren(h("small", { text: "Aranıyor…" }));
  state.extra = [];
  try {
    state.extra = await Store.resolveUrl(input);
    render();
    if (state.extra.length === 1) openDetail(state.extra[0].id);
  } catch (err) {
    res.replaceChildren(h("span", { class: "err", text: err.message ?? String(err) }));
  }
}
$("urlform").addEventListener("submit", ev => {
  ev.preventDefault();
  const v = $("url").value.trim();
  if (v) findUrl(v);
});

$("q").addEventListener("input", () => { state.q = $("q").value; render(); });
addEventListener("keydown", ev => {
  if (ev.key === "/" && !/^(input|select|textarea)$/i.test(ev.target.tagName)) { ev.preventDefault(); $("q").focus(); }
});

watch(["topic:rigel-mods-list"], () => { render(); if (state.selected) renderDetail(); });
watch(["rigel.mods.storeUrl"], () => reload(true));
onDispose(() => {});

const m = location.hash.match(/^#kur=(.+)$/);
await reload();
if (m) { $("url").value = decodeURIComponent(m[1]); findUrl($("url").value); }
