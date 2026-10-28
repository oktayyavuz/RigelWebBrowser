// Modları birbirinden ayırt etmek için ortak arayüz parçaları (mağaza + Ayarlar › Modlar):
// kategori (simge + renk noktası), tek satır özet, 5 düzen uyumluluk göstergesi, "şu anki düzende etkisi yok" notu.
// Alanlar (category, summary, layouts, conflicts) mod.json / index.json'dan gelir (mods/STORE.md); yoksa zarifçe düşer:
// kategori yoksa "Diğer", özet yoksa açıklamanın ilk cümlesi, layouts yoksa 5 düzenin hepsi.
import { h, getPref, chromeWin } from "../settings/ui.mjs";

const SVGNS = "http://www.w3.org/2000/svg";
const { CATEGORIES: CATS } = ChromeUtils.importESModule("chrome://userscripts/content/mods/store.sys.mjs");

const CAT_STYLE = {
  renk: { color: "#e86fa8", icon: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.3-1.6-1.3-2.8 0-.9.7-1.5 1.6-1.5h2.2a4.2 4.2 0 0 0 4.2-4.2C20.5 6.6 16.7 3.5 12 3.5z"/><path d="M7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01"/>' },
  cam: { color: "#5cc8e0", icon: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 15.5l7.5-7.5M8 11l3-3"/>' },
  animasyon: { color: "#f2a06b", icon: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4L18 18M18 6l-2.6 2.6M8.6 15.4L6 18"/>' },
  sekme: { color: "#7c9cff", icon: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M8 6V4.5"/>' },
  arac: { color: "#a98bff", icon: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M7.5 12h6"/>' },
  davranis: { color: "#4fbf8f", icon: '<path d="M13 3.5L5.5 13H12l-1 7.5L18.5 11H12z"/>' },
  sayfa: { color: "#e2c35a", icon: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.7 2.5 13.3 0 16M12 4c-2.5 2.7-2.5 13.3 0 16"/>' },
  duzen: { color: "#8fa6c4", icon: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9h17M9 9v10.5"/>' },
  diger: { color: "#8a8f98", icon: '<path d="M6.5 12h.01M12 12h.01M17.5 12h.01"/>' },
};
/** Sıralı kategori listesi: { id, label, color, icon } (son öğe "Diğer"). */
export const CATEGORIES = [...CATS.map(([id, label]) => ({ id, label, ...CAT_STYLE[id] })), { id: "diger", label: "Diğer", ...CAT_STYLE.diger }];
export const catInfo = id => CATEGORIES.find(c => c.id === id) ?? CATEGORIES.at(-1);

// Gösterge sırası (kullanıcının düzen seçicisindeki sıradan bağımsız, sabit).
export const LAYOUT_ORDER = ["klasik", "yanpanel", "ada", "dock", "komuta"];
export const LAYOUT_NAMES = { klasik: "Klasik", yanpanel: "Yan Panel", ada: "Ada", dock: "Dock", komuta: "Komuta" };
// 16×12 küçük düzen çizimleri: pencere çerçevesi + düzenin ayırt edici parçası.
const GLYPH = {
  klasik: '<rect x="2" y="2" width="12" height="3" rx=".8"/>',
  yanpanel: '<rect x="2" y="2" width="3.6" height="8" rx=".8"/>',
  ada: '<rect x="5" y="2.2" width="6" height="2.6" rx="1.3"/>',
  dock: '<rect x="4" y="7.3" width="8" height="2.6" rx="1.3"/>',
  komuta: '<rect x="5" y="4.7" width="6" height="2.6" rx="1"/>',
};

function svg(inner, { w = 24, h: hh = 24, size = 14, stroke = true } = {}) {
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("viewBox", `0 0 ${w} ${hh}`);
  s.setAttribute("width", size * (w / hh));
  s.setAttribute("height", size);
  s.setAttribute("aria-hidden", "true");
  if (stroke) {
    s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.8");
    s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  }
  s.innerHTML = inner;
  return s;
}
export const catIcon = (id, size = 14) => svg(catInfo(id).icon, { size });

// ---- alanlar (geri düşüşlü) ----
/** Kurulu mod meta + (varsa) katalog girdisi → görünüm alanları. Kurulu meta önceliklidir. */
export function view(meta, entry) {
  const m = meta ?? {};
  const e = entry ?? {};
  const category = m.category || e.category || "diger";
  const desc = m.description || e.description || "";
  return {
    category,
    summary: m.summary || e.summary || firstSentence(desc),
    hasSummary: !!(m.summary || e.summary),
    conflicts: (m.conflicts?.length ? m.conflicts : e.conflicts) ?? [],
  };
}
export function firstSentence(t) {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  const one = (s.match(/^.+?[.!?](?=\s|$)/) ?? [s])[0];
  return one.length > 90 ? one.slice(0, 89).trimEnd() + "…" : one;
}
/**
 * Modun gerçekten çalıştığı düzenler. `layouts` varsa o; yoksa yalnız `chrome.<düzen>.css` dosyası olan (genel
 * chrome.css'i ve betiği olmayan) bir arayüz modu yalnız o düzenlerde etkilidir; aksi halde 5'i de.
 * x: { target, layouts, script } ; files: { chrome: bool, layoutKeys: [...] } (bilinmiyorsa null).
 */
export function layoutsOf(x, files = null) {
  if (x?.layouts?.length) return LAYOUT_ORDER.filter(l => x.layouts.includes(l));
  if (files && x?.target === "chrome" && !files.chrome && !x.script && files.layoutKeys?.length) return LAYOUT_ORDER.filter(l => files.layoutKeys.includes(l));
  return [...LAYOUT_ORDER];
}
/** Katalog girdisinin dosya bilgisi (layoutsOf için). */
export const entryFiles = e => ({ chrome: !!e.files?.["chrome.css"], layoutKeys: LAYOUT_ORDER.filter(l => e.files?.[`chrome.${l}.css`]) });
/** Kurulu modun dosya bilgisi (Mods.get sonucu). */
export const modFiles = got => got ? { chrome: !!got.chrome?.trim(), layoutKeys: Object.keys(got.layoutCss ?? {}).filter(k => got.layoutCss[k]?.trim()) } : null;

/** Şu anki düzen: tarayıcı penceresinin kök özniteliği, yoksa rigel.layout tercihi. */
export function currentLayout() {
  const pref = String(getPref("rigel.layout", "") || "");
  if (LAYOUT_ORDER.includes(pref)) return pref;
  const a = chromeWin()?.document?.documentElement?.getAttribute("data-rigel-layout");
  return LAYOUT_ORDER.includes(a) ? a : "yanpanel";
}

// ---- parçalar ----
export function catBadge(id, cls = "") {
  const c = catInfo(id);
  return h("span", { class: "rgcat " + cls, style: `--cat:${c.color}`, title: "Kategori: " + c.label }, catIcon(id, 12), c.label);
}
/** 5 düzenlik gösterge: çalıştığı düzenler dolu, diğerleri soluk; şu anki düzen çerçeveli. */
export function layoutMeter(layouts, cur = currentLayout()) {
  const all = layouts.length === LAYOUT_ORDER.length;
  const box = h("span", { class: "rglm", role: "img", "aria-label": all ? "Tüm düzenlerde çalışır" : "Çalıştığı düzenler: " + layouts.map(l => LAYOUT_NAMES[l]).join(", ") });
  for (const l of LAYOUT_ORDER) {
    const on = layouts.includes(l);
    const s = svg(`<rect x=".75" y=".75" width="14.5" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><g fill="currentColor">${GLYPH[l]}</g>`, { w: 16, h: 12, size: 11, stroke: false });
    box.append(h("span", { class: "g" + (on ? " on" : "") + (l === cur ? " cur" : ""), title: `${LAYOUT_NAMES[l]}: ${on ? "çalışır" : "etkisi yok"}${l === cur ? " (şu anki düzen)" : ""}` }, s));
  }
  return box;
}
/** Mevcut düzende etkisizse not (yoksa null). */
export function inertNote(layouts, cur = currentLayout()) {
  if (layouts.includes(cur)) return null;
  return h("span", { class: "rginert", title: "Çalıştığı düzenler: " + layouts.map(l => LAYOUT_NAMES[l]).join(", ") }, `Şu anki düzeninde (${LAYOUT_NAMES[cur]}) etkisi yok`);
}
export const codeBadge = (bundled = true) => h("span", { class: "tbadge script" + (bundled ? " soft" : ""), title: bundled ? "Rigel ile gelen sınırlı bir betik çalıştırır" : "Bu mod kod çalıştırır (tam yetki)" }, "Kod çalıştırır");

// ---- ortak stil (store.css ve settings.css'e dokunmadan; belge başına bir kez) ----
export function ensureStyle(doc = document) {
  if (doc.getElementById("rigel-modmeta-style")) return;
  doc.head.append(h("style", { id: "rigel-modmeta-style", text: `
    .rgcat { --cat: #8a8f98; display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px 0 6px; border-radius: 10px; font-size: 11.5px; font-weight: 600; white-space: nowrap;
      color: color-mix(in srgb, var(--cat) 78%, var(--text, #eee)); background: color-mix(in srgb, var(--cat) 15%, var(--surface, #222)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cat) 30%, transparent); }
    .rgcat svg { flex: none; }
    .rglm { display: inline-flex; gap: 3px; align-items: center; vertical-align: middle; }
    .rglm .g { display: inline-grid; place-items: center; width: 17px; height: 15px; border-radius: 4px; color: var(--text-faint, #888); opacity: .38; }
    .rglm .g.on { color: var(--accent, #7c9cff); opacity: 1; }
    .rglm .g.cur { box-shadow: inset 0 0 0 1px var(--border-2, #555); opacity: 1; }
    .rglm .g.cur:not(.on) { color: var(--danger, #e5484d); }
    .rginert { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: color-mix(in srgb, #f2a06b 80%, var(--text, #eee)); }
    .rginert::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #f2a06b; flex: none; }
    .rgconf { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--danger, #e5484d); }
    .rgconf::before { content: "!"; display: inline-grid; place-items: center; width: 14px; height: 14px; border-radius: 50%; background: var(--danger, #e5484d); color: var(--on-danger, #fff); font-size: 10px; font-weight: 700; flex: none; }
    .rgsum { font-weight: 600; color: var(--text, #eee); }
    .tbadge.script.soft { background: var(--hover, #333); color: var(--text-dim, #aaa); }
    .chip .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--cat); flex: none; }
    .chip.cat svg { color: color-mix(in srgb, var(--cat) 80%, var(--text, #eee)); flex: none; }
    .chip.cat.on { border-color: color-mix(in srgb, var(--cat) 60%, transparent); background: color-mix(in srgb, var(--cat) 14%, var(--surface, #222)); }
  ` }));
}
