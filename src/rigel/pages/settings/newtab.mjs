// Ayarlar › Yeni sekme. Yeni sekme sayfasının "Düzenle" kipiyle aynı tercihe (`rigel.newtab`, ../newtab/config.mjs)
// yazar; burada her şey form olarak, orada sayfanın üstünde canlı düzenlenir.
import { h, icon, getPref, setPref, watch, toggle, seg, row, card, notify, range, colorInput, debounce, chromeWin } from "./ui.mjs";
import * as Cfg from "../newtab/config.mjs";

const names = [Cfg.PREF];
const btn = (text, onclick, cls = "soft", ic) => h("button", { type: "button", class: "btn " + cls, onclick }, ic && icon(ic, 14), text);
const cfg = () => Cfg.read();

// Kaydırıcı ve renk değişiklikleri ~60 ms birleştirilir.
let queue = [];
const flush = debounce(() => { const fns = queue; queue = []; Cfg.patch(c => { for (const f of fns) f(c); }); });
const soon = fn => { queue.push(fn); flush(); };

export const NEWTAB_URL = "chrome://rigel/content/newtab/newtab.html";
export function openNewtab(edit = false) {
  const url = NEWTAB_URL + (edit ? "#edit" : "");
  const w = chromeWin();
  if (w?.openTrustedLinkIn) w.openTrustedLinkIn(url, "tab");
  else window.open(url);
}

export function yeniSekme() {
  const editRow = row({
    id: "ntEdit", label: "Düzenleme modu", keywords: "yeni sekme düzenle özelleştir ana sayfa edit sürükle kısayol",
    desc: "Yeni sekmeyi açıp kutucukları sürükleyerek sırala, kısayol ekle, parçaları ve arka planı sayfanın üstünde canlı değiştir.",
    control: h("div", { class: "toolrow" }, btn("Düzenle", () => openNewtab(true), "", "edit"), btn("Önizle", () => openNewtab(false), "soft", "external")),
  });

  // Düzen ve parçalar
  const nameIn = h("input", { type: "text", maxlength: "30", placeholder: "Adın (isteğe bağlı)", spellcheck: "false", "aria-label": "Karşılamada görünecek ad" });
  nameIn.addEventListener("input", debounce(() => soon(c => { c.name = nameIn.value; }), 250));
  const syncName = () => { if (document.activeElement !== nameIn) nameIn.value = cfg().name; };
  syncName();
  watch(names, syncName);

  const layout = card("Düzen ve parçalar",
    row({ id: "ntLayout", label: "Düzen", keywords: "yeni sekme düzen ortada sol üstte sade layout",
      desc: "Ortada: her şey ortalı. Sol üstte: büyük saat solda. Sade: küçük saat, geniş arama kutusu, yalnız simgeli kısayollar.",
      control: seg(Cfg.LAYOUTS, { get: () => cfg().layout, set: v => Cfg.patch(c => { c.layout = v; }), names }), stack: true }),
    ...Cfg.WIDGETS.map(([k, label]) => row({ id: "ntW-" + k, label, sub: true, keywords: `yeni sekme parça göster gizle ${label}`,
      control: toggle(null, { get: () => cfg().widgets[k], set: v => Cfg.patch(c => { c.widgets[k] = v; }), names }) })),
    row({ id: "ntName", label: "Karşılamadaki ad", sub: true, keywords: "yeni sekme karşılama isim ad günaydın", control: nameIn }),
    row({ id: "ntHour12", label: "12 saatlik saat", sub: true, keywords: "yeni sekme saat 12 24 öğleden",
      control: toggle(null, { get: () => cfg().hour12, set: v => Cfg.patch(c => { c.hour12 = v; }), names }) }));

  // Kısayollar
  const count = h("small", { class: "hint" });
  const syncCount = () => {
    const c = cfg();
    count.textContent = c.shortcutMode === "custom" ? `${c.shortcuts.length} kısayol kayıtlı` : "";
  };
  syncCount();
  watch(names, syncCount);
  const shortcuts = card("Kısayollar",
    row({ id: "ntMode", label: "Kaynak", keywords: "yeni sekme kısayol sık ziyaret elle otomatik geçmiş",
      desc: "Sık ziyaret edilenler geçmişinden gelir. Elle seçince kendi listeni düzenleme modunda kurarsın (liste saklanır).",
      control: h("div", { class: "toolrow" }, count, seg([["auto", "Sık ziyaret edilenler"], ["custom", "Elle"]], { get: () => cfg().shortcutMode, set: v => Cfg.patch(c => { c.shortcutMode = v; }), names })) }),
    row({ id: "ntCols", label: "Sütun", sub: true, keywords: "yeni sekme ızgara sütun kolon genişlik",
      control: range({ min: 2, max: 8, get: () => cfg().grid.cols, set: v => soon(c => { c.grid.cols = v; }), names }) }),
    row({ id: "ntRows", label: "Satır", sub: true, keywords: "yeni sekme ızgara satır",
      control: range({ min: 1, max: 4, get: () => cfg().grid.rows, set: v => soon(c => { c.grid.rows = v; }), names }) }),
    row({ id: "ntTop", label: "Sık ziyaret edilenleri göster", sub: true, keywords: "yeni sekme sık ziyaret top sites geçmiş",
      desc: "Kapalıyken \"Sık ziyaret edilenler\" kaynağı boş kalır; elle listen etkilenmez. Gizli pencerelerde hiç gösterilmez.",
      control: toggle(Cfg.TOPSITES_PREF, { get: () => getPref(Cfg.TOPSITES_PREF, true) }) }));

  // Arka plan
  const bgOf = () => cfg().bg;
  const fileLabel = h("small", { class: "bgfile" });
  const pickPhoto = async () => {
    try {
      if (await Cfg.pickPhoto(window, document)) notify("Fotoğraf yeni sekme arka planı yapıldı.");
    } catch (e) {
      notify("Fotoğraf eklenemedi: " + e.message, false);
    }
  };
  const bgType = seg(Cfg.BG_TYPES, {
    get: () => bgOf().type,
    set: v => { if (v === "image" && !bgOf().file) pickPhoto(); else Cfg.patch(c => { c.bg.type = v; }); },
    names,
  });
  const solidRow = row({ id: "ntBgColor", label: "Renk", sub: true, keywords: "yeni sekme arka plan düz renk",
    control: colorInput({ get: () => bgOf().color, set: v => soon(c => { c.bg.color = v; }), names }) });
  const gradRow = row({ id: "ntBgGrad", label: "Gradyan renkleri", sub: true, keywords: "yeni sekme arka plan gradyan geçiş",
    control: h("div", { class: "toolrow" }, colorInput({ get: () => bgOf().from, set: v => soon(c => { c.bg.from = v; }), names, title: "Başlangıç" }),
      colorInput({ get: () => bgOf().to, set: v => soon(c => { c.bg.to = v; }), names, title: "Bitiş" })) });
  const angleRow = row({ id: "ntBgAngle", label: "Açı", sub: true, keywords: "yeni sekme gradyan açı",
    control: range({ min: 0, max: 360, step: 5, unit: "°", get: () => bgOf().angle, set: v => soon(c => { c.bg.angle = v; }), names }) });
  const photoRow = row({ id: "ntBgPhoto", label: "Fotoğraf", sub: true, keywords: "yeni sekme arka plan fotoğraf resim görsel duvar kağıdı",
    desc: "Dosya profildeki rigel-bg klasörüne kopyalanır (tarayıcı arka planıyla aynı yer).",
    control: h("div", { class: "toolrow" }, fileLabel, btn("Fotoğraf seç…", pickPhoto, "soft", "folder")) });
  const blurApply = debounce(async v => {
    try { await Cfg.setBlur(document, v); } catch (e) { notify("Bulanıklık üretilemedi: " + e.message, false); }
  }, 220);
  const dimRow = row({ id: "ntBgDim", label: "Karartma", sub: true, keywords: "yeni sekme fotoğraf karart okunaklı kontrast",
    desc: "Yazıların okunaklı kalması için fotoğrafın üstüne koyu katman.",
    control: range({ min: 0, max: 80, step: 5, unit: "%", get: () => bgOf().dim, set: v => soon(c => { c.bg.dim = v; }), names }) });
  const blurRow = row({ id: "ntBgBlur", label: "Bulanıklık", sub: true, keywords: "yeni sekme fotoğraf bulanık blur",
    control: range({ min: 0, max: 40, step: 2, unit: " px", get: () => bgOf().blur, set: blurApply, names }) });
  const browserRow = row({ id: "ntBgBrowser", label: "Tarayıcının arka planı", sub: true, keywords: "yeni sekme tarayıcı aynı arka plan stüdyo",
    desc: "Görünüm stüdyosundaki pencere arka planı (renk, gradyan ya da fotoğraf) yeni sekmede de kullanılır.",
    control: btn("Stüdyoyu aç", () => (chromeWin()?.Rigel?.settings?.open ? chromeWin().Rigel.settings.open("studyo") : (location.hash = "studyo")), "soft", "arrow") });
  const syncBg = () => {
    const b = bgOf();
    solidRow.hidden = b.type !== "solid";
    gradRow.hidden = angleRow.hidden = b.type !== "gradient";
    photoRow.hidden = dimRow.hidden = blurRow.hidden = b.type !== "image";
    browserRow.hidden = b.type !== "browser";
    fileLabel.textContent = b.file || "Seçilmedi";
  };
  syncBg();
  watch(names, syncBg);
  const background = card("Arka plan",
    row({ id: "ntBg", label: "Yeni sekme arka planı", keywords: "yeni sekme arka plan zemin fotoğraf gradyan renk tema tarayıcı wallpaper",
      desc: "Tema: temanın zemini. Tarayıcı: stüdyodaki arka planla aynı. Fotoğraf yazıları otomatik açık renk yapar.", control: bgType, stack: true }),
    solidRow, gradRow, angleRow, photoRow, dimRow, blurRow, browserRow);

  const resetRow = card(null,
    row({ id: "ntReset", label: "Varsayılana dön", keywords: "yeni sekme sıfırla varsayılan reset",
      desc: "Düzen, parçalar, kısayol listesi ve arka plan ilk haline döner.",
      control: btn("Yeni sekmeyi sıfırla", () => { Cfg.reset(); notify("Yeni sekme varsayılana döndü."); }, "soft", "undo") }));

  return [card(null, editRow), layout, shortcuts, background, resetRow];
}
