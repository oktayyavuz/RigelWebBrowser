// Ayarlar › Görünüm stüdyosu. Her denetim `rigel.look`'a yazar (kaydırıcılar ~60 ms
// birleştirilir); pencereler ve bu sayfa theme/look.mjs ile tercihi canlı izler. Üstte gerçek ölçülerle
// çizilen şerit maketi, altında hazır/kullanıcı paketleri ve tek tek ayarlar.
import { h, icon, getPref, setPref, watch, toggle, seg, select, row, card, notify, range, colorInput, debounce, accentPicker, themeSeg } from "./ui.mjs";
import * as NewtabCfg from "../newtab/config.mjs";
import * as Look from "chrome://userscripts/content/theme/look.mjs";
import * as Packs from "chrome://userscripts/content/theme/packs.mjs";
import * as Bg from "chrome://userscripts/content/theme/bg.mjs";
import * as Buttons from "chrome://userscripts/content/theme/buttons.mjs";
import { onDispose, chromeWin } from "./ui.mjs";

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

const resolvedTheme = () => (document.documentElement.getAttribute("data-rigel-theme") === "light" ? "light" : "dark");
const ACCENT_HEX = { rigel: "#5fa9dd", violet: "#9b8cf0", green: "#4fbf8f", orange: "#f2a06b", pink: "#e879b0", teal: "#3cc4c0", indigo: "#8191f7", red: "#ef6461", amber: "#e9b44c", lime: "#9ccf55", slate: "#a3adbf" };
const TS_ASCII = { "kart": "kart", "hap": "hap", "çizgi": "cizgi", "düz": "duz" };
// Önizleme kartında sayfa kökünden miras alınmaması için tüm stüdyo değişkenleri açıkça yazılır.
const ALL_VARS = ["--rigel-radius", "--rigel-radius-sm", "--rigel-pill-radius", "--rigel-space", "--rigel-tabbar-h", "--rigel-tab-h", "--rigel-navbar-h",
  "--rigel-urlbar-h", "--rigel-row-h", "--rigel-bookmarks-height", "--rigel-font-size", "--rigel-bg-image", "--rigel-glass", "--rigel-strip-bg",
  "--rigel-surface-bg", "--rigel-glass-filter", "--rigel-tab-width", "--rigel-bw", "--rigel-ink", "--rigel-hard-sm", "--accent", "--accent-2", "--accent-ink", "--font"];

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
  const theme = resolvedTheme();
  const { vars } = Look.compute(full, theme);
  for (const name of ALL_VARS) el.style.setProperty(name, name in vars ? vars[name] : "initial");
  // Renk belirteçleri sayfa kökünden (kullanıcının özel renklerinden) yalıtılır: paketin rengi ya da temanın varsayılanı.
  for (const [name, def] of Object.entries(Look.TOKEN_DEFAULTS[theme])) el.style.setProperty(name, vars[name] ?? def);
  if (vars["color-scheme"]) el.style.setProperty("color-scheme", vars["color-scheme"]);
  el.style.setProperty("--shadow-sm", vars["--shadow-sm"] ?? "none");
  if (!pack.look.font || pack.look.font === "system") el.style.setProperty("--font", Look.FONTS.system[1]);
  if (!vars["--accent"]) {
    const a = ACCENT_HEX[pack.accent ?? getPref("rigel.accent", "rigel")] ?? ACCENT_HEX.rigel;
    el.style.setProperty("--accent", a);
  }
  el.dataset.ts = TS_ASCII[pack.look.tabStyle] ?? "kart";
  return el;
}

function packCard(pack, onDelete) {
  const b = h("button", { type: "button", class: "pack", title: `${pack.name} paketini uygula`, onclick: () => applyWithMods(pack) },
    packPreview(pack),
    h("span", { class: "pname" }, h("b", { text: pack.name }), pack.desc && h("small", { text: pack.desc }),
      pack.mods?.length && h("small", { class: "pmods", text: `+ ${pack.mods.length} mod` })));
  if (!onDelete) return b;
  return h("div", { class: "packwrap" }, b,
    h("button", { type: "button", class: "iconbtn pdel", title: "JSON olarak kopyala", onclick: () => copy(Packs.exportText(pack)) }, icon("link", 14)),
    h("button", { type: "button", class: "iconbtn pdel2", title: "Paketi sil", onclick: onDelete }, icon("trash", 14)));
}

function applyWithMods(pack) {
  notify(`"${pack.name}" uygulandı. Geri al ile dönebilirsin.`);
  Promise.resolve(Packs.applyPack(pack)).then(r => {
    if (r?.failed?.length) notify(`Şu modlar açılamadı: ${r.failed.join(", ")}`, false);
    else if (r?.enabled?.length) notify(`"${pack.name}" uygulandı; ${r.enabled.length} mod açık. Geri al modları da kapatır.`);
  }).catch(e => notify("Paket modları: " + e.message, false));
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

  const bgType = seg([["none", "Yok"], ["solid", "Düz renk"], ["gradient", "Gradyan"], ["image", "Görsel"]], {
    get: () => bgOf().type,
    set: v => { if (v === "image" && !bgOf().file) pickImage(); else putBg({ type: v }); },
    names,
  });
  const fileLabel = h("small", { class: "bgfile" });
  const pickImage = async () => {
    try {
      const path = await Bg.pick(window);
      if (!path) { bgType.refresh?.(); return; }
      const file = await Bg.importImage(path);
      const b = bgOf();
      if (b.blur) await Bg.ensureBlur(document, file, b.blur);
      putBg({ type: "image", file });
      notify("Görsel arka plan uygulandı.");
      // Eski görseller: şu an, geri al yedeği, kullanıcı paketleri ve yeni sekmede kullanılanlar dışındakiler silinir.
      NewtabCfg.pruneLater();
    } catch (e) {
      notify("Görsel eklenemedi: " + e.message, false);
    }
  };
  const imgRow = row({ id: "bgImage", label: "Görsel", sub: true, desc: "Dosya profildeki rigel-bg klasörüne kopyalanır.", keywords: "arka plan görsel resim fotoğraf duvar kağıdı wallpaper image",
    control: h("div", { class: "toolrow" }, fileLabel, btn("Görsel seç…", pickImage, "soft", "folder")) });
  const fitRow = row({ id: "bgFit", label: "Konum", sub: true, keywords: "görsel konum kaplama ortala",
    control: seg([["cover", "Kaplama"], ["center", "Ortala"]], { get: () => bgOf().fit, set: v => putBg({ fit: v }), names }) });
  const blurApply = debounce(async v => {
    const f = bgOf().file;
    try { if (f && v) await Bg.ensureBlur(document, f, v); } catch (e) { notify("Bulanıklık üretilemedi: " + e.message, false); }
    putBg({ blur: v });
  }, 220);
  const blurRow = row({ id: "bgBlur", label: "Bulanıklık", sub: true, keywords: "görsel bulanık blur",
    control: range({ min: 0, max: 40, step: 2, unit: " px", get: () => bgOf().blur, set: blurApply, names }) });
  const dimRow = row({ id: "bgDim", label: "Karartma", sub: true, desc: "Yazıların okunaklı kalması için görselin üstüne koyu katman.", keywords: "görsel karart koyu kontrast",
    control: range({ min: 0, max: 80, step: 5, unit: "%", get: () => bgOf().dim, set: v => putBg({ dim: v }), names }) });
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
    imgRow.hidden = fitRow.hidden = blurRow.hidden = dimRow.hidden = t !== "image";
    fileLabel.textContent = bgOf().file || "Görsel seçilmedi";
  };
  syncBg();
  watch(names, syncBg);

  return [
    h("div", { class: "mockwrap" }, m,
      h("div", { class: "mockbar" }, h("small", { text: "Değişiklikler tüm pencerelere anında uygulanır." }),
        btn("Varsayılana dön", () => { pending = {}; Look.write({}); notify("Görünüm varsayılana döndü."); }, "soft", "undo"))),
    packsCard(),
    colorsCard(),
    card("Biçim",
      row({ id: "radius", label: "Köşe yarıçapı", desc: "Sekmeler, düğmeler, adres çubuğu ve sayfa kartı birlikte ölçeklenir.", keywords: "köşe yarıçap yuvarlak radius keskin",
        control: range({ min: 0, max: 20, unit: " px", get: () => val("radius"), set: v => put("radius", v), names }) }),
      row({ id: "density", label: "Yoğunluk", desc: "Şerit, araç çubuğu ve sekme satırlarının yüksekliği.", keywords: "yoğunluk sıkı ferah kompakt boşluk yükseklik density",
        control: seg([["sıkı", "Sıkı"], ["normal", "Normal"], ["ferah", "Ferah"]], { get: () => val("density"), set: v => put("density", v), names }) }),
      row({ id: "tabStyle", label: "Sekme biçimi", desc: "Kart: sayfaya bağlanan sekme. Hap: yüzen yuvarlak. Çizgi: alt çizgi. Düz: sade zemin.", keywords: "sekme biçim stil kart hap çizgi düz tab style",
        control: seg([["kart", "Kart"], ["hap", "Hap"], ["çizgi", "Çizgi"], ["düz", "Düz"]], { get: () => val("tabStyle"), set: v => put("tabStyle", v), names }) }),
      row({ id: "tabWidth", label: "En geniş sekme", desc: "Klasik düzende bir sekmenin alabileceği en büyük genişlik.", keywords: "sekme genişlik geniş dar width",
        control: range({ min: 120, max: 320, step: 10, unit: " px", get: () => val("tabWidth"), set: v => put("tabWidth", v), names }) }),
      row({ id: "border", label: "Çizgi kalınlığı", desc: "0: ince, yumuşak çizgiler. 1–3: düz, yazı renginde kalın çizgiler (sekme, kart, palet, menü, düğme).", keywords: "çizgi kalın kenarlık border brütal brutalist çerçeve",
        control: range({ min: 0, max: 3, format: v => (v ? `${v} px` : "İnce"), get: () => val("border"), set: v => put("border", v), names }) }),
      row({ id: "shadowStyle", label: "Gölge biçimi", desc: "Yumuşak: bulanık gölge. Sert: bulanıksız, ofsetli (Brütal); boyutu \"Gölge\" belirler.", keywords: "gölge sert yumuşak brütal ofset hard soft",
        control: seg([["soft", "Yumuşak"], ["hard", "Sert"]], { get: () => val("shadowStyle"), set: v => put("shadowStyle", v), names }) }),
      row({ id: "heavy", label: "Kalın yazı", desc: "Sekme adları, adres ve başlıklar kalın yazılır.", keywords: "kalın yazı bold ağır brütal başlık",
        control: toggle("rigel.look", { get: () => !!val("heavy"), set: v => put("heavy", v || undefined), names }) }),
      row({ id: "shadow", label: "Gölge", desc: "Paneller, menüler ve yüzen öğelerin gölge gücü.", keywords: "gölge shadow derinlik",
        control: range({ min: 0, max: 3, format: v => ["Yok", "Hafif", "Orta", "Derin"][v], get: () => val("shadow"), set: v => put("shadow", v), names }) })),
    card("Yazı",
      row({ id: "font", label: "Yazı tipi", desc: "Şerit, kenar çubuğu, adres çubuğu ve Rigel sayfaları.", keywords: "yazı tipi font inter noto mono",
        control: h("div", { class: "toolrow" }, fontName, fontSel) }),
      row({ id: "fontSize", label: "Yazı boyutu", keywords: "yazı boyutu büyük küçük font size",
        control: range({ min: 11, max: 15, unit: " px", get: () => val("fontSize"), set: v => put("fontSize", v), names }) })),
    card("Arka plan",
      row({ id: "bg", label: "Pencere arka planı", desc: "Şeridin ve kenar çubuğunun arkasında görünür; sayfa içeriği etkilenmez.", keywords: "arka plan zemin gradyan renk background wallpaper", control: bgType }),
      solidRow, gradRow, angleRow, imgRow, fitRow, blurRow, dimRow,
      row({ id: "glass", label: "Cam etkisi", desc: "Şerit ve araç çubuğu saydamlaşır, arkası bulanıklaşır. Arka plan seçmeden de vurgu tonlu hafif bir parıltı verir.", keywords: "cam saydam şeffaf bulanık glass blur transparan",
        control: range({ min: 0, max: 100, step: 5, unit: "%", get: () => val("glass"), set: v => put("glass", v), names }) }),
    ),
    buttonsCard(),
    autoCard(),
  ];
}

/** Araç düğmeleri: nav-bar (Klasik ve Yan Panel'de görünür). Sürükle-bırak ya da ↑/↓; anahtar göster/gizle. */
function buttonsCard() {
  const listEl = h("div", { class: "btnlist", role: "list" });
  const resetBtn = btn("Varsayılana dön", () => { Buttons.reset(); notify("Araç düğmeleri varsayılana döndü."); }, "soft", "undo");
  let dragId = null;
  const render = () => {
    const win = chromeWin();
    const items = Buttons.list(win);
    const shown = items.filter(i => i.inArea);
    const rowOf = it => {
      const i = shown.indexOf(it);
      const sw = h("input", { type: "checkbox", class: "switch", role: "switch", title: it.shown ? "Gizle" : "Göster" });
      sw.checked = it.shown;
      sw.disabled = !it.removable;
      sw.addEventListener("change", () => Buttons.show(it.id, sw.checked));
      const up = h("button", { type: "button", class: "iconbtn", title: "Yukarı (sola)", text: "↑", onclick: () => Buttons.step(it.id, -1) });
      const down = h("button", { type: "button", class: "iconbtn", title: "Aşağı (sağa)", text: "↓", onclick: () => Buttons.step(it.id, 1) });
      up.disabled = !it.inArea || i <= 0;
      down.disabled = !it.inArea || i >= shown.length - 1;
      const el = h("div", { class: "bitem" + (it.shown ? "" : " off"), role: "listitem", draggable: it.inArea ? "true" : "false", "data-id": it.id },
        h("span", { class: "grip", text: it.inArea ? "⋮⋮" : "" }),
        h("span", { class: "bname" }, h("b", { text: it.label }), it.extension && h("small", { text: "eklenti" }), it.fixed && h("small", { text: "sabit" })),
        h("div", { class: "toolrow" }, up, down, sw));
      if (it.inArea) {
        el.addEventListener("dragstart", e => { dragId = it.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.id); el.classList.add("drag"); });
        el.addEventListener("dragend", () => { dragId = null; el.classList.remove("drag"); listEl.querySelectorAll(".over").forEach(x => x.classList.remove("over")); });
        el.addEventListener("dragover", e => { if (dragId && dragId !== it.id) { e.preventDefault(); el.classList.add("over"); } });
        el.addEventListener("dragleave", () => el.classList.remove("over"));
        el.addEventListener("drop", e => {
          e.preventDefault();
          if (!dragId || dragId === it.id) return;
          const r = el.getBoundingClientRect();
          const after = e.clientY > r.top + r.height / 2;
          const next = after ? shown[i + 1]?.id ?? null : it.id;
          if (next !== dragId) Buttons.moveBefore(dragId, next);
        });
      }
      return el;
    };
    const menu = h("div", { class: "bitem" + (Buttons.menuHidden() ? " off" : ""), role: "listitem" },
      h("span", { class: "grip" }),
      h("span", { class: "bname" }, h("b", { text: "Menü (☰)" }), h("small", { text: "hep en sağda" })),
      h("div", { class: "toolrow" }, (() => {
        const sw = h("input", { type: "checkbox", class: "switch", role: "switch" });
        sw.checked = !Buttons.menuHidden();
        sw.addEventListener("change", () => Buttons.hideMenu(!sw.checked));
        return sw;
      })()));
    listEl.replaceChildren(...items.map(rowOf), menu);
    resetBtn.disabled = !Buttons.changed();
  };
  const later = debounce(render, 30);
  try {
    render();
    onDispose(Buttons.listen(later));
  } catch (e) {
    listEl.append(h("p", { class: "hint", text: "Araç düğmeleri okunamadı: " + e.message }));
  }
  watch([Look.BUTTONS_PREF], later);
  return card("Araç düğmeleri",
    h("p", { class: "hint", text: "Klasik ve Yan Panel'deki araç çubuğu. Sürükleyerek ya da ↑/↓ ile sırala; anahtarla göster/gizle. Değişiklik tüm pencerelere anında uygulanır." }),
    listEl,
    row({ id: "buttonsReset", label: "Varsayılana dön", desc: "İlk değişiklikten önceki sıraya ve görünürlüğe döner.", keywords: "araç düğme sıfırla varsayılan toolbar reset",
      control: h("div", { class: "toolrow" }, resetBtn) }));
}

/** Otomatik gece/gündüz: saate göre paket (rigel.look.auto). */
function autoCard() {
  const names = [Look.AUTO_PREF, Look.PACKS_PREF];
  const a = () => Packs.readAuto();
  const packOpts = () => Packs.allPacks().map(p => [p.id, p.name]);
  const sel = key => {
    const s = h("select", {});
    const fill = () => {
      s.replaceChildren(...packOpts().map(([v, l]) => h("option", { value: v, text: l })));
      s.value = a()[key];
    };
    s.addEventListener("change", () => Packs.writeAuto({ [key]: s.value }));
    fill();
    watch(names, fill);
    return s;
  };
  const time = key => {
    const t = h("input", { type: "time", class: "time" });
    const sync = () => { if (document.activeElement !== t) t.value = a()[key]; };
    t.addEventListener("change", () => t.value && Packs.writeAuto({ [key]: t.value }));
    sync();
    watch(names, sync);
    return t;
  };
  const on = h("input", { type: "checkbox", class: "switch", role: "switch" });
  const now = h("small", { class: "hint" });
  const sync = () => {
    on.checked = a().on;
    now.textContent = a().on ? `Şu an: ${Packs.autoPeriod() === "day" ? "gündüz" : "gece"}` : "";
  };
  on.addEventListener("change", () => Packs.writeAuto({ on: on.checked }));
  sync();
  watch(names, sync);
  return card("Otomatik gece/gündüz",
    row({ id: "autoOn", label: "Saate göre paket değiştir", desc: "Geçiş saatinde seçili paket kendiliğinden uygulanır; arada elle değiştirebilirsin.", keywords: "otomatik gece gündüz saat zamanla karanlık auto dark",
      control: h("div", { class: "toolrow" }, now, on) }),
    row({ id: "autoDay", label: "Gündüz paketi", sub: true, keywords: "gündüz paket", control: h("div", { class: "toolrow" }, sel("day"), time("dayAt")) }),
    row({ id: "autoNight", label: "Gece paketi", sub: true, keywords: "gece paket", control: h("div", { class: "toolrow" }, sel("night"), time("nightAt")) }));
}

/** Renkler: ana belirteçler (zemin, çubuklar, yüzeyler, yazı, soluk yazı) ve vurgu. Değerler `rigel.look.colors[tema]`;
 *  yalnız değiştirilen renk saklanır, "varsayılana dön" anahtarı siler. Düzenlenen tema (koyu/açık) seçilebilir. */
function colorsCard() {
  const names = [Look.PREF, "rigel.theme", "rigel.accent"];
  const C = Look.COLOR_DEFAULTS;
  let edit = resolvedTheme();
  let manual = false;
  const syncs = [];
  const eff = t => ({ ...C[t], ...(cur().colors?.[t] ?? {}) });
  const isSet = (t, k) => !!cur().colors?.[t]?.[k];
  const writeColors = colors => {
    for (const t of Object.keys(colors)) if (!Object.keys(colors[t]).length) delete colors[t];
    put("colors", Object.keys(colors).length ? colors : undefined);
  };
  const clone = () => JSON.parse(JSON.stringify(cur().colors ?? {}));
  const setColor = (k, v) => {
    const colors = clone();
    const c = (colors[edit] ??= {});
    if (v.toLowerCase() === C[edit][k]) delete c[k];
    else c[k] = v.toLowerCase();
    writeColors(colors);
  };
  const resetColor = k => { const colors = clone(); if (colors[edit]) delete colors[edit][k]; writeColors(colors); };
  const presetHex = () => ACCENT_HEX[getPref("rigel.accent", "rigel")] || ACCENT_HEX.rigel;
  const accentHex = () => cur().colors?.[edit]?.accent || cur().accentCustom || presetHex();
  const setAccent = v => {
    const colors = clone();
    (colors[edit] ??= {}).accent = v.toLowerCase();
    writeColors(colors);
  };
  const resetAccent = () => {
    const colors = clone();
    if (colors[edit]) delete colors[edit].accent;
    writeColors(colors);
    put("accentCustom", undefined);
  };

  const colorControl = ({ get, isSet: custom, set, reset, label }) => {
    const pick = h("input", { type: "color", class: "clr", title: label, "aria-label": label });
    const hexIn = h("input", { type: "text", class: "hexin", maxlength: "7", spellcheck: "false", "aria-label": `${label} (#rrggbb)` });
    const rst = h("button", { type: "button", class: "iconbtn", title: "Varsayılana dön", "aria-label": `${label}: varsayılana dön`, onclick: reset }, icon("undo", 14));
    pick.addEventListener("input", () => set(pick.value));
    hexIn.addEventListener("change", () => {
      let v = hexIn.value.trim();
      if (v && v[0] !== "#") v = "#" + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) set(v);
      else sync();
    });
    const sync = () => {
      const v = get();
      pick.value = v;
      if (document.activeElement !== hexIn) hexIn.value = v;
      rst.disabled = !custom();
    };
    syncs.push(sync);
    sync();
    return h("div", { class: "toolrow colorctl" }, pick, hexIn, rst);
  };
  const colorRow = (key, label, desc) => row({
    id: "col-" + key, label, desc, keywords: `renk ${label} zemin çubuk yüzey yazı soluk kontrast color`,
    control: colorControl({ label, get: () => eff(edit)[key], isSet: () => isSet(edit, key), set: v => setColor(key, v), reset: () => resetColor(key) }),
  });

  // Düzenlenen tema
  const themeSel = seg([["dark", "Koyu"], ["light", "Açık"]], { get: () => edit, set: v => { edit = v; manual = true; syncAll(); }, names: [] });
  const themeNote = h("small", { class: "hint" });
  syncs.push(() => {
    themeSel.refresh?.();
    const now = resolvedTheme();
    themeNote.textContent = edit === now ? "Şu an kullanılan tema; değişiklikler pencerelere anında uygulanır." : `Şu an ${now === "dark" ? "koyu" : "açık"} tema kullanılıyor; bu temanın renkleri ona geçince devreye girer (önizleme aşağıda).`;
  });

  // Canlı önizleme: düzenlenen temanın renkleriyle, sayfa kökünden yalıtılmış.
  const prev = h("div", { class: "cprev", "aria-hidden": "true" },
    h("div", { class: "cp-bar" }, h("i"), h("i"), h("i"), h("span", { class: "cp-url", text: "rigel.app" }), h("em", { class: "cp-acc" })),
    h("div", { class: "cp-body" },
      h("div", { class: "cp-card" }, h("b", { text: "Kart başlığı" }), h("span", { text: "Soluk açıklama yazısı" }), h("u", { text: "Vurgu" })),
      h("div", { class: "cp-text" }, h("b", { text: "Ana yazı örneği" }), h("small", { text: "Soluk yazı örneği" }))));
  syncs.push(() => {
    const t = edit;
    const { vars } = Look.compute({ colors: { [t]: cur().colors?.[t] ?? {} }, ...(cur().accentCustom ? { accentCustom: cur().accentCustom } : {}) }, t);
    for (const [name, def] of Object.entries(Look.TOKEN_DEFAULTS[t])) prev.style.setProperty(name, vars[name] ?? def);
    prev.style.setProperty("color-scheme", vars["color-scheme"] ?? t);
    prev.style.setProperty("--accent", vars["--accent"] ?? presetHex());
    prev.style.setProperty("--accent-ink", vars["--accent-ink"] ?? (t === "light" ? "#ffffff" : "#08101c"));
  });

  // Kontrast: WCAG oranı; < 3 kötü, < 4,5 sınırda.
  const chips = h("div", { class: "cchips", role: "list" });
  const warn = h("p", { class: "cwarn", role: "status" });
  syncs.push(() => {
    const e = eff(edit);
    const pairs = [["Yazı / zemin", e.text, e.bg], ["Yazı / yüzey", e.text, e.surface], ["Soluk yazı / zemin", e.textDim, e.bg], ["Yazı / çubuk", e.text, e.bar]];
    const levels = pairs.map(([label, a, b]) => {
      const r = Look.contrast(a, b);
      return { label, r, lvl: r >= 4.5 ? "ok" : r >= 3 ? "warn" : "bad" };
    });
    chips.replaceChildren(...levels.map(({ label, r, lvl }) => h("span", { class: "cchip " + lvl, role: "listitem", title: lvl === "ok" ? "Okunaklı" : lvl === "warn" ? "Sınırda" : "Okunması zor" },
      h("b", { text: r.toFixed(1) + ":1" }), h("small", { text: label }))));
    const worst = levels.reduce((a, b) => (b.r < a.r ? b : a));
    warn.hidden = worst.lvl === "ok";
    warn.className = "cwarn " + worst.lvl;
    warn.textContent = worst.lvl === "ok" ? "" : `${worst.label} kontrastı ${worst.lvl === "bad" ? "çok düşük" : "düşük"} (${worst.r.toFixed(1)}:1); yazılar okunmayabilir. Daha açık ya da daha koyu bir ton dene.`;
  });

  // Vurgu: hazır renkler + özel
  const accentRow = colorControl({
    label: "Özel vurgu rengi", get: accentHex, isSet: () => !!(cur().colors?.[edit]?.accent || cur().accentCustom),
    set: setAccent, reset: resetAccent,
  });
  // Brütal vurgu blokları: tek tıkla temaya özel vurgu
  const accSw = h("div", { class: "swatches bsw", role: "radiogroup", "aria-label": "Canlı vurgu renkleri" }, ...Look.BRUTAL_ACCENTS.map(([hex, name]) => {
    const b = h("button", { type: "button", class: "swatch sq", title: name, "aria-label": name, onclick: () => setAccent(hex) });
    b.style.setProperty("--c", hex);
    b.dataset.v = hex;
    return b;
  }));
  syncs.push(() => { const cur_ = (cur().colors?.[edit]?.accent || cur().accentCustom || "").toLowerCase(); for (const b of accSw.children) b.classList.toggle("on", b.dataset.v === cur_); });

  const resetAll = () => {
    const colors = clone();
    delete colors[edit];
    writeColors(colors);
    put("accentCustom", undefined);
    notify(`${edit === "dark" ? "Koyu" : "Açık"} temanın renkleri varsayılana döndü.`);
  };
  const resetBtn = btn("Tüm renkleri sıfırla", resetAll, "soft", "undo");
  syncs.push(() => { resetBtn.disabled = !(cur().colors?.[edit] && Object.keys(cur().colors[edit]).length) && !cur().accentCustom; });

  const syncAll = () => syncs.forEach(f => f());
  watch(names, () => {
    if (!manual) edit = resolvedTheme();
    syncAll();
  });
  // Tema değişince sayfa özniteliği biraz sonra güncellenir.
  watch(["rigel.theme"], () => setTimeout(() => { if (!manual) edit = resolvedTheme(); syncAll(); }, 80));
  syncAll();

  const c = card("Renkler",
    h("p", { class: "hint", text: "Uygulamanın ana renkleri: tarayıcı şeritleri, yan paneller ve Rigel sayfaları (ayarlar, yeni sekme, kitaplık) birlikte değişir. Renkler temaya göre saklanır; değiştirmediğin renk temanın varsayılanıdır." }),
    row({ id: "colTheme", label: "Düzenlenen tema", keywords: "renk tema koyu açık dark light", control: h("div", { class: "toolrow" }, themeSel), desc: undefined }),
    themeNote,
    h("div", { class: "cpwrap" }, prev, chips),
    warn,
    colorRow("bg", "Arka plan", "Pencere ve sayfa zemini."),
    colorRow("bar", "Çubuklar", "Sekme şeridi, araç çubuğu ve kenar çubuğu."),
    colorRow("surface", "Yüzeyler", "Kartlar, menüler, paneller ve adres alanı."),
    colorRow("text", "Yazı", "Ana metin rengi; çizgiler ve üstüne gelme tonu da ondan türer."),
    colorRow("textDim", "Soluk yazı", "İkincil metin ve simgeler."),
    colorRow("danger", "Uyarı rengi", "Silme, hata ve basılı düğme durumları."),
    row({ id: "col-accent", label: "Vurgu rengi", desc: "Hazır tonlardan seç ya da aşağıdan özel bir renk ver.", keywords: "vurgu accent renk hazır mavi mor yeşil", control: accentPicker(), stack: true }),
    row({ id: "col-accentBold", label: "Canlı vurgular", sub: true, desc: "Düz, parlak bloklar; üstündeki yazı kontrasta göre siyah ya da beyaz olur. Düzenlenen temaya özeldir.", keywords: "vurgu canlı brütal sarı mavi pembe yeşil turuncu mor swatch", control: accSw, stack: true }),
    row({ id: "col-accentCustom", label: "Özel vurgu rengi", sub: true, desc: "Hazır vurgu renklerinden birini seçince kapanır.", keywords: "vurgu renk özel accent seçici", control: accentRow }),
    row({ id: "col-reset", label: "Varsayılana dön", desc: "Düzenlenen temanın renklerini ve özel vurguyu sıfırlar. Tema paketleriyle kaydedilir ve geri alınabilir.", keywords: "renk sıfırla varsayılan reset geri al",
      control: h("div", { class: "toolrow" }, resetBtn) }));
  c.dataset.anchor = "renkler";
  return c;
}

export { studio };
