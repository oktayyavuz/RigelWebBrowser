// Görünüm stüdyosu çekirdeği: tek tercih `rigel.look` (JSON) → kök öğede CSS değişkenleri.
// Pencerelerde init(win) (rigel.uc.mjs), chrome://rigel sayfalarında initPage(document) (theme/page.mjs).
// `{}` bugünkü görünümdür: yalnız JSON'da bulunan anahtarlar değişken/öznitelik yazar, CSS'teki
// `var(--rigel-…, eski değer)` yedekleri geri kalanını taşır.
//
// Şema: { radius 0–20, density "sıkı|normal|ferah", font "system|inter|noto|mono|<ad>", fontSize 11–15,
//         glass 0–100, shadow 0–3, bg { type "none|solid|gradient", color, from, to, angle },
//         accentCustom "#rrggbb", tabStyle "kart|hap|çizgi|düz", tabWidth 120–320 }

export const PREF = "rigel.look";
export const UNDO_PREF = "rigel.look.undo";
export const PACKS_PREF = "rigel.look.packs";
export const STUDIO_ID = "studyo";

export const DEFAULTS = {
  radius: 9, density: "normal", font: "system", fontSize: 13, glass: 0, shadow: 1,
  bg: { type: "none", color: "#101624", from: "#1d3557", to: "#0c0f16", angle: 160 },
  accentCustom: "", tabStyle: "kart", tabWidth: 220,
};
export const DENSITIES = ["sıkı", "normal", "ferah"];
export const TAB_STYLES = ["kart", "hap", "çizgi", "düz"];
export const FONTS = {
  system: ["Sistem", 'system-ui, "Noto Sans", sans-serif'],
  inter: ["Inter", '"Inter", system-ui, sans-serif'],
  noto: ["Noto Sans", '"Noto Sans", system-ui, sans-serif'],
  mono: ["JetBrains Mono", '"JetBrains Mono", ui-monospace, monospace'],
};
// Öznitelik değerleri ASCII (CSS seçicileri için).
const ASCII = { "çizgi": "cizgi", "düz": "duz", "sıkı": "siki" };
const FROM_ASCII = { cizgi: "çizgi", duz: "düz", siki: "sıkı" };

// Yoğunluk: [boşluk, Klasik şerit, Klasik sekme, Klasik araç çubuğu, adres yüksekliği, dikey satır, yer imi]
const DENSITY = {
  "sıkı": [5, 34, 28, 38, 28, 29, 28],
  normal: [8, 40, 34, 44, 32, 34, 32],
  ferah: [11, 46, 40, 50, 36, 39, 36],
};

const clamp = (v, lo, hi, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def;
};
const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v, def) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : def);

/** JSON'u doğrular; yalnız geçerli ve bilinen anahtarları döndürür (eksik anahtar = varsayılan). */
export function normalize(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  if ("radius" in raw) out.radius = clamp(raw.radius, 0, 20, 9);
  if ("density" in raw) {
    const d = FROM_ASCII[raw.density] ?? raw.density;
    if (DENSITIES.includes(d)) out.density = d;
  }
  if (typeof raw.font === "string" && raw.font.trim()) out.font = raw.font.trim().slice(0, 60);
  if ("fontSize" in raw) out.fontSize = clamp(raw.fontSize, 11, 15, 13);
  if ("glass" in raw) out.glass = clamp(raw.glass, 0, 100, 0);
  if ("shadow" in raw) out.shadow = clamp(raw.shadow, 0, 3, 1);
  if (raw.bg && typeof raw.bg === "object" && ["solid", "gradient", "none"].includes(raw.bg.type)) {
    const b = raw.bg, D = DEFAULTS.bg;
    out.bg = { type: b.type, color: hex(b.color, D.color), from: hex(b.from, D.from), to: hex(b.to, D.to), angle: clamp(b.angle, 0, 360, D.angle) };
  }
  if (hex(raw.accentCustom, "")) out.accentCustom = hex(raw.accentCustom, "");
  if ("tabStyle" in raw) {
    const t = FROM_ASCII[raw.tabStyle] ?? raw.tabStyle;
    if (TAB_STYLES.includes(t)) out.tabStyle = t;
  }
  if ("tabWidth" in raw) out.tabWidth = clamp(raw.tabWidth, 120, 320, 220);
  return out;
}

export function read() {
  try {
    return normalize(JSON.parse(Services.prefs.getStringPref(PREF, "{}") || "{}"));
  } catch {
    return {};
  }
}
export function write(look) {
  const s = JSON.stringify(normalize(look));
  if (Services.prefs.getStringPref(PREF, "{}") !== s) Services.prefs.setStringPref(PREF, s);
}
/** Var olan görünümün üstüne yazar; `undefined` değerli anahtar silinir (varsayılana döner). */
export function patch(changes) {
  const cur = read();
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) delete cur[k];
    else cur[k] = v;
  }
  write(cur);
}

function luminance(h) {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const fontStack = f => FONTS[f]?.[1] ?? `"${f.replace(/["\\;{}<>]/g, "")}", system-ui, sans-serif`;

/** Görünümden { vars: {--ad: değer}, attrs: {öznitelik: değer} } üretir. Maketler de bunu kullanır. */
export function compute(raw) {
  const look = normalize(raw);
  const vars = {};
  const attrs = {};
  if ("radius" in look) {
    const r = look.radius;
    vars["--rigel-radius"] = `${r}px`;
    vars["--rigel-radius-sm"] = `${Math.round((r * 7) / 9)}px`;
    vars["--rigel-pill-radius"] = r <= 4 ? `${r}px` : "999px";
  }
  if (look.density) {
    const [sp, strip, tab, nav, url, row, bm] = DENSITY[look.density];
    Object.assign(vars, {
      "--rigel-space": `${sp}px`, "--rigel-tabbar-h": `${strip}px`, "--rigel-tab-h": `${tab}px`,
      "--rigel-navbar-h": `${nav}px`, "--rigel-urlbar-h": `${url}px`, "--rigel-row-h": `${row}px`,
      "--rigel-bookmarks-height": `${bm}px`,
    });
  }
  if (look.font && look.font !== "system") {
    vars["--font"] = fontStack(look.font);
    attrs["rigel-look-font"] = "";
  }
  if ("fontSize" in look) {
    vars["--rigel-font-size"] = `${look.fontSize}px`;
    attrs["rigel-look-fs"] = "";
  }
  const bg = look.bg?.type && look.bg.type !== "none" ? look.bg : null;
  if (bg) {
    vars["--rigel-bg-image"] = bg.type === "solid"
      ? `linear-gradient(${bg.color}, ${bg.color})`
      : `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`;
  }
  // Cam: arka plan varken şerit varsayılan olarak %70 saydam; arka plan yokken vurgu tonlu bir parıltı belirir.
  const glass = look.glass ?? (bg ? 70 : 0);
  if (glass > 0 || bg) {
    if (!bg) {
      vars["--rigel-bg-image"] = "radial-gradient(120% 160% at 12% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 62%), linear-gradient(var(--bg), var(--bg))";
    }
    attrs["rigel-look-bg"] = "";
    vars["--rigel-glass"] = String(glass / 100);
    vars["--rigel-strip-bg"] = `color-mix(in srgb, var(--bar) ${100 - glass}%, transparent)`;
    if ((look.glass ?? 0) > 0) {
      vars["--rigel-surface-bg"] = `color-mix(in srgb, var(--surface) ${Math.round(100 - glass * 0.5)}%, transparent)`;
      vars["--rigel-glass-filter"] = `blur(${Math.round(6 + glass / 8)}px) saturate(1.4)`;
      attrs["rigel-look-glass"] = "";
    }
  }
  if ("shadow" in look && look.shadow !== 1) attrs["rigel-look-shadow"] = String(look.shadow);
  if (look.accentCustom) {
    const a = look.accentCustom;
    vars["--accent"] = a;
    vars["--accent-2"] = `color-mix(in srgb, ${a} 70%, white)`;
    vars["--accent-ink"] = luminance(a) > 0.36 ? "#08101c" : "#ffffff";
  }
  if (look.tabStyle && look.tabStyle !== "kart") attrs["rigel-tabstyle"] = ASCII[look.tabStyle] ?? look.tabStyle;
  if ("tabWidth" in look) vars["--rigel-tab-width"] = `${look.tabWidth}px`;
  return { vars, attrs };
}

const ALL_ATTRS = ["rigel-look-font", "rigel-look-fs", "rigel-look-bg", "rigel-look-glass", "rigel-look-shadow", "rigel-tabstyle"];
const written = new WeakMap();

/** Değişkenleri ve öznitelikleri öğeye yazar; artık olmayanları kaldırır (başkalarının satır içi stiline dokunmaz). */
export function applyTo(el, look = read()) {
  const { vars, attrs } = compute(look);
  const prev = written.get(el) ?? new Set();
  for (const name of prev) if (!(name in vars)) el.style.removeProperty(name);
  for (const [k, v] of Object.entries(vars)) if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v);
  written.set(el, new Set(Object.keys(vars)));
  for (const a of ALL_ATTRS) {
    if (a in attrs) { if (el.getAttribute(a) !== attrs[a]) el.setAttribute(a, attrs[a]); }
    else if (el.hasAttribute(a)) el.removeAttribute(a);
  }
}

function watchPref(win, fn) {
  const obs = { observe: fn };
  Services.prefs.addObserver(PREF, obs);
  win.addEventListener("unload", () => Services.prefs.removeObserver(PREF, obs), { once: true });
}

/** chrome://rigel sayfaları (theme/page.mjs çağırır). */
export function initPage(doc = document) {
  const apply = () => applyTo(doc.documentElement);
  watchPref(doc.defaultView, apply);
  apply();
}

/** Ayarlar'daki stüdyo bölümünü açar. */
export function openStudio(win) {
  if (win.Rigel?.settings?.open) win.Rigel.settings.open(STUDIO_ID);
  else win.openTrustedLinkIn(`chrome://rigel/content/settings/settings.html#${STUDIO_ID}`, "tab");
}

/** Tarayıcı penceresi (rigel.uc.mjs çağırır). */
export function init(win) {
  const root = win.document.documentElement;
  const apply = () => {
    applyTo(root);
    win.dispatchEvent(new CustomEvent("rigel:look-changed"));
  };
  watchPref(win, apply);
  // Hazır vurgu rengi seçilince özel vurgu bırakılır (yoksa satır içi --accent seçimi gölgeler).
  const accentObs = {
    observe() {
      const cur = read();
      if (cur.accentCustom) { delete cur.accentCustom; write(cur); }
    },
  };
  Services.prefs.addObserver("rigel.accent", accentObs);
  win.addEventListener("unload", () => Services.prefs.removeObserver("rigel.accent", accentObs), { once: true });
  apply();

  const Rigel = (win.Rigel ??= {});
  Rigel.look = { get: read, set: write, patch, openStudio: () => openStudio(win) };

  let registered = false;
  async function registerCommands() {
    const reg = win.Rigel?.commands?.register;
    if (!reg || registered) return;
    registered = true;
    try {
      reg({ id: "look.studio", label: "Görünüm stüdyosu", icon: "brush", run: () => openStudio(win) });
      reg({ id: "look.reset", label: "Görünümü varsayılana döndür", icon: "brush", run: () => write({}) });
      const packs = await import("chrome://userscripts/content/theme/packs.mjs");
      for (const p of packs.allPacks()) {
        reg({ id: `look.pack.${p.id}`, label: `Tema paketi: ${p.name}`, icon: "brush", run: () => packs.applyPack(p) });
      }
      reg({ id: "look.pack.undo", label: "Tema paketini geri al", icon: "undo", run: () => packs.undo() });
    } catch (e) {
      dump(`[rigel] görünüm komutları kaydedilemedi: ${e}\n`);
    }
  }
  win.addEventListener("rigel:components-ready", registerCommands);
  registerCommands();
  return registerCommands;
}
