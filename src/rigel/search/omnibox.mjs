// Adres çubuğuna yazılanı URL'ye çevirir: bang, tam URL, alan adı ya da arama.
// rigel-core/src/omnibox.rs + settings.rs (arama motorları, resolve_input) karşılığı.
import { parseBang } from "./bangs.mjs";

/** Olduğu gibi açılan şemalar. */
export const KNOWN_SCHEMES = Object.freeze(["http", "https", "file", "about", "data", "blob", "rigel", "chrome", "view-source"]);

/** Arama motorları (kimlik → ad, taban adres; sorgu `q` parametresiyle eklenir). Varsayılan: google. */
export const SEARCH_ENGINES = Object.freeze({
  google: { name: "Google", url: "https://www.google.com/search" },
  duckDuckGo: { name: "DuckDuckGo", url: "https://duckduckgo.com/" },
  brave: { name: "Brave Search", url: "https://search.brave.com/search" },
  startpage: { name: "Startpage", url: "https://www.startpage.com/do/search" },
  ecosia: { name: "Ecosia", url: "https://www.ecosia.org/search" },
  bing: { name: "Bing", url: "https://www.bing.com/search" },
});
export const DEFAULT_ENGINE = "google";

const parseUrl = (s) => {
  try { return new URL(s); } catch { return null; }
};
const isWeb = (u) => u && (u.protocol === "http:" || u.protocol === "https:");

/**
 * Seçili motorla arama adresi. `settings`: { searchEngine, customSearchUrl } (`%s` içeren adres, yalnızca
 * http(s)); "custom" motor geçersizse Google'a düşer.
 */
export function searchUrl(query, { searchEngine = DEFAULT_ENGINE, customSearchUrl = "" } = {}) {
  if (searchEngine === "custom" && customSearchUrl.includes("%s")) {
    const encoded = new URLSearchParams({ x: query }).toString().slice(2);
    const candidate = customSearchUrl.replaceAll("%s", () => encoded);
    if (isWeb(parseUrl(candidate))) return candidate;
  }
  const url = new URL((SEARCH_ENGINES[searchEngine] ?? SEARCH_ENGINES[DEFAULT_ENGINE]).url);
  url.searchParams.append("q", query);
  return url.href;
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

// `host[:port][/yol]` biçiminde mi? (`example.com`, `localhost:3000/x`, `192.168.1.1`)
function looksLikeHost(s) {
  const authority = s.split(/[/?#]/)[0];
  let host = authority;
  const i = authority.lastIndexOf(":");
  if (i >= 0) {
    const port = authority.slice(i + 1);
    if (!/^\d+$/.test(port)) return false;
    host = authority.slice(0, i);
  }
  if (host.toLowerCase() === "localhost" || IPV4.test(host)) return true;
  const labels = host.split(".");
  const tld = labels[labels.length - 1];
  return (
    labels.length >= 2 &&
    labels.every((l) => /^[\p{Alphabetic}\p{N}-]+$/u.test(l)) &&
    [...tld].length >= 2 &&
    /^\p{Alphabetic}+$/u.test(tld)
  );
}

const isLocal = (s) => /^(localhost|127\.|192\.168\.|10\.)/i.test(s);

// { type: "url" | "search", url } — boş girdi için null.
function resolveKind(input, search) {
  const s = String(input).trim();
  if (!s) return null;
  const url = parseUrl(s);
  if (url && KNOWN_SCHEMES.includes(url.protocol.slice(0, -1))) return { type: "url", url: url.href };
  if (!/\s/.test(s) && looksLikeHost(s)) {
    const u = parseUrl(`${isLocal(s) ? "http" : "https"}://${s}`);
    if (u) return { type: "url", url: u.href };
  }
  return { type: "search", url: search(s) };
}

/** Kullanıcı girdisini açılacak URL'ye çevirir (bang'siz). Boş girdi için null. `search`: sorgu → adres. */
export function resolve(input, search) {
  return resolveKind(input, search)?.url ?? null;
}

/**
 * Palet girdisini sınıflandırır: { type: "bang" | "url" | "search", url, query?, bang? } ya da boşsa null.
 * `settings`: { bangs = true, customBangs, searchEngine, customSearchUrl }.
 */
export function classify(input, settings = {}) {
  if (settings.bangs !== false) {
    const hit = parseBang(input, settings.customBangs);
    if (hit) return { type: "bang", ...hit };
  }
  const r = resolveKind(input, (q) => searchUrl(q, settings));
  return r && (r.type === "search" ? { ...r, query: String(input).trim() } : r);
}

/** Palet girdisinin açılacağı adres: önce bang'ler, sonra adres/alan adı/arama. Boşsa null. */
export function resolveInput(input, settings = {}) {
  return classify(input, settings)?.url ?? null;
}

/**
 * Ctrl+Enter tamamlaması: "rigel" → "www.rigel.com". Boşluk, nokta, `/` ya da `:` içeren girdide null.
 * Dönen değer normal girdi gibi `resolveInput`'a verilir.
 */
export function ctrlEnterInput(input) {
  const raw = String(input).trim();
  return raw && !/[\s./:]/.test(raw) ? `www.${raw}.com` : null;
}
