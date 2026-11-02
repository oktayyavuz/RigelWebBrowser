# Rigel hızlı kurulum ve güncelleme (Windows x64). Yazar: Oktay Yavuz
#
#   irm https://raw.githubusercontent.com/oktayyavuz/rigeldesktop/main/kur.ps1 | iex
#
# GitHub'daki son sürümün kurulum programını indirir, SHA256SUMS ile doğrular ve çalıştırır.
# Yönetici izni gerekmez (kullanıcı başına kurulum). Tekrar çalıştırmak = güncelleme; profil korunur.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$base = 'https://github.com/oktayyavuz/rigeldesktop/releases/latest/download'
$tmp = Join-Path $env:TEMP ('rigel-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    Write-Host '==> Son sürüm aranıyor'
    $sumsFile = Join-Path $tmp 'SHA256SUMS'
    Invoke-WebRequest "$base/SHA256SUMS" -OutFile $sumsFile -UseBasicParsing
    $line = Get-Content $sumsFile | Where-Object { $_ -match '^[0-9a-f]{64}\s+rigel-[\d.]+-windows-x64-setup\.exe$' } | Select-Object -First 1
    if (-not $line) { throw 'Sürümde Windows kurulum programı bulunamadı.' }
    $hash, $name = $line.Trim() -split '\s+', 2

    Write-Host "==> $name indiriliyor"
    $exe = Join-Path $tmp $name
    Invoke-WebRequest "$base/$name" -OutFile $exe -UseBasicParsing
    if ((Get-FileHash $exe -Algorithm SHA256).Hash -ne $hash) { throw 'SHA256 doğrulaması başarısız.' }

    Write-Host '==> Doğrulandı, kuruluyor'
    $p = Start-Process -FilePath $exe -ArgumentList '/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "Kurulum programı $($p.ExitCode) koduyla çıktı." }
    Write-Host 'Rigel kuruldu. Başlat menüsünden açabilirsin.' -ForegroundColor Green
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
