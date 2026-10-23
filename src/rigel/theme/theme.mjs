// Tema ve vurgu rengi: rigel.theme (dark|light|system) ve rigel.accent (rigel|violet|green|orange|pink|teal|indigo|red|amber|lime|slate).
// Her pencere init(win) ile kurulur; tercihler canlı izlenir, yeniden başlatma gerekmez.
// Kökte data-rigel-theme her zaman çözülmüş değerdir (dark|light); "system" ise sistem tercihini izler.
// Firefox'un kendi yüzeyleri (menüler, paneller, adres çubuğu açılırı) ve içerik sayfaları
// (about:, web sitelerinin prefers-color-scheme'i) için ilgili Firefox tercihleri de eşlenir.

const THEME_PREF = "rigel.theme";
const ACCENT_PREF = "rigel.accent";
export const THEMES = ["dark", "light", "system"];
export const ACCENTS = ["rigel", "violet", "green", "orange", "pink", "teal", "indigo", "red", "amber", "lime", "slate"];
const THEME_LABEL = { dark: "koyu", light: "açık", system: "sistem" };
const ACCENT_LABEL = { rigel: "Rigel", violet: "Mor", green: "Yeşil", orange: "Turuncu", pink: "Pembe", teal: "Turkuaz", indigo: "Çivit", red: "Kırmızı", amber: "Kehribar", lime: "Fıstık", slate: "Gri" };
// browser.theme.toolbar-theme / content-theme ve layout.css.prefers-color-scheme.content-override
// aynı kodlamayı kullanır: 0 koyu, 1 açık, 2 sistem.
const FX_CODE = { dark: 0, light: 1, system: 2 };

const norm = (v, list, def) => (list.includes(v) ? v : def);
const readTheme = () => norm(Services.prefs.getStringPref(THEME_PREF, "dark"), THEMES, "dark");
const readAccent = () => norm(Services.prefs.getStringPref(ACCENT_PREF, "rigel"), ACCENTS, "rigel");

/** Firefox'un kendi yüzeylerini seçilen temaya hizalar (idempotent; her pencere çağırabilir). */
export function syncFirefoxPrefs(theme = readTheme()) {
  const P = Services.prefs;
  const code = FX_CODE[theme];
  for (const name of ["browser.theme.toolbar-theme", "browser.theme.content-theme", "layout.css.prefers-color-scheme.content-override"]) {
    if (P.getIntPref(name, -1) !== code) P.setIntPref(name, code);
  }
}

export function init(win) {
  const doc = win.document;
  const root = doc.documentElement;
  const mq = win.matchMedia("(prefers-color-scheme: dark)");
  const Rigel = (win.Rigel ??= {});

  function resolved(theme) {
    return theme === "system" ? (mq.matches ? "dark" : "light") : theme;
  }
  function apply() {
    const theme = readTheme();
    syncFirefoxPrefs(theme);
    const r = resolved(theme);
    if (root.getAttribute("data-rigel-theme") !== r) root.setAttribute("data-rigel-theme", r);
    const accent = readAccent();
    if (root.getAttribute("data-rigel-accent") !== accent) root.setAttribute("data-rigel-accent", accent);
    win.dispatchEvent(new CustomEvent("rigel:theme-changed", { detail: { theme, resolved: r, accent } }));
  }

  const observer = { observe: apply };
  Services.prefs.addObserver(THEME_PREF, observer);
  Services.prefs.addObserver(ACCENT_PREF, observer);
  mq.addEventListener("change", apply);

  Rigel.theme = {
    themes: () => [...THEMES],
    accents: () => [...ACCENTS],
    get: () => readTheme(),
    resolved: () => resolved(readTheme()),
    set(name) {
      if (!THEMES.includes(name)) throw new Error(`bilinmeyen tema: ${name}`);
      Services.prefs.setStringPref(THEME_PREF, name);
    },
    toggle() {
      this.set(resolved(readTheme()) === "dark" ? "light" : "dark");
    },
    accent: () => readAccent(),
    setAccent(name) {
      if (!ACCENTS.includes(name)) throw new Error(`bilinmeyen vurgu: ${name}`);
      Services.prefs.setStringPref(ACCENT_PREF, name);
    },
  };

  // Komut paleti kayıtları (B'nin modülü hangi sırada yüklenirse yüklensin).
  let registered = false;
  function registerCommands() {
    const reg = win.Rigel?.commands?.register;
    if (!reg || registered) return;
    registered = true;
    try {
      reg({ id: "theme.toggle", label: "Temayı değiştir", icon: "moon", run: () => Rigel.theme.toggle() });
      for (const t of THEMES) {
        reg({ id: `theme.${t}`, label: `Tema: ${THEME_LABEL[t]}`, icon: "moon", run: () => Rigel.theme.set(t) });
      }
      for (const a of ACCENTS) {
        reg({ id: `accent.${a}`, label: `Vurgu rengi: ${ACCENT_LABEL[a]}`, icon: "star", run: () => Rigel.theme.setAccent(a) });
      }
    } catch (e) {
      dump(`[rigel] tema komutları kaydedilemedi: ${e}\n`);
    }
  }
  win.addEventListener("rigel:components-ready", registerCommands);
  registerCommands();

  apply();

  win.addEventListener("unload", () => {
    Services.prefs.removeObserver(THEME_PREF, observer);
    Services.prefs.removeObserver(ACCENT_PREF, observer);
    mq.removeEventListener("change", apply);
  }, { once: true });
  return registerCommands;
}
