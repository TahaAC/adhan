============================================================
  Shia Azan - Windows Installer Package
  Version 1.0.0
============================================================

This package contains everything you need to install the Shia Azan
app on your Windows PC as a standalone desktop application.


------------------------------------------------------------
  QUICK INSTALL (Recommended)
------------------------------------------------------------

1. Extract this ZIP file to a folder on your computer
   (e.g. C:\Users\YourName\Downloads\ShiaAzan-Installer)

2. Double-click "install-shia-azan.bat"

3. Press any key when prompted to begin installation

4. Wait for the installation to complete (a few seconds)

5. The app will launch automatically when done

6. On first launch:
   - Click "Enable" on the yellow notification bar
   - Allow notifications when prompted
   - Click "Test notification" to verify it works


------------------------------------------------------------
  WHERE TO FIND THE APP AFTER INSTALLATION
------------------------------------------------------------

After installation, you can launch Shia Azan from:

  - Desktop shortcut: "Shia Azan" (double-click)
  - Start Menu: search "Shia Azan" or find in All Programs
  - Or run: wscript.exe "%LOCALAPPDATA%\ShiaAzan\launch.vbs"


------------------------------------------------------------
  HOW IT WORKS
------------------------------------------------------------

The installer creates a launcher that opens the Shia Azan PWA in
your browser's "app mode" — this makes it behave like a native
Windows application:

  - Runs in its own window (no browser address bar or tabs)
  - Has its own taskbar icon
  - Works offline after first load
  - Supports background adhan notifications
  - Can be pinned to the taskbar

The app is powered by your installed browser (Microsoft Edge or
Google Chrome) but appears as a standalone application.


------------------------------------------------------------
  REQUIREMENTS
------------------------------------------------------------

  - Windows 10 or Windows 11
  - Microsoft Edge (included with Windows) OR Google Chrome
  - Internet connection for first launch (offline after that)
  - ~5 MB free disk space


------------------------------------------------------------
  UNINSTALL
------------------------------------------------------------

To remove Shia Azan from your computer:

  Option 1: Use Settings
  - Open Settings > Apps > Installed apps
  - Find "Shia Azan"
  - Click it and select "Uninstall"

  Option 2: Use the uninstaller
  - Run: %LOCALAPPDATA%\ShiaAzan\uninstall.bat
  - Or find "Uninstall Shia Azan" in the Start Menu

  Option 3: Use the included uninstall.bat
  - Double-click "uninstall.bat" in this folder


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
   ShiaAzan-Setup-1.0.0.exe

5. Distribute that .exe file to users — they just double-click
   it to install with a standard Windows installer wizard.


------------------------------------------------------------
  TROUBLESHOOTING
------------------------------------------------------------

Problem: "Windows protected your PC" when running the .bat file
Solution: Click "More info" > "Run anyway". This is Windows
SmartScreen warning about unrecognized scripts. The installer
is safe — it only creates shortcuts and a launcher script.

Problem: The app doesn't launch after installation
Solution: Make sure you have Microsoft Edge or Google Chrome
installed. The launcher auto-detects which browser to use.

Problem: Notifications don't appear
Solution: After launching the app, click "Enable" on the yellow
notification bar. Allow notifications when your browser asks.
Check Windows Settings > System > Notifications to make sure
notifications are enabled for your browser.

Problem: The adhan doesn't play in the background
Solution: Keep the app open (even minimized). The service worker
schedules exact timeouts for each prayer time, but the browser
may kill an idle service worker. The app sends keep-alive pings
every 20 seconds while it's open.

Problem: Location not detected
Solution: Click "Pick a city" in the location banner and search
for your city. Or open the app in a new browser tab (not via
the desktop shortcut) and allow location access, then reload.


------------------------------------------------------------
  FILES IN THIS PACKAGE
------------------------------------------------------------

  install-shia-azan.bat    Quick installer (double-click to run)
  uninstall.bat            Uninstaller (double-click to remove)
  launch.vbs               Silent launcher (used by shortcuts)
  ShiaAzan-Installer.iss   Inno Setup script (to build .exe)
  README.txt               This file
  icons\
    shia-azan.ico          App icon (multi-resolution, for Windows)
    shia-azan.png          App icon (256x256 PNG)


------------------------------------------------------------
  LICENSE
------------------------------------------------------------

Shia Azan app code: MIT License
PrayTime library v3.2: Copyright (c) 2007-2025 Hamid Zarrabi-Zadeh,
  MIT License. See https://praytimes.org
Adhan audio: Copyright praytimes.org, used under their terms.

============================================================
