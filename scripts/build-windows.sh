#!/usr/bin/env bash
# Windows x64 sürümü:
#   dist/rigel-<VERSION>-windows-x64.zip          taşınabilir (Rigel.cmd ile başlar)
#   dist/rigel-<VERSION>-windows-x64-setup.exe    kurulum programı (Inno Setup; wine ile derlenir; RIGEL_WINDOWS_INSTALLER=0 ile atlanır)
#
# Mozilla'nın resmî "Firefox Setup <sürüm>.exe" dosyası (win64/tr) indirilir, SHA256SUMS ile doğrulanır,
# 7z ile açılır (uygulama core/ içindedir); fx-autoconfig + Rigel dosyaları + tercihler + ilkeler eklenir.
# Windows'ta sembolik bağlantı yok: her şey kopyalanır (Rigel.cmd ya da kurulum programı profile kopyalar).
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/lib/common.sh"
gerekli 7z python3 sha256sum find touch

AD="rigel-$RIGEL_VER-windows-x64"
WORK="$(gecici_dizin windows)"
trap 'inno_kapat 2>/dev/null || true; rm -rf "$WORK"' EXIT
# shellcheck source=lib/inno.sh
source "$ROOT/scripts/lib/inno.sh"
STAGE="$WORK/$AD"

bilgi "Windows x64: Firefox $FF_VER (tr)"
ff_getir "win64/tr/Firefox Setup $FF_VER.exe"

bilgi "Firefox Setup.exe açılıyor (7z)"
mkdir -p "$STAGE" "$WORK/ff"
7z x -y -bd -o"$WORK/ff" "$FF_DOSYA" core >/dev/null || hata "7z Firefox Setup.exe dosyasını açamadı."
[[ -f $WORK/ff/core/firefox.exe ]] || hata "Kurulum dosyasında core/firefox.exe yok."
surum="$(awk -F= '/^\[App\]/{a=1;next} /^\[/{a=0} a && $1=="Version"{print $2; exit}' "$WORK/ff/core/application.ini" | tr -d '\r')"
[[ $surum == "$FF_VER" ]] || hata "Açılan Firefox sürümü ($surum) FIREFOX_VERSION ($FF_VER) ile aynı değil."
mv "$WORK/ff/core" "$STAGE/app"

bilgi "Rigel katmanı ve dosyaları"
rigel_katmani "$STAGE/app"
rigel_dosyalari "$STAGE"
cp "$ROOT/packaging/windows/rigel.ico" "$STAGE/rigel.ico"
cp "$ROOT/packaging/windows/rigel-windows.js" "$STAGE/app/browser/defaults/preferences/rigel-windows.js"
if [[ ${RIGEL_WINDOWS_ICON:-1} != 0 ]]; then
  bilgi "firefox.exe simgesi Rigel simgesiyle değiştiriliyor (wine + rcedit)"
  exe_simgesi "$STAGE/app/firefox.exe" "$STAGE/rigel.ico" && tamam "firefox.exe simgesi: Rigel" || true
fi
cp "$ROOT/LICENSE" "$STAGE/LICENSE"
mkdir -p "$STAGE/licenses"
cp "$ROOT/vendor/fx-autoconfig/LICENSE" "$STAGE/licenses/LICENSE-fx-autoconfig"
# Windows betikleri CRLF ister
crlf() { sed 's/\r$//; s/$/\r/' "$1" > "$2"; }
crlf "$ROOT/packaging/windows/Rigel.cmd" "$STAGE/Rigel.cmd"
cat > "$WORK/README.txt" <<EOT
Rigel $RIGEL_VER (Windows x64, taşınabilir) -- Firefox $FF_VER (tr) üzerine kurulu tarayıcı

Başlatmak için:  Rigel.cmd  (çift tıklayın; adresle de çalışır: Rigel.cmd https://example.com)
Profil:          %LOCALAPPDATA%\\Rigel\\profile  (RIGEL_PROFILE ortam değişkeniyle değiştirilebilir)
Kaldırmak için:  bu klasörü silin; profili silmek için %LOCALAPPDATA%\\Rigel klasörünü silin.

Rigel.cmd ilk açılışta (ve her güncellemede) arayüz dosyalarını profile kopyalar, sonra Firefox'u açar.
Kurulum programı (rigel-$RIGEL_VER-windows-x64-setup.exe) Başlat menüsü kısayolu ve kaldırıcı verir.
Güncelleme otomatik değildir (DisableAppUpdate); yeni sürümü indirip üzerine açın.

Firefox, Mozilla'nın resmî ikilisidir (SHA256'sı Mozilla'nın SHA256SUMS dosyasıyla doğrulanarak paketlendi).
Firefox, Mozilla Foundation'ın tescilli markasıdır; Rigel Mozilla ile bağlantılı değildir.
Rigel kodu MPL-2.0 (LICENSE); fx-autoconfig MPL-2.0 (licenses\\LICENSE-fx-autoconfig).
EOT
crlf "$WORK/README.txt" "$STAGE/README.txt"

# Tutarlılık denetimi: fx-autoconfig ve Rigel dosyaları beklenen yerlerde mi?
for f in app/firefox.exe app/config.js app/defaults/pref/config-prefs.js app/defaults/pref/channel-prefs.js \
         app/distribution/policies.json app/browser/defaults/preferences/rigel.js app/browser/defaults/preferences/rigel-windows.js \
         utils/boot.sys.mjs utils/chrome.manifest rigel/rigel.uc.mjs VERSION rigel.ico Rigel.cmd; do
  [[ -e $STAGE/$f ]] || hata "Paket eksik: $f"
done

# ---------- zip ----------
CIKTI_ZIP="$DIST/$AD.zip"
bilgi "Zip oluşturuluyor ($AD.zip)"
damga_sabitle "$STAGE"
mkdir -p "$DIST"
rm -f "$CIKTI_ZIP"
python3 -I - "$WORK" "$AD" "$CIKTI_ZIP.part" "$SOURCE_DATE_EPOCH" <<'PY'
import os, sys, time, zipfile
work, ad, out, epoch = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
dt = time.gmtime(max(epoch, 315532800))[:6]
entries = []
for dp, dn, fn in os.walk(os.path.join(work, ad)):
    dn.sort()
    for f in sorted(fn):
        p = os.path.join(dp, f)
        entries.append((os.path.relpath(p, work).replace(os.sep, "/"), p))
entries.sort()
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for arc, p in entries:
        zi = zipfile.ZipInfo(arc, dt)
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.create_system = 3
        zi.external_attr = (0o100755 if os.access(p, os.X_OK) else 0o100644) << 16
        with open(p, "rb") as fh:
            z.writestr(zi, fh.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
PY
mv "$CIKTI_ZIP.part" "$CIKTI_ZIP"
tamam "$CIKTI_ZIP ($(boyut "$CIKTI_ZIP"))"

# ---------- Kurulum programı (Inno Setup, wine) ----------
if [[ ${RIGEL_WINDOWS_INSTALLER:-1} != 0 ]]; then
  if inno_hazirla; then
    bilgi "Kurulum programı derleniyor (Inno Setup $INNO_VER, wine)"
    mkdir -p "$WORK/out"
    winstage="$(WINEPREFIX="$WINEPREFIX_RIGEL" winepath -w "$STAGE" 2>/dev/null)"
    if inno_derle "$ROOT/packaging/windows/rigel.iss" "$WORK/out" "/DStage=$winstage" "/DAppVer=$RIGEL_VER" "/DFfVer=$FF_VER" \
       && [[ -s $WORK/out/rigel-$RIGEL_VER-windows-x64-setup.exe ]]; then
      mv -f "$WORK/out/rigel-$RIGEL_VER-windows-x64-setup.exe" "$DIST/"
      tamam "$DIST/rigel-$RIGEL_VER-windows-x64-setup.exe ($(boyut "$DIST/rigel-$RIGEL_VER-windows-x64-setup.exe"))"
    else
      uyari "Inno Setup derlemesi başarısız; yalnız zip üretildi."
    fi
  fi
fi
