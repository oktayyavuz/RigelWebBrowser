import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, ALT, CTRL, SHIFT, bindings, lookupTable, parse, tableKey } from "../keymap.mjs";

const code = (c) => c.charCodeAt(0);

test("parses combos", () => {
  assert.deepEqual(parse("Ctrl+Shift+L"), { key: code("L"), mods: CTRL | SHIFT });
  assert.deepEqual(parse("Alt+Left"), { key: 0x25, mods: ALT });
  assert.deepEqual(parse("F12"), { key: 0x7b, mods: 0 });
  assert.deepEqual(parse("Ctrl+="), { key: 0xbb, mods: CTRL });
  assert.deepEqual(parse("Ctrl+-"), { key: 0xbd, mods: CTRL });
  assert.deepEqual(parse("Ctrl+,"), { key: 0xbc, mods: CTRL });
  assert.deepEqual(parse("Ctrl+k"), { key: code("K"), mods: CTRL });
  assert.equal(parse("Super+X"), null);
  assert.equal(parse("Ctrl+Bilinmeyen"), null);
  assert.equal(parse("F13"), null);
  assert.equal(parse(""), null);
});

test("every action has valid defaults", () => {
  assert.equal(ACTIONS.length, 49);
  for (const { id, label, keys } of ACTIONS) {
    assert.ok(label, `${id} etiketsiz`);
    for (const d of keys) assert.ok(parse(d), `${id}: ${d} ayrıştırılamadı`);
  }
  assert.equal(new Set(ACTIONS.map((a) => a.id)).size, ACTIONS.length);
});

test("default keys do not clash", () => {
  const seen = new Map();
  for (const { id, keys } of ACTIONS) {
    for (const d of keys) {
      const { key, mods } = parse(d);
      const k = tableKey(key, mods);
      assert.ok(!seen.has(k), `${d}: ${seen.get(k)} ve ${id} aynı tuşu kullanıyor`);
      seen.set(k, id);
    }
  }
});

test("user overrides replace defaults", () => {
  let t = lookupTable();
  assert.equal(t.get(tableKey(code("E"), CTRL)), "palette");
  t = lookupTable({ palette: ["Ctrl+Shift+P"] });
  assert.equal(t.get(tableKey(code("E"), CTRL)), undefined);
  assert.equal(t.get(tableKey(code("P"), CTRL | SHIFT)), "palette");
  // Boş liste kısayolu tamamen kaldırır.
  assert.equal(lookupTable({ find: [] }).get(tableKey(code("F"), CTRL)), undefined);
});

test("bindings merge overrides with defaults", () => {
  const b = bindings({ newTab: ["Ctrl+Alt+T"] }).find((x) => x.id === "newTab");
  assert.deepEqual(b.keys, ["Ctrl+Alt+T"]);
  assert.deepEqual(b.defaults, ["Ctrl+T"]);
  assert.equal(b.label, "Yeni sekme");
});
