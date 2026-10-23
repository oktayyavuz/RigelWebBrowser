#!/usr/bin/env bash
# Geliştirme kurulumu: rigel.desktop + hicolor ikonları kullanıcı dizinine (~/.local/share). Root gerekmez.
# Exec, bu depodaki proto/run.sh'yi gösterir. Varsayılan tarayıcıyı DEĞİŞTİRMEZ (KDE ayarlarından seçilebilir).
#   packaging/linux/install-dev.sh            kurar
#   packaging/linux/install-dev.sh --remove   kaldırır
set -euo pipefail
ROOT="$(cd "$(dirname "$(readlink -f "$0")")/../.." && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
APPS="$DATA/applications"
ICONS="$DATA/icons/hicolor"
SIZES=(16 22 24 32 48 64 128 256 512)

refresh() {
  command -v update-desktop-database >/dev/null && update-desktop-database -q "$APPS" || true
  command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$ICONS" 2>/dev/null || true
  command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true
}

if [[ ${1:-} == --remove ]]; then
  rm -f "$APPS/rigel.desktop" "$ICONS/scalable/apps/rigel.svg"
  for s in "${SIZES[@]}"; do rm -f "$ICONS/${s}x${s}/apps/rigel.png"; done
  refresh
  echo "Kaldırıldı."
  exit 0
fi

render() { # $1 = boyut, $2 = hedef
  if command -v rsvg-convert >/dev/null; then
    rsvg-convert -w "$1" -h "$1" "$ROOT/design/logo.svg" -o "$2"
  elif command -v magick >/dev/null; then
    magick -background none "$ROOT/design/logo.png" -resize "${1}x${1}" "$2"
  else
    echo "rsvg-convert ya da ImageMagick gerekli." >&2
    exit 1
  fi
}

for s in "${SIZES[@]}"; do
  mkdir -p "$ICONS/${s}x${s}/apps"
  render "$s" "$ICONS/${s}x${s}/apps/rigel.png"
done
mkdir -p "$ICONS/scalable/apps"
cp "$ROOT/design/logo.svg" "$ICONS/scalable/apps/rigel.svg"

chmod +x "$ROOT/proto/run.sh"
mkdir -p "$APPS"
sed "s|@RIGEL_RUN@|$ROOT/proto/run.sh|g" "$ROOT/packaging/linux/rigel.desktop" > "$APPS/rigel.desktop"
command -v desktop-file-validate >/dev/null && desktop-file-validate "$APPS/rigel.desktop" || true
refresh
echo "Kuruldu: $APPS/rigel.desktop (StartupWMClass=rigel, ikon: rigel)"
