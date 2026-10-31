@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

::============================================================::
::  Shia Azan - Windows Installer                            ::
::  Installs the Shia Azan PWA as a standalone desktop app    ::
::  with Start Menu and Desktop shortcuts.                   ::
::                                                            ::
::  The app opens in Chrome or Edge "app mode" which makes    ::
::  it behave like a native Windows application:              ::
::  - Runs in its own window (no browser chrome)              ::
::  - Has its own taskbar icon                                ::
::  - Works offline after first load                          ::
::  - Background adhan notifications supported                ::
::============================================================::

title Shia Azan Installer

:: App URL - the PWA preview URL
set "APP_URL=https://preview-2191f985-b65d-42d8-9600-cb5576d395da.space-z.ai/"
set "APP_NAME=Shia Azan"
set "APP_DESC=Shia Prayer Times and Adhan"
set "INSTALL_DIR=%LOCALAPPDATA%\ShiaAzan"
set "ICON_DIR=%INSTALL_DIR%\icons"
set "START_MENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Shia Azan"
set "DESKTOPShortcut=%USERPROFILE%\Desktop\Shia Azan.lnk"
set "VERSION=1.0.0"

:: Detect the best available browser (Edge first, then Chrome)
set "BROWSER="
set "BROWSER_NAME="

:: Check Microsoft Edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
    set "BROWSER_NAME=Microsoft Edge"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
    set "BROWSER_NAME=Microsoft Edge"
)

:: Check Google Chrome
if not defined BROWSER (
    if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
        set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
        set "BROWSER_NAME=Google Chrome"
    ) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
        set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
        set "BROWSER_NAME=Google Chrome"
    ) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
        set "BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
        set "BROWSER_NAME=Google Chrome"
    )
)

:: If no browser found, show error
if not defined BROWSER (
    echo.
    echo [ERROR] No supported browser found.
    echo.
    echo This installer requires either:
    echo   - Microsoft Edge ^(included with Windows 10/11^)
    echo   - Google Chrome
    echo.
    echo Please install Microsoft Edge or Google Chrome and try again.
    echo.
    pause
    exit /b 1
)

:: Display installer banner
echo.
echo  ============================================================
echo   Shia Azan - Windows Installer v%VERSION%
echo  ============================================================
echo.
echo   App:        %APP_NAME%
echo   Description:%APP_DESC%
echo   Browser:    %BROWSER_NAME%
echo   Install to: %INSTALL_DIR%
echo.
echo  ------------------------------------------------------------
echo.
echo   This installer will:
echo     1. Create the installation directory
echo     2. Copy app icons
echo     3. Create Start Menu shortcut
echo     4. Create Desktop shortcut
echo     5. Create uninstaller
echo.
echo   Press any key to install, or CTRL+C to cancel.
echo.
pause >nul

echo.
echo  Installing...

:: Step 1: Create installation directory
echo   [1/5] Creating installation directory...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%ICON_DIR%" mkdir "%ICON_DIR%"
if errorlevel 1 (
    echo   [ERROR] Could not create installation directory.
    pause
    exit /b 1
)

:: Step 2: Copy icons
echo   [2/5] Copying app icons...
:: Icons are in the same folder as this installer
set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%icons\shia-azan.ico" (
    copy /y "%SCRIPT_DIR%icons\shia-azan.ico" "%ICON_DIR%\shia-azan.ico" >nul
) else (
    echo   [WARNING] Icon file not found. Shortcuts will use browser icon.
)

:: Step 3: Create launcher script (hidden VBScript that runs the browser)
echo   [3/5] Creating launcher...
set "LAUNCHER=%INSTALL_DIR%\launch.vbs"
(
    echo ' Shia Azan - Silent launcher
    echo ' Runs the browser in app mode without showing a console window
    echo Option Explicit
    echo Dim shell, browserUrl, browserPath
    echo Set shell = CreateObject^("WScript.Shell"^)
    echo browserPath = "%BROWSER%"
    echo browserUrl = "%APP_URL%"
    echo shell.Run """" ^& browserPath ^& """ --app=""" ^& browserUrl ^& """ --app-name=""Shia Azan"" --app-id=""shiaazan""", 1, False
    echo Set shell = Nothing
) > "%LAUNCHER%"

:: Step 4: Create Start Menu shortcut
echo   [4/5] Creating Start Menu shortcut...
if not exist "%START_MENU_DIR%" mkdir "%START_MENU_DIR%"

set "START_SHORTCUT=%START_MENU_DIR%\Shia Azan.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$sc = $ws.CreateShortcut('%START_SHORTCUT%'); " ^
    "$sc.TargetPath = 'wscript.exe'; " ^
    "$sc.Arguments = '\"%LAUNCHER%\"'; " ^
    "$sc.IconLocation = '%ICON_DIR%\shia-azan.ico, 0'; " ^
    "$sc.Description = '%APP_DESC%'; " ^
    "$sc.WorkingDirectory = '%INSTALL_DIR%'; " ^
    "$sc.WindowStyle = 7; " ^
    "$sc.Save()"

:: Also create a folder shortcut for the Start Menu folder itself
set "FOLDER_SHORTCUT=%START_MENU_DIR%\Uninstall Shia Azan.lnk"

:: Step 5: Create Desktop shortcut
echo   [5/5] Creating Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$sc = $ws.CreateShortcut('%DESKTOPShortcut%'); " ^
    "$sc.TargetPath = 'wscript.exe'; " ^
    "$sc.Arguments = '\"%LAUNCHER%\"'; " ^
    "$sc.IconLocation = '%ICON_DIR%\shia-azan.ico, 0'; " ^
    "$sc.Description = '%APP_DESC%'; " ^
    "$sc.WorkingDirectory = '%INSTALL_DIR%'; " ^
    "$sc.WindowStyle = 7; " ^
    "$sc.Save()"

:: Create uninstaller
echo   Creating uninstaller...
set "UNINSTALLER=%INSTALL_DIR%\uninstall.bat"
(
    echo @echo off
    echo chcp 65001 ^>nul 2^>^&1
    echo title Uninstall Shia Azan
    echo echo.
    echo echo  Uninstalling Shia Azan...
    echo echo.
    echo echo   Removing shortcuts...
    echo if exist "%DESKTOPShortcut%" del /q "%DESKTOPShortcut%"
    echo if exist "%START_MENU_DIR%" rmdir /s /q "%START_MENU_DIR%"
    echo echo   Removing installation files...
    echo if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
    echo echo.
    echo echo  Shia Azan has been uninstalled.
    echo echo.
    echo pause
) > "%UNINSTALLER%"

:: Create uninstall shortcut in Start Menu
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$sc = $ws.CreateShortcut('%FOLDER_SHORTCUT%'); " ^
    "$sc.TargetPath = '%UNINSTALLER%'; " ^
    "$sc.IconLocation = 'shell32.dll, 131'; " ^
    "$sc.Description = 'Uninstall Shia Azan'; " ^
    "$sc.Save()"

:: Create a registry entry for "Add/Remove Programs"
echo   Registering in Add/Remove Programs...
set "REG_KEY=HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiaAzan"
reg add "%REG_KEY%" /v "DisplayName" /t REG_SZ /d "Shia Azan" /f >nul 2>&1
reg add "%REG_KEY%" /v "DisplayVersion" /t REG_SZ /d "%VERSION%" /f >nul 2>&1
reg add "%REG_KEY%" /v "Publisher" /t REG_SZ /d "Shia Azan" /f >nul 2>&1
reg add "%REG_KEY%" /v "DisplayIcon" /t REG_SZ /d "%ICON_DIR%\shia-azan.ico" /f >nul 2>&1
reg add "%REG_KEY%" /v "InstallLocation" /t REG_SZ /d "%INSTALL_DIR%" /f >nul 2>&1
reg add "%REG_KEY%" /v "UninstallString" /t REG_SZ /d "%UNINSTALLER%" /f >nul 2>&1
reg add "%REG_KEY%" /v "NoModify" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "%REG_KEY%" /v "NoRepair" /t REG_DWORD /d 1 /f >nul 2>&1

:: Done
echo.
echo  ============================================================
echo   Installation Complete!
echo  ============================================================
echo.
echo   Shia Azan has been installed successfully.
echo.
echo   You can now launch it from:
echo     - Desktop shortcut: "Shia Azan"
echo     - Start Menu: "Shia Azan"
echo.
echo   To uninstall:
echo     - Use "Add/Remove Programs" in Settings, OR
echo     - Run: %UNINSTALLER%
echo.
echo   ------------------------------------------------------------
echo   IMPORTANT: First launch instructions
echo   ------------------------------------------------------------
echo   1. The app will open in %BROWSER_NAME% app mode
echo   2. Click "Enable" on the yellow notification bar
echo   3. Allow notifications when prompted
echo   4. Click "Test notification" to verify it works
echo   5. Keep the app open ^(minimized is OK^) for background adhan
echo.
echo   Press any key to launch Shia Azan now...
pause >nul

:: Launch the app
start "" wscript.exe "%LAUNCHER%"

exit /b 0
