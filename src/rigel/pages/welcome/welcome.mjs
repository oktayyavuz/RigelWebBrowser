// Kurulum sihirbazı: Hoş geldin → Aktar → Görünüm → Düzen → Arama → Gizlilik → Hazır.
// Seçimler anında uygulanır (tema, vurgu ve düzen canlı değişir); bitince rigel.welcome.done = true.
// Klavye: ← / → adımlar arasında, Enter sonraki adım. Adım adreste (#3) tutulur.
import {
  h, icon, getPref, setPref, watch, toggle, chromeWin, engineList, engineIcon, disposeAll, searchService, LAYOUTS, ACCENTS,
} from "../settings/ui.mjs";

const STEPS = [
  { name: "Hoş geldin" },
  { name: "Aktar", sub: "Yer imleri, geçmiş" },
  { name: "Görünüm", sub: "Tema ve renk" },
  { name: "Düzen", sub: "Sekmeler nerede dursun" },
  { name: "Arama", sub: "Varsayılan motor" },
  { name: "Gizlilik", sub: "Koruma seviyesi" },
  { name: "Hazır", sub: "Kısayollar" },
];
const LAST = STEPS.length - 1;
const ob = document.getElementById("ob");
const rail = document.getElementById("rail");
const stage = document.getElementById("stage");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let step = Math.min(LAST, Math.max(0, parseInt(location.hash.slice(1), 10) || 0));

const markDone = () => setPref("rigel.welcome.done", true);
// Sihirbazı görüp kapatan kullanıcıya bir daha gösterilmez.
addEventListener("unload", markDone);

function finish() {
  markDone();
  ob.classList.add("bye");
  setTimeout(() => location.replace("chrome://rigel/content/newtab/newtab.html"), reduced() ? 0 : 200);
}

// ---- Küçük yardımcılar -----------------------------------------------------------------------
const SVGNS = "http://www.w3.org/2000/svg";
const EXTRA = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  bolt: '<path d="M13 3L5 13.5h6l-1 7.5 8-10.5h-6z"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>',
};
function ico(name, size = 18) {
  if (!EXTRA[name]) return icon(name, size);
  const s = icon("info", size);
  s.innerHTML = EXTRA[name];
  return s;
}
const keycaps = combo => h("span", { class: "keys" },
  combo.split("+").map((k, i) => [i ? h("i", { text: "+" }) : null, h("kbd", { text: k.trim() })]));
const primary = (text, onclick, extra = {}) => h("button", { type: "button", class: "btn primary", onclick, ...extra }, h("span", { text }), icon("arrow", 16));
const ghost = (text, onclick, extra = {}) => h("button", { type: "button", class: "btn ghost", onclick, ...extra }, text);
const head = (title, lead) => h("header", { class: "head" },
  h("span", { class: "eyebrow", text: `Adım ${step} / ${LAST}` }),
  h("h2", { text: title }),
  lead && h("p", { class: "lead", html: lead }));
const backBtn = () => h("button", { type: "button", class: "btn ghost back", onclick: () => go(step - 1) }, ico("back", 16), "Geri");
const actions = ({ next = "Devam", skip = false, onNext } = {}) => h("footer", { class: "actions" },
  backBtn(),
  h("span", { class: "grow" }),
  skip && ghost("Atla", () => go(step + 1)),
  primary(next, onNext ?? (() => go(step + 1))));

// Rigel logosu, parçaları ayrı ayrı canlandırılabilir (theme/logo.svg ile aynı geometri).
function animLogo(size, cls = "") {
  const id = "al" + Math.random().toString(36).slice(2, 7);
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("viewBox", "0 0 32 32");
  s.setAttribute("width", size);
  s.setAttribute("height", size);
  s.setAttribute("fill", "none");
  s.setAttribute("class", "alogo " + cls);
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = `<defs>
    <linearGradient id="${id}r" x1="3" y1="29" x2="29" y2="3" gradientUnits="userSpaceOnUse"><stop stop-color="#5b86e0"/><stop offset="0.6" stop-color="#5fa9dd"/><stop offset="1" stop-color="#7cc3dc"/></linearGradient>
    <linearGradient id="${id}s" x1="8" y1="6" x2="25" y2="26" gradientUnits="userSpaceOnUse"><stop stop-color="#7cc3dc"/><stop offset="0.55" stop-color="#5fa9dd"/><stop offset="1" stop-color="#5b86e0"/></linearGradient></defs>
    <circle class="ring" cx="16" cy="16" r="12.6" stroke="url(#${id}r)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="60.168 98.168" stroke-dashoffset="-0.792" opacity="0.9"/>
    <g class="planet"><circle cx="25.9" cy="7.6" r="2.5" fill="url(#${id}r)"/></g>
    <path class="star" d="M16 6.4C16 11.1 18.9 15.3 23.6 16C18.9 16.7 16 20.9 16 25.6C16 20.9 13.1 16.7 8.4 16C13.1 15.3 16 11.1 16 6.4Z" fill="url(#${id}s)"/>`;
  return s;
}

// Tercih değişikliğini (tema gibi tüm sayfayı boyayan) yumuşak bir geçişle uygula.
function smoothly(fn) {
  if (!reduced() && document.startViewTransition) {
    try { document.startViewTransition(fn); return; } catch {}
  }
  fn();
}

// ---- Düzen maketleri (em tabanlı: yazı boyutuyla ölçeklenir) ---------------------------------------
const PAGE = '<div class="pg"><i class="hero"></i><i class="ln"></i><i class="ln s"></i><span class="cards"><i></i><i></i><i></i></span></div>';
const MOCKS = {
  ada: `<div class="bar ada"><i class="dot"></i><span class="stars"><i></i><i></i><i></i></span><span class="island"><i class="lk"></i><i class="tx"></i></span><span class="ctl"><i></i><i></i></span></div>${PAGE}`,
  dock: `<div class="bar thin"><i class="tx"></i></div>${PAGE}<div class="dockwrap"><span class="dock"><i class="on"></i><i></i><i></i><i></i><b></b></span></div>`,
  komuta: `<div class="bar"><i class="dot"></i><span class="crumb"><i class="lk"></i><i class="tx"></i></span><span class="count"><i></i><i></i></span></div><div class="row">${PAGE}<div class="drawer"><i class="srch"></i><i></i><i class="on"></i><i></i><i></i><i></i></div></div>`,
  yanpanel: `<div class="row"><div class="side"><i class="omni"></i><i class="on"></i><i></i><i></i><i></i><i class="grp"></i><i></i></div>${PAGE}</div>`,
  klasik: `<div class="strip"><i class="on"></i><i></i><i></i><b>+</b></div><div class="tool"><span class="nav"><i></i><i></i></span><span class="crumb"><i class="lk"></i><i class="tx"></i></span><span class="ctl"><i></i></span></div>${PAGE}`,
};
const mock = (id, cls = "") => h("div", { class: `mk mk-${id} ${cls}`, html: MOCKS[id] ?? "", "aria-hidden": "true" });

// ---- Sayfalar ---------------------------------------------------------------------------------
function heroScene() {
  return h("div", { class: "wrap hero" },
    h("div", { class: "orb" }, h("span", { class: "halo" }), animLogo(132, "intro")),
    h("h1", { text: "Rigel'e hoş geldin" }),
    h("p", { class: "lead", text: "Sade, hızlı ve sana ait bir tarayıcı. Bir dakikada kendine göre ayarlayalım." }),
    h("div", { class: "cta" }, primary("Başlayalım", () => go(1))),
    h("p", { class: "fine" }, "Her şeyi sonra Ayarlar'dan değiştirebilirsin · ", h("kbd", { text: "Enter" }), " ile başla"));
}

// İçe aktarma: Linux'ta bilinen tarayıcı klasörlerine bak (yalnız varlık kontrolü, içerik okunmaz).
const BROWSERS = [
  { id: "helium", name: "Helium", tile: ["He", "#3a7bd5"], path: ".config/net.imput.helium/Local State" },
  { id: "chrome", name: "Google Chrome", tile: ["Ch", "#2b9a4a"], path: ".config/google-chrome/Local State" },
  { id: "chromium", name: "Chromium", tile: ["Cr", "#4a86e8"], path: ".config/chromium/Local State" },
  { id: "brave", name: "Brave", tile: ["Br", "#fb542b"], path: ".config/BraveSoftware/Brave-Browser/Local State" },
  { id: "vivaldi", name: "Vivaldi", tile: ["Vi", "#ef3939"], path: ".config/vivaldi/Local State" },
  { id: "edge", name: "Microsoft Edge", tile: ["Ed", "#1a8fd8"], path: ".config/microsoft-edge/Local State" },
  { id: "opera", name: "Opera", tile: ["Op", "#d81b2a"], path: ".config/opera/Local State" },
  { id: "firefox", name: "Firefox", tile: ["Fx", "#ff7139"], path: ".mozilla/firefox/profiles.ini" },
];
async function detectBrowsers() {
  let home;
  try { home = Services.dirsvc.get("Home", Ci.nsIFile).path; } catch { return []; }
  const found = await Promise.all(BROWSERS.map(async b => {
    try { return (await IOUtils.exists(PathUtils.join(home, ...b.path.split("/")))) ? b : null; } catch { return null; }
  }));
  const list = found.filter(Boolean);
  return list;
}
function openMigration() {
  try {
    const { MigrationUtils } = ChromeUtils.importESModule("resource:///modules/MigrationUtils.sys.mjs");
    // Açan pencere verilmezse aktarma ayrı, küçük bir pencerede açılır; sihirbaz yerinde kalır.
    MigrationUtils.showMigrationWizard(null, { entrypoint: MigrationUtils.MIGRATION_ENTRYPOINTS.PREFERENCES });
  } catch (e) {
    console.error(e);
    try {
      const { MigrationUtils } = ChromeUtils.importESModule("resource:///modules/MigrationUtils.sys.mjs");
      MigrationUtils.showMigrationWizard(chromeWin(), { entrypoint: MigrationUtils.MIGRATION_ENTRYPOINTS.PREFERENCES });
    } catch {}
  }
}
function importScene() {
  const list = h("div", { class: "browsers", role: "list" }, [0, 1, 2].map(() => h("div", { class: "bcard skel" })));
  detectBrowsers().then(found => {
    if (!found.length) {
      list.replaceChildren(h("div", { class: "empty" }, ico("folder", 22),
        h("span", {}, h("b", { text: "Başka tarayıcı bulunamadı" }), h("small", { text: "Yine de aktarma penceresini açıp elle seçebilirsin." }))));
      return;
    }
    list.replaceChildren(...found.map((b, i) => {
      const tile = h("span", { class: "tile", text: b.tile[0] });
      tile.style.setProperty("--c", b.tile[1]);
      const c = h("button", { type: "button", class: "bcard", role: "listitem", onclick: openMigration },
        tile, h("span", { class: "txt" }, h("b", { text: b.name }), h("small", { text: b.note ?? "Bulundu" })),
        h("span", { class: "go" }, icon("arrow", 15)));
      c.style.setProperty("--i", i);
      return c;
    }));
  });
  return h("div", { class: "wrap w-mid" },
    head("Eski tarayıcından taşın", "Yer imlerin, geçmişin, parolaların ve eklentilerin. İstersen atla; Ayarlar → İçe aktar'dan sonra da yapılır."),
    h("div", { class: "content" },
      h("p", { class: "label", text: "Bu bilgisayarda bulunanlar" }),
      list,
      h("button", { type: "button", class: "btn soft", onclick: openMigration }, icon("import", 16), "Aktarma penceresini aç")),
    actions({ skip: true }));
}

// Tema önizlemesi için sabit renkler (o an seçili temadan bağımsız).
const THEMES = [
  ["dark", "Koyu", "moon"], ["light", "Açık", "sun"], ["system", "Sistem", "monitor"],
];
const themeMock = id => h("div", { class: `tp tp-${id}`, "aria-hidden": "true",
  html: id === "system"
    ? '<div class="tw dark"><i class="b"></i><i class="s"></i><i class="p"></i></div><div class="tw light half"><i class="b"></i><i class="s"></i><i class="p"></i></div>'
    : `<div class="tw ${id}"><i class="b"></i><i class="s"></i><i class="p"></i></div>` });
function appearanceScene() {
  const themes = THEMES.map(([id, name, ic]) => {
    const b = h("button", { type: "button", class: "theme", role: "radio", onclick: () => smoothly(() => setPref("rigel.theme", id)) },
      themeMock(id), h("span", { class: "tn" }, ico(ic, 15), h("b", { text: name }), h("span", { class: "tick" }, icon("check", 11))));
    b.dataset.v = id;
    return b;
  });
  const swatches = ACCENTS.map(([id, name, color]) => {
    const b = h("button", { type: "button", class: "sw", role: "radio", title: name, "aria-label": name, onclick: () => smoothly(() => setPref("rigel.accent", id)) },
      h("span", { class: "dotc" }, icon("check", 13)), h("small", { text: name }));
    b.style.setProperty("--c", color);
    b.dataset.v = id;
    return b;
  });
  const refresh = () => {
    const t = getPref("rigel.theme", "dark");
    const a = getPref("rigel.accent", "rigel");
    for (const b of themes) { b.classList.toggle("on", b.dataset.v === t); b.setAttribute("aria-checked", b.dataset.v === t); }
    for (const b of swatches) { b.classList.toggle("on", b.dataset.v === a); b.setAttribute("aria-checked", b.dataset.v === a); }
  };
  refresh();
  watch(["rigel.theme", "rigel.accent"], refresh);
  return h("div", { class: "wrap w-mid" },
    head("Görünümünü seç", "Tema ve vurgu rengi anında uygulanır."),
    h("div", { class: "content" },
      h("p", { class: "label", text: "Tema" }),
      h("div", { class: "themes", role: "radiogroup", "aria-label": "Tema" }, themes),
      h("p", { class: "label", text: "Vurgu rengi" }),
      h("div", { class: "swatches", role: "radiogroup", "aria-label": "Vurgu rengi" }, swatches)),
    actions());
}

function layoutScene() {
  const big = h("div", { class: "bigpv" });
  const caption = h("p", { class: "cap" });
  let shown = null;
  const show = id => {
    if (id === shown) return;
    shown = id;
    const m = mock(id, "big");
    big.replaceChildren(m);
    caption.textContent = LAYOUTS.find(l => l.id === id)?.note ?? "";
  };
  const cur = () => getPref("rigel.layout", "yanpanel");
  const opts = LAYOUTS.map((l, i) => {
    const b = h("button", { type: "button", class: "lopt", role: "radio", onclick: () => setPref("rigel.layout", l.id),
      onmouseenter: () => show(l.id), onfocus: () => show(l.id), onmouseleave: () => show(cur()) },
      h("span", { class: "thumb" }, mock(l.id, "mini")),
      h("b", { text: l.name }),
      h("span", { class: "tick" }, icon("check", 11)));
    b.dataset.v = l.id;
    b.style.setProperty("--i", i);
    return b;
  });
  const list = h("div", { class: "lopts", role: "radiogroup", "aria-label": "Düzen", onmouseleave: () => show(cur()) }, opts);
  const refresh = () => {
    const c = cur();
    for (const b of opts) { b.classList.toggle("on", b.dataset.v === c); b.setAttribute("aria-checked", b.dataset.v === c); }
    show(c);
  };
  refresh();
  watch("rigel.layout", refresh);
  return h("div", { class: "wrap w-wide" },
    head("Rigel nasıl görünsün?", "Seçtiğin düzen pencereye hemen uygulanır. İstediğin an <kbd>Ctrl</kbd> <kbd>⇧</kbd> <kbd>L</kbd> ile değiştir."),
    h("div", { class: "content layoutgrid" }, list, h("div", { class: "pvcol" }, big, caption)),
    actions());
}

const ENGINE_NOTES = [
  [/google/i, "Kapsamlı sonuçlar"], [/duckduckgo/i, "İz sürmeden arama"], [/bing/i, "Microsoft'un arama motoru"],
  [/wiki/i, "Özgür ansiklopedi"], [/ecosia/i, "Ağaç diken arama"], [/startpage/i, "Google sonuçları, gizli"],
  [/qwant/i, "Avrupa'dan, gizlilik odaklı"], [/yandex/i, "Yerel sonuçlar"], [/ebay|amazon|trendyol|hepsiburada/i, "Alışveriş"],
  [/brave/i, "Bağımsız dizin"], [/kagi/i, "Reklamsız, ücretli"],
];
function searchScene() {
  const box = h("div", { class: "engines", role: "radiogroup", "aria-label": "Arama motoru" }, [0, 1, 2, 3].map(() => h("div", { class: "eng skel" })));
  const paint = async () => {
    const { engines, def } = await engineList();
    const items = await Promise.all(engines.map(async (e, i) => {
      const src = await engineIcon(e);
      const on = e.name === def.name;
      const note = ENGINE_NOTES.find(([re]) => re.test(e.name))?.[1] ?? e.searchUrlDomain ?? "";
      const b = h("button", { type: "button", class: "eng" + (on ? " on" : ""), role: "radio", "aria-checked": on,
        onclick: () => searchService.setDefault(e, searchService.CHANGE_REASON?.USER) },
        h("span", { class: "ei" }, src ? h("img", { src, width: 22, height: 22, alt: "" }) : ico("search", 18)),
        h("span", { class: "txt" }, h("b", { text: e.name }), note && h("small", { text: note })),
        h("span", { class: "radio" }));
      b.style.setProperty("--i", i);
      return b;
    }));
    box.replaceChildren(...items);
  };
  paint();
  watch(["topic:browser-search-engine-default", "topic:browser-search-engine-modified"], paint);
  return h("div", { class: "wrap w-mid" },
    head("Varsayılan arama motoru", "Adres olmayan bir şey yazdığında bununla aranır. <code>!yt</code>, <code>!w</code> gibi kısayollar her motorla çalışır."),
    h("div", { class: "content" }, box),
    actions());
}

// Gizlilik: hazır seviyeler ve tek tek ayarlar (aynı tercihler; Ayarlar → Gizlilik ile ortak).
const both = (a, b) => v => { setPref(a, v); setPref(b, v); };
const PRIV = {
  strict: { get: () => getPref("browser.contentblocking.category", "standard") === "strict", set: v => setPref("browser.contentblocking.category", v ? "strict" : "standard") },
  https: { get: () => !!getPref("dom.security.https_only_mode", false), set: both("dom.security.https_only_mode", "dom.security.https_only_mode_pbm") },
  cookies: { get: () => [1, 4, 5].includes(getPref("network.cookie.cookieBehavior", 5)), set: v => setPref("network.cookie.cookieBehavior", v ? 5 : 0) },
  clean: { get: () => !!getPref("privacy.query_stripping.enabled", false), set: both("privacy.query_stripping.enabled", "privacy.query_stripping.enabled.pbmode") },
  gpc: { get: () => !!getPref("privacy.globalprivacycontrol.enabled", false), set: both("privacy.globalprivacycontrol.enabled", "privacy.globalprivacycontrol.functionality.enabled") },
};
const PRIV_PREFS = ["browser.contentblocking.category", "dom.security.https_only_mode", "network.cookie.cookieBehavior", "privacy.query_stripping.enabled", "privacy.globalprivacycontrol.enabled"];
const PRESETS = [
  { id: "basic", name: "Temel", tag: "En az kırılma", ic: "globe", vals: { strict: false, https: false, cookies: true, clean: false, gpc: false },
    pts: ["Standart izleme koruması", "Üçüncü taraf çerezleri ayrık"] },
  { id: "balanced", name: "Dengeli", tag: "Çoğu kişi için", ic: "shield", vals: { strict: false, https: true, cookies: true, clean: true, gpc: true },
    pts: ["Yalnızca HTTPS", "Temiz linkler ve GPC"] },
  { id: "strict", name: "Sıkı", tag: "En güçlü koruma", ic: "lock", vals: { strict: true, https: true, cookies: true, clean: true, gpc: true },
    pts: ["Parmak izi toplayıcılar engelli", "Bazı siteler bozulabilir"] },
];
const currentPreset = () => PRESETS.find(p => Object.entries(p.vals).every(([k, v]) => PRIV[k].get() === v));
function applyPreset(p) {
  // Kategori önce: Firefox kategoriyle birlikte bağlı tercihleri de ayarlar.
  PRIV.strict.set(p.vals.strict);
  for (const [k, v] of Object.entries(p.vals)) if (k !== "strict" && PRIV[k].get() !== v) PRIV[k].set(v);
}
function privacyScene() {
  const cards = PRESETS.map((p, i) => {
    const c = h("button", { type: "button", class: "preset", role: "radio", onclick: () => applyPreset(p) },
      h("span", { class: "pi" }, ico(p.ic, 20)),
      h("b", { text: p.name }), h("small", { class: "tag", text: p.tag }),
      h("ul", {}, p.pts.map(t => h("li", { text: t }))),
      h("span", { class: "tick" }, icon("check", 11)));
    c.dataset.v = p.id;
    c.style.setProperty("--i", i);
    return c;
  });
  const custom = h("span", { class: "custom", text: "Özel ayar" });
  const refresh = () => {
    const cur = currentPreset()?.id;
    for (const c of cards) { c.classList.toggle("on", c.dataset.v === cur); c.setAttribute("aria-checked", c.dataset.v === cur); }
    custom.hidden = !!cur;
  };
  refresh();
  watch(PRIV_PREFS, refresh);
  const prow = (ic, label, desc, key, names) => h("label", { class: "prow" }, ico(ic, 16),
    h("span", { class: "txt" }, h("b", { text: label }), h("small", { text: desc })),
    toggle(names[0], { get: PRIV[key].get, set: PRIV[key].set, names }));
  return h("div", { class: "wrap w-mid" },
    head("Gizlilik", "Bir seviye seç; aşağıdan tek tek de ayarlayabilirsin. Daha fazlası Ayarlar → Gizlilik'te."),
    h("div", { class: "content" },
      h("div", { class: "presets", role: "radiogroup", "aria-label": "Gizlilik seviyesi" }, cards),
      h("details", { class: "fine-tune" },
        h("summary", {}, h("span", { text: "Ayrıntılar" }), custom, icon("arrow", 13)),
        h("div", { class: "privacy" },
          prow("shield", "Katı izleme koruması", "İzleyicileri ve parmak izi toplayıcıları engeller.", "strict", ["browser.contentblocking.category"]),
          prow("lock", "Yalnızca HTTPS", "Şifresiz bağlantılar https'e yükseltilir.", "https", ["dom.security.https_only_mode"]),
          prow("globe", "Üçüncü taraf çerezlerini engelle", "Sitelerin seni başka sitelerde izlemesini zorlaştırır.", "cookies", ["network.cookie.cookieBehavior"]),
          prow("link", "Temiz linkler", "utm_*, fbclid, gclid gibi parametreler silinir.", "clean", ["privacy.query_stripping.enabled"]),
          prow("info", "Verilerimi satmayın (GPC)", "Sitelere Global Privacy Control sinyali gider.", "gpc", ["privacy.globalprivacycontrol.enabled"])))),
    actions());
}

// "Ctrl+K" gerçek kısayoldan gelsin (kullanıcı değiştirmiş olabilir).
function keyOf(id, fallback) {
  try {
    return chromeWin().Rigel.commands.list({ all: true }).find(c => c.id === id)?.keys?.[0] || fallback;
  } catch { return fallback; }
}
function readyScene() {
  const themeName = () => THEMES.find(t => t[0] === getPref("rigel.theme", "dark"))?.[1] ?? "Koyu";
  const accentName = () => ACCENTS.find(a => a[0] === getPref("rigel.accent", "rigel"))?.[1] ?? "";
  const chip = (ic, label, value, to) => {
    const v = h("b", { text: value });
    const c = h("button", { type: "button", class: "chip", onclick: () => go(to), title: "Değiştir" }, ico(ic, 16), h("span", { class: "txt" }, h("small", { text: label }), v));
    return [c, v];
  };
  const [cLayout] = chip("layout", "Düzen", LAYOUTS.find(l => l.id === getPref("rigel.layout", "yanpanel"))?.name ?? "", 3);
  const [cTheme] = chip("brush", "Görünüm", `${themeName()} · ${accentName()}`, 2);
  const [cSearch, vSearch] = chip("search", "Arama", "…", 4);
  const [cPriv] = chip("shield", "Gizlilik", currentPreset()?.name ?? "Özel", 5);
  engineList().then(({ def }) => (vSearch.textContent = def?.name ?? "")).catch(() => {});
  const tip = (combo, title, desc, i) => {
    const t = h("div", { class: "tip" }, keycaps(combo), h("span", { class: "txt" }, h("b", { text: title }), h("small", { html: desc })));
    t.style.setProperty("--i", i);
    return t;
  };
  return h("div", { class: "wrap w-mid" },
    h("div", { class: "done-mark" }, h("span", { class: "halo" }), animLogo(72, "outro")),
    h("header", { class: "head center" }, h("h2", { text: "Hazırsın" }), h("p", { class: "lead", text: "Seçimlerin kaydedildi. Rigel'i hızlı kullanmak için üç kısayol:" })),
    h("div", { class: "content" },
      h("div", { class: "tips" },
        tip(keyOf("palette", "Ctrl+K"), "Palet", "Adres, arama, açık sekmeler ve tüm komutlar tek kutuda.", 0),
        tip(keyOf("layout.cycle", "Ctrl+Shift+L"), "Düzen değiştir", "Beş düzen arasında gez; hangisi sana uyuyorsa.", 1),
        tip("Alt+tık", "Göz at", "Bir bağlantıya <kbd>Alt</kbd> ile tıkla, sayfadan ayrılmadan önizle.", 2)),
      h("div", { class: "summary" }, cLayout, cTheme, cSearch, cPriv)),
    h("footer", { class: "actions" },
      backBtn(),
      h("span", { class: "grow" }),
      primary("Rigel'i kullanmaya başla", finish)));
}

const SCENES = [heroScene, importScene, appearanceScene, layoutScene, searchScene, privacyScene, readyScene];

// ---- Kılavuz şeridi (sol) ----------------------------------------------------------------------
function buildRail() {
  const items = STEPS.slice(1).map((s, k) => {
    const i = k + 1;
    return h("li", {}, h("button", { type: "button", class: "rs", onclick: () => go(i) },
      h("i", { class: "num" }, h("span", { text: String(i) }), icon("check", 11)),
      h("span", { class: "txt" }, h("b", { text: s.name }), h("small", { text: s.sub }))));
  });
  rail.replaceChildren(
    h("div", { class: "brand" }, animLogo(26, "still"), h("b", { text: "Rigel" })),
    h("div", { class: "progress" }, h("span", { class: "track" }, h("i", {})), h("ol", {}, items)),
    h("div", { class: "rail-foot" },
      h("p", { class: "hint" }, h("kbd", { text: "←" }), h("kbd", { text: "→" }), " gez · ", h("kbd", { text: "Enter" }), " devam"),
      h("button", { type: "button", class: "skipall", onclick: finish, text: "Kurulumu atla" })));
}
function paintRail() {
  ob.dataset.step = step;
  rail.style.setProperty("--p", Math.max(0, (step - 1) / (LAST - 1)));
  rail.querySelectorAll(".rs").forEach((b, k) => {
    const i = k + 1;
    b.classList.toggle("on", i === step);
    b.classList.toggle("done", i < step);
    b.disabled = i > step;
    if (i === step) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  });
}

// ---- Geçişler --------------------------------------------------------------------------------
let first = true;
function render(dir = 0) {
  disposeAll();
  paintRail();
  for (const old of stage.querySelectorAll(".scene.leave")) old.remove();
  const prev = stage.querySelector(".scene");
  const scene = h("section", { class: "scene" + (step === 0 ? " is-hero" : "") + (first ? " first" : dir < 0 ? " from-prev" : " from-next") }, SCENES[step]());
  first = false;
  if (prev) {
    prev.classList.add("leave", dir < 0 ? "to-next" : "to-prev");
    prev.inert = true;
    const drop = () => prev.remove();
    if (reduced()) drop();
    else {
      prev.addEventListener("animationend", e => e.target === prev && drop());
      setTimeout(drop, 400);
    }
  }
  stage.append(scene);
  scrollTo({ top: 0 });
  scene.querySelector(".actions .primary, .cta .primary")?.focus({ preventScroll: true });
}
function go(to) {
  to = Math.max(0, Math.min(LAST, to));
  if (to === step) return;
  const dir = Math.sign(to - step);
  step = to;
  history.replaceState(null, "", "#" + step);
  render(dir);
}

addEventListener("keydown", e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || /^(input|textarea|select|summary)$/i.test(e.target.tagName)) return;
  if (e.key === "ArrowRight" && step < LAST) go(step + 1);
  else if (e.key === "ArrowLeft" && step > 0) go(step - 1);
  else if (e.key === "Enter" && !/^(button|input|label|a)$/i.test(e.target.tagName)) (step === LAST ? finish() : go(step + 1));
  else return;
  e.preventDefault();
});
addEventListener("hashchange", () => {
  const n = parseInt(location.hash.slice(1), 10);
  if (Number.isInteger(n) && n !== step && n >= 0 && n <= LAST) go(n);
});

buildRail();
render();
