#!/usr/bin/env bash
# Linux x86_64 sürüm arşivi: dist/rigel-<VERSION>-linux-x86_64.tar.xz
# (İsteğe bağlı) appimagetool varsa dist/rigel-<VERSION>-x86_64.AppImage de üretilir.
#
#   scripts/build-linux.sh          (genellikle scripts/build.sh linux üzerinden çağrılır)
#
# Arşiv kendi içinde tamdır: Firefox + fx-autoconfig + Rigel dosyaları + başlatıcı + masaüstü girdisi + ikonlar
# + install.sh/uninstall.sh. Çıkarıp doğrudan ./rigel ile çalıştırılabilir ya da ./install.sh ile kurulabilir.
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/lib/common.sh"
gerekli tar xz sha256sum awk find sort touch

AD="rigel-$RIGEL_VER-linux-x86_64"
CIKTI="$DIST/$AD.tar.xz"
WORK="$(gecici_dizin linux)"
trap 'rm -rf "$WORK"' EXIT
STAGE="$WORK/$AD"

bilgi "Linux x86_64: Firefox $FF_VER (tr)"
ff_getir "linux-x86_64/tr/firefox-$FF_VER.tar.xz"

bilgi "Firefox açılıyor"
mkdir -p "$STAGE" "$WORK/ff"
tar -xJf "$FF_DOSYA" -C "$WORK/ff" --no-same-owner
[[ -x $WORK/ff/firefox/firefox ]] || hata "Firefox arşivinde firefox/firefox yok."
mv "$WORK/ff/firefox" "$STAGE/app"

bilgi "Rigel katmanı ve dosyaları"
rigel_katmani "$STAGE/app"
rigel_dosyalari "$STAGE"

# Başlatıcı (bin/rigel): konumunun bir üstünü RIGEL_HOME alır; profil her zaman ~/.local/share/rigel/profile (RIGEL_PROFILE ile değişir)
mkdir -p "$STAGE/share" "$STAGE/bin"
cp "$ROOT/packaging/linux/rigel.sh.in" "$STAGE/share/rigel.sh.in"
RH_ifade='$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)'
PF_ifade='${XDG_DATA_HOME:-$HOME/.local/share}/rigel/profile'
{
  icerik="$(<"$ROOT/packaging/linux/rigel.sh.in")"
  icerik="${icerik//@RIGEL_HOME@/"$RH_ifade"}"
  icerik="${icerik//@PROFILE_DEFAULT@/"$PF_ifade"}"
  printf '%s\n' "$icerik"
} > "$STAGE/bin/rigel"
chmod 755 "$STAGE/bin/rigel"

# Masaüstü girdisi (Exec PATH'teki "rigel"; install.sh mutlak yola çevirir)
sed 's|@RIGEL_RUN@|rigel|g' "$ROOT/packaging/linux/rigel.desktop" > "$STAGE/rigel.desktop"

# İkonlar
ICO="$STAGE/share/icons/hicolor"
for s in 16 32 48 64 128; do
  mkdir -p "$ICO/${s}x${s}/apps"
  cp "$ROOT/src/rigel/branding/content/icon$s.png" "$ICO/${s}x${s}/apps/rigel.png"
done
mkdir -p "$ICO/256x256/apps" "$ICO/512x512/apps" "$ICO/scalable/apps"
cp "$ROOT/design/logo.png" "$ICO/512x512/apps/rigel.png"
cp "$ROOT/design/logo.svg" "$ICO/scalable/apps/rigel.svg"
if command -v rsvg-convert >/dev/null && rsvg-convert -w 256 -h 256 "$ROOT/design/logo.svg" -o "$ICO/256x256/apps/rigel.png" 2>/dev/null; then :
elif command -v magick >/dev/null && magick -background none "$ROOT/design/logo.png" -resize 256x256 "$ICO/256x256/apps/rigel.png" 2>/dev/null; then :
else rm -f "$ICO/256x256/apps/rigel.png"; fi
cp "$ROOT/design/logo.png" "$STAGE/rigel.png"

# Kurulum / kaldırma / lisans
cp "$ROOT/packaging/linux/tarball-install.sh" "$STAGE/install.sh"
cp "$ROOT/uninstall.sh" "$STAGE/uninstall.sh"
chmod 755 "$STAGE/install.sh" "$STAGE/uninstall.sh"
mkdir -p "$STAGE/share/licenses"
cp "$ROOT/LICENSE" "$STAGE/LICENSE"
cp "$ROOT/vendor/fx-autoconfig/LICENSE" "$STAGE/share/licenses/LICENSE-fx-autoconfig"
cat > "$STAGE/README.txt" <<EOT
Rigel $RIGEL_VER (Linux x86_64) -- Firefox $FF_VER (tr) üzerine kurulu tarayıcı

Hemen dene (kurmadan):   ./bin/rigel
Kur (kullanıcı dizinine): ./install.sh      -> ~/.local/share/rigel, ~/.local/bin/rigel, uygulama menüsü girdisi
Kaldır:                   ./uninstall.sh    (profili silmek için --profil-de)

Profil: ~/.local/share/rigel/profile (RIGEL_PROFILE ile değiştirilebilir).
Firefox, Mozilla'nın resmî ikilisidir (SHA256'sı Mozilla'nın SHA256SUMS dosyasıyla doğrulanarak paketlendi).
Firefox, Mozilla Foundation'ın tescilli markasıdır; Rigel Mozilla ile bağlantılı değildir.
Rigel kodu MPL-2.0 (LICENSE); fx-autoconfig MPL-2.0 (share/licenses/LICENSE-fx-autoconfig).
EOT

# Tutarlılık denetimi: arşiv beklenen yerleşimi taşıyor mu?
for f in app/firefox app/config.js app/defaults/pref/config-prefs.js app/distribution/policies.json \
         app/browser/defaults/preferences/rigel.js utils/boot.sys.mjs rigel/rigel.uc.mjs VERSION bin/rigel install.sh uninstall.sh rigel.desktop; do
  [[ -e $STAGE/$f ]] || hata "Paket eksik: $f"
done

bilgi "Arşivleniyor ($AD.tar.xz)"
damga_sabitle "$STAGE"
mkdir -p "$DIST"
rm -f "$CIKTI"
# Sıralı, sahipsiz, sabit zaman damgalı tar; xz tek iş parçacığı bloğuna bağlı değil (-T ile aynı çıktı)
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime="@$SOURCE_DATE_EPOCH" \
    -C "$WORK" -cf - "$AD" | xz -T"${RIGEL_XZ_THREADS:-0}" -${RIGEL_XZ_LEVEL:-6} > "$CIKTI.part"
mv "$CIKTI.part" "$CIKTI"
tamam "$CIKTI ($(boyut "$CIKTI"))"

# ---------- İsteğe bağlı: AppImage ----------
if [[ ${RIGEL_APPIMAGE:-auto} != 0 ]]; then
  # shellcheck source=lib/appimage.sh
  source "$ROOT/scripts/lib/appimage.sh"
  appimage_uret "$STAGE" "$DIST/rigel-$RIGEL_VER-x86_64.AppImage" || uyari "AppImage üretilemedi (atlandı)."
fi
