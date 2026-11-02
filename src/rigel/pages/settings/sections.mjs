// Ayar bölümleri. Her bölüm { id, title, icon, description, build() } ; build() düğüm dizisi döndürür.
// Hepsi canlı: denetimler tercihe yazar, tercih (başka yerden) değişince denetim güncellenir.
import {
  h, icon, logo, getPref, setPref, getJSON, setJSON, watch, toggle, seg, select, row, card, notify,
  layoutPicker, accentPicker, themeSeg, chromeWin, engineList, searchService,
} from "./ui.mjs";
import { BUILTIN_BANGS, normalizeTrigger, normalizeCustomBangs } from "chrome://userscripts/content/search/bangs.mjs";
import { modlar } from "./mods.mjs";
import { studio } from "./studio.mjs";
import { yeniSekme } from "./newtab.mjs";
import { ACTIONS } from "chrome://userscripts/content/search/keymap.mjs";

const P = Services.prefs;
const rigelApi = () => chromeWin()?.Rigel;
const btn = (text, onclick, cls = "soft", ic) =>
  h("button", { type: "button", class: "btn " + cls, onclick }, ic && icon(ic, 14), text);

export const fold = s => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

// ---------------------------------------------------------------- Görünüm
function gorunum() {
  return [
    card(null,
      row({ id: "layout", label: "Düzen", desc: "Seçtiğin düzen hemen uygulanır. Ctrl Shift L ile de değiştirebilirsin.", keywords: "düzen ada dock komuta yan panel klasik layout", control: layoutPicker(), stack: true })),
    card("Renkler",
      row({ id: "theme", label: "Tema", desc: "Sistem, işletim sisteminin açık/koyu ayarını izler.", keywords: "koyu açık karanlık dark light sistem tema", control: themeSeg() }),
      row({ id: "accent", label: "Vurgu rengi", keywords: "renk accent mavi mor yeşil turuncu pembe", control: accentPicker() }),
      row({ id: "appColors", label: "Uygulama renkleri", desc: "Arka plan, çubuklar, yüzeyler, yazı ve soluk yazı renklerini kendin seç; temaya göre saklanır, canlı önizlenir.", keywords: "renk özel arka plan çubuk yüzey yazı kontrast uygulama renkleri color picker",
        control: btn("Renkleri özelleştir", () => { location.hash = "studyo/renkler"; }, "soft", "brush") })),
    card("Yeni sekme",
      row({ id: "newtabLink", label: "Yeni sekme sayfası", desc: "Düzeni, parçaları, kısayolları ve arka plan fotoğrafını değiştir.", keywords: "yeni sekme ana sayfa düzenle arka plan fotoğraf kısayol",
        control: btn("Yeni sekmeyi özelleştir", () => { location.hash = "yenisekme"; }, "soft", "arrow") })),
    card("Kabuk",
      row({ id: "compact", label: "Kompakt mod", desc: "Üst şerit ve kenar çubuğu imleç kenara gelince açılır; sayfa tüm alanı kullanır.", keywords: "kompakt gizle otomatik zen compact",
        control: toggle("rigel.compact") }),
      row({ id: "glance", label: "Göz at (Glance)", desc: "Bir bağlantıyı basılı tutup açılan küçük önizleme penceresi.", keywords: "glance göz at önizleme bağlantı peek",
        control: toggle("rigel.glance.enabled") })),
    card("Araç çubukları",
      row({ id: "bookmarksBar", label: "Yer imi çubuğu", desc: "Şeridin altında ince satır; Yan Panel'de sayfanın üstünde. Ctrl Shift B ile aç/kapat.", keywords: "yer imi çubuğu bookmarks toolbar sık kullanılanlar favoriler",
        control: seg([["always", "Her zaman"], ["newtab", "Yalnız yeni sekmede"], ["never", "Hiç"]], {
          get: () => getPref("browser.toolbars.bookmarks.visibility", "newtab"),
          set: v => setPref("browser.toolbars.bookmarks.visibility", v),
          names: ["browser.toolbars.bookmarks.visibility"],
        }), stack: true }),
      row({ id: "urlSimple", label: "Sade adres", desc: "Adres çubuğunda yalnız sitenin adı ortada görünür; tıklayınca tam adres açılır.", keywords: "adres çubuğu sade alan adı host url basit ortala urlbar",
        control: toggle("rigel.urlbar.simple", { get: () => getPref("rigel.urlbar.simple", true) }) }),
      row({ id: "spaceSwitcher", label: "Alan seçici", desc: "Otomatik: tek alan varken gizli, birden çoksa yalnız simge. Gizliyken de Ctrl Alt 1…9 ve palet çalışır.", keywords: "alan workspace seçici space kişisel simge zen",
        control: seg([["auto", "Otomatik"], ["icon", "Simge"], ["full", "Simge ve ad"], ["hidden", "Gizli"]], {
          get: () => getPref("rigel.spaces.switcher", "auto"),
          set: v => setPref("rigel.spaces.switcher", v),
          names: ["rigel.spaces.switcher"],
        }), stack: true })),
  ];
}

// ---------------------------------------------------------------- Arama
function arama() {
  const sel = h("select", { "aria-label": "Varsayılan arama motoru" });
  const fill = async () => {
    const { engines, def } = await engineList();
    sel.replaceChildren(...engines.map(e => h("option", { value: e.name, text: e.name })));
    sel.value = def.name;
  };
  fill();
  watch("topic:browser-search-engine-modified", fill);
  sel.addEventListener("change", async () => {
    const { engines } = await engineList();
    const e = engines.find(x => x.name === sel.value);
    if (e) await searchService.setDefault(e, searchService.CHANGE_REASON?.USER);
  });

  const bangs = toggle("rigel.bangs.enabled", { get: () => getPref("rigel.bangs.enabled", true) });

  const filter = h("input", { type: "search", placeholder: "Kısayol ara (ör. yt, github)", "aria-label": "Kısayol ara" });
  const list = h("div", { class: "bangs" });
  const paint = () => {
    const q = fold(filter.value.replace(/^!/, ""));
    list.replaceChildren(...BUILTIN_BANGS
      .filter(b => !q || fold(b.name).includes(q) || b.triggers.some(t => t.includes(q)))
      .map(b => {
        const more = b.triggers.slice(1).map(t => "!" + t);
        // En çok bir takma ad görünür, kalanı "+N"; hepsi ipucunda.
        const shown = more.slice(0, 1);
        return h("div", { class: "bang", title: `${b.name}: ${b.triggers.map(t => "!" + t).join("  ")}` },
          h("code", { text: "!" + b.triggers[0] }),
          h("span", { class: "bname", text: b.name }),
          more.length > 0 && h("span", { class: "aliases" },
            shown.map(t => h("i", { text: t })),
            more.length > shown.length && h("i", { class: "more", text: "+" + (more.length - shown.length) })));
      }));
  };
  filter.addEventListener("input", paint);
  paint();
  const builtin = h("details", { class: "fold" }, h("summary", { text: `Yerleşik kısayollar (${BUILTIN_BANGS.length})` }), filter, list);

  const customBox = h("div", { class: "custom" });
  const paintCustom = () => {
    const items = Object.entries(getJSON("rigel.bangs.custom", {}));
    customBox.replaceChildren(...(items.length
      ? items.map(([t, url]) => h("div", { class: "bang" }, h("code", { text: "!" + t }), h("span", { class: "url", text: url }),
        h("button", { type: "button", class: "iconbtn", title: "Kaldır", "aria-label": `!${t} kısayolunu kaldır`,
          onclick: () => { const n = { ...getJSON("rigel.bangs.custom", {}) }; delete n[t]; setJSON("rigel.bangs.custom", n); } }, icon("trash", 15))))
      : [h("p", { class: "hint", text: "Henüz kendi kısayolun yok." })]));
  };
  paintCustom();
  watch("rigel.bangs.custom", paintCustom);
  const tIn = h("input", { placeholder: "tetikleyici (ör. kb)", "aria-label": "Tetikleyici", size: 14 });
  const uIn = h("input", { placeholder: "https://site.com/ara?q=%s", "aria-label": "Adres", class: "grow" });
  const msg = h("small", { class: "err" });
  const add = () => {
    const t = normalizeTrigger(tIn.value);
    const u = uIn.value.trim();
    msg.textContent = "";
    if (!t || /\s/.test(t)) return (msg.textContent = "Tetikleyici boşluk içermeyen bir sözcük olmalı.");
    if (!/^https?:\/\/.+/i.test(u)) return (msg.textContent = "Adres http:// ya da https:// ile başlamalı.");
    if (!u.includes("%s")) return (msg.textContent = "Adres, sorgunun yerini tutan %s içermeli.");
    setJSON("rigel.bangs.custom", normalizeCustomBangs({ ...getJSON("rigel.bangs.custom", {}), [t]: u }));
    tIn.value = uIn.value = "";
  };
  uIn.addEventListener("keydown", e => e.key === "Enter" && add());

  return [
    card(null,
      row({ id: "engine", label: "Varsayılan arama motoru", desc: "Adres çubuğuna ve palete adres olmayan bir şey yazınca bununla aranır.", keywords: "arama motoru google duckduckgo bing varsayılan engine", control: sel }),
      row({ id: "bangs", label: "!kısayollar (bang)", desc: "Başa ya da sona !yt, !gh gibi bir kısayol yazarak doğrudan o sitede ara.", keywords: "bang kısayol ünlem duckduckgo", control: bangs })),
    card(null, row({ id: "bang-list", label: "Yerleşik kısayollar", desc: "Bu kısayollar her zaman hazır; kendi kısayolların bunların önüne geçer.", keywords: "bang liste yt gh w wiki", control: builtin, stack: true })),
    card("Kendi kısayolların",
      row({ id: "bang-custom", label: "Özel kısayollar", desc: "Yerleşiklerin önüne geçer. Adreste sorgunun yerine %s yaz.", keywords: "özel bang ekle sil kendi",
        control: h("div", { class: "stackbox" }, customBox, h("div", { class: "addrow" }, tIn, uIn, btn("Ekle", add, "", "plus")), msg), stack: true })),
  ];
}

// ---------------------------------------------------------------- Başlangıç
function baslangic() {
  return [
    card(null,
      row({ id: "startup", label: "Rigel açılınca", desc: "Önceki oturumun sekmelerini geri yükle ya da yeni sekmeyle temiz başla.", keywords: "açılış oturum geri yükle kaldığım yerden başlangıç session restore",
        control: seg([[3, "Kaldığım yerden devam et"], [1, "Yeni sekme aç"]], {
          get: () => (getPref("browser.startup.page", 1) === 3 ? 3 : 1), set: v => setPref("browser.startup.page", v), names: ["browser.startup.page"],
        }), stack: true }),
      row({ id: "topsites", label: "Yeni sekmede sık ziyaret edilen siteler", desc: "Rigel yeni sekme sayfasında en çok girdiğin sitelerin kutucukları. Gizli pencerelerde gösterilmez.", keywords: "yeni sekme sık ziyaret kısayol kutucuk top sites",
        control: toggle("rigel.newtab.topsites", { get: () => getPref("rigel.newtab.topsites", true) }) })),
    card("Kurulum",
      row({ id: "wizard", label: "Kurulum sihirbazı", desc: "Hoş geldin adımlarını yeniden gör: aktarma, düzen, arama, gizlilik.", keywords: "sihirbaz kurulum hoş geldin welcome ilk açılış",
        control: btn("Sihirbazı aç", () => rigelApi()?.settings?.openWelcome?.(), "soft", "arrow") })),
  ];
}

// ---------------------------------------------------------------- Sekmeler
function sekmeler() {
  return [
    card(null,
      row({ id: "insertAfter", label: "Yeni sekmeleri aktif sekmenin yanına aç", desc: "Kapalıysa yeni sekmeler en sona eklenir.", keywords: "yeni sekme konum yan yana sona insert after current",
        control: toggle("browser.tabs.insertAfterCurrent") }),
      row({ id: "closeWindow", label: "Son sekme kapanınca pencereyi kapat", desc: "Kapalıysa son sekme yeni sekmeye döner ve pencere açık kalır.", keywords: "pencere kapat son sekme closeWindowWithLastTab",
        control: toggle("browser.tabs.closeWindowWithLastTab") }),
      row({ id: "warnClose", label: "Birden çok sekmeyi kapatırken sor", keywords: "uyarı onay kapat sekme warn",
        control: toggle("browser.tabs.warnOnClose") }),
      row({ id: "mru", label: "Ctrl+Tab en son kullanılan sekmeye geçsin", desc: "Kapalıysa sekmeler sırayla gezilir.", keywords: "ctrl tab son kullanılan sıra recently used",
        control: toggle("browser.ctrlTab.sortByRecentlyUsed") })),
    card("Gruplar",
      row({ id: "groupLabels", label: "Grup adlarını göster", desc: "Ada, Dock ve Komuta'da grupların yanında adları görünür; kapalıysa yalnız renk.", keywords: "grup klasör etiket ad renk group label",
        control: toggle("rigel.groups.showLabels", { get: () => getPref("rigel.groups.showLabels", true) }) }),
      row({ id: "groupCollapse", label: "Bir gruba geçince diğerlerini daralt", desc: "Seçili sekmenin grubu açık kalır, diğer gruplar tek bir çipe iner.", keywords: "grup daralt katla collapse switch",
        control: toggle("rigel.groups.collapseOnSwitch", { get: () => getPref("rigel.groups.collapseOnSwitch", false) }) }),
      row({ id: "groupNew", label: "Yeni grup", desc: "Seçili sekmelerden grup oluştur; ad, renk ve alan seçilir.", keywords: "grup oluştur yeni klasör new group",
        control: btn("Grup oluştur", () => rigelApi()?.groups?.create?.(), "soft", "plus") })),
    card("Bellek",
      row({ id: "unload", label: "Bellek azalınca kullanılmayan sekmeleri uyut", desc: "Uyuyan sekme belleği boşaltır; başlığı kalır, tıklayınca yeniden yüklenir. Ses çalan sekmeler uyutulmaz.", keywords: "bellek ram uyut tasarruf memory unload performans",
        control: toggle("browser.tabs.unloadOnLowMemory") }),
      row({ id: "sleepNow", label: "Arka plandaki sekmeleri şimdi uyut", desc: "Görünen ve ses çalan sekmeler dışındakiler hemen uyutulur.", keywords: "uyut şimdi bellek boşalt sekme",
        control: btn("Şimdi uyut", () => rigelApi()?.commands?.run("sleepTabs"), "soft", "moon") })),
  ];
}

// ---------------------------------------------------------------- Gizlilik
const CLEAR = [
  ["privacy.clearOnShutdown_v2.cookiesAndStorage", "Çerezler ve site verileri"],
  ["privacy.clearOnShutdown_v2.historyFormDataAndDownloads", "Geçmiş, form verileri ve indirme listesi"],
  ["privacy.clearOnShutdown_v2.cache", "Önbellek"],
];
export function gizlilik() {
  const cookies = select([[4, "Çapraz site izleyicileri engelle"], [5, "Siteleri birbirinden yalıt (Toplam Çerez Koruması)"], [1, "Tüm üçüncü taraf çerezleri engelle"], [0, "Hepsine izin ver"]], {
    get: () => getPref("network.cookie.cookieBehavior", 5), set: v => setPref("network.cookie.cookieBehavior", +v), names: ["network.cookie.cookieBehavior"],
  });
  const clearOn = toggle("privacy.sanitize.sanitizeOnShutdown");
  const clearBox = h("div", { class: "subchecks" }, CLEAR.map(([name, label]) =>
    h("label", {}, toggle(name), h("span", { text: label }))));
  const syncClear = () => clearBox.classList.toggle("off", !getPref("privacy.sanitize.sanitizeOnShutdown", false));
  syncClear();
  watch("privacy.sanitize.sanitizeOnShutdown", syncClear);

  const category = seg([["standard", "Standart"], ["strict", "Katı"]], {
    get: () => getPref("browser.contentblocking.category", "standard"), set: v => setPref("browser.contentblocking.category", v), names: ["browser.contentblocking.category"],
  });
  const both = (a, b) => v => { setPref(a, v); setPref(b, v); };
  return [
    card("Koruma",
      row({ id: "tp", label: "İzleme koruması", desc: "Katı mod izleyicileri, parmak izi toplayıcıları ve izleyen içeriği daha sert engeller; bazı siteler bozulabilir.", keywords: "izleme koruması tracking protection katı standart strict içerik engelleme",
        control: category }),
      row({ id: "https", label: "Yalnızca HTTPS", desc: "Şifresiz (http) bağlantılar otomatik https'e yükseltilir; olmazsa uyarı çıkar.", keywords: "https güvenli bağlantı yalnızca https-only",
        control: toggle("dom.security.https_only_mode", { set: both("dom.security.https_only_mode", "dom.security.https_only_mode_pbm") }) }),
      row({ id: "gpc", label: "Verilerimi satmayın (GPC)", desc: "Sitelere Global Privacy Control sinyali gönderilir.", keywords: "gpc global privacy control satmayın dnt takip etme",
        control: toggle("privacy.globalprivacycontrol.enabled", { set: both("privacy.globalprivacycontrol.enabled", "privacy.globalprivacycontrol.functionality.enabled") }) }),
      row({ id: "cleanlinks", label: "Temiz linkler", desc: "utm_*, fbclid, gclid gibi izleme parametreleri adresten silinir.", keywords: "temiz link utm fbclid gclid sorgu query stripping",
        control: toggle("privacy.query_stripping.enabled", { set: both("privacy.query_stripping.enabled", "privacy.query_stripping.enabled.pbmode") }) }),
      row({ id: "webrtc", label: "WebRTC ile IP sızıntısını önle", desc: "Görüntülü görüşme siteleri yerel ağ adreslerini göremez. Bazı çağrılarda bağlantı kurmak zorlaşabilir.", keywords: "webrtc ip sızıntı yerel adres peerconnection",
        control: toggle("media.peerconnection.ice.default_address_only") })),
    card("Çerezler",
      row({ id: "cookies", label: "Üçüncü taraf çerezleri", desc: "Başka sitelerin yerleştirdiği çerezler.", keywords: "çerez cerez üçüncü taraf cookie izleyici", control: cookies })),
    card("Kapanışta temizle",
      row({ id: "clearOnShutdown", label: "Rigel kapanınca verileri sil", desc: "Seçilen veriler her kapanışta silinir.", keywords: "kapanışta temizle sil geçmiş çerez önbellek sanitize shutdown", control: clearOn }),
      row({ id: "clearWhat", label: "Neler silinsin", sub: true, keywords: "çerez geçmiş önbellek form", control: clearBox, stack: true })),
  ];
}

// ---------------------------------------------------------------- Site izinleri
const PERM_LABELS = {
  geo: "Konum", camera: "Kamera", microphone: "Mikrofon", "desktop-notification": "Bildirimler", popup: "Açılır pencereler",
  "autoplay-media": "Otomatik oynatma", screen: "Ekran paylaşımı", "persistent-storage": "Kalıcı depolama", midi: "MIDI",
  "storage-access": "Depolama erişimi", xr: "Sanal gerçeklik", "open-protocol-handler": "Protokol açma", install: "Eklenti kurulumu",
};
const CAP = { 1: "İzin verildi", 2: "Engellendi", 3: "Sor" };
function izinler() {
  const filter = h("input", { type: "search", placeholder: "Site ara", "aria-label": "Site ara" });
  const box = h("div", { class: "perms" });
  const paint = () => {
    const q = fold(filter.value);
    let all = [];
    try { all = Services.perms.all; } catch {}
    const hostOf = p => { try { return /^https?$/.test(p.principal.scheme) ? p.principal.host : ""; } catch { return ""; } };
    const items = all.filter(p => PERM_LABELS[p.type] && hostOf(p) && (!q || fold(hostOf(p)).includes(q)));
    const seen = new Set();
    for (let i = items.length - 1; i >= 0; i--) {
      const k = `${hostOf(items[i])}|${items[i].type}|${items[i].capability}`;
      if (seen.has(k)) items.splice(i, 1);
      else seen.add(k);
    }
    items.sort((a, b) => hostOf(a).localeCompare(hostOf(b)) || a.type.localeCompare(b.type));
    box.replaceChildren(...(items.length ? items.slice(0, 300).map(p =>
      h("div", { class: "perm" },
        h("span", { class: "host", text: hostOf(p) }),
        h("span", { class: "ptype", text: PERM_LABELS[p.type] }),
        h("span", { class: "pcap c" + p.capability, text: CAP[p.capability] ?? "Özel" }),
        h("button", { type: "button", class: "iconbtn", title: "İzni kaldır", "aria-label": `${hostOf(p)} ${PERM_LABELS[p.type]} iznini kaldır`,
          onclick: () => Services.perms.removePermission(p) }, icon("close", 14))))
      : [h("p", { class: "hint", text: q ? "Eşleşen site yok." : "Henüz bir siteye özel izin verilmedi ya da engellenmedi." })]));
  };
  filter.addEventListener("input", paint);
  paint();
  watch("topic:perm-changed", paint);
  return [
    card(null,
      row({ id: "perms", label: "Sitelere verilen izinler", desc: "Konum, kamera, mikrofon, bildirim, açılır pencere ve otomatik oynatma. Kaldırılan izin, site yeniden isteyince sorulur.", keywords: "site izinleri kamera mikrofon konum bildirim açılır pencere popup izin kaldır",
        control: h("div", { class: "stackbox" }, filter, box), stack: true })),
    card("Genel",
      row({ id: "popups", label: "Açılır pencereleri engelle", keywords: "popup açılır pencere engelle", control: toggle("dom.disable_open_during_load") }),
      row({ id: "notifs", label: "Sitelerin bildirim istemesini engelle", keywords: "bildirim notification iste sor",
        control: toggle("permissions.default.desktop-notification", { get: () => getPref("permissions.default.desktop-notification", 0) === 2, set: v => setPref("permissions.default.desktop-notification", v ? 2 : 0) }) })),
  ];
}

// ---------------------------------------------------------------- İndirmeler
async function downloadDir() {
  try {
    const list = getPref("browser.download.folderList", 1);
    if (list === 2) return P.getComplexValue("browser.download.dir", Ci.nsIFile).path;
    if (list === 0) return Services.dirsvc.get("Desk", Ci.nsIFile).path;
    const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
    return await Downloads.getPreferredDownloadsDirectory();
  } catch {
    return "";
  }
}
function indirmeler() {
  const path = h("code", { class: "path", text: "…" });
  const paint = async () => (path.textContent = (await downloadDir()) || "bilinmiyor");
  paint();
  watch(["browser.download.dir", "browser.download.folderList"], paint);
  const pick = () => {
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window.browsingContext, "İndirme klasörünü seç", Ci.nsIFilePicker.modeGetFolder);
    fp.open(rv => {
      if (rv === Ci.nsIFilePicker.returnOK && fp.file) {
        P.setComplexValue("browser.download.dir", Ci.nsIFile, fp.file);
        setPref("browser.download.folderList", 2);
      }
    });
  };
  return [
    card(null,
      row({ id: "dlDir", label: "İndirme klasörü", desc: "Dosyalar buraya kaydedilir.", keywords: "indirme klasör dizin konum download folder", control: h("div", { class: "pathbox" }, path, btn("Değiştir…", pick, "soft", "folder")) }),
      row({ id: "dlAsk", label: "Her dosyada nereye kaydedileceğini sor", desc: "Kapalıysa dosyalar doğrudan yukarıdaki klasöre iner.", keywords: "sor her seferinde kaydet indirme ask",
        control: toggle("browser.download.useDownloadDir", { invert: true }) })),
  ];
}

// ---------------------------------------------------------------- Çeviri
const LANGS = ["tr", "en", "de", "fr", "es", "it", "pt", "ru", "nl", "pl", "uk", "ar", "fa", "ja", "ko", "zh", "hi", "sv", "cs", "el", "ro", "bg"];
function ceviri() {
  const name = t => { try { return new Intl.DisplayNames(["tr"], { type: "language" }).of(t) ?? t; } catch { return t; } };
  return [
    card(null,
      row({ id: "trTo", label: "Hedef dil", desc: "\"Sayfayı çevir\" komutu (Alt T) sayfayı bu dile çevirir.", keywords: "çeviri dil hedef translate türkçe ingilizce",
        control: select(LANGS.map(t => [t, name(t)]), { get: () => getPref("rigel.translate.to", "tr"), set: v => setPref("rigel.translate.to", v), names: ["rigel.translate.to"] }) }),
      row({ id: "trOn", label: "Sayfa çevirisi", desc: "Firefox'un cihazda çalışan çevirisi. Metin hiçbir sunucuya gönderilmez; dil paketleri ilk kullanımda indirilir.", keywords: "çeviri aç kapa translations cihaz",
        control: toggle("browser.translations.enable") }),
      row({ id: "trPopup", label: "Yabancı dilli sayfada çeviri öner", keywords: "çeviri öneri otomatik popup",
        control: toggle("browser.translations.automaticallyPopup") })),
  ];
}

// ---------------------------------------------------------------- Sistem
function sistem() {
  return [
    card(null,
      row({ id: "vaapi", label: "Donanımla video çözme (VA-API)", desc: "Ekran kartı videoyu çözer; pil ve işlemci kullanımı düşer. Sürücü sorunlarında kapat.", keywords: "donanım video vaapi gpu hızlandırma ffmpeg codec", restart: true,
        control: toggle("media.ffmpeg.vaapi.enabled") }),
      row({ id: "pipAuto", label: "Sekme değişince videoyu otomatik ayır", desc: "Oynayan video varken başka sekmeye geçince resim içinde resim açılır.", keywords: "pip resim içinde resim otomatik sekme değiştir picture in picture",
        control: toggle("media.videocontrols.picture-in-picture.enable-when-switching-tabs.enabled") }),
      row({ id: "pipBtn", label: "Videoların üstünde resim içinde resim düğmesi", keywords: "pip düğme buton video toggle",
        control: toggle("media.videocontrols.picture-in-picture.video-toggle.enabled") })),
    card("Rigel",
      row({ id: "restart", label: "Rigel'i yeniden başlat", desc: "Sekmelerin korunur.", keywords: "yeniden başlat restart",
        control: btn("Yeniden başlat", () => rigelApi()?.commands?.run("restart"), "soft", "undo") })),
  ];
}

// ---------------------------------------------------------------- Kısayollar
const CODE_NAMES = {
  Tab: "Tab", Space: "Space", PageUp: "PageUp", PageDown: "PageDown", Home: "Home", End: "End", Delete: "Delete", Enter: "Enter",
  ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down", Comma: ",", Equal: "=", Minus: "-", Period: ".", Slash: "/",
  NumpadAdd: "NumPlus", NumpadSubtract: "NumMinus",
};
function keyName(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  return CODE_NAMES[code] ?? null;
}
const normCombo = c => String(c).toLowerCase();

/** Firefox'un kendi <key> öğelerinde aynı birleşim var mı? Kimliğini döndürür. */
function firefoxKeyFor(combo) {
  const w = chromeWin();
  if (!w) return null;
  const parts = combo.split("+");
  const k = parts.pop().toLowerCase();
  const want = new Set(parts.map(p => (p === "Ctrl" ? "accel" : p.toLowerCase())));
  const fkey = /^f\d+$/.test(k) ? "VK_" + k.toUpperCase() : { tab: "VK_TAB", pageup: "VK_PAGE_UP", pagedown: "VK_PAGE_DOWN", left: "VK_LEFT", right: "VK_RIGHT", home: "VK_HOME", delete: "VK_DELETE", enter: "VK_RETURN" }[k];
  for (const el of w.document.querySelectorAll("key")) {
    if (el.closest("#rigel-keyset") || el.getAttribute("disabled") === "true") continue;
    const mods = new Set((el.getAttribute("modifiers") || "").toLowerCase().split(/[\s,]+/).filter(Boolean).map(m => (m === "control" ? "accel" : m)));
    if (mods.size !== want.size || [...want].some(m => !mods.has(m))) continue;
    const ek = (el.getAttribute("key") || "").toLowerCase();
    const kc = (el.getAttribute("keycode") || "").toUpperCase();
    if ((fkey && kc === fkey) || (!fkey && ek === (k === "space" ? " " : k))) return el.id || el.getAttribute("command") || "?";
  }
  return null;
}

function kisayollar() {
  let cmds = [];
  try { cmds = rigelApi()?.commands?.list({ all: true }) ?? []; } catch {}
  if (!cmds.length) cmds = ACTIONS.map(a => ({ id: a.id, label: a.label, keys: [...a.keys], defaultKeys: [...a.keys] }));
  cmds = [...cmds].sort((a, b) => a.label.localeCompare(b.label, "tr"));
  const defaultsOf = c => c.defaultKeys ?? ACTIONS.find(a => a.id === c.id)?.keys ?? c.keys;
  const overrides = () => getJSON("rigel.keymap.custom", {});
  const effective = c => { const o = overrides(); return Object.hasOwn(o, c.id) ? (o[c.id] ? [o[c.id]] : []) : [...defaultsOf(c)]; };

  const list = h("div", { class: "keys" });
  const notice = h("div", { class: "notice", hidden: true });
  let recording = null;

  const save = (id, value) => {
    const o = { ...overrides() };
    const d = defaultsOf(cmds.find(x => x.id === id));
    if (value === null || (value !== "" && d.length === 1 && normCombo(d[0]) === normCombo(value))) delete o[id];
    else o[id] = value;
    setJSON("rigel.keymap.custom", o);
  };
  const owners = combo => cmds.filter(c => effective(c).some(k => normCombo(k) === normCombo(combo)));
  const say = (text, actions = []) => {
    notice.hidden = !text;
    notice.replaceChildren(...(text ? [text, ...actions] : []));
  };
  function stop() { recording = null; removeEventListener("keydown", onKey, true); paint(); }
  const assign = (id, combo) => { save(id, combo); stop(); };

  function onKey(e) {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(e.key)) return;
    if (e.key === "Escape") { say(null); return stop(); }
    const name = keyName(e.code);
    const mods = [e.ctrlKey && "Ctrl", e.shiftKey && "Shift", e.altKey && "Alt"].filter(Boolean);
    if (!name || (!mods.length && !/^F\d+$/.test(name))) return say("Bu tuş tek başına kullanılamaz; Ctrl, Alt ya da Shift ile birlikte bas.");
    const combo = [...mods, name].join("+");
    const id = recording;
    const clash = owners(combo).filter(c => c.id !== id);
    if (clash.length) {
      say(`${combo} zaten "${clash.map(c => c.label).join('", "')}" eyleminde. `, [
        btn("Yine de ata", () => { say(null); assign(id, combo); }, "", "check"), btn("İptal", () => { say(null); stop(); }, "ghost")]);
      return;
    }
    const ff = firefoxKeyFor(combo);
    assign(id, combo);
    say(ff ? `${combo} Firefox'un kendi kısayoluyla (${ff}) çakışıyordu; Rigel'inki öncelik alır.` : null);
  }

  function paint() {
    const o = overrides();
    list.replaceChildren(...cmds.map(c => {
      const keys = effective(c);
      const rec = recording === c.id;
      return h("div", { class: "krow" + (rec ? " rec" : ""), "data-keywords": `${c.label} ${keys.join(" ")} kısayol tuş klavye` },
        h("span", { class: "kl", text: c.label }),
        h("span", { class: "kk" },
          ...keys.map(k => h("kbd", { text: k.replaceAll("+", " ") })),
          !keys.length && !rec && h("small", { text: "kapalı" }),
          rec && h("span", { class: "listening", text: "Tuşlara bas… (Esc iptal)" })),
        h("span", { class: "kacts" },
          h("button", { type: "button", class: "iconbtn", title: "Kısayolu değiştir", "aria-label": `${c.label} kısayolunu değiştir`,
            onclick: () => { if (!recording) addEventListener("keydown", onKey, true); recording = c.id; say(null); paint(); } }, icon("keyboard", 15)),
          keys.length > 0 && h("button", { type: "button", class: "iconbtn", title: "Kısayolu kapat", "aria-label": `${c.label} kısayolunu kapat`, onclick: () => save(c.id, "") }, icon("close", 14)),
          Object.hasOwn(o, c.id) && h("button", { type: "button", class: "iconbtn", title: `Varsayılana dön (${defaultsOf(c).join(", ") || "yok"})`, "aria-label": `${c.label} kısayolunu sıfırla`, onclick: () => save(c.id, null) }, icon("undo", 14))));
    }));
  }
  paint();
  watch("rigel.keymap.custom", () => !recording && paint());

  return [
    card(null,
      row({ id: "resetAll", label: "Tüm kısayolları sıfırla", desc: "Bütün eylemler varsayılan tuşlarına döner.", keywords: "kısayol tuş varsayılan sıfırla klavye",
        control: btn("Sıfırla", () => { setPref("rigel.keymap.custom", "{}"); say(null); }, "soft", "undo") }),
      h("p", { class: "hint", text: "Eylemin yanındaki klavye düğmesine bas, sonra yeni tuşlara bas. Değişiklik hemen geçerli olur. Bir eyleme tek kısayol atanır; Firefox'un doğrudan işlediği bazı tuşlar eskisi gibi de çalışabilir." }),
      notice, list),
  ];
}

// ---------------------------------------------------------------- İçe aktar
function iceAktar() {
  const open = () => {
    try {
      const { MigrationUtils } = ChromeUtils.importESModule("resource:///modules/MigrationUtils.sys.mjs");
      MigrationUtils.showMigrationWizard(chromeWin(), { entrypoint: MigrationUtils.MIGRATION_ENTRYPOINTS.PREFERENCES });
    } catch (e) {
      notify("İçe aktarma sihirbazı açılamadı: " + e.message, false);
    }
  };
  return [
    card(null,
      row({ id: "import", label: "Başka tarayıcıdan aktar", desc: "Yer imleri, geçmiş, parolalar ve eklentiler. Chrome, Chromium, Brave, Edge, Vivaldi, Opera ve Firefox desteklenir.", keywords: "içe aktar import chrome brave helium edge yer imi geçmiş parola göç migration",
        control: btn("İçe aktarma sihirbazını aç", open, "", "import") }),
      row({ id: "helium", label: "Helium kullanıyorsan", desc: "Helium Chromium tabanlıdır. Sihirbazda \"Chromium\" seçeneğini seç; Chromium kurulu değilse Rigel bu seçeneği ~/.config/net.imput.helium klasörüne bağlar.", keywords: "helium chromium net.imput.helium" })),
  ];
}

// ---------------------------------------------------------------- Hakkında
export function openAdvanced() {
  chromeWin()?.switchToTabHavingURI?.("about:preferences", true);
}
function hakkinda() {
  const ver = Services.appinfo.version;
  let profile = "";
  try { profile = Services.dirsvc.get("ProfD", Ci.nsIFile).path; } catch {}
  const lic = h("a", { href: "https://www.mozilla.org/MPL/2.0/", text: "MPL 2.0" });
  lic.addEventListener("click", e => { e.preventDefault(); chromeWin()?.openTrustedLinkIn("https://www.mozilla.org/MPL/2.0/", "tab"); });
  return [
    h("section", { class: "card hero" }, logo(56),
      h("div", {}, h("h2", { text: "Rigel" }), h("p", { text: `Rigel 0.1 (Firefox ${ver.split(".")[0]} tabanlı)` }),
        h("small", { text: "Sade, hızlı ve gizlilik odaklı kişisel tarayıcı. Gecko motoru üzerinde çalışan bir prototip." }))),
    card("Ayrıntılar",
      row({ id: "version", label: "Sürüm", keywords: "sürüm versiyon version firefox gecko", control: h("span", { class: "val", text: `Rigel 0.1 · Firefox ${ver} · Gecko ${Services.appinfo.platformVersion}` }) }),
      row({ id: "profile", label: "Profil klasörü", desc: "Ayarlar, geçmiş ve yer imleri burada durur.", keywords: "profil klasör dizin veri", control: h("code", { class: "path", text: profile }) }),
      row({ id: "license", label: "Lisans", desc: "Rigel, Mozilla Public License 2.0 ile dağıtılır. Firefox adı ve logoları Mozilla Vakfının markalarıdır.", keywords: "lisans license mpl mozilla açık kaynak", control: lic }),
      row({ id: "adv", label: "Gelişmiş (Firefox ayarları)", desc: "Burada olmayan ayarlar için Firefox'un kendi ayar sayfası.", keywords: "gelişmiş firefox ayarları about:preferences about:config",
        control: btn("about:preferences", openAdvanced, "soft", "external") })),
  ];
}

// Sol gezinme gruplara ayrılır (settings.mjs). "Kişiselleştir" başta: görünüm, modlar, kısayollar.
export const GROUPS = {
  kisisel: "Kişiselleştir",
  genel: "Tarayıcı",
  guvenlik: "Gizlilik ve güvenlik",
  diger: "Diğer",
};
export const SECTIONS = [
  { id: "gorunum", group: "kisisel", title: "Görünüm", icon: "layout", description: "Düzen, tema ve vurgu rengiyle Rigel'i kendine göre ayarla.", build: gorunum },
  { id: "studyo", group: "kisisel", title: "Görünüm stüdyosu", icon: "edit", description: "Köşeler, yoğunluk, yazı, sekme biçimi, arka plan ve hazır tema paketleri. Her değişiklik anında uygulanır.", build: studio },
  { id: "yenisekme", group: "kisisel", title: "Yeni sekme", icon: "home", description: "Yeni sekme sayfasının düzeni, parçaları, kısayolları ve arka planı. Sayfadaki Düzenle düğmesiyle de değişir.", build: yeniSekme },
  { id: "modlar", group: "kisisel", title: "Modlar", icon: "brush", description: "CSS modlarıyla arayüzü ve web sayfalarını kendine göre biçimlendir.", build: modlar },
  { id: "kisayollar", group: "kisisel", title: "Kısayollar", icon: "keyboard", description: "Klavye kısayollarını değiştir, kapat ya da sıfırla.", build: kisayollar },
  { id: "arama", group: "genel", title: "Arama", icon: "search", description: "Adres çubuğundan yapılan aramaların gideceği motor ve !kısayollar.", build: arama },
  { id: "baslangic", group: "genel", title: "Başlangıç", icon: "home", description: "Rigel açılınca ve yeni sekmede ne göreceğin.", build: baslangic },
  { id: "sekmeler", group: "genel", title: "Sekmeler", icon: "tab", description: "Sekmelerin davranışı ve kullanılmayan sekmelerin uyutulması.", build: sekmeler },
  { id: "ceviri", group: "genel", title: "Çeviri", icon: "translate", description: "Sayfa çevirisi ve hedef dil.", build: ceviri },
  { id: "gizlilik", group: "guvenlik", title: "Gizlilik", icon: "shield", description: "İzleme koruması, güvenli bağlantı, çerezler ve kapanışta temizlik.", build: gizlilik },
  { id: "izinler", group: "guvenlik", title: "Site izinleri", icon: "globe", description: "Sitelere verdiğin ya da engellediğin izinler.", build: izinler },
  { id: "indirmeler", group: "diger", title: "İndirmeler", icon: "download", description: "Dosyaların nereye ineceği.", build: indirmeler },
  { id: "sistem", group: "diger", title: "Sistem", icon: "cpu", description: "Donanım hızlandırma ve resim içinde resim.", build: sistem },
  { id: "aktar", group: "diger", title: "İçe aktar", icon: "import", description: "Yer imlerini, geçmişi ve parolaları başka tarayıcıdan getir.", build: iceAktar },
  { id: "hakkinda", group: "diger", title: "Hakkında", icon: "info", description: "Sürüm, lisans ve profil bilgisi.", build: hakkinda },
];
