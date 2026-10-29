@echo off
rem Rigel baslaticisi (Windows). build-windows.sh ve install.ps1 bu dosyayi paketler.
rem   Rigel.cmd [URL...] [--new-window] [--private-window] ...   (Firefox bagimsiz degiskenleri gecerlidir)
rem Ortam: RIGEL_PROFILE (profil klasoru; varsayilan %LOCALAPPDATA%\Rigel\profile).
rem Dizin yapisi: <bu klasor>\app (Firefox), \rigel (arayuz kodu), \utils (fx-autoconfig), \VERSION
rem Windows'ta sembolik baglanti yok: rigel\ ve utils\ profildeki chrome\JS ve chrome\utils altina KOPYALANIR;
rem VERSION damgasi degisince (guncelleme) yeniden kopyalanir ve Firefox'un baslangic onbellegi silinir.
setlocal EnableExtensions
set "RIGEL_HOME=%~dp0"
if "%RIGEL_HOME:~-1%"=="\" set "RIGEL_HOME=%RIGEL_HOME:~0,-1%"
if not defined RIGEL_PROFILE set "RIGEL_PROFILE=%LOCALAPPDATA%\Rigel\profile"

if not exist "%RIGEL_HOME%\app\firefox.exe" (
  echo Rigel bulunamadi: "%RIGEL_HOME%\app\firefox.exe" yok. 1>&2
  pause
  exit /b 1
)

set "STAMP="
if exist "%RIGEL_HOME%\VERSION" set /p STAMP=<"%RIGEL_HOME%\VERSION"
set "OLD="
if exist "%RIGEL_PROFILE%\.rigel-surum" set /p OLD=<"%RIGEL_PROFILE%\.rigel-surum"

rem Profil baska bir Rigel penceresince kullaniliyor mu? (Firefox parent.lock dosyasini acik tutar)
set "ACIK="
if exist "%RIGEL_PROFILE%\parent.lock" (
  ( >>"%RIGEL_PROFILE%\parent.lock" (call) ) 2>nul || set "ACIK=1"
)

set "SYNC="
if not "%STAMP%"=="%OLD%" set "SYNC=1"
if not exist "%RIGEL_PROFILE%\chrome\JS\rigel.uc.mjs" set "SYNC=1"
if not exist "%RIGEL_PROFILE%\chrome\utils\boot.sys.mjs" set "SYNC=1"
if defined ACIK if exist "%RIGEL_PROFILE%\chrome\JS\rigel.uc.mjs" if exist "%RIGEL_PROFILE%\chrome\utils\boot.sys.mjs" set "SYNC="

set "ARGS="
if defined SYNC (
  if not exist "%RIGEL_PROFILE%\chrome\CSS" mkdir "%RIGEL_PROFILE%\chrome\CSS"
  if not exist "%RIGEL_PROFILE%\chrome\resources" mkdir "%RIGEL_PROFILE%\chrome\resources"
  call :temizle "%RIGEL_PROFILE%\chrome\JS"
  call :temizle "%RIGEL_PROFILE%\chrome\utils"
  xcopy "%RIGEL_HOME%\rigel" "%RIGEL_PROFILE%\chrome\JS" /E /I /Y /Q /H >nul
  if errorlevel 1 goto :kopyalanamadi
  xcopy "%RIGEL_HOME%\utils" "%RIGEL_PROFILE%\chrome\utils" /E /I /Y /Q /H >nul
  if errorlevel 1 goto :kopyalanamadi
  if exist "%RIGEL_PROFILE%\startupCache" rd /s /q "%RIGEL_PROFILE%\startupCache"
  >"%RIGEL_PROFILE%\.rigel-surum" echo %STAMP%
  set "ARGS=-purgecaches"
)

start "" "%RIGEL_HOME%\app\firefox.exe" --profile "%RIGEL_PROFILE%" %ARGS% %*
exit /b 0

:temizle
rem Dizin baglantisi (junction; eski install.ps1) ise yalniz baglanti silinir, hedefe dokunulmaz.
rmdir "%~1" 2>nul
if exist "%~1" rd /s /q "%~1"
exit /b 0

:kopyalanamadi
echo Rigel dosyalari profile kopyalanamadi: "%RIGEL_PROFILE%" 1>&2
pause
exit /b 1
