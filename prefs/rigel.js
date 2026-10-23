// Rigel varsayılan tercihleri. setup.sh/run.sh bunu Firefox'un browser/defaults/preferences/ klasörüne kopyalar
// (firefox.js'ten SONRA yüklenir; defaults/pref/ olsaydı firefox.js bizim değerleri ezerdi):
// bunlar *varsayılan* değerlerdir, kullanıcının ayarlardan yaptığı değişiklikler kalıcı olur.
// (user.js kullanılmaz; o her açılışta kullanıcının seçimlerini ezerdi.)

// Geliştirme: Browser Toolbox ve chrome hata ayıklama
pref("devtools.chrome.enabled", true);
pref("devtools.debugger.remote-enabled", true);
pref("devtools.debugger.prompt-connection", false);
pref("browser.dom.window.dump.enabled", true);
// Geliştirici araçları (F12) sağda açılır, altta değil
pref("devtools.toolbox.host", "right");

// İlk açılış gürültüsü
pref("userChromeJS.firstRunShown", true); // fx-autoconfig'in "… is being modified" şeridi
pref("browser.shell.checkDefaultBrowser", false);
pref("browser.aboutwelcome.enabled", false);
pref("browser.startup.homepage_override.mstone", "ignore");
pref("trailhead.firstrun.didSeeAboutWelcome", true);
pref("app.update.auto", false);

// Telemetri yok
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("datareporting.healthreport.uploadEnabled", false);
pref("toolkit.telemetry.enabled", false);
pref("toolkit.telemetry.unified", false);
pref("toolkit.telemetry.reportingpolicy.firstRun", false);
pref("app.shield.optoutstudies.enabled", false);
pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
pref("browser.newtabpage.activity-stream.telemetry", false);
pref("browser.ping-centre.telemetry", false);

// Gizlilik
pref("privacy.globalprivacycontrol.enabled", true);
pref("dom.security.https_only_mode", true);
pref("privacy.query_stripping.enabled", true);
pref("privacy.query_stripping.enabled.pbmode", true);
pref("browser.contentblocking.category", "strict");

// Başlangıç: önceki oturumu geri yükle (alanlar/workspace'ler bunu kullanır)
pref("browser.startup.page", 3);

// Sekmeler
pref("browser.tabs.unloadOnLowMemory", true);
pref("browser.tabs.closeWindowWithLastTab", false);

// Medya: VA-API donanım çözme
pref("media.ffmpeg.vaapi.enabled", true);

// Yan Panel düzeni: Firefox'un yerel dikey sekmeleri (Rigel bunları yeniden biçimler)
pref("sidebar.expandOnHover", false);
pref("sidebar.position_start", true);
pref("sidebar.animation.enabled", false);
pref("sidebar.verticalTabs.dragToPinPromo.dismissed", true);
pref("sidebar.new-sidebar.has-used", true);
pref("browser.toolbars.bookmarks.visibility", "never");
// Çerçevesiz pencere: sistem başlık çubuğu yok, pencere düğmelerini Rigel çizer
pref("browser.tabs.inTitlebar", 1);
pref("browser.tabs.hoverPreview.enabled", false);

// ---- Marka ve dağıtım (C) ----
// Yeni sekme ve ana sayfa: Rigel sayfası (branding.sys.mjs AboutNewTab'ı da buna yönlendirir)
pref("browser.startup.homepage", "chrome://rigel/content/newtab/newtab.html");
pref("browser.newtabpage.activity-stream.showSponsored", false);
pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
pref("browser.newtabpage.activity-stream.feeds.topsites", false);
pref("browser.topsites.contile.enabled", false);

// Kullanım koşulları / veri politikası bildirimi: dağıtım için "gösterme" anahtarı.
// Kullanıcı adına hiçbir şey kabul edilmez (SkipTermsOfUse ilkesi termsofuse.acceptedVersion yazdığı için kullanılmıyor).
pref("termsofuse.bypassNotification", true);
pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);

// Firefox'a özgü arayüz ve tanıtımlar
pref("browser.preferences.moreFromMozilla", false);
pref("browser.preferences.experimental.hidden", true);
pref("browser.vpn_promo.enabled", false);
pref("browser.promo.focus.enabled", false);
pref("browser.promo.pin.enabled", false);
pref("browser.promo.relay.enabled", false);
pref("browser.privatebrowsing.vpnpromourl", "");
pref("browser.contentblocking.report.monitor.enabled", false);
pref("browser.contentblocking.report.vpn.enabled", false);
pref("signon.firefoxRelay.feature", "disabled");
pref("identity.fxaccounts.toolbar.enabled", false);
pref("ui.new-webcompat-reporter.enabled", false);
pref("browser.messaging-system.whatsNewPanel.enabled", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false);
pref("extensions.htmlaboutaddons.recommendations.enabled", false);
pref("extensions.getAddons.showPane", false);
pref("browser.discovery.enabled", false);
pref("browser.shopping.experience2023.enabled", false);
pref("browser.firefox-view.feature-tour", "{\"screen\":\"\",\"complete\":true}");
pref("browser.defaultbrowser.notificationbar", false);
pref("browser.shell.didSkipDefaultBrowserCheckOnFirstRun", true);
pref("browser.startup.upgradeDialog.enabled", false);

// Adres çubuğu: "Firefox Önerileri" grup başlığı ve sponsorlu öneriler yok
pref("browser.urlbar.groupLabels.enabled", false);
pref("browser.urlbar.quicksuggest.enabled", false);
pref("browser.urlbar.suggest.quicksuggest.sponsored", false);
pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false);
pref("browser.urlbar.suggest.pocket", false);
pref("browser.urlbar.suggest.trending", false);
pref("browser.urlbar.suggest.yelp", false);
pref("browser.urlbar.suggest.mdn", false);
pref("browser.urlbar.suggest.addons", false);

// Yerleşik resim içinde resim (PiP): videodan sekme değiştirince otomatik açılır
pref("media.videocontrols.picture-in-picture.enabled", true);
pref("media.videocontrols.picture-in-picture.video-toggle.enabled", true);
pref("media.videocontrols.picture-in-picture.keyboard-controls.enabled", true);
pref("media.videocontrols.picture-in-picture.urlbar-button.enabled", true);
pref("media.videocontrols.picture-in-picture.audio-toggle.enabled", true);
pref("media.videocontrols.picture-in-picture.playback-speed.enabled", true);
pref("media.videocontrols.picture-in-picture.display-text-tracks.enabled", true);
pref("media.videocontrols.picture-in-picture.enable-when-switching-tabs.enabled", true);

// Sekme grupları (K2): etiketler ve "sekme seçince diğer grupları daralt"
pref("rigel.groups.showLabels", true);
pref("rigel.groups.collapseOnSwitch", false);
