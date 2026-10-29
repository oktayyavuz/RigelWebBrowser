; Rigel kurulum programı (Inno Setup 6). scripts/build-windows.sh derler:
;   ISCC /DStage=<paket klasoru> /DOutDir=<dist> /DAppVer=<surum> /DFfVer=<firefox surumu> rigel.iss
; Kullanici basina kurulur (yonetici gerekmez): uygulama %LOCALAPPDATA%\Programs\Rigel, profil %LOCALAPPDATA%\Rigel\profile.
; Rigel arayuz dosyalari (rigel\, utils\) dogrudan profilin chrome\JS ve chrome\utils klasorlerine yazilir
; (Windows'ta sembolik baglanti yok; kisayol dogrudan firefox.exe'yi --profile ile acar, ara betik gerekmez).
; Windows'ta calistirilarak TEST EDILMEDI (Linux'ta wine altinda derlendi).

#ifndef Stage
  #error Stage tanimli degil (/DStage=...)
#endif
#ifndef OutDir
  #define OutDir "."
#endif
#ifndef AppVer
  #define AppVer "0.0.0"
#endif
#ifndef FfVer
  #define FfVer ""
#endif
#define ProfDir "{localappdata}\Rigel\profile"
#define Exe "{app}\app\firefox.exe"

[Setup]
AppId={{B7E3A6C2-5D41-4F0E-9A5B-3C6E2F1D8A74}
AppName=Rigel
AppVersion={#AppVer}
AppVerName=Rigel {#AppVer}
AppPublisher=Rigel
AppComments=Firefox {#FfVer} üzerine kurulu Rigel arayüzü
DefaultDirName={autopf}\Rigel
DefaultGroupName=Rigel
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutDir}
OutputBaseFilename=rigel-{#AppVer}-windows-x64-setup
SetupIconFile={#Stage}\rigel.ico
UninstallDisplayIcon={app}\rigel.ico
UninstallDisplayName=Rigel
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
ShowLanguageDialog=auto
UsePreviousLanguage=no
VersionInfoVersion={#AppVer}
VersionInfoDescription=Rigel kurulum programı

[Languages]
Name: "tr"; MessagesFile: "compiler:Languages\Turkish.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
tr.DesktopIcon=Masaüstüne kısayol oluştur
tr.DefaultApps=Rigel'i Windows'un varsayılan uygulamalar listesinde göster
tr.LaunchRigel=Rigel'i başlat
tr.DeleteProfile=Profil de silinsin mi? (yer imleri, geçmiş, parolalar ve ayarlar geri alınamaz biçimde silinir)%n%nHayır derseniz profil korunur: %1
en.DesktopIcon=Create a desktop shortcut
en.DefaultApps=Show Rigel in the Windows default apps list
en.LaunchRigel=Launch Rigel
en.DeleteProfile=Also delete the profile? (bookmarks, history, passwords and settings are deleted permanently)%n%nChoose No to keep it: %1

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; Flags: unchecked
Name: "defaultapps"; Description: "{cm:DefaultApps}"

[InstallDelete]
; Eski surumun artiklari kalmasin (Firefox dosyalari + Rigel arayuz dosyalari + baslangic onbellegi)
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{#ProfDir}\chrome\JS"
Type: filesandordirs; Name: "{#ProfDir}\chrome\utils"
Type: filesandordirs; Name: "{#ProfDir}\startupCache"

[Files]
Source: "{#Stage}\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#Stage}\rigel.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Stage}\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Stage}\licenses\*"; DestDir: "{app}\licenses"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#Stage}\VERSION"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Stage}\rigel\*"; DestDir: "{#ProfDir}\chrome\JS"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#Stage}\utils\*"; DestDir: "{#ProfDir}\chrome\utils"; Flags: recursesubdirs createallsubdirs ignoreversion
; Surum damgasi (Rigel.cmd ile ayni dosya): profil bu surumle eslesmis sayilir
Source: "{#Stage}\VERSION"; DestDir: "{#ProfDir}"; DestName: ".rigel-surum"; Flags: ignoreversion

[Dirs]
Name: "{#ProfDir}\chrome\CSS"
Name: "{#ProfDir}\chrome\resources"

[Icons]
Name: "{autoprograms}\Rigel"; Filename: "{#Exe}"; Parameters: "--profile ""{#ProfDir}"""; WorkingDir: "{app}\app"; IconFilename: "{app}\rigel.ico"; Comment: "Rigel"
Name: "{autodesktop}\Rigel"; Filename: "{#Exe}"; Parameters: "--profile ""{#ProfDir}"""; WorkingDir: "{app}\app"; IconFilename: "{app}\rigel.ico"; Tasks: desktopicon; Comment: "Rigel"

[Registry]
; Ayarlar > Varsayilan uygulamalar listesinde gorunsun (kullanici basina, HKCU). Varsayilani KENDILIGINDEN DEGISTIRMEZ.
Root: HKCU; Subkey: "Software\RegisteredApplications"; ValueType: string; ValueName: "Rigel"; ValueData: "Software\Clients\StartMenuInternet\Rigel\Capabilities"; Flags: uninsdeletevalue; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel"; ValueType: string; ValueData: "Rigel"; Flags: uninsdeletekey; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\Capabilities"; ValueType: string; ValueName: "ApplicationName"; ValueData: "Rigel"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\Capabilities"; ValueType: string; ValueName: "ApplicationDescription"; ValueData: "Sade, hızlı ve gizlilik odaklı web tarayıcısı"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\Capabilities"; ValueType: string; ValueName: "ApplicationIcon"; ValueData: "{app}\rigel.ico,0"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\Capabilities\URLAssociations"; ValueType: string; ValueName: "http"; ValueData: "RigelURL"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\Capabilities\URLAssociations"; ValueType: string; ValueName: "https"; ValueData: "RigelURL"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\Capabilities\FileAssociations"; ValueType: string; ValueName: ".htm"; ValueData: "RigelHTML"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\Capabilities\FileAssociations"; ValueType: string; ValueName: ".html"; ValueData: "RigelHTML"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\Capabilities\FileAssociations"; ValueType: string; ValueName: ".xhtml"; ValueData: "RigelHTML"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\DefaultIcon"; ValueType: string; ValueData: "{app}\rigel.ico,0"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\Rigel\shell\open\command"; ValueType: string; ValueData: """{#Exe}"" --profile ""{#ProfDir}"""; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Classes\RigelURL"; ValueType: string; ValueData: "Rigel URL"; Flags: uninsdeletekey; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Classes\RigelURL"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Classes\RigelURL\DefaultIcon"; ValueType: string; ValueData: "{app}\rigel.ico,0"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Classes\RigelURL\shell\open\command"; ValueType: string; ValueData: """{#Exe}"" --profile ""{#ProfDir}"" -osint -url ""%1"""; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Classes\RigelHTML"; ValueType: string; ValueData: "Rigel HTML"; Flags: uninsdeletekey; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Classes\RigelHTML\DefaultIcon"; ValueType: string; ValueData: "{app}\rigel.ico,0"; Tasks: defaultapps
Root: HKCU; Subkey: "Software\Classes\RigelHTML\shell\open\command"; ValueType: string; ValueData: """{#Exe}"" --profile ""{#ProfDir}"" -osint -url ""%1"""; Tasks: defaultapps

[Run]
Filename: "{#Exe}"; Parameters: "--profile ""{#ProfDir}"" -purgecaches"; WorkingDir: "{app}\app"; Description: "{cm:LaunchRigel}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Profil (yer imleri, gecmis, ayarlar) KORUNUR; yalniz Rigel'in kopyaladigi dosyalar silinir.
Type: filesandordirs; Name: "{#ProfDir}\chrome\JS"
Type: filesandordirs; Name: "{#ProfDir}\chrome\utils"
Type: files; Name: "{#ProfDir}\.rigel-surum"
Type: filesandordirs; Name: "{#ProfDir}\startupCache"
Type: filesandordirs; Name: "{app}\app"
Type: dirifempty; Name: "{app}"
Type: dirifempty; Name: "{#ProfDir}\chrome\CSS"
Type: dirifempty; Name: "{#ProfDir}\chrome\resources"
Type: dirifempty; Name: "{#ProfDir}\chrome"
Type: dirifempty; Name: "{#ProfDir}"
Type: dirifempty; Name: "{localappdata}\Rigel"

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Prof: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    Prof := ExpandConstant('{localappdata}\Rigel\profile');
    if (not UninstallSilent) and DirExists(Prof) then
    begin
      if MsgBox(FmtMessage(CustomMessage('DeleteProfile'), [Prof]), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      begin
        DelTree(Prof, True, True, True);
        RemoveDir(ExpandConstant('{localappdata}\Rigel'));
      end;
    end;
  end;
end;
