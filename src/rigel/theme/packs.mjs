// Hazır tema paketleri. Paket: { id, name, desc?, look, accent?, theme? }.
// Uygulama sırası: tema → vurgu → görünüm (vurgu değişince özel vurgu silinir; görünüm en son yazılır).
// Uygulamadan önce mevcut durum `rigel.look.undo`'ya yedeklenir; undo() oraya döner (ve yedeği yeniler,
// yani ikinci "Geri al" ileri alır). Kullanıcı paketleri `rigel.look.packs` (JSON dizi).
import { read, write, normalize, UNDO_PREF, PACKS_PREF } from "chrome://userscripts/content/theme/look.mjs";

const P = Services.prefs;
const ACCENTS = ["rigel", "violet", "green", "orange", "pink", "teal", "indigo", "red", "amber", "lime", "slate"];
const THEMES = ["dark", "light", "system"];

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
  return { id: "u" + Date.now().toString(36), name, look: read(), accent: P.getStringPref("rigel.accent", "rigel"), theme: P.getStringPref("rigel.theme", "dark") };
}

function applyRaw({ look, accent, theme }) {
  if (theme && THEMES.includes(theme)) P.setStringPref("rigel.theme", theme);
  if (accent && ACCENTS.includes(accent)) P.setStringPref("rigel.accent", accent);
  write(look ?? {});
}

export function applyPack(pack) {
  P.setStringPref(UNDO_PREF, JSON.stringify(snapshot()));
  applyRaw(pack);
}

export const canUndo = () => !!parse(UNDO_PREF, null);

export function undo() {
  const prev = parse(UNDO_PREF, null);
  if (!prev) return false;
  P.setStringPref(UNDO_PREF, JSON.stringify(snapshot()));
  applyRaw(prev);
  return true;
}

/** Görünümü yazan dışa aktarma metni (panoya). */
export const exportText = pack => JSON.stringify((({ user, ...p }) => p)(pack), null, 2);
