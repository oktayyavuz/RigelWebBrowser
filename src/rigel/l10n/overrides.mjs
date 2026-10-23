// Rigel'e özgü Fluent dize geçersiz kılmaları (saf veri). Dosyada olmayan kimlikler sona eklenir. Anahtar: yerel -> kaynak yolu -> ileti kimliği -> yeni gövde.
// Gövde, "kimlik =" sonrasındaki ham FTL'dir; öznitelikler için satır başlayıp ".öznitelik = değer" yazılır.
// Burada yalnızca Firefox/Mozilla'ya ait ve markaya göre otomatik düzelmeyen metinler yer alır.
export const FTL_OVERRIDES = {
  tr: {
    "browser/preferences/preferences.ftl": {
      // Hesaplar kapalı; bu kategoride yalnızca içe aktarma ve yedekleme kalıyor.
      "pane-sync-title3": "İçe aktarma ve yedekleme",
      // Güncelleyici yok (taşınabilir sürüm); kart yalnızca sürüm numarasını gösterir.
      "update-application-heading": "\n    .description = Rigel, Firefox tabanlı bir tarayıcıdır.\n    .label = Rigel sürümü",
      "account-sync-section": "\n    .heading = İçe aktarma ve yedekleme",
      "pane-account-sync-title2": "\n    .title = İçe aktarma ve yedekleme",
    },
    // Yeni kimlik (dosyada yoksa sona eklenir): Helium içe aktarıcısının görünen adı.
    "browser/migrationWizard.ftl": {
      "migration-wizard-migrator-display-name-helium": "Helium",
    },
    "toolkit/about/aboutAddons.ftl": {
      "addon-badge-recommended4": "\n    .title = Güvenlik ve performans standartlarını karşılayan, önerilen uzantı",
    },
  },
};

// Derlenmiş .properties dosyalarında "Firefox" sözcüğü Rigel olur (ek uyumu dahil).
// chrome:// adresi -> üretilen dosya adı
export const PROPERTIES_PATCH = {
  "chrome://global/locale/appstrings.properties": "global-appstrings.properties",
  "chrome://browser/locale/appstrings.properties": "browser-appstrings.properties",
};

// Varsayılan dala yazılan tercihler (kullanıcı değeri her zaman üstün gelir).
export const DEFAULT_PREFS = {
  // "disabled" hâlâ "kullanılabilir" sayılır; listede olmayan değer ayarlar satırını ve alan önerisini gizler.
  "signon.firefoxRelay.feature": "unavailable",
  // Sürüm notları bağlantısı ("Yeni neler var?") yalnız "about:blank" değilse görünür.
  "app.releaseNotesURL": "about:blank",
  "app.releaseNotesURL.aboutDialog": "about:blank",
  // distribution.ini ("Mozilla Firefox Official Build", "mozilla-official - 1.0") satırlarını boşalt.
  "distribution.id": "",
  "distribution.version": "",
  "distribution.about": "",
};
