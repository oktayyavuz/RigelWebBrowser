// Yeni sekme "Düzenle" kipi: sağdaki panel (düzen, parçalar, kısayol ızgarası, arka plan) ve kısayol penceresi.
// Her denetim `rigel.newtab`'a yazar (config.mjs); kaydırıcı/renk değişiklikleri ~60 ms birleştirilir. Panel bir kez kurulur,
// tercih (başka yerden) değişince `refresh()` denetimleri günceller.
import * as Cfg from "./config.mjs";

function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid);
  return e;
}
const SVGNS = "http://www.w3.org/2000/svg";
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M18 6l-1.8 1.8M7.8 16.2L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
function icon(name, size = 15) {
  const s = document.createElementNS(SVGNS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) s.setAttribute(k, v);
  s.innerHTML = ICONS[name] ?? "";
  return s;
}
const debounce = (fn, ms = 60) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export function toast(text) {
  document.querySelector(".toast")?.remove();
  const t = h("div", { class: "toast", role: "status", text });
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

/** Kısayol ekle/düzenle penceresi. onSave({ title, url }) hata metni döndürür (boş = tamam). */
export function shortcutDialog({ title = "", url = "", isNew = true, onSave }) {
  const wrap = document.getElementById("dlg");
  const t = h("input", { type: "text", class: "ptext", maxlength: "40", placeholder: "Boşsa sitenin adı kullanılır", value: title, spellcheck: "false" });
  const u = h("input", { type: "text", class: "ptext", placeholder: "örnek.com", value: url, spellcheck: "false", autocapitalize: "off" });
  const err = h("div", { class: "err", role: "alert" });
  const close = () => { wrap.hidden = true; wrap.replaceChildren(); };
  const save = () => {
    const clean = Cfg.cleanUrl(u.value);
    if (!clean) { err.textContent = "Geçerli bir adres gir (ör. youtube.com)."; u.focus(); return; }
    const msg = onSave({ title: t.value.trim().slice(0, 40) || Cfg.hostOf(clean), url: clean });
    if (msg) err.textContent = msg;
    else close();
  };
  const onKey = e => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    else if (e.key === "Escape") { e.stopPropagation(); close(); }
  };
  wrap.replaceChildren(h("div", { class: "dlg", role: "dialog", "aria-modal": "true", "aria-label": isNew ? "Kısayol ekle" : "Kısayolu düzenle", onkeydown: onKey },
    h("h3", { text: isNew ? "Kısayol ekle" : "Kısayolu düzenle" }),
    h("label", {}, "Adres", u),
    h("label", {}, "Ad", t),
    err,
    h("div", { class: "btns" },
      h("button", { type: "button", class: "pbtn ghost", onclick: close, text: "Vazgeç" }),
      h("button", { type: "button", class: "pbtn primary", onclick: save, text: "Kaydet" }))));
  wrap.onmousedown = e => { if (e.target === wrap) close(); };
  wrap.hidden = false;
  (isNew ? u : t).focus();
}

export function buildPanel(root, { doc, win, exit }) {
  const syncs = [];
  const reg = fn => { syncs.push(fn); fn(); };
  const cfg = Cfg.read;

  // Birleştirilmiş yazım: sürüklerken her input'ta pref yazılmaz.
  let queue = [];
  const flush = debounce(() => { const fns = queue; queue = []; Cfg.patch(c => { for (const f of fns) f(c); }); });
  const soon = fn => { queue.push(fn); flush(); };

  const seg = (options, get, set) => {
    const box = h("div", { class: "seg", role: "radiogroup" });
    const btns = options.map(([v, label]) => {
      const b = h("button", { type: "button", role: "radio", text: label, onclick: () => set(v) });
      b.dataset.v = String(v);
      return b;
    });
    box.append(...btns);
    reg(() => { const cur = String(get()); for (const b of btns) { b.classList.toggle("on", b.dataset.v === cur); b.setAttribute("aria-checked", b.dataset.v === cur); } });
    return box;
  };
  const sw = (get, set, label) => {
    const i = h("input", { type: "checkbox", class: "sw", role: "switch", "aria-label": label });
    i.addEventListener("change", () => set(i.checked));
    reg(() => (i.checked = !!get()));
    return i;
  };
  const stepper = (min, max, get, set, label) => {
    const out = h("output", { "aria-live": "polite" });
    const dec = h("button", { type: "button", "aria-label": `${label} azalt`, text: "−", onclick: () => set(get() - 1) });
    const inc = h("button", { type: "button", "aria-label": `${label} artır`, text: "+", onclick: () => set(get() + 1) });
    reg(() => { out.textContent = String(get()); dec.disabled = get() <= min; inc.disabled = get() >= max; });
    return h("div", { class: "stepper" }, dec, out, inc);
  };
  const range = (min, max, step, unit, get, set, label) => {
    const i = h("input", { type: "range", class: "rng", min, max, step, "aria-label": label });
    const out = h("output", { class: "rngval" });
    i.addEventListener("input", () => { out.textContent = i.value + unit; set(Number(i.value)); });
    reg(() => { if (doc.activeElement === i) return; i.value = String(get()); out.textContent = i.value + unit; });
    return h("div", { class: "rngbox" }, i, out);
  };
  const color = (get, set, label) => {
    const i = h("input", { type: "color", class: "clr", "aria-label": label, title: label });
    i.addEventListener("input", () => set(i.value));
    reg(() => (i.value = get()));
    return i;
  };
  const prow = (label, control, extra = {}) => h("div", { class: "prow" + (extra.stack ? " stack" : "") }, h("span", { class: "l", text: label }), control);
  const btn = (text, onclick, cls = "", ic) => h("button", { type: "button", class: "pbtn " + cls, onclick }, ic && icon(ic), text);

  // ---- Düzen
  const layoutSec = h("section", { class: "psec" }, h("h3", { text: "Düzen" }),
    seg(Cfg.LAYOUTS, () => cfg().layout, v => Cfg.patch(c => { c.layout = v; })));

  // ---- Parçalar
  const nameIn = h("input", { type: "text", class: "ptext", maxlength: "30", placeholder: "Adın (isteğe bağlı)", "aria-label": "Karşılamada görünecek ad", spellcheck: "false" });
  nameIn.addEventListener("input", debounce(() => soon(c => { c.name = nameIn.value; }), 250));
  const nameRow = h("div", { class: "prow" }, nameIn);
  reg(() => { nameRow.hidden = !cfg().widgets.greeting; if (doc.activeElement !== nameIn) nameIn.value = cfg().name; });
  const widgetSec = h("section", { class: "psec" }, h("h3", { text: "Parçalar" }),
    ...Cfg.WIDGETS.flatMap(([k, label]) => [
      prow(label, sw(() => cfg().widgets[k], v => Cfg.patch(c => { c.widgets[k] = v; }), label)),
      k === "greeting" ? nameRow : null,
    ]),
    prow("12 saatlik saat", sw(() => cfg().hour12, v => Cfg.patch(c => { c.hour12 = v; }), "12 saatlik saat")));

  // ---- Kısayollar
  const gridSec = h("section", { class: "psec" }, h("h3", { text: "Kısayollar" }),
    seg([["auto", "Sık ziyaret edilenler"], ["custom", "Elle"]], () => cfg().shortcutMode, v => Cfg.patch(c => { c.shortcutMode = v; })),
    h("p", { class: "phint", text: "Kutucuğa tıklayarak düzenle, sürükleyerek sırala. Değiştirdiğinde liste elle kipine geçer; elle listen saklanır." }),
    prow("Sütun", stepper(2, 8, () => cfg().grid.cols, v => Cfg.patch(c => { c.grid.cols = v; }), "Sütun")),
    prow("Satır", stepper(1, 4, () => cfg().grid.rows, v => Cfg.patch(c => { c.grid.rows = v; }), "Satır")));

  // ---- Arka plan
  const types = h("div", { class: "swatches", role: "radiogroup", "aria-label": "Arka plan türü" });
  const swBtns = Cfg.BG_TYPES.map(([v, label]) => {
    const b = h("button", { type: "button", role: "radio", class: "swatch", "data-t": v, onclick: () => setType(v) }, h("i"), h("span", { text: label }));
    return b;
  });
  types.append(...swBtns);
  const setType = async v => {
    if (v === "image" && !cfg().bg.file) { await pickPhoto(); return; }
    Cfg.patch(c => { c.bg.type = v; });
  };
  const fileLabel = h("small", { class: "bgfile" });
  const pickPhoto = async () => {
    try {
      const f = await Cfg.pickPhoto(win, doc);
      if (f) toast("Fotoğraf arka plan yapıldı.");
    } catch (e) {
      toast("Fotoğraf eklenemedi: " + e.message);
    }
  };
  const blurApply = debounce(async v => {
    try { await Cfg.setBlur(doc, v); } catch (e) { toast("Bulanıklık üretilemedi: " + e.message); }
  }, 220);
  const solidRow = prow("Renk", color(() => cfg().bg.color, v => soon(c => { c.bg.color = v; }), "Arka plan rengi"));
  const gradRow = prow("Renkler", h("div", { class: "toolrow" },
    color(() => cfg().bg.from, v => soon(c => { c.bg.from = v; }), "Gradyan başlangıç rengi"),
    color(() => cfg().bg.to, v => soon(c => { c.bg.to = v; }), "Gradyan bitiş rengi")));
  const angleRow = prow("Açı", range(0, 360, 5, "°", () => cfg().bg.angle, v => soon(c => { c.bg.angle = v; }), "Gradyan açısı"));
  const photoRow = prow("Fotoğraf", h("div", { class: "toolrow" }, fileLabel, btn("Seç…", pickPhoto, "", "folder")));
  const dimRow = prow("Karartma", range(0, 80, 5, "%", () => cfg().bg.dim, v => soon(c => { c.bg.dim = v; }), "Karartma"));
  const blurRow = prow("Bulanıklık", range(0, 40, 2, " px", () => cfg().bg.blur, blurApply, "Bulanıklık"));
  const browserNote = h("p", { class: "phint", text: "Görünüm stüdyosundaki pencere arka planı kullanılır; orada değiştirince burası da değişir." });
  const studioLink = btn("Görünüm stüdyosunu aç", () => openSettings("studyo"), "ghost wide", "gear");
  const photoHint = h("p", { class: "phint", text: "Fotoğraf profil klasörüne kopyalanır. Yazılar okunmuyorsa karartmayı artır." });
  const photoCtl = [photoRow, dimRow, blurRow, photoHint];
  reg(() => {
    const b = cfg().bg;
    swBtns.forEach(el => {
      const on = el.dataset.t === b.type;
      el.classList.toggle("on", on);
      el.setAttribute("aria-checked", on);
    });
    swBtns[2].style.setProperty("--sw1", b.color);
    swBtns[3].style.setProperty("--sw1", b.from);
    swBtns[3].style.setProperty("--sw2", b.to);
    if (b.file) swBtns[4].style.setProperty("--swimg", `url("${Cfg.fileUrl(b.file)}")`);
    else swBtns[4].style.removeProperty("--swimg");
    solidRow.hidden = b.type !== "solid";
    gradRow.hidden = angleRow.hidden = b.type !== "gradient";
    for (const el of photoCtl) el.hidden = b.type !== "image";
    browserNote.hidden = studioLink.hidden = b.type !== "browser";
    fileLabel.textContent = b.file || "Seçilmedi";
    fileLabel.title = b.file;
  });
  const bgSec = h("section", { class: "psec" }, h("h3", { text: "Arka plan" }), types, solidRow, gradRow, angleRow, ...photoCtl, browserNote, studioLink);

  // ---- Alt
  const foot = h("section", { class: "psec" },
    btn("Varsayılana dön", () => { Cfg.reset(); toast("Yeni sekme varsayılana döndü."); }, "wide", "undo"),
    h("div", { style: "height:8px" }),
    btn("Ayarlar'da aç", () => openSettings("yenisekme"), "ghost wide", "gear"));

  root.replaceChildren(
    h("header", { class: "phead" }, h("h2", {}, "Yeni sekmeyi düzenle", h("small", { text: "Değişiklikler anında kaydedilir" })),
      btn("Bitti", exit, "primary", "check")),
    layoutSec, widgetSec, gridSec, bgSec, foot);

  return { refresh: () => syncs.forEach(f => f()) };

  function openSettings(section) {
    try {
      const R = win.browsingContext?.topChromeWindow?.Rigel;
      if (R?.settings?.open) R.settings.open(section);
      else win.location.assign(`chrome://rigel/content/settings/settings.html#${section}`);
    } catch {
      win.location.assign(`chrome://rigel/content/settings/settings.html#${section}`);
    }
  }
}
