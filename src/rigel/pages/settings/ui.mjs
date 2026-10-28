// Ayarlar ve kurulum sihirbazı için ortak yardımcılar: DOM kurma, tercih okuma/yazma/izleme,
// tema takibi, düzen önizlemeleri, anahtar / segment / seçim denetimleri. Çerçeve yok.
// Sayfalar chrome:// olduğundan `Services`, `Ci`, `ChromeUtils` doğrudan kullanılabilir.

const SVGNS = "http://www.w3.org/2000/svg";

// ---- DOM ----
/** h("div", { class, text, onclick, … }, ...çocuklar). `on*` dinleyici, `html` ham işaretleme (yalnız sabit metin). */
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "value" || k === "checked" || k === "disabled" || k === "hidden") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  append(e, kids);
  return e;
}
export function append(e, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return e;
}

// ---- Simgeler (commands/ui.mjs ile aynı çizgi dili, 24x24) ----
export const ICONS = {
  layout: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9h17M9 9v10.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  tab: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M8 6V4.5"/>',
  shield: '<path d="M12 3.5l7 2.8v5.4c0 4.2-2.9 7.6-7 8.8-4.1-1.2-7-4.6-7-8.8V6.3z"/><path d="M9 12l2.2 2.2L15.2 10"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.7 2.5 13.3 0 16M12 4c-2.5 2.7-2.5 13.3 0 16"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  translate: '<path d="M4 5.5h9M8.5 3.5v2M6 5.5c0 4 2.5 7 6 8M11 5.5c0 3.5-2.5 6.5-6.5 8"/><path d="M13 20.5l4-9 4 9M14.4 17.5h5.2"/>',
  cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3.5v3M15 3.5v3M9 17.5v3M15 17.5v3M3.5 9h3M3.5 15h3M17.5 9h3M17.5 15h3"/>',
  keyboard: '<rect x="3" y="6.5" width="18" height="11" rx="2.5"/><path d="M7 10.5h.01M10.5 10.5h.01M14 10.5h.01M17.5 10.5h.01M8 14h8"/>',
  import: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  external: '<path d="M14 5h5v5M19 5l-8 8M17 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V9a1.5 1.5 0 0 1 1.5-1.5H10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
  brush: '<path d="M14.5 4.5l5 5-8 8H6.5v-5z"/><path d="M4 20c1.5-.2 2.5-.9 2.5-2.5"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12h8.4L17 7"/>',
};
export function icon(name, size = 18) {
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", size);
  s.setAttribute("height", size);
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.7");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONS[name] ?? "";
  return s;
}

/** Rigel logosu (theme/logo.svg ile aynı çizim). */
export function logo(size = 24) {
  const id = "lg" + Math.random().toString(36).slice(2, 7);
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("viewBox", "0 0 32 32");
  s.setAttribute("width", size);
  s.setAttribute("height", size);
  s.setAttribute("fill", "none");
  s.innerHTML = `<defs>
    <linearGradient id="${id}r" x1="3" y1="29" x2="29" y2="3" gradientUnits="userSpaceOnUse"><stop stop-color="#5b86e0"/><stop offset="0.6" stop-color="#5fa9dd"/><stop offset="1" stop-color="#7cc3dc"/></linearGradient>
    <linearGradient id="${id}s" x1="8" y1="6" x2="25" y2="26" gradientUnits="userSpaceOnUse"><stop stop-color="#7cc3dc"/><stop offset="0.55" stop-color="#5fa9dd"/><stop offset="1" stop-color="#5b86e0"/></linearGradient></defs>
    <circle cx="16" cy="16" r="12.6" stroke="url(#${id}r)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="60.168 19" stroke-dashoffset="-0.792" opacity="0.9"/>
    <circle cx="25.9" cy="7.6" r="2.5" fill="url(#${id}r)"/>
    <path d="M16 6.4C16 11.1 18.9 15.3 23.6 16C18.9 16.7 16 20.9 16 25.6C16 20.9 13.1 16.7 8.4 16C13.1 15.3 16 11.1 16 6.4Z" fill="url(#${id}s)"/>`;
  return s;
}

// ---- Tercihler ----
const P = Services.prefs;
export function getPref(name, def) {
  switch (P.getPrefType(name)) {
    case P.PREF_BOOL: return P.getBoolPref(name);
    case P.PREF_INT: return P.getIntPref(name);
    case P.PREF_STRING: return P.getStringPref(name);
    default: return def;
  }
}
export function setPref(name, value) {
  if (typeof value === "boolean") P.setBoolPref(name, value);
  else if (typeof value === "number") P.setIntPref(name, value);
  else P.setStringPref(name, String(value));
}
export function getJSON(name, def) {
  try {
    const v = JSON.parse(P.getStringPref(name, ""));
    return v && typeof v === "object" ? v : def;
  } catch {
    return def;
  }
}
export const setJSON = (name, obj) => P.setStringPref(name, JSON.stringify(obj));

// İzleyiciler: bir sayfa yeniden çizilince `disposeAll()` ile bırakılır.
const disposers = new Set();
/** Tercihler (ya da konular) değişince `fn` çağrılır. Kaldırıcı döndürür. */
export function watch(names, fn) {
  const list = [].concat(names);
  const obs = { observe: () => fn() };
  const prefs = list.filter(n => !n.startsWith("topic:"));
  const topics = list.filter(n => n.startsWith("topic:")).map(n => n.slice(6));
  for (const n of prefs) P.addObserver(n, obs);
  for (const t of topics) Services.obs.addObserver(obs, t);
  const off = () => {
    for (const n of prefs) try { P.removeObserver(n, obs); } catch {}
    for (const t of topics) try { Services.obs.removeObserver(obs, t); } catch {}
    disposers.delete(off);
  };
  disposers.add(off);
  return off;
}
/** Sayfa yeniden çizilince (ya da kapanınca) `fn` çağrılır. */
export function onDispose(fn) {
  const off = () => { disposers.delete(off); fn(); };
  disposers.add(off);
  return off;
}
export function disposeAll() {
  for (const off of [...disposers]) off();
}
addEventListener("unload", disposeAll);

// Tema: sayfalar chrome://userscripts/content/theme/page.mjs ile rigel.theme / rigel.accent'i canlı izler.

// ---- Üst pencere ----
export const chromeWin = () => window.browsingContext?.topChromeWindow ?? Services.wm.getMostRecentWindow("navigator:browser");
export function openInTab(url) {
  const w = chromeWin();
  w?.openTrustedLinkIn?.(url, "tab");
}

// ---- Denetimler ----
/** Anahtar. opts: invert, get(), set(v), names (izlenecek ek tercihler). */
export function toggle(name, { invert = false, get, set, names = [] } = {}) {
  const read = get ?? (() => !!getPref(name, false) !== invert);
  const input = h("input", { type: "checkbox", class: "switch", role: "switch" });
  const refresh = () => (input.checked = !!read());
  input.addEventListener("change", () => {
    if (set) set(input.checked);
    else setPref(name, input.checked !== invert);
  });
  refresh();
  watch([name, ...names].filter(Boolean), refresh);
  return input;
}

/** Segment denetimi: options [[değer, etiket], …]. */
export function seg(options, { get, set, names = [] }) {
  const box = h("div", { class: "seg", role: "radiogroup" });
  const buttons = options.map(([v, label]) => {
    const b = h("button", { type: "button", role: "radio", text: label, onclick: () => set(v) });
    b.dataset.v = String(v);
    return b;
  });
  box.append(...buttons);
  const refresh = () => {
    const cur = String(get());
    for (const b of buttons) {
      const on = b.dataset.v === cur;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on);
    }
  };
  refresh();
  watch(names, refresh);
  return box;
}

export function select(options, { get, set, names = [] }) {
  const sel = h("select", {}, options.map(([v, label]) => h("option", { value: String(v), text: label })));
  sel.addEventListener("change", () => set(sel.value));
  const refresh = () => (sel.value = String(get()));
  refresh();
  watch(names, refresh);
  return sel;
}

/** Ayar satırı. Arama dizini için `data-label` ve `data-keywords` taşır. */
export function row({ id, label, desc, keywords = "", restart = false, control, stack = false, sub = false, kbd }) {
  const txt = h("span", { class: "txt" },
    h("b", {}, label, kbd && h("kbd", { text: kbd }), restart && h("span", { class: "restart-tag", text: "yeniden başlatınca" })),
    desc && h("small", {}, desc));
  const r = h("div", { class: "row" + (stack ? " stack" : "") + (sub ? " sub" : ""), "data-row": id ?? "" }, txt, control);
  r.dataset.label = label;
  r.dataset.keywords = `${label} ${desc ?? ""} ${keywords}`;
  return r;
}

export function card(title, ...kids) {
  return h("section", { class: "card" }, title && h("div", { class: "chead" }, h("h2", { text: title })), kids);
}

export function notify(text, ok = true) {
  const t = h("div", { class: "toast" + (ok ? "" : " bad"), text });
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

// ---- Düzenler ----
export const LAYOUTS = [
  { id: "ada", name: "Ada", note: "Tek üst şerit; ortada sayfanın kimliğini taşıyan ada, sekmeler yıldız ikonları." },
  { id: "dock", name: "Yörünge Dock", note: "İnce başlık şeridi; sekmeler ve adres altta yüzen dock'ta." },
  { id: "komuta", name: "Komuta", note: "Sekme listesi yok; her şey palet ve sekme panelinden." },
  { id: "yanpanel", name: "Yan Panel", note: "Solda dikey sekmeler ve adres; sayfaya tam yükseklik." },
  { id: "klasik", name: "Klasik", note: "Üstte yatay sekmeler ve araç çubuğu; alışık olduğun düzen." },
];
const PREVIEWS = {
  ada: '<div class="top"><i class="d"></i><span class="stars"><i></i><i></i><i></i></span><span class="island"></span><span class="ctl"></span></div><div class="page"></div>',
  dock: '<div class="top thin"><span class="title"></span></div><div class="page"></div><div class="dockwrap"><span class="dock"><i class="on"></i><i></i><i></i><b></b></span></div>',
  komuta: '<div class="top"><i class="d"></i><span class="crumb"></span><span class="count"></span></div><div class="row"><div class="page"></div><div class="drawer"><i></i><i class="on"></i><i></i><i></i></div></div>',
  yanpanel: '<div class="row"><div class="side"><i class="omni"></i><i class="on"></i><i></i><i></i><i></i></div><div class="page"></div></div>',
  klasik: '<div class="strip"><i class="on"></i><i></i><i></i></div><div class="tool"><span class="crumb"></span></div><div class="page"></div>',
};
export const layoutPreview = id => h("div", { class: "pv", html: PREVIEWS[id] ?? "" });

/** Düzen kartları; seçim `rigel.layout`'u yazar (kabuk canlı değişir). */
export function layoutPicker() {
  const wrap = h("div", { class: "layouts" });
  const cards = LAYOUTS.map(l => {
    const c = h("button", { type: "button", class: "lcard", onclick: () => setPref("rigel.layout", l.id) },
      layoutPreview(l.id),
      h("div", { class: "lt" }, h("b", { text: l.name }), h("span", { class: "badge" }, icon("check", 13))),
      h("p", { text: l.note }));
    c.dataset.v = l.id;
    return c;
  });
  wrap.append(...cards);
  const refresh = () => {
    const cur = getPref("rigel.layout", "ada");
    for (const c of cards) c.classList.toggle("on", c.dataset.v === cur);
  };
  refresh();
  watch("rigel.layout", refresh);
  return wrap;
}

export const ACCENTS = [
  ["rigel", "Rigel mavisi", "#5fa9dd"], ["violet", "Mor", "#9b8cf0"], ["green", "Yeşil", "#4fbf8f"],
  ["orange", "Turuncu", "#f2a06b"], ["pink", "Pembe", "#e879b0"],
  ["teal", "Turkuaz", "#3cc4c0"], ["indigo", "Çivit", "#8191f7"], ["red", "Kırmızı", "#ef6461"], ["amber", "Kehribar", "#e9b44c"], ["lime", "Fıstık", "#9ccf55"], ["slate", "Gri", "#a3adbf"],
];
export function accentPicker() {
  const box = h("div", { class: "swatches", role: "radiogroup" });
  const items = ACCENTS.map(([id, name, color]) => {
    const b = h("button", { type: "button", class: "swatch", title: name, "aria-label": name, onclick: () => setPref("rigel.accent", id) });
    b.style.setProperty("--c", color);
    b.dataset.v = id;
    return b;
  });
  box.append(...items);
  const refresh = () => {
    const cur = getPref("rigel.accent", "rigel");
    for (const b of items) b.classList.toggle("on", b.dataset.v === cur);
  };
  refresh();
  watch("rigel.accent", refresh);
  return box;
}

export const themeSeg = () => seg([["dark", "Koyu"], ["light", "Açık"], ["system", "Sistem"]], {
  get: () => getPref("rigel.theme", "dark"), set: v => setPref("rigel.theme", v), names: ["rigel.theme"],
});

// ---- Arama motorları ----
// Firefox 158'de `Services.search` yok; arama hizmeti bir modül tekil nesnesi.
export const searchService = (() => {
  try {
    return ChromeUtils.importESModule("moz-src:///toolkit/components/search/SearchService.sys.mjs").SearchService;
  } catch {
    return Services.search;
  }
})();
export async function engineList() {
  await searchService.init();
  const engines = await searchService.getVisibleEngines();
  const def = await searchService.getDefault();
  return { engines, def };
}
export async function engineIcon(engine) {
  try {
    return (await engine.getIconURL?.(32)) ?? engine.iconURI?.spec ?? null;
  } catch {
    return null;
  }
}

// ---- Görünüm stüdyosu denetimleri ----
/** Kaydırıcı + değer göstergesi. opts: min, max, step, unit, format(v), get(), set(v) (her input'ta), names. */
export function range({ min, max, step = 1, unit = "", format, get, set, names = [] }) {
  const input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), class: "rng" });
  const out = h("output", { class: "rngval" });
  const show = v => (out.textContent = format ? format(Number(v)) : `${v}${unit}`);
  input.addEventListener("input", () => { show(input.value); set(Number(input.value)); });
  const refresh = () => {
    if (document.activeElement === input) return;
    input.value = String(get());
    show(input.value);
  };
  refresh();
  watch(names, refresh);
  return h("div", { class: "rngbox" }, input, out);
}

/** Renk seçici (#rrggbb). opts: get(), set(v), names. */
export function colorInput({ get, set, names = [], title = "" }) {
  const input = h("input", { type: "color", class: "clr", title });
  input.addEventListener("input", () => set(input.value));
  const refresh = () => (input.value = get() || "#5fa9dd");
  refresh();
  watch(names, refresh);
  return input;
}

/** Fonksiyonu son çağrıdan `ms` sonra bir kez çalıştırır. */
export function debounce(fn, ms = 60) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
