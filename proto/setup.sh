#!/usr/bin/env bash
# Faz 1 prototip kurulumu: taşınabilir Firefox + fx-autoconfig + Rigel profili.
# Sistemdeki Firefox'a dokunmaz; her şey proto/ altında kalır. Tekrar çalıştırmak güvenli.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"

if [[ ! -x firefox/firefox ]]; then
  echo "Firefox indiriliyor…"
  curl -fSL -o firefox.tar.xz 'https://download.mozilla.org/?product=firefox-latest-ssl&os=linux64&lang=tr'
  tar -xJf firefox.tar.xz && rm firefox.tar.xz
fi

# Yükleyici yalnız bu Firefox kopyasına kurulur
FXA="$ROOT/vendor/fx-autoconfig"   # depoda tutulan fx-autoconfig (MPL-2.0)
cp "$FXA/program/config.js" firefox/
cp "$FXA/program/defaults/pref/config-prefs.js" firefox/defaults/pref/

# Rigel dağıtımı: ilkeler (telemetri/tanıtım kapalı, eklentiler) ve X11 pencere ikonu
mkdir -p firefox/distribution
cp "$ROOT/distribution/policies.json" firefox/distribution/
for s in 16 32 48 64 128; do
  cp "$ROOT/src/rigel/branding/content/icon$s.png" "firefox/browser/chrome/icons/default/default$s.png"
done

mkdir -p profile/chrome
rm -rf profile/chrome/utils
cp -r "$FXA/profile/chrome/utils" profile/chrome/
ln -sfn "$ROOT/src/rigel" profile/chrome/JS
mkdir -p profile/chrome/CSS profile/chrome/resources
mkdir -p firefox/browser/defaults/preferences
rm -f firefox/defaults/pref/rigel.js
cp "$ROOT/prefs/rigel.js" firefox/browser/defaults/preferences/rigel.js

echo "Hazır. Çalıştır: proto/run.sh  (görev çubuğu ikonu için bir kez: packaging/linux/install-dev.sh)"
