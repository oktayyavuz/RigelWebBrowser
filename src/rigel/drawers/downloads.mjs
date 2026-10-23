// İndirmeler paneli (DownloadsPanel.svelte): Firefox'un indirme listesi (Downloads.getList(ALL)),
// dosya türü rozeti çevresinde ilerleme halkası. Yeni indirme başlayınca kendiliğinden açılır
// (rigel.downloads.autoOpen, varsayılan true).
import { el, icon } from "../commands/ui.mjs";

const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
const SVG = "http://www.w3.org/2000/svg";
const R = 21; // halka yarıçapı
const CIRC = 2 * Math.PI * R;

export function bytes(n) {
  if (!(n >= 0)) return "";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString("tr", { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
}
export function duration(s) {
  if (!isFinite(s) || s < 0) return "";
  if (s < 60) return `${Math.ceil(s)} sn`;
  if (s < 3600) return `${Math.ceil(s / 60)} dk`;
  return `${Math.floor(s / 3600)} sa ${Math.ceil((s % 3600) / 60)} dk`;
}

const stateOf = (d) => (d.succeeded ? "complete" : d.canceled ? "canceled" : d.error ? "failed" : d.stopped ? "paused" : "inProgress");
const nameOf = (d) => {
  try { return PathUtils.filename(d.target.path); } catch { return ""; }
};
const ext = (name) => /\.([a-z0-9]{1,4})$/i.exec(name)?.[1].toUpperCase() ?? "";

function status(d) {
  const st = stateOf(d);
  if (st === "canceled") return "İptal edildi";
  if (st === "failed") return "Başarısız";
  if (st === "complete") return bytes(d.totalBytes || d.currentBytes) + (d.target?.exists === false ? " · dosya yok" : "");
  const total = d.hasProgress ? d.totalBytes : 0;
  const done = total ? `${bytes(d.currentBytes)} / ${bytes(total)}` : bytes(d.currentBytes);
  if (st === "paused") return `${done} · duraklatıldı`;
  if (!d.speed) return done;
  const left = total ? ` · ${duration((total - d.currentBytes) / d.speed)} kaldı` : "";
  return `${done} · ${bytes(d.speed)}/sn${left}`;
}

export function createDownloadsPanel(win, drawers) {
  const doc = win.document;
  let shown = false;
  let ready = false;
  let raf = 0;
  let list = null;
  const downloads = []; // en yeni başta

  const listEl = el(doc, "div", { class: "rgl-dr-list" });
  const clearBtn = el(doc, "button", { onclick: () => list?.removeFinished() }, "Listeyi temizle");
  const footer = el(doc, "footer", { hidden: true }, clearBtn);
  const element = el(doc, "section", { class: "rgl-panel rgl-downloads", tabindex: "-1" },
    el(doc, "header", {},
      el(doc, "h2", { text: "İndirmeler" }),
      el(doc, "button", { class: "rgl-tool rgl-close", title: "Kapat (Esc)", onclick: () => drawers.close() }, icon(doc, "close", 14))),
    listEl, footer);

  const schedule = () => {
    if (!shown || raf) return;
    raf = win.requestAnimationFrame(() => { raf = 0; render(); });
  };

  const view = {
    onDownloadAdded(d) {
      downloads.unshift(d);
      // Oturum içinde yeni başlayan indirme: paneli aç (yalnız en öndeki pencerede).
      if (ready && !d.succeeded && Services.prefs.getBoolPref("rigel.downloads.autoOpen", true)
          && Services.wm.getMostRecentWindow("navigator:browser") === win && drawers.current() !== "downloads") {
        drawers.open("downloads");
      }
      schedule();
    },
    onDownloadChanged: schedule,
    onDownloadRemoved(d) {
      const i = downloads.indexOf(d);
      if (i >= 0) downloads.splice(i, 1);
      schedule();
    },
  };

  (async () => {
    list = await Downloads.getList(Downloads.ALL);
    await list.addView(view);
    // addView mevcutları eski→yeni sırayla verir; unshift sayesinde en yeni başta.
    ready = true;
    schedule();
  })().catch((e) => win.console.error("[rigel] indirmeler", e));
  win.addEventListener("unload", () => list?.removeView(view), { once: true });

  function ring(d, st) {
    const svg = doc.createElementNS(SVG, "svg");
    svg.setAttribute("class", "ring");
    svg.setAttribute("viewBox", "0 0 48 48");
    const mk = (cls) => {
      const c = doc.createElementNS(SVG, "circle");
      for (const [k, v] of Object.entries({ cx: 24, cy: 24, r: R, class: cls })) c.setAttribute(k, v);
      svg.append(c);
      return c;
    };
    mk("track");
    const bar = mk("bar" + (d.hasProgress ? "" : " indet"));
    const p = d.hasProgress ? Math.max(0, Math.min(100, d.progress)) / 100 : 0.25;
    bar.setAttribute("stroke-dasharray", `${CIRC * p} ${CIRC}`);
    if (st !== "inProgress") svg.setAttribute("paused", "true");
    return svg;
  }

  function render() {
    const frag = doc.createDocumentFragment();
    for (const d of downloads) {
      const st = stateOf(d);
      const name = nameOf(d);
      const running = st === "inProgress" || st === "paused";
      const badge = el(doc, "span", { class: "badge" }, el(doc, "span", { class: "ext", text: ext(name) || "?" }), running ? ring(d, st) : null);
      const file = el(doc, "button", {
        class: "file", disabled: st !== "complete", title: st === "complete" ? `Aç: ${name}` : name,
        onclick: () => d.launch().catch((e) => win.console.error(e)),
      }, badge, el(doc, "span", { class: "txt" },
        el(doc, "span", { class: "t", text: name || "İndiriliyor…" }),
        el(doc, "span", { class: "s", text: status(d) })));
      const tools = [];
      if (running) {
        tools.push(el(doc, "button", { class: "rgl-tool", title: "İptal et", onclick: () => d.cancel() }, icon(doc, "close", 14)));
      } else if (st === "complete") {
        tools.push(el(doc, "button", { class: "rgl-tool", title: "Klasörde göster", onclick: () => d.showContainingDirectory().catch(() => {}) }, icon(doc, "folder", 16)));
      } else {
        tools.push(el(doc, "button", { class: "rgl-tool", title: "Yeniden dene", onclick: () => d.start().catch(() => {}) }, icon(doc, "reload", 15)));
      }
      frag.append(el(doc, "div", { class: "rgl-dl " + st }, file, ...tools));
    }
    if (!downloads.length) frag.append(el(doc, "p", { class: "rgl-empty", text: "İndirme yok" }));
    listEl.replaceChildren(frag);
    footer.hidden = !downloads.some((d) => d.stopped);
  }

  return {
    element,
    show() { shown = true; render(); element.focus(); },
    hide() { shown = false; },
    get items() { return downloads.map((d) => ({ name: nameOf(d), state: stateOf(d), progress: d.progress })); },
  };
}
