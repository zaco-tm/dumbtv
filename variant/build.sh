#!/usr/bin/env bash
# Builds variant/build/variant.apk from the vendored free-my-tv app: no Gradle, no libraries.
# Needs an Android SDK with platforms;android-34 and build-tools 34+. The JDK it builds
# with is found by the script itself: a JDK 17, which builds cleanly.
#   ./build.sh            with variant/config.properties (your TMDB key, your city)
#   ./build.sh --generic  without one, as a CI build: no key, the TV's time zone gives the city
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# The version lives in version.env, and the manifest has to agree with it: a build
# whose manifest says one version and whose version file says another is refused on
# the television, and the refusal does not say which of the two was wrong.
# shellcheck disable=SC1091
source version.env
manifest_version=$(sed -nE 's/.*android:versionName="([^"]+)".*/\1/p' AndroidManifest.xml | head -1)
manifest_code=$(sed -nE 's/.*android:versionCode="([0-9]+)".*/\1/p' AndroidManifest.xml | head -1)
if [[ $manifest_version != "$VERSION_NAME" || $manifest_code != "$VERSION_CODE" ]]; then
  echo "error: the manifest says version $manifest_version ($manifest_code), version.env says $VERSION_NAME ($VERSION_CODE)." >&2
  echo "  change variant/version.env and variant/AndroidManifest.xml together." >&2
  exit 1
fi
echo "version $VERSION_NAME"

GENERIC=false
for arg in "$@"; do
  case "$arg" in
    --generic) GENERIC=true ;;
    # An unknown argument is refused, not ignored: "--generic" typed as "--generik"
    # would silently build the keyed APK instead of the generic one.
    *) echo "unknown argument: $arg" >&2; echo "usage: ./build.sh [--generic]" >&2; exit 2 ;;
  esac
done

SDK=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
if [ -z "$SDK" ]; then
  for d in "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools \
           "$HOME/Android/Sdk" /usr/local/share/android-commandlinetools /usr/lib/android-sdk; do
    if [ -d "$d/build-tools" ]; then SDK="$d"; break; fi
  done
fi
[ -n "$SDK" ] && [ -d "$SDK/build-tools" ] || { echo "Android SDK not found. Set ANDROID_HOME."; exit 1; }
# The build-tools version is pinned, so the build does not drift when the SDK is
# updated: today's ubuntu-latest image ships build-tools 34.0.0 and 35, 36 and 37,
# and "the newest one" would make CI build with a different toolchain than this
# machine does. BUILD_TOOLS says which version; the pinned one is used when the SDK
# has it, and the newest one otherwise, so a machine with only another version still
# builds.
BUILD_TOOLS=${BUILD_TOOLS:-34.0.0}
BT=""
if [ -n "$BUILD_TOOLS" ] && [ -d "$SDK/build-tools/$BUILD_TOOLS" ]; then
  BT="$SDK/build-tools/$BUILD_TOOLS"
else
  # The newest build-tools directory, and only a directory: a stray file must not be picked.
  BT=$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -V | tail -1 || true)
fi
AJ="$SDK/platforms/android-34/android.jar"
[ -f "$AJ" ] || { echo "$AJ missing - sdkmanager \"platforms;android-34\""; exit 1; }
# $BT is empty when build-tools/ has no directory in it: say which SDK it looked in
# rather than print an empty path.
[ -x "$BT/aapt2" ] || { echo "no aapt2 in ${BT:-$SDK} - sdkmanager \"build-tools;34.0.0\""; exit 1; }
echo "build-tools: $(basename "$BT")"

# --- JDK: one that works, and not one that breaks d8.
# A javac that exists is not a javac that works: macOS ships /usr/bin/javac, a stub that
# fails with "Unable to locate a Java Runtime that supports javac". So the javac is asked
# to run, not merely to exist. A stub that hangs (it does, when JAVA_HOME points at
# something odd) is no better than one that fails: the probe waits five seconds, then
# gives up on it.
# The scheme: the JDK 17 paths, then macOS's java_home, then a warning when the JDK
# in use is 21 or newer.
JDK17_PATHS=(/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home /usr/lib/jvm/java-17-openjdk)
javac_major() { "$1/bin/javac" -version 2>&1 | sed -n 's/^javac \([0-9]*\).*/\1/p'; }
javac_works() {
  [[ -x $1/bin/javac ]] || return 1
  "$1/bin/javac" -version >/dev/null 2>&1 &
  local pid=$! waited=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$waited" -ge 50 ]; then
      kill -9 "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 1
    fi
    sleep 0.1
    waited=$((waited + 1))
  done
  wait "$pid"
}

if [[ -z ${JAVA_HOME:-} ]] || ! javac_works "$JAVA_HOME"; then
  for j in "${JDK17_PATHS[@]}" /opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home \
           "$(/usr/libexec/java_home 2>/dev/null || true)"; do
    if [[ -n $j ]] && javac_works "$j"; then JAVA_HOME=$j; break; fi
  done
fi
# build-tools 34's bundled d8 threw an internal NullPointerException dexing an anonymous inner
# class compiled by JDK 27, even with --release 8. JDK 17 builds it cleanly. Only 27 was seen
# failing; 21 is a conservative cut-off, since macOS's java_home and a Linux distro's default
# javac both commonly land on something newer than 17 now.
if [[ -z ${JAVA_HOME:-} ]] || ! javac_works "$JAVA_HOME" || [[ $(javac_major "$JAVA_HOME") -ge 21 ]]; then
  for j in "${JDK17_PATHS[@]}"; do
    if javac_works "$j"; then JAVA_HOME=$j; break; fi
  done
fi
[[ -n ${JAVA_HOME:-} ]] && javac_works "$JAVA_HOME" || {
  echo "no working JDK found - brew install openjdk@17 (macOS) or pacman -S jdk17-openjdk (Arch)" >&2
  exit 1
}
if [[ $(javac_major "$JAVA_HOME") -ge 21 ]]; then
  echo "warning: $JAVA_HOME is JDK $(javac_major "$JAVA_HOME"); build-tools' d8 crashed on JDK 27 output - install a JDK 17 if this fails" >&2
fi
export JAVA_HOME
JAVAC="$JAVA_HOME/bin/javac"
KEYTOOL="$JAVA_HOME/bin/keytool"
echo "using JDK $(javac_major "$JAVA_HOME") at $JAVA_HOME"

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
# The log says whether a key was baked into the APK: a keyed build and a generic one
# are otherwise indistinguishable, and only one of them carries the owner's key.
# The key itself is never printed.
if grep -q 'static final String TMDB_KEY = "";' "$WORK/gen/io/freemytv/Config.java"; then
  echo "TMDB key: none"
else
  echo "TMDB key: baked"
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
