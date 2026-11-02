#!/usr/bin/env bash
# Rigel'i kaldırır (install.sh'nin kurduğu her şey). Profil (yer imleri, geçmiş, ayarlar) varsayılan olarak KALIR.
#   ./uninstall.sh                kaldırır, profili korur
#   ./uninstall.sh --profil-de    profili de siler (onay ister)
#   ./uninstall.sh --evet         soru sormaz
set -euo pipefail

if [[ -t 1 ]]; then R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[34m'; BD=$'\033[1m'; N=$'\033[0m'
else R=''; G=''; Y=''; B=''; BD=''; N=''; fi
bilgi() { printf '%s==>%s %s\n' "$B$BD" "$N" "$*"; }
tamam() { printf ' %s✓%s %s\n' "$G" "$N" "$*"; }
uyari() { printf ' %s!%s %s\n' "$Y" "$N" "$*" >&2; }
hata()  { printf '%s✗ Hata:%s %s\n' "$R$BD" "$N" "$*" >&2; exit 1; }

PROFIL_DE=0; EVET=0
while (($#)); do
  case "$1" in
    --profil-de) PROFIL_DE=1 ;;
    --evet|--yes|-y) EVET=1 ;;
    --yardim|--help|-h)
      echo "Kullanım: ./uninstall.sh [--profil-de] [--evet]"
      echo "  --profil-de  profili de siler (yer imleri, geçmiş, ayarlar; geri alınamaz)"
      echo "  --evet       onay sormaz"
      echo "Ortam: RIGEL_HOME, RIGEL_BIN_DIR (install.sh ile aynı)"
      exit 0 ;;
    *) hata "Bilinmeyen seçenek: $1" ;;
  esac
  shift
done

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
RIGEL_HOME="${RIGEL_HOME:-$DATA_HOME/rigel}"
BIN_DIR="${RIGEL_BIN_DIR:-$HOME/.local/bin}"
APPS_DIR="$DATA_HOME/applications"
ICONS_DIR="$DATA_HOME/icons/hicolor"
case "$RIGEL_HOME" in ''|/|"$HOME") hata "RIGEL_HOME güvenli bir klasör değil: '$RIGEL_HOME'" ;; esac

# Rigel açıkken kaldırma
if [[ -L $RIGEL_HOME/profile/lock ]]; then
  t="$(readlink "$RIGEL_HOME/profile/lock" || true)"; pid="${t##*+}"
  if [[ $pid =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    hata "Rigel şu an açık (pid $pid). Önce kapatın."
  fi
fi

onay() { # $1 = soru
  ((EVET)) && return 0
  if [[ ! -t 0 ]]; then uyari "Etkileşimli değil; onay için --evet verin."; return 1; fi
  local c; read -r -p "$1 [e/H] " c || return 1
  [[ $c == e || $c == E || $c == evet ]]
}

if [[ ! -e $RIGEL_HOME/app && ! -e $RIGEL_HOME/VERSION && ! -e $BIN_DIR/rigel && ! -e $APPS_DIR/rigel.desktop ]] \
   && { ((! PROFIL_DE)) || [[ ! -e $RIGEL_HOME/profile ]]; }; then
  echo "Rigel kurulu görünmüyor ($RIGEL_HOME)."
  [[ -d $RIGEL_HOME/profile ]] && echo "  Kalan profili silmek için: ./uninstall.sh --profil-de"
  exit 0
fi

if ((PROFIL_DE)); then
  onay "${R}Profil de silinecek${N} ($RIGEL_HOME/profile: yer imleri, geçmiş, parolalar, ayarlar). Emin misiniz?" \
    || { echo "Vazgeçildi."; exit 1; }
fi
onay "Rigel kaldırılsın mı? ($RIGEL_HOME)" || { echo "Vazgeçildi."; exit 1; }

bilgi "Kaldırılıyor"
rm -rf "$RIGEL_HOME/app" "$RIGEL_HOME/bin" "$RIGEL_HOME/rigel" "$RIGEL_HOME/utils" "$RIGEL_HOME/VERSION" \
       "$RIGEL_HOME"/.app-yeni.* "$RIGEL_HOME"/.rigel-yeni.* "$RIGEL_HOME/app.eski" "$RIGEL_HOME/rigel.eski" "$RIGEL_HOME/utils.eski"
rm -f "$BIN_DIR/rigel" "$BIN_DIR/rigel.yeni" "$APPS_DIR/rigel.desktop" "$ICONS_DIR/scalable/apps/rigel.svg"
for d in "$ICONS_DIR"/*x*/apps; do rm -f "$d/rigel.png"; done
rm -rf "$CACHE_HOME/rigel"
tamam "Uygulama, başlatıcı, masaüstü girdisi, ikonlar ve indirme önbelleği silindi"

if ((PROFIL_DE)); then
  rm -rf "$RIGEL_HOME/profile"
  tamam "Profil silindi"
else
  [[ -d $RIGEL_HOME/profile ]] && echo "  Profil korundu: $RIGEL_HOME/profile  (silmek için: ./uninstall.sh --profil-de)"
fi
rmdir "$RIGEL_HOME" 2>/dev/null || true

command -v update-desktop-database >/dev/null && update-desktop-database -q "$APPS_DIR" 2>/dev/null || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t -f "$ICONS_DIR" 2>/dev/null || true
command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true
printf '%sRigel kaldırıldı.%s\n' "$G$BD" "$N"
