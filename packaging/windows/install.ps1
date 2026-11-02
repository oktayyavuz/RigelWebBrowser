<#
.SYNOPSIS
  Rigel kurulumu (Windows 10/11 x64) -- DENEYSEL, Windows'ta test edilmedi.

.DESCRIPTION
  Mozilla'dan sabitlenmis Firefox surumunu (FIREFOX_VERSION, Turkce, win64) indirir, SHA256'sini SHA256SUMS ile dogrular,
  %LOCALAPPDATA%\Rigel\app altina sessizce kurar; fx-autoconfig + Rigel dosyalarini yerlestirir, profil ve kisayollar olusturur.
  Yonetici hakki gerektirmez. Varsayilan tarayiciyi DEGISTIRMEZ.

  Depo klonundan calistirin:
    gh repo clone oktayyavuz/RigelWebBrowser; cd RigelWebBrowser
    powershell -ExecutionPolicy Bypass -File packaging\windows\install.ps1

.PARAMETER RigelHome
  Kurulum klasoru (varsayilan %LOCALAPPDATA%\Rigel).
.PARAMETER ProfilTasi
  Var olan bir Firefox/Rigel profilini, Rigel profili bossa oraya kopyalar.
.PARAMETER MasaustuKisayolu
  Masaustu kisayolu olusturur ($false ile atlanir).
#>
[CmdletBinding()]
param(
  [string]$RigelHome = (Join-Path $env:LOCALAPPDATA 'Rigel'),
  [string]$ProfilTasi = '',
  [bool]$MasaustuKisayolu = $true
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest ilerleme cubugu indirmeyi cok yavaslatir
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ArchiveUrl = if ($env:RIGEL_ARCHIVE_URL) { $env:RIGEL_ARCHIVE_URL } else { 'https://archive.mozilla.org/pub/firefox/releases' }

function Bilgi($m)  { Write-Host "==> $m" -ForegroundColor Cyan }
function Tamam($m)  { Write-Host " [ok] $m" -ForegroundColor Green }
function Uyari($m)  { Write-Host " [!]  $m" -ForegroundColor Yellow }
function Hata($m)   { Write-Host "Hata: $m" -ForegroundColor Red; exit 1 }

Write-Host 'Rigel Windows kurulumu (DENEYSEL, test edilmedi)' -ForegroundColor Yellow

# ---- On kontroller ----
if (-not [Environment]::Is64BitOperatingSystem) { Hata 'Yalniz 64 bit Windows desteklenir.' }
foreach ($f in 'FIREFOX_VERSION','VERSION','prefs\rigel.js','distribution\policies.json','src\rigel\rigel.uc.mjs',
               'vendor\fx-autoconfig\program\config.js','vendor\fx-autoconfig\profile\chrome\utils\boot.sys.mjs',
               'packaging\windows\rigel.ico') {
  if (-not (Test-Path (Join-Path $Root $f))) { Hata "Depoda $f yok. Betigi tam bir klondan calistirin." }
}
$FfVer = (Get-Content (Join-Path $Root 'FIREFOX_VERSION') -Raw).Trim()
if ($FfVer -notmatch '^\d+(\.\d+){1,2}$') { Hata "FIREFOX_VERSION gecersiz: '$FfVer'" }

$App     = Join-Path $RigelHome 'app'
$Profile = Join-Path $RigelHome 'profile'
$Cache   = Join-Path $env:LOCALAPPDATA 'Rigel-cache'
New-Item -ItemType Directory -Force -Path $RigelHome, $Cache | Out-Null

# ---- Yardimcilar ----
function Test-RigelAcik {
  $a = (Join-Path $App 'firefox.exe')
  $p = Get-Process -Name firefox -ErrorAction SilentlyContinue | Where-Object { $_.Path -and ($_.Path -ieq $a) }
  return [bool]$p
}

# Baglanti (junction) siler; hedefin icerigine DOKUNMAZ.
function Remove-Link([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $item = Get-Item -LiteralPath $Path -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { cmd /c rmdir "`"$Path`"" | Out-Null }
  else { Remove-Item -LiteralPath $Path -Recurse -Force }
}

# Dizini kopyalar (Windows'ta sembolik baglanti yok). Onceki surumden kalan junction varsa yalniz baglanti silinir.
function Copy-Fresh([string]$Link, [string]$Target) {
  Remove-Link $Link
  Copy-Item -LiteralPath $Target -Destination $Link -Recurse -Force
}

function Get-InstalledFirefoxVersion {
  $ini = Join-Path $App 'application.ini'
  if (-not (Test-Path $ini)) { return '' }
  $m = Select-String -Path $ini -Pattern '^Version=(.+)$' | Select-Object -First 1
  if ($m) { return $m.Matches[0].Groups[1].Value.Trim() } else { return '' }
}

# ---- 1. Firefox ----
$installed = Get-InstalledFirefoxVersion
if ((Test-Path (Join-Path $App 'firefox.exe')) -and $installed -eq $FfVer) {
  Tamam "Firefox $FfVer zaten kurulu; indirme atlandi"
} else {
  if (Test-RigelAcik) { Hata 'Rigel acik; once kapatin.' }
  $rel  = "win64/tr/Firefox Setup $FfVer.exe"
  $exe  = Join-Path $Cache "Firefox Setup $FfVer.exe"

  Bilgi "Firefox $FfVer (tr, win64) icin SHA256 listesi aliniyor"
  $sums = (Invoke-WebRequest -UseBasicParsing -Uri "$ArchiveUrl/$FfVer/SHA256SUMS").Content
  if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }
  $beklenen = $null
  foreach ($line in ($sums -split "`n")) {
    if ($line -match '^([0-9a-fA-F]{64})\s+(.+?)\s*$' -and $Matches[2] -ceq $rel) { $beklenen = $Matches[1].ToLower(); break }
  }
  if (-not $beklenen) { Hata "SHA256SUMS icinde '$rel' satiri bulunamadi." }

  if (Test-Path $exe) {
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $exe).Hash.ToLower() -ne $beklenen) {
      Uyari 'Onbellekteki yukleyicinin ozeti uyusmuyor; yeniden indiriliyor.'
      Remove-Item -LiteralPath $exe -Force
    }
  }
  if (-not (Test-Path $exe)) {
    $url = "$ArchiveUrl/$FfVer/" + ($rel -replace ' ', '%20')
    Bilgi "Indiriliyor: $url"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile "$exe.part"
    $gercek = (Get-FileHash -Algorithm SHA256 -LiteralPath "$exe.part").Hash.ToLower()
    if ($gercek -ne $beklenen) {
      Remove-Item -LiteralPath "$exe.part" -Force
      Hata "SHA256 UYUSMUYOR! Beklenen $beklenen, gelen $gercek. Indirilen dosya silindi, kurulum durduruldu."
    }
    Move-Item -LiteralPath "$exe.part" -Destination $exe -Force
  }
  Tamam "SHA256 dogrulandi: $beklenen"

  # Mozilla yukleyicisi secenekleri bir INI dosyasindan da okur (/INI=); bosluklu yollar icin daha guvenli.
  # Kaynak: mozilla-firefox/firefox -> toolkit/mozapps/installer/windows/nsis/common.nsh
  $iniPath = Join-Path $Cache 'rigel-firefox-install.ini'
  @(
    '[Install]',
    "InstallDirectoryPath=$App",
    'DesktopShortcut=false',
    'StartMenuShortcuts=false',
    'StartMenuShortcut=false',
    'TaskbarShortcut=false',
    'PrivateBrowsingShortcut=false',
    'MaintenanceService=false',
    'RegisterDefaultAgent=false',
    'OptionalExtensions=false',
    'PreventRebootRequired=true'
  ) | Set-Content -Path $iniPath -Encoding ASCII

  Bilgi 'Firefox sessizce kuruluyor'
  $p = Start-Process -FilePath $exe -ArgumentList @('/S', "/INI=$iniPath") -Wait -PassThru
  Remove-Item -LiteralPath $iniPath -Force -ErrorAction SilentlyContinue
  if ($p.ExitCode -ne 0) { Hata "Firefox yukleyicisi $($p.ExitCode) koduyla bitti." }
  if (-not (Test-Path (Join-Path $App 'firefox.exe'))) { Hata "Kurulumdan sonra $App\firefox.exe yok." }
  Tamam "Firefox $FfVer kuruldu: $App"
  Get-ChildItem $Cache -Filter 'Firefox Setup *.exe' | Where-Object { $_.FullName -ne $exe } | Remove-Item -Force -ErrorAction SilentlyContinue
}

# ---- 2. Rigel katmani (fx-autoconfig, ilkeler, varsayilan tercihler) ----
Bilgi 'fx-autoconfig, ilkeler ve tercihler yerlestiriliyor'
Copy-Item (Join-Path $Root 'vendor\fx-autoconfig\program\config.js') (Join-Path $App 'config.js') -Force
New-Item -ItemType Directory -Force -Path (Join-Path $App 'defaults\pref') | Out-Null
Copy-Item (Join-Path $Root 'vendor\fx-autoconfig\program\defaults\pref\config-prefs.js') (Join-Path $App 'defaults\pref\config-prefs.js') -Force
New-Item -ItemType Directory -Force -Path (Join-Path $App 'distribution') | Out-Null
Copy-Item (Join-Path $Root 'distribution\policies.json') (Join-Path $App 'distribution\policies.json') -Force
# Varsayilan tercihler browser\defaults\preferences altina (defaults\pref'e degil: firefox.js onlari ezerdi)
New-Item -ItemType Directory -Force -Path (Join-Path $App 'browser\defaults\preferences') | Out-Null
Remove-Item (Join-Path $App 'defaults\pref\rigel.js') -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $Root 'prefs\rigel.js') (Join-Path $App 'browser\defaults\preferences\rigel.js') -Force
Copy-Item (Join-Path $Root 'packaging\windows\rigel-windows.js') (Join-Path $App 'browser\defaults\preferences\rigel-windows.js') -Force
Tamam 'Rigel katmani hazir'

# ---- 3. Rigel dosyalari ----
Bilgi 'Rigel dosyalari kopyalaniyor'
$acik = Test-RigelAcik
foreach ($d in 'rigel','utils') { if (Test-Path (Join-Path $RigelHome $d)) { Remove-Item (Join-Path $RigelHome $d) -Recurse -Force } }
Copy-Item (Join-Path $Root 'src\rigel') (Join-Path $RigelHome 'rigel') -Recurse -Force
Copy-Item (Join-Path $Root 'vendor\fx-autoconfig\profile\chrome\utils') (Join-Path $RigelHome 'utils') -Recurse -Force
Copy-Item (Join-Path $Root 'packaging\windows\rigel.ico') (Join-Path $RigelHome 'rigel.ico') -Force

# Surum damgasi: VERSION + icerik ozeti (dosyalar degisince Firefox'un baslangic onbellegi silinir)
$ozet = New-Object System.Text.StringBuilder
foreach ($d in 'src\rigel','prefs','distribution') {
  Get-ChildItem (Join-Path $Root $d) -Recurse -File | Sort-Object FullName | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length)
    [void]$ozet.Append($rel).Append((Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash)
  }
}
$sha = [Security.Cryptography.SHA256]::Create()
$damgaHex = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($ozet.ToString())) | ForEach-Object { $_.ToString('x2') })
$damga = ((Get-Content (Join-Path $Root 'VERSION') -Raw).Trim()) + '-' + $damgaHex.Substring(0, 12)
Set-Content -Path (Join-Path $RigelHome 'VERSION') -Value $damga -Encoding ASCII
Tamam "Rigel $damga"
if ($acik) { Uyari 'Rigel su an acik. Yeni surum, tarayiciyi kapatip yeniden acinca yuklenir.' }

# ---- 4. Profil ----
New-Item -ItemType Directory -Force -Path $Profile | Out-Null
if ($ProfilTasi) {
  $kaynak = (Resolve-Path -LiteralPath $ProfilTasi -ErrorAction SilentlyContinue)
  if (-not $kaynak) { Hata "Profil klasoru bulunamadi: $ProfilTasi" }
  $kaynak = $kaynak.Path
  if (-not ((Test-Path (Join-Path $kaynak 'prefs.js')) -or (Test-Path (Join-Path $kaynak 'places.sqlite')))) {
    Hata "Burasi bir Firefox profiline benzemiyor: $kaynak"
  }
  if (Test-Path (Join-Path $kaynak 'parent.lock')) {
    try { $fs = [IO.File]::Open((Join-Path $kaynak 'parent.lock'), 'Open', 'ReadWrite', 'None'); $fs.Close() }
    catch { Hata 'Kaynak profil su an acik. Tarayiciyi kapatip tekrar deneyin.' }
  }
  $dolu = Get-ChildItem $Profile -Force | Where-Object { $_.Name -ne 'chrome' -and $_.Name -ne '.rigel-surum' } | Select-Object -First 1
  if ($dolu) {
    Uyari "Rigel profili bos degil ($Profile); uzerine yazmamak icin profil tasinmadi."
  } else {
    Bilgi "Profil kopyalaniyor: $kaynak -> $Profile"
    Remove-Link (Join-Path $Profile 'chrome\JS'); Remove-Link (Join-Path $Profile 'chrome\utils')
    Copy-Item (Join-Path $kaynak '*') $Profile -Recurse -Force -Exclude 'lock','parent.lock','.parentlock','startupCache','chrome','.rigel-surum'
    Tamam 'Profil tasindi (kaynak profile dokunulmadi)'
  }
}

New-Item -ItemType Directory -Force -Path (Join-Path $Profile 'chrome\CSS'), (Join-Path $Profile 'chrome\resources') | Out-Null
Copy-Fresh (Join-Path $Profile 'chrome\utils') (Join-Path $RigelHome 'utils')
Copy-Fresh (Join-Path $Profile 'chrome\JS')    (Join-Path $RigelHome 'rigel')
$eski = ''
$stampFile = Join-Path $Profile '.rigel-surum'
if (Test-Path $stampFile) { $eski = (Get-Content $stampFile -Raw).Trim() }
if ($eski -ne $damga -and -not $acik) {
  Remove-Item (Join-Path $Profile 'startupCache') -Recurse -Force -ErrorAction SilentlyContinue
  Set-Content -Path $stampFile -Value $damga -Encoding ASCII
}
# Eski surum tercihleri user.js ile zorluyordu
$uj = Join-Path $Profile 'user.js'
if ((Test-Path $uj) -and (Select-String -Path $uj -Pattern 'Rigel varsay.lan tercihleri' -Quiet)) { Remove-Item $uj -Force }

# ---- 5. Baslatici ve kisayollar ----
Bilgi 'Baslatici ve kisayollar'
# Paylasilan baslatici (portable zip ile ayni dosya): surum damgasi degisince rigel\ ve utils\ klasorlerini profile yeniden kopyalar
Copy-Item (Join-Path $Root 'packaging\windows\Rigel.cmd') (Join-Path $RigelHome 'Rigel.cmd') -Force

function New-Kisayol([string]$Yol) {
  $sh = New-Object -ComObject WScript.Shell
  $lnk = $sh.CreateShortcut($Yol)
  $lnk.TargetPath = (Join-Path $App 'firefox.exe')
  $lnk.Arguments = "--profile `"$Profile`""
  $lnk.WorkingDirectory = $App
  $lnk.IconLocation = (Join-Path $RigelHome 'rigel.ico') + ',0'
  $lnk.Description = 'Rigel web tarayicisi'
  $lnk.Save()
}
$startDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
New-Kisayol (Join-Path $startDir 'Rigel.lnk')
if ($MasaustuKisayolu) { New-Kisayol (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Rigel.lnk') }
Tamam 'Baslat menusu (ve masaustu) kisayolu olusturuldu'

Write-Host ''
Write-Host 'Rigel kuruldu (deneysel).' -ForegroundColor Green
Write-Host "  Baslat:    Baslat menusu > Rigel   ya da   $RigelHome\Rigel.cmd"
Write-Host "  Profil:    $Profile"
Write-Host '  Not:       Varsayilan tarayici degistirilmedi. Gorev cubugu simgesi Firefox olarak gorunebilir (Windows, simgeyi firefox.exe dosyasindan alir).'
Write-Host '  Guncelle:  git pull; packaging\windows\install.ps1'
Write-Host '  Kaldir:    packaging\windows\uninstall.ps1'
