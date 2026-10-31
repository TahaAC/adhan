# Shia Azan — Android TV

A leanback Android TV app: a fullscreen WebView around a
self-contained TV page (`app/assets/tv.html`) with D-pad
navigation, live countdown, Qibla direction and automatic adhan
playback. No server required — everything is bundled in the APK.

## Install the prebuilt APK

> **Important:** Android TV has **no built-in file manager** on most
> models (Google TV, Sony, TCL, Hisense...). Plugging in a USB stick
> alone does nothing — you need a file manager app to open the APK.
> The easiest route is Wi-Fi transfer from your phone (Option A);
> USB works too but needs one extra app (Option B).

### Option A — Wi-Fi from your phone (easiest, no USB)

1. On the **TV**: open the **Google Play Store** ▸ install
   **[Send Files to TV](https://play.google.com/store/apps/details?id=com.yablio.sendfilestotv)**
   (free, by Yablio).
2. On your **phone**: install *Send Files to TV* from the Play
   Store too (phone and TV must be on the same Wi-Fi).
3. Get `ShiaAzan-AndroidTV.apk` onto the phone: on GitHub tap the
   file ▸ *Download raw file* (or download it on a computer and
   send it to your phone).
4. Phone app ▸ **Send** ▸ pick the APK. TV app ▸ **Receive**.
5. When the transfer finishes, **tap the received file** ▸ the TV
   asks to allow installs from *Send Files to TV* ▸ open
   **Settings** ▸ enable **Install unknown apps** for it ▸ go back
   ▸ **Install**.
6. If **Play Protect** says "*Unsafe app blocked*": tap
   **More details** ▸ **Install anyway** (the warning appears only
   because the app is not from the Play Store).

The app then appears on the Android TV home screen with its banner.

### Option B — USB stick

1. Format the stick as **FAT32 or exFAT** (many TVs cannot read
   NTFS) and copy `ShiaAzan-AndroidTV.apk` onto it — the file only,
   not the zip.
2. Install a file manager on the TV from the Play Store:
   [File Commander](https://play.google.com/store/apps/details?id=com.mobisystems.file),
   FX, or X-plore all work.
3. Plug in the USB ▸ open the file manager ▸ browse to the stick ▸
   tap the APK.
4. The TV asks to allow installs from the file manager ▸ **Settings**
   ▸ enable **Install unknown apps** for it ▸ **Install**.
   - Menu path if you need it manually:
     Settings ▸ Device Preferences ▸ Security & Restrictions ▸
     Unknown sources (older TVs) — or Settings ▸ Apps ▸
     *the file manager* ▸ Install unknown apps (Android 8+).
5. If **Play Protect** blocks the install: **More details** ▸
   **Install anyway**.

> Direct `adb install` also works:
> `adb connect <TV-IP>:5555 && adb install ShiaAzan-AndroidTV.apk`

### Also works on Android phones/tablets

The same APK installs as a regular launcher app (landscape).

## Troubleshooting: "I copied it to USB but can't install"

| Symptom | Cause → Fix |
| --- | --- |
| Nothing happens when I plug in the USB | Normal — TVs have no built-in file browser. Install a file manager (Option B, step 2) or use Wi-Fi transfer (Option A). |
| USB stick not visible at all | Stick is NTFS → reformat to FAT32/exFAT, recopy the APK. Also try the other USB port (some are input-only). |
| "There was a problem parsing the package" | The file did not copy fully or is not the APK (don't copy the `.zip`), or the TV runs Android < 5.0. Recopy from GitHub and retry. |
| "App not installed" | Transfer got corrupted — resend the file, or enable Install unknown apps *for the app you open it with*, then retry. |
| "Blocked by Play Protect" / "Unsafe app blocked" | Tap *More details* ▸ *Install anyway*. The APK is debug-signed, which triggers the warning; it is safe to install. |
| Install option greyed out | Install unknown apps is not enabled for the app you are opening the APK from (Settings ▸ Apps ▸ that app ▸ Install unknown apps). |
| My TV has no Google Play Store | It is probably **not Android TV** (Samsung Tizen, LG webOS and others cannot install APKs at all). Use the TV's web browser to open `tv.html`, or screen-mirror / AirPlay from a phone instead. |

First run: the app auto-detects your city via anonymous IP lookup —
just press **OK** on the remote and it starts. No accounts, no
permissions to grant.

## Features

- **D-pad navigation** — arrows move focus, OK selects, Back closes
  overlays (Android TV remote, gamepad or keyboard).
- **Zero setup** — auto-detects the city via anonymous IP lookup;
  36 preset cities available offline.
- **Adhan plays automatically** at each prayer time
  (`mediaPlaybackRequiresUserGesture=false` in the WebView).
- **Screen stays awake** — doubles as a prayer clock.
- Tehran (Shia) calculation method by default; 10 more methods,
  Asr factor, Hijri adjustment, 12 reciters, volume — all in
  Settings.

## Build it yourself (no Gradle)

The repo includes a fully self-contained build that only needs
JDK 17+, Android build-tools and a platform JAR:

```bash
# 1) put the tools in /home/z/tools (or edit the script paths):
#    build-tools r33 -> bt33/android-13/{aapt2,d8,apksigner,zipalign}
#    platform 35     -> pf35/android-35/android.jar
#    JDK 21          -> jdk-21.0.13+9/
# 2) build:
bash scripts/build-apk.sh
# -> download/ShiaAzan-AndroidTV.apk (debug-signed)
```

The script runs `aapt2 compile/link → javac → d8 → zip → zipalign →
apksigner`. Keystore: `android-tv/debug.keystore`
(store/key password `shiaazan`, alias `shiaazan`) — replace with
your own key for a Play Store release build.

> **Note:** `MainActivity` intentionally uses the *raw*
> `ValueCallback` type — the generic `ValueCallback<String>`
> trips a NullPointerException in the d8 dexer shipped with
> build-tools 33/34.

## Project layout

```
android-tv/
├── app/
│   ├── AndroidManifest.xml        leanback launcher, INTERNET perm
│   ├── java/com/shiaazan/tv/
│   │   └── MainActivity.java      WebView shell + back handling
│   ├── assets/tv.html             the whole TV interface
│   └── res/
│       ├── drawable/banner.png    TV home banner (320x180)
│       ├── mipmap-*/ic_launcher.png
│       └── values/strings.xml
├── icon.png
└── debug.keystore                 (created on first build)
```

## Rebuilding the TV page

`app/assets/tv.html` is assembled from
`tv-app/part1.html` + `public/praytime.js` + `tv-app/part3.html`:

```bash
cd /home/z/my-project
{ cat tv-app/part1.html; echo '<script>'; cat public/praytime.js; \
  echo '</script>'; cat tv-app/part3.html; } > tv-app/tv.html
cp tv-app/tv.html android-tv/app/assets/tv.html
bash scripts/build-apk.sh
```
