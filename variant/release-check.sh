#!/usr/bin/env bash
# Checks that the fork's version files, its manifest and its built APK all agree,
# and that the fallback launcher's upstream release is still the one we recorded.
# Run this before publishing or recording instructions, and in CI.
#
#   ./variant/release-check.sh            local build (if present) + the fallback release
#   ./variant/release-check.sh --local     only the built APK
#   ./variant/release-check.sh --remote    only the upstream fallback release
#   ./variant/release-check.sh --manifest  only the version files (used by CI)
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# The fallback launcher is not built here any more, so its release is upstream's.
FALLBACK_REPO=https://github.com/humblemuzzu/dumbtv

mode=${1:-all}
case $mode in
  all|--local|--remote|--manifest) ;;
  *) echo "usage: $0 [--local|--remote|--manifest]" >&2; exit 2 ;;
esac
[[ $mode == all ]] && mode=both

fail=0
ok()   { printf '  ok    %s\n' "$*"; }
bad()  { printf '  FAIL  %s\n' "$*"; fail=1; }

sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | awk '{print $1}'
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

# The same SDK lookup as build.sh, so the check reads the APK with the toolchain
# that built it.
sdk_dir() {
  local sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
  if [ -z "$sdk" ]; then
    for d in "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools \
             "$HOME/Android/Sdk" /usr/local/share/android-commandlinetools /usr/lib/android-sdk; do
      if [ -d "$d/build-tools" ]; then sdk="$d"; break; fi
    done
  fi
  printf '%s' "$sdk"
}
aapt2() {
  local sdk bt
  sdk=$(sdk_dir)
  [ -n "$sdk" ] && [ -d "$sdk/build-tools" ] || return 1
  bt=${BUILD_TOOLS:-34.0.0}
  if [ ! -d "$sdk/build-tools/$bt" ]; then
    bt=$(find "$sdk/build-tools" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -V | tail -1 || true)
  fi
  [ -x "$sdk/build-tools/$bt/aapt2" ] || return 1
  printf '%s' "$sdk/build-tools/$bt/aapt2"
}

# --- version.env ------------------------------------------------------------
[[ -f version.env ]] || { echo "error: variant/version.env missing" >&2; exit 1; }
# shellcheck disable=SC1091
source version.env
echo "version $VERSION"

[[ $VERSION =~ ^[0-9]+\.[0-9]+$ ]] || bad "VERSION '$VERSION' is not <major>.<minor>"
[[ $VERSION_NAME =~ ^[0-9]+\.[0-9]+$ ]] || bad "VERSION_NAME '$VERSION_NAME' is not <major>.<minor>"
[[ $VERSION_CODE =~ ^[0-9]+$ ]] || bad "VERSION_CODE '$VERSION_CODE' is not a number"
[[ $FALLBACK_VERSION =~ ^[0-9]+\.[0-9]+$ ]] || bad "FALLBACK_VERSION '$FALLBACK_VERSION' is not <major>.<minor>"
[[ $FALLBACK_APK_SHA256 =~ ^[0-9a-f]{64}$ ]] || bad "FALLBACK_APK_SHA256 is not a 64-char lowercase hex digest"

# The manifest has to say the same thing as version.env: an update is refused on
# the TV when the two disagree, and the refusal says nothing about which of them
# was wrong.
manifest_code=$(sed -nE 's/.*android:versionCode="([0-9]+)".*/\1/p' AndroidManifest.xml | head -1)
manifest_name=$(sed -nE 's/.*android:versionName="([^"]+)".*/\1/p' AndroidManifest.xml | head -1)
[[ $manifest_code == "$VERSION_CODE" ]] \
  && ok "the manifest's versionCode is $VERSION_CODE" \
  || bad "the manifest's versionCode is '$manifest_code', version.env says $VERSION_CODE"
[[ $manifest_name == "$VERSION_NAME" ]] \
  && ok "the manifest's versionName is $VERSION_NAME" \
  || bad "the manifest's versionName is '$manifest_name', version.env says $VERSION_NAME"

grep -q 'version.env' install.sh || bad "install.sh does not source version.env"
grep -q 'version.env' build.sh   || bad "build.sh does not source version.env"

[[ $mode == --manifest ]] && { [[ $fail == 0 ]] && echo "manifest consistent"; exit $fail; }

# --- local build ------------------------------------------------------------
# The fork is built here and signed with the owner's own key, so its APK has no
# published hash to compare against: the version in the APK is what can be
# checked, and it is checked.
if [[ $mode == both || $mode == --local ]]; then
  APK=build/variant.apk
  if [[ -f $APK ]]; then
    if aapt=$(aapt2); then
      badging=$("$aapt" dump badging "$APK")
      # aapt2 puts the version on the package line: package: name='x' versionCode='1' versionName='1.0'
      code=$(printf '%s\n' "$badging" | sed -nE "s/^package: name='[^']+' versionCode='([0-9]+)'.*/\1/p" | head -1)
      name=$(printf '%s\n' "$badging" | sed -nE "s/^package: name='[^']+' versionCode='[0-9]+' versionName='([^']+)'.*/\1/p" | head -1)
      [[ $code == "$VERSION_CODE" ]] \
        && ok "$APK is versionCode $code" \
        || bad "$APK is versionCode '$code', version.env says $VERSION_CODE"
      [[ $name == "$VERSION_NAME" ]] \
        && ok "$APK is versionName $name" \
        || bad "$APK is versionName '$name', version.env says $VERSION_NAME"
    else
      bad "no aapt2 to read $APK with; set ANDROID_HOME"
    fi
  else
    [[ $mode == --local ]] && bad "$APK not built (run ./variant/build.sh)" || echo "  note  $APK not built, skipping local check"
  fi
fi

# --- the fallback's upstream release ----------------------------------------
# The old launcher is still the way back to a working TV, and its file comes from
# upstream's release. That release has to be the one that was checked here.
if [[ $mode == both || $mode == --remote ]]; then
  URL=$FALLBACK_REPO/releases/download/launcher-v$FALLBACK_VERSION/dumbtv-home.apk
  code=$(curl -sIL -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null || echo 000)
  if [[ $code == 200 ]]; then
    tmp=$(mktemp -t dumbtv-release.XXXXXX)
    if curl -fsSL -o "$tmp" "$URL"; then
      got=$(sha256 "$tmp")
      [[ $got == "$FALLBACK_APK_SHA256" ]] && ok "the fallback release launcher-v$FALLBACK_VERSION matches" \
        || bad "the fallback release APK is $got, version.env says $FALLBACK_APK_SHA256 — re-upload the build"
    else
      bad "could not download $URL"
    fi
    rm -f "$tmp"
  else
    bad "the fallback release launcher-v$FALLBACK_VERSION not reachable ($code): $URL"
  fi
fi

if [[ $fail == 0 ]]; then
  echo "release consistent"
else
  echo
  echo "fix: edit variant/version.env and variant/AndroidManifest.xml together, ./variant/build.sh,"
  echo "     and re-upload the fallback APK to tag launcher-v\$FALLBACK_VERSION if that moved."
fi
exit $fail
