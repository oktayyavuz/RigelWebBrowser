// Palet ve adres çubuğunun ortak arama ayarları (Firefox tercihlerinden okunur).
//   rigel.bangs.enabled (bool, varsayılan true)
//   rigel.bangs.custom  (JSON: { "tetikleyici": "https://…%s…" })
// Arama motoru Firefox'un varsayılan motorudur; adı ve simgesi önbellekte tutulur.
import { classify, ctrlEnterInput } from "../search/omnibox.mjs";
import { cleanUrl } from "../search/cleanurl.mjs";
import { listBangs } from "../search/bangs.mjs";

export function bangSettings() {
  const enabled = Services.prefs.getBoolPref("rigel.bangs.enabled", true);
  let custom = {};
  try {
    custom = JSON.parse(Services.prefs.getStringPref("rigel.bangs.custom", "{}")) || {};
  } catch {}
  return { bangs: enabled, customBangs: custom };
}

export function allBangs() {
  const s = bangSettings();
  return s.bangs ? listBangs(s.customBangs) : [];
}

// Firefox 158'de `Services.search` yok; arama hizmeti bir modül tekil nesnesi.
const searchService = (() => {
  try {
    return ChromeUtils.importESModule("moz-src:///toolkit/components/search/SearchService.sys.mjs").SearchService;
  } catch {
    return Services.search;
  }
})();

// Varsayılan motor: { name, icon, submit(query) → url }
const engine = { name: "Google", icon: null, ref: null };
export async function refreshEngine() {
  try {
    const e = await searchService.getDefault();
    engine.ref = e;
    engine.name = e.name;
    engine.icon = (await e.getIconURL?.(16)) ?? null;
  } catch {}
}
export const searchEngine = () => engine;

/** Girdiyi açılacak adrese çevirir: bang → adres → Firefox'un varsayılan motoruyla arama. Temiz link uygulanır. */
export function resolveTyped(input, { ctrl = false } = {}) {
  const raw = String(input).trim();
  if (!raw) return null;
  const text = (ctrl && ctrlEnterInput(raw)) || raw;
  const r = classify(text, bangSettings());
  if (!r) return null;
  if (r.type === "search" && engine.ref) {
    try {
      return { ...r, url: engine.ref.getSubmission(r.query).uri.spec };
    } catch {}
  }
  return { ...r, url: r.type === "url" ? cleanUrl(r.url) : r.url };
}
