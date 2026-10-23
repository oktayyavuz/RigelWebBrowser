// Zen modüllerinin küçük ortak yardımcıları: öğe kurma, çizgi ikonlar, tercih okuma.

const HTML = "http://www.w3.org/1999/xhtml";
const SVG = "http://www.w3.org/2000/svg";

export const BASE = "chrome://userscripts/content/";

const ICONS = {
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  expand: '<path d="M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5L13 11M4.5 19.5L11 13"/>',
  split: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M12 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
};

/** HTML öğesi kurar. props: class, on<olay>, text, diğerleri öznitelik. */
export function el(doc, tag, props = {}, ...children) {
  const e = doc.createElementNS(HTML, tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...children.filter(c => c != null && c !== false));
  return e;
}

export function icon(doc, name, size = 16) {
  const svg = doc.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true",
  })) svg.setAttribute(k, v);
  // Sabit, güvenilir yol verisi; dış girdi yok.
  const tmp = new DOMParser().parseFromString(`<svg xmlns="${SVG}">${ICONS[name] ?? ""}</svg>`, "image/svg+xml");
  for (const n of [...tmp.documentElement.childNodes]) svg.append(doc.importNode(n, true));
  return svg;
}

/** Dinleyici ve geri alma işlerini toplar; run() hepsini ters sırayla geri alır. */
export class Disposer {
  #fns = [];
  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.#fns.push(() => target.removeEventListener(type, fn, opts));
    return fn;
  }
  pref(name, fn) {
    const obs = { observe: () => fn() };
    Services.prefs.addObserver(name, obs);
    this.#fns.push(() => Services.prefs.removeObserver(name, obs));
  }
  add(fn) {
    this.#fns.push(fn);
  }
  run() {
    for (const fn of this.#fns.splice(0).reverse()) {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export function toast(win, text) {
  win.Rigel?.toast?.(text);
}
