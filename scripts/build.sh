#!/usr/bin/env bash
# Rigel sürüm paketlerini üretir -> dist/
#
#   scripts/build.sh [linux|windows|all]      (varsayılan: all)
#
# Üretilenler (VERSION dosyasındaki sürümle):
#   dist/rigel-<VERSION>-linux-x86_64.tar.xz   Linux x86_64 (Firefox dahil, kurulum betiğiyle)
#   dist/rigel-<VERSION>-x86_64.AppImage       isteğe bağlı (appimagetool varsa ya da RIGEL_APPIMAGE=1)
#   dist/rigel-<VERSION>-windows-x64.zip       Windows taşınabilir sürüm
#   dist/rigel-<VERSION>-windows-x64-setup.exe Windows kurulum programı (Inno Setup; wine ile derlenir)
#   dist/SHA256SUMS
#
# Firefox indirmeleri ~/.cache/rigel-build altında önbelleğe alınır ve Mozilla'nın SHA256SUMS dosyasıyla doğrulanır.
# Ortam: RIGEL_DIST, RIGEL_BUILD_CACHE, RIGEL_ARCHIVE_URL, SOURCE_DATE_EPOCH, RIGEL_APPIMAGE=0|1,
#        RIGEL_XZ_LEVEL (varsayılan 6), RIGEL_WINDOWS_INSTALLER=0 (yalnız zip), RIGEL_WINE_PREFIX.
set -euo pipefail
BETIK="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
# shellcheck source=lib/common.sh
source "$BETIK/lib/common.sh"

yardim() { sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

HEDEF="${1:-all}"
case "$HEDEF" in
  linux|windows|all) ;;
  -h|--help|--yardim) yardim; exit 0 ;;
  *) yardim >&2; hata "Bilinmeyen hedef: '$HEDEF' (linux, windows ya da all)" ;;
esac
gerekli sha256sum

printf '%sRigel %s%s  (Firefox %s)  hedef: %s  ->  %s\n' "$BD" "$RIGEL_VER" "$N" "$FF_VER" "$HEDEF" "$DIST"
mkdir -p "$DIST" "$CACHE"

SONUC=0
calistir() { # calistir <betik>: biri düşerse diğeri yine denenir, çıkış kodu 1 olur
  if ! "$BETIK/$1"; then uyari "$1 başarısız oldu."; SONUC=1; fi
}
[[ $HEDEF == linux   || $HEDEF == all ]] && calistir build-linux.sh
[[ $HEDEF == windows || $HEDEF == all ]] && calistir build-windows.sh

# ---------- SHA256SUMS ----------
(
  cd "$DIST"
  shopt -s nullglob
  dosyalar=(rigel-"$RIGEL_VER"-*.tar.xz rigel-"$RIGEL_VER"-*.zip rigel-"$RIGEL_VER"-*.exe rigel-"$RIGEL_VER"-*.AppImage)
  if ((${#dosyalar[@]})); then
    sha256sum "${dosyalar[@]}" > SHA256SUMS
  fi
)
printf '\n%sArtefaktlar%s (%s)\n' "$BD" "$N" "$DIST"
if [[ -s $DIST/SHA256SUMS ]]; then
  while read -r ozet ad; do
    ad="${ad#\*}"
    printf '  %-48s %8s  %s\n' "$ad" "$(boyut "$DIST/$ad")" "$ozet"
  done < "$DIST/SHA256SUMS"
else
  echo "  (yok)"
fi
exit "$SONUC"
