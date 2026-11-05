@echo off
chcp 65001 >nul 2>&1
setlocal

::============================================================::
::  Shia Azan - Uninstaller                                   ::
::============================================================::

title Uninstall Shia Azan

echo.
echo  ============================================================
echo   Uninstall Shia Azan
echo  ============================================================
echo.
echo   This will remove:
echo     - Desktop shortcut
echo     - Start Menu shortcuts
echo     - Installation files
echo     - Registry entry from Add/Remove Programs
echo.
echo   Your settings and location data (stored in the browser) will
echo   be preserved.
echo.
echo   Press any key to uninstall, or CTRL+C to cancel.
echo.
pause >nul

echo.
echo  Uninstalling...

:: Stop background adhan service (any wscript running our .wsf)
echo   [1/5] Stopping background adhan service...
taskkill /f /im wscript.exe /fi "WINDOWTITLE eq Shia Azan*" >nul 2>&1

:: Remove Startup shortcut
echo   [2/5] Removing startup shortcut...
set "STARTUP_SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Shia Azan Adhan.lnk"
if exist "%STARTUP_SHORTCUT%" del /q "%STARTUP_SHORTCUT%"

:: Remove Desktop shortcut
echo   [3/5] Removing Desktop shortcut...
set "DESKTOP_SHORTCUT=%USERPROFILE%\Desktop\Shia Azan.lnk"
if exist "%DESKTOP_SHORTCUT%" del /q "%DESKTOP_SHORTCUT%"

:: Remove Start Menu folder
echo   [4/5] Removing Start Menu shortcuts...
set "START_MENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Shia Azan"
if exist "%START_MENU_DIR%" rmdir /s /q "%START_MENU_DIR%"

:: Remove installation directory
echo   [5/5] Removing installation files...
set "INSTALL_DIR=%LOCALAPPDATA%\ShiaAzan"
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"

:: Remove registry entry
echo   Removing registry entry...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiaAzan" /f >nul 2>&1

echo.
echo  ============================================================
echo   Uninstallation Complete
echo  ============================================================
echo.
echo   Shia Azan has been removed from your computer.
echo.
echo   Your settings file (%%APPDATA%%\ShiaAzan\settings.json) was
echo   preserved in case you reinstall. Delete that folder to remove
echo   it completely.
echo.
pause
exit /b 0
