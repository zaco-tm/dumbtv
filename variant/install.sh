#!/usr/bin/env bash
# Installs AverageTV (the free-my-tv fork in variant/) on the TV and gives it the
# HOME key.
#
# Fire OS protects Amazon's launcher and lets no third-party app be the home app, so
# HOME is taken by a Guard: an accessibility service that covers Amazon's home window
# with ours. This script installs the fork, swaps the old launcher's guard out for
# the fork's own, and sets the alarm setting the Guard's launch needs. The fork is
# never made a home-app candidate: the Guard is the whole mechanism.
#
#   ./variant/install.sh            install the APK in variant/build
#   ./variant/install.sh --build    build it from source first (needs a JDK and the Android SDK)
#   ./variant/install.sh --undo     hand HOME back to the old launcher (tv.dumbtv.home)
#   ./variant/install.sh --undo-amazon
#                                   hand HOME back to Amazon's launcher and undo every
#                                   change this fork made (what scripts/restore.sh needs)
#
# Pick the device with ADB_SERIAL when more than one is connected.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# The version of what is being installed, so the television and the terminal agree
# on what is on them.
# shellcheck disable=SC1091
source version.env

PKG=tv.dumbtv.variant
# The fork's class is not in the app's own package, so the component is written out.
GUARD=tv.dumbtv.variant/io.freemytv.Guard
GUARD_CLASS=io.freemytv.Guard
# What "dumpsys accessibility" names the bound service by: it prints the label, never
# the component. Keep it in sync with variant/res/values/guard.xml.
GUARD_LABEL='AverageTV guard'
HOME_ACTIVITY=tv.dumbtv.variant/io.freemytv.HomeActivity
# The old launcher. Its guard must not be bound at the same time as ours: two Guards
# would fight over the HOME key. Putting its guard back into
# enabled_accessibility_services is the rollback, and it is one setting.
OLD_PKG=tv.dumbtv.home
OLD_GUARD=tv.dumbtv.home/tv.dumbtv.home.Guard
OLD_GUARD_CLASS=tv.dumbtv.home.Guard
ADB=${ADB:-adb}

adb_() { "$ADB" ${ADB_SERIAL:+-s "$ADB_SERIAL"} "$@"; }
sh_() { adb_ shell "$@" </dev/null; }
installed() { sh_ pm path "$1" 2>/dev/null | grep -q '^package:'; }
# shellcheck disable=SC1091
source ../scripts/home.sh
# shellcheck disable=SC1091
source ../scripts/accessibility.sh

mode=apk
case ${1:-} in
  "") ;;
  --build) mode=build ;;
  --undo) mode=undo ;;
  --undo-amazon) mode=undo-amazon ;;
  *) echo "usage: $0 [--build | --undo | --undo-amazon]" >&2; exit 2 ;;
esac

command -v "$ADB" >/dev/null || { echo "error: adb not found — install Android platform-tools" >&2; exit 1; }
state=$(adb_ get-state 2>/dev/null || true)
[[ $state == device ]] || { echo "error: no TV connected (adb connect <tv-ip>:5555; set ADB_SERIAL if several)" >&2; exit 1; }

dev_sdk=$(sh_ getprop ro.build.version.sdk | tr -d '\r')
case $dev_sdk in ''|*[!0-9]*) dev_sdk=28 ;; esac

# Fire OS 6's `settings` command silently drops writes to enabled_accessibility_services
# (exit code 0, value unchanged); the settings content provider still takes them.
put_secure() {
  local got
  sh_ settings put secure "$1" "${2:-\"\"}"
  got=$(sh_ settings get secure "$1" | tr -d '\r')
  [[ $got == "$2" || ( -z $2 && $got == null ) ]] && return 0
  sh_ content insert --uri content://settings/secure --bind "name:s:$1" --bind "value:s:$2"
}

# Puts $1 (or nothing) in place of the old launcher's guard, keeping every other
# service. orig is deliberately not local: the trap below puts it back.
set_guard() {
  local cur
  orig=$(sh_ settings get secure enabled_accessibility_services | tr -d '\r')
  [[ $orig == null ]] && orig=
  cur=$(printf '%s' "$orig" | tr ':' '\n' |
    { grep -vxF -e "$GUARD" -e "$PKG/.io.freemytv.Guard" -e "$OLD_GUARD" -e "$OLD_PKG/.Guard" -e '' || true; } |
    paste -sd: -)
  if [[ -n ${1:-} ]]; then cur=${cur:+$cur:}$1; fi
  # Clearing first makes the accessibility manager rebind a service whose process died. The
  # other services live only in $orig meanwhile: if this is cut short, the trap puts them back.
  trap 'put_secure enabled_accessibility_services "$orig" || true' EXIT
  trap 'exit 130' INT TERM
  put_secure enabled_accessibility_services ""
  sleep 1
  if [[ -n $cur ]]; then
    put_secure enabled_accessibility_services "$cur"
    put_secure accessibility_enabled 1
  else
    put_secure accessibility_enabled 0
  fi
  trap - EXIT INT TERM
}

if [[ $mode == undo ]]; then
  if [[ $dev_sdk -lt 28 ]]; then
    # Fire OS 6 refuses third-party accessibility services, so the old launcher holds
    # HOME there with a keeper instead: a foreground service of its own that watches
    # Amazon's home through UsageStats. A guard would be bound to nothing, so the
    # keeper is what has to be armed.
    sh_ appops set $OLD_PKG GET_USAGE_STATS allow >/dev/null 2>&1 || true
    start_home $OLD_PKG/.Home
    sleep 3
    if ! sh_ dumpsys activity services $OLD_PKG 2>/dev/null | grep -q 'isForeground=true'; then
      echo "error: the Fire OS 6 home keeper did not start ($OLD_PKG/.Keeper)" >&2
      echo "  the fallback is installed but it is not holding HOME; check the TV's own screen." >&2
      exit 1
    fi
    echo "home: the old launcher (keeper, no accessibility; sdk $dev_sdk)"
    echo "put the variant back in front with: ./variant/install.sh"
    exit 0
  fi
  # The rollback is one setting: the old launcher's guard goes back into
  # enabled_accessibility_services, and the launcher that works today is the home
  # screen again. The fork stays installed; it is simply not in charge.
  set_guard "$OLD_GUARD"
  sleep 2
  user=$(sh_ am get-current-user | tr -d '\r')
  bound=0
  for _ in $(seq 1 15); do
    if sh_ dumpsys accessibility | guard_bound "${user:-0}" 'dumbtv home button' "$OLD_GUARD_CLASS"; then
      bound=1; break
    fi
    sleep 1
  done
  if [[ $bound == 0 ]]; then
    echo "error: Fire OS did not bind the old launcher's guard ($OLD_GUARD)." >&2
    # The fork's guard was working a moment ago: put it back rather than leave the
    # TV without a home screen of ours.
    set_guard "$GUARD" || true
    echo "  the variant's guard is back in front; the TV still works." >&2
    exit 1
  fi
  start_home $OLD_PKG/.Home
  echo "HOME handed back to $OLD_PKG: enabled_accessibility_services is $OLD_GUARD again"
  echo "put the variant back in front with: ./variant/install.sh"
  exit 0
fi

if [[ $mode == undo-amazon ]]; then
  # The full undo, the one scripts/restore.sh needs: HOME goes back to Amazon's
  # launcher, and every change this fork made goes with it - the guard comes out
  # of the enabled services, the alarm setting goes back to what it was, and the
  # app ops and the doze exemption it added go too. The fork stays installed: it
  # is in charge of nothing, and uninstalling it is one command away.
  sh_ appops set $PKG SYSTEM_ALERT_WINDOW default >/dev/null 2>&1 || true
  sh_ appops set $PKG REQUEST_INSTALL_PACKAGES default >/dev/null 2>&1 || true
  set_futurity off
  # Neither guard stays enabled: ours goes, and the fallback's goes with it,
  # because a fallback that is still holding HOME is not a fallback, it is a
  # second product.
  set_guard ""
  sh_ dumpsys deviceidle whitelist -$PKG >/dev/null 2>&1 || true
  # Fire OS 6 holds HOME with a UsageStats keeper inside the fallback's package,
  # not with an accessibility service, so the service setting says nothing there.
  # Force-stopping the package is what stops the keeper from starting again at the
  # next boot.
  sh_ am force-stop $OLD_PKG >/dev/null 2>&1 || true
  sh_ appops set $OLD_PKG GET_USAGE_STATS default >/dev/null 2>&1 || true
  sh_ am start -a android.intent.action.MAIN -c android.intent.category.HOME >/dev/null 2>&1 || true
  echo "HOME handed back to Amazon's launcher (the variant stays installed: adb uninstall $PKG)"
  exit 0
fi

# The fork needs Android 8 (sdk 26) or newer. Fire OS 6's Keeper, which is how the
# old launcher takes HOME there, is not ours: on such a TV the old launcher stays the
# home screen. The undo paths above are not blocked by this - they have to work on
# every television, including the ones the fork does not run on at all.
if [[ $dev_sdk -lt 26 ]]; then
  echo "error: the variant needs Android 8 (sdk 26) or newer; this TV is sdk $dev_sdk." >&2
  echo "  on Fire OS 6 the home screen is $OLD_PKG, which is installed already." >&2
  exit 1
fi

if [[ $mode == build ]]; then
  ./build.sh
fi
APK=build/variant.apk
[[ -f $APK ]] || { echo "error: no $APK — run ./variant/install.sh --build" >&2; exit 1; }

# adb's result is its last word: "Success" or "Failure [REASON]". Take the line
# that says so rather than the first line that mentions it — an incremental install
# that fails and falls back to a streamed one prints an error of its own first, and
# that error is not the result.
out=$(adb_ install -r "$APK" 2>&1 | grep -E '^[[:space:]]*(Success|Failure)' | tail -1 || true)
case $out in
  *Success*) echo "installed $PKG $VERSION_NAME" ;;
  *INSTALL_FAILED_UPDATE_INCOMPATIBLE*)
    echo "error: the installed variant was signed with a different key (a release vs your own build)." >&2
    echo "  replacing it means uninstalling it (adb uninstall $PKG), which deletes its settings." >&2
    exit 1 ;;
  '') echo "error: adb install printed no result; the APK was not installed." >&2; exit 1 ;;
  *) echo "error: adb install failed: $(printf '%s' "$out" | sed 's/^[[:space:]]*//')" >&2; exit 1 ;;
esac

# The fork's two app ops: the sleep timer's overlay, and upstream's self-updater.
# They are allowed already on a TV where the fork was installed by hand, but a fresh
# install elsewhere needs them, and setting them again changes nothing.
sh_ appops set $PKG SYSTEM_ALERT_WINDOW allow >/dev/null 2>&1 || true
sh_ appops set $PKG REQUEST_INSTALL_PACKAGES allow >/dev/null 2>&1 || true

sh_ dumpsys deviceidle whitelist +$PKG >/dev/null

# The Guard's launch goes through an alarm, and an alarm does not fire sooner than
# five seconds from now unless min_futurity says otherwise.
set_futurity on

# The swap: our Guard in, the old launcher's Guard out, every other service kept.
set_guard "$GUARD"
sleep 2

# The setting alone proves nothing: Fire OS decides whether the service is bound. The
# dump names the service by its label, not by its package, so match the label inside
# the current user's bound-services section (same parser verify.sh uses).
user=$(sh_ am get-current-user | tr -d '\r')
bound=0
for _ in $(seq 1 15); do
  if sh_ dumpsys accessibility | guard_bound "${user:-0}" "$GUARD_LABEL" "$GUARD_CLASS"; then
    bound=1; break
  fi
  sleep 1
done
if [[ $bound == 0 ]]; then
  echo "error: Fire OS did not bind the variant's guard ($GUARD)." >&2
  # The TV must not be left without a home screen of ours: the old launcher's guard
  # goes back in, and the TV works again.
  set_guard "$OLD_GUARD" || true
  echo "  the old launcher's guard is back in front; the TV still works." >&2
  exit 1
fi

start_home $HOME_ACTIVITY
if installed com.spocky.projengmenu; then
  echo "note: Projectivy is installed; its accessibility service wants the HOME key too —"
  echo "  disable it in the TV's accessibility settings if the two fight."
fi

sleep 2
printf 'accessibility: %s\n' "$(sh_ settings get secure enabled_accessibility_services)"
printf 'front window:  %s\n' "$(sh_ dumpsys window | grep -m1 mCurrentFocus | sed 's/.* u0 //; s/}$//')"
echo "home: AverageTV $VERSION_NAME"
