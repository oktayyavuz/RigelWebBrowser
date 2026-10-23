// Kısayollar: eylemler, varsayılan tuşlar ve "Ctrl+Shift+L" ↔ (tuş kodu, değiştirici) dönüşümü.
// Kullanıcı ayarlardan tuşları değiştirebilir (`overrides`). rigel-core/src/keymap.rs'in karşılığı.

// Değiştirici bayrakları (cef_event_flags_t ile aynı değerler).
export const SHIFT = 1 << 1;
export const CTRL = 1 << 2;
export const ALT = 1 << 3;

const a = (id, label, keys = []) => Object.freeze({ id, label, keys: Object.freeze(keys) });

/** Eylemler: kimlik, Türkçe açıklama, varsayılan tuşlar. */
export const ACTIONS = Object.freeze([
  a("palette", "Komut paleti / arama", ["Ctrl+K", "Ctrl+E"]),
  a("address", "Adres çubuğu", ["Ctrl+L", "Alt+D", "F6"]),
  a("newTab", "Yeni sekme", ["Ctrl+T"]),
  a("newPrivateTab", "Yeni gizli sekme", ["Ctrl+Shift+N"]),
  a("closeTab", "Sekmeyi kapat", ["Ctrl+W", "Ctrl+F4"]),
  a("reopenTab", "Kapatılan sekmeyi geri aç", ["Ctrl+Shift+T"]),
  a("nextTab", "Sonraki sekme", ["Ctrl+Tab", "Ctrl+PageDown"]),
  a("prevTab", "Önceki sekme", ["Ctrl+Shift+Tab", "Ctrl+PageUp"]),
  a("tab1", "1. sekme", ["Ctrl+1"]),
  a("tab2", "2. sekme", ["Ctrl+2"]),
  a("tab3", "3. sekme", ["Ctrl+3"]),
  a("tab4", "4. sekme", ["Ctrl+4"]),
  a("tab5", "5. sekme", ["Ctrl+5"]),
  a("tab6", "6. sekme", ["Ctrl+6"]),
  a("tab7", "7. sekme", ["Ctrl+7"]),
  a("tab8", "8. sekme", ["Ctrl+8"]),
  a("lastTab", "Son sekme", ["Ctrl+9"]),
  a("tabsPanel", "Sekme paneli", ["Ctrl+Shift+A", "Ctrl+Space"]),
  a("split", "Bölünmüş görünüm", ["Ctrl+Shift+S"]),
  a("cycleLayout", "Sonraki düzen", ["Ctrl+Shift+L"]),
  a("find", "Sayfada bul", ["Ctrl+F", "F3"]),
  a("bookmark", "Yer imlerine ekle/çıkar", ["Ctrl+D"]),
  a("history", "Geçmiş", ["Ctrl+H"]),
  a("bookmarks", "Yer imleri", ["Ctrl+Shift+O"]),
  a("downloads", "İndirmeler", ["Ctrl+J"]),
  a("translate", "Sayfayı çevir", ["Alt+T"]),
  a("back", "Geri", ["Alt+Left"]),
  a("forward", "İleri", ["Alt+Right"]),
  a("reload", "Yenile", ["Ctrl+R", "F5"]),
  a("hardReload", "Önbelleği atlayarak yenile", ["Ctrl+Shift+R", "Shift+F5"]),
  a("home", "Ana sayfa", ["Alt+Home"]),
  a("zoomIn", "Yakınlaştır", ["Ctrl+=", "Ctrl+NumPlus", "Ctrl+Shift+="]),
  a("zoomOut", "Uzaklaştır", ["Ctrl+-", "Ctrl+NumMinus"]),
  a("zoomReset", "Yakınlaştırmayı sıfırla", ["Ctrl+0"]),
  a("fullscreen", "Tam ekran", ["F11"]),
  a("viewSource", "Sayfa kaynağı", ["Ctrl+U"]),
  a("print", "Yazdır", ["Ctrl+P"]),
  a("settings", "Ayarlar", ["Ctrl+,"]),
  a("devtools", "Geliştirici araçları", ["F12", "Ctrl+Shift+I"]),
  a("pinTab", "Sekmeyi sabitle / sabitlemeyi kaldır", ["Alt+Shift+P"]),
  a("muteTab", "Sekmenin sesini kapat / aç", ["Ctrl+M"]),
  a("duplicateTab", "Sekmeyi çoğalt", ["Alt+Shift+D"]),
  a("closeOtherTabs", "Diğer sekmeleri kapat"),
  a("closeTabsRight", "Sağdaki sekmeleri kapat"),
  a("sleepTabs", "Arka plandaki sekmeleri uyut"),
  a("copyUrl", "Adresi kopyala", ["Ctrl+Shift+C"]),
  a("capturePage", "Sayfanın ekran görüntüsünü al", ["Ctrl+Shift+Y"]),
  a("restart", "Rigel'i yeniden başlat"),
  a("quit", "Rigel'i kapat", ["Ctrl+Q"]),
]);

const NAMED = {
  Tab: 0x09, Enter: 0x0d, Escape: 0x1b, Space: 0x20, PageUp: 0x21, PageDown: 0x22, End: 0x23, Home: 0x24,
  Left: 0x25, Up: 0x26, Right: 0x27, Down: 0x28, Delete: 0x2e, NumPlus: 0x6b, NumMinus: 0x6d,
};
const PUNCT = { ",": 0xbc, "=": 0xbb, "-": 0xbd, ".": 0xbe, "/": 0xbf };
const MODS = { Ctrl: CTRL, Shift: SHIFT, Alt: ALT };

/**
 * "Ctrl+Shift+L" → { key: 0x4C, mods: CTRL|SHIFT }. Çözülemezse null.
 * Tuş kodları Windows sanal tuş kodlarıdır (DOM `keyCode` ile aynı).
 */
export function parse(combo) {
  const parts = String(combo).split("+");
  // "Ctrl++" gibi birleşimlerde son iki parça boş kalır: tuşun kendisi "+".
  const n = parts.length;
  const [rest, k] = n >= 2 && parts[n - 1] === "" && parts[n - 2] === "" ? [parts.slice(0, -2), "+"] : [parts.slice(0, -1), parts[n - 1]];
  let mods = 0;
  for (const p of rest) {
    if (!Object.hasOwn(MODS, p)) return null;
    mods |= MODS[p];
  }
  let key = null;
  const f = /^F(\d{1,2})$/.exec(k);
  if (k.length === 1) {
    if (/^[A-Za-z0-9]$/.test(k)) key = k.toUpperCase().charCodeAt(0);
    else if (Object.hasOwn(PUNCT, k)) key = PUNCT[k];
  } else if (f && +f[1] >= 1 && +f[1] <= 12) {
    key = 0x6f + +f[1];
  } else if (Object.hasOwn(NAMED, k)) {
    key = NAMED[k];
  }
  return key === null ? null : { key, mods };
}

/** (tuş kodu, değiştiriciler) için arama anahtarı. */
export const tableKey = (key, mods) => `${key}:${mods}`;

/** Ayarlarla birleştirilmiş tüm kısayollar. `overrides`: { eylemKimliği: ["Ctrl+X", …] }. */
export function bindings(overrides = {}) {
  return ACTIONS.map(({ id, label, keys: defaults }) => ({
    id, label, defaults: [...defaults], keys: [...(Object.hasOwn(overrides, id) ? overrides[id] : defaults)],
  }));
}

/** tableKey(tuş kodu, değiştiriciler) → eylem kimliği. Klavye işleyicisi bunu kullanır; ilk eşleşen kazanır. */
export function lookupTable(overrides = {}) {
  const table = new Map();
  for (const b of bindings(overrides)) {
    for (const combo of b.keys) {
      const p = parse(combo);
      if (p && !table.has(tableKey(p.key, p.mods))) table.set(tableKey(p.key, p.mods), b.id);
    }
  }
  return table;
}
