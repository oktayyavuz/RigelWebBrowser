// Geçmiş: Places veritabanından gün gün gruplu, aranabilir, sayfalı liste. Silme: giriş / gün / son bir saat / hepsi.
import { h, icon, favicon, hostOf, dayKey, dayLabel, dayRange, timeOf, whereOf, openUrl, toast, confirmButton, infiniteScroll, debounce } from "./ui.mjs";

const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
const PAGE = 100;

const likeEsc = s => s.replace(/[\\%_]/g, c => "\\" + c);

/** Son ziyarete göre azalan sayfa. cursor: { d, id } sonrasını getirir (anahtar kümeli sayfalama: büyük geçmişte hızlı). */
async function fetchPage(query, cursor, limit = PAGE) {
  const conn = await PlacesUtils.promiseDBConnection();
  const where = ["p.last_visit_date IS NOT NULL", "p.visit_count > 0", "p.hidden = 0", "substr(p.url, 1, 6) <> 'place:'"];
  const params = { limit };
  query.split(/\s+/).filter(Boolean).slice(0, 6).forEach((w, i) => {
    where.push(`(p.title LIKE :t${i} ESCAPE '\\' OR p.url LIKE :t${i} ESCAPE '\\')`);
    params["t" + i] = `%${likeEsc(w)}%`;
  });
  if (cursor) {
    where.push("(p.last_visit_date < :cd OR (p.last_visit_date = :cd AND p.id < :cid))");
    params.cd = cursor.d;
    params.cid = cursor.id;
  }
  const rows = await conn.executeCached(
    `SELECT p.id, p.url, p.title, p.last_visit_date AS d,
            EXISTS (SELECT 1 FROM moz_pages_w_icons i WHERE i.page_url_hash = hash(p.url) AND i.page_url = p.url) AS icon
     FROM moz_places p
     WHERE ${where.join(" AND ")} ORDER BY p.last_visit_date DESC, p.id DESC LIMIT :limit`, params);
  return rows.map(r => ({ id: r.getResultByName("id"), url: r.getResultByName("url"), title: r.getResultByName("title") || "", icon: !!r.getResultByName("icon"), d: r.getResultByName("d"), ms: r.getResultByName("d") / 1000 }));
}

export function mount(root, ctx) {
  let query = "";
  let items = [];
  let done = false;
  let busy = false;
  let gen = 0;

  const search = h("input", { type: "search", placeholder: "Geçmişte ara", spellcheck: "false", "aria-label": "Geçmişte ara" });
  const hourBtn = h("button", { class: "btn soft", title: "Son bir saatte açılan sayfaları geçmişten siler" }, icon("clock", 15), "Son bir saati sil");
  const allBtn = h("button", { class: "btn danger" }, icon("trash", 15), "Tümünü sil");
  const list = h("div", { class: "groups" });
  const empty = h("div", { class: "empty", hidden: true });
  const sentinel = h("div", { class: "sentinel" });
  root.append(
    h("header", { class: "phead" }, h("div", { class: "ptitle" }, h("h2", { text: "Geçmiş" }), h("p", { text: "Gezdiğin sayfalar, gün gün." })),
      h("div", { class: "tools" }, hourBtn, allBtn)),
    h("label", { class: "search" }, icon("search", 15), search),
    list, empty, sentinel);

  confirmButton(hourBtn, "", async () => {
    await PlacesUtils.history.removeVisitsByFilter({ beginDate: new Date(Date.now() - 3600_000), endDate: new Date() });
    toast("Son bir saat silindi");
    reload();
  });
  confirmButton(allBtn, "", async () => {
    await PlacesUtils.history.clear();
    toast("Geçmiş temizlendi");
    reload();
  });

  // ---- Çizim ----
  let lastKey = null, lastCard = null;
  function rowOf(it) {
    const a = h("a", { class: "link", href: it.url, title: it.url },
      favicon(it.url, it.title, 18, it.icon),
      h("span", { class: "t", text: it.title || it.url }),
      h("span", { class: "h", text: hostOf(it.url) }));
    a.addEventListener("click", e => { e.preventDefault(); openUrl(it.url, whereOf(e)); });
    a.addEventListener("auxclick", e => { if (e.button === 1) { e.preventDefault(); openUrl(it.url, "tabshifted"); } });
    const row = h("div", { class: "lrow" },
      h("span", { class: "meta", text: query ? new Date(it.ms).toLocaleDateString("tr", { day: "numeric", month: "short" }) + " " + timeOf(it.ms) : timeOf(it.ms) }),
      a,
      h("button", { class: "act", title: "Yeni sekmede aç", "aria-label": "Yeni sekmede aç", onclick: () => openUrl(it.url, "tab") }, icon("tabPlus", 16)),
      h("button", { class: "act del", title: "Geçmişten sil", "aria-label": "Geçmişten sil", onclick: async () => {
        await PlacesUtils.history.remove(it.url);
        items = items.filter(x => x.id !== it.id);
        row.remove();
        if (!items.length) reload();
      } }, icon("close", 15)));
    return row;
  }

  function dayHead(it) {
    const label = h("h3", { text: dayLabel(it.ms) });
    const del = h("button", { class: "act del tiny", title: "Bu günün geçmişini sil", "aria-label": "Bu günün geçmişini sil" }, icon("trash", 14));
    confirmButton(del, "", async () => {
      const { begin, end } = dayRange(it.ms);
      await PlacesUtils.history.removeVisitsByFilter({ beginDate: begin, endDate: end });
      toast(`${dayLabel(it.ms)} silindi`);
      reload();
    });
    return h("div", { class: "ghead" }, label, del);
  }

  function append(batch) {
    for (const it of batch) {
      const key = query ? "q" : dayKey(it.ms);
      if (key !== lastKey) {
        lastKey = key;
        lastCard = h("section", { class: "card" }, query ? h("div", { class: "ghead" }, h("h3", { text: "Sonuçlar" })) : dayHead(it));
        list.append(lastCard);
      }
      lastCard.append(rowOf(it));
    }
  }

  function showEmpty() {
    empty.hidden = items.length > 0;
    if (!empty.hidden) empty.replaceChildren(icon("history", 34), query ? "Eşleşen sayfa yok." : "Geçmiş boş. Gizli sekmelerde gezdiklerin buraya yazılmaz.");
    const idle = !query && !items.length;
    hourBtn.hidden = allBtn.hidden = idle || !!query;
  }

  async function more() {
    if (busy || done) return;
    busy = true;
    const mine = gen;
    try {
      const batch = await fetchPage(query, items.at(-1) && { d: items.at(-1).d, id: items.at(-1).id });
      if (mine !== gen) return;
      if (batch.length < PAGE) done = true;
      items.push(...batch);
      append(batch);
      showEmpty();
    } catch (e) {
      console.error("[rigel-library] geçmiş", e);
      done = true; // hatada döngüye girme
    } finally {
      busy = false;
    }
    // Sayfa kısa kaldıysa (büyük ekran) görünür alan dolana dek yükle.
    if (mine === gen && !done && sentinel.getBoundingClientRect().top < innerHeight + 300) more();
  }

  /** Baştan yükler; `keep` kadar öğeyi (kaydırma konumunu bozmadan) yeniden getirir. */
  async function reload(keep = PAGE) {
    gen++;
    const mine = gen;
    busy = true;
    try {
      const batch = await fetchPage(query, null, Math.max(PAGE, keep));
      if (mine !== gen) return;
      items = batch;
      done = batch.length < Math.max(PAGE, keep);
      list.replaceChildren();
      lastKey = lastCard = null;
      append(batch);
      showEmpty();
    } catch (e) {
      console.error("[rigel-library] geçmiş", e);
      done = true; // hatada döngüye girme
    } finally {
      if (mine === gen) busy = false;
    }
    if (mine === gen && !done && sentinel.getBoundingClientRect().top < innerHeight + 300) more();
  }

  search.addEventListener("input", debounce(() => { query = search.value.trim(); reload(); }, 160));
  search.addEventListener("keydown", e => { if (e.key === "Escape" && search.value) { search.value = ""; query = ""; reload(); } });
  const onKey = e => {
    if ((e.ctrlKey && e.key === "f") || (e.key === "/" && !/^(input|select|textarea)$/i.test(e.target.tagName))) { e.preventDefault(); search.focus(); }
  };
  addEventListener("keydown", onKey);
  const stopScroll = infiniteScroll(sentinel, more);

  // Canlı güncelleme: yeni ziyaret / silme
  const refresh = debounce(() => { if (!document.hidden) reload(items.length); }, 600);
  const events = ["page-visited", "page-removed", "history-cleared", "page-title-changed"];
  const listener = () => refresh();
  PlacesUtils.observers.addListener(events, listener);
  const onVis = () => { if (!document.hidden) refresh(); };
  document.addEventListener("visibilitychange", onVis);

  ctx.setTitle("Geçmiş");
  reload();
  return {
    dispose() {
      gen++;
      stopScroll();
      PlacesUtils.observers.removeListener(events, listener);
      removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}
