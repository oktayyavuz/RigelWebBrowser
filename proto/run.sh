#!/usr/bin/env bash
# Rigel prototipini kendi profiliyle açar. Önbelleği temizler ki JS/CSS değişiklikleri hemen görünsün.
# --name/--class rigel: Wayland app_id ve X11 WM_CLASS "rigel" olur; görev çubuğu rigel.desktop'ı (logo) eşler.
# Rigel zaten açıksa yeni pencere/bağlantı çalışan örneğe gider (uzak adı "rigel", sistem Firefox'undan ayrı).
# Ortam: RIGEL_PROFILE (varsayılan proto/profile), RIGEL_FIREFOX (varsayılan proto/firefox).
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
PROFILE="${RIGEL_PROFILE:-$PWD/profile}"
FIREFOX="${RIGEL_FIREFOX:-$PWD/firefox}"
[[ -x $FIREFOX/firefox ]] || ./setup.sh

if ! pgrep -f -- "--profile $PROFILE( |$)" >/dev/null; then
  mkdir -p "$FIREFOX/browser/defaults/preferences"
  rm -f "$FIREFOX/defaults/pref/rigel.js"
  cp ../prefs/rigel.js "$FIREFOX/browser/defaults/preferences/rigel.js"
  # Eski sürüm tercihleri user.js ile zorluyordu; o dosyayı kaldır ki kullanıcı ayarları kalıcı olsun.
  if [[ -f $PROFILE/user.js ]] && grep -q 'Rigel varsayılan tercihleri' "$PROFILE/user.js"; then rm "$PROFILE/user.js"; fi
  rm -rf "$PROFILE/startupCache"
  set -- -purgecaches "$@"
fi
exec "$FIREFOX/firefox" --name rigel --class rigel --profile "$PROFILE" "$@"
