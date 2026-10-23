// Kitaplık için ortak yardımcılar: DOM kurma, simgeler, biçimler, pencere köprüsü, iletişim kutusu, bildirim.
// Sayfa chrome:// olduğundan `Services`, `Cc`, `Ci`, `ChromeUtils` doğrudan kullanılabilir.

const SVGNS = "http://www.w3.org/2000/svg";

/** h("div", { class, text, onclick, … }, ...çocuklar). `on*` dinleyici. */
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "value" || k === "checked" || k === "disabled" || k === "hidden") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return e;
}

// ---- Simgeler (24x24, çizgi) ----
export const ICONS = {
  history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bookmark: '<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4.2L6 20V5.5a1 1 0 0 1 1-1z"/>',
  star: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12h8.4L17 7"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  folderPlus: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
  external: '<path d="M14 5h5v5M19 5l-8 8M17 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V9a1.5 1.5 0 0 1 1.5-1.5H10"/>',
  tabPlus: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M8 7V4.5M12 10.5v5M9.5 13h5"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  retry: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"/><path d="M19.5 4.5v4h-4"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  import: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  export: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  file: '<path d="M7 3.5h6.5L18 8v12.5H7z"/><path d="M13.5 3.5V8H18"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  broom: '<path d="M14.5 4.5l5 5-6 6-5-5z"/><path d="M8.5 10.5L4 15c-.6.6-.6 1.6 0 2.2l2.8 2.8c.6.6 1.6.6 2.2 0l4.5-4.5"/>',
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

// ---- Biçimler ----
export function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, "") || url; } catch { return url; }
}
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
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Gün anahtarı (YYYY-M-D). */
export const dayKey = ms => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
/** "Bugün", "Dün" ya da "12 Ekim Pazartesi". */
export function dayLabel(ms) {
  const d = new Date(ms), today = new Date();
  const diff = Math.round((dayStart(today) - dayStart(d)) / 86_400_000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Dün";
  const opts = { day: "numeric", month: "long", weekday: "long" };
  if (d.getFullYear() !== today.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("tr", opts);
}
export const dayRange = ms => { const b = dayStart(new Date(ms)); return { begin: b, end: new Date(b.getTime() + 86_400_000 - 1) }; };
export const timeOf = ms => new Date(ms).toLocaleTimeString("tr", { hour: "2-digit", minute: "2-digit" });
export const fold = s => String(s ?? "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

// ---- Favicon: page-icon: şeması, olmazsa harf ----
/** hasIcon === false ise (Places'ta bu sayfa için simge yoksa) doğrudan harf rozeti; page-icon: boş sayfada küresel varsayılanı verir. */
export function favicon(url, title = "", size = 18, hasIcon = true) {
  const letter = (hostOf(url) || title || "?").replace(/^[^a-z0-9ğüşıöç]+/i, "").charAt(0).toLocaleUpperCase("tr") || "•";
  let hue = 0;
  for (const c of hostOf(url)) hue = (hue * 31 + c.charCodeAt(0)) % 360;
  const wrap = h("span", { class: "fav", style: `width:${size}px;height:${size}px` });
  const fallback = () => {
    wrap.replaceChildren(h("span", { class: "letter", text: letter, style: `--h:${hue};font-size:${Math.round(size * 0.58)}px` }));
  };
  if (!hasIcon || !/^(https?|ftp|file):/.test(url)) { fallback(); return wrap; }
  const img = h("img", { src: `page-icon:${url}`, width: size, height: size, alt: "", loading: "lazy", decoding: "async" });
  img.addEventListener("error", fallback, { once: true });
  wrap.append(img);
  return wrap;
}

// ---- Tarayıcı penceresi köprüsü ----
export const chromeWin = () => window.browsingContext?.topChromeWindow ?? Services.wm.getMostRecentWindow("navigator:browser");
/** where: "current" | "tab" (öne) | "tabshifted" (arkaya). */
export function openUrl(url, where = "current") {
  chromeWin()?.openTrustedLinkIn?.(url, where);
}
/** Fare olayından hedef: Ctrl/orta tık → arka sekme, Shift → öne yeni sekme. */
export function whereOf(e) {
  if (e.button === 1 || e.ctrlKey || e.metaKey) return "tabshifted";
  if (e.shiftKey) return "tab";
  return "current";
}

// ---- Bildirim ----
let toastTimer = 0;
export function toast(text, { action, onAction, error = false } = {}) {
  const box = document.getElementById("toasts");
  clearTimeout(toastTimer);
  const t = h("div", { class: "toast" + (error ? " err" : "") }, h("span", { text }),
    action && h("button", { class: "tlink", text: action, onclick: () => { t.remove(); onAction?.(); } }));
  box.replaceChildren(t);
  toastTimer = setTimeout(() => t.remove(), action ? 7000 : 3500);
}

/** İki adımlı onay düğmesi: ilk tıklama "Emin misin?" yazar, ikincisi `fn`'yi çalıştırır. */
export function confirmButton(btn, label, fn) {
  const orig = btn.cloneNode(true).childNodes;
  let t = 0;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (!btn.classList.contains("armed")) {
      btn.classList.add("armed");
      btn.replaceChildren(h("span", { text: "Emin misin?" }));
      t = setTimeout(reset, 3500);
      return;
    }
    clearTimeout(t);
    reset();
    fn();
  });
  btn.addEventListener("blur", () => { clearTimeout(t); reset(); });
  function reset() {
    btn.classList.remove("armed");
    btn.replaceChildren(...[...orig].map(n => n.cloneNode(true)));
  }
  return btn;
}

// ---- İletişim kutusu ----
/** fields: [{ name, label, type?: "text"|"url"|"select", value?, options?: [{value,label}], required? }].
 *  Onaylanırsa { name: değer } döner, vazgeçilirse null. */
export function formDialog({ title, fields, confirm = "Kaydet" }) {
  return new Promise(resolve => {
    const inputs = {};
    const rows = fields.map(f => {
      let input;
      if (f.type === "select") {
        input = h("select", {}, f.options.map(o => h("option", { value: o.value, text: o.label })));
        input.value = f.value ?? "";
      } else {
        input = h("input", { type: f.type ?? "text", value: f.value ?? "", spellcheck: "false", autocomplete: "off", placeholder: f.placeholder ?? "" });
      }
      input.required = !!f.required;
      inputs[f.name] = input;
      return h("label", { class: "field" }, h("span", { text: f.label }), input);
    });
    const err = h("small", { class: "err", hidden: true });
    const dlg = h("dialog", { class: "dlg" },
      h("form", { method: "dialog" },
        h("h3", { text: title }), rows, err,
        h("div", { class: "dactions" },
          h("button", { type: "button", class: "btn ghost", text: "Vazgeç", onclick: () => dlg.close("cancel") }),
          h("button", { type: "submit", class: "btn", text: confirm }))));
    let result = null;
    dlg.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const out = {};
      for (const [k, el] of Object.entries(inputs)) out[k] = el.value.trim();
      for (const f of fields) {
        if (f.required && !out[f.name]) { err.hidden = false; err.textContent = `${f.label} boş olamaz.`; inputs[f.name].focus(); return; }
        if (f.validate) { const m = f.validate(out[f.name]); if (m) { err.hidden = false; err.textContent = m; inputs[f.name].focus(); return; } }
      }
      result = out;
      dlg.close("ok");
    });
    dlg.addEventListener("close", () => { dlg.remove(); resolve(result); });
    document.body.append(dlg);
    dlg.showModal();
    const first = Object.values(inputs)[0];
    first?.focus();
    first?.select?.();
  });
}

/** Dosya seçici. mode: "open" | "save". Seçilen yolu ya da null döner. */
export async function pickFile({ title, mode, defaultName = "", filterName = "HTML", filter = "*.html;*.htm" }) {
  const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  fp.init(window.browsingContext, title, mode === "save" ? Ci.nsIFilePicker.modeSave : Ci.nsIFilePicker.modeOpen);
  fp.appendFilter(filterName, filter);
  fp.appendFilters(Ci.nsIFilePicker.filterAll);
  if (defaultName) { fp.defaultString = defaultName; fp.defaultExtension = "html"; }
  const res = await new Promise(r => fp.open(r));
  return res === Ci.nsIFilePicker.returnOK || res === Ci.nsIFilePicker.returnReplace ? fp.file.path : null;
}

/** Sayfa sonuna gelince `more()` çağıran gözlemci. Kaldırıcı döndürür. */
export function infiniteScroll(sentinel, more) {
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) more(); }, { rootMargin: "400px" });
  io.observe(sentinel);
  return () => io.disconnect();
}

export const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Places'ta simgesi kayıtlı sayfa adresleri (yer imleri gibi toplu listeler için). */
export async function iconUrls() {
  const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
  const conn = await PlacesUtils.promiseDBConnection();
  const rows = await conn.executeCached("SELECT page_url FROM moz_pages_w_icons");
  return new Set(rows.map(r => r.getResultByName("page_url")));
}
