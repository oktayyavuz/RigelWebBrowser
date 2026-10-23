import test from "node:test";
import assert from "node:assert/strict";
import { classify, ctrlEnterInput, resolve, resolveInput, searchUrl } from "../omnibox.mjs";

const ddg = { searchEngine: "duckDuckGo" };
const r = (input) => resolve(input, (q) => searchUrl(q, ddg));

test("full urls pass through", () => {
  assert.equal(r("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.equal(r("about:blank"), "about:blank");
  assert.equal(r("rigel://newtab/"), "rigel://newtab/");
});

test("bare hosts get a scheme", () => {
  assert.equal(r("example.com"), "https://example.com/");
  assert.equal(r("  docs.rs/cef  "), "https://docs.rs/cef");
  assert.equal(r("localhost:3000"), "http://localhost:3000/");
  assert.equal(r("192.168.1.1/admin"), "http://192.168.1.1/admin");
  assert.equal(r("türkçe.com.tr"), "https://xn--trke-2oa7j.com.tr/");
});

test("everything else is a search", () => {
  assert.equal(r("rust ownership"), "https://duckduckgo.com/?q=rust+ownership");
  assert.equal(r("cef"), "https://duckduckgo.com/?q=cef");
  assert.equal(r("v1.2"), "https://duckduckgo.com/?q=v1.2");
  assert.equal(r("foo:bar"), "https://duckduckgo.com/?q=foo%3Abar");
  assert.equal(r("999.1.1.1"), "https://duckduckgo.com/?q=999.1.1.1");
  assert.equal(r("javascript:alert(1)"), "https://duckduckgo.com/?q=javascript%3Aalert%281%29");
});

test("empty is null", () => {
  assert.equal(r("   "), null);
  assert.equal(classify(""), null);
  assert.equal(resolveInput("  "), null);
});

test("search urls", () => {
  assert.equal(searchUrl("rust cef"), "https://www.google.com/search?q=rust+cef");
  assert.equal(searchUrl("a&b", ddg), "https://duckduckgo.com/?q=a%26b");
  assert.equal(searchUrl("x", { searchEngine: "bilinmeyen" }), "https://www.google.com/search?q=x");
});

test("custom engine and fallback", () => {
  const s = { searchEngine: "custom", customSearchUrl: "https://kagi.com/search?q=%s" };
  assert.equal(searchUrl("rust cef", s), "https://kagi.com/search?q=rust+cef");
  assert.equal(searchUrl("x", { ...s, customSearchUrl: "javascript:alert(%s)" }), "https://www.google.com/search?q=x");
  assert.equal(searchUrl("x", { ...s, customSearchUrl: "https://kagi.com/" }), "https://www.google.com/search?q=x");
});

test("input resolution prefers bangs", () => {
  assert.equal(resolveInput("!gh rigel"), "https://github.com/search?q=rigel");
  assert.equal(resolveInput("example.com"), "https://example.com/");
  assert.equal(resolveInput("!yok kedi"), "https://www.google.com/search?q=%21yok+kedi");
  assert.equal(resolveInput("kedi !yt", ddg), "https://www.youtube.com/results?search_query=kedi");
  // Bang'ler kapalıyken `!yt kedi` düz aramadır.
  assert.equal(resolveInput("!yt kedi", { bangs: false }), "https://www.google.com/search?q=%21yt+kedi");
});

test("classify reports the kind of input", () => {
  assert.equal(classify("example.com").type, "url");
  assert.equal(classify("https://a.com/").type, "url");
  assert.deepEqual(classify("  rust book ", ddg), { type: "search", url: "https://duckduckgo.com/?q=rust+book", query: "rust book" });
  const bang = classify("!yt");
  assert.equal(bang.type, "bang");
  assert.equal(bang.url, "https://www.youtube.com/");
  assert.equal(bang.bang.name, "YouTube");
  const custom = classify("!kagi x", { customBangs: { kagi: "https://kagi.com/search?q=%s" } });
  assert.equal(custom.type, "bang");
  assert.equal(custom.url, "https://kagi.com/search?q=x");
});

test("ctrl+enter completes a bare word to www.<word>.com", () => {
  assert.equal(ctrlEnterInput("rigel"), "www.rigel.com");
  assert.equal(ctrlEnterInput("  rigel "), "www.rigel.com");
  assert.equal(resolveInput(ctrlEnterInput("rigel")), "https://www.rigel.com/");
  assert.equal(ctrlEnterInput("rigel browser"), null);
  assert.equal(ctrlEnterInput("example.com"), null);
  assert.equal(ctrlEnterInput("a/b"), null);
  assert.equal(ctrlEnterInput("foo:bar"), null);
  assert.equal(ctrlEnterInput("  "), null);
});
