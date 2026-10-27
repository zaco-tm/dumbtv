#!/usr/bin/env bash
# Fails unless the built variant APK is what this repo expects.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

SDK=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
if [ -z "$SDK" ]; then
  for d in "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools \
           "$HOME/Android/Sdk" /usr/local/share/android-commandlinetools /usr/lib/android-sdk; do
    [ -d "$d/build-tools" ] && { SDK="$d"; break; }
  done
fi
[ -n "$SDK" ] && [ -d "$SDK/build-tools" ] || { echo "Android SDK not found. Set ANDROID_HOME."; exit 1; }
# The build-tools version is pinned, so the check runs with the toolchain the build
# used: the same rule as build.sh (BUILD_TOOLS, the pinned one when the SDK has it,
# the newest one otherwise).
BUILD_TOOLS=${BUILD_TOOLS:-34.0.0}
BT=""
if [ -n "$BUILD_TOOLS" ] && [ -d "$SDK/build-tools/$BUILD_TOOLS" ]; then
  BT="$SDK/build-tools/$BUILD_TOOLS"
else
  # The newest build-tools directory, and only a directory: a stray file must not be picked.
  BT=$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -V | tail -1 || true)
fi
# $BT is empty when build-tools/ has no directory in it: say which SDK it looked in
# rather than print an empty path.
[ -x "$BT/aapt2" ] || { echo "no aapt2 in ${BT:-$SDK} - sdkmanager \"build-tools;34.0.0\""; exit 1; }
APK=build/variant.apk
[ -f "$APK" ] || { echo "no $APK - run ./build.sh --generic"; exit 1; }

badging=$("$BT/aapt2" dump badging "$APK")
pkg=$(printf '%s\n' "$badging" | sed -nE "s/^package: name='([^']+)'.*/\1/p")
[ "$pkg" = "tv.dumbtv.variant" ] || { echo "expected the application id tv.dumbtv.variant, found $pkg"; exit 1; }
# aapt2 calls it sdkVersion; minSdkVersion is the name in the manifest.
min=$(printf '%s\n' "$badging" | sed -nE "s/^(minSdkVersion|sdkVersion):'([0-9]+)'.*/\2/p")
[ "$min" = 26 ] || { echo "expected minSdkVersion 26, found $min"; exit 1; }
target=$(printf '%s\n' "$badging" | sed -nE "s/^targetSdkVersion:'([0-9]+)'.*/\1/p")
[ "$target" = 33 ] || { echo "expected targetSdkVersion 33, found $target"; exit 1; }
# The label is ours, not upstream's: the TV shows our name.
label=$(printf '%s\n' "$badging" | sed -nE "s/^application-label:'(.*)'$/\1/p" | head -1)
[ "$label" = "dumbtv home (variant)" ] || { echo "expected the label 'dumbtv home (variant)', found '$label'"; exit 1; }
# The provider authority is ours too, and it is inside the APK: a manifest that says
# io.freemytv.photos would make the photos tool write to an authority nobody owns.
xmltree=$("$BT/aapt2" dump xmltree "$APK" --file AndroidManifest.xml)
grep -q 'authorities.*="tv.dumbtv.variant.photos"' <<< "$xmltree" \
  || { echo "the provider authority in the APK is not tv.dumbtv.variant.photos"; exit 1; }

# The permissions are upstream's, unchanged, in upstream's order. The whole line is
# compared, not just the name: SCHEDULE_EXACT_ALARM carries android:maxSdkVersion="32",
# and a manifest without it would ask for the exact alarm on every Android version.
dump=$("$BT/aapt2" dump permissions "$APK")
printf '%s\n' "$dump"
want=$(cat permissions.txt)
got=$(printf '%s\n' "$dump" | grep uses-permission || true)
[ "$want" = "$got" ] || {
  echo "the permissions are not upstream's eight, in upstream's order, with upstream's attributes"
  diff <(printf '%s\n' "$want") <(printf '%s\n' "$got") || true
  exit 1
}

# The app's own code is in it, under upstream's package.
# The dex must be there: without it, unzip's own stderr would be the only word about it.
names=$(unzip -Z1 "$APK")
printf '%s\n' "$names" | grep -x "classes.dex" >/dev/null \
  || { echo "no classes.dex in $APK"; exit 1; }
# The dex is read once: grep -q closes the pipe early, and with pipefail on that comes out
# as a SIGPIPE (141), which would look like a missing class.
dex=$(unzip -p "$APK" classes.dex | strings)
grep -qx "Lio/freemytv/HomeView;" <<< "$dex" \
  || { echo "io.freemytv.HomeView is not in the dex"; exit 1; }
grep -qx "Lio/freemytv/R;" <<< "$dex" \
  || { echo "io.freemytv.R is not in the dex"; exit 1; }
grep -qx "Lio/freemytv/HomeActivity;" <<< "$dex" \
  || { echo "io.freemytv.HomeActivity is not in the dex"; exit 1; }

"$BT/apksigner" verify "$APK" >/dev/null || { echo "the APK is not signed"; exit 1; }
echo "variant APK ok: $pkg, label '$label', minSdk $min, targetSdk $target, 8 permissions, signed"
