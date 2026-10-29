#!/usr/bin/env bash
# Rigel kurulumu (hazır arşivden, Linux x86_64). Root gerekmez; her şey kullanıcı dizinine kurulur.
#
#   tar -xf rigel-<sürüm>-linux-x86_64.tar.xz && cd rigel-<sürüm>-linux-x86_64 && ./install.sh
#
# Ne yapar: bu klasörü (Firefox + Rigel) RIGEL_HOME altına kopyalar; ~/.local/bin/rigel başlatıcısını,
# masaüstü girdisini ve ikonları yazar. Profil RIGEL_HOME/profile altında kalır ve ASLA silinmez/üzerine yazılmaz.
# Tekrar çalıştırmak güvenlidir (güncelleme). Varsayılan tarayıcıyı DEĞİŞTİRMEZ. İnternet gerekmez.
set -euo pipefail

HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

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
  cat <<EOF2
${BD}Rigel kurulumu${N}

Kullanım: ./install.sh [--yardim]

Ortam değişkenleri:
  RIGEL_HOME      Kurulum klasörü (varsayılan: \$XDG_DATA_HOME/rigel = ~/.local/share/rigel)
  RIGEL_BIN_DIR   Başlatıcının yeri (varsayılan: ~/.local/bin)

Kurulan yerler:
  \$RIGEL_HOME/{app,rigel,utils,VERSION}, \$RIGEL_BIN_DIR/rigel,
  \$XDG_DATA_HOME/applications/rigel.desktop, \$XDG_DATA_HOME/icons/hicolor/*/apps/rigel.*
Profil: \$RIGEL_HOME/profile (kaldırırken de korunur; silmek için ./uninstall.sh --profil-de)
EOF2
}
case "${1:-}" in
  --yardim|--help|-h) yardim; exit 0 ;;
  '') ;;
  *) uyari "Bilinmeyen seçenek: $1"; yardim >&2; exit 2 ;;
esac

[[ $(uname -s) == Linux ]] || hata "Bu arşiv yalnız Linux içindir."
case "$(uname -m)" in x86_64|amd64) ;; *) hata "Yalnız x86_64 desteklenir (bu makine: $(uname -m))." ;; esac
for f in app/firefox rigel/rigel.uc.mjs utils VERSION share/rigel.sh.in rigel.desktop; do
  [[ -e $HERE/$f ]] || hata "Arşivde $f yok; arşiv eksik ya da bozuk."
done

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
RIGEL_HOME="${RIGEL_HOME:-$DATA_HOME/rigel}"
BIN_DIR="${RIGEL_BIN_DIR:-$HOME/.local/bin}"
APPS_DIR="$DATA_HOME/applications"
ICONS_DIR="$DATA_HOME/icons/hicolor"
PROFILE="$RIGEL_HOME/profile"
case "$RIGEL_HOME" in ''|/|"$HOME") hata "RIGEL_HOME güvenli bir klasör değil: '$RIGEL_HOME'" ;; esac
[[ $(readlink -f "$RIGEL_HOME") != "$HERE" ]] || hata "Kurulum klasörü arşivin açıldığı klasörle aynı olamaz: $HERE"

profil_acik() { # Firefox "lock" bağlantısı: "ip:+pid"
  local t pid
  [[ -L $1/lock ]] || return 1
  t="$(readlink "$1/lock" || true)"; pid="${t##*+}"
  [[ $pid =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null
}

degistir() { # degistir <yeni içerik> <hedef> (atomik dizin değişimi)
  local yeni="$1" hedef="$2"
  rm -rf "$hedef.eski"
  if [[ -e $hedef ]]; then mv "$hedef" "$hedef.eski"; fi
  mv "$yeni" "$hedef"
  rm -rf "$hedef.eski"
}

render() { # render <şablon> <anahtar=değer>…
  local icerik kv
  icerik="$(<"$1")"; shift
  for kv in "$@"; do icerik="${icerik//"@${kv%%=*}@"/"${kv#*=}"}"; done
  printf '%s\n' "$icerik"
}

printf '%sRigel kurulumu%s  (RIGEL_HOME=%s)\n' "$BD" "$N" "$RIGEL_HOME"
if profil_acik "$PROFILE"; then
  uyari "Rigel şu an açık. Yeni sürüm, tarayıcıyı kapatıp yeniden açınca yüklenir."
  [[ $(cat "$RIGEL_HOME/VERSION" 2>/dev/null || true) == "$(<"$HERE/VERSION")" ]] \
    || hata "Rigel açıkken uygulama dosyaları değiştirilemez; önce kapatın."
fi

# ---------- Dosyalar ----------
bilgi "Dosyalar kopyalanıyor"
mkdir -p "$RIGEL_HOME"
tmp="$(mktemp -d "$RIGEL_HOME/.yeni.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
for d in app rigel utils; do
  cp -a "$HERE/$d" "$tmp/$d"
  degistir "$tmp/$d" "$RIGEL_HOME/$d"
done
cp "$HERE/VERSION" "$RIGEL_HOME/VERSION"
tamam "Rigel $(<"$RIGEL_HOME/VERSION") -> $RIGEL_HOME"

# ---------- Başlatıcı ----------
mkdir -p "$BIN_DIR"
render "$HERE/share/rigel.sh.in" "RIGEL_HOME=$RIGEL_HOME" 'PROFILE_DEFAULT=$RIGEL_HOME/profile' > "$BIN_DIR/rigel.yeni"
chmod 755 "$BIN_DIR/rigel.yeni"
mv -f "$BIN_DIR/rigel.yeni" "$BIN_DIR/rigel"
tamam "Başlatıcı: $BIN_DIR/rigel"
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) uyari "$BIN_DIR PATH içinde değil; 'rigel' komutu için ekleyin." ;; esac

# ---------- Masaüstü girdisi ve ikonlar ----------
bilgi "Masaüstü girdisi ve ikonlar"
mkdir -p "$APPS_DIR"
ara='Exec="rigel"'; yeni="Exec=\"$BIN_DIR/rigel\""
icerik="$(<"$HERE/rigel.desktop")"
printf '%s\n' "${icerik//"$ara"/"$yeni"}" > "$APPS_DIR/rigel.desktop"
if command -v desktop-file-validate >/dev/null; then
  desktop-file-validate "$APPS_DIR/rigel.desktop" || uyari "rigel.desktop doğrulamada uyarı verdi (çalışmayı engellemez)."
fi
if [[ -d $HERE/share/icons/hicolor ]]; then
  mkdir -p "$ICONS_DIR"
  cp -a "$HERE/share/icons/hicolor/." "$ICONS_DIR/"
fi
command -v update-desktop-database >/dev/null && update-desktop-database -q "$APPS_DIR" 2>/dev/null || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t -f "$ICONS_DIR" 2>/dev/null || true
command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true
tamam "$APPS_DIR/rigel.desktop"

printf '\n%sRigel kuruldu.%s\n' "$G$BD" "$N"
printf '  Başlat:            %s/rigel   (ya da uygulama menüsünden "Rigel")\n' "$BIN_DIR"
printf '  Profil:            %s\n' "$PROFILE"
printf '  Varsayılan yap:    xdg-settings set default-web-browser rigel.desktop\n'
printf '                     %s(otomatik değiştirilmedi)%s\n' "$Y" "$N"
printf '  Güncelle:          yeni arşivi açıp ./install.sh çalıştırın\n'
printf '  Kaldır:            ./uninstall.sh   (profili silmek için --profil-de)\n'
