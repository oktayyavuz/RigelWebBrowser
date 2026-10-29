// Hazır tema paketleri (modlar ve otomatik gece/gündüz dahil).
// Paket: { id, name, desc?, look, accent?, theme?, mods?: ["aura", …] }. mods: uygulanınca kurulu değilse
// paket içi mağazadan kurulur ve açılır; paketin açtığı modlar `rigel.look.packMods`'ta tutulur, başka
// paket ya da "Geri al" onları kapatır (kullanıcının önceden açtığı modlara dokunulmaz).
// Uygulama sırası: tema → vurgu → görünüm (vurgu değişince özel vurgu silinir; görünüm en son yazılır).
// Uygulamadan önce mevcut durum `rigel.look.undo`'ya yedeklenir; undo() oraya döner (ve yedeği yeniler,
// yani ikinci "Geri al" ileri alır). Kullanıcı paketleri `rigel.look.packs` (JSON dizi).
import { read, write, normalize, UNDO_PREF, PACKS_PREF, AUTO_PREF } from "chrome://userscripts/content/theme/look.mjs";

const P = Services.prefs;
const ACCENTS = ["rigel", "violet", "green", "orange", "pink", "teal", "indigo", "red", "amber", "lime", "slate"];
const THEMES = ["dark", "light", "system"];
const PACK_MODS_PREF = "rigel.look.packMods";
const AUTO_STATE_PREF = "rigel.look.state.auto"; // "rigel.look.auto" önekiyle başlamasın (gözlemci önek eşler)
const MOD_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;

export const PACKS = [
  { id: "rigel", name: "Rigel", desc: "Varsayılan görünüm", look: {}, accent: "rigel" },
  { id: "cam", name: "Cam", desc: "Buzlu şerit, derin mavi zemin",
    look: { radius: 12, glass: 55, shadow: 2, tabStyle: "hap", bg: { type: "gradient", from: "#24406e", to: "#0b1220", angle: 150 } }, accent: "rigel" },
  { id: "minimal", name: "Minimal", desc: "Gölgesiz, düz sekmeler",
    look: { radius: 6, shadow: 0, tabStyle: "düz" }, accent: "slate" },
  { id: "gece", name: "Gece Yarısı", desc: "Simsiyah zemin, mor vurgu",
    look: { radius: 10, shadow: 2, bg: { type: "solid", color: "#030407" }, glass: 40, accentCustom: "#8b7cf6" }, theme: "dark" },
  { id: "gunbatimi", name: "Gün Batımı", desc: "Turuncudan mora gradyan",
    look: { radius: 14, tabStyle: "hap", glass: 35, shadow: 2, bg: { type: "gradient", from: "#e9765b", to: "#5b2a86", angle: 120 }, accentCustom: "#ffb37a" }, theme: "dark" },
  { id: "retro", name: "Retro", desc: "Köşesiz, eş aralıklı yazı",
    look: { radius: 0, font: "mono", fontSize: 12, tabStyle: "çizgi", shadow: 0, accentCustom: "#e9b44c" } },
  { id: "kompakt", name: "Kompakt", desc: "Sıkı satırlar, dar sekmeler",
    look: { density: "sıkı", fontSize: 12, radius: 6, tabStyle: "düz", tabWidth: 180 } },
  { id: "ferah", name: "Ferah", desc: "Geniş, yuvarlak, havadar",
    look: { density: "ferah", fontSize: 14, radius: 14, shadow: 2, tabStyle: "hap", tabWidth: 240 } },
  { id: "murekkep", name: "Mürekkep", desc: "Gece mavisi, yumuşak ve sakin",
    look: { radius: 12, glass: 62, shadow: 2, tabStyle: "hap", bg: { type: "gradient", from: "#394775", to: "#0e111d", angle: 160 }, accentCustom: "#93a7f0" },
    theme: "dark" },
  { id: "camsisi", name: "Çam Sisi", desc: "Gri-yeşil tonlar, sade kartlar",
    look: { radius: 10, glass: 58, shadow: 1, tabStyle: "kart", bg: { type: "gradient", from: "#3a594a", to: "#0d1411", angle: 170 }, accentCustom: "#9bcdb0" },
    theme: "dark" },
];

function parse(name, def) {
  try {
    const v = JSON.parse(P.getStringPref(name, ""));
    return v ?? def;
  } catch {
    return def;
  }
}

/** Dışarıdan gelen paketi doğrular. Geçersizse null. */
export function sanitizePack(p, fallbackName = "Paketim") {
  if (!p || typeof p !== "object") return null;
  const look = normalize(p.look ?? p);
  const out = { id: String(p.id ?? "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40), name: String(p.name ?? fallbackName).slice(0, 40) || fallbackName, look };
  if (!out.id) out.id = "u" + Date.now().toString(36);
  if (ACCENTS.includes(p.accent)) out.accent = p.accent;
  if (THEMES.includes(p.theme)) out.theme = p.theme;
  if (Array.isArray(p.mods)) {
    const mods = [...new Set(p.mods.filter(m => typeof m === "string" && MOD_ID.test(m)))].slice(0, 12);
    if (mods.length) out.mods = mods;
  }
  if (p.desc) out.desc = String(p.desc).slice(0, 80);
  return out;
}

export function userPacks() {
  const list = parse(PACKS_PREF, []);
  return Array.isArray(list) ? list.map(p => sanitizePack(p)).filter(Boolean).map(p => ({ ...p, user: true })) : [];
}
export function setUserPacks(list) {
  P.setStringPref(PACKS_PREF, JSON.stringify(list.map(({ user, ...p }) => p)));
}
export const allPacks = () => [...PACKS, ...userPacks()];

/** Şu anki görünüm + vurgu + tema (paket biçiminde). */
export function snapshot(name = "Paketim") {
  return { id: "u" + Date.now().toString(36), name, look: read(), accent: P.getStringPref("rigel.accent", "rigel"), theme: P.getStringPref("rigel.theme", "dark"), mods: packMods() };
}

const modsApi = () => ChromeUtils.importESModule("chrome://userscripts/content/mods/manager.sys.mjs").Mods;
const enabledMods = () => { const v = parse("rigel.mods.enabled", []); return Array.isArray(v) ? v : []; };
const packMods = () => { const v = parse(PACK_MODS_PREF, []); return Array.isArray(v) ? v.filter(m => MOD_ID.test(m)) : []; };

/** Paketin istediği modlar: önceki paketin açtıkları (istenmeyenler) kapanır, eksikler kurulur/açılır. */
async function applyMods(want = []) {
  const Mods = modsApi();
  await Mods.init();
  const prev = packMods();
  for (const id of prev) if (!want.includes(id)) Mods.setEnabled(id, false);
  const on = new Set(enabledMods());
  const mine = prev.filter(id => want.includes(id) && on.has(id));
  const failed = [];
  let catalog = null;
  for (const id of want) {
    if (on.has(id)) continue;
    try {
      if (!Mods.get(id)) {
        catalog ??= (await ChromeUtils.importESModule("chrome://userscripts/content/mods/store.sys.mjs").loadCatalog()).entries;
        const entry = catalog.find(e => e.id === id);
        if (!entry) throw new Error("mağazada yok");
        // Yalnız paket içi (güvenilir) katalog betik çalıştırabilir; uzak betikli mod onaysız kurulmaz.
        await Mods.installFromCatalog(entry, { enable: false, allowScript: entry.origin === "bundled" });
      }
      if (Mods.setEnabled(id, true)) mine.push(id);
      else failed.push(id);
    } catch (e) {
      failed.push(id);
      dump(`[rigel] paket modu kurulamadı (${id}): ${e}\n`);
    }
  }
  P.setStringPref(PACK_MODS_PREF, JSON.stringify(mine));
  return { enabled: mine, failed };
}

function applyRaw({ look, accent, theme, mods }) {
  if (theme && THEMES.includes(theme)) P.setStringPref("rigel.theme", theme);
  if (accent && ACCENTS.includes(accent)) P.setStringPref("rigel.accent", accent);
  write(look ?? {});
  return applyMods(Array.isArray(mods) ? mods : []);
}

// Geri al yedeği paket biçimindedir; `mods` o anda paketlerin açtığı modlardır (geri alınca yalnız onlar kalır).
const undoSnapshot = () => snapshot();

/** Paketi uygular; döndürdüğü söz mod sonuçlarıyla ({ enabled, failed }) çözülür. */
export function applyPack(pack) {
  P.setStringPref(UNDO_PREF, JSON.stringify(undoSnapshot()));
  return applyRaw(pack);
}

export const canUndo = () => !!parse(UNDO_PREF, null);

export function undo() {
  const prev = parse(UNDO_PREF, null);
  if (!prev) return false;
  P.setStringPref(UNDO_PREF, JSON.stringify(undoSnapshot()));
  applyRaw(prev);
  return true;
}

// --- Otomatik gece/gündüz: rigel.look.auto = { on, day: <paket id>, night: <paket id>, dayAt: "07:00", nightAt: "19:30" }
export function readAuto() {
  const a = parse(AUTO_PREF, {}) ?? {};
  const t = v => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v ?? "") ? v : null);
  return { on: !!a.on, day: String(a.day ?? "rigel"), night: String(a.night ?? "gece"), dayAt: t(a.dayAt) ?? "07:00", nightAt: t(a.nightAt) ?? "19:30" };
}
/** Şu an "day" mi "night" mı. */
export function autoPeriod(a = readAuto(), now = new Date()) {
  const m = s => +s.slice(0, 2) * 60 + +s.slice(3);
  const cur = now.getHours() * 60 + now.getMinutes(), d = m(a.dayAt), n = m(a.nightAt);
  const isDay = d <= n ? cur >= d && cur < n : cur >= d || cur < n;
  return isDay ? "day" : "night";
}
/** Otomatik ayarı yazar; durum sıfırlanır ki açılınca şu anki dönemin paketi hemen uygulansın. */
export function writeAuto(a) {
  P.setStringPref(AUTO_STATE_PREF, "");
  P.setStringPref(AUTO_PREF, JSON.stringify({ ...readAuto(), ...a }));
}
/** Dönem değiştiyse (ya da ayar değiştiyse) o dönemin paketini uygular. Birden çok pencere aynı durumu görür, tek kez uygulanır. */
export function autoTick() {
  const a = readAuto();
  if (!a.on) return null;
  const period = autoPeriod(a);
  const id = a[period];
  const key = `${period}:${id}`;
  if (P.getStringPref(AUTO_STATE_PREF, "") === key) return null;
  const pack = allPacks().find(p => p.id === id);
  if (!pack) return null;
  P.setStringPref(AUTO_STATE_PREF, key);
  applyPack(pack);
  return key;
}
/** Pencere başına dakikalık denetim (look.mjs init çağırır). */
export function startAuto(win) {
  const tick = () => { try { autoTick(); } catch (e) { dump(`[rigel] otomatik paket: ${e}\n`); } };
  const obs = { observe: tick };
  P.addObserver(AUTO_PREF, obs);
  const timer = win.setInterval(tick, 60_000);
  win.addEventListener("unload", () => { P.removeObserver(AUTO_PREF, obs); win.clearInterval(timer); }, { once: true });
  tick();
}

/** Görünümü yazan dışa aktarma metni (panoya). */
export const exportText = pack => JSON.stringify((({ user, ...p }) => p)(pack), null, 2);
