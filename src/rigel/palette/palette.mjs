// Palet: tek kutuda adres, web araması, açık sekme arama, yer imi/geçmiş önerileri, komutlar ve !bang ipucu.
// Ekranın ortasında yüzen kart (Palette.svelte tasarımı). Rigel.palette.open/close/toggle.
import { splitBang, suggestBangs, parseBang } from "../search/bangs.mjs";
import { el, icon, favicon, hostOf, toast } from "../commands/ui.mjs";
import { allBangs, bangSettings, resolveTyped, searchEngine, refreshEngine } from "./settings.mjs";

const GROUPS = { go: "", bang: "ARAMA KISAYOLLARI", tab: "SEKMELER", mark: "YER İMLERİ", hist: "GEÇMİŞ", cmd: "KOMUTLAR" };
const fold = (s) => String(s ?? "").toLocaleLowerCase("tr").replace(/ı/g, "i");
// Adres çubuğuna tıklayınca mevcut adres yazılmaz: yeni sekme/giriş sayfaları.
const NO_PREFILL = /^(about:(newtab|home|blank|privatebrowsing)\b|chrome:\/\/rigel\/content\/(newtab|welcome)\/)/;
/** İkinci satırda gösterilecek kısa adres: şema ve www. atılır, sondaki "/" düşer (geçmiş/yer imi). */
const shortUrl = (url) => {
  const s = String(url ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
};
/** Sekme için ikinci satır: alan adı, web dışı sayfalarda şemalı kısa ad. */
const tabHost = (url) => hostOf(url) || (/^chrome:\/\/rigel\//.test(url) ? "Rigel" : shortUrl(url)) || "sekme";
const bangSite = (bang) => {
  try {
    const u = new URL(bang.url.replaceAll("%s", ""));
    return `${u.protocol}//${u.host}/`;
  } catch { return ""; }
};

export function createPalette(win, registry) {
  const doc = win.document;
  const { gBrowser } = win;
  let root = null, input, list, inner;
  let opts = {};
  let items = [];
  let selKey = null;
  let sugg = { query: null, rows: [] };
  let suggTimer = 0;
  let prevFocus = null;
  let prefill = ""; // adres tıklamasıyla yazılan adres: kullanıcı dokunana (yazana/gezene) kadar sorgu sayılmaz
  let navigated = false;

  refreshEngine();
  const engineObs = () => refreshEngine();
  Services.obs.addObserver(engineObs, "browser-search-engine-modified");
  win.addEventListener("unload", () => Services.obs.removeObserver(engineObs, "browser-search-engine-modified"), { once: true });

  function build() {
    input = el(doc, "input", {
      type: "text", spellcheck: "false", autocomplete: "off", placeholder: "Ara, adres yaz ya da komut seç…",
      oninput: () => { selKey = null; prefill = ""; update(); }, onkeydown: onKey,
    });
    inner = el(doc, "div", { class: "rgl-pal-inner" });
    list = el(doc, "div", { class: "rgl-pal-list" }, inner);
    const k = (t) => el(doc, "kbd", { text: t });
    const card = el(doc, "div", { class: "rgl-pal-card", role: "dialog", "aria-label": "Palet" },
      el(doc, "div", { class: "rgl-pal-in" }, icon(doc, "search", 17), input, k("Esc")),
      list,
      el(doc, "div", { class: "rgl-pal-foot" },
        el(doc, "span", {}, k("↑"), k("↓"), " gez"),
        el(doc, "span", {}, k("↵"), " aç"),
        el(doc, "span", {}, k("⇧ ↵"), " yeni sekmede"),
        el(doc, "span", {}, k("Ctrl ↵"), " .com"),
        el(doc, "span", {}, k("Esc"), " kapat")));
    root = el(doc, "div", { id: "rigel-palette", hidden: true }, card);
    root.addEventListener("mousedown", (e) => { if (e.target === root) { e.preventDefault(); close(); } });
    doc.documentElement.append(root);
  }

  const isOpen = () => !!root && !root.hidden;

  function open(o = {}) {
    if (!root) build();
    opts = { mode: "all", newTab: false, ...o };
    if (!isOpen()) prevFocus = doc.activeElement;
    root.hidden = false;
    root.setAttribute("mode", opts.mode);
    win.Rigel?.drawers?.close?.();
    prefill = "";
    navigated = false;
    input.value = o.query ?? "";
    if (opts.fromAddress && !o.query && opts.mode === "all") {
      const spec = gBrowser.selectedBrowser?.currentURI?.spec ?? "";
      if (spec && !NO_PREFILL.test(spec)) input.value = prefill = spec;
    }
    input.placeholder = opts.mode === "tabs" ? "Sekmelerde ara…" : opts.mode === "commands" ? "Komut ara…" : "Ara, adres yaz ya da komut seç…";
    selKey = null;
    update();
    input.focus();
    input.select();
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    root.hidden = true;
    win.clearTimeout(suggTimer);
    if (restoreFocus) {
      if (prevFocus?.isConnected && prevFocus !== doc.body && prevFocus.localName !== "browser") prevFocus.focus?.();
      else gBrowser.selectedBrowser.focus();
    }
    prevFocus = null;
  }

  const toggle = (o) => (isOpen() ? close() : open(o));

  // --- öğeler -------------------------------------------------------------------------------------
  function navigate(url, newTab) {
    close({ restoreFocus: false });
    win.openTrustedLinkIn(url, newTab ? "tab" : "current");
  }

  function switchTo(tab) {
    close({ restoreFocus: false });
    const w = tab.documentGlobal ?? tab.ownerGlobal;
    if (w !== win) w.focus();
    w.gBrowser.selectedTab = tab;
  }

  function completeBang(alias) {
    input.value = input.value.replace(/\S*$/, `!${alias} `);
    selKey = null;
    update();
    input.focus();
  }

  function compute() {
    const raw = prefill && input.value === prefill ? "" : input.value.trim();
    let mode = opts.mode;
    let qRaw = raw;
    if (mode === "all" && raw.startsWith(">")) {
      mode = "commands";
      qRaw = raw.slice(1).trim();
    }
    const q = fold(qRaw);
    const out = [];
    const bangs = mode === "all" ? allBangs() : [];
    const hit = mode === "all" && bangs.length ? parseBang(raw, bangSettings().customBangs) : null;

    // Yazılmakta olan sözcük "!" ile başlıyorsa bang öner (seçilince tamamlanır).
    const typing = raw ? /(?:^|\s)!(\S*)$/.exec(input.value)?.[1] : undefined;
    const suggested = [];
    if (bangs.length && typing !== undefined) {
      for (const { bang, alias } of suggestBangs(typing, bangs)) {
        suggested.push({
          key: `g-${bang.custom ? "c" : "b"}-${bang.trigger}`, group: "bang", title: `!${alias}  ${bang.name}`,
          sub: hostOf(bangSite(bang)), fav: { url: bangSite(bang) }, bang, run: () => completeBang(alias), keep: true,
        });
      }
    }
    if (!hit) out.push(...suggested);

    if (mode === "all" && raw) {
      const r = resolveTyped(raw);
      if (r) {
        const go = (o = {}) => navigate(resolveTyped(raw, o)?.url ?? r.url, o.newTab);
        if (r.type === "bang") {
          out.push({ key: "go", group: "go", title: r.query || r.bang.name, sub: r.query ? `${r.bang.name} ile ara` : "siteyi aç",
            fav: { url: bangSite(r.bang) }, run: go, nav: true });
        } else if (r.type === "url") {
          out.push({ key: "go", group: "go", title: raw, sub: "adrese git", icon: "arrow", run: go, nav: true });
        } else {
          const eng = searchEngine();
          out.push({ key: "go", group: "go", title: raw, sub: `${eng.name} ile ara`, img: eng.icon, icon: "search", run: go, nav: true });
        }
      }
    }
    if (hit) out.push(...suggested.filter((s) => s.bang.trigger !== hit.bang.trigger));

    // Açık sekmeler (önce bu pencere, sonra diğerleri).
    const seen = new Set();
    if (mode === "all" || mode === "tabs") {
      const wins = [win, ...Services.wm.getEnumerator("navigator:browser")].filter((w, i, a) => a.indexOf(w) === i && !w.closed);
      let n = 0;
      const max = mode === "tabs" ? 200 : 8;
      outer: for (const w of wins) {
        for (const t of w.gBrowser?.visibleTabs ?? []) {
          const url = t.linkedBrowser?.currentURI?.spec ?? "";
          seen.add(url);
          const label = t.label || url;
          if (q && !fold(`${label} ${url}`).includes(q)) continue;
          if (!q && mode === "all" && t === gBrowser.selectedTab) continue;
          out.push({
            key: `t-${w === win ? "" : "w"}${t.linkedPanel || label}-${n}`, group: "tab", title: label,
            sub: tabHost(url) + (t.hasAttribute("pending") ? " · uyuyor" : ""), tip: url,
            fav: { url, image: t.getAttribute("image") }, run: () => switchTo(t),
          });
          if (++n >= max) break outer;
        }
      }
    }

    // Yer imi ve geçmiş önerileri (eski sorguya aitse gösterme).
    if (mode === "all" && sugg.query === raw && raw) {
      let b = 0, h = 0;
      for (const row of sugg.rows) {
        if (seen.has(row.url)) continue;
        seen.add(row.url);
        if (row.bm ? b++ >= 4 : h++ >= 6) continue;
        out.push({
          key: `${row.bm ? "b" : "h"}-${row.url}`, group: row.bm ? "mark" : "hist", title: row.title || hostOf(row.url) || row.url,
          sub: shortUrl(row.url), tip: row.url, fav: { url: row.url }, run: (o = {}) => navigate(row.url, o.newTab), nav: true,
        });
      }
    }

    // Komutlar
    if (mode === "all" || mode === "commands") {
      let shown = 0;
      for (const c of registry.list()) {
        if (c.id === "palette") continue;
        if (q && !fold(`${c.label} ${c.sub}`).includes(q)) continue;
        if (q && mode === "all" && ++shown > 6) break;
        out.push({
          key: `c-${c.id}`, group: "cmd", title: c.label, kbd: c.keys[0], sub: c.sub, icon: c.icon || "bolt",
          run: () => { close(); c.run({ source: "palette" }); },
        });
      }
    }
    return out;
  }

  function requestSuggestions() {
    const raw = input.value.trim();
    win.clearTimeout(suggTimer);
    if (opts.mode !== "all" || !raw || (prefill && input.value === prefill) || raw.startsWith(">") || splitBang(raw)) return;
    if (sugg.query === raw) return;
    suggTimer = win.setTimeout(async () => {
      const rows = await queryPlaces(raw).catch((e) => (dump(`[rigel] öneriler: ${e}\n`), []));
      if (!isOpen() || input.value.trim() !== raw) return;
      sugg = { query: raw, rows };
      update({ keepSuggest: true });
    }, 60);
  }

  function update({ keepSuggest = false } = {}) {
    items = compute();
    root.toggleAttribute("data-idle", !(prefill && input.value === prefill ? "" : input.value.trim()));
    if (!items.some((i) => i.key === selKey)) selKey = items[0]?.key ?? null;
    render();
    if (!keepSuggest) requestSuggestions();
  }

  function render() {
    const frag = doc.createDocumentFragment();
    items.forEach((it, i) => {
      if (GROUPS[it.group] && (i === 0 || items[i - 1].group !== it.group)) {
        frag.append(el(doc, "div", { class: "rgl-pal-grp", text: GROUPS[it.group] }));
      }
      let ico;
      if (it.fav) ico = favicon(doc, it.fav, 18);
      else if (it.img) ico = el(doc, "img", { src: it.img, width: 18, height: 18, alt: "" });
      else ico = icon(doc, it.icon || "bolt", 16);
      const two = !!it.sub && !it.kbd && (it.group === "tab" || it.group === "mark" || it.group === "hist");
      const row = el(doc, "div", {
        class: "rgl-pal-row" + (two ? " two" : "") + (it.key === selKey ? " sel" : ""), role: "option", "data-key": it.key, ...(it.tip ? { title: it.tip } : {}),
        onmousemove: () => select(it.key), onclick: (e) => activate(it, { newTab: e.shiftKey || e.button === 1 }),
      },
      el(doc, "span", { class: "ico" }, ico),
      el(doc, "span", { class: "t", text: it.title }),
      it.kbd ? el(doc, "kbd", { text: it.kbd }) : it.sub ? el(doc, "span", { class: "sub", text: it.sub }) : null);
      frag.append(row);
    });
    if (!items.length) frag.append(el(doc, "div", { class: "rgl-pal-empty", text: "Sonuç yok" }));
    inner.replaceChildren(frag);
    scrollSel();
  }

  function select(key) {
    if (key === selKey) return;
    selKey = key;
    for (const r of inner.querySelectorAll(".rgl-pal-row")) r.classList.toggle("sel", r.dataset.key === key);
  }
  function scrollSel() {
    inner.querySelector(".rgl-pal-row.sel")?.scrollIntoView({ block: "nearest" });
  }
  function move(d) {
    if (!items.length) return;
    navigated = true;
    const i = items.findIndex((x) => x.key === selKey);
    select(items[(i + d + items.length) % items.length].key);
    scrollSel();
  }

  function activate(it, { newTab = false, ctrl = false } = {}) {
    if (!it) return;
    const nt = newTab !== opts.newTab; // newTab ile açıldıysa Shift tersine çevirir
    it.run({ newTab: it.nav ? nt : newTab, ctrl });
  }

  function onKey(e) {
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey && !items.find((x) => x.key === selKey)?.bang)) {
      e.preventDefault(); move(1);
    } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault(); move(-1);
    } else if (e.key === "Tab") {
      e.preventDefault(); items.find((x) => x.key === selKey)?.run();
    } else if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation(); close();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (prefill && input.value === prefill && !navigated) return close(); // adrese dokunulmadı: Enter yalnız kapatır
      const raw = input.value.trim();
      if (e.ctrlKey && raw && opts.mode === "all" && !/[\s./:]/.test(raw)) {
        const r = resolveTyped(raw, { ctrl: true });
        if (r) navigate(r.url, e.shiftKey || opts.newTab);
        return;
      }
      const it = items.find((x) => x.key === selKey);
      if (it) activate(it, { newTab: e.shiftKey });
      else if (raw && opts.mode === "all") {
        const r = resolveTyped(raw);
        if (r) navigate(r.url, e.shiftKey !== opts.newTab);
      }
    } else if (e.key === "PageDown") { e.preventDefault(); move(8); }
    else if (e.key === "PageUp") { e.preventDefault(); move(-8); }
  }

  // Places: yer imleri önce, sonra sıklığa göre geçmiş. Tek SQL, salt okunur bağlantı.
  async function queryPlaces(raw) {
    const db = await win.PlacesUtils.promiseDBConnection();
    const like = "%" + raw.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    const rows = await db.executeCached(
      `SELECT h.url AS url, COALESCE(MAX(b.title), h.title) AS title, COUNT(b.id) > 0 AS bm
         FROM moz_places h LEFT JOIN moz_bookmarks b ON b.fk = h.id AND b.type = 1
        WHERE h.hidden = 0 AND substr(h.url, 1, 6) <> 'place:'
          AND (h.url LIKE :q ESCAPE '\\' OR h.title LIKE :q ESCAPE '\\' OR b.title LIKE :q ESCAPE '\\')
          AND (b.id NOT NULL OR h.last_visit_date NOT NULL)
        GROUP BY h.id
        ORDER BY bm DESC, h.frecency DESC
        LIMIT 16`, { q: like });
    return rows.map((r) => ({ url: r.getResultByName("url"), title: r.getResultByName("title"), bm: !!r.getResultByName("bm") }));
  }

  return { open, close, toggle, isOpen, get items() { return items.map(({ key, group, title, sub }) => ({ key, group, title, sub })); }, toast: (t) => toast(win, t) };
}
