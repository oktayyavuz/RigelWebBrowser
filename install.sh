#!/usr/bin/env bash
# Rigel kurulumu (Linux, x86_64). Root gerekmez; her şey kullanıcı dizinine kurulur.
#
#   gh repo clone oktayyavuz/RigelWebBrowser && cd RigelWebBrowser && ./install.sh
#
# Ne yapar:
#   1. Mozilla'dan sabitlenmiş Firefox sürümünü (FIREFOX_VERSION, Türkçe) indirir, SHA256'sını SHA256SUMS ile doğrular.
#   2. fx-autoconfig'i, Rigel ilkelerini, varsayılan tercihleri ve ikonları Firefox'un yanına yerleştirir.
#   3. Rigel dosyalarını RIGEL_HOME altına kopyalar; ~/.local/bin/rigel başlatıcısını ve masaüstü girdisini yazar.
# Tekrar çalıştırmak güvenlidir (idempotent). Varsayılan tarayıcıyı DEĞİŞTİRMEZ.
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

# ---------- Çıktı ----------
if [[ -t 1 ]]; then
  R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[34m'; BD=$'\033[1m'; N=$'\033[0m'
else
  R=''; G=''; Y=''; B=''; BD=''; N=''
fi
bilgi()  { printf '%s==>%s %s\n' "$B$BD" "$N" "$*"; }
tamam()  { printf ' %s✓%s %s\n' "$G" "$N" "$*"; }
uyari()  { printf ' %s!%s %s\n' "$Y" "$N" "$*" >&2; }
hata()   { printf '%s✗ Hata:%s %s\n' "$R$BD" "$N" "$*" >&2; exit 1; }

yardim() {
  cat <<EOF
${BD}Rigel kurulumu${N}

Kullanım: ./install.sh [seçenekler]

  (seçeneksiz)          Rigel'i kurar (ya da var olan kurulumu onarır)
  --guncelle, --update  Yalnız Rigel dosyalarını yeniler; FIREFOX_VERSION değişmedikçe Firefox'a dokunmaz
  --profil-tasi <dizin> Var olan bir Firefox/Rigel profilini (ör. proto/profile) boş olan Rigel profiline kopyalar
  --yardim, --help, -h  Bu yardım

Ortam değişkenleri:
  RIGEL_HOME        Kurulum klasörü (varsayılan: \$XDG_DATA_HOME/rigel = ~/.local/share/rigel)
  RIGEL_BIN_DIR     Başlatıcının yeri (varsayılan: ~/.local/bin)
  RIGEL_ARCHIVE_URL Firefox sürümlerinin kök adresi (varsayılan: https://archive.mozilla.org/pub/firefox/releases)

Kurulan yerler:
  \$RIGEL_HOME/{app,rigel,utils,profile,VERSION}, \$RIGEL_BIN_DIR/rigel,
  \$XDG_DATA_HOME/applications/rigel.desktop, \$XDG_DATA_HOME/icons/hicolor/*/apps/rigel.*
EOF
}

# ---------- Seçenekler ----------
GUNCELLE=0
PROFIL_KAYNAK=""
while (($#)); do
  case "$1" in
    --guncelle|--update) GUNCELLE=1 ;;
    --profil-tasi)
      (($# >= 2)) || hata "--profil-tasi bir dizin ister."
      PROFIL_KAYNAK="$2"; shift ;;
    --profil-tasi=*) PROFIL_KAYNAK="${1#*=}" ;;
    --yardim|--help|-h) yardim; exit 0 ;;
    *) uyari "Bilinmeyen seçenek: $1"; yardim >&2; exit 2 ;;
  esac
  shift
done

# ---------- Yollar ----------
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
RIGEL_HOME="${RIGEL_HOME:-$DATA_HOME/rigel}"
BIN_DIR="${RIGEL_BIN_DIR:-$HOME/.local/bin}"
APPS_DIR="$DATA_HOME/applications"
ICONS_DIR="$DATA_HOME/icons/hicolor"
CACHE_DIR="$CACHE_HOME/rigel"
ARCHIVE_URL="${RIGEL_ARCHIVE_URL:-https://archive.mozilla.org/pub/firefox/releases}"
PROFILE="$RIGEL_HOME/profile"

# ---------- Ön kontroller ----------
[[ $(uname -s) == Linux ]] || hata "Bu betik yalnız Linux içindir. Windows için packaging/windows/install.ps1 (deneysel)."
case "$(uname -m)" in x86_64|amd64) ;; *) hata "Yalnız x86_64 desteklenir (bu makine: $(uname -m))." ;; esac
for f in FIREFOX_VERSION VERSION prefs/rigel.js distribution/policies.json src/rigel/rigel.uc.mjs \
         vendor/fx-autoconfig/program/config.js vendor/fx-autoconfig/profile/chrome/utils/boot.sys.mjs; do
  [[ -e $ROOT/$f ]] || hata "Depoda $f yok. Betiği tam bir klondan çalıştırın."
done
for c in tar xz sha256sum awk find sort; do
  command -v "$c" >/dev/null || hata "'$c' komutu gerekli."
done
if command -v curl >/dev/null; then DL=curl
elif command -v wget >/dev/null; then DL=wget
else hata "curl ya da wget gerekli."; fi
case "$RIGEL_HOME" in ''|/|"$HOME") hata "RIGEL_HOME güvenli bir klasör değil: '$RIGEL_HOME'" ;; esac

FF_VER="$(tr -d '[:space:]' < "$ROOT/FIREFOX_VERSION")"
[[ $FF_VER =~ ^[0-9]+(\.[0-9]+){1,2}$ ]] || hata "FIREFOX_VERSION geçersiz: '$FF_VER'"

if ((GUNCELLE)) && [[ ! -x $RIGEL_HOME/app/firefox ]]; then
  hata "Rigel kurulu değil ($RIGEL_HOME). Önce ./install.sh çalıştırın."
fi

# ---------- Yardımcılar ----------
indir() { # $1 = adres, $2 = hedef dosya ("-" = stdout), $3 = ilerleme göster (1)
  if [[ $DL == curl ]]; then
    local o=(-fL --retry 3 --connect-timeout 20)
    if [[ ${3:-0} == 1 && -t 2 ]]; then o+=(--progress-bar); else o+=(-sS); fi
    if [[ $2 == - ]]; then curl "${o[@]}" "$1"; else curl "${o[@]}" -o "$2" "$1"; fi
  else
    local o=(-q --tries=3 --timeout=30)
    [[ ${3:-0} == 1 && -t 2 ]] || o+=(-nv)
    wget "${o[@]}" -O "$2" "$1"
  fi
}

# Profil bir Firefox/Rigel penceresince kullanılıyor mu? (Firefox "lock" bağlantısı: "ip:+pid")
profil_acik() { # $1 = profil dizini
  local t pid
  [[ -L $1/lock ]] || return 1
  t="$(readlink "$1/lock" || true)"; pid="${t##*+}"
  [[ $pid =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null
}

# Atomik dizin değişimi: $1 (yeni içerik) -> $2
degistir() {
  local yeni="$1" hedef="$2"
  rm -rf "$hedef.eski"
  if [[ -e $hedef ]]; then mv "$hedef" "$hedef.eski"; fi
  mv "$yeni" "$hedef"
  rm -rf "$hedef.eski"
}

# Şablonu doldurur: render <şablon> <anahtar=değer>…  (sed yerine bash; özel karakterler sorun olmaz)
render() {
  local tpl icerik kv
  tpl="$1"; shift
  icerik="$(<"$tpl")"
  for kv in "$@"; do icerik="${icerik//"@${kv%%=*}@"/"${kv#*=}"}"; done
  printf '%s\n' "$icerik"
}

yuklu_firefox_surumu() {
  local ini="$RIGEL_HOME/app/application.ini"
  [[ -f $ini ]] || return 0
  awk -F= '/^\[App\]/{a=1;next} /^\[/{a=0} a && $1=="Version"{print $2; exit}' "$ini" | tr -d '\r'
}

# ---------- 1. Firefox ----------
firefox_kur() {
  local dosya="firefox-$FF_VER.tar.xz" yol="linux-x86_64/tr/firefox-$FF_VER.tar.xz"
  local tarball="$CACHE_DIR/$dosya" sums beklenen gercek tmp
  mkdir -p "$CACHE_DIR" "$RIGEL_HOME"

  bilgi "Firefox $FF_VER (tr, x86_64) için SHA256 listesi alınıyor"
  sums="$(indir "$ARCHIVE_URL/$FF_VER/SHA256SUMS" - 0)" || hata "SHA256SUMS indirilemedi: $ARCHIVE_URL/$FF_VER/SHA256SUMS"
  beklenen="$(awk -v p="$yol" '$2==p {print $1; exit}' <<<"$sums")"
  [[ $beklenen =~ ^[0-9a-f]{64}$ ]] || hata "SHA256SUMS içinde $yol satırı bulunamadı."

  if [[ -f $tarball ]]; then
    gercek="$(sha256sum "$tarball" | awk '{print $1}')"
    if [[ $gercek == "$beklenen" ]]; then
      tamam "Önbellekteki arşiv geçerli: $tarball"
    else
      uyari "Önbellekteki arşivin özeti uyuşmuyor; yeniden indiriliyor."
      rm -f "$tarball"
    fi
  fi
  if [[ ! -f $tarball ]]; then
    bilgi "İndiriliyor: $ARCHIVE_URL/$FF_VER/$yol"
    indir "$ARCHIVE_URL/$FF_VER/$yol" "$tarball.part" 1 || { rm -f "$tarball.part"; hata "Firefox indirilemedi."; }
    gercek="$(sha256sum "$tarball.part" | awk '{print $1}')"
    if [[ $gercek != "$beklenen" ]]; then
      rm -f "$tarball.part"
      hata "SHA256 UYUŞMUYOR! Beklenen $beklenen, gelen $gercek. İndirilen dosya silindi, kurulum durduruldu."
    fi
    mv "$tarball.part" "$tarball"
  fi
  tamam "SHA256 doğrulandı: $beklenen"

  bilgi "Firefox açılıyor"
  tmp="$(mktemp -d "$RIGEL_HOME/.app-yeni.XXXXXX")"
  tar -xJf "$tarball" -C "$tmp" --no-same-owner || { rm -rf "$tmp"; hata "Arşiv açılamadı."; }
  [[ -x $tmp/firefox/firefox ]] || { rm -rf "$tmp"; hata "Arşivde firefox/firefox yok."; }
  mv "$tmp/firefox" "$tmp/app"
  degistir "$tmp/app" "$RIGEL_HOME/app"
  rmdir "$tmp"
  tamam "Firefox $FF_VER kuruldu: $RIGEL_HOME/app"
  # Eski sürüm arşivleri önbellekte birikmesin
  find "$CACHE_DIR" -maxdepth 1 -name 'firefox-*.tar.xz' ! -name "$dosya" -delete 2>/dev/null || true
}

# ---------- 2. Rigel katmanı (Firefox dizinine) ----------
rigel_katmani() {
  local app="$RIGEL_HOME/app" f n
  bilgi "fx-autoconfig, ilkeler, tercihler ve ikonlar Firefox'a yerleştiriliyor"
  cp "$ROOT/vendor/fx-autoconfig/program/config.js" "$app/config.js"
  mkdir -p "$app/defaults/pref"
  cp "$ROOT/vendor/fx-autoconfig/program/defaults/pref/config-prefs.js" "$app/defaults/pref/config-prefs.js"
  mkdir -p "$app/distribution"
  cp "$ROOT/distribution/policies.json" "$app/distribution/policies.json"
  # Varsayılan tercihler browser/defaults/preferences altına (defaults/pref'e değil: firefox.js onları ezerdi)
  mkdir -p "$app/browser/defaults/preferences"
  rm -f "$app/defaults/pref/rigel.js"
  cp "$ROOT/prefs/rigel.js" "$app/browser/defaults/preferences/rigel.js"
  # X11 pencere ikonu
  mkdir -p "$app/browser/chrome/icons/default"
  for f in "$ROOT"/src/rigel/branding/content/icon*.png; do
    n="$(basename "$f" .png)"; n="${n#icon}"
    [[ $n =~ ^[0-9]+$ ]] && cp "$f" "$app/browser/chrome/icons/default/default$n.png"
  done
  # Mozilla'nın küçük "firefox" başlatıcısı yerine Rigel'e yönlendiren betik: oturum yöneticisi geri yüklerken
  # çıplak "app/firefox --sm-client-id …" çalıştırır; bu betik onu Rigel profiliyle açar (packaging/linux/firefox-wrapper.sh).
  install -m755 "$ROOT/packaging/linux/firefox-wrapper.sh" "$app/firefox"
  tamam "Rigel katmanı hazır"
}

# ---------- 3. Rigel dosyaları ----------
rigel_dosyalari() {
  local tmp damga
  bilgi "Rigel dosyaları kopyalanıyor"
  mkdir -p "$RIGEL_HOME"
  tmp="$(mktemp -d "$RIGEL_HOME/.rigel-yeni.XXXXXX")"
  cp -a "$ROOT/src/rigel" "$tmp/rigel"
  cp -a "$ROOT/vendor/fx-autoconfig/profile/chrome/utils" "$tmp/utils"
  degistir "$tmp/rigel" "$RIGEL_HOME/rigel"
  degistir "$tmp/utils" "$RIGEL_HOME/utils"
  rmdir "$tmp"
  # Sürüm damgası: VERSION + içerik özeti. Dosyalar değişince başlatıcı Firefox'un başlangıç önbelleğini siler.
  damga="$(cd "$ROOT" && { find src/rigel prefs distribution -type f -print0 | sort -z | xargs -0 sha256sum; } | sha256sum | cut -c1-12)"
  printf '%s-%s\n' "$(tr -d '[:space:]' < "$ROOT/VERSION")" "$damga" > "$RIGEL_HOME/VERSION"
  tamam "Rigel $(<"$RIGEL_HOME/VERSION")"
  if profil_acik "$PROFILE"; then
    uyari "Rigel şu an açık. Yeni sürüm, tarayıcıyı kapatıp yeniden açınca yüklenir."
  fi
}

# ---------- 4. Başlatıcı ----------
baslatici() {
  mkdir -p "$BIN_DIR"
  render "$ROOT/packaging/linux/rigel.sh.in" \
    "RIGEL_HOME=$RIGEL_HOME" 'PROFILE_DEFAULT=$RIGEL_HOME/profile' > "$BIN_DIR/rigel.yeni"
  chmod 755 "$BIN_DIR/rigel.yeni"
  # Aynı başlatıcının bir kopyası kurulum klasöründe de durur (app/firefox betiği "../bin/rigel" ile bulur)
  mkdir -p "$RIGEL_HOME/bin"
  cp "$BIN_DIR/rigel.yeni" "$RIGEL_HOME/bin/rigel.yeni"
  mv -f "$RIGEL_HOME/bin/rigel.yeni" "$RIGEL_HOME/bin/rigel"
  mv -f "$BIN_DIR/rigel.yeni" "$BIN_DIR/rigel"
  tamam "Başlatıcı: $BIN_DIR/rigel"
  case ":$PATH:" in *":$BIN_DIR:"*) ;; *) uyari "$BIN_DIR PATH içinde değil; 'rigel' komutu için ekleyin." ;; esac
}

# ---------- 5. Masaüstü girdisi ve ikonlar ----------
masaustu() {
  local s tmp ok=0
  bilgi "Masaüstü girdisi ve ikonlar"
  mkdir -p "$APPS_DIR"
  render "$ROOT/packaging/linux/rigel.desktop" "RIGEL_RUN=$BIN_DIR/rigel" > "$APPS_DIR/rigel.desktop"
  if command -v desktop-file-validate >/dev/null; then
    desktop-file-validate "$APPS_DIR/rigel.desktop" || uyari "rigel.desktop doğrulamada uyarı verdi (çalışmayı engellemez)."
  fi

  # Hazır PNG'ler (uygulama içi ikonlarla aynı); daha büyükleri araç varsa üretilir.
  for s in 16 32 48 64 128; do
    mkdir -p "$ICONS_DIR/${s}x${s}/apps"
    cp "$ROOT/src/rigel/branding/content/icon$s.png" "$ICONS_DIR/${s}x${s}/apps/rigel.png"
  done
  mkdir -p "$ICONS_DIR/512x512/apps" "$ICONS_DIR/256x256/apps" "$ICONS_DIR/scalable/apps"
  cp "$ROOT/design/logo.png" "$ICONS_DIR/512x512/apps/rigel.png"
  cp "$ROOT/design/logo.svg" "$ICONS_DIR/scalable/apps/rigel.svg"
  tmp="$ICONS_DIR/256x256/apps/rigel.png"
  if command -v rsvg-convert >/dev/null && rsvg-convert -w 256 -h 256 "$ROOT/design/logo.svg" -o "$tmp" 2>/dev/null; then ok=1
  elif command -v magick >/dev/null && magick -background none "$ROOT/design/logo.png" -resize 256x256 "$tmp" 2>/dev/null; then ok=1
  fi
  ((ok)) || rm -f "$tmp"

  command -v update-desktop-database >/dev/null && update-desktop-database -q "$APPS_DIR" 2>/dev/null || true
  command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t -f "$ICONS_DIR" 2>/dev/null || true
  command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true
  tamam "$APPS_DIR/rigel.desktop"
}

# ---------- 6. Profil taşıma ----------
profil_kontrol() { # kaynak profili kurulumdan ÖNCE doğrular
  KAYNAK="$(readlink -f "$PROFIL_KAYNAK" 2>/dev/null || true)"
  [[ -d $KAYNAK ]] || hata "Profil klasörü bulunamadı: $PROFIL_KAYNAK"
  [[ -e $KAYNAK/prefs.js || -e $KAYNAK/places.sqlite ]] || hata "Burası bir Firefox profiline benzemiyor (prefs.js ya da places.sqlite yok): $KAYNAK"
  [[ $KAYNAK != "$(readlink -f "$PROFILE" 2>/dev/null || echo "$PROFILE")" ]] || hata "Kaynak ve hedef aynı profil."
  if profil_acik "$KAYNAK"; then hata "Kaynak profil şu an açık. Tarayıcıyı kapatıp tekrar deneyin (açık profil kopyalanırsa bozulur)."; fi
}

profil_tasi() {
  local kaynak="$KAYNAK"
  if profil_acik "$PROFILE"; then hata "Hedef Rigel profili şu an açık."; fi
  # Hedef "boş" sayılır: yok ya da yalnız chrome/ içeriyor
  if [[ -d $PROFILE ]] && [[ -n "$(find "$PROFILE" -mindepth 1 -maxdepth 1 ! -name chrome ! -name '.rigel-surum' -print -quit)" ]]; then
    uyari "Rigel profili boş değil ($PROFILE); üzerine yazmamak için profil taşınmadı."
    return 0
  fi
  bilgi "Profil kopyalanıyor: $kaynak -> $PROFILE"
  rm -rf "$PROFILE"
  mkdir -p "$PROFILE"
  cp -a "$kaynak/." "$PROFILE/"
  rm -f "$PROFILE/lock" "$PROFILE/.parentlock" "$PROFILE/parent.lock" "$PROFILE/.rigel-surum"
  rm -rf "$PROFILE/startupCache" "$PROFILE/chrome"
  mkdir -p "$PROFILE/chrome/CSS" "$PROFILE/chrome/resources"
  ln -s "$RIGEL_HOME/utils" "$PROFILE/chrome/utils"
  ln -s "$RIGEL_HOME/rigel" "$PROFILE/chrome/JS"
  tamam "Profil taşındı; chrome/ yeni kuruluma bağlandı (kaynak profile dokunulmadı)"
}

# ---------- Akış ----------
[[ -z $PROFIL_KAYNAK ]] || profil_kontrol
printf '%sRigel kurulumu%s  (RIGEL_HOME=%s)\n' "$BD" "$N" "$RIGEL_HOME"

mkdir -p "$RIGEL_HOME"
YUKLU="$(yuklu_firefox_surumu || true)"
if [[ -x $RIGEL_HOME/app/firefox && $YUKLU == "$FF_VER" ]]; then
  tamam "Firefox $FF_VER zaten kurulu; indirme atlandı"
else
  if [[ -n $YUKLU ]]; then
    bilgi "Firefox $YUKLU -> $FF_VER"
    if profil_acik "$PROFILE"; then hata "Rigel açık; Firefox sürümü değişeceği için önce kapatın."; fi
  fi
  firefox_kur
fi
rigel_katmani
rigel_dosyalari
baslatici
masaustu
[[ -z $PROFIL_KAYNAK ]] || profil_tasi

printf '\n%sRigel kuruldu.%s\n' "$G$BD" "$N"
printf '  Başlat:            %s\n' "$BIN_DIR/rigel   (ya da uygulama menüsünden \"Rigel\")"
printf '  Profil:            %s\n' "$PROFILE"
if ! ((GUNCELLE)); then
  printf '  Varsayılan yap:    xdg-settings set default-web-browser rigel.desktop\n'
  printf '                     %s(otomatik değiştirilmedi)%s\n' "$Y" "$N"
fi
printf '  Güncelle:          depoda git pull && ./install.sh --guncelle\n'
printf '  Kaldır:            ./uninstall.sh   (profili silmek için --profil-de)\n'
