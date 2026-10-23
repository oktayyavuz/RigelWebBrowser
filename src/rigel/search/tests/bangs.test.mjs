import test from "node:test";
import assert from "node:assert/strict";
import { BUILTIN_BANGS, listBangs, normalizeCustomBangs, parseBang, resolveBang, splitBang, suggestBangs } from "../bangs.mjs";

const url = (input, custom) => parseBang(input, custom)?.url ?? null;

test("triggers are unique and templates valid", () => {
  const seen = new Set();
  for (const bang of BUILTIN_BANGS) {
    assert.ok(bang.url.includes("%s"), `${bang.name}: %s yok`);
    assert.doesNotThrow(() => new URL(bang.url.replace("%s", "x")), `${bang.name}: geçersiz adres`);
    assert.doesNotThrow(() => new URL(bang.home), `${bang.name}: geçersiz ana sayfa`);
    for (const t of bang.triggers) {
      assert.equal(t, t.toLowerCase());
      assert.ok(!seen.has(t), `${t} iki kez tanımlı`);
      seen.add(t);
    }
  }
  assert.equal(BUILTIN_BANGS.length, 46);
});

test("bang at start or end", () => {
  assert.equal(url("!yt kedi videoları"), "https://www.youtube.com/results?search_query=kedi%20videolar%C4%B1");
  assert.equal(url("kedi !y"), "https://www.youtube.com/results?search_query=kedi");
  assert.equal(url("  !YouTube   kedi "), "https://www.youtube.com/results?search_query=kedi");
  assert.equal(url("!w Rust"), "https://en.wikipedia.org/wiki/Special:Search?search=Rust");
  assert.equal(url("a&b !gh"), "https://github.com/search?q=a%26b");
  const hit = parseBang("kedi !yt");
  assert.equal(hit.query, "kedi");
  assert.equal(hit.bang.name, "YouTube");
});

test("empty query opens home", () => {
  assert.equal(url("!yt"), "https://www.youtube.com/");
  assert.equal(url("!wtr"), "https://tr.wikipedia.org/");
});

test("unknown, disabled or missing bangs fall through", () => {
  assert.equal(parseBang("!bilinmeyen kedi"), null);
  assert.equal(parseBang("kedi köpek"), null);
  assert.equal(parseBang("!"), null);
  assert.equal(parseBang(""), null);
  assert.equal(parseBang("merhaba! dünya"), null);
  assert.equal(parseBang("!!yt kedi"), null);
  assert.equal(resolveBang("!yt kedi", { bangs: false }), null);
  assert.equal(resolveBang("!yt kedi"), "https://www.youtube.com/results?search_query=kedi");
});

test("query encoding keeps reserved characters safe", () => {
  assert.equal(url("!g it's (a) *test!*"), "https://www.google.com/search?q=it%27s%20%28a%29%20%2Atest%21%2A");
  assert.equal(url("!g $& x"), "https://www.google.com/search?q=%24%26%20x");
});

test("custom bangs override builtins", () => {
  const custom = {
    "!YT": "https://invidious.example/search?q=%s",
    kagi: "https://kagi.com/search?q=%s",
    "kötü": "javascript:alert(%s)",
  };
  assert.equal(url("!yt kedi", custom), "https://invidious.example/search?q=kedi");
  assert.equal(url("!youtube kedi", custom), "https://www.youtube.com/results?search_query=kedi");
  assert.equal(url("!kagi", custom), "https://kagi.com/");
  assert.equal(url("!kötü x", custom), null);
  const all = listBangs(custom);
  assert.ok(all[0].custom);
  assert.equal(all.filter((b) => b.custom).length, 3);
  assert.ok(all.some((b) => b.trigger === "yt" && !b.custom && b.name === "YouTube"));
  assert.equal(all.find((b) => b.trigger === "kagi").name, "kagi.com");
  // Map ve çift dizisi de kabul edilir.
  assert.equal(url("!kagi x", new Map(Object.entries(custom))), "https://kagi.com/search?q=x");
  assert.equal(url("!kagi x", Object.entries(custom)), "https://kagi.com/search?q=x");
});

test("custom bang without %s opens as is", () => {
  assert.equal(url("!blog yeni", { blog: "https://blog.example/ara" }), "https://blog.example/ara");
});

test("custom bangs are normalized on save", () => {
  const out = normalizeCustomBangs({ " !Kagi ": " https://kagi.com/search?q=%s ", bos: "  ", "a b": "https://x.com/", "!": "https://y.com/" });
  assert.deepEqual(out, { kagi: "https://kagi.com/search?q=%s" });
  assert.deepEqual(Object.keys(normalizeCustomBangs({ z: "https://z/", a: "https://a/" })), ["a", "z"]);
});

test("splitBang", () => {
  assert.deepEqual(splitBang("!yt kedi"), { trigger: "yt", query: "kedi" });
  assert.deepEqual(splitBang("kedi köpek !YT"), { trigger: "yt", query: "kedi köpek" });
  assert.equal(splitBang("   "), null);
});

test("suggestBangs prefers exact and short aliases, user bangs shadow builtins", () => {
  const all = listBangs({ yt: "https://invidious.example/?q=%s" });
  const s = suggestBangs("!y", all);
  assert.equal(s[0].alias, "y");
  assert.equal(s[0].bang.name, "YouTube");
  const yt = suggestBangs("yt", all);
  assert.equal(yt[0].bang.custom, true);
  assert.ok(suggestBangs("", all, 3).length <= 3);
});
