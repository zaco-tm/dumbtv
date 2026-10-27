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
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
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

# The permissions are upstream's, unchanged, in upstream's order.
dump=$("$BT/aapt2" dump permissions "$APK")
printf '%s\n' "$dump"
want=$(sed "s/^/uses-permission: name='/" permissions.txt | sed "s/$/'/")
got=$(printf '%s\n' "$dump" | grep uses-permission | sed -E "s/.*name='([^']+)'.*/\1/" | sed "s/^/uses-permission: name='/" | sed "s/$/'/" || true)
[ "$want" = "$got" ] || {
  echo "the permissions are not upstream's eight, in upstream's order"
  diff <(printf '%s\n' "$want") <(printf '%s\n' "$got") || true
  exit 1
}

# The app's own code is in it, under upstream's package.
# The dex is read once: grep -q closes the pipe early, and with pipefail on that comes out
# as a SIGPIPE (141), which would look like a missing class.
dex=$(unzip -p "$APK" classes.dex | strings)
grep -qx "Lio/freemytv/HomeView;" <<< "$dex" \
  || { echo "io.freemytv.HomeView is not in the dex"; exit 1; }
grep -qx "Lio/freemytv/R;" <<< "$dex" \
  || { echo "io.freemytv.R is not in the dex"; exit 1; }

"$BT/apksigner" verify "$APK" >/dev/null || { echo "the APK is not signed"; exit 1; }
echo "variant APK ok: $pkg, minSdk $min, targetSdk $target, 8 permissions, signed"
