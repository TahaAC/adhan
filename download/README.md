# Shia Azan — Downloads

This folder contains downloadable packages for installing the Shia Azan app
on your device or browser.

## 1. Windows Installer (Recommended for PC)

**File:** `ShiaAzan-Windows-Installer.zip`

A complete Windows installer that installs Shia Azan as a standalone
desktop application with Start Menu and Desktop shortcuts, an uninstaller,
and registration in "Add/Remove Programs".

### Quick Install

1. **Download** `ShiaAzan-Windows-Installer.zip`
2. **Extract** the ZIP file to a folder on your computer
3. **Double-click** `install-shia-azan.bat`
4. **Press any key** when prompted to begin installation
5. The app launches automatically when done

After installation, find the app in:
- Desktop shortcut: "Shia Azan"
- Start Menu: search "Shia Azan"
- Settings > Apps > Installed apps (for uninstall)

### What's Included

| File | Description |
|------|-------------|
| `install-shia-azan.bat` | Quick installer — double-click to run |
| `uninstall.bat` | Uninstaller — double-click to remove |
| `launch.vbs` | Silent launcher used by shortcuts |
| `ShiaAzan-Installer.iss` | Inno Setup script to build a proper .exe |
| `icons\shia-azan.ico` | Multi-resolution Windows icon (16–256px) |
| `README.txt` | Detailed installation instructions |

### Building a Professional .exe Installer (Optional)

If you want a standard Windows installer wizard (.exe) instead of the
batch script:

1. Install [Inno Setup](https://jrsoftware.org/isdl.php) (free)
2. Open `ShiaAzan-Installer.iss` in Inno Setup Studio
3. Press **Ctrl+F9** to compile
4. The installer will be in the `Output\` folder as
   `ShiaAzan-Setup-1.0.0.exe`
5. Distribute that .exe — users just double-click to install

### Requirements

- Windows 10 or Windows 11
- Microsoft Edge (included with Windows) OR Google Chrome
- ~5 MB free disk space

---

## 2. Browser Extension (Chrome / Edge / Brave / Firefox)

**File:** `shia-azan-extension.zip`

A compact browser extension that shows prayer times in a popup when you
click the toolbar icon. Includes live countdown, today's schedule, Qibla
direction, and desktop notifications.

### Installation (Chrome / Edge / Brave)

1. **Download and unzip** `shia-azan-extension.zip` to a folder on your
   computer (e.g. `C:\ShiaAzanExtension\` on Windows or
   `~/ShiaAzanExtension/` on Mac/Linux).

2. **Open the extensions page** in your browser:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`

3. **Enable Developer Mode** — toggle the switch in the top-right corner.

4. **Click "Load unpacked"** — select the unzipped `browser-extension/`
   folder (the one containing `manifest.json`).

5. **Pin the extension** — click the puzzle piece icon in your toolbar
   and pin "Shia Azan" for quick access.

The extension icon (a gold crescent on emerald background) will appear in
your toolbar. Click it anytime to see prayer times for your location.

### Keyboard Shortcut

**Alt+Shift+A** (or **Option+Shift+A** on Mac) opens the popup instantly.

---

## 2. Installable PWA (Windows / Mac / Linux / Mobile)

The web app is a **Progressive Web App (PWA)** — you can install it
directly from your browser as a standalone desktop application.

### Installation on Windows / Mac / Linux (Chrome or Edge)

1. **Open the app** in Chrome or Edge:
   `https://preview-<bot-id>.space-z.ai/`

2. **Look for the install icon** — in the address bar, you'll see an
   install icon (a monitor with a down arrow). Click it.

   Alternatively, click the **three-dot menu** → **"Install Shia Azan..."**

3. **Confirm** — click "Install" in the dialog.

4. **Launch** — the app is now in your Start menu (Windows) or
   Applications folder (Mac). It opens in its own window, works offline,
   and behaves like a native app.

### Installation on Mobile

- **Android (Chrome):** Open the app → three-dot menu → "Install app"
- **iOS (Safari):** Open the app → Share button → "Add to Home Screen"

### PWA Features

- ✅ **Background adhan notifications** — after installing, the adhan
  plays automatically at each prayer time, even when the app is
  minimized or the tab is in the background. A Windows toast banner
  appears in the bottom-right corner for ~5 seconds showing
  "Adhan: Fajr — It's time for Fajr. Allahu Akbar."
- ✅ **Offline support** — app shell and adhan audio are cached for
  offline use after the first visit
- ✅ **Standalone window** — runs in its own window, not a browser tab
- ✅ **Start menu integration** — appears in your OS app launcher
- ✅ **Auto-updates** — checks for updates in the background
- ✅ **Push-ready** — can receive prayer-time notifications even when
  the app is closed (with notification permission)

### Enabling Background Notifications

After installing the PWA:

1. **Open the installed app** from your Start menu (Windows) or
   Applications folder (Mac).
2. **Click "Enable"** on the yellow "Enable background adhan
   notifications" bar that appears below the next-prayer hero.
3. **Allow notifications** when your browser prompts you.
4. **Test it** — click "Test notification" to see a sample Windows
   toast. You should see a banner appear in the bottom-right corner.

Once enabled, the app will:
- Show a Windows toast banner at each prayer time (auto-dismisses
  after ~5 seconds)
- Play the selected reciter's adhan audio
- Show the full-screen adhan overlay with the prayer name, Shahada,
  and live progress bar

> **Note:** For background notifications to fire reliably, keep the
> app open (even minimized). The service worker schedules exact
> timeouts for each prayer time, but the browser may kill an idle
> service worker after ~30 seconds. The app sends a keep-alive ping
> every 20 seconds while it's open to prevent this.

---

## 3. Files in This Download

| File | Description |
|------|-------------|
| `ShiaAzan-Windows-Installer.zip` | Windows installer package (extract and run install-shia-azan.bat) |
| `shia-azan-extension.zip` | Browser extension package (unzip and load unpacked) |

---

## Privacy

- Location is detected via the browser's Geolocation API and stored
  locally on your device only
- Reverse-geocoding uses the anonymous BigDataCloud API (no API key)
- City search uses the anonymous Open-Meteo geocoding API
- Adhan audio is streamed from praytimes.org (CORS-enabled)
- No data is collected, stored, or transmitted to any analytics server

## License

- **PrayTime library** (v3.2): Copyright (c) 2007-2025 Hamid Zarrabi-Zadeh,
  MIT License. See [praytimes.org](https://praytimes.org).
- **App and extension code**: MIT License.
