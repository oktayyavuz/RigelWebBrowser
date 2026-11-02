#!/bin/sh
# Rigel: Mozilla'nın küçük "firefox" başlatıcı ikilisinin yerine geçer (gerçek ikili: firefox-bin, değişmedi).
#
# Neden: Firefox, masaüstü oturum yöneticisine (KDE/GNOME, XSMP) yeniden başlatma komutu olarak
# "<uygulama>/firefox --sm-client-id …" bildirir. Bilgisayar kapatılıp açılınca oturum geri yüklenirken bu
# ÇIPLAK komut çalışır: --profile ve --name olmadığı için Firefox kendi varsayılan profilini (~/.config/mozilla)
# açar, yani Rigel yerine "çıplak Firefox" gelirdi. Başlatıcı (bin/rigel) MOZ_APP_LAUNCHER ile bunu zaten
# düzeltir; bu betik, eski oturum kayıtlarına ve başka çıplak çağrılara karşı ikinci güvencedir:
# profil verilmediyse Rigel başlatıcısına yönlendirir. Başlatıcının kendisi --profile verdiğinden döngü olmaz.
# Hata ayıklama için RIGEL_ACIK_FIREFOX=1 çıplak Firefox'u açar.
here="$(dirname "$(readlink -f "$0")")"

if [ -z "${RIGEL_ACIK_FIREFOX:-}" ]; then
  for a in "$@"; do
    case "$a" in
      -profile|--profile|-profile=*|--profile=*|-P|-p|-ProfileManager|--ProfileManager|-CreateProfile|--CreateProfile|\
      -version|--version|-v|--full-version|-help|--help|-h|-headless-check)
        exec "$here/firefox-bin" "$@" ;;
    esac
  done
  for l in "$here/../bin/rigel" "${RIGEL_LAUNCHER:-}" "${XDG_BIN_HOME:-${HOME:-/nonexistent}/.local/bin}/rigel" /usr/bin/rigel; do
    if [ -n "$l" ] && [ -x "$l" ]; then exec "$l" "$@"; fi
  done
fi
exec "$here/firefox-bin" "$@"
