// Bileşenlerin ortak küçük yardımcıları: öğe kurma, çizgi ikonlar (Icon.svelte ile aynı yollar),
// site simgesi ve kısa bildirim (toast). Çerçevesiz, yalın DOM.

const HTML = "http://www.w3.org/1999/xhtml";
const SVG = "http://www.w3.org/2000/svg";

export const ICONS = {
  back: '<path d="M15 6l-6 6 6 6"/>',
  forward: '<path d="M9 6l6 6-6 6"/>',
  reload: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.7 2.5 13.3 0 16M12 4c-2.5 2.7-2.5 13.3 0 16"/>',
  gear: '<path d="M4 7h9M19 7h1M4 17h3M13 17h7"/><circle cx="16" cy="7" r="2.5"/><circle cx="10" cy="17" r="2.5"/>',
  layout: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9h17M9 9v10.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  tab: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M8 6V4.5"/>',
  code: '<path d="M8.5 8l-4 4 4 4M15.5 8l4 4-4 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  split: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M12 5v14"/>',
  translate: '<path d="M4 5.5h9M8.5 3.5v2M6 5.5c0 4 2.5 7 6 8M11 5.5c0 3.5-2.5 6.5-6.5 8"/><path d="M13 20.5l4-9 4 9M14.4 17.5h5.2"/>',
  mask: '<path d="M3 10c3-1 6-1.5 9-1.5s6 .5 9 1.5c0 4-2 7-5 7-1.6 0-2.4-1.5-4-1.5S9.6 17 8 17c-3 0-5-3-5-7z"/><circle cx="8.5" cy="12" r="1.2"/><circle cx="15.5" cy="12" r="1.2"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  printer: '<path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7z"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4.5v3.5h3.5"/><path d="M12 8v4.5l3 2"/>',
  bookmark: '<path d="M7 4.5h10v15l-5-3.5-5 3.5z"/>',
  volume: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  volumeOff: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  thumbtack: '<path d="M9 4.5h6M10 4.5v5l-3 3.5h10l-3-3.5v-5M12 13v6.5"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  capture: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><circle cx="12" cy="12" r="3"/>',
  pip: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><rect x="12" y="11.5" width="6" height="5" rx="1" fill="currentColor"/>',
  power: '<path d="M12 4v7"/><path d="M7.5 6.8a7 7 0 1 0 9 0"/>',
  dots: '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
  bolt: '<path d="M13 3.5L5.5 13.5H12l-1 7 7.5-10H12z"/>',
};

/** HTML öğesi kurar. `on*` dinleyici, `class`, `text`, diğerleri öznitelik. */
export function el(doc, tag, props = {}, ...children) {
  const e = doc.createElementNS(HTML, tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

const parsed = new Map();
/** Çizgi ikon (24×24, stroke 1.7). Yol verisi sabit ve güvenilir; dış girdi yok. */
export function icon(doc, name, size = 16) {
  const svg = doc.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true",
  })) svg.setAttribute(k, v);
  let nodes = parsed.get(name);
  if (!nodes) {
    const tmp = new DOMParser().parseFromString(`<svg xmlns="${SVG}">${ICONS[name] ?? ICONS.globe}</svg>`, "image/svg+xml");
    nodes = [...tmp.documentElement.childNodes];
    parsed.set(name, nodes);
  }
  for (const n of nodes) svg.append(doc.importNode(n, true));
  return svg;
}

/** Site simgesi: önce verilen simge, yoksa Places'teki (`page-icon:`), o da yoksa küre. */
export function favicon(doc, { url, image } = {}, size = 18) {
  const wrap = el(doc, "span", { class: "rgl-fav" });
  wrap.style.width = wrap.style.height = size + "px";
  let src = image || null;
  if (!src && url && /^https?:/.test(url)) src = "page-icon:" + url;
  if (!src) {
    wrap.append(icon(doc, "globe", size - 2));
    return wrap;
  }
  const img = el(doc, "img", { src, width: size, height: size, alt: "", draggable: "false" });
  img.addEventListener("error", () => img.replaceWith(icon(doc, "globe", size - 2)), { once: true });
  wrap.append(img);
  return wrap;
}

export const hostOf = (url) => {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, "") : "";
  } catch { return ""; }
};

/** Kısayol metni: "Ctrl+Shift+A" → "Ctrl ⇧ A" değil; tasarımda olduğu gibi aynen gösterilir. */
export const kbdText = (combo) => String(combo).replace(/\+(?=.)/g, "+");

/** Küçük hap bildirim; tıklamaları engellemez, 2.5 sn sonra kaybolur. */
export function toast(win, text, { error } = {}) {
  const doc = win.document;
  doc.getElementById("rigel-toast")?.remove();
  const failed = error ?? /alınamadı|kaydedilemedi|başarısız|hata|yok|bulunamadı/i.test(text);
  const t = el(doc, "div", { id: "rigel-toast", class: failed ? "failed" : "", role: "status" },
    icon(doc, failed ? "close" : "check", 14), el(doc, "span", { text }));
  doc.documentElement.append(t);
  win.setTimeout(() => t.remove(), 2600);
}
