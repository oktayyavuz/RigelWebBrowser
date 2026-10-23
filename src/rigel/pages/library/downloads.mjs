// İndirmeler: oturum + geçmiş indirmeleri (DownloadHistory), ilerleme, duraklat/sürdür/iptal/yeniden dene, aç, klasörde göster, temizle.
import { h, icon, hostOf, bytes, duration, dayKey, dayLabel, timeOf, fold, toast, debounce } from "./ui.mjs";

const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
const { DownloadHistory } = ChromeUtils.importESModule("resource://gre/modules/DownloadHistory.sys.mjs");
let DownloadsCommon = null;
try {
  ({ DownloadsCommon } = ChromeUtils.importESModule("moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs"));
} catch {}

const stateOf = d => {
  if (!d.stopped) return "inProgress";
  if (d.succeeded) return "complete";
  if (d.error) return "failed";
  if (d.canceled) return d.hasPartialData ? "paused" : "canceled";
  return "complete";
};
const nameOf = d => { try { return PathUtils.filename(d.target.path); } catch { return d.source?.url ? hostOf(d.source.url) : "İndirme"; } };
const extOf = n => /\.([a-z0-9]{1,4})$/i.exec(n)?.[1].toUpperCase() ?? "";
const timeMs = d => {
  const t = d.startTime ?? d.endTime;
  return typeof t?.getTime === "function" ? t.getTime() : typeof t === "number" ? t : 0;
};
const missing = d => d.succeeded && d.target?.exists === false;

function statusText(d, st) {
  const total = d.hasProgress ? d.totalBytes : 0;
  const size = bytes(d.target?.size ?? d.totalBytes ?? d.currentBytes);
  switch (st) {
    case "complete": return missing(d) ? "Dosya taşınmış ya da silinmiş" : size;
    case "canceled": return "İptal edildi";
    case "failed": return d.error?.becauseBlockedByReputationCheck ? "Güvenli değil, engellendi" : d.error?.becauseBlockedByParentalControls ? "Ebeveyn denetimi engelledi" : "Başarısız oldu";
    case "paused": return `${total ? `${bytes(d.currentBytes)} / ${bytes(total)}` : bytes(d.currentBytes)} · duraklatıldı`;
    default: {
      const done = total ? `${bytes(d.currentBytes)} / ${bytes(total)}` : bytes(d.currentBytes);
      if (!d.speed) return done || "Başlıyor…";
      const left = total ? ` · ${duration((total - d.currentBytes) / d.speed)} kaldı` : "";
      return `${done} · ${bytes(d.speed)}/sn${left}`;
    }
  }
}

export function mount(root, ctx) {
  let list = null;
  let query = "";
  const downloads = new Set();
  const rows = new Map(); // download → { el, update }
  let disposed = false;

  const search = h("input", { type: "search", placeholder: "İndirmelerde ara", spellcheck: "false", "aria-label": "İndirmelerde ara" });
  const clearBtn = h("button", { class: "btn soft", title: "Biten, iptal edilen ve başarısız indirmeleri listeden kaldırır (dosyalar silinmez)", onclick: () => list?.removeFinished() }, icon("trash", 15), "Listeyi temizle");
  const groups = h("div", { class: "groups" });
  const empty = h("div", { class: "empty", hidden: true });
  root.append(
    h("header", { class: "phead" }, h("div", { class: "ptitle" }, h("h2", { text: "İndirmeler" }), h("p", { text: "Bu bilgisayara indirdiğin dosyalar." })), h("div", { class: "tools" }, clearBtn)),
    h("label", { class: "search" }, icon("search", 15), search), groups, empty);

  // ---- Eylemler ----
  const act = (title, ic, fn, cls = "") => h("button", { class: "act " + cls, title, "aria-label": title, onclick: e => { e.stopPropagation(); Promise.resolve(fn()).catch(err => { console.error(err); toast(String(err.message ?? err), { error: true }); }); } }, icon(ic, 16));

  async function openFile(d) {
    if (stateOf(d) !== "complete" || missing(d)) return;
    if (DownloadsCommon) await DownloadsCommon.openDownload(d);
    else { const f = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile); f.initWithPath(d.target.path); f.launch(); }
  }
  function reveal(d) {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(d.target.path);
    if (DownloadsCommon) DownloadsCommon.showDownloadedFile(file);
    else file.reveal();
  }

  function buttons(d, st) {
    const b = [];
    if (st === "inProgress") {
      if (d.hasPartialData) b.push(act("Duraklat", "pause", () => d.cancel()));
      b.push(act("İptal et", "close", async () => { await d.cancel(); await d.removePartialData(); }, "del"));
    } else if (st === "paused") {
      b.push(act("Sürdür", "play", () => d.start()));
      b.push(act("İptal et", "close", () => d.removePartialData(), "del"));
    } else if (st === "failed" || st === "canceled") {
      if (typeof d.start === "function" && d.source?.url && !d.placesNode) b.push(act("Yeniden dene", "retry", () => d.start()));
      b.push(act("Listeden kaldır", "close", () => list.remove(d), "del"));
    } else {
      if (!missing(d)) {
        b.push(act("Dosyayı aç", "external", () => openFile(d)));
        b.push(act("Klasörde göster", "folder", () => reveal(d)));
      }
      b.push(act("Listeden kaldır", "close", () => list.remove(d), "del"));
    }
    return b;
  }

  // ---- Satır ----
  function buildRow(d) {
    const badge = h("span", { class: "badge" });
    const t = h("span", { class: "t" });
    const s = h("span", { class: "s" });
    const src = h("span", { class: "src" });
    const bar = h("span", { class: "bar" }, h("span"));
    const acts = h("span", { class: "acts" });
    const time = h("span", { class: "meta" });
    const file = h("div", { class: "file", role: "button", tabindex: "0" }, badge, h("span", { class: "txt" }, h("span", { class: "line" }, t, src), s, bar));
    file.addEventListener("click", () => openFile(d).catch(e => toast(String(e.message ?? e), { error: true })));
    file.addEventListener("keydown", e => { if (e.key === "Enter") file.click(); });
    const el = h("div", { class: "lrow dl" }, time, file, acts);
    let lastState = null;
    const update = () => {
      const st = stateOf(d);
      const name = nameOf(d);
      el.dataset.state = st;
      el.classList.toggle("dead", st === "canceled" || st === "failed" || missing(d));
      badge.textContent = extOf(name) || "•";
      t.textContent = name;
      src.textContent = d.source?.url ? hostOf(d.source.url) : "";
      s.textContent = statusText(d, st);
      time.textContent = timeMs(d) ? timeOf(timeMs(d)) : "";
      const live = st === "inProgress" || st === "paused";
      bar.hidden = !live;
      if (live) {
        const pct = d.hasProgress && d.totalBytes ? Math.min(100, (d.currentBytes / d.totalBytes) * 100) : 0;
        bar.firstElementChild.style.width = (pct || (st === "paused" ? 0 : 28)) + "%";
        bar.classList.toggle("indet", !pct && st === "inProgress");
      }
      file.classList.toggle("openable", st === "complete" && !missing(d));
      file.setAttribute("aria-disabled", String(!(st === "complete" && !missing(d))));
      if (lastState !== st + missing(d) + !!d.hasPartialData) {
        lastState = st + missing(d) + !!d.hasPartialData;
        acts.replaceChildren(...buttons(d, st));
      }
    };
    update();
    return { el, update };
  }

  // ---- Liste ----
  const visible = () => {
    const needle = fold(query);
    return [...downloads].filter(d => !needle || fold(nameOf(d) + " " + (d.source?.url ?? "")).includes(needle))
      .sort((a, b) => timeMs(b) - timeMs(a));
  };
  function render() {
    const items = visible();
    const frag = [];
    let key = null, card = null;
    for (const d of items) {
      let r = rows.get(d);
      if (!r) rows.set(d, (r = buildRow(d)));
      const k = timeMs(d) ? dayKey(timeMs(d)) : "?";
      if (k !== key) {
        key = k;
        card = h("section", { class: "card" }, h("div", { class: "ghead" }, h("h3", { text: timeMs(d) ? dayLabel(timeMs(d)) : "Daha eski" })));
        frag.push(card);
      }
      card.append(r.el);
    }
    for (const [d, r] of rows) if (!downloads.has(d)) { r.el.remove(); rows.delete(d); }
    groups.replaceChildren(...frag);
    empty.hidden = items.length > 0;
    if (!empty.hidden) empty.replaceChildren(icon("download", 34), query ? "Eşleşen indirme yok." : "Henüz indirme yok.");
    clearBtn.hidden = ![...downloads].some(d => d.stopped && !(d.canceled && d.hasPartialData));
  }
  const renderSoon = debounce(render, 30);

  let raf = 0;
  const pending = new Set();
  const flush = () => {
    raf = 0;
    let structural = false;
    for (const d of pending) {
      const r = rows.get(d);
      if (!r) continue;
      const before = r.el.dataset.state;
      r.update();
      if (before !== r.el.dataset.state) structural = true;
    }
    pending.clear();
    if (structural) clearBtn.hidden = ![...downloads].some(d => d.stopped && !(d.canceled && d.hasPartialData));
  };

  const view = {
    onDownloadAdded(d) { downloads.add(d); renderSoon(); },
    onDownloadChanged(d) { pending.add(d); if (!raf) raf = requestAnimationFrame(flush); },
    onDownloadRemoved(d) { downloads.delete(d); rows.delete(d)?.el.remove(); renderSoon(); },
  };

  (async () => {
    try {
      list = await DownloadHistory.getList({ type: Downloads.PUBLIC, maxHistoryResults: 500 });
      if (disposed) return;
      for (const d of await list.getAll()) {
        downloads.add(d);
        try { if (d.succeeded && typeof d.refresh === "function") d.refresh().catch(() => {}); } catch {}
      }
      await list.addView(view);
      render();
    } catch (e) {
      console.error("[rigel-library] indirmeler", e);
      groups.replaceChildren(h("p", { class: "hint", text: "İndirmeler okunamadı: " + e }));
    }
  })();

  search.addEventListener("input", debounce(() => { query = search.value.trim(); render(); }, 120));
  search.addEventListener("keydown", e => { if (e.key === "Escape" && search.value) { search.value = ""; query = ""; render(); } });
  const onKey = e => {
    if ((e.ctrlKey && e.key === "f") || (e.key === "/" && !/^(input|select|textarea)$/i.test(e.target.tagName))) { e.preventDefault(); search.focus(); }
  };
  addEventListener("keydown", onKey);
  ctx.setTitle("İndirmeler");
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      list?.removeView(view);
      removeEventListener("keydown", onKey);
    },
  };
}
