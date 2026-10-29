# Inno Setup'ı wine altında hazırlar ve çağırır (Windows kurulum programı için). common.sh yüklü olmalı. `source` edilir.
# shellcheck shell=bash
#
# Kurulum: resmî Inno Setup (jrsoftware/issrc GitHub sürümü) ~/.cache/rigel-build altına indirilir, SHA256 ile
# doğrulanır ve ayrı bir WINEPREFIX'e (varsayılan ~/.cache/rigel-build/wine) sessizce kurulur.
# Kullanıcının kendi ~/.wine önekine DOKUNULMAZ.

INNO_VER="6.7.4"
INNO_URL="https://github.com/jrsoftware/issrc/releases/download/is-6_7_4/innosetup-$INNO_VER.exe"
# GitHub'ın yayımladığı SHA256 ile aynıdır (api.github.com/repos/jrsoftware/issrc/releases/tags/is-6_7_4)
INNO_SHA256="a549929319f9120716677c685535ca4671e4b937b5fdc87e2585f32d8eb30e8c"
WINEPREFIX_RIGEL="${RIGEL_WINE_PREFIX:-$CACHE/wine}"

wine_calistir() { # wine_calistir <wine argümanları…>: yalnız Rigel'in önekinde, sessiz
  WINEPREFIX="$WINEPREFIX_RIGEL" WINEARCH=win64 WINEDEBUG=-all WINEDLLOVERRIDES="mscoree,mshtml=d" \
    wine "$@" 2>/dev/null
}

inno_hazirla() { # ISCC'nin Windows yolunu INNO_ISCC'ye yazar; olmazsa 1 döner
  command -v wine >/dev/null || { uyari "wine yok; kurulum programı (Inno Setup) atlandı."; return 1; }
  local ISCC="$WINEPREFIX_RIGEL/drive_c/InnoSetup/ISCC.exe"
  if [[ ! -f $ISCC ]]; then
    local exe="$CACHE/innosetup-$INNO_VER.exe"
    if [[ -f $exe && $(sha_of "$exe") != "$INNO_SHA256" ]]; then rm -f "$exe"; fi
    if [[ ! -f $exe ]]; then
      bilgi "Inno Setup $INNO_VER indiriliyor"
      indir "$INNO_URL" "$exe.part" 1 || { rm -f "$exe.part"; uyari "Inno Setup indirilemedi."; return 1; }
      if [[ $(sha_of "$exe.part") != "$INNO_SHA256" ]]; then
        rm -f "$exe.part"; uyari "Inno Setup SHA256 UYUŞMUYOR; kullanılmadı."; return 1
      fi
      mv "$exe.part" "$exe"
    fi
    bilgi "Inno Setup wine altına kuruluyor ($WINEPREFIX_RIGEL)"
    mkdir -p "$WINEPREFIX_RIGEL"
    wine_calistir "$exe" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER '/DIR=C:\InnoSetup' >/dev/null || true
    WINEPREFIX="$WINEPREFIX_RIGEL" wineserver -w 2>/dev/null || true
    [[ -f $ISCC ]] || { uyari "Inno Setup wine altında kurulamadı."; return 1; }
  fi
  INNO_ISCC='C:\InnoSetup\ISCC.exe'
}

# inno_derle <.iss> <çıktı klasörü> [ISCC /D tanımları…]  (yollar Linux yolu; burada Windows yoluna çevrilir)
inno_derle() {
  local iss="$1" cikis="$2" d args=() wincikis winiss
  shift 2
  for d in "$@"; do args+=("$d"); done
  winiss="$(WINEPREFIX="$WINEPREFIX_RIGEL" winepath -w "$iss" 2>/dev/null)"
  wincikis="$(WINEPREFIX="$WINEPREFIX_RIGEL" winepath -w "$cikis" 2>/dev/null)"
  wine_calistir "$INNO_ISCC" /Q "/DOutDir=$wincikis" "${args[@]}" "$winiss"
}

inno_kapat() { WINEPREFIX="$WINEPREFIX_RIGEL" wineserver -k 2>/dev/null || true; }

# ---------- Simge (rcedit) ----------
# Windows görev çubuğu/pencere simgesini firefox.exe içindeki kaynaktan alır; kısayol simgesi yetmez.
# electron/rcedit v2.0.0 (etiketli sürüm; GitHub özet yayımlamıyor, SHA256 ilk indirmede sabitlendi) wine altında çalıştırılır.
# Yan etki: firefox.exe'nin Mozilla imzası düşer (yalnızca simge kaynağı değişir). RIGEL_WINDOWS_ICON=0 ile kapatılır.
RCEDIT_URL="https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe"
RCEDIT_SHA256="3e7801db1a5edbec91b49a24a094aad776cb4515488ea5a4ca2289c400eade2a"

# exe_simgesi <firefox.exe (Linux yolu)> <.ico (Linux yolu)>; başarısızsa 1 döner (dosya değişmez)
exe_simgesi() {
  local exe="$1" ico="$2" rc="$CACHE/rcedit-x64.exe" yedek
  command -v wine >/dev/null || { uyari "wine yok; firefox.exe simgesi değiştirilmedi."; return 1; }
  if [[ -f $rc && $(sha_of "$rc") != "$RCEDIT_SHA256" ]]; then rm -f "$rc"; fi
  if [[ ! -f $rc ]]; then
    bilgi "rcedit indiriliyor"
    indir "$RCEDIT_URL" "$rc.part" 0 || { rm -f "$rc.part"; uyari "rcedit indirilemedi."; return 1; }
    if [[ $(sha_of "$rc.part") != "$RCEDIT_SHA256" ]]; then rm -f "$rc.part"; uyari "rcedit SHA256 UYUŞMUYOR; kullanılmadı."; return 1; fi
    mv "$rc.part" "$rc"
  fi
  mkdir -p "$WINEPREFIX_RIGEL"
  yedek="$exe.orig"
  cp "$exe" "$yedek"
  if wine_calistir "$rc" "$(WINEPREFIX="$WINEPREFIX_RIGEL" winepath -w "$exe" 2>/dev/null)" \
       --set-icon "$(WINEPREFIX="$WINEPREFIX_RIGEL" winepath -w "$ico" 2>/dev/null)" >/dev/null \
     && [[ $(head -c2 "$exe") == MZ ]] && ! cmp -s "$exe" "$yedek"; then
    rm -f "$yedek"; return 0
  fi
  mv -f "$yedek" "$exe"
  uyari "firefox.exe simgesi değiştirilemedi; özgün dosya korundu."
  return 1
}
