# Shia Azan — Browser Extension

A Chrome/Edge/Firefox browser extension that shows Shia prayer times (Tehran/Jafari method) with a live countdown, today's schedule, and Qibla direction — all in a compact popup.

## Features

- 🕌 **Prayer times** using the Tehran (Jafari) method by default — switchable to 10 other methods
- ⏳ **Live countdown** to the next prayer, updating every second
- 📅 **Today's schedule** with 7 daily markers (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha, Midnight)
- 🧭 **Qibla direction** with bearing and distance to the Kaaba
- 🔔 **Desktop notifications** at each prayer time (optional)
- 📍 **Geolocation** — automatically detects your location, or uses Tehran as fallback
- 📿 **Hijri date** displayed in the header
- 🎨 **Compact popup** (360px wide) that opens instantly when you click the toolbar icon

## Installation

### Chrome / Edge / Brave (Load Unpacked)

1. **Download the extension folder** — copy this entire `browser-extension/` folder to your computer.

2. **Open the extensions page:**
   - Chrome: Go to `chrome://extensions/`
   - Edge: Go to `edge://extensions/`
   - Brave: Go to `brave://extensions/`

3. **Enable Developer Mode** — toggle the switch in the top-right corner.

4. **Click "Load unpacked"** — select the `browser-extension/` folder.

5. **Pin the extension** — click the puzzle piece icon in your toolbar and pin "Shia Azan" for quick access.

The extension icon will appear in your toolbar. Click it anytime to see prayer times.

### Firefox (Temporary Installation)

1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file in this folder

> **Note:** Firefox temporary extensions are removed when you close the browser. For permanent installation, the extension would need to be signed by Mozilla.

### Keyboard Shortcut

The default shortcut is **Alt+Shift+A** (or **Option+Shift+A** on Mac) to open the popup. You can customize this in `chrome://extensions/shortcuts`.

## Files

```
browser-extension/
├── manifest.json       # Chrome MV3 manifest
├── popup.html          # Popup UI (360px wide)
├── popup.css           # Popup styles
├── popup.js            # Prayer times logic, countdown, Qibla
├── background.js       # Service worker for notifications & badge
├── praytime.js         # PrayTime v3.2 library (bundled, MIT)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # This file
```

## Settings

Click the gear icon in the popup header to open settings:

- **Calculation Method** — Tehran (Jafari), Jafari, MWL, ISNA, Egypt, Makkah, Karachi, France, Russia, Malaysia (JAKIM), Singapore
- **Time Format** — 12-hour or 24-hour
- **Adhan Reciter** — 12 Shia reciters (for the full web app; the extension shows notifications only)
- **Desktop notifications** — toggle prayer-time notifications

Settings are synced via `chrome.storage.local` and persist across browser sessions.

## Privacy

- Location is detected via the browser's Geolocation API and stored locally on your device
- Reverse-geocoding uses the anonymous BigDataCloud API (no API key, no tracking)
- No data is sent to any server except praytimes.org (for audio, in the web app), BigDataCloud (for city names), and Open-Meteo (for city search)
- The extension does not collect, store, or transmit any personal data

## License

The PrayTime library is Copyright (c) 2007-2025 Hamid Zarrabi-Zadeh, distributed under the MIT License. See `praytime.js` for details.

The extension code is also MIT-licensed.
