// Arama kısayolları ("bang"): `!yt kedi` ya da `kedi !yt` doğrudan YouTube'da arar (DuckDuckGo /
// Helium gibi). Bang girdinin başında ya da sonunda olabilir; sorgu boşsa sitenin ana sayfası açılır.
// Kullanıcının tanımladıkları yerleşiklerin önüne geçer. rigel-core/src/bangs.rs'in karşılığı.

// triggers: ilki asıl tetikleyici, diğerleri takma ad (küçük harf, `!` olmadan).
// url: `%s` sorgunun yerine geçer. home: sorgu boşsa açılan adres.
const b = (triggers, name, url, home) => Object.freeze({ triggers: Object.freeze(triggers), name, url, home });

export const BUILTIN_BANGS = Object.freeze([
  // Arama motorları
  b(["g", "google"], "Google", "https://www.google.com/search?q=%s", "https://www.google.com/"),
  b(["ddg", "d", "duckduckgo"], "DuckDuckGo", "https://duckduckgo.com/?q=%s", "https://duckduckgo.com/"),
  b(["b", "brave"], "Brave Search", "https://search.brave.com/search?q=%s", "https://search.brave.com/"),
  b(["sp", "startpage"], "Startpage", "https://www.startpage.com/do/search?q=%s", "https://www.startpage.com/"),
  b(["bing"], "Bing", "https://www.bing.com/search?q=%s", "https://www.bing.com/"),
  b(["eco", "ecosia"], "Ecosia", "https://www.ecosia.org/search?q=%s", "https://www.ecosia.org/"),
  b(["ya", "yandex"], "Yandex", "https://yandex.com.tr/search/?text=%s", "https://yandex.com.tr/"),
  b(["i", "img", "images"], "Google Görseller", "https://www.google.com/search?tbm=isch&q=%s", "https://images.google.com/"),
  b(["n", "news"], "Google Haberler", "https://news.google.com/search?q=%s", "https://news.google.com/"),
  b(["m", "maps"], "Google Haritalar", "https://www.google.com/maps/search/%s", "https://www.google.com/maps"),
  b(["osm"], "OpenStreetMap", "https://www.openstreetmap.org/search?query=%s", "https://www.openstreetmap.org/"),
  b(["gt", "translate"], "Google Çeviri", "https://translate.google.com/?sl=auto&tl=tr&text=%s", "https://translate.google.com/"),
  b(["scholar"], "Google Akademik", "https://scholar.google.com/scholar?q=%s", "https://scholar.google.com/"),
  // Ansiklopedi ve sözlük
  b(["w", "wk", "wiki"], "Wikipedia", "https://en.wikipedia.org/wiki/Special:Search?search=%s", "https://en.wikipedia.org/"),
  b(["wtr", "trwiki", "vikipedi"], "Vikipedi", "https://tr.wikipedia.org/wiki/Special:Search?search=%s", "https://tr.wikipedia.org/"),
  b(["eksi"], "Ekşi Sözlük", "https://eksisozluk.com/?q=%s", "https://eksisozluk.com/"),
  b(["tdk"], "TDK Sözlük", "https://sozluk.gov.tr/?ara=%s", "https://sozluk.gov.tr/"),
  b(["wa", "wolfram"], "Wolfram Alpha", "https://www.wolframalpha.com/input?i=%s", "https://www.wolframalpha.com/"),
  b(["imdb"], "IMDb", "https://www.imdb.com/find/?q=%s", "https://www.imdb.com/"),
  b(["wb", "wayback"], "Wayback Machine", "https://web.archive.org/web/*/%s", "https://web.archive.org/"),
  b(["arxiv"], "arXiv", "https://arxiv.org/search/?query=%s&searchtype=all", "https://arxiv.org/"),
  // Video, müzik, sosyal
  b(["yt", "y", "youtube"], "YouTube", "https://www.youtube.com/results?search_query=%s", "https://www.youtube.com/"),
  b(["ytm"], "YouTube Music", "https://music.youtube.com/search?q=%s", "https://music.youtube.com/"),
  b(["spotify"], "Spotify", "https://open.spotify.com/search/%s", "https://open.spotify.com/"),
  b(["twitch"], "Twitch", "https://www.twitch.tv/search?term=%s", "https://www.twitch.tv/"),
  b(["r", "reddit"], "Reddit", "https://www.reddit.com/search/?q=%s", "https://www.reddit.com/"),
  b(["x", "tw", "twitter"], "X", "https://x.com/search?q=%s", "https://x.com/"),
  b(["hn"], "Hacker News", "https://hn.algolia.com/?q=%s", "https://news.ycombinator.com/"),
  // Yazılım
  b(["gh", "github"], "GitHub", "https://github.com/search?q=%s", "https://github.com/"),
  b(["so", "stackoverflow"], "Stack Overflow", "https://stackoverflow.com/search?q=%s", "https://stackoverflow.com/"),
  b(["mdn"], "MDN", "https://developer.mozilla.org/search?q=%s", "https://developer.mozilla.org/"),
  b(["crates", "rs"], "crates.io", "https://crates.io/search?q=%s", "https://crates.io/"),
  b(["docs", "docsrs"], "Docs.rs", "https://docs.rs/releases/search?query=%s", "https://docs.rs/"),
  b(["rust"], "Rust std", "https://doc.rust-lang.org/std/?search=%s", "https://doc.rust-lang.org/std/"),
  b(["npm"], "npm", "https://www.npmjs.com/search?q=%s", "https://www.npmjs.com/"),
  b(["pypi"], "PyPI", "https://pypi.org/search/?q=%s", "https://pypi.org/"),
  b(["aur"], "AUR", "https://aur.archlinux.org/packages?K=%s", "https://aur.archlinux.org/"),
  b(["aw", "archwiki"], "ArchWiki", "https://wiki.archlinux.org/index.php?search=%s", "https://wiki.archlinux.org/"),
  // Alışveriş
  b(["a", "amazon"], "Amazon", "https://www.amazon.com/s?k=%s", "https://www.amazon.com/"),
  b(["atr", "amazontr"], "Amazon Türkiye", "https://www.amazon.com.tr/s?k=%s", "https://www.amazon.com.tr/"),
  b(["ty", "trendyol"], "Trendyol", "https://www.trendyol.com/sr?q=%s", "https://www.trendyol.com/"),
  b(["hb", "hepsiburada"], "Hepsiburada", "https://www.hepsiburada.com/ara?q=%s", "https://www.hepsiburada.com/"),
  b(["ebay"], "eBay", "https://www.ebay.com/sch/i.html?_nkw=%s", "https://www.ebay.com/"),
  // Yapay zekâ
  b(["pp", "perplexity"], "Perplexity", "https://www.perplexity.ai/search?q=%s", "https://www.perplexity.ai/"),
  b(["gpt", "chatgpt"], "ChatGPT", "https://chatgpt.com/?q=%s", "https://chatgpt.com/"),
  b(["claude"], "Claude", "https://claude.ai/new?q=%s", "https://claude.ai/"),
]);

const parseUrl = (s) => {
  try { return new URL(s); } catch { return null; }
};

// `customBangs`: { tetikleyici: adres } nesnesi, Map ya da [tetikleyici, adres] çiftleri.
const entriesOf = (m) => (m ? (m instanceof Map || Array.isArray(m) ? [...m] : Object.entries(m)) : []);

/** Tetikleyiciyi karşılaştırma biçimine getirir: baştaki `!` gider, küçük harf. */
export function normalizeTrigger(trigger) {
  return String(trigger).trim().replace(/^!+/, "").toLowerCase();
}

/** Ayar kaydedilirken kullanıcı bang'lerini temizler: boş/boşluklu tetikleyici ve boş adres atılır. Anahtara göre sıralı. */
export function normalizeCustomBangs(customBangs) {
  const out = {};
  for (const [trigger, url] of entriesOf(customBangs)) {
    const t = normalizeTrigger(trigger);
    const u = String(url).trim();
    if (t && !/\s/.test(t) && u) out[t] = u;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [c]) => (a < c ? -1 : a > c ? 1 : 0)));
}

/** Girdideki bang ve sorgu: `!yt kedi` / `kedi !yt` → { trigger: "yt", query: "kedi" }. Bang yoksa null. */
export function splitBang(input) {
  const words = String(input).split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const isBang = (w) => w.length > 1 && w[0] === "!" && w[1] !== "!";
  const first = words[0];
  const last = words[words.length - 1];
  if (isBang(first)) return { trigger: normalizeTrigger(first), query: words.slice(1).join(" ") };
  if (isBang(last)) return { trigger: normalizeTrigger(last), query: words.slice(0, -1).join(" ") };
  return null;
}

/** Sorguyu hem yolda hem sorgu dizesinde güvenli olacak biçimde kodlar (boşluk → `%20`). */
export function encodeQuery(query) {
  return encodeURIComponent(query).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

// Kullanıcı şablonu: yalnızca http(s). `%s` yoksa adres olduğu gibi açılır; sorgu boşsa sitenin kökü.
function expandCustom(template, query) {
  template = template.trim();
  let candidate;
  if (!query && template.includes("%s")) {
    const u = parseUrl(template.replaceAll("%s", ""));
    if (!u?.host) return null;
    candidate = `${u.protocol}//${u.host}/`;
  } else {
    const enc = encodeQuery(query);
    candidate = template.replaceAll("%s", () => enc);
  }
  const u = parseUrl(candidate);
  return u && (u.protocol === "http:" || u.protocol === "https:") ? u.href : null;
}

const builtinInfo = (x) => ({ trigger: x.triggers[0], aliases: [...x.triggers], name: x.name, url: x.url, custom: false });

function customInfo(trigger, url) {
  const t = normalizeTrigger(trigger);
  const host = parseUrl(url.replaceAll("%s", ""))?.hostname;
  return { trigger: t, aliases: [t], name: host || t, url, custom: true };
}

/**
 * Bang'li girdiyi çözer → { url, bang, query }. Bang yoksa ya da bilinmiyorsa null (normal çözümleme).
 * Kullanıcı bang'i eşleşir ama şablonu geçersizse yerleşiğe düşülmez, null döner.
 */
export function parseBang(input, customBangs) {
  const split = splitBang(input);
  if (!split) return null;
  const { trigger, query } = split;
  const custom = entriesOf(customBangs).find(([t]) => normalizeTrigger(t) === trigger);
  if (custom) {
    const url = expandCustom(String(custom[1]), query);
    return url && { url, bang: customInfo(custom[0], String(custom[1])), query };
  }
  const bang = BUILTIN_BANGS.find((x) => x.triggers.includes(trigger));
  if (!bang) return null;
  return { url: query ? bang.url.replaceAll("%s", () => encodeQuery(query)) : bang.home, bang: builtinInfo(bang), query };
}

/** Ayarlara bakan kısa yol: `bangs: false` ise null, yoksa açılacak adres. */
export function resolveBang(input, { bangs = true, customBangs } = {}) {
  return bangs ? (parseBang(input, customBangs)?.url ?? null) : null;
}

/** Tüm bang'ler (palet ipucu, ayarlar listesi): önce kullanıcınınkiler, sonra yerleşikler. */
export function listBangs(customBangs) {
  return [...entriesOf(customBangs).map(([t, u]) => customInfo(t, String(u))), ...BUILTIN_BANGS.map(builtinInfo)];
}

export function findBang(bangs, alias) {
  const a = alias.toLowerCase();
  return bangs.find((x) => x.aliases.some((y) => y.toLowerCase() === a));
}

/** Yazılmakta olan `!y…` sözcüğüyle başlayan kısayollar; tam eşleşme ve kısa takma adlar önce. */
export function suggestBangs(prefix, bangs, limit = 6) {
  const p = prefix.toLowerCase().replace(/^!+/, "");
  const out = [];
  // Kullanıcının kısayolu (listede önce gelir) aynı takma adı yerleşikten alır; yerleşik için başka adını öner.
  const taken = new Set();
  for (const bang of bangs) {
    const alias = bang.aliases.find((a) => a.toLowerCase().startsWith(p) && !taken.has(a.toLowerCase()));
    for (const a of bang.aliases) taken.add(a.toLowerCase());
    if (alias !== undefined) out.push({ bang, alias });
  }
  const exact = (x) => Number(x.alias.toLowerCase() === p);
  return out.sort((x, y) => exact(y) - exact(x) || x.alias.length - y.alias.length).slice(0, limit);
}
