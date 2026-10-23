// ==UserScript==
// @name           Rigel marka (arka plan)
// @description    Uygulama başına bir kez, ilk pencereden önce: marka adı, logolar, yeni sekme, ayar sayfası stilleri
// ==/UserScript==

// fx-autoconfig bu dosyayı (.sys.mjs) açılışta, pencere yokken bir kez yükler. Derleme olmadan
// Firefox markasını şu yollarla değiştiriyoruz:
//  1. branding/chrome.manifest: chrome://rigel/ paketi + chrome://branding/ logo ve brand.properties
//     dosyalarının "override" ile yerine geçmesi.
//  2. Fluent: brand.ftl ve brandings.ftl'in yamalı kopyaları profilde üretilir ve "app" metakaynağına
//     ayrı bir L10nFileSource olarak kaydedilir. Aynı metakaynakta son kaydedilen kaynak önce gelir,
//     bu yüzden -brand-short-name vb. "Rigel" olur (pencere başlığı, menüler, ayarlar, hata sayfaları).
//  3. Yeni sekme ve ana sayfa: AboutNewTab.newTabURL -> chrome://rigel/content/newtab/newtab.html.
//  4. about:preferences için kullanıcı stil dosyası (yönetim afişi, "Mozilla'dan daha fazlası").

import { FileUtils } from "resource://gre/modules/FileUtils.sys.mjs";
import { NetUtil } from "resource://gre/modules/NetUtil.sys.mjs";

export const NEWTAB_URL = "chrome://rigel/content/newtab/newtab.html";
const BRAND = "Rigel";
const TRADEMARK = {
  tr: "Rigel, Mozilla Firefox üzerine kuruludur. Firefox adı ve logoları Mozilla Vakfının tescilli markalarıdır.",
  "en-US": "Rigel is built on Mozilla Firefox. Firefox and the Firefox logos are trademarks of the Mozilla Foundation.",
};
// brandings.ftl içinde yalnız tarayıcının kendi özelliklerini adlandıran terimler değişir.
// Mozilla'nın ayrı hizmetleri (Monitor, Relay, VPN, Send) olduğu gibi kalır; zaten gizleniyorlar.
const FEATURE_TERMS = new Set([
  "-firefox-suggest-brand-name",
  "-firefox-home-brand-name",
  "-firefoxview-brand-name",
  "-firefoxlabs-brand-name",
  "-screenshots-brand-name",
  "-profiler-brand-name",
  "-translations-brand-name",
]);

const log = msg => dump(`[rigel-brand] ${msg}\n`);

function chromeFile(spec) {
  const reg = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistry);
  const uri = reg.convertChromeURL(Services.io.newURI(spec));
  return uri.QueryInterface(Ci.nsIFileURL).file;
}

function readURI(spec) {
  const channel = NetUtil.newChannel({ uri: spec, loadUsingSystemPrincipal: true });
  const stream = channel.open();
  try {
    return NetUtil.readInputStreamToString(stream, stream.available(), { charset: "UTF-8" });
  } finally {
    stream.close();
  }
}

function writeIfChanged(path, text) {
  const file = new FileUtils.File(path);
  if (file.exists()) {
    try {
      if (readURI(PathUtils.toFileURI(path)) === text) return;
    } catch {}
  }
  if (!file.parent.exists()) file.parent.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
  const out = FileUtils.openFileOutputStream(file);
  const conv = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
  conv.init(out, "UTF-8");
  conv.writeString(text);
  conv.close();
}

// Fluent satırlarını yamalar. replace(id, value) yeni değeri ya da null (dokunma) döndürür.
// Değiştirilen bir iletinin girintili devam satırları (seçiciler) atılır.
function patchFtl(text, replace) {
  const out = [];
  let skipping = false;
  for (const line of text.split("\n")) {
    if (skipping && /^\s+\S/.test(line)) continue;
    skipping = false;
    const m = line.match(/^(-?[A-Za-z][\w-]*)\s*=\s*(.*)$/);
    const value = m ? replace(m[1], m[2]) : null;
    if (value == null) {
      out.push(line);
      continue;
    }
    out.push(`${m[1]} = ${value}`);
    skipping = true;
  }
  return out.join("\n");
}

function brandValue(locale) {
  return (id, value) => {
    if (/^-brand-[\w-]+$/.test(id) || id === "-vendor-short-name" || /^brand\w*Name$/.test(id)) return BRAND;
    if (id === "trademarkInfo") return TRADEMARK[locale] ?? TRADEMARK["en-US"];
    return null;
  };
}

function featureValue(id, value) {
  if (!FEATURE_TERMS.has(id) || !value.includes("Firefox")) return null;
  return value.replaceAll("Firefox", BRAND);
}

// Türkçe ekler (Rigel’i, Rigel’de...): Firefox sözcüğüne göre yazılmış ekleri marka adına uydurur.
const SUFFIX_LOCALES = new Set(["tr"]);
const L10N_URL = "chrome://userscripts/content/l10n/";

const SKIP_DIRS = /^(devtools|preview|crashreporter)\//;
// Sürüm + betik değişince yeniden üretilir; aksi halde açılışta yalnızca kayıt yapılır.
const STAMP_VERSION = 1;

function mtime(spec) {
  try {
    return chromeFile(spec).lastModifiedTime;
  } catch {
    return 0;
  }
}

// omni.ja içindeki yerel .ftl dosyalarının yolları: [{ rel, base }] (base: "app" | "gre")
function listLocaleFtl(locale) {
  const out = [];
  const zr = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
  const bases = [
    ["gre", Services.dirsvc.get("GreD", Ci.nsIFile)],
    ["app", Services.dirsvc.get("GreD", Ci.nsIFile)],
  ];
  bases[0][1].append("omni.ja");
  bases[1][1].append("browser");
  bases[1][1].append("omni.ja");
  for (const [base, file] of bases) {
    if (!file.exists()) continue;
    zr.open(file);
    try {
      const prefix = `localization/${locale}/`;
      for (const entry of zr.findEntries(prefix + "*.ftl")) {
        const rel = entry.slice(prefix.length);
        if (!SKIP_DIRS.test(rel) && !rel.startsWith("branding/") && !rel.startsWith("toolkit/branding/")) out.push({ rel, base });
      }
    } finally {
      zr.close();
    }
  }
  return out;
}

// Bir yerelin yamalı kopyalarını üretir; yazılan dosya yollarını döndürür.
function generateLocale(locale, root, suffixLib, overridesLib) {
  const written = [];
  const put = (rel, text) => {
    const path = PathUtils.join(root, locale, ...rel.split("/"));
    writeIfChanged(path, text);
    written.push(PathUtils.toFileURI(path));
  };
  const brandFiles = [
    ["resource://app/localization/{locale}/branding/brand.ftl", "branding/brand.ftl", brandValue],
    ["resource://gre/localization/{locale}/toolkit/branding/brandings.ftl", "toolkit/branding/brandings.ftl", () => featureValue],
  ];
  for (const [src, rel, makePatch] of brandFiles) {
    try {
      put(rel, patchFtl(readURI(src.replace("{locale}", locale)), makePatch(locale)));
    } catch {}
  }
  if (!SUFFIX_LOCALES.has(locale)) return written;
  const overrides = overridesLib.FTL_OVERRIDES[locale] ?? {};
  let scanned = 0;
  for (const { rel, base } of listLocaleFtl(locale)) {
    const own = overrides[rel];
    let text;
    try {
      text = readURI(`resource://${base}/localization/${locale}/${rel}`);
    } catch {
      continue;
    }
    scanned++;
    // Hızlı ön süzgeç: terimden sonra kesme işareti yoksa ve geçersiz kılma yoksa dokunma.
    if (!own && !/\}[’']/.test(text)) continue;
    const fixed = suffixLib.fixSuffixes(text, suffixLib.BRAND_TERM, BRAND);
    let out = fixed.text;
    if (own) out = patchFtl(out, id => (id in own ? own[id] : null));
    if (fixed.count || out !== text) put(rel, out);
  }
  log(`Fluent ${locale}: ${scanned} dosya tarandı, ${written.length} yamalı kopya`);
  return written;
}

// Sabit "Firefox" geçen .properties dizelerini (ağ hata sayfaları) yamalı kopyalarla chrome override ederiz.
function generateProperties(root, suffixLib, overridesLib) {
  const lines = ["# Rigel: üretilmiş dosya (branding.sys.mjs)"];
  const lang = Services.locale.appLocaleAsLangTag.split("-")[0];
  for (const [spec, name] of Object.entries(overridesLib.PROPERTIES_PATCH)) {
    let text;
    try {
      text = readURI(spec);
    } catch {
      continue;
    }
    if (SUFFIX_LOCALES.has(lang)) text = suffixLib.fixSuffixes(text, "Firefox", BRAND).text;
    writeIfChanged(PathUtils.join(root, "props", name), text.replaceAll("Firefox", BRAND));
    lines.push(`override ${spec} props/${name}`);
  }
  writeIfChanged(PathUtils.join(root, "chrome.manifest"), lines.join("\n") + "\n");
}

function registerFluent() {
  const t0 = ChromeUtils.now();
  const root = PathUtils.join(Services.dirsvc.get("UChrm", Ci.nsIFile).path, "rigel-l10n");
  const stampPath = PathUtils.join(root, "stamp.json");
  const key = [
    STAMP_VERSION,
    Services.appinfo.version,
    Services.appinfo.appBuildID,
    Services.locale.availableLocales.join(","),
    mtime("chrome://userscripts/content/branding.sys.mjs"),
    Services.locale.appLocaleAsLangTag,
    mtime(L10N_URL + "suffix.mjs"),
    mtime(L10N_URL + "overrides.mjs"),
  ].join("|");

  let stamp = null;
  try {
    stamp = JSON.parse(readURI(PathUtils.toFileURI(stampPath)));
  } catch {}
  let cached = !!stamp && stamp.key === key;
  if (!cached) {
    const suffixLib = ChromeUtils.importESModule(L10N_URL + "suffix.mjs");
    const overridesLib = ChromeUtils.importESModule(L10N_URL + "overrides.mjs");
    const locales = [];
    const index = [];
    for (const locale of Services.locale.availableLocales) {
      const written = generateLocale(locale, root, suffixLib, overridesLib);
      if (written.length) {
        locales.push(locale);
        index.push(...written);
      }
    }
    generateProperties(root, suffixLib, overridesLib);
    stamp = { key, locales, index };
    writeIfChanged(stampPath, JSON.stringify(stamp));
  }
  try {
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(new FileUtils.File(PathUtils.join(root, "chrome.manifest")));
  } catch (e) {
    log(`properties override: ${e}`);
  }
  const { locales, index } = stamp;
  if (!locales.length) return log("Fluent: kaynak bulunamadı");
  const prePath = PathUtils.toFileURI(root) + "/{locale}/";
  const registry = L10nRegistry.getInstance();
  let source;
  try {
    source = new L10nFileSource("rigel-branding", "app", locales, prePath, {}, index);
  } catch {
    source = new L10nFileSource("rigel-branding", "app", locales, prePath);
  }
  if (registry.hasSource("rigel-branding")) registry.updateSources([source]);
  else registry.registerSources([source]);
  log(`Fluent: ${index.length} dosya, ${cached ? "önbellekten" : "üretildi"}, ${(ChromeUtils.now() - t0).toFixed(1)} ms`);
}

function registerChrome() {
  const manifest = chromeFile("chrome://userscripts/content/branding/chrome.manifest");
  Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(manifest);
}

function registerSheets() {
  const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  const uri = Services.io.newURI("chrome://rigel-branding/content/prefs.css");
  if (!sss.sheetRegistered(uri, sss.USER_SHEET)) sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
}

function setNewTab() {
  const { AboutNewTab } = ChromeUtils.importESModule("resource:///modules/AboutNewTab.sys.mjs");
  AboutNewTab.newTabURL = NEWTAB_URL;
}

// Rigel'de anlamsız Mozilla hizmeti tercihleri (varsayılan dal; kullanıcı değeri üstün gelir).
function setDefaultPrefs() {
  const { DEFAULT_PREFS } = ChromeUtils.importESModule(L10N_URL + "overrides.mjs");
  const branch = Services.prefs.getDefaultBranch("");
  for (const [name, value] of Object.entries(DEFAULT_PREFS)) {
    if (typeof value === "string") branch.setCharPref(name, value);
    else if (typeof value === "boolean") branch.setBoolPref(name, value);
    else branch.setIntPref(name, value);
  }
}

for (const [name, fn] of Object.entries({ registerChrome, registerFluent, registerSheets, setNewTab, setDefaultPrefs })) {
  try {
    fn();
  } catch (e) {
    log(`${name}: ${e}\n${e.stack ?? ""}`);
  }
}
