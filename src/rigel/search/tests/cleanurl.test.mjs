import test from "node:test";
import assert from "node:assert/strict";
import { GENERIC_PARAMS, SITE_PARAMS, cleanUrl, genericStripList, stripTracking } from "../cleanurl.mjs";

test("strips known trackers", () => {
  assert.equal(stripTracking("https://a.com/p?utm_source=x&utm_medium=y"), "https://a.com/p");
  assert.equal(stripTracking("https://a.com/p?id=5&fbclid=abc"), "https://a.com/p?id=5");
  assert.equal(stripTracking("https://www.youtube.com/watch?v=dQw&si=xyz"), "https://www.youtube.com/watch?v=dQw");
  assert.equal(stripTracking("https://youtu.be/dQw?si=xyz"), "https://youtu.be/dQw");
  assert.equal(cleanUrl("https://a.com/p?id=5&gclid=abc#frag"), "https://a.com/p?id=5#frag");
  assert.equal(cleanUrl("https://www.amazon.com/dp/B0?tag=x&psc=1&th=1"), "https://www.amazon.com/dp/B0?th=1");
});

test("leaves clean and site-specific params elsewhere", () => {
  assert.equal(stripTracking("https://a.com/p?id=5"), null);
  assert.equal(stripTracking("https://a.com/p"), null);
  // "si" yalnızca YouTube/Spotify'da izleme; başka sitede işlevsel olabilir.
  assert.equal(stripTracking("https://example.com/search?si=1"), null);
  assert.equal(stripTracking("rigel://settings/?utm_source=x"), null);
  assert.equal(stripTracking("not a url"), null);
  // Alan adı soneki tam etiket olmalı: notyoutube.com YouTube sayılmaz.
  assert.equal(stripTracking("https://notyoutube.com/w?si=1"), null);
});

test("cleanUrl returns input untouched when nothing to strip", () => {
  assert.equal(cleanUrl("https://a.com/p?id=5"), "https://a.com/p?id=5");
  assert.equal(cleanUrl("garbage"), "garbage");
});

test("generic strip list is space separated and excludes site-specific params", () => {
  const list = genericStripList().split(" ");
  assert.ok(list.includes("fbclid") && list.includes("utm_source") && list.includes("srsltid"));
  assert.ok(GENERIC_PARAMS.every((p) => list.includes(p)));
  assert.ok(!list.includes("si") && !list.includes("tag"));
  assert.equal(new Set(list).size, list.length);
  assert.ok(Object.keys(SITE_PARAMS).includes("youtube.com"));
});
