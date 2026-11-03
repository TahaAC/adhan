============================================================
  Shia Azan - Windows Installer Package
  Version 1.1.0
============================================================

This package installs the Shia Azan app on your Windows PC as a
standalone desktop application, with a background adhan service
that runs at every prayer time — even when the app is closed or
the computer was rebooted.


------------------------------------------------------------
  QUICK INSTALL (Recommended)
------------------------------------------------------------

1. Extract this ZIP file to a folder on your computer
   (e.g. C:\Users\YourName\Downloads\ShiaAzan-Installer)

2. Double-click "install-shia-azan.bat"

3. Press any key when prompted to begin installation

4. Wait for the installation to complete (a few seconds)

5. The app launches automatically and the background adhan
   service starts immediately (hidden, in the background).


------------------------------------------------------------
  BACKGROUND ADHAN (NEW IN 1.1.0)
------------------------------------------------------------

The installer sets up a standalone background adhan service that:

  - Auto-starts at Windows logon (via a Startup folder shortcut)
  - Runs invisibly (no window, no taskbar icon)
  - Computes prayer times itself (no browser needed) using a
    JScript port of PrayTime.js — verified against 1,386
    prayer-time combinations
  - At each enabled prayer time, shows a Windows toast
    notification AND plays the adhan MP3 through the speakers
  - Survives reboots (the Startup shortcut relaunches it)
  - Auto-detects your city via IP on first run

You do NOT need to keep the app or your browser open. The
background runner is a separate process (wscript.exe running
shia-azan-bg.wsf) that runs independently.

To configure the background adhan (city, method, reciter,
volume, which prayers are enabled):

  Start Menu > "Shia Azan Settings"

  This opens a small settings window. Changes are saved to
  %APPDATA%\ShiaAzan\settings.json and picked up by the
  background runner within 30 seconds.

To check the background runner's log:
  %APPDATA%\ShiaAzan\bg.log

To start/stop the background runner manually:
  Start:  wscript.exe "%LOCALAPPDATA%\ShiaAzan\bg\shia-azan-bg.wsf"
  Stop:   Open Task Manager, end "wscript.exe" processes
          (or run: taskkill /f /im wscript.exe)


------------------------------------------------------------
  WHERE TO FIND THE APP AFTER INSTALLATION
------------------------------------------------------------

After installation:

  - Desktop shortcut: "Shia Azan" (double-click) — opens the
    full PWA in a browser app-mode window
  - Start Menu: "Shia Azan" — same as above
  - Start Menu: "Shia Azan Settings" — opens the background
    adhan configuration window
  - The background adhan service runs automatically at logon;
    no action needed.


------------------------------------------------------------
  HOW IT WORKS
------------------------------------------------------------

Two components are installed:

1. Full app (browser-based PWA):
   The launcher opens the Shia Azan PWA in your browser's
   "app mode" — runs in its own window with its own taskbar
   icon, works offline after first load.

2. Background adhan service (NEW):
   A Windows Script Host (WSH) runner (shia-azan-bg.wsf)
   that runs invisibly via wscript.exe. It loads settings
   from %APPDATA%\ShiaAzan\settings.json, computes prayer
   times with the bundled JScript port of PrayTime.js, and
   at each enabled prayer time calls a small PowerShell
   helper (notify-and-play.ps1) that shows a toast and
   plays the reciter MP3 via the .NET WPF MediaPlayer.

The background service is completely independent of the
browser. Closing the browser or rebooting the computer does
not stop the adhan from playing at the next prayer time.


------------------------------------------------------------
  REQUIREMENTS
------------------------------------------------------------

  - Windows 10 or Windows 11
  - Microsoft Edge (included with Windows) OR Google Chrome
    (only needed for the full PWA app, not the background adhan)
  - .NET Framework 4+ (pre-installed on Windows 10+) — used by
    the background adhan's audio playback
  - Internet connection for first run (auto-detects city via IP;
    adhan audio is streamed from praytimes.org)
  - ~10 MB free disk space


------------------------------------------------------------
  UNINSTALL
------------------------------------------------------------

To remove Shia Azan from your computer:

  Option 1: Use Settings
  - Open Settings > Apps > Installed apps
  - Find "Shia Azan" and click Uninstall

  Option 2: Use the uninstaller
  - Run: %LOCALAPPDATA%\ShiaAzan\uninstall.bat
  - Or find "Uninstall Shia Azan" in the Start Menu

  Option 3: Use the included uninstall.bat
  - Double-click "uninstall.bat" in this folder

The uninstaller stops the background adhan, removes the Startup
shortcut, and deletes all installed files. Your settings file
(%APPDATA%\ShiaAzan\settings.json) is preserved in case you
reinstall — delete that folder to remove it completely.


------------------------------------------------------------
  BUILD A PROPER .EXE INSTALLER (Optional)
------------------------------------------------------------

If you want a professional .exe installer (with a wizard UI,
license agreement, etc.) instead of the batch script, you can
compile one using Inno Setup:

1. Download and install Inno Setup (free):
   https://jrsoftware.org/isdl.php

2. Open "ShiaAzan-Installer.iss" in Inno Setup Studio

3. Press Ctrl+F9 (or Build > Compile)

4. The installer will be created in the "Output" subfolder as:
   ShiaAzan-Setup-1.1.0.exe

5. Distribute that .exe file to users — they just double-click
   it to install with a standard Windows installer wizard.


------------------------------------------------------------
  TROUBLESHOOTING
------------------------------------------------------------

Problem: "Windows protected your PC" when running the .bat file
Solution: Click "More info" > "Run anyway". This is Windows
SmartScreen warning about unrecognized scripts. The installer
is safe — it only creates shortcuts and copies files.

Problem: The app doesn't launch after installation
Solution: Make sure you have Microsoft Edge or Google Chrome
installed. The launcher auto-detects which browser to use.

Problem: The adhan doesn't play at prayer time
Solution:
  1. Open Task Manager (Ctrl+Shift+Esc) and check that
     wscript.exe is running. If not, launch it:
     wscript.exe "%LOCALAPPDATA%\ShiaAzan\bg\shia-azan-bg.wsf"
  2. Check the log: %APPDATA%\ShiaAzan\bg.log
  3. Open "Shia Azan Settings" and verify your city is set
     and the prayer you're waiting for is enabled.
  4. Make sure .NET Framework 4+ is installed (it is by
     default on Windows 10+).
  5. Check that your speakers are on and not muted.

Problem: The adhan plays but no notification appears
Solution: Open Windows Settings > System > Notifications and
make sure notifications are enabled. The background runner
uses NotifyIcon balloon tips which require notifications to
be on.

Problem: Location not detected
Solution: The background runner auto-detects your city via IP
on first run. If that fails (e.g. no internet), open "Shia
Azan Settings" and pick a city from the dropdown.

Problem: The adhan is too loud / too quiet
Solution: Open "Shia Azan Settings" and adjust the Volume
slider. Changes take effect within 30 seconds.

Problem: I want to disable the background adhan temporarily
Solution: Open Task Manager, end wscript.exe. Or uncheck
"Adhan enabled" in "Shia Azan Settings". The runner will
skip all prayer times until you re-enable it.


------------------------------------------------------------
  FILES IN THIS PACKAGE
------------------------------------------------------------

  install-shia-azan.bat    Quick installer (double-click to run)
  uninstall.bat            Uninstaller (double-click to remove)
  launch.vbs               Silent launcher (used by app shortcuts)
  ShiaAzan-Installer.iss   Inno Setup script (to build .exe)
  README.txt               This file
  icons\
    shia-azan.ico          App icon (multi-resolution, for Windows)
    shia-azan.png          App icon (256x256 PNG)
  bg\                      Background adhan service
    shia-azan-bg.wsf       Main background runner (WSH/JScript)
    praytime-jscript.js    JScript port of PrayTime.js
    notify-and-play.ps1    Toast + audio playback helper
    config.hta             Settings UI (HTML Application)
    settings-default.json  Default settings template


------------------------------------------------------------
  LICENSE
------------------------------------------------------------

Shia Azan app code: MIT License
PrayTime library v3.2: Copyright (c) 2007-2025 Hamid Zarrabi-Zadeh,
  MIT License. See https://praytimes.org
Adhan audio: Copyright praytimes.org, used under their terms.

============================================================
