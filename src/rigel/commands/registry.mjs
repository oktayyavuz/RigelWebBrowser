// Komut kaydı: `Rigel.commands.register({ id, label, keys?, icon?, run })`, `list()`, `run(id)`.
// Tuşlar pencereye XUL <key> olarak bağlanır. Aynı birleşimi kullanan Firefox tuşu varsa devre dışı
// kalır (yalnız çakışan; diğer Firefox kısayolları olduğu gibi çalışır).
//
// Ek alanlar (isteğe bağlı):
//   label: string ya da () => string (ör. "Sabitle" / "Sabitlemeyi kaldır")
//   sub:   string ya da () => string, satırın sağındaki açıklama
//   when:  () => boolean, false ise palette görünmez
//   bind:  true ise `keys` pencereye bağlanır. Dışarıdan kaydedilen komutlarda varsayılan false:
//          tuşlar yalnız palette gösterilir (kendi kısayolunu kuran modül çift tetiklenmesin).
//   hidden: true ise palette listelenmez (yalnız tuş/çağrı).

const resolve = (v) => (typeof v === "function" ? v() : v);

// "Ctrl+Shift+C" → { modifiers: "accel,shift", key: "c" } ya da { keycode: "VK_F12" }.
const KEYCODES = {
  Tab: "VK_TAB", Enter: "VK_RETURN", Escape: "VK_ESCAPE", PageUp: "VK_PAGE_UP", PageDown: "VK_PAGE_DOWN",
  End: "VK_END", Home: "VK_HOME", Left: "VK_LEFT", Up: "VK_UP", Right: "VK_RIGHT", Down: "VK_DOWN",
  Delete: "VK_DELETE", NumPlus: "VK_ADD", NumMinus: "VK_SUBTRACT",
};
export function comboToXul(combo) {
  const parts = String(combo).split("+");
  const n = parts.length;
  const [mods, k] = n >= 2 && parts[n - 1] === "" && parts[n - 2] === "" ? [parts.slice(0, -2), "+"] : [parts.slice(0, -1), parts[n - 1]];
  const m = [];
  for (const p of mods) {
    if (p === "Ctrl") m.push("accel");
    else if (p === "Shift") m.push("shift");
    else if (p === "Alt") m.push("alt");
    else return null;
  }
  const out = { modifiers: m.join(",") };
  if (/^F([1-9]|1[0-2])$/.test(k)) out.keycode = "VK_" + k;
  else if (KEYCODES[k]) out.keycode = KEYCODES[k];
  else if (k === "Space") out.key = " ";
  else if (k.length === 1) out.key = k.toLowerCase();
  else return null;
  return out;
}

// Bir <key> öğesinin karşılaştırma imzası: "ctrl|shift|alt|meta|tuş".
function signature({ modifiers = "", key, keycode }) {
  const set = new Set(modifiers.toLowerCase().split(/[\s,]+/).filter(Boolean));
  const has = (...names) => (names.some((x) => set.has(x)) ? 1 : 0);
  const mods = [has("accel", "control"), has("shift"), has("alt"), has("meta", "os")].join("");
  const k = keycode ? keycode.toUpperCase() : key ? "k:" + key.toLowerCase() : "";
  return k ? `${mods}|${k}` : null;
}
const sigOfElement = (e) => signature({
  modifiers: e.getAttribute("modifiers") || "", key: e.getAttribute("key"), keycode: e.getAttribute("keycode"),
});

// Kullanıcının kısayol değişiklikleri: rigel.keymap.custom = { "<eylem id>": "Ctrl+Shift+X" | "" } ("" = kapalı).
// Değiştirilen eylem tek bir kısayol alır; varsayılan tuşları bırakılır (Firefox'ta aynı tuş varsa o da kapatılır).
const KEYMAP_PREF = "rigel.keymap.custom";
function readOverrides() {
  try {
    const v = JSON.parse(Services.prefs.getStringPref(KEYMAP_PREF, "{}"));
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function createRegistry(win) {
  const doc = win.document;
  const cmds = new Map();
  const bound = new Map(); // imza → komut kimliği
  const released = new Map(); // imza → komut kimliği: eylemin bıraktığı varsayılan tuş; Firefox'un aynı tuşu kapanır
  let keyset = null;
  let cmdset = null;

  function sets() {
    if (!keyset) {
      cmdset = doc.createXULElement("commandset");
      cmdset.id = "rigel-commandset";
      keyset = doc.createXULElement("keyset");
      keyset.id = "rigel-keyset";
      const host = doc.getElementById("mainKeyset")?.parentNode ?? doc.body ?? doc.documentElement;
      host.append(cmdset, keyset);
    }
    return keyset;
  }

  // Bizim tuşlarla aynı birleşimdeki Firefox tuşlarını kapatır. Geç eklenen tuşlar (DevTools) için tekrar çağrılır.
  function suppressConflicts() {
    if (!bound.size && !released.size) return;
    for (const k of doc.querySelectorAll("key")) {
      if (k.closest("#rigel-keyset") || k.getAttribute("disabled") === "true") continue;
      const sig = sigOfElement(k);
      const owner = sig && (bound.get(sig) ?? released.get(sig));
      if (owner) {
        k.setAttribute("disabled", "true");
        k.setAttribute("rigel-suppressed", owner);
      }
    }
  }

  function bindKeys(c) {
    const ks = sets();
    let cmdEl = doc.getElementById("rigel-cmd-" + c.id);
    if (!cmdEl) {
      cmdEl = doc.createXULElement("command");
      cmdEl.id = "rigel-cmd-" + c.id;
      cmdEl.addEventListener("command", (e) => run(c.id, { event: e, source: "key" }));
      cmdset.append(cmdEl);
    }
    (c.keys ?? []).forEach((combo, i) => {
      const x = comboToXul(combo);
      const sig = x && signature(x);
      if (!sig) {
        win.console.warn(`[rigel] çözülemeyen kısayol: ${combo} (${c.id})`);
        return;
      }
      if (bound.has(sig) && bound.get(sig) !== c.id) {
        win.console.warn(`[rigel] ${combo} zaten ${bound.get(sig)} komutunda; ${c.id} için atlandı`);
        return;
      }
      bound.set(sig, c.id);
      const key = doc.createXULElement("key");
      key.id = `rigel-key-${c.id}-${i}`;
      key.setAttribute("command", cmdEl.id);
      if (x.modifiers) key.setAttribute("modifiers", x.modifiers);
      if (x.keycode) key.setAttribute("keycode", x.keycode);
      else key.setAttribute("key", x.key);
      ks.append(key);
    });
    suppressConflicts();
  }

  function effectiveKeys(c) {
    const o = readOverrides();
    if (!Object.hasOwn(o, c.id)) return [...c.defaultKeys];
    return o[c.id] ? [String(o[c.id])] : [];
  }

  // Komutun tuş bağlarını, bıraktığı varsayılanları ve kapattığı Firefox tuşlarını kaldırır.
  function unbindKeys(id) {
    for (const k of doc.querySelectorAll(`#rigel-keyset key[command="rigel-cmd-${id}"]`)) k.remove();
    for (const m of [bound, released]) for (const [sig, owner] of m) if (owner === id) m.delete(sig);
    for (const k of doc.querySelectorAll(`key[rigel-suppressed="${id}"]`)) {
      k.removeAttribute("disabled");
      k.removeAttribute("rigel-suppressed");
    }
  }

  function applyKeys(c) {
    unbindKeys(c.id);
    c.keys = effectiveKeys(c);
    c.overridden = Object.hasOwn(readOverrides(), c.id);
    // Değiştirilmiş eylemin yeni tuşu her zaman bağlanır; bırakılan varsayılanlar Firefox'ta da kapanır.
    if ((c.bind || c.overridden) && c.keys.length) bindKeys(c);
    if (c.overridden) {
      for (const combo of c.defaultKeys) {
        const x = comboToXul(combo);
        const sig = x && signature(x);
        if (sig && !bound.has(sig)) released.set(sig, c.id);
      }
      suppressConflicts();
    }
  }

  function register(spec, { builtin = false } = {}) {
    if (!spec?.id || typeof spec.run !== "function") throw new Error("Rigel.commands.register: id ve run gerekli");
    const keys = spec.keys == null ? [] : Array.isArray(spec.keys) ? spec.keys : [spec.keys];
    const c = { icon: "bolt", ...spec, defaultKeys: keys.map(String), keys: [], bind: spec.bind ?? builtin };
    if (cmds.has(c.id)) unregister(c.id);
    cmds.set(c.id, c);
    applyKeys(c);
    return () => unregister(c.id);
  }

  function unregister(id) {
    cmds.delete(id);
    unbindKeys(id);
  }

  // Ayarlardan kısayol değişince canlı yeniden bağla.
  const keymapObserver = { observe: () => { for (const c of cmds.values()) applyKeys(c); } };
  Services.prefs.addObserver(KEYMAP_PREF, keymapObserver);
  win.addEventListener("unload", () => Services.prefs.removeObserver(KEYMAP_PREF, keymapObserver), { once: true });

  /** Palette gösterilecek komutlar (çözülmüş etiketlerle). */
  function list({ all = false } = {}) {
    const out = [];
    for (const c of cmds.values()) {
      if (!all && c.hidden) continue;
      let ok = true;
      try { ok = c.when ? !!c.when() : true; } catch { ok = false; }
      if (!all && !ok) continue;
      out.push({
        id: c.id, label: resolve(c.label) ?? c.id, sub: resolve(c.sub) ?? "", keys: [...(c.keys ?? [])], defaultKeys: [...(c.defaultKeys ?? [])],
        icon: resolve(c.icon), run: (opts) => run(c.id, opts),
      });
    }
    return out;
  }

  function run(id, opts = {}) {
    const c = cmds.get(id);
    if (!c) return false;
    try {
      const r = c.run(opts);
      if (r?.catch) r.catch((e) => win.console.error(`[rigel] komut hatası (${id})`, e));
    } catch (e) {
      win.console.error(`[rigel] komut hatası (${id})`, e);
    }
    return true;
  }

  return { register, unregister, list, run, get: (id) => cmds.get(id), suppressConflicts };
}
