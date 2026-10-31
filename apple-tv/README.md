# Shia Azan — Apple TV (tvOS)

A native Apple TV app that shows Shia prayer times, a live countdown,
Qibla direction, and plays the adhan at each prayer time — designed
for the 10-foot TV experience.

The app is a thin SwiftUI + WKWebView shell around a self-contained
TV page (`ShiaAzanTV/TVPage.html`) that needs no server: it bundles
the PrayTime v3.2 calculator, auto-detects your city via an anonymous
IP lookup on first launch, and stores settings locally on the device.

---

## Requirements

- A Mac with **Xcode 15 or later** (free from the Mac App Store)
- An Apple TV (HD or 4K) on tvOS 14 or later, on the same Wi-Fi as the Mac
- Any Apple ID (a free one works)

## Install (5 minutes)

1. **Open the project**
   Double-click `ShiaAzanTV.xcodeproj` (or open it from Xcode:
   File ▸ Open).

2. **Set your signing team**
   Select the **ShiaAzanTV** target ▸ **Signing & Capabilities** ▸
   tick *Automatically manage signing* ▸ choose your **Team**
   (your personal Apple ID appears in the list after you add it in
   Xcode ▸ Settings ▸ Accounts).

3. **Select your Apple TV as the run destination**
   Xcode detects Apple TVs on the same network. Pick it in the
   device dropdown at the top. (For a wired connection, connect the
   Apple TV to your Mac with a USB‑C / Micro‑USB cable and pair it.)

4. **Press ⌘R** (Run)
   The first run installs the app on your Apple TV. On the TV,
   allow the developer app when prompted:
   *Settings ▸ General ▸ Privacy ▸ Developer-style Apps* (or
   *Profiles & Device Management* ▸ trust your Apple ID).

5. Done — the app appears on the Apple TV home screen with the
   gold-crescent icon.

> **Free Apple ID note:** apps signed with a free account expire
> after 7 days — just press ⌘R again to refresh. With a paid
> Developer Account you can also distribute via **TestFlight**
> (never expires, no Mac needed after the first upload).

## Using the app

- **Nothing to set up**: on first launch it detects your city from
  your IP and starts the clock.
- Tap/press the **Change** button to pick from 36 preset cities
  (or auto-detect again).
- **Settings**: calculation method (Tehran default), Asr factor,
  12/24-hour clock, Hijri adjustment, adhan on/off, 12 reciters,
  volume.
- The **screen stays awake** so it works as a prayer clock.
- The **adhan plays automatically** at each prayer time.

## No Mac? Use AirPlay instead

You don't need this project to get Shia Azan on your Apple TV:

1. Open the Shia Azan web app on your **iPhone or iPad**.
2. Tap **Screen Mirroring** (Control Centre) ▸ choose your Apple TV.
3. The prayer clock mirrors to the TV, adhan included.

## Troubleshooting

- **"Untrusted developer"** on the TV: allow it in
  Settings ▸ General ▸ Privacy ▸ Developer-style Apps.
- **Xcode can't see the Apple TV**: on the Apple TV open
  *Settings ▸ Remotes and Devices ▸ Remote App and Devices* while
  Xcode ▸ Devices and Simulators is open on the Mac, or connect the
  TV to the Mac with a USB-C cable.
- **Project fails to open** (very old Xcode): create a new
  *tvOS ▸ App* project named `ShiaAzanTV` (Interface: SwiftUI,
  Language: Swift), then replace `ContentView.swift` with the one
  here and drag `TVPage.html` + `Assets.xcassets` into the project.

## Project layout

```
apple-tv/
├── ShiaAzanTV.xcodeproj/     Xcode project (single target)
└── ShiaAzanTV/
    ├── ShiaAzanTVApp.swift   @main SwiftUI app
    ├── ContentView.swift     WKWebView wrapper (fullscreen)
    ├── TVPage.html           the whole TV interface (self-contained)
    └── Assets.xcassets/      App icon (400x240 @1x/@2x)
```
