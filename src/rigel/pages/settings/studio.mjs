// Ayarlar › Görünüm stüdyosu. Her denetim `rigel.look`'a yazar (kaydırıcılar ~60 ms
// birleştirilir); pencereler ve bu sayfa theme/look.mjs ile tercihi canlı izler. Üstte gerçek ölçülerle
// çizilen şerit maketi, altında hazır/kullanıcı paketleri ve tek tek ayarlar.
import { h, icon, getPref, setPref, watch, seg, select, row, card, notify, range, colorInput, debounce } from "./ui.mjs";
import * as Look from "chrome://userscripts/content/theme/look.mjs";
import * as Packs from "chrome://userscripts/content/theme/packs.mjs";

const D = Look.DEFAULTS;
const NAMES = [Look.PREF, "rigel.accent", "rigel.theme", Look.PACKS_PREF, Look.UNDO_PREF];
const btn = (text, onclick, cls = "soft", ic) =>
  h("button", { type: "button", class: "btn " + cls, onclick }, ic && icon(ic, 14), text);

// Kaydırıcı değişiklikleri birleştirilip tek yazımda tercihe gider.
let pending = {};
const flush = debounce(() => { const p = pending; pending = {}; Look.patch(p); }, 60);
const put = (k, v) => { pending[k] = v; flush(); };
const cur = () => ({ ...Look.read(), ...pending });
const val = k => cur()[k] ?? D[k];
const bgOf = () => ({ ...D.bg, ...(cur().bg ?? {}) });
const putBg = changes => put("bg", { ...bgOf(), ...changes });

const ACCENT_HEX = { rigel: "#5fa9dd", violet: "#9b8cf0", green: "#4fbf8f", orange: "#f2a06b", pink: "#e879b0", teal: "#3cc4c0", indigo: "#8191f7", red: "#ef6461", amber: "#e9b44c", lime: "#9ccf55", slate: "#a3adbf" };
const TS_ASCII = { "kart": "kart", "hap": "hap", "çizgi": "cizgi", "düz": "duz" };
// Önizleme kartında sayfa kökünden miras alınmaması için tüm stüdyo değişkenleri açıkça yazılır.
const ALL_VARS = ["--rigel-radius", "--rigel-radius-sm", "--rigel-pill-radius", "--rigel-space", "--rigel-tabbar-h", "--rigel-tab-h", "--rigel-navbar-h",
  "--rigel-urlbar-h", "--rigel-row-h", "--rigel-bookmarks-height", "--rigel-font-size", "--rigel-bg-image", "--rigel-glass", "--rigel-strip-bg",
  "--rigel-surface-bg", "--rigel-glass-filter", "--rigel-tab-width", "--accent", "--accent-2", "--accent-ink", "--font"];

/** Şerit maketi: gerçek pencerenin kullandığı değişkenlerle çizilir. */
function mock(mini = false) {
  const tab = (label, on) => h("i", { class: "mt" + (on ? " on" : "") }, h("u"), h("span", { text: label }), h("s", { text: "×" }));
  return h("div", { class: "mock" + (mini ? " mini" : ""), "aria-hidden": "true" },
    h("div", { class: "mstrip" }, tab("Rigel", true), tab("Haberler"), tab("Belgeler"), h("span", { class: "mplus", text: "+" })),
    h("div", { class: "mnav" }, h("span", { class: "mbtn" }), h("span", { class: "mbtn" }), h("span", { class: "mbtn" }),
      h("div", { class: "murl", text: "rigel.app" }), h("span", { class: "mbtn" }), h("span", { class: "mbtn acc" })),
    h("div", { class: "mpage" }, h("b"), h("i"), h("em")));
}

/** Paket önizlemesi: paketin görünümü kartın kendisine yazılır (kök değerlerinden yalıtılmış). */
function packPreview(pack) {
  const el = mock(true);
  const full = { radius: D.radius, density: D.density, fontSize: D.fontSize, tabWidth: D.tabWidth, ...pack.look };
  const { vars } = Look.compute(full);
  for (const name of ALL_VARS) el.style.setProperty(name, name in vars ? vars[name] : "initial");
  if (!pack.look.font || pack.look.font === "system") el.style.setProperty("--font", Look.FONTS.system[1]);
  if (!pack.look.accentCustom) {
    const a = ACCENT_HEX[pack.accent ?? getPref("rigel.accent", "rigel")] ?? ACCENT_HEX.rigel;
    el.style.setProperty("--accent", a);
  }
  el.dataset.ts = TS_ASCII[pack.look.tabStyle] ?? "kart";
  return el;
}

function packCard(pack, onDelete) {
  const b = h("button", { type: "button", class: "pack", title: `${pack.name} paketini uygula`, onclick: () => { Packs.applyPack(pack); notify(`"${pack.name}" uygulandı. Geri al ile dönebilirsin.`); } },
    packPreview(pack),
    h("span", { class: "pname" }, h("b", { text: pack.name }), pack.desc && h("small", { text: pack.desc })));
  if (!onDelete) return b;
  return h("div", { class: "packwrap" }, b,
    h("button", { type: "button", class: "iconbtn pdel", title: "JSON olarak kopyala", onclick: () => copy(Packs.exportText(pack)) }, icon("link", 14)),
    h("button", { type: "button", class: "iconbtn pdel2", title: "Paketi sil", onclick: onDelete }, icon("trash", 14)));
}

function copy(text) {
  try {
    Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(text);
    notify("Panoya kopyalandı.");
  } catch (e) {
    notify("Kopyalanamadı: " + e.message, false);
  }
}

function packsCard() {
  const grid = h("div", { class: "packs" });
  const mine = h("div", { class: "packs" });
  const undoBtn = btn("Geri al", () => { if (Packs.undo()) notify("Önceki görünüme dönüldü."); }, "soft", "undo");
  const render = () => {
    grid.replaceChildren(...Packs.PACKS.map(p => packCard(p)));
    const list = Packs.userPacks();
    mine.replaceChildren(...list.map(p => packCard(p, () => {
      Packs.setUserPacks(list.filter(x => x.id !== p.id));
      notify(`"${p.name}" silindi.`);
    })));
    mine.hidden = !list.length;
    undoBtn.disabled = !Packs.canUndo();
  };
  render();
  watch([Look.PACKS_PREF, Look.UNDO_PREF, "rigel.accent"], render);

  const name = h("input", { type: "text", placeholder: "Paket adı", maxlength: "40", spellcheck: "false" });
  const save = () => {
    const n = name.value.trim() || "Paketim";
    Packs.setUserPacks([...Packs.userPacks(), Packs.snapshot(n)]);
    name.value = "";
    notify(`"${n}" kaydedildi.`);
  };
  name.addEventListener("keydown", e => e.key === "Enter" && save());

  const area = h("textarea", { class: "code", rows: "4", spellcheck: "false", placeholder: '{ "name": "…", "look": { "radius": 12, … }, "accent": "violet" }' });
  const doImport = () => {
    let obj;
    try { obj = JSON.parse(area.value); } catch (e) { notify("Geçersiz JSON: " + e.message, false); return; }
    const p = Packs.sanitizePack(obj, "İçe aktarılan");
    if (!p) { notify("Paket okunamadı.", false); return; }
    Packs.setUserPacks([...Packs.userPacks().filter(x => x.id !== p.id), p]);
    area.value = "";
    notify(`"${p.name}" eklendi; uygulamak için kartına tıkla.`);
  };

  return card("Tema paketleri",
    h("p", { class: "hint", text: "Tek tıkla uygulanır: görünüm, vurgu rengi ve gerekirse tema birlikte değişir." }),
    grid,
    row({ id: "packUndo", label: "Geri al", desc: "Son paket uygulanmadan önceki görünüme, vurguya ve temaya döner.", keywords: "geri al undo paket önceki",
      control: h("div", { class: "toolrow" }, undoBtn) }),
    row({ id: "packSave", label: "Mevcut görünümü paket olarak kaydet", desc: "Stüdyo ayarları, vurgu ve tema birlikte saklanır.", keywords: "kaydet paket kendi özel tema dışa aktar",
      control: h("div", { class: "toolrow" }, name, btn("Kaydet", save, "", "plus"), btn("JSON kopyala", () => copy(Packs.exportText(Packs.snapshot("Paketim"))), "soft", "link")) }),
    mine,
    row({ id: "packImport", label: "JSON'dan içe aktar", desc: "Kopyalanmış bir paketi yapıştır.", keywords: "içe aktar json yapıştır paylaş import", stack: true,
      control: h("div", { class: "stackbox" }, area, h("div", { class: "toolrow" }, btn("İçe aktar", doImport, "soft", "import"))) }));
}

function studio() {
  const m = mock();
  const syncMock = () => (m.dataset.ts = TS_ASCII[val("tabStyle")] ?? "kart");
  syncMock();
  watch([Look.PREF], syncMock);
  const names = [Look.PREF];

  const fontSel = select([...Object.entries(Look.FONTS).map(([k, [label]]) => [k, label]), ["custom", "Özel…"]], {
    get: () => (Look.FONTS[val("font")] ? val("font") : "custom"),
    set: v => { if (v !== "custom") put("font", v === "system" ? undefined : v); else fontName.focus(); syncFont(); },
    names,
  });
  const fontName = h("input", { type: "text", placeholder: "Yazı tipi adı (ör. IBM Plex Sans)", spellcheck: "false" });
  const syncFont = () => {
    const f = val("font");
    fontName.hidden = !!Look.FONTS[f] && fontSel.value !== "custom";
    if (!Look.FONTS[f] && document.activeElement !== fontName) fontName.value = f;
  };
  fontName.addEventListener("change", () => fontName.value.trim() && put("font", fontName.value.trim()));
  syncFont();
  watch(names, syncFont);

  const bgType = seg([["none", "Yok"], ["solid", "Düz renk"], ["gradient", "Gradyan"]], { get: () => bgOf().type, set: v => putBg({ type: v }), names });
  const solidRow = row({ id: "bgColor", label: "Renk", sub: true, keywords: "arka plan renk düz", control: colorInput({ get: () => bgOf().color, set: v => putBg({ color: v }), names }) });
  const gradRow = row({ id: "bgGrad", label: "Gradyan renkleri", sub: true, keywords: "gradyan renk geçiş",
    control: h("div", { class: "toolrow" }, colorInput({ get: () => bgOf().from, set: v => putBg({ from: v }), names, title: "Başlangıç" }),
      colorInput({ get: () => bgOf().to, set: v => putBg({ to: v }), names, title: "Bitiş" })) });
  const angleRow = row({ id: "bgAngle", label: "Açı", sub: true, keywords: "gradyan açı yön",
    control: range({ min: 0, max: 360, step: 5, unit: "°", get: () => bgOf().angle, set: v => putBg({ angle: v }), names }) });
  const syncBg = () => {
    const t = bgOf().type;
    solidRow.hidden = t !== "solid";
    gradRow.hidden = angleRow.hidden = t !== "gradient";
  };
  syncBg();
  watch(names, syncBg);

  const accOn = h("input", { type: "checkbox", class: "switch", role: "switch" });
  const accColor = colorInput({ get: () => val("accentCustom") || ACCENT_HEX[getPref("rigel.accent", "rigel")], set: v => put("accentCustom", v), names: [...names, "rigel.accent"] });
  const syncAcc = () => { accOn.checked = !!val("accentCustom"); accColor.hidden = !accOn.checked; };
  accOn.addEventListener("change", () => { put("accentCustom", accOn.checked ? accColor.value : undefined); accColor.hidden = !accOn.checked; });
  syncAcc();
  watch(names, syncAcc);

  return [
    h("div", { class: "mockwrap" }, m,
      h("div", { class: "mockbar" }, h("small", { text: "Değişiklikler tüm pencerelere anında uygulanır." }),
        btn("Varsayılana dön", () => { pending = {}; Look.write({}); notify("Görünüm varsayılana döndü."); }, "soft", "undo"))),
    packsCard(),
    card("Biçim",
      row({ id: "radius", label: "Köşe yarıçapı", desc: "Sekmeler, düğmeler, adres çubuğu ve sayfa kartı birlikte ölçeklenir.", keywords: "köşe yarıçap yuvarlak radius keskin",
        control: range({ min: 0, max: 20, unit: " px", get: () => val("radius"), set: v => put("radius", v), names }) }),
      row({ id: "density", label: "Yoğunluk", desc: "Şerit, araç çubuğu ve sekme satırlarının yüksekliği.", keywords: "yoğunluk sıkı ferah kompakt boşluk yükseklik density",
        control: seg([["sıkı", "Sıkı"], ["normal", "Normal"], ["ferah", "Ferah"]], { get: () => val("density"), set: v => put("density", v), names }) }),
      row({ id: "tabStyle", label: "Sekme biçimi", desc: "Kart: sayfaya bağlanan sekme. Hap: yüzen yuvarlak. Çizgi: alt çizgi. Düz: sade zemin.", keywords: "sekme biçim stil kart hap çizgi düz tab style",
        control: seg([["kart", "Kart"], ["hap", "Hap"], ["çizgi", "Çizgi"], ["düz", "Düz"]], { get: () => val("tabStyle"), set: v => put("tabStyle", v), names }) }),
      row({ id: "tabWidth", label: "En geniş sekme", desc: "Klasik düzende bir sekmenin alabileceği en büyük genişlik.", keywords: "sekme genişlik geniş dar width",
        control: range({ min: 120, max: 320, step: 10, unit: " px", get: () => val("tabWidth"), set: v => put("tabWidth", v), names }) }),
      row({ id: "shadow", label: "Gölge", desc: "Paneller, menüler ve yüzen öğelerin gölge gücü.", keywords: "gölge shadow derinlik",
        control: range({ min: 0, max: 3, format: v => ["Yok", "Hafif", "Orta", "Derin"][v], get: () => val("shadow"), set: v => put("shadow", v), names }) })),
    card("Yazı",
      row({ id: "font", label: "Yazı tipi", desc: "Şerit, kenar çubuğu, adres çubuğu ve Rigel sayfaları.", keywords: "yazı tipi font inter noto mono",
        control: h("div", { class: "toolrow" }, fontName, fontSel) }),
      row({ id: "fontSize", label: "Yazı boyutu", keywords: "yazı boyutu büyük küçük font size",
        control: range({ min: 11, max: 15, unit: " px", get: () => val("fontSize"), set: v => put("fontSize", v), names }) })),
    card("Arka plan ve renk",
      row({ id: "bg", label: "Pencere arka planı", desc: "Şeridin ve kenar çubuğunun arkasında görünür; sayfa içeriği etkilenmez.", keywords: "arka plan zemin gradyan renk background wallpaper", control: bgType }),
      solidRow, gradRow, angleRow,
      row({ id: "glass", label: "Cam etkisi", desc: "Şerit ve araç çubuğu saydamlaşır, arkası bulanıklaşır. Arka plan seçmeden de vurgu tonlu hafif bir parıltı verir.", keywords: "cam saydam şeffaf bulanık glass blur transparan",
        control: range({ min: 0, max: 100, step: 5, unit: "%", get: () => val("glass"), set: v => put("glass", v), names }) }),
      row({ id: "accentCustom", label: "Özel vurgu rengi", desc: "Hazır vurgu renklerinden birini seçince kapanır.", keywords: "vurgu renk özel accent seçici",
        control: h("div", { class: "toolrow" }, accColor, accOn) })),
  ];
}

export { studio };
