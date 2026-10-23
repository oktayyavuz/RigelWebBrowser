// Türkçe ek eşleyici (saf JS, Firefox'a bağımlı değil; node:test ile sınanır).
//
// Mozilla'nın Türkçe çevirisi eklerı "Firefox" sözcüğüne göre yazar: Firefox’u, Firefox’un, Firefox’ta.
// Marka "Rigel" olunca ek, son ünlüye (e: ince düz) ve son ünsüze (l: yumuşak, ince) göre değişmeli:
// Rigel’i, Rigel’in, Rigel’e, Rigel’de, Rigel’den, Rigel’le.
//
// Yaklaşım: özgün eki "durum" türüne indir (belirtme, tamlayan, yönelme, bulunma, ayrılma, araç),
// sonra yeni sözcüğe göre yeniden kur. Tanınmayan ek olduğu gibi bırakılır.

const FRONT = "eiöü";
const BACK = "aıou";
const ROUND = "oöuü";
const VOICELESS = "çfhkpsşt"; // "fıstıkçı şahap"

/** Sözcüğün ünlü uyumu bilgileri. İsteğe bağlı `exceptions`: { sözcük: { back?: bool } } (yabancı kökenli sözcükler). */
export function profile(word, exceptions = {}) {
  const lower = word.toLocaleLowerCase("tr");
  let last = "";
  for (const ch of lower) if (FRONT.includes(ch) || BACK.includes(ch)) last = ch;
  const last_ch = lower.replace(/[^a-zçğıöşüâîû]+$/u, "").slice(-1) || lower.slice(-1);
  const endsVowel = FRONT.includes(last_ch) || BACK.includes(last_ch);
  const ex = exceptions[lower] ?? {};
  return {
    back: ex.back ?? (last ? BACK.includes(last) : false),
    round: last ? ROUND.includes(last) : false,
    endsVowel,
    voiceless: VOICELESS.includes(last_ch),
  };
}

const four = (p) => (p.back ? (p.round ? "u" : "ı") : p.round ? "ü" : "i");
const two = (p) => (p.back ? "a" : "e");

// durum -> ek üreticisi
const BUILD = {
  acc: (p) => (p.endsVowel ? "y" : "") + four(p),
  gen: (p) => (p.endsVowel ? "n" : "") + four(p) + "n",
  dat: (p) => (p.endsVowel ? "y" : "") + two(p),
  loc: (p) => (p.voiceless ? "t" : "d") + two(p),
  abl: (p) => (p.voiceless ? "t" : "d") + two(p) + "n",
  ins: (p) => (p.endsVowel ? "y" : "") + "l" + two(p),
  locki: (p) => BUILD.loc(p) + "ki",
};

/** Özgün (Firefox'a göre yazılmış) eki durum türüne çevirir; tanımazsa null. */
export function caseOf(suffix) {
  const s = suffix.toLocaleLowerCase("tr");
  if (/^y?[uüıi]$/.test(s)) return "acc";
  if (/^n?[uüıi]n$/.test(s)) return "gen";
  if (/^y?[ae]$/.test(s)) return "dat";
  if (/^[dt][ae]$/.test(s)) return "loc";
  if (/^[dt][ae]n$/.test(s)) return "abl";
  if (/^y?l[ae]$/.test(s)) return "ins";
  if (/^[dt][ae]ki$/.test(s)) return "locki";
  return null;
}

/** `word` sözcüğüne `suffix` (Firefox'a göre yazılmış) eki yerine gelmesi gereken ek. Tanınmazsa null. */
export function suffixFor(word, suffix, exceptions) {
  const kind = caseOf(suffix);
  if (!kind) return null;
  return BUILD[kind](profile(word, exceptions));
}

/** Kesme işaretli ek: ’ ya da ' sonrası harf dizisi. İşaret türü korunur. */
const APOS = "[’']";
const LETTERS = "[a-zA-ZçğıöşüÇĞİÖŞÜâîû]+";

/**
 * Metindeki `ref` desenini (marka başvurusu) izleyen kesmeli eki yeni sözcüğe uydurur.
 * @param {string} text
 * @param {RegExp|string} ref  yakalama grubu olmayan desen kaynağı (ör. FTL terimi ya da sabit sözcük)
 * @param {string} word  eşleşmenin yerine konan/geçerli olan sözcük
 * @returns {{text: string, count: number}}
 */
export function fixSuffixes(text, ref, word, exceptions) {
  const source = ref instanceof RegExp ? ref.source : ref;
  const re = new RegExp(`(${source})(${APOS})(${LETTERS})`, "gu");
  let count = 0;
  const out = text.replace(re, (all, head, apos, suffix) => {
    const fixed = suffixFor(word, suffix, exceptions);
    if (fixed == null || fixed === suffix) return all;
    count++;
    return head + apos + fixed;
  });
  return { text: out, count };
}

/** FTL marka terimi başvurusu: { -brand-short-name }, { -vendor-short-name } vb. */
export const BRAND_TERM = /\{\s*-(?:brand-[a-z-]+|vendor-short-name)\s*\}/u;
