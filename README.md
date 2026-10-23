# Rigel

Firefox (Gecko) tabanlı, [Zen Browser](https://zen-browser.app/)'dan esinlenen kişisel web tarayıcısı.
Derleme yok: Mozilla'nın resmî Firefox ikilisi, [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) ve Rigel'in kendi arayüz kodu (`src/rigel/`) bir araya gelir.
Tüm Firefox özellikleri (kodekler, uzantılar, PiP) olduğu gibi çalışır.

## Özellikler

- **Beş düzen:** Ada, Yörünge Dock, Komuta, Yan Panel, Klasik. `Ctrl+Shift+L` ile yeniden başlatmadan değişir.
- **Palet (`Ctrl+K`):** adres, arama, açık sekmeler, geçmiş/yer imi, 65 komut ve `!bang` kısayolları.
- **Zen özellikleri:** Glance (Alt+tık), kompakt mod, alanlar (`Ctrl+Alt+1..9`), Essentials, sekme grupları, kapsayıcılar.
- **Modlar ve mağaza:** CSS modları (arayüz ve web), 19 yerleşik mod, güvenlik denetimli kurulum.
- **Tema:** koyu/açık/sistem, 5 vurgu rengi; Rigel gizli pencere görünümü; hareket ve animasyonlar.
- **Kitaplık, ayarlar, ilk açılış sihirbazı**, Türkçe ek çekimleri ("Rigel'i", "Rigel'e"), Rigel yeni sekme sayfası.
- **Gizlilik:** telemetri, çalışmalar, Pocket, sponsorlu öneriler ve Firefox hesabı kapalı. uBlock Origin, SponsorBlock ve Dark Reader ilk açılışta kurulur (kaldırılabilir, geri gelmez).

Ayrıntılı durum ve bilinen eksikler: [docs/DURUM.md](docs/DURUM.md). Plan: [docs/PLAN.md](docs/PLAN.md).

## Ekran görüntüleri

> Yer tutucu. Ekran görüntüleri `design/` altına eklenecek (logo: `design/logo.svg`).

## Kurulum

Depo özel (private) olduğu için `curl | bash` çalışmaz; önce [GitHub CLI](https://cli.github.com/) ile giriş yapıp klonlayın.

### Linux (x86_64)

```bash
gh repo clone oktayyavuz/rigeldesktop
cd rigeldesktop
./install.sh
```

Root gerekmez. `install.sh` şunları yapar:

1. `FIREFOX_VERSION` dosyasındaki Firefox sürümünü (Türkçe, x86_64) `archive.mozilla.org`'dan indirir ve **SHA256'sını Mozilla'nın `SHA256SUMS` dosyasıyla doğrular** (uyuşmazsa kurulum durur). İndirme `~/.cache/rigel/` altında önbelleğe alınır.
2. Her şeyi `~/.local/share/rigel/` altına kurar: `app/` (Firefox + Rigel katmanı), `rigel/`, `utils/` (fx-autoconfig), `profile/` (ilk açılışta oluşur), `VERSION`.
3. `~/.local/bin/rigel` başlatıcısını, `rigel.desktop` girdisini ve ikonları yazar.

Varsayılan tarayıcı **değiştirilmez**. İsterseniz: `xdg-settings set default-web-browser rigel.desktop`.

Gereksinimler: `curl` (ya da `wget`), `tar`, `xz`, `sha256sum`; videolar için sistemde `ffmpeg`. Seçenekler: `./install.sh --yardim`.

| Seçenek | Açıklama |
|---|---|
| `--guncelle` | Yalnız Rigel dosyalarını yeniler; `FIREFOX_VERSION` değişmediyse Firefox'a dokunmaz |
| `--profil-tasi <dizin>` | Var olan bir profili (ör. geliştirme profili `proto/profile`) boş Rigel profiline kopyalar; kaynak profil değişmez, Rigel kapalı olmalı |
| `RIGEL_HOME=…` | Kurulum klasörünü değiştirir (varsayılan `~/.local/share/rigel`) |

Başlatıcı (`rigel`) profilin `chrome/utils` ve `chrome/JS` klasörlerini kuruluma bağlar, Rigel dosyaları değiştiyse Firefox'un başlangıç önbelleğini temizler. `rigel https://…` ile verilen adresler, Rigel açıksa çalışan pencerede açılır.

### Arch Linux (PKGBUILD)

```bash
gh repo clone oktayyavuz/rigeldesktop
cd rigeldesktop/packaging/arch
makepkg -si
```

`rigel-browser` paketi `/opt/rigel` altına kurulur, `/usr/bin/rigel` komutunu verir; profil yine kullanıcı başına `~/.local/share/rigel/profile` olur. Firefox arşivi sha256 ile sabitlenmiştir. `FIREFOX_VERSION` değişirse PKGBUILD'deki `_ffver` ve `sha256sums` da güncellenmelidir (aksi halde `prepare()` hata verir).

### Windows (deneysel, test edilmedi)

> **Uyarı:** Windows betikleri bu depoda yazıldı ama bir Windows makinede **hiç çalıştırılmadı**. Sorun çıkabilir.

PowerShell'de, klonlanmış depoda:

```powershell
powershell -ExecutionPolicy Bypass -File packaging\windows\install.ps1
```

Mozilla'nın Firefox yükleyicisini indirir, SHA256'sını doğrular, `%LOCALAPPDATA%\Rigel\app` altına sessizce kurar (kısayol, bakım hizmeti ve varsayılan tarayıcı aracısı olmadan), Rigel dosyalarını ve profili yerleştirir, Başlat menüsü ve masaüstü kısayolu oluşturur. `chrome\JS` ve `chrome\utils` için dizin bağlantısı (junction) kullanılır; olmazsa kopyalanır. Bilinen sınırlama: görev çubuğu simgesi Firefox simgesi olarak görünebilir.

## Güncelleme

```bash
cd rigeldesktop && git pull
./install.sh --guncelle        # Arch: makepkg -si   |   Windows: install.ps1'i yeniden çalıştırın
```

Firefox sürümü yalnızca `FIREFOX_VERSION` değişince güncellenir: Rigel kurulu Firefox'u kendi başına güncellemez (`DisableAppUpdate` ilkesi açık). Böylece Firefox ve Rigel arayüzü kodu hep birlikte, test edilmiş sürümle gelir. Güvenlik güncellemeleri için depoyu düzenli çekin.

## Kaldırma

```bash
./uninstall.sh                 # uygulamayı kaldırır, profili (yer imleri, geçmiş, ayarlar) korur
./uninstall.sh --profil-de     # profili de siler (onay ister; --evet soru sormaz)
```

Arch: `sudo pacman -R rigel-browser`. Windows: `packaging\windows\uninstall.ps1 [-ProfilDe]`.

## Geliştirme

```bash
proto/setup.sh   # bir kez: Firefox'u proto/firefox altına indirir; fx-autoconfig'i (vendor/) ve profili kurar
proto/run.sh     # Rigel'i proto/profile ile açar (önbelleği temizler); chrome/JS → src/rigel
packaging/linux/install-dev.sh   # bir kez: görev çubuğu logosu için rigel.desktop (proto/run.sh'yi gösterir)
```

- Giriş noktası: `src/rigel/rigel.uc.mjs`. Hata ayıklama: Browser Toolbox (`Ctrl+Alt+Shift+I`).
- Varsayılan tercihler: `prefs/rigel.js` → Firefox'un `browser/defaults/preferences/` klasörü (kullanıcı ayarları kalıcı kalır; `user.js` kullanılmaz).
- İlkeler: `distribution/policies.json`. Not: `/etc/firefox/policies/policies.json` varsa bu dosya yok sayılır.
- Testler:

```bash
node --test 'src/rigel/search/tests/*.test.mjs' 'src/rigel/l10n/tests/*.test.mjs'
```

Depo düzeni: `src/rigel/` (arayüz), `vendor/fx-autoconfig/` (MPL-2.0), `prefs/`, `distribution/`, `packaging/{linux,arch,windows}/`, `design/` (logo), `docs/`.

## Lisans

- Rigel kodu: **MPL-2.0** ([LICENSE](LICENSE)).
- **Firefox** kurulum sırasında Mozilla'dan indirilir; bu depoda dağıtılmaz. Firefox, Mozilla Foundation'ın tescilli markasıdır; Rigel Mozilla ile bağlantılı değildir ve onaylanmamıştır. Firefox kendi lisansına (MPL-2.0 ve diğerleri) tabidir.
- **fx-autoconfig** ([MrOtherGuy](https://github.com/MrOtherGuy/fx-autoconfig)): MPL-2.0, `vendor/fx-autoconfig/LICENSE`.
- Mod mağazasındaki 9 mod, [Zen theme-store](https://github.com/zen-browser/theme-store)'daki MIT lisanslı modların uyarlamasıdır; telif ve atıf notları ilgili mod dosyalarının başında korunur (bkz. `src/rigel/mods/STORE.md`).
