# AppImage üretimi (isteğe bağlı). common.sh yüklü olmalı. `source` edilir.
# shellcheck shell=bash
#
# appimagetool sırası: RIGEL_APPIMAGETOOL (yol) -> PATH'teki appimagetool -> önbellekteki indirme.
# RIGEL_APPIMAGE=1 ise ve hiçbiri yoksa resmî 1.9.1 sürümü GitHub'dan (AppImage/appimagetool) indirilir; SHA256 GitHub'ın
# yayımladığı özetle doğrulanır.
# Varsayılan ("auto") hiçbir şey indirmez: araç yoksa AppImage sessizce atlanır.

APPIMAGETOOL_URL="https://github.com/AppImage/appimagetool/releases/download/1.9.1/appimagetool-x86_64.AppImage"
APPIMAGETOOL_SHA256="ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0"
# appimagetool çalışma zamanını kendisi "continuous" adresinden indirirdi; sürüm sabitlenip özetle doğrulansın diye biz veriyoruz
APPIMAGE_RUNTIME_URL="https://github.com/AppImage/type2-runtime/releases/download/20251108/runtime-x86_64"
APPIMAGE_RUNTIME_SHA256="2fca8b443c92510f1483a883f60061ad09b46b978b2631c807cd873a47ec260d"

appimage_runtime() { # çalışma zamanı dosyasının yolunu yazar; yoksa 1 döner (uyarıyı stderr'e yazar)
  local rt="$CACHE/appimage-runtime-x86_64"
  if [[ -f $rt && $(sha_of "$rt") != "$APPIMAGE_RUNTIME_SHA256" ]]; then rm -f "$rt"; fi
  if [[ ! -f $rt ]]; then
    mkdir -p "$CACHE"
    indir "$APPIMAGE_RUNTIME_URL" "$rt.part" 0 >&2 || { rm -f "$rt.part"; uyari "AppImage çalışma zamanı indirilemedi." >&2; return 1; }
    if [[ $(sha_of "$rt.part") != "$APPIMAGE_RUNTIME_SHA256" ]]; then
      rm -f "$rt.part"; uyari "AppImage çalışma zamanı SHA256 UYUŞMUYOR; kullanılmadı." >&2; return 1
    fi
    mv "$rt.part" "$rt"
  fi
  printf '%s\n' "$rt"
}

appimagetool_bul() { # bulunan aracın yolunu yazar; yoksa 1 döner
  local onbellek="$CACHE/appimagetool-x86_64.AppImage"
  if [[ -n ${RIGEL_APPIMAGETOOL:-} && -x ${RIGEL_APPIMAGETOOL} ]]; then printf '%s\n' "$RIGEL_APPIMAGETOOL"; return 0; fi
  if command -v appimagetool >/dev/null; then command -v appimagetool; return 0; fi
  if [[ -x $onbellek && $(sha_of "$onbellek") == "$APPIMAGETOOL_SHA256" ]]; then printf '%s\n' "$onbellek"; return 0; fi
  if [[ ${RIGEL_APPIMAGE:-auto} == 1 ]]; then
    mkdir -p "$CACHE"
    bilgi "appimagetool indiriliyor (github.com/AppImage/appimagetool)" >&2
    indir "$APPIMAGETOOL_URL" "$onbellek.part" 1 >&2 || { rm -f "$onbellek.part"; return 1; }
    if [[ $(sha_of "$onbellek.part") != "$APPIMAGETOOL_SHA256" ]]; then
      rm -f "$onbellek.part"; uyari "appimagetool SHA256 UYUŞMUYOR; kullanılmadı." >&2; return 1
    fi
    chmod +x "$onbellek.part"; mv "$onbellek.part" "$onbellek"
    printf '%s\n' "$onbellek"; return 0
  fi
  return 1
}

# appimage_uret <hazırlanmış linux klasörü (rigel arşivinin içeriği)> <çıktı .AppImage>
appimage_uret() {
  local stage="$1" cikti="$2" tool dir ic rt
  tool="$(appimagetool_bul)" || { uyari "appimagetool yok; AppImage atlandı (RIGEL_APPIMAGE=1 ile indirilir)."; return 0; }
  bilgi "AppImage üretiliyor ($tool)"
  rt="$(appimage_runtime)" || return 1
  dir="$(gecici_dizin appimage)"
  mkdir -p "$dir/Rigel.AppDir/usr/share"
  local ad="$dir/Rigel.AppDir"
  # Uygulama dosyaları + başlatıcı usr/share/rigel altında (başlatıcı RIGEL_HOME'u kendi konumundan bulur)
  mkdir -p "$ad/usr/share/rigel"
  cp -a "$stage/app" "$stage/rigel" "$stage/utils" "$stage/VERSION" "$stage/bin" "$ad/usr/share/rigel/"
  cat > "$ad/AppRun" <<'EOA'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
export RIGEL_APPIMAGE=1
exec "$HERE/usr/share/rigel/bin/rigel" "$@"
EOA
  chmod 755 "$ad/AppRun"
  sed 's|^Exec=.*|Exec=rigel %u|; /^\[Desktop Action/,$ d' "$stage/rigel.desktop" > "$ad/rigel.desktop"
  # Eylem bölümleri kesildiği için Actions satırını da kaldır
  sed -i '/^Actions=/d' "$ad/rigel.desktop"
  cp "$ROOT/design/logo.png" "$ad/rigel.png"
  cp "$ROOT/design/logo.png" "$ad/.DirIcon"
  mkdir -p "$ad/usr/share/icons/hicolor"
  cp -a "$stage/share/icons/hicolor/." "$ad/usr/share/icons/hicolor/"
  damga_sabitle "$ad"
  rm -f "$cikti"
  ic=0
  # İndirilen araç bir AppImage'dır: FUSE gerekmesin diye kendi içinden açılarak çalıştırılır
  local pre=(); [[ $tool == *.AppImage ]] && pre=(--appimage-extract-and-run)
  ARCH=x86_64 "$tool" ${pre[@]+"${pre[@]}"} --runtime-file "$rt" "$ad" "$cikti" >"$dir/log" 2>&1 || ic=$?
  if ((ic)) || [[ ! -s $cikti ]]; then
    tail -n 15 "$dir/log" >&2
    rm -rf "$dir" "$cikti"
    return 1
  fi
  rm -rf "$dir"
  chmod 755 "$cikti"
  tamam "$cikti ($(boyut "$cikti"))"
}
