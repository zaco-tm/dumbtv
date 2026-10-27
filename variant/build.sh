#!/usr/bin/env bash
# Builds variant/build/variant.apk from the vendored free-my-tv app: no Gradle, no libraries.
# Needs a JDK 17+ and an Android SDK with platforms;android-34 and build-tools 34+.
#   ./build.sh            with variant/config.properties (your TMDB key, your city)
#   ./build.sh --generic  without one, as a CI build: no key, the TV's time zone gives the city
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

GENERIC=false
for arg in "$@"; do [ "$arg" = "--generic" ] && GENERIC=true; done

SDK=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
if [ -z "$SDK" ]; then
  for d in "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools \
           "$HOME/Android/Sdk" /usr/local/share/android-commandlinetools /usr/lib/android-sdk; do
    if [ -d "$d/build-tools" ]; then SDK="$d"; break; fi
  done
fi
[ -n "$SDK" ] && [ -d "$SDK/build-tools" ] || { echo "Android SDK not found. Set ANDROID_HOME."; exit 1; }
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
AJ="$SDK/platforms/android-34/android.jar"
[ -f "$AJ" ] || { echo "$AJ missing - sdkmanager \"platforms;android-34\""; exit 1; }
[ -x "$BT/aapt2" ] || { echo "no aapt2 in $BT - sdkmanager \"build-tools;34.0.0\""; exit 1; }

JAVAC="${JAVA_HOME:+$JAVA_HOME/bin/}javac"
KEYTOOL="${JAVA_HOME:+$JAVA_HOME/bin/}keytool"
command -v "$JAVAC" >/dev/null 2>&1 || { echo "JDK not found. Install JDK 17 and set JAVA_HOME."; exit 1; }

# --- Settings: config.properties -> io/freemytv/Config.java
WORK="$PWD/build/tmp"
rm -rf "$WORK"
mkdir -p "$WORK/gen/io/freemytv" "$WORK/classes" build
if [ "$GENERIC" = true ]; then
  python3 tools/gen_config.py --generic "$WORK/gen/io/freemytv/Config.java"
else
  if [ ! -f config.properties ]; then
    cp config.example.properties config.properties
    echo "Created config.properties: add your TMDB key and your city, then build again."
    exit 1
  fi
  python3 tools/gen_config.py config.properties "$WORK/gen/io/freemytv/Config.java"
fi

# --- Build: aapt2 -> javac -> d8 -> zipalign -> apksigner
"$BT/aapt2" compile --dir res -o "$WORK/res.zip"
# --rename-manifest-package gives the APK our application id; the generated R stays in
# io.freemytv, where upstream's code expects it, so no upstream file is edited.
# -0 ttf: Android reads the font straight from the APK, so it is stored uncompressed.
"$BT/aapt2" link -o "$WORK/base.apk" -I "$AJ" --manifest AndroidManifest.xml --java "$WORK/gen" \
  "$WORK/res.zip" --min-sdk-version 26 --target-sdk-version 33 -A assets -0 ttf \
  --rename-manifest-package tv.dumbtv.variant

find src "$WORK/gen" -name '*.java' > "$WORK/sources.txt"
# -nowarn: upstream's code is not warning-clean, and -Werror would refuse it.
"$JAVAC" -nowarn -Xlint:-options --release 8 -encoding UTF-8 -classpath "$AJ" \
  -d "$WORK/classes" @"$WORK/sources.txt"

find "$WORK/classes" -name '*.class' > "$WORK/classes.txt"
"$BT/d8" --release --min-api 26 --lib "$AJ" --output "$WORK" @"$WORK/classes.txt"
(cd "$WORK" && zip -q -X base.apk classes.dex)
"$BT/zipalign" -f -p 4 "$WORK/base.apk" "$WORK/aligned.apk"

# --- Sign with our own key (created once; updates need the same key, so keep it).
KEYSTORE=${DUMBTV_VARIANT_KEYSTORE:-$PWD/release.keystore}
KEYPASS=${DUMBTV_VARIANT_KEYPASS:-dumbtvvariant}
if [ ! -f "$KEYSTORE" ]; then
  "$KEYTOOL" -genkeypair -keystore "$KEYSTORE" -alias variant -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYPASS" -keypass "$KEYPASS" -dname "CN=dumbtv home variant" >/dev/null 2>&1
  echo "created signing key $KEYSTORE (keep it: updates must be signed with the same key)"
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass "pass:$KEYPASS" --key-pass "pass:$KEYPASS" \
  --out build/variant.apk "$WORK/aligned.apk"
"$BT/apksigner" verify build/variant.apk

printf 'built build/variant.apk  %s bytes\n' "$(wc -c < build/variant.apk | tr -d ' ')"
