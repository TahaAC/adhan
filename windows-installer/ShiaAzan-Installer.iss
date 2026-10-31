; ============================================================；
;  Shia Azan - Inno Setup Script                              ;
;  Compile with Inno Setup (https://jrsoftware.org/isinfo.php)；
;  to create a professional .exe installer.                  ；
;                                                            ；
;  Command line:                                             ；
;    iscc "ShiaAzan-Installer.iss"                           ；
; ============================================================；

#define MyAppName "Shia Azan"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Shia Azan"
#define MyAppURL "https://praytimes.org"
#define MyAppExeName "ShiaAzan.exe"

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
; Do not use the same AppId value in installers for other applications.
AppId={{8F7B5A3C-9D2E-4F1A-B6C8-7E5D9F0A1B2C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\ShiaAzan
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=Output
OutputBaseFilename=ShiaAzan-Setup-{#MyAppVersion}
SetupIconFile=icons\shia-azan.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\icons\shia-azan.ico
UninstallDisplayName={#MyAppName}
WizardImageFile=icons\shia-azan.bmp
WizardSmallImageFile=icons\shia-azan.bmp

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: checked
Name: "pintotaskbar"; Description: "Pin to &Taskbar"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
; App icons
Source: "icons\shia-azan.ico"; DestDir: "{app}\icons"; Flags: ignoreversion
Source: "icons\shia-azan.png"; DestDir: "{app}\icons"; Flags: ignoreversion

; Launcher script
Source: "launch.vbs"; DestDir: "{app}"; Flags: ignoreversion

; Note: The installer generates launch.vbs during install via the
; [Run] section and [Code] section below, so the file above is a
; fallback. The [Code] section customizes the browser path.

[Icons]
; Start Menu shortcut
Name: "{group}\Shia Azan"; Filename: "wscript.exe"; Parameters: """{app}\launch.vbs"""; IconFilename: "{app}\icons\shia-azan.ico"; WorkingDir: "{app}"; Comment: "Shia Prayer Times and Adhan"
Name: "{group}\Uninstall Shia Azan"; Filename: "{uninstallexe}"; Comment: "Uninstall Shia Azan"

; Desktop shortcut (conditional on task)
Name: "{commondesktop}\Shia Azan"; Filename: "wscript.exe"; Parameters: """{app}\launch.vbs"""; IconFilename: "{app}\icons\shia-azan.ico"; WorkingDir: "{app}"; Comment: "Shia Prayer Times and Adhan"; Tasks: desktopicon

[Run]
; Launch the app after installation
Filename: "wscript.exe"; Parameters: """{app}\launch.vbs"""; Description: "Launch Shia Azan"; Flags: nowait postinstall skipifsilent

[Code]
var
  BrowserPath: String;
  BrowserName: String;

// Detect the best available browser (Edge first, then Chrome)
function DetectBrowser(): Boolean;
begin
  BrowserPath := '';
  BrowserName := '';

  // Check Microsoft Edge (64-bit)
  if FileExists(ExpandConstant('{pf}\Microsoft\Edge\Application\msedge.exe')) then
  begin
    BrowserPath := ExpandConstant('{pf}\Microsoft\Edge\Application\msedge.exe');
    BrowserName := 'Microsoft Edge';
    Result := True;
    Exit;
  end;

  // Check Microsoft Edge (32-bit)
  if FileExists(ExpandConstant('{pf32}\Microsoft\Edge\Application\msedge.exe')) then
  begin
    BrowserPath := ExpandConstant('{pf32}\Microsoft\Edge\Application\msedge.exe');
    BrowserName := 'Microsoft Edge';
    Result := True;
    Exit;
  end;

  // Check Google Chrome (64-bit)
  if FileExists(ExpandConstant('{pf}\Google\Chrome\Application\chrome.exe')) then
  begin
    BrowserPath := ExpandConstant('{pf}\Google\Chrome\Application\chrome.exe');
    BrowserName := 'Google Chrome';
    Result := True;
    Exit;
  end;

  // Check Google Chrome (32-bit)
  if FileExists(ExpandConstant('{pf32}\Google\Chrome\Application\chrome.exe')) then
  begin
    BrowserPath := ExpandConstant('{pf32}\Google\Chrome\Application\chrome.exe');
    BrowserName := 'Google Chrome';
    Result := True;
    Exit;
  end;

  // Check Chrome in local app data
  if FileExists(ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe')) then
  begin
    BrowserPath := ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe');
    BrowserName := 'Google Chrome';
    Result := True;
    Exit;
  end;

  Result := False;
end;

// Generate the launch.vbs script with the detected browser path
function GenerateLauncher(): Boolean;
var
  LauncherPath: String;
  AppUrl: String;
  Content: String;
begin
  LauncherPath := ExpandConstant('{app}\launch.vbs');
  AppUrl := 'https://preview-2191f985-b65d-42d8-9600-cb5576d395da.space-z.ai/';

  Content :=
    ''' Shia Azan - Silent launcher' + #13#10 +
    ''' Runs the browser in app mode without showing a console window' + #13#10 +
    'Option Explicit' + #13#10 +
    'Dim shell, browserUrl, browserPath' + #13#10 +
    'Set shell = CreateObject("WScript.Shell")' + #13#10 +
    'browserPath = "' + BrowserPath + '"' + #13#10 +
    'browserUrl = "' + AppUrl + '"' + #13#10 +
    'shell.Run """" & browserPath & """ --app=""" & browserUrl & """ --app-name=""Shia Azan"" --app-id=""shiaazan""", 1, False' + #13#10 +
    'Set shell = Nothing' + #13#10;

  Result := SaveStringToFile(LauncherPath, Content, False);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not DetectBrowser() then
  begin
    MsgBox('No supported browser found.' + #13#10 + #13#10 +
           'This installer requires either:' + #13#10 +
           '  - Microsoft Edge (included with Windows 10/11)' + #13#10 +
           '  - Google Chrome' + #13#10 + #13#10 +
           'Please install Microsoft Edge or Google Chrome and try again.',
           mbError, MB_OK);
    Result := False;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    GenerateLauncher();
  end;
end;

// Pin to taskbar (optional task)
procedure CurPageChanged(CurPageID: Integer);
begin
  // Placeholder for future taskbar pinning logic
end;
