<#
.SYNOPSIS
  Rigel'i kaldirir (Windows) -- DENEYSEL, Windows'ta test edilmedi.
.DESCRIPTION
  Uygulamayi (Firefox + Rigel dosyalari), kisayollari ve indirme onbellegini siler.
  Profil (yer imleri, gecmis, ayarlar) -ProfilDe verilmedikce KALIR.
.PARAMETER ProfilDe
  Profili de siler (geri alinamaz; onay ister).
.PARAMETER Evet
  Onay sormaz.
#>
[CmdletBinding()]
param(
  [string]$RigelHome = (Join-Path $env:LOCALAPPDATA 'Rigel'),
  [switch]$ProfilDe,
  [switch]$Evet
)
$ErrorActionPreference = 'Stop'

function Tamam($m) { Write-Host " [ok] $m" -ForegroundColor Green }
function Hata($m)  { Write-Host "Hata: $m" -ForegroundColor Red; exit 1 }
if ([string]::IsNullOrWhiteSpace($RigelHome) -or $RigelHome.TrimEnd('\') -eq [Environment]::GetFolderPath('UserProfile')) {
  Hata "RigelHome guvenli bir klasor degil: '$RigelHome'"
}
$App = Join-Path $RigelHome 'app'
$Profile = Join-Path $RigelHome 'profile'

function Remove-Link([string]$Path) {   # junction'i siler, hedefe dokunmaz
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $item = Get-Item -LiteralPath $Path -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { cmd /c rmdir "`"$Path`"" | Out-Null }
  else { Remove-Item -LiteralPath $Path -Recurse -Force }
}
function Onay([string]$Soru) {
  if ($Evet) { return $true }
  $c = Read-Host "$Soru [e/H]"
  return ($c -match '^(e|E|evet)$')
}

$a = Join-Path $App 'firefox.exe'
if (Get-Process -Name firefox -ErrorAction SilentlyContinue | Where-Object { $_.Path -and ($_.Path -ieq $a) }) {
  Hata 'Rigel su an acik. Once kapatin.'
}
if (-not (Test-Path $RigelHome)) { Write-Host "Rigel kurulu gorunmuyor ($RigelHome)."; exit 0 }

if ($ProfilDe -and -not (Onay "Profil de silinecek ($Profile: yer imleri, gecmis, parolalar, ayarlar). Emin misiniz?")) { Write-Host 'Vazgecildi.'; exit 1 }
if (-not (Onay "Rigel kaldirilsin mi? ($RigelHome)")) { Write-Host 'Vazgecildi.'; exit 1 }

# Firefox'un kendi sessiz kaldiricisi (kayit defteri girdilerini temizler)
$helper = Join-Path $App 'uninstall\helper.exe'
if (Test-Path $helper) {
  Start-Process -FilePath $helper -ArgumentList '/S' -Wait | Out-Null
}

# Profildeki baglantilari ONCE kaldir; boylece recursive silme hedef dosyalara gitmez
Remove-Link (Join-Path $Profile 'chrome\JS')
Remove-Link (Join-Path $Profile 'chrome\utils')

foreach ($d in 'app','rigel','utils') { if (Test-Path (Join-Path $RigelHome $d)) { Remove-Item (Join-Path $RigelHome $d) -Recurse -Force } }
foreach ($f in 'VERSION','rigel.cmd','rigel.ico') { Remove-Item (Join-Path $RigelHome $f) -Force -ErrorAction SilentlyContinue }
Remove-Item (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Rigel.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Rigel.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:LOCALAPPDATA 'Rigel-cache') -Recurse -Force -ErrorAction SilentlyContinue
Tamam 'Uygulama, kisayollar ve indirme onbellegi silindi'

if ($ProfilDe) {
  if (Test-Path $Profile) { Remove-Item $Profile -Recurse -Force }
  Tamam 'Profil silindi'
} elseif (Test-Path $Profile) {
  Write-Host "  Profil korundu: $Profile  (silmek icin: uninstall.ps1 -ProfilDe)"
}
if ((Test-Path $RigelHome) -and -not (Get-ChildItem $RigelHome -Force | Select-Object -First 1)) { Remove-Item $RigelHome -Force }
Write-Host 'Rigel kaldirildi.' -ForegroundColor Green
