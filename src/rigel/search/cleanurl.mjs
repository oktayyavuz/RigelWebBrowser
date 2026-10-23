// Temiz link: adreslerdeki izleme parametrelerini (utm_*, fbclid, gclid…) siler.
// Yalnızca adı herkesçe bilinen izleme parametreleri; işlev bozan parametrelere dokunulmaz.
// rigel-core/src/cleanurl.rs'in karşılığı.

/** Her sitede silinenler. */
export const GENERIC_PARAMS = Object.freeze([
  "fbclid", "gclid", "dclid", "gbraid", "wbraid", "gclsrc", "msclkid", "yclid", "twclid", "ttclid",
  "li_fat_id", "mc_cid", "mc_eid", "igshid", "igsh", "_hsenc", "_hsmi", "__hssc", "__hstc", "__hsfp",
  "hsCtaTracking", "mkt_tok", "oly_anon_id", "oly_enc_id", "rb_clickid", "s_cid", "vero_conv", "vero_id",
  "wickedid", "_openstat", "srsltid",
]);

/** `utm_` ile başlayanların hepsi silinir (clean içinde önek); Firefox listesi önek bilmediği için bilinenleri açık yazdık. */
export const UTM_PARAMS = Object.freeze([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "utm_name",
  "utm_cid", "utm_reader", "utm_viz_id", "utm_pubreferrer", "utm_swu", "utm_brand", "utm_social", "utm_social-type",
]);

const AMAZON = Object.freeze(["tag", "ref_", "pd_rd_r", "pd_rd_w", "pd_rd_wg", "pf_rd_p", "pf_rd_r", "pd_rd_i", "psc"]);
const TWITTER = Object.freeze(["s", "t", "ref_src", "ref_url"]);

/** Yalnızca belirli sitelerde silinenler: alan adı soneki → parametreler. */
export const SITE_PARAMS = Object.freeze({
  "youtube.com": Object.freeze(["si", "pp", "feature"]),
  "youtu.be": Object.freeze(["si", "feature"]),
  "twitter.com": TWITTER,
  "x.com": TWITTER,
  "instagram.com": Object.freeze(["igshid", "igsh", "utm_source"]),
  "amazon.com": AMAZON,
  "amazon.com.tr": AMAZON,
  "spotify.com": Object.freeze(["si"]),
  "reddit.com": Object.freeze(["share_id", "rdt"]),
});

/**
 * Firefox `privacy.query_stripping.strip_list` için boşlukla ayrılmış genel liste.
 * Site'ye özgü parametreler (si, tag…) bilerek yok: o liste her sitede geçerli.
 */
export function genericStripList() {
  return [...GENERIC_PARAMS, ...UTM_PARAMS].join(" ");
}

const hostMatches = (host, suffix) => host === suffix || host.endsWith("." + suffix);

function isTracking(host, key) {
  return (
    key.startsWith("utm_") ||
    GENERIC_PARAMS.includes(key) ||
    Object.entries(SITE_PARAMS).some(([suffix, keys]) => hostMatches(host, suffix) && keys.includes(key))
  );
}

/** İzleme parametresi varsa temizlenmiş adresi döndürür, yoksa (ya da http(s) değilse) null. */
export function stripTracking(urlString) {
  let url;
  try { url = new URL(urlString); } catch { return null; }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.search) return null;
  const host = url.hostname.toLowerCase();
  const pairs = [...url.searchParams];
  const kept = pairs.filter(([k]) => !isTracking(host, k));
  if (kept.length === pairs.length) return null;
  url.search = kept.length ? new URLSearchParams(kept).toString() : "";
  return url.href;
}

/** Temizlenmiş adres; temizlenecek bir şey yoksa girdi olduğu gibi döner. */
export function cleanUrl(urlString) {
  return stripTracking(urlString) ?? urlString;
}
