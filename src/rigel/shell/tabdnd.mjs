// Sekme sürükle-bırak: Ada yıldızları, Dock sekmeleri ve sekme çekmecesi listesi için ortak parça.
//
// - Kapsayıcıdaki `.tab` özelliği olan çocuklar sürüklenebilir sekme düğmeleridir (bindTab ve çekmece satırı koyar).
// - Sıralama gBrowser.moveTabBefore/After (çoklu seçimde moveTabsBefore/After) ile yapılır; Firefox
//   sabitlenmiş ile sabitlenmemişi karıştırmaz, biz de göstergeyi aynı sınıra sıkıştırırız.
// - Yalnızca görünür sekmeler listelenir (başka alanın sekmeleri gizli); hedef hep görünür bir komşu olduğundan
//   sekmeler alan değiştirmez. Alan üyeliği özniteliktir, sıra ona etki etmez.
// - Gruplar: iki sekme arasına (aynı grubun üyeleri arasına) bırakmak gruba sokar/grupta tutar. Grup sınırına
//   bırakmak sekmeyi grubun dışında bırakır (sekme zaten o grubun üyesi değilse). Grup üyesi bir sekmenin
//   üstüne bırakmak sekmeyi o gruba ekler (üyenin yanına yerleşir); grupsuz sekmenin üstüne ya da aralığa
//   bırakmak grubun dışında bırakır. Grup üyeleri görünümlerde renkli alt çizgi taşır (bindTab → data-rigel-group).
// - Sürükleme sürerken özel görünümler yeniden çizilmez (watchTabs → afterTabDrag), yoksa sürüklenen düğme kaybolur.
// - Dışarı sürüklemek: bırakma hiçbir yerde kabul edilmediyse ve imleç pencerenin dışında ya da sayfa alanındaysa
//   sekme yeni pencereye ayrılır (gBrowser.replaceTabWithWindow).
// - Başka pencerenin sekmesi (Firefox'un ya da Rigel görünümünün) bırakılırsa gBrowser.adoptTab ile alınır.
// - Bağlantı/URL bırakmak yeni sekmede açar (bırakılan konuma yerleşir).

const HTML = "http://www.w3.org/1999/xhtml";
export const TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";
const LINK_TYPES = ["text/x-moz-url", "text/uri-list", "text/x-moz-text-internal", "text/plain"];

// --- Sürükleme sırasında yeniden çizimi beklet -------------------------------------------------

const holds = new WeakMap(); // pencere → { active, queue }
const hold = win => {
  let h = holds.get(win);
  if (!h) holds.set(win, (h = { active: false, queue: new Set() }));
  return h;
};

export const isTabDragging = win => holds.get(win)?.active === true;

/** Sürükleme bitene dek bekler; sürükleme yoksa fn hemen çalışır. */
export function afterTabDrag(win, fn) {
  if (!isTabDragging(win)) return fn();
  hold(win).queue.add(fn);
}

function endHold(win) {
  const h = hold(win);
  if (!h.active && !h.queue.size) return;
  h.active = false;
  const q = [...h.queue];
  h.queue.clear();
  for (const fn of q) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
}

// --- Bağlantı bırakma ---------------------------------------------------------------------------

const canDropLink = e => {
  const dt = e.dataTransfer;
  if (!dt || dt.types.includes(TAB_DROP_TYPE)) return false;
  if (!dt.files?.length && !LINK_TYPES.some(t => dt.types.includes(t))) return false;
  try {
    return Services.droppedLinkHandler.canDropLink(e, false);
  } catch {
    return false;
  }
};

/** Bırakılan bağlantıları yeni sekmelerde açar; place(tab, i) her sekmeyi yerine koyar. */
function openDroppedLinks(win, e, place) {
  const { gBrowser } = win;
  let links;
  try {
    links = Services.droppedLinkHandler.dropLinks(e, true);
  } catch (err) {
    win.dump(`[rigel] bırakılan bağlantı geçersiz: ${err}\n`);
    return [];
  }
  let principal = null;
  try {
    principal = Services.droppedLinkHandler.getTriggeringPrincipal(e);
  } catch {}
  const opened = [];
  links.forEach((link, i) => {
    if (!link?.url) return;
    try {
      const tab = gBrowser.addTab(link.url, {
        triggeringPrincipal: principal ?? Services.scriptSecurityManager.getSystemPrincipal(),
        inBackground: i > 0,
      });
      place?.(tab, i);
      if (i === 0) gBrowser.selectedTab = tab;
      opened.push(tab);
    } catch (err) {
      win.dump(`[rigel] bağlantı açılamadı (${link.url}): ${err}\n`);
    }
  });
  return opened;
}

/** Sekme listesi olmayan öğelere (ör. Komuta'daki adres/sayaç) bağlantı bırakmayı açar; sonda yeni sekme. */
export function enableLinkDrop(win, node) {
  const over = e => {
    if (!canDropLink(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "link";
    node.classList.add("drop-link");
  };
  const off = () => node.classList.remove("drop-link");
  const drop = e => {
    off();
    if (!canDropLink(e)) return;
    e.preventDefault();
    e.stopPropagation();
    openDroppedLinks(win, e);
  };
  node.addEventListener("dragenter", over);
  node.addEventListener("dragover", over);
  node.addEventListener("dragleave", off);
  node.addEventListener("drop", drop);
  return () => {
    for (const [t, f] of [["dragenter", over], ["dragover", over], ["dragleave", off], ["drop", drop]]) {
      node.removeEventListener(t, f);
    }
  };
}

// --- Sıralama -----------------------------------------------------------------------------------

/**
 * @param win        tarayıcı penceresi
 * @param container  sekme düğmelerinin (çocukların `.tab` özelliği var) ve yalnız onların yaşadığı öğe
 * @param opts.axis  "x" (yatay şerit) ya da "y" (dikey liste)
 * @returns          kaldırma işlevi
 */
export function enableTabDnD(win, container, { axis = "x" } = {}) {
  const doc = win.document;
  const { gBrowser } = win;
  const horiz = axis === "x";
  const line = doc.createElementNS(HTML, "div");
  line.className = "rigel-dropline";
  line.setAttribute("data-axis", axis);
  line.hidden = true;

  let dragged = null; // bu pencerede sürüklenen sekmeler
  let last = null; // son konum ({ pos, side, noop, list, src })
  const offs = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    offs.push(() => target.removeEventListener(type, fn, opts));
  };

  const items = () => [...container.children].filter(n => n.tab && n.tab.isConnected);
  const itemOf = node => {
    let n = node;
    while (n && n.parentNode !== container) n = n.parentNode;
    return n?.tab ? n : null;
  };

  /** Bırakma türü: "tab" (sekme), "link" (URL) ya da null (kabul etme). */
  function kindOf(e) {
    const dt = e.dataTransfer;
    if (!dt) return null;
    if (dt.types.includes(TAB_DROP_TYPE)) return "tab";
    return canDropLink(e) ? "link" : null;
  }

  function sourceTab(e) {
    if (dragged) return dragged[0];
    try {
      const t = e.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
      return t?.localName === "tab" ? t : null;
    } catch {
      return null;
    }
  }

  /** İmlecin altındaki ekleme konumu. side: imleç hangi komşunun üstünde ("prev": soldaki/üstteki, "next": sağdaki/alttaki). */
  function locate(e, src) {
    const list = items();
    if (!list.length) return { pos: 0, list, src };
    const p = horiz ? e.clientX : e.clientY;
    let pos = list.length;
    let side = "next"; // son öğenin ötesi: dışarıda say
    for (let i = 0; i < list.length; i++) {
      const r = list[i].getBoundingClientRect();
      const a = horiz ? r.left : r.top;
      const b = horiz ? r.right : r.bottom;
      if (p > b) continue;
      const before = p < (a + b) / 2;
      pos = before ? i : i + 1;
      side = p < a ? "next" : before ? "next" : "prev"; // aralıkta: sonraki öğeye ait
      break;
    }
    // Sabitlenmişler ve diğerleri arasındaki sınırı koru.
    const pinned = list.filter(n => n.tab.pinned).length;
    pos = src?.pinned ? Math.min(pos, pinned) : Math.max(pos, pinned);
    let noop = false;
    if (dragged) {
      const idx = dragged.map(t => list.findIndex(n => n.tab === t)).filter(i => i >= 0).sort((x, y) => x - y);
      noop = idx.length > 0 && idx[idx.length - 1] - idx[0] + 1 === idx.length && pos >= idx[0] && pos <= idx[idx.length - 1] + 1;
    }
    return { pos, side, noop, list, src };
  }

  /**
   * pos'taki ekleme için gBrowser'a verilecek komşu: { el, before }.
   * Grup kuralı: imleç bir grup üyesinin üstündeyse sekme o gruba girer (iki üye arası dahil), grupsuz
   * bir sekmenin üstünde ya da aralıktaysa grubun dışında kalır.
   */
  function resolve({ pos, side, list }) {
    const prev = list[pos - 1]?.tab;
    const next = list[pos]?.tab;
    if (prev && next && prev.group === next.group) return { el: next, before: true };
    if (side === "prev" && prev) return { el: prev, before: false }; // üyenin yanı: grup komşusuyla aynı yerde kalır
    if (next) return { el: next, before: true };
    // Son öğenin ötesi: grubun içinde değil, dışında.
    return { el: prev?.group ?? prev, before: false };
  }

  function placeTabs(tabs, loc) {
    const { el, before } = resolve(loc);
    if (!el) return;
    if (tabs.length > 1) (before ? gBrowser.moveTabsBefore : gBrowser.moveTabsAfter).call(gBrowser, tabs, el);
    else (before ? gBrowser.moveTabBefore : gBrowser.moveTabAfter).call(gBrowser, tabs[0], el);
  }

  // --- Görsel ipuçları ---
  function clearVisuals() {
    line.hidden = true;
    last = null;
  }

  function showVisuals(loc) {
    last = loc;
    if (loc.noop || !loc.list.length) {
      line.hidden = true;
      return;
    }
    const { list, pos } = loc;
    const cr = container.getBoundingClientRect();
    const ref = list[Math.min(pos, list.length - 1)].getBoundingClientRect();
    const lead = pos < list.length ? ref : list[pos - 1].getBoundingClientRect();
    let at;
    if (pos > 0 && pos < list.length) {
      const pr = list[pos - 1].getBoundingClientRect();
      at = horiz ? (pr.right + ref.left) / 2 : (pr.bottom + ref.top) / 2;
    } else if (pos === 0) {
      at = horiz ? ref.left - 1 : ref.top;
    } else {
      at = horiz ? lead.right + 1 : lead.bottom;
    }
    if (!line.parentNode) container.append(line);
    if (horiz) {
      const h = Math.min(lead.height, 30) * 0.9;
      line.style.cssText = `left:${at - cr.left - container.clientLeft + container.scrollLeft - 1}px;` +
        `top:${ref.top - cr.top - container.clientTop + container.scrollTop + (ref.height - h) / 2}px;height:${h}px`;
    } else {
      line.style.cssText = `top:${at - cr.top - container.clientTop + container.scrollTop - 1}px;` +
        `left:${ref.left - cr.left - container.clientLeft + container.scrollLeft + 4}px;width:${ref.width - 8}px`;
    }
    line.hidden = false;
  }

  // --- Olaylar ---
  on(container, "dragstart", e => {
    const item = itemOf(e.target);
    if (!item || !e.dataTransfer) return;
    const tab = item.tab;
    const visible = new Set(items().map(n => n.tab));
    dragged = tab.multiselected ? gBrowser.selectedTabs.filter(t => visible.has(t)) : [tab];
    if (!dragged.includes(tab)) dragged = [tab];
    const dt = e.dataTransfer;
    dt.mozSetDataAt(TAB_DROP_TYPE, tab, 0);
    dt.effectAllowed = "copyMove";
    hold(win).active = true;
    win.setTimeout(() => {
      for (const n of items()) n.classList.toggle("dragging", dragged?.includes(n.tab) ?? false);
    }, 0);
  });

  const over = e => {
    const kind = kindOf(e);
    if (!kind) return;
    e.preventDefault();
    const src = kind === "tab" ? sourceTab(e) : null;
    const foreign = kind === "tab" && !dragged;
    e.dataTransfer.dropEffect = kind === "link" ? "link" : foreign ? "move" : "move";
    showVisuals(locate(e, src));
  };
  on(container, "dragenter", over);
  on(container, "dragover", over);

  on(container, "dragleave", e => {
    if (!container.contains(e.relatedTarget)) clearVisuals();
  });

  on(container, "drop", e => {
    const kind = kindOf(e);
    if (!kind) return;
    e.preventDefault();
    e.stopPropagation();
    const src = kind === "tab" ? sourceTab(e) : null;
    const loc = locate(e, src);
    clearVisuals();
    try {
      if (kind === "tab" && dragged) {
        if (!loc.noop) placeTabs(dragged, loc);
      } else if (kind === "tab") {
        adopt(e, loc);
      } else {
        let ref = loc;
        openDroppedLinks(win, e, (tab, i) => {
          if (i === 0 || !ref.el) placeTabs([tab], loc);
          else gBrowser.moveTabAfter(tab, ref.el);
          ref = { el: tab };
        });
      }
    } catch (err) {
      win.dump(`[rigel] sekme bırakılamadı: ${err}\n${err.stack}\n`);
    }
    // Bırakılan sekme/bağlantı hemen çizilsin.
    endHold(win);
  });

  /** Başka pencerenin sekmesini al. */
  function adopt(e, loc) {
    const src = sourceTab(e);
    if (!src || src.ownerDocument.defaultView === win) return;
    const other = src.ownerDocument.defaultView.gBrowser;
    const tabs = src.multiselected ? other.selectedTabs : [src];
    const { el, before } = resolve(loc);
    let index = el ? (el.localName === "tab" ? el.elementIndex ?? gBrowser.tabs.indexOf(el) : gBrowser.tabs.indexOf(el.tabs?.[0])) : gBrowser.tabs.length;
    if (el && !before) index += el.localName === "tab" ? 1 : el.tabs?.length ?? 1;
    if (index < 0) index = gBrowser.tabs.length;
    for (const t of tabs) {
      const added = gBrowser.adoptTab(t, { tabIndex: index++, selectTab: t === tabs[0] });
      if (!added) index--;
    }
  }

  /** Bırakma hiçbir yerde kabul edilmediyse ve imleç pencere dışında ya da sayfa alanındaysa yeni pencereye ayır. */
  function maybeDetach(e) {
    const dt = e.dataTransfer;
    if (!dragged || !dt || dt.dropEffect !== "none" || dt.mozUserCancelled) return;
    const tab = dragged[0];
    if (!tab?.isConnected || gBrowser.tabs.length < 2) return;
    const sx = e.screenX;
    const sy = e.screenY;
    const ox = win.mozInnerScreenX;
    const oy = win.mozInnerScreenY;
    const inWin = sx > ox && sy > oy && sx < ox + win.innerWidth && sy < oy + win.innerHeight;
    let inContent = false;
    if (inWin) {
      const r = gBrowser.selectedBrowser.getBoundingClientRect();
      inContent = sx - ox >= r.left && sx - ox <= r.right && sy - oy >= r.top && sy - oy <= r.bottom;
    }
    if (inWin && !inContent) return;
    const features = sx > 0 && sy > 0 ? { screenX: Math.round(sx - 40), screenY: Math.round(sy - 20) } : {};
    gBrowser.replaceTabWithWindow(tab, features);
  }

  on(container, "dragend", e => {
    const finish = () => {
      for (const n of items()) n.classList.remove("dragging");
      clearVisuals();
      dragged = null;
      endHold(win);
    };
    try {
      maybeDetach(e);
    } catch (err) {
      win.dump(`[rigel] sekme ayrılamadı: ${err}\n`);
    }
    finish();
  });
  // Kaynak düğme DOM'dan gittiyse bile bekletme kalkar.
  on(win, "dragend", () => {
    if (!dragged) return;
    win.setTimeout(() => {
      if (!dragged) return;
      for (const n of items()) n.classList.remove("dragging");
      clearVisuals();
      dragged = null;
      endHold(win);
    }, 50);
  }, true);

  return () => {
    for (const off of offs.splice(0)) off();
    line.remove();
    clearVisuals();
    dragged = null;
    endHold(win);
  };
}
