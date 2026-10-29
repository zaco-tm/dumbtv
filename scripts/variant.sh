#!/usr/bin/env bash
# Installs AverageTV (the free-my-tv fork in variant/) and gives it the HOME
# button. Fire OS ignores "default home" and protects Amazon's launcher, so the
# takeover runs through a small accessibility service, the Guard. variant/README.md
# has the details. Usage: ./scripts/variant.sh [--dry-run] [-y]
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_flags "$@"
need_device
load_conf

if [[ $LAUNCHER == 0 ]]; then
  note "LAUNCHER=0 in dumbtv.conf — keeping Amazon's home screen. Re-run ./scripts/configure.sh to change that."
  exit 0
fi

PKG=tv.dumbtv.variant

step "plan"
note "install AverageTV: open source, no ad ID, the internet only for the film picks"
note "the APK is built from the sources in this repo, not downloaded"
note "Amazon's launcher stays installed, so the TV can always go back to it"
if [[ $DRY_RUN == 1 ]]; then
  note "[dry-run] ADB=$ADB ADB_SERIAL=$SERIAL variant/install.sh"
  exit 0
fi
confirm "Replace the home screen on $SERIAL?" || die "cancelled"

ADB=$ADB ADB_SERIAL=$SERIAL "$ROOT/variant/install.sh" || die "variant install failed (see above)"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  home=$(front_activity)
  [[ $home == "$PKG"/* ]] && break
done
if [[ $home == "$PKG"/* ]]; then
  note "home screen is AverageTV"
elif [[ -z $home ]]; then
  note "could not read which app is in front; ./scripts/verify.sh checks the takeover"
else
  note "home screen is $home"
  note "press HOME once or run this script again; see docs/TROUBLESHOOTING.md if it will not stick"
  exit 1
fi
