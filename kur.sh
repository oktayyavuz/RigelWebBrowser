#!/usr/bin/env bash
# Rigel hızlı kurulum ve güncelleme (Linux x86_64). Yazar: Oktay Yavuz
#
#   curl -fsSL https://raw.githubusercontent.com/oktayyavuz/rigeldesktop/main/kur.sh | bash
#
# GitHub'daki son sürümü indirir, SHA256SUMS ile doğrular ve arşivin kendi install.sh'ını çalıştırır.
# Root gerekmez; her şey ~/.local/share/rigel altına kurulur, profil korunur. Tekrar çalıştırmak = güncelleme.
set -euo pipefail

REPO="oktayyavuz/rigeldesktop"
BASE="https://github.com/$REPO/releases/latest/download"

hata() { printf '\033[31m✗ Hata:\033[0m %s\n' "$*" >&2; exit 1; }
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || hata "Yalnız Linux x86_64 destekleniyor."
for k in tar xz sha256sum; do command -v "$k" >/dev/null || hata "'$k' gerekli."; done
if command -v curl >/dev/null; then indir() { curl -fL --retry 3 --progress-bar -o "$2" "$1"; }
elif command -v wget >/dev/null; then indir() { wget -q --show-progress -O "$2" "$1"; }
else hata "'curl' ya da 'wget' gerekli."; fi

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
printf '==> Son sürüm aranıyor\n'
indir "$BASE/SHA256SUMS" "$tmp/SHA256SUMS"
ad="$(grep -oE 'rigel-[0-9][0-9.]*-linux-x86_64\.tar\.xz' "$tmp/SHA256SUMS" | head -n1)"
[[ -n $ad ]] || hata "Sürümde Linux arşivi bulunamadı."
printf '==> %s indiriliyor\n' "$ad"
indir "$BASE/$ad" "$tmp/$ad"
(cd "$tmp" && grep "  $ad\$" SHA256SUMS | sha256sum -c --quiet -) || hata "SHA256 doğrulaması başarısız."
printf '==> Doğrulandı, kuruluyor\n'
tar -xJf "$tmp/$ad" -C "$tmp"
"$tmp/${ad%.tar.xz}/install.sh" "$@"
