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

:: Remove Desktop shortcut
echo   [1/4] Removing Desktop shortcut...
set "DESKTOP_SHORTCUT=%USERPROFILE%\Desktop\Shia Azan.lnk"
if exist "%DESKTOP_SHORTCUT%" del /q "%DESKTOP_SHORTCUT%"

:: Remove Start Menu folder
echo   [2/4] Removing Start Menu shortcuts...
set "START_MENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Shia Azan"
if exist "%START_MENU_DIR%" rmdir /s /q "%START_MENU_DIR%"

:: Remove installation directory
echo   [3/4] Removing installation files...
set "INSTALL_DIR=%LOCALAPPDATA%\ShiaAzan"
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"

:: Remove registry entry
echo   [4/4] Removing registry entry...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiaAzan" /f >nul 2>&1

echo.
echo  ============================================================
echo   Uninstallation Complete
echo  ============================================================
echo.
echo   Shia Azan has been removed from your computer.
echo.
pause
exit /b 0
