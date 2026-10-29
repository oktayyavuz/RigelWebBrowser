# Rigel derleme betiklerinin ortak işlevleri. Doğrudan çalıştırılmaz; `source` edilir.
# shellcheck shell=bash

[[ -n ${RIGEL_COMMON_YUKLU:-} ]] && return 0
RIGEL_COMMON_YUKLU=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="${RIGEL_DIST:-$ROOT/dist}"
CACHE="${RIGEL_BUILD_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/rigel-build}"
ARCHIVE_URL="${RIGEL_ARCHIVE_URL:-https://archive.mozilla.org/pub/firefox/releases}"

if [[ -t 1 ]]; then
  R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[34m'; BD=$'\033[1m'; N=$'\033[0m'
else
  R=''; G=''; Y=''; B=''; BD=''; N=''
fi
bilgi()  { printf '%s==>%s %s\n' "$B$BD" "$N" "$*"; }
tamam()  { printf ' %s✓%s %s\n' "$G" "$N" "$*"; }
uyari()  { printf ' %s!%s %s\n' "$Y" "$N" "$*" >&2; }
hata()   { printf '%s✗ Hata:%s %s\n' "$R$BD" "$N" "$*" >&2; exit 1; }

gerekli() { # gerekli <komut>…
  local c
  for c in "$@"; do command -v "$c" >/dev/null || hata "'$c' komutu gerekli."; done
}

# ---------- Sürümler ----------
FF_VER="$(tr -d '[:space:]' < "$ROOT/FIREFOX_VERSION")"
[[ $FF_VER =~ ^[0-9]+(\.[0-9]+){1,2}$ ]] || hata "FIREFOX_VERSION geçersiz: '$FF_VER'"
RIGEL_VER="$(tr -d '[:space:]' < "$ROOT/VERSION")"
[[ $RIGEL_VER =~ ^[0-9]+(\.[0-9]+){1,3}([-+.][0-9A-Za-z.]+)?$ ]] || hata "VERSION geçersiz: '$RIGEL_VER'"

# Tekrarlanabilirlik: arşivlerdeki zaman damgaları. Verilmezse HEAD işleminin zamanı.
if [[ -z ${SOURCE_DATE_EPOCH:-} ]]; then
  SOURCE_DATE_EPOCH="$(git -C "$ROOT" log -1 --format=%ct 2>/dev/null || date +%s)"
fi
export SOURCE_DATE_EPOCH

# ---------- İndirme ----------
if command -v curl >/dev/null; then DL=curl
elif command -v wget >/dev/null; then DL=wget
else DL=""; fi

indir() { # indir <adres> <hedef|-> [ilerleme=1]
  [[ -n $DL ]] || hata "curl ya da wget gerekli."
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

sha_of() { sha256sum "$1" | awk '{print $1}'; }

# Mozilla SHA256SUMS dosyası (sürüm başına bir kez alınır)
_FF_SUMS=""
ff_sums() {
  if [[ -z $_FF_SUMS ]]; then
    _FF_SUMS="$(indir "$ARCHIVE_URL/$FF_VER/SHA256SUMS" - 0)" \
      || hata "SHA256SUMS indirilemedi: $ARCHIVE_URL/$FF_VER/SHA256SUMS"
  fi
  printf '%s\n' "$_FF_SUMS"
}

# ff_getir <arşivdeki yol, ör. linux-x86_64/tr/firefox-158.0.1.tar.xz>
# Önbelleğe indirir, SHA256'yı Mozilla'nın listesiyle doğrular; dosya yolunu FF_DOSYA'ya yazar.
ff_getir() {
  local yol="$1" beklenen gercek ad hedef
  ad="$(basename "$yol")"
  hedef="$CACHE/$FF_VER/${yol%%/*}/$ad"
  mkdir -p "$(dirname "$hedef")"
  beklenen="$(ff_sums | awk -v p="$yol" '{ n=$0; sub(/^[0-9a-f]+ +/, "", n); if (n==p) r=$1 } END { print r }')"
  [[ $beklenen =~ ^[0-9a-f]{64}$ ]] || hata "SHA256SUMS içinde '$yol' satırı yok."
  if [[ -f $hedef ]]; then
    gercek="$(sha_of "$hedef")"
    if [[ $gercek == "$beklenen" ]]; then
      tamam "Önbellekteki dosya geçerli: $hedef"
      FF_DOSYA="$hedef"; return 0
    fi
    uyari "Önbellekteki '$ad' özeti uyuşmuyor; yeniden indiriliyor."
    rm -f "$hedef"
  fi
  local url="$ARCHIVE_URL/$FF_VER/${yol// /%20}"
  bilgi "İndiriliyor: $url"
  indir "$url" "$hedef.part" 1 || { rm -f "$hedef.part"; hata "İndirilemedi: $url"; }
  gercek="$(sha_of "$hedef.part")"
  if [[ $gercek != "$beklenen" ]]; then
    rm -f "$hedef.part"
    hata "SHA256 UYUŞMUYOR ($ad)! Beklenen $beklenen, gelen $gercek. Dosya silindi."
  fi
  mv "$hedef.part" "$hedef"
  tamam "SHA256 doğrulandı: $beklenen"
  FF_DOSYA="$hedef"
}

# ---------- Rigel katmanı ----------
# rigel_katmani <firefox uygulama dizini>
# fx-autoconfig, ilkeler, varsayılan tercihler ve X11/Wayland pencere ikonları (install.sh ile aynı yerleşim).
rigel_katmani() {
  local app="$1" f n
  cp "$ROOT/vendor/fx-autoconfig/program/config.js" "$app/config.js"
  mkdir -p "$app/defaults/pref"
  cp "$ROOT/vendor/fx-autoconfig/program/defaults/pref/config-prefs.js" "$app/defaults/pref/config-prefs.js"
  mkdir -p "$app/distribution"
  cp "$ROOT/distribution/policies.json" "$app/distribution/policies.json"
  # Varsayılan tercihler browser/defaults/preferences altına (defaults/pref'e değil: firefox.js onları ezerdi)
  mkdir -p "$app/browser/defaults/preferences"
  rm -f "$app/defaults/pref/rigel.js"
  cp "$ROOT/prefs/rigel.js" "$app/browser/defaults/preferences/rigel.js"
  mkdir -p "$app/browser/chrome/icons/default"
  for f in "$ROOT"/src/rigel/branding/content/icon*.png; do
    n="$(basename "$f" .png)"; n="${n#icon}"
    [[ $n =~ ^[0-9]+$ ]] && cp "$f" "$app/browser/chrome/icons/default/default$n.png"
  done
  return 0
}

# rigel_dosyalari <hedef kök>: <hedef>/rigel, <hedef>/utils, <hedef>/VERSION
rigel_dosyalari() {
  local hedef="$1" damga
  mkdir -p "$hedef"
  cp -a "$ROOT/src/rigel" "$hedef/rigel"
  cp -a "$ROOT/vendor/fx-autoconfig/profile/chrome/utils" "$hedef/utils"
  # Geliştirme artığı olabilecek dosyalar paketlenmez
  find "$hedef/rigel" \( -name '*.orig' -o -name '*.rej' -o -name '*~' -o -name '.DS_Store' -o -name 'node_modules' \) -prune -exec rm -rf {} + 2>/dev/null || true
  # Sürüm damgası: install.sh ile aynı biçim (VERSION-içerikÖzeti)
  damga="$(cd "$ROOT" && { find src/rigel prefs distribution -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum; } | sha256sum | cut -c1-12)"
  printf '%s-%s\n' "$RIGEL_VER" "$damga" > "$hedef/VERSION"
}

# Dizindeki bütün dosya/dizinlerin zaman damgasını SOURCE_DATE_EPOCH yapar (tekrarlanabilir arşiv için)
damga_sabitle() {
  find "$1" -print0 | xargs -0 touch -h -d "@$SOURCE_DATE_EPOCH"
}

# Geçici çalışma klasörü: /tmp çoğu sistemde RAM'dedir (Firefox açılınca yüzlerce MB), bu yüzden önbellek diskinde açılır.
gecici_dizin() { # gecici_dizin <önek>
  mkdir -p "$CACHE/work"
  mktemp -d "$CACHE/work/$1.XXXXXX"
}

# ---------- Çıktı ----------
boyut() { du -h "$1" | awk '{print $1}'; }
