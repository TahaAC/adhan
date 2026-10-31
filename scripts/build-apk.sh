#!/bin/bash
# build-apk.sh — build ShiaAzan-AndroidTV.apk without Gradle.
# Uses aapt2 + javac + d8 + zipalign + apksigner directly.
set -euo pipefail

ROOT=/home/z/my-project
APP=$ROOT/android-tv/app
OUT=$ROOT/android-tv/build
TOOLS=/home/z/tools
BT=$TOOLS/bt33/android-13
PLATFORM=$TOOLS/pf/android-34/android.jar
JDK=$TOOLS/jdk-21.0.13+9
KEYSTORE=$ROOT/android-tv/debug.keystore

rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

echo "== 1. aapt2 compile resources =="
"$BT/aapt2" compile --dir "$APP/res" -o "$OUT/res.zip"

echo "== 2. aapt2 link =="
"$BT/aapt2" link \
  -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$APP/AndroidManifest.xml" \
  -A "$APP/assets" \
  --min-sdk-version 21 \
  --target-sdk-version 34 \
  --version-code 1 \
  --version-name 1.0.0 \
  --java "$OUT/gen" \
  "$OUT/res.zip"

echo "== 3. javac =="
"$JDK/bin/javac" \
  --release 8 \
  -classpath "$PLATFORM" \
  -d "$OUT/classes" \
  $(find "$OUT/gen" "$APP/java" -name '*.java')

echo "== 4. d8 (dex) =="
"$BT/d8" \
  --release \
  --lib "$PLATFORM" \
  --min-api 21 \
  --output "$OUT/dex" \
  $(find "$OUT/classes" -name '*.class')

echo "== 5. package classes.dex into apk =="
cp "$OUT/base.apk" "$OUT/unsigned.apk"
cd "$OUT/dex" && zip -q -j "$OUT/unsigned.apk" classes.dex && cd "$ROOT"

echo "== 6. zipalign =="
"$BT/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "== 7. debug keystore (if missing) =="
if [ ! -f "$KEYSTORE" ]; then
  "$JDK/bin/keytool" -genkeypair \
    -keystore "$KEYSTORE" \
    -storepass shiaazan -keypass shiaazan \
    -alias shiaazan \
    -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=Shia Azan TV, OU=Dev, O=ShiaAzan, C=IQ"
fi

echo "== 8. sign =="
"$BT/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:shiaazan \
  --ks-key-alias shiaazan \
  --out "$ROOT/download/ShiaAzan-AndroidTV.apk" \
  "$OUT/aligned.apk"

echo "== 9. verify =="
"$BT/apksigner" verify --print-certs "$ROOT/download/ShiaAzan-AndroidTV.apk" | head -4
echo ""
echo "DONE: $ROOT/download/ShiaAzan-AndroidTV.apk"
ls -la "$ROOT/download/ShiaAzan-AndroidTV.apk"
