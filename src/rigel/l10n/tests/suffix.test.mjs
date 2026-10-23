import test from "node:test";
import assert from "node:assert/strict";
import { profile, caseOf, suffixFor, fixSuffixes, BRAND_TERM } from "../suffix.mjs";

const R = "Rigel";

test("Rigel: ünlü uyumu ve ünsüz benzeşmesi", () => {
  const p = profile(R);
  assert.deepEqual(p, { back: false, round: false, endsVowel: false, voiceless: false });
});

// [Firefox'a göre yazılmış ek, Rigel için beklenen]
const FIREFOX_TO_RIGEL = [
  ["u", "i"], ["ü", "i"], ["ı", "i"],
  ["un", "in"], ["ün", "in"], ["ın", "in"], ["nun", "in"], ["nın", "in"],
  ["a", "e"], ["ya", "e"], ["e", "e"],
  ["da", "de"], ["ta", "de"], ["de", "de"], ["te", "de"],
  ["dan", "den"], ["tan", "den"], ["den", "den"], ["ten", "den"],
  ["la", "le"], ["yla", "le"], ["le", "le"],
  ["taki", "deki"], ["daki", "deki"],
];

for (const [from, to] of FIREFOX_TO_RIGEL) {
  test(`Rigel’${from} -> Rigel’${to}`, () => assert.equal(suffixFor(R, from), to));
}

test("tanınmayan ek olduğu gibi kalır", () => {
  for (const s of ["s", "lar", "yedek", "ımız"]) assert.equal(suffixFor(R, s), null);
});

test("durum türleri", () => {
  assert.equal(caseOf("u"), "acc");
  assert.equal(caseOf("yu"), "acc");
  assert.equal(caseOf("nun"), "gen");
  assert.equal(caseOf("ya"), "dat");
  assert.equal(caseOf("ta"), "loc");
  assert.equal(caseOf("tan"), "abl");
  assert.equal(caseOf("la"), "ins");
});

test("diğer sözcükler (sağlama)", () => {
  // ünlüyle biten: Mozilla -> y/n tamponu
  assert.equal(suffixFor("Mozilla", "u"), "yı");
  assert.equal(suffixFor("Mozilla", "un"), "nın");
  assert.equal(suffixFor("Mozilla", "a"), "ya");
  assert.equal(suffixFor("Mozilla", "la"), "yla");
  assert.equal(suffixFor("Opera", "ta"), "da");
  assert.equal(suffixFor("Chrome", "ta"), "de"); // son ünlü e, sonu ünlü
  assert.equal(suffixFor("Tarayıcı", "un"), "nın");
  assert.equal(suffixFor("Yazıt", "da"), "ta"); // sert t
  assert.equal(suffixFor("Yazıt", "dan"), "tan");
  assert.equal(suffixFor("Göz", "a"), "e");
  assert.equal(suffixFor("Okul", "u"), "u");
  assert.equal(suffixFor("Ruh", "da"), "ta");
  assert.equal(suffixFor("Ön", "u"), "ü");
});

test("istisna tablosu", () => {
  // "Alkol" son ünlü o ama l ince: istisna tablosuyla ince ünlü uyumu (yuvarlak kalır)
  assert.equal(suffixFor("Alkol", "u", { alkol: { back: false } }), "ü");
  assert.equal(suffixFor("Alkol", "u"), "u");
});

test("fixSuffixes: ’ ve ' ikisi de", () => {
  const t = "{ -brand-short-name }’u açın, { -brand-product-name }'un, { -brand-shorter-name }’ta";
  const r = fixSuffixes(t, BRAND_TERM, R);
  assert.equal(r.text, "{ -brand-short-name }’i açın, { -brand-product-name }'in, { -brand-shorter-name }’de");
  assert.equal(r.count, 3);
});

test("fixSuffixes: gerçek FTL satırları", () => {
  const cases = [
    ["default-browser-guidance-notification-title = { -brand-short-name }’u varsayılan tarayıcınız yapmayı tamamlayın",
     "default-browser-guidance-notification-title = { -brand-short-name }’i varsayılan tarayıcınız yapmayı tamamlayın"],
    [".label = Teknik verileri ve etkileşim verilerini { -vendor-short-name }’ya gönder", ".label = Teknik verileri ve etkileşim verilerini { -vendor-short-name }’e gönder"],
    ["x = { -vendor-short-name }’nın daha iyi", "x = { -vendor-short-name }’in daha iyi"],
    ["x = { -brand-product-name }’a giriş yap", "x = { -brand-product-name }’e giriş yap"],
    ["x = { -brand-shorter-name }’ta gizli çeviri", "x = { -brand-shorter-name }’de gizli çeviri"],
    ["x = { -brand-product-name }’un uzantıları", "x = { -brand-product-name }’in uzantıları"],
  ];
  for (const [a, b] of cases) assert.equal(fixSuffixes(a, BRAND_TERM, R).text, b);
});

test("fixSuffixes: eksiz kullanım ve başka terimler dokunulmaz", () => {
  const t = "{ -brand-short-name } tarayıcınız, { -monitor-brand-name }’ü, { -pocket-brand-name }’a, { -brand-product-name }’s";
  const r = fixSuffixes(t, BRAND_TERM, R);
  assert.equal(r.text, t);
  assert.equal(r.count, 0);
});

test("fixSuffixes: sabit sözcük (Firefox)", () => {
  const r = fixSuffixes("Firefox’u ve Firefox’ta, Firefox Color’u", "Firefox", R);
  assert.equal(r.text, "Firefox’i ve Firefox’de, Firefox Color’u");
});

test("fixSuffixes: aynı ek zaten doğruysa sayılmaz", () => {
  const r = fixSuffixes("{ -brand-short-name }’i", BRAND_TERM, R);
  assert.equal(r.count, 0);
});
