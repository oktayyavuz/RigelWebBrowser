// Görünüm stüdyosu çekirdeği: tek tercih `rigel.look` (JSON) → kök öğede CSS değişkenleri.
// Pencerelerde init(win) (rigel.uc.mjs), chrome://rigel sayfalarında initPage(document) (theme/page.mjs).
// `{}` bugünkü görünümdür: yalnız JSON'da bulunan anahtarlar değişken/öznitelik yazar, CSS'teki
// `var(--rigel-…, eski değer)` yedekleri geri kalanını taşır.
//
// Şema: { radius 0–20, density "sıkı|normal|ferah", font "system|inter|noto|mono|<ad>", fontSize 11–15,
//         glass 0–100, shadow 0–3, bg { type "none|solid|gradient|image", color, from, to, angle,
//         file (profil/rigel-bg/ içindeki ad), fit "cover|center", blur 0–40, dim 0–80 },
//         accentCustom "#rrggbb", tabStyle "kart|hap|çizgi|düz", tabWidth 120–320,
//         colors { dark|light: { bg, bar, surface, text, textDim, danger, accent } (#rrggbb; temaya göre) },
//         border 0–3 (çizgi kalınlığı px; 0 = ince varsayılan, >0 = düz "mürekkep" çizgiler), shadowStyle "soft|hard"
//         (sert = bulanıksız ofset gölge), heavy bool (kalın yazı) }

export const PREF = "rigel.look";
export const UNDO_PREF = "rigel.look.undo";
export const PACKS_PREF = "rigel.look.packs";
export const STUDIO_ID = "studyo";
export const BUTTONS_PREF = "rigel.look.buttons";
export const AUTO_PREF = "rigel.look.auto";
export const BG_DIR = "rigel-bg";

export const DEFAULTS = {
  radius: 9, density: "normal", font: "system", fontSize: 13, glass: 0, shadow: 1,
  bg: { type: "none", color: "#101624", from: "#1d3557", to: "#0c0f16", angle: 160, file: "", fit: "cover", blur: 0, dim: 30 },
  accentCustom: "", tabStyle: "kart", tabWidth: 220, border: 0, shadowStyle: "soft", heavy: false,
};
export const SHADOW_STYLES = ["soft", "hard"];
// Renk belirteçleri: anahtar → CSS değişkeni. Varsayılanlar tokens.css ile aynı (tema başına).
export const COLOR_KEYS = ["bg", "bar", "surface", "text", "textDim", "danger", "accent"];
// Vurgu (colors[tema].accent) temaya göredir; varsayılanı seçili hazır vurgudur, bu yüzden COLOR_DEFAULTS'ta yok.
export const BRUTAL_ACCENTS = [["#ffe135", "Sinyal sarısı"], ["#3d5afe", "Elektrik mavisi"], ["#ff3ea5", "Pembe"], ["#b8ff3d", "Asit yeşili"], ["#ff5a1f", "Kızıl turuncu"], ["#8b5cf6", "Mor"]];
export const COLOR_VARS = { bg: "--bg", bar: "--bar", surface: "--surface", text: "--text", textDim: "--text-dim", danger: "--danger", accent: "--accent" };
export const COLOR_DEFAULTS = {
  dark: { bg: "#0c0f16", bar: "#0f131c", surface: "#151b27", text: "#e7ebf3", textDim: "#8d96a8", danger: "#e5484d" },
  light: { bg: "#f4f6fa", bar: "#eef1f6", surface: "#ffffff", text: "#141a26", textDim: "#4f5a6c", danger: "#e5484d" },
};
// Renk özelleştirmesiyle türetilen değişkenlerin varsayılanları (maketlerde yalıtım için).
export const TOKEN_DEFAULTS = {
  dark: { "--bg": "#0c0f16", "--bar": "#0f131c", "--surface": "#151b27", "--surface-2": "#1c2433", "--hover": "rgba(255, 255, 255, 0.05)",
    "--border": "rgba(255, 255, 255, 0.07)", "--border-2": "rgba(255, 255, 255, 0.12)", "--text": "#e7ebf3", "--text-dim": "#8d96a8", "--text-faint": "#5a6273",
    "--danger": "#e5484d", "--on-danger": "#ffffff" },
  light: { "--bg": "#f4f6fa", "--bar": "#eef1f6", "--surface": "#ffffff", "--surface-2": "#e6eaf1", "--hover": "rgba(20, 30, 50, 0.06)",
    "--border": "rgba(20, 30, 50, 0.09)", "--border-2": "rgba(20, 30, 50, 0.16)", "--text": "#141a26", "--text-dim": "#4f5a6c", "--text-faint": "#8a93a3",
    "--danger": "#e5484d", "--on-danger": "#ffffff" },
};
export const THEME_KEYS = ["dark", "light"];
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
  if (raw.bg && typeof raw.bg === "object" && ["solid", "gradient", "image", "none"].includes(raw.bg.type)) {
    const b = raw.bg, D = DEFAULTS.bg;
    out.bg = { type: b.type, color: hex(b.color, D.color), from: hex(b.from, D.from), to: hex(b.to, D.to), angle: clamp(b.angle, 0, 360, D.angle) };
    const file = bgFileName(b.file);
    if (file) Object.assign(out.bg, { file, fit: b.fit === "center" ? "center" : "cover", blur: clamp(b.blur, 0, 40, 0), dim: clamp(b.dim, 0, 80, D.dim) });
    else if (b.type === "image") out.bg.type = "none";
  }
  if (hex(raw.accentCustom, "")) out.accentCustom = hex(raw.accentCustom, "");
  if ("tabStyle" in raw) {
    const t = FROM_ASCII[raw.tabStyle] ?? raw.tabStyle;
    if (TAB_STYLES.includes(t)) out.tabStyle = t;
  }
  if ("tabWidth" in raw) out.tabWidth = clamp(raw.tabWidth, 120, 320, 220);
  if ("border" in raw) out.border = clamp(raw.border, 0, 3, 0);
  if (SHADOW_STYLES.includes(raw.shadowStyle)) out.shadowStyle = raw.shadowStyle;
  if (raw.heavy === true) out.heavy = true;
  if (raw.colors && typeof raw.colors === "object") {
    const colors = {};
    for (const t of THEME_KEYS) {
      const src = raw.colors[t];
      if (!src || typeof src !== "object") continue;
      const c = {};
      for (const k of COLOR_KEYS) if (hex(src[k], "")) c[k] = hex(src[k], "");
      if (Object.keys(c).length) colors[t] = c;
    }
    if (Object.keys(colors).length) out.colors = colors;
  }
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

/** Arka plan görseli: yalnız profil/rigel-bg/ içindeki düz dosya adı (yol yok). */
export function bgFileName(v) {
  return typeof v === "string" && /^[\w][\w.-]{0,90}\.(png|jpe?g|webp|gif|avif)$/i.test(v) ? v : "";
}
/** Bulanık kopya adı (theme/bg.mjs üretir): foto.jpg → foto.b12.jpg */
export const blurName = (file, px) => file.replace(/\.[^.]+$/, `.b${px}.jpg`);
export function bgFileUrl(file) {
  try {
    return PathUtils.toFileURI(PathUtils.join(PathUtils.profileDir, BG_DIR, file));
  } catch {
    return "";
  }
}

export function luminance(h) {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
/** WCAG kontrast oranı (1–21) iki #rrggbb arasında. */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const fontStack = f => FONTS[f]?.[1] ?? `"${f.replace(/["\\;{}<>]/g, "")}", system-ui, sans-serif`;

/** Görünümden { vars: {--ad: değer}, attrs: {öznitelik: değer} } üretir. Maketler de bunu kullanır.
 *  `theme` ("dark" | "light"): renk özelleştirmesinin hangi tema için uygulanacağı. */
export function compute(raw, theme = "dark") {
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
  if (bg?.type === "image") {
    // Katmanlar: karartma, (varsa) önceden bulanıklaştırılmış kopya, özgün görsel. Bulanık kopya yoksa
    // (ör. başka makineden gelen paket) altındaki özgün görsel görünür. Bulanıklık çalışma anında
    // filter ile değil dosyada yapılır: her yerde aynı görünür ve yeniden boyamada maliyet yok.
    const size = bg.fit === "center" ? "center / auto no-repeat" : "center / cover no-repeat";
    const layer = f => `url("${bgFileUrl(f)}") ${size}`;
    const dim = bg.dim / 100;
    vars["--rigel-bg-image"] = [`linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim}))`,
      ...(bg.blur > 0 ? [layer(blurName(bg.file, bg.blur))] : []), layer(bg.file)].join(", ");
    attrs["rigel-look-img"] = "";
  } else if (bg) {
    vars["--rigel-bg-image"] = bg.type === "solid"
      ? `linear-gradient(${bg.color}, ${bg.color})`
      : `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`;
  }
  // Cam: arka plan varken şerit varsayılan olarak %70 saydam; arka plan yokken vurgu tonlu bir parıltı belirir.
  const glass = look.glass ?? (bg ? (bg.type === "image" ? 50 : 70) : 0);
  if (glass > 0 || bg) {
    if (!bg) {
      vars["--rigel-bg-image"] = "radial-gradient(120% 160% at 12% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 62%), linear-gradient(var(--bg), var(--bg))";
    }
    attrs["rigel-look-bg"] = "";
    vars["--rigel-glass"] = String(glass / 100);
    vars["--rigel-strip-bg"] = `color-mix(in srgb, var(--bar) ${100 - glass}%, transparent)`;
    if ((look.glass ?? 0) > 0 || bg?.type === "image") {
      vars["--rigel-surface-bg"] = `color-mix(in srgb, var(--surface) ${Math.round(100 - glass * 0.5)}%, transparent)`;
      vars["--rigel-glass-filter"] = `blur(${Math.round(6 + glass / 8)}px) saturate(1.4)`;
      attrs["rigel-look-glass"] = "";
    }
  }
  if ("shadow" in look && look.shadow !== 1) attrs["rigel-look-shadow"] = String(look.shadow);
  // Renkler: yalnız o temada ayarlanmış olanlar yazılır; türev değişkenler (yüzey-2, çizgiler, soluk yazı)
  // seçilen renklerden karıştırılır ki özel bir zeminde de okunaklı kalsın.
  const col = look.colors?.[theme === "light" ? "light" : "dark"];
  if (col) {
    for (const k of COLOR_KEYS) if (col[k]) vars[COLOR_VARS[k]] = col[k];
    if (col.surface) vars["--surface-2"] = "color-mix(in srgb, var(--surface) 90%, var(--text))";
    if (col.text) {
      vars["--hover"] = "color-mix(in srgb, var(--text) 6%, transparent)";
      vars["--border"] = "color-mix(in srgb, var(--text) 9%, transparent)";
      vars["--border-2"] = "color-mix(in srgb, var(--text) 16%, transparent)";
    }
    if (col.text || col.textDim) vars["--text-faint"] = "color-mix(in srgb, var(--text-dim) 60%, var(--bg))";
    if (col.bg) vars["color-scheme"] = luminance(col.bg) > 0.4 ? "light" : "dark";
    if (col.danger) vars["--on-danger"] = luminance(col.danger) > 0.45 ? "#111111" : "#ffffff";
  }
  // Vurgu: temaya özel (colors[tema].accent) ya da eski genel özel vurgu (accentCustom). Üstündeki yazı kontrasta göre siyah/beyaz.
  const accent = col?.accent || look.accentCustom;
  if (accent) {
    vars["--accent"] = accent;
    vars["--accent-2"] = `color-mix(in srgb, ${accent} 70%, white)`;
    vars["--accent-ink"] = contrast(accent, "#0b0f18") >= contrast(accent, "#ffffff") ? "#0b0f18" : "#ffffff";
  }
  // Çizgiler ve sert gölge ("Brütal"): çizgi/gölge rengi "mürekkep" = yazı rengi (açık temada siyah, koyuda krem).
  // --border/--border-2 düz mürekkep olur (her yerdeki ince çizgiler); kalınlık look.css/tokens.css'te seçilmiş öğelere uygulanır.
  if (look.border) {
    vars["--rigel-bw"] = `${look.border}px`;
    vars["--rigel-ink"] = "var(--text)";
    vars["--border"] = "var(--rigel-ink)";
    vars["--border-2"] = "var(--rigel-ink)";
    attrs["rigel-look-border"] = String(look.border);
  }
  if (look.shadowStyle === "hard") {
    const lvl = look.shadow ?? 1;
    const big = [0, 4, 6, 8][lvl], sm = [0, 3, 4, 5][lvl];
    vars["--rigel-ink"] = "var(--text)";
    // Koyu temada gölge vurgu renginde (koyu zeminde mürekkep rengi görünmez), açıkta mürekkep.
    const sink = theme === "light" ? "var(--rigel-ink)" : "var(--accent)";
    vars["--shadow"] = big ? `${big}px ${big}px 0 ${sink}` : "none";
    vars["--shadow-sm"] = sm ? `${sm}px ${sm}px 0 ${sink}` : "none";
    vars["--rigel-hard-sm"] = vars["--shadow-sm"];
    attrs["rigel-look-hard"] = "";
  }
  if (look.heavy) attrs["rigel-look-bold"] = "";
  if (look.tabStyle && look.tabStyle !== "kart") attrs["rigel-tabstyle"] = ASCII[look.tabStyle] ?? look.tabStyle;
  if ("tabWidth" in look) vars["--rigel-tab-width"] = `${look.tabWidth}px`;
  return { vars, attrs };
}

const ALL_ATTRS = ["rigel-look-border", "rigel-look-hard", "rigel-look-bold", "rigel-look-img", "rigel-look-font", "rigel-look-fs", "rigel-look-bg", "rigel-look-glass", "rigel-look-shadow", "rigel-tabstyle"];
const written = new WeakMap();

/** Değişkenleri ve öznitelikleri öğeye yazar; artık olmayanları kaldırır (başkalarının satır içi stiline dokunmaz). */
export function applyTo(el, look = read()) {
  const { vars, attrs } = compute(look, el.getAttribute("data-rigel-theme") === "light" ? "light" : "dark");
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
  // Renkler temaya göre olduğundan çözülmüş tema (data-rigel-theme) değişince de yeniden yazılır.
  const mo = new win.MutationObserver(fn);
  mo.observe(win.document.documentElement, { attributes: true, attributeFilter: ["data-rigel-theme"] });
  win.addEventListener("unload", () => { Services.prefs.removeObserver(PREF, obs); mo.disconnect(); }, { once: true });
}

/** chrome://rigel sayfaları (theme/page.mjs çağırır). */
export function initPage(doc = document) {
  doc.documentElement.setAttribute("data-rigel-page", "");
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
      let changed = !!cur.accentCustom;
      delete cur.accentCustom;
      for (const t of THEME_KEYS) if (cur.colors?.[t]?.accent) { delete cur.colors[t].accent; changed = true; }
      if (changed) write(cur);
    },
  };
  Services.prefs.addObserver("rigel.accent", accentObs);
  win.addEventListener("unload", () => Services.prefs.removeObserver("rigel.accent", accentObs), { once: true });
  apply();

  const Rigel = (win.Rigel ??= {});
  Rigel.look = { get: read, set: write, patch, openStudio: () => openStudio(win) };

  // Araç düğmeleri: ☰ menüsü CustomizableUI dışında; gizleme yalnız kök özniteliği (look.css).
  const syncButtons = () => {
    let b = {};
    try { b = JSON.parse(Services.prefs.getStringPref(BUTTONS_PREF, "{}")) ?? {}; } catch {}
    root.toggleAttribute("rigel-hide-menu", !!b.hideMenu);
    // Kaldırılamayan düğmeler (geri/ileri/eklentiler) CSS ile gizlenir.
    const ids = Array.isArray(b.hidden) ? b.hidden.filter(x => typeof x === "string" && /^[\w-]{1,80}$/.test(x)) : [];
    let st = win.document.getElementById("rigel-buttons-hidden");
    if (!ids.length) { st?.remove(); return; }
    if (!st) {
      st = win.document.createElementNS("http://www.w3.org/1999/xhtml", "style");
      st.id = "rigel-buttons-hidden";
      root.append(st);
    }
    st.textContent = `${ids.map(x => `#nav-bar #${win.CSS.escape(x)}`).join(", ")} { display: none !important; }`;
  };
  const btnObs = { observe: syncButtons };
  Services.prefs.addObserver(BUTTONS_PREF, btnObs);
  win.addEventListener("unload", () => Services.prefs.removeObserver(BUTTONS_PREF, btnObs), { once: true });
  syncButtons();

  // Palet komutları; kullanıcı paketleri değişince (rigel.look.packs) yeni pencere açmadan güncellenir.
  let registered = false;
  const packIds = new Set();
  let packs = null;
  async function syncPackCommands() {
    const cmds = win.Rigel?.commands;
    if (!cmds?.register || !packs) return;
    const list = packs.allPacks();
    const live = new Set(list.map(p => `look.pack.${p.id}`));
    for (const id of [...packIds]) if (!live.has(id)) { cmds.unregister?.(id); packIds.delete(id); }
    for (const p of list) {
      const id = `look.pack.${p.id}`;
      cmds.register({ id, label: `Tema paketi: ${p.name}`, icon: "brush", run: () => packs.applyPack(p) });
      packIds.add(id);
    }
  }
  async function registerCommands() {
    const reg = win.Rigel?.commands?.register;
    if (!reg || registered) return;
    registered = true;
    try {
      reg({ id: "look.studio", label: "Görünüm stüdyosu", icon: "brush", run: () => openStudio(win) });
      reg({ id: "look.reset", label: "Görünümü varsayılana döndür", icon: "brush", run: () => write({}) });
      packs = await import("chrome://userscripts/content/theme/packs.mjs");
      await syncPackCommands();
      reg({ id: "look.pack.undo", label: "Tema paketini geri al", icon: "undo", run: () => packs.undo() });
      const packsObs = { observe: () => syncPackCommands().catch(e => dump(`[rigel] paket komutları: ${e}\n`)) };
      Services.prefs.addObserver(PACKS_PREF, packsObs);
      win.addEventListener("unload", () => Services.prefs.removeObserver(PACKS_PREF, packsObs), { once: true });
      packs.startAuto(win);
    } catch (e) {
      dump(`[rigel] görünüm komutları kaydedilemedi: ${e}\n`);
    }
  }
  win.addEventListener("rigel:components-ready", registerCommands);
  registerCommands();
  return registerCommands;
}
