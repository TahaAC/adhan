# Shia Azan — Android TV

A leanback Android TV app: a fullscreen WebView around a
self-contained TV page (`app/assets/tv.html`) with D-pad
navigation, live countdown, Qibla direction and automatic adhan
playback. No server required — everything is bundled in the APK.

## Install the prebuilt APK (easiest)

1. **Download** `ShiaAzan-AndroidTV.apk` (from this repo's
   `download/` folder or the releases page) onto a USB stick or
   download it directly on the TV.

2. **Enable unknown sources** on the TV:
   Settings ▸ Device Preferences ▸ Security & Restrictions ▸
   *Unknown sources* (Android TV 10+) — or
   Settings ▸ Personal ▸ Security & Restrictions (older).

3. **Install** with a file manager
   ([File Commander](https://play.google.com/store/apps/details?id=com.mobisystems.file)
   and most TVs' built-in "Files" app work):
   - From USB: open the file manager, browse to the APK, open it.
   - Over network: use *Send files to TV*
     ([Play Store](https://play.google.com/store/apps/details?id=com.yazeed.stopwatchforandroidtv),
     free) from your phone, then open it in the TV's file manager.

4. **Allow the install** when prompted. The app appears on the
   Android TV home screen with its banner.

> Direct `adb install` also works:
> `adb connect <TV-IP>:5555 && adb install ShiaAzan-AndroidTV.apk`

### Also works on Android phones/tablets

The same APK installs as a regular launcher app (landscape).

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
