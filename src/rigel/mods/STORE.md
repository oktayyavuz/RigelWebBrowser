# Rigel Mod Mağazası: biçim ve mod yazma rehberi

Mod = birkaç JSON ve CSS dosyası, isteğe bağlı olarak sınırlı bir JS betiği (`chrome.mjs`). Mağaza, bu dosyaların bir listesini (`index.json`) okur ve seçtiğin modu profildeki `rigel-mods/<id>/` klasörüne kurar. Betik yalnız Rigel ile gelen yerleşik katalogdan doğrudan çalışır; uzak ya da bağlantıdan gelen betik, kullanıcı "Bu mod kod çalıştırır" uyarısını onaylamadan indirilmez ve etkinleşmez (aşağıda "Betik (davranış modları)").

Esinlenme: Zen theme-store (`themes.json`, `theme.json`, `chrome.css`, `preferences.json`). Yerleşik mağazadaki 21 moddan 9'u Zen mağazasındaki MIT lisanslı modların Rigel uyarlamasıdır (aşağıda "Zen modlarını Rigel'e uyarlama").

## Katalog kaynakları
| Kaynak | Nerede | Not |
|---|---|---|
| Yerleşik | `src/rigel/mods/store/index.json` + `store/<id>/…` (`chrome://userscripts/content/mods/store/`) | Çevrimdışı çalışır |
| Uzak | tercih `rigel.mods.storeUrl` (varsayılan boş; Ayarlar › Modlar) | http/https. 9 sn zaman aşımı. Son başarılı kopya `<profil>/rigel-mods-cache/index.json` içinde saklanır; ulaşılamazsa o kullanılır. Aynı kimlik varsa daha yeni sürüm kazanır |
| Bağlantı | Mağaza › "Bağlantıdan kur" ya da `chrome://rigel/content/store/store.html#kur=<adres>` | Dizin (`index.json`), tek giriş, `mod.json` ya da klasör adresi. GitHub arayüz adresleri (`github.com/k/r/tree/dal/yol`) otomatik ham adrese çevrilir |

## index.json
```json
{
  "version": 1,
  "mods": [
    {
      "id": "pill-dock",
      "name": "Hap biçimli Dock",
      "description": "Kısa açıklama (en çok 400 karakter).",
      "author": "Ad",
      "version": "1.0.0",
      "tags": ["dock", "görünüm"],
      "target": "chrome",
      "homepage": "https://örnek.dev/pill-dock",
      "license": "MIT",
      "source": "https://github.com/zen-browser/theme-store/tree/main/themes/<uuid>",
      "preview": "pill-dock/preview.png",
      "files": {
        "mod.json": "pill-dock/mod.json",
        "chrome.css": "pill-dock/chrome.css",
        "content.css": "pill-dock/content.css",
        "preferences.json": "pill-dock/preferences.json",
        "chrome.klasik.css": "pill-dock/chrome.klasik.css",
        "chrome.mjs": "pill-dock/chrome.mjs"
      },
      "layouts": ["klasik", "ada"]
    }
  ]
}
```
- `id`: `a-z`, `0-9`, `-`; en çok 48 karakter. Kurulum klasörü adı budur.
- `target`: `chrome` (tarayıcı arayüzü), `content` (web sayfaları) ya da `both`. `content` için `content.css` zorunlu; `chrome` için `chrome.css`, bir `chrome.<düzen>.css` ya da `chrome.mjs`'den en az biri gerekir. `layouts` (isteğe bağlı) kartta etiket olarak gösterilir.
- `files`: yalnız şu adlar: `mod.json`, `chrome.css`, `content.css`, `preferences.json`, `chrome.mjs` (betik), `chrome.<düzen>.css` (`ada|dock|komuta|yanpanel|klasik`). Adresler `index.json`'a göre göreli olabilir. `preferences.json` isteğe bağlı. Uzak dizinde adresler http/https olmalı.
- `preview` isteğe bağlı (png/svg/jpg adresi). Kart 16:9 gösterir; 640×360 PNG önerilir. Yerleşik modların önizlemeleri tarayıcının gerçek görüntüsüdür (aşağıda "Önizleme üretmek").
- `license` (SPDX, ör. `MIT`) ve `source` (özgün modun adresi) isteğe bağlı; uyarlanan modlarda zorunlu say. Mağaza kartında "Kaynak: Zen mod mağazası — yazar (lisans)" satırı bunlardan çıkar (adres `github.com/zen-browser/theme-store` ise "Zen mod mağazası", değilse alan adı). Kurulumda `mod.json`'a `homepage`, `license`, `source` olarak yazılır.
- Sürüm arttığında ("1.0.1" > "1.0.0") kurulu mod için kartta "Güncelleme var" çıkar. Güncelleme açık/kapalı durumunu ve mod ayarlarını korur.
- Sınırlar: dizin 768 KB, `mod.json` 32 KB, her CSS 256 KB, betik 128 KB, en çok 400 giriş.

## Mod klasörü
```
mod.json            zorunlu
chrome.css          target chrome/both
chrome.<düzen>.css  isteğe bağlı: yalnız o düzen etkinken eklenir (chrome.klasik.css, chrome.ada.css …)
chrome.mjs          isteğe bağlı: davranış betiği (mod.json'da "script": true)
content.css         target content/both
preferences.json    isteğe bağlı: mod ayarları (mod.json içindeki prefs ile birleşir)
```

### mod.json
```json
{
  "name": "Ad", "description": "…", "author": "…", "version": "1.0.0", "target": "chrome",
  "homepage": "https://…", "license": "MIT", "source": "https://…",
  "layouts": ["klasik", "ada"],
  "priority": "override",
  "script": true,
  "prefs": [
    { "key": "radius", "label": "Köşe", "type": "range", "min": 0, "max": 32, "step": 1, "unit": "px", "default": 12 },
    { "key": "tint",   "label": "Ton rengi", "type": "color", "default": "#4a62b8" },
    { "key": "shadow", "label": "Gölge", "type": "checkbox", "default": true },
    { "key": "font",   "label": "Yazı tipi", "type": "string", "default": "monospace" },
    { "key": "mode",   "label": "Biçim", "type": "dropdown", "default": "a",
      "options": [ { "value": "a", "label": "A" }, { "value": "b", "label": "B" } ] }
  ]
}
```
- `prefs` tipleri: `checkbox`, `dropdown`, `string`, `range` (`min`, `max`, `step`, `unit`; Ayarlar'da değer göstergeli kaydırıcı), `color` (`#rrggbb`; Ayarlar'da renk seçici + onaltılı alan). Zen'in `property` / `defaultValue` alanları da kabul edilir. Kurulumdan sonra Mağaza ayrıntı panelinde ve Ayarlar › Modlar'da form olarak görünür; değişiklik canlı uygulanır (yeniden yükleme yok).
- `layouts` (isteğe bağlı): mod yalnız bu düzenlerde etkindir (CSS, kök öznitelikleri ve betik). Boşsa her düzende. Mağaza kartında ve Ayarlar'da küçük düzen etiketleri çıkar.
- `priority`: `"override"` (varsayılan) ya da `"normal"`. Aşağıda "Öncelik katmanı".
- `script: true`: `chrome.mjs` betiği var (aşağıda).

### Öncelik katmanı (Rigel'i ezmek)
Rigel'in düzen kuralları AUTHOR katmanında `#id` + `!important` ile yazılıdır. Mod chrome CSS'i her pencereye **iki kez** yüklenir: AUTHOR katmanı (normal kurallar eskisi gibi özgüllük yarışına girer) ve **USER katmanı**. CSS kaskadında önem sırası `user !important > author !important`, bu yüzden **modun `!important` yazdığı her bildirim Rigel'in hiçbir kuralıyla yarışmadan kazanır**; seçici gücü ya da `:root:root` önekine gerek kalmaz (zararsızdır). Kural: **ezmek istediğin her şeye `!important` yaz.** `!important`sız bildirimler AUTHOR'da kalır ve Rigel'in `#id` kurallarına yenilebilir. Bonus: USER katmanı gölge DOM içindeki öğelere de ulaşır. `"priority": "normal"` modu yalnız AUTHOR katmanında bırakır (Rigel kazanır; nadiren istenir). Content CSS zaten USER katmanındadır.
Betiğin `api.addStyle(css)` ile eklediği stil de iki katmanlıdır.

### Düzene göre CSS
`layouts` ile bütün mod bir düzene kilitlenebilir. Ayrıca `chrome.<düzen>.css` dosyaları (`chrome.klasik.css` …) `chrome.css`'in **üstüne**, yalnız o düzen etkinken eklenir. Düzen penceredeki `data-rigel-layout` özniteliğinden izlenir (MutationObserver); düzen değişince yeniden başlatma gerekmez, CSS ve betik yeniden seçilir.

### Ayarlar CSS'e nasıl gelir
- Her ayar kök öğede `--rigel-mod-<id>-<anahtar>` CSS değişkenidir (onay kutusu: `1`/`0`; kaydırıcı: sayı + `unit`, ör. `12px`; renk: `#rrggbb` ve ayrıca `--rigel-mod-<id>-<anahtar>-rgb: r, g, b`; seçim ve metin: değer olduğu gibi). Chrome'da bunlar kök öğenin satır içi stilidir, ayar değişince canlı güncellenir.
- Kaydırıcıyı tam sayı gerektiren yerde `calc(var(--rigel-mod-x-gap) * 1)` ya da birimsiz kullan (`unit: ""`): `color-mix(in srgb, var(--rigel-mod-x-tint) calc(var(--rigel-mod-x-opacity) * 1%), transparent)`.
- `chrome` hedefinde ayrıca kökte `rigel-mod-<id>-<anahtar>` özniteliği vardır (onay kutusu açıksa `"true"`, kapalıysa yok; kaydırıcı sayı; renk ve diğerleri değer). Koşullu kural için: `:root:root:root[rigel-mod-pill-dock-glow] …`.
- `content` hedefinde öznitelik yok; koşul gereken yerde seçeneği CSS değerine çevir: `scroll-behavior: var(--rigel-mod-reader-content-scroll, smooth)`.
- Her zaman yedek değer ver: `var(--rigel-mod-x-gap, 8px)`.

## CSS ipuçları (chrome)
- **Kök öznitelikler:** `data-rigel-layout="ada|dock|komuta|yanpanel|klasik"`, `data-rigel-theme="dark|light"`, `data-rigel-accent="rigel|violet|green|orange|pink"`, `data-rigel-space="<alan id>"` (varsayılan alan `s-genel`), `data-rigel-compact`, `data-rigel-urlbar="hidden"`.
- **Belirteçler** (tema ve vurguya göre değişir; renk sabitleme, bunları kullan): `--bg --bar --surface --surface-2 --hover --active --border --border-2 --text --text-dim --text-faint --accent --accent-2 --accent-ink --danger --shadow --shadow-sm --font --mono`.
- **Önemli kimlikler:** `#navigator-toolbox`, `#TabsToolbar`, `#tabbrowser-tabs`, `.tabbrowser-tab`, `#nav-bar`, `#urlbar` (içinde `.urlbar-background`, `#urlbar-input`), `#sidebar-container` (Yan Panel), `#tabbrowser-tabbox`, `#tabbrowser-tabpanels`, `.browserContainer`. Rigel şeritleri: `#rigel-ada` (`.rigel-star`, `.rigel-island`, `.rigel-identity`), `#rigel-dock` (`.rigel-dock-body`, `.rigel-dtab`), `#rigel-docktop`, `#rigel-komuta`, `#rigel-side-top`, `#rigel-side-bottom`, `#rigel-spaces`. Sekme paneli: `.rgl-tabs .rgl-row`.
- **Seçici gücü:** Rigel'in düzen kuralları `:root[data-rigel-layout="…"] #kimlik …` biçimindedir ve çoğu `!important` taşır. Mod CSS'i USER katmanında da yüklendiği için `!important` yazdığın her bildirim bunları seçici gücüne bakmadan yener (yukarıda "Öncelik katmanı"). `!important` yazmadığın bildirimler için eski kural geçerli: `:root:root:root` öneki ve kimlikli seçici (`#urlbar`, `#TabsToolbar` …) gerekir.
- Animasyon yalnız `transform` ve `opacity`; `@media (prefers-reduced-motion: reduce)` ile kapat. Süreler 120-240 ms.
- Tam ekran videoda şeritleri bozma: `[inDOMFullscreen]` durumunu koru.
- Kendine gönderme yapma: `--bar: color-mix(… var(--bar) …)` geçersiz olur; temaya göre sabit bir taban renk yaz.

## Betik (davranış modları)
`mod.json`'da `"script": true` ve mod klasöründe `chrome.mjs`. Modül, **her tarayıcı penceresi için** çağrılır; döndürdüğü işlev temizliktir (mod kapatılınca, düzen modun `layouts` listesinden çıkınca, mod güncellenince ve pencere kapanırken çalışır). Ayar değişince, `api.onPrefChange` işleyicisi varsa o çağrılır; yoksa betik temizlenip yeni değerlerle yeniden çalıştırılır.
```js
export default function (api) {
  const off = api.onTabSelect(tab => api.log("seçildi", tab.label));
  api.addStyle(`:root:root #nav-bar { outline: 2px solid var(--accent) !important }`);
  api.commands.register({ id: "selam", label: "Selam ver", run: () => api.toast("Selam!") });
  api.addToolbarButton({ id: "btn", icon: "◐", label: "Dene", onClick: () => api.toast("Tık") });
  return () => { /* kendi eklediğin başka bir şeyi geri al */ };
}
```
`api` (küçük ve kararlı):
| Üye | Anlamı |
|---|---|
| `id`, `window`, `document` | mod kimliği, tarayıcı penceresi ve belgesi |
| `prefs` | modun güncel ayarları `{ anahtar: değer }` (checkbox bool, range sayı, color `"#rrggbb"`, diğerleri dize) |
| `layout` | geçerli düzen adı |
| `onPrefChange(fn(prefs, değişenAnahtarlar))` | ayar değişince; kaldırma işlevi döner |
| `onLayoutChange(fn(yeniDüzen, eski))` | düzen değişince |
| `onTabSelect(fn(sekme, öncekiSekme))` | seçili sekme değişince |
| `addStyle(css)` | pencereye CSS ekler (iki katmanlı, `!important` Rigel'i yener); kaldırma işlevi döner. Temizlikte otomatik kaldırılır |
| `commands.register({ id, label, sub?, keys?, icon?, run })` | komut paletine `mod.<modId>.<id>` olarak kaydolur (`Rigel.commands.register`); kaldırma işlevi döner; temizlikte kaldırılır, kayıt defteri hazır değilse hazır olunca kaydolur |
| `addToolbarButton({ id, icon, label, onClick })` | Ada/Dock/Komuta şeridine ya da Klasik/Yan Panel araç çubuğuna düğme; `icon` bir adres (`chrome://…`, `data:`) ya da kısa simge metni |
| `toast(mesaj)` | `Rigel.toast` |
| `listen(hedef, tür, fn, seçenekler)`, `setTimeout(fn, ms)`, `setInterval(fn, ms)` | temizlikte otomatik bırakılan dinleyici ve zamanlayıcılar |
| `log(...)` | `[rigel-mod:<id>]` önekli konsol kaydı |

**Hata yalıtımı:** içe aktarma, başlatma, temizlik, her olay işleyicisi ve komut/düğme tıklaması `try/catch` içindedir. Hata konsola `[rigel-mod:<id>]` önekiyle yazılır ve Ayarlar › Modlar'da modun altında kırmızı satır olarak görünür; pencere düşmez, aynı sürüm yeniden denenmez. Betik `export default` işlev vermelidir. Yükleme: betik `chrome://userchrome/content/rigel-mods/<id>/chrome.mjs?v=…` adresinden `import()` edilir (pencere modül yükleyicisi `file:`/`data:`/`blob:` kabul etmez; yönetici profildeki `chrome/resources/rigel-mods/<id>/` klasörüne kopya yazar, sorgu dizesi önbelleği kırar).

### Güvenlik
Chrome betiği **tam yetkilidir** (sekmeleri, geçmişi, parolaları okuyabilir). Bu yüzden:
- **Güvenilir:** Rigel ile gelen yerleşik modlar (`mods/builtin`) ve paketle gelen yerleşik katalogdan (`mods/store`) kurulanlar (`trust: "bundled"`). Doğrudan çalışırlar.
- **Onay gerektirir:** uzak mağaza (`rigel.mods.storeUrl`), bağlantıdan kurulan ve klasörden içe aktarılan betikli modlar. Mağazada kartta ve ayrıntıda kırmızı **"Kod çalıştırır"** rozeti ve "Bu mod kod çalıştırır" uyarısı görünür; kurmadan önce `Rigel.dialog.confirm` ile açıkça onaylanır (onay verilmezse betik dosyası indirilmez). Onaylanan mod `trust: "user"` olur. Sürüm güncellemesinde onay yeniden istenir. Onaysız mod etkinleştirilemez (`Mods.setEnabled` `false` döner; çalışma zamanı yalnız güvenilir modları çalıştırır; `Rigel.dialog` yoksa kapalı kalır).
- Betik içeriği CSS gibi süzülemez; yalnız güvendiğin yazarlardan kur. CSS doğrulaması (aşağıda) betik dosyasına uygulanmaz.

## CSS ipuçları (content)
- Sayfa CSS'i otomatik olarak yalnız web adreslerine (`http`, `https`, `file`, `data`, …) uygulanır; `about:` ve Rigel sayfalarına dokunmaz. Kullanıcı stil katmanı: `!important` siteyi geçer, kullan ama saygılı ol.
- Rigel belirteçleri (`--accent` …) web sayfalarında **yoktur**; renkleri değer ya da mod ayarı olarak ver.

## Doğrulama (mağazadan gelen her dosya)
- Yalnız `.json`, `.css` ve (onaylı betikli modlarda) tek `chrome.mjs`; indirilen metin boyut sınırlarını aşarsa reddedilir.
- CSS'ten **kaldırılır:** `@import` satırları ve yorumlar. Dosyanın **en başındaki tek yorum** (lisans/atıf bloğu, en çok 8 KB) korunur; MIT gibi lisanslar telif notunun kopyalarda kalmasını ister. **Reddedilir:** `url()` içinde `data:image/…`, `chrome://(global|browser|branding|userscripts|rigel)/…` ve `#parça` dışındakiler (uzak, `file:`, `resource:`, göreli), dizelerde uzak adres (`image-set("https://…")`), dizeler dışında `\` kaçışları, `-moz-binding`, `@namespace`, dengesiz `{ }` / `( )` (içerik CSS'i `@-moz-document` içine sarıldığından, dışarı taşma denemesi engellenir).
- Kimlikler ve dosya adları beyaz listeden gelir; yol gezintisi yoktur. Aynı kimlikte mağazadan gelmeyen bir mod varsa üzerine yazılmaz.
- Yerelde elle yazdığın modlar (Ayarlar › Modlar) bu süzgeçten geçmez; yalnız mağaza ve bağlantıdan kurulanlar geçer.

## Dağıtım
Dosyaları (GitHub vb.) herhangi bir statik sunucuya koy, `index.json` yaz, adresi Ayarlar › Modlar › "Uzak mağaza adresi"ne yapıştır. Tek mod paylaşmak için klasörün (GitHub'da `…/tree/dal/klasör`) adresi yeter: Mağaza › Bağlantıdan kur.

## Zen modlarını Rigel'e uyarlama
Zen modları Zen'in kendi DOM'unu (`#zen-*`, `zen-folder`, `zen-workspace`) ve `-moz-bool-pref` ile tercih okumayı kullanır. Rigel'de bunların hiçbiri yok; fikir ve görünüm korunur, seçiciler ve ayarlar yeniden yazılır.

**Lisans önce.** Yalnız değiştirip yeniden dağıtmaya izin veren lisanslar: MIT, MPL-2.0, Apache-2.0, BSD, CC0, Unlicense. Modun `theme.json`'undaki `homepage` deposunda `LICENSE` dosyasına bak (`api.github.com/repos/<k>/<r>/license`). Lisanssız ya da belirsiz olanı (ve GPL'i: Rigel modu olarak tek dosyada dağıtılamaz) alma. Uyarlanan CSS'in başına atıf ve lisans metnini koy, `mod.json`'a ve `index.json`'a `author` (özgün yazar), `homepage`, `license`, `source` yaz.

| Zen | Rigel / Firefox | Not |
|---|---|---|
| `@media (-moz-bool-pref: "x.y")` | `:root:root:root[rigel-mod-<id>-<anahtar>] …` | Onay kutusu ayarı kök özniteliği olur |
| `body:has(#theme-X[x-y="değer"])`, `:root:has(#theme-X[…])` | `:root:root:root[rigel-mod-<id>-<anahtar>="değer"] …` | Seçim (dropdown) ayarı |
| `var(--theme-x-y)`, `var(--mod-x-y)` (dize ayarları) | `var(--rigel-mod-<id>-<anahtar>, yedek)` | Sayısal değerleri birimli seç (`760px`, `0.5`) |
| `preferences.json` (`property`, `defaultValue`, `options[].value/label`) | `mod.json` › `prefs` (`key`, `default`, `options`) | Zen biçimi de okunur ama kısa `key` kullan |
| `--zen-primary-color`, `--zen-colors-tertiary` | `--accent`, `--surface-2` | Rigel belirteçleri tema ve vurguya göre değişir |
| `--zen-colors-border`, `--zen-border-radius` | `--border-2`, 12–16 px | |
| `--lwt-text-color`, `--toolbar-color` | `--text` | |
| `#zen-appcontent-navbar-container` | `#nav-bar` (Klasik/Yan Panel), `#rigel-ada`, `#rigel-docktop`, `#rigel-komuta` | Ada/Dock/Komuta'da adres çubuğu gizli |
| `#navigator-toolbox` (Zen kenar çubuğu) | Klasik: `#TabsToolbar`; Yan Panel: `#sidebar-container` | Rigel'de `#titlebar` yok |
| `#zen-essentials-container`, `.zen-essentials-container` | `#pinned-tabs-container` (Yan Panel'de `::part(items-wrapper)` ızgarası) | Rigel'de Essentials = sabitlenmiş sekmeler |
| `zen-folder` | `tab-group` | |
| `.zen-current-workspace-indicator-icon` | `.rigel-spacechip`, `#rigel-spaces .rigel-space.on`, kök `data-rigel-space` | |
| `[zen-compact-mode="true"]` | `[data-rigel-compact]` | |
| `[privatebrowsingmode]` | `[data-rigel-private]` | |
| `#tabbrowser-tabpanels .browserSidebarContainer` | `#tabbrowser-tabpanels .browserContainer`, `#tabbrowser-tabbox` | Sayfa çerçevesi |
| `#urlbar[breakout-extend]` | `#urlbar:is([open], [popover-open])` | Öneriler `.urlbarView-background` üstünde çizilir |
| `.tab-icon-overlay` (ses) | `.tab-audio-button`, `.tabbrowser-tab[soundplaying]` | Firefox 136+ ses düğmesi ayrı |
| `findbar` | `findbar` (Rigel `theme/panels.css` sağ üstte kart yapar; `:root:root:root` ile ez) | |
| `#PersonalToolbar` | aynı; Rigel `display:none` yapar, `:not([collapsed="true"])` ile geri getir | Çubuk Ctrl+Shift+B ile açılınca yer imleri dolar |

Yerleşik uyarlamalar (hepsi MIT): Daha iyi bul çubuğu (RobotoSkunk), Temiz adres çubuğu (Dinno-DEV), Hayalet sekmeler (Seismix), Gizli pencere vurgusu (danm36), SuperPins (CosmoCreeper), Yüzen durum çubuğu (Archer7x), Hızlı erişim ızgarası (lingais, "Super Sleek UI"), Yer imi çubuğu (n7itro, theme-store deposu), Quietify (wysh3, Dark-Harmony'den). Alınmayanlar: Load Bar (GPL-3.0), Tidy Popup, Animations Plus, Better Tab Indicators, Better Active Tab, Tab Numbers, Container Halo, Floating Status Bar (lisans yok).

## Önizleme üretmek
Önizleme, modun tarayıcıdaki gerçek görüntüsüdür: headless bir test profilinde mod açılır, ilgili bölge `windowGlobal.drawSnapshot(rect, ölçek)` ile çizilir ve 640×360 PNG olarak `store/<id>/preview.png`'ye yazılır. Aynı bölge mod kapalıyken de çizilir; iki görüntünün farkı modun gerçekten bir şey değiştirdiğini, kapatınca farkın sıfıra dönmesi de temiz kapandığını doğrular. Açılır menüler (menupopup) ayrı pencere olduğundan çizime girmez. CSS hatası için modu `@media (max-width: 1px) { … }` içine sarıp bir `<style>` olarak ekle (`docShell.cssErrorReportingEnabled = true`); `CSS Parser` iletileri konsola düşer (Firefox 158'de `text-wrap: pretty` yok).
