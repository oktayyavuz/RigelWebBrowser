// Rigel yeni sekme. Sayfa chrome:// olduğu için ana süreçte ayrıcalıklı çalışır; geçmişe NewTabUtils ile erişir.
// Görünüm `rigel.newtab` tercihindedir (config.mjs); "Düzenle" kipi (edit.mjs) ya da Ayarlar › Yeni sekme yazar.
// Gizli pencerede sık ziyaret edilenler gösterilmez. Eski anahtar: rigel.newtab.topsites = false (otomatik kısayollar kapalı).
import * as Cfg from "./config.mjs";
import { resolveIcon, fetchIcon } from "./icons.mjs";
import { buildPanel, shortcutDialog } from "./edit.mjs";
import { resolveTyped, allBangs, bangSettings, refreshEngine, searchEngine } from "chrome://userscripts/content/palette/settings.mjs";
import { suggestBangs, parseBang } from "chrome://userscripts/content/search/bangs.mjs";
import { PREF as LOOK_PREF } from "chrome://userscripts/content/theme/look.mjs";

const { NewTabUtils } = ChromeUtils.importESModule("resource://gre/modules/NewTabUtils.sys.mjs");

const $ = id => document.getElementById(id);
const MAX_AUTO = 32;
const priv = !!window.browsingContext?.usePrivateBrowsing;

let cfg = Cfg.read();
let autoLinks = [];
let editing = false;
let panel = null;

// ---------------------------------------------------------------- saat, tarih, karşılama
function tick() {
  const now = new Date();
  $("time").textContent = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: cfg.hour12 });
  $("date").textContent = now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  $("greeting").textContent = Cfg.greeting(now, cfg.name);
}

// ---------------------------------------------------------------- arka plan
function renderBg() {
  const { css, ink, kind } = Cfg.backdrop(cfg);
  $("bg").style.background = css || "";
  const stage = $("stage");
  if (ink) stage.dataset.ink = ink;
  else delete stage.dataset.ink;
  stage.dataset.kind = kind;
}

// ---------------------------------------------------------------- kısayollar
const autoEnabled = () => Services.prefs.getBoolPref(Cfg.TOPSITES_PREF, true) && !priv;
const capacity = () => cfg.grid.cols * cfg.grid.rows;

async function loadAuto() {
  if (cfg.shortcutMode !== "auto" || !autoEnabled()) return;
  try {
    const links = await NewTabUtils.activityStreamLinks.getTopSites({ numItems: MAX_AUTO, onePerDomain: true });
    autoLinks = links.filter(l => /^https?:/.test(l.url)).map(l => ({ title: Cfg.hostOf(l.url), url: l.url, auto: true }));
  } catch (e) {
    console.error("[rigel-newtab] getTopSites", e);
  }
  renderSites();
}

/** Şu an gösterilen tam liste (otomatikteyse ızgaraya sığanlar). */
function modelList() {
  if (cfg.shortcutMode === "custom") return cfg.shortcuts.map(s => ({ ...s }));
  return autoEnabled() ? autoLinks.slice(0, capacity()).map(({ title, url }) => ({ title, url })) : [];
}
/** Değişikliği elle kipine geçirerek yazar. */
function commit(list) {
  Cfg.patch(c => { c.shortcutMode = "custom"; c.shortcuts = list; });
}
const removeAt = i => { const l = modelList(); l.splice(i, 1); commit(l); };
function move(from, to) {
  const l = modelList();
  if (from === to || from < 0 || from >= l.length) return;
  const [it] = l.splice(from, 1);
  l.splice(Math.max(0, Math.min(l.length, to)), 0, it);
  commit(l);
}
function openEditor(i) {
  const list = modelList();
  const cur = i >= 0 ? list[i] : { title: "", url: "" };
  shortcutDialog({
    title: cur.title === Cfg.hostOf(cur.url) ? "" : cur.title, url: cur.url, isNew: i < 0,
    onSave({ title, url }) {
      const l = modelList();
      if (l.some((s, k) => s.url === url && k !== i)) return "Bu adres zaten kısayollarda.";
      if (i < 0) {
        if (l.length >= Cfg.MAX_SHORTCUTS) return `En çok ${Cfg.MAX_SHORTCUTS} kısayol.`;
        l.push({ title, url });
      } else {
        l[i] = { title, url };
      }
      commit(l);
      fetchIcon(url).then(ok => ok && renderSites());
      return "";
    },
  });
}

function siteTile(s, i, cap) {
  const el = document.createElement("div");
  el.className = "site" + (i >= cap ? " over" : "");
  el.dataset.i = i;
  const a = document.createElement("a");
  a.href = s.url;
  a.title = `${s.title}\n${s.url}`;
  const ic = document.createElement("span");
  ic.className = "ic";
  const img = document.createElement("img");
  img.alt = "";
  img.hidden = true;
  const letter = document.createElement("span");
  letter.className = "letter";
  letter.textContent = (s.title || Cfg.hostOf(s.url)).charAt(0);
  ic.append(img, letter);
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = s.title;
  a.append(ic, name);
  el.append(a);
  img.onload = () => { img.hidden = false; letter.hidden = true; };
  img.onerror = () => { img.hidden = true; letter.hidden = false; };
  if (s.auto) img.src = `page-icon:${s.url}`;
  else resolveIcon(s.url).then(src => { if (src) img.src = src; });

  const tools = document.createElement("div");
  tools.className = "tools";
  if (editing) {
    tools.append(toolBtn("edit", "Düzenle", () => openEditor(i)), toolBtn("close", "Kaldır", () => removeAt(i)));
    el.draggable = true;
    a.addEventListener("click", e => { e.preventDefault(); openEditor(i); });
    wireDrag(el, i);
  } else if (cfg.shortcutMode === "auto") {
    tools.append(toolBtn("close", "Bu siteyi gösterme", () => {
      NewTabUtils.activityStreamLinks.blockURL({ url: s.url });
      loadAuto();
    }));
  }
  if (tools.childElementCount) el.append(tools);
  return el;
}

const TOOL_ICONS = {
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
};
function toolBtn(ic, label, onclick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tool";
  b.title = label;
  b.setAttribute("aria-label", label);
  b.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TOOL_ICONS[ic]}</svg>`;
  b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); onclick(); });
  return b;
}

let dragFrom = -1;
function wireDrag(el, i) {
  el.addEventListener("dragstart", e => {
    dragFrom = i;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(i));
    el.classList.add("drag");
  });
  el.addEventListener("dragend", () => {
    dragFrom = -1;
    for (const x of $("sites").querySelectorAll(".drag, .dropbefore, .dropafter")) x.classList.remove("drag", "dropbefore", "dropafter");
  });
  el.addEventListener("dragover", e => {
    if (dragFrom < 0 || dragFrom === i) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const after = e.clientX > r.left + r.width / 2;
    el.classList.toggle("dropafter", after);
    el.classList.toggle("dropbefore", !after);
  });
  el.addEventListener("dragleave", () => el.classList.remove("dropbefore", "dropafter"));
  el.addEventListener("drop", e => {
    e.preventDefault();
    if (dragFrom < 0) return;
    const r = el.getBoundingClientRect();
    const after = e.clientX > r.left + r.width / 2;
    let to = i + (after ? 1 : 0);
    if (dragFrom < to) to--;
    move(dragFrom, to);
  });
}

function renderSites() {
  const nav = $("sites");
  const cap = capacity();
  nav.dataset.auto = cfg.shortcutMode === "auto" ? "1" : "";
  const list = modelList();
  const shown = editing ? list : list.slice(0, cap);
  const tiles = shown.map((s, i) => siteTile(s, i, cap));
  if (editing && list.length < Math.min(cap, Cfg.MAX_SHORTCUTS)) {
    const add = document.createElement("div");
    add.className = "site add";
    add.innerHTML = '<a href="#" title="Kısayol ekle"><span class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span><span class="name">Kısayol ekle</span></a>';
    add.querySelector("a").addEventListener("click", e => { e.preventDefault(); openEditor(-1); });
    tiles.push(add);
  }
  nav.replaceChildren(...tiles);
  nav.hidden = !cfg.widgets.shortcuts || !tiles.length;
}

// ---------------------------------------------------------------- arama kutusu
const q = $("q");
const sugg = $("sugg");
const badge = $("sbadge");

function placeholder() {
  q.placeholder = "Ara ya da adres gir · !yt gibi kısayollar çalışır";
}
function updateSearchUi() {
  const text = q.value;
  const bangs = allBangs();
  const s = bangSettings();
  const hit = s.bangs && text.trim() ? parseBang(text, s.customBangs) : null;
  if (hit) {
    badge.textContent = `↗ ${hit.bang.name}`;
    badge.hidden = false;
  } else if (text.trim()) {
    badge.textContent = searchEngine().name;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
  // !… yazılırken kısayol önerileri
  const m = text.match(/(?:^|\s)(![^\s!]*)$/);
  const list = m ? suggestBangs(m[1], bangs, 8) : [];
  if (!list.length) { sugg.hidden = true; return; }
  sugg.replaceChildren(...list.map(({ bang, alias }) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = "<code></code><span></span>";
    b.firstChild.textContent = "!" + alias;
    b.lastChild.textContent = bang.name;
    b.addEventListener("mousedown", e => e.preventDefault());
    b.addEventListener("click", () => {
      q.value = q.value.slice(0, q.value.length - m[1].length) + "!" + alias + " ";
      q.focus();
      updateSearchUi();
    });
    return b;
  }));
  sugg.hidden = false;
}
q.addEventListener("input", updateSearchUi);
q.addEventListener("blur", () => setTimeout(() => (sugg.hidden = true), 120));
q.addEventListener("keydown", e => {
  if (e.key === "Escape") { q.value = ""; updateSearchUi(); }
  if (e.key === "Tab" && !sugg.hidden && !e.shiftKey) {
    const first = sugg.querySelector("button");
    if (first) { e.preventDefault(); first.click(); }
  }
});
$("search").addEventListener("submit", e => {
  e.preventDefault();
  const r = resolveTyped(q.value, { ctrl: false });
  if (!r?.url) return;
  window.location.assign(r.url);
});
// Yazmaya başlayınca arama kutusuna odaklan (düzenleme kipi ve başka alanlar hariç).
addEventListener("keydown", e => {
  if (editing || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
  if (!cfg.widgets.search || /^(input|textarea|select)$/i.test(e.target.tagName) || !$("dlg").hidden) return;
  q.focus();
});

// ---------------------------------------------------------------- düzenleme kipi
function setEditing(on) {
  if (on === editing) return;
  editing = on;
  document.body.classList.toggle("editing", on);
  const p = $("panel");
  if (on) {
    panel ??= buildPanel(p, { doc: document, win: window, exit: () => setEditing(false) });
    p.hidden = false;
    panel.refresh();
    loadAuto();
    if (location.hash === "#edit") history.replaceState(null, "", location.pathname + location.search);
  } else {
    p.hidden = true;
  }
  renderSites();
}
$("edit").addEventListener("click", () => setEditing(true));
addEventListener("keydown", e => {
  if (e.key === "Escape" && editing && $("dlg").hidden) setEditing(false);
});
addEventListener("hashchange", () => { if (location.hash === "#edit") setEditing(true); });

// ---------------------------------------------------------------- çizim
const WIDGET_EL = { logo: ".logo", clock: "#time", greeting: "#greeting", date: "#date", search: "#search" };
function render() {
  const prevMode = cfg.shortcutMode;
  cfg = Cfg.read();
  const main = $("main");
  main.dataset.layout = cfg.layout;
  main.style.setProperty("--cols", cfg.grid.cols);
  for (const [k, sel] of Object.entries(WIDGET_EL)) document.querySelector(sel).hidden = !cfg.widgets[k];
  $("greeting").hidden = !cfg.widgets.greeting;
  tick();
  renderBg();
  renderSites();
  if (cfg.shortcutMode === "auto" && (prevMode !== "auto" || !autoLinks.length)) loadAuto();
  panel?.refresh();
}

render();
placeholder();
refreshEngine().then(updateSearchUi);
setInterval(tick, 15 * 1000);
loadAuto();
addEventListener("unload", Cfg.watch(render, [LOOK_PREF]), { once: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  tick();
  loadAuto();
});
if (location.hash === "#edit") setEditing(true);

// Alt bağlantılar: açık olan ayarlar/mağaza sekmesine geç (yoksa bu sekmede açılır).
for (const a of document.querySelectorAll(".quick a")) {
  a.addEventListener("click", e => {
    try {
      const R = window.browsingContext?.topChromeWindow?.Rigel;
      const href = a.getAttribute("href");
      if (href.includes("/store/")) R?.mods?.openStore?.();
      else if (R?.settings) R.settings.open(href.split("#")[1]);
      else return;
      e.preventDefault();
    } catch {}
  });
}
