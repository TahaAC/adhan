<div align="center">

# 🌙 Shia Azan

**Shia prayer times, everywhere you are.**

Web app · PWA · Browser extension · Windows desktop · Android TV · Apple TV

</div>

---

A single codebase that ships the call to prayer to every screen in your
house: accurate **Shia prayer times** (Tehran / Jafari methods), a live
next-prayer countdown, **Qibla direction**, Hijri date, and the **adhan
played automatically** at each prayer time with your choice of 12
renowned Shia reciters.

## ✨ Features

- **Accurate Shia calculation** — Tehran (Institute of Geophysics,
  University of Tehran) method by default, plus Jafari, Karachi, MWL,
  ISNA, Egypt, Makkah, France, Russia, Malaysia, Singapore; Hanafi/Standard
  Asr; Jafari midnight
- **Live next-prayer hero** with countdown and progress bar
- **Full adhan playback** at each prayer time — 12 reciters streamed
  from praytimes.org (Moazzen Zadeh, Aghati, Ghalwash, …), volume control,
  per-prayer toggles, test button
- **Qibla compass** with device-orientation support (web) and true-north
  bearing + distance (TV)
- **Hijri date** with per-day adjustment
- **Location**: browser geolocation, city search (Open-Meteo), or
  anonymous IP auto-detect on TVs
- **Privacy-first**: everything stored locally, no analytics, no accounts
- **Dark emerald + gold** design language across all platforms

## 📦 What's in this repo

| Path | Platform | Install |
|------|----------|---------|
| `src/` | **Web app / PWA** (Next.js 16 + React 19) | Deploy anywhere, then "Install app" from the browser |
| `public/tv.html` | **TV web app** (self-contained, no server) | Open in any TV browser |
| `browser-extension/` | **Chrome / Edge / Brave / Firefox** extension | Load unpacked |
| `windows-installer/` | **Windows** desktop app + background adhan service | Run `install-shia-azan.bat` or build an .exe with Inno Setup |
| `android-tv/` | **Android TV** app (leanback WebView + background adhan service, ~128 KB APK) | Sideload the APK — no Gradle build needed |
| `apple-tv/` | **Apple TV** app (SwiftUI + WKWebView) | Open in Xcode, ⌘R |
| `tv-app/` | Sources for the TV interface (part1 + praytime.js + part3) | — |
| `download/` | Ready-made packages + READMEs | See [`download/README.md`](download/README.md) |

## 🚀 Quick start (web app)

```bash
bun install        # or npm install
bun dev            # or npm run dev
```

The PWA service worker (`public/sw.js`) caches the shell and adhan audio
for offline use, schedules exact prayer-time notifications, and keeps
itself alive with a 20-second ping while the app is open.

## 📺 Quick start (TV)

- **Android TV**: grab `download/ShiaAzan-AndroidTV.apk` and send it
  from your phone with *Send Files to TV*, or USB + a file manager
  (most TVs have none built in). Enable *Install unknown apps* for
  the app you open it with, then install.
  Full guide: [`android-tv/README.md`](android-tv/README.md).
- **Apple TV**: unzip `download/ShiaAzan-AppleTV-source.zip`, open in
  Xcode, choose your team, press ⌘R. No Mac? Mirror the web app from
  your iPhone via AirPlay. Full guide: [`apple-tv/README.md`](apple-tv/README.md).
- **Any TV browser**: open `download/ShiaAzan-TV.html` (also served at
  `/tv.html` by the web app).

The TV interface is a single self-contained HTML file: 10-foot UI,
D-pad spatial navigation, zero-interaction first run (anonymous IP
geolocation), wake-lock, and automatic adhan through the TV speakers.
On Android TV, the bundled APK also plays the adhan in the background
(foreground service + `AlarmManager.setAlarmClock` + a Java port of
PrayTime that is verified against 1,386 prayer-time combinations).

## 🧪 Tests

```bash
node scripts/test-tv-times.js        # TV page computation == main app's TS port
node scripts/verify-praytime-port.js # Java PrayTime port == JS reference (Android TV)
node scripts/verify-praytime-jscript.js # JScript PrayTime port == JS reference (Windows bg)
```

## 🗺️ Roadmap ideas

- [ ] Play Store / App Store distribution
- [ ] Samsung Tizen & LG webOS native packaging
- [ ] Ramadan calendar, fasting tracker
- [ ] Multi-language UI (Arabic, Farsi, Urdu)

## 📄 License

- **PrayTime library** (v3.2): Copyright (c) 2007-2025 Hamid Zarrabi-Zadeh,
  MIT License — [praytimes.org](https://praytimes.org). See
  [`PRAYTIME-LICENSE`](PRAYTIME-LICENSE).
- **Everything else in this repo**: MIT License.
