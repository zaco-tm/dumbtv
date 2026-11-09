#!/usr/bin/env bash
# Installs AverageTV on the TV and gives it the HOME button.
#
# AverageTV is its own project now: https://github.com/zaco-tm/AverageTV
# The launcher, its build and the device work — the Guard that takes the HOME
# key, the app ops, the way back — all live there. This script finds that
# checkout and runs its installer. The details are in AverageTV's README.md.
#
# Fire OS ignores "default home" and protects Amazon's launcher, so the
# takeover runs through a small accessibility service, the Guard.
#
# Usage: ./scripts/variant.sh [--dry-run] [-y] [--undo | --undo-amazon]
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# The flags that are dumbtv's, and the ones that are AverageTV's own.
DRY_RUN=0
ASSUME_YES=0
PASSTHROUGH=()
undo=0
for a in "$@"; do
  case $a in
    --dry-run) DRY_RUN=1; PASSTHROUGH+=("$a") ;;
    -y|--yes)  ASSUME_YES=1; PASSTHROUGH+=("$a") ;;
    --undo|--undo-amazon) undo=1; PASSTHROUGH+=("$a") ;;
    *) die "unknown flag: $a" ;;
  esac
done
need_device
load_conf

if [[ $LAUNCHER == 0 && ${#PASSTHROUGH[@]} -eq 0 ]]; then
  note "LAUNCHER=0 in dumbtv.conf — keeping Amazon's home screen. Re-run ./scripts/configure.sh to change that."
  exit 0
fi

PKG=tv.averagetv.app
AVERAGETV_URL=https://github.com/zaco-tm/AverageTV.git

# Where AverageTV's checkout is. The order is deliberate: an explicit
# AVERAGETV_DIR wins, then a checkout next to this repository (the usual
# arrangement), then a cached clone.
averagetv_dir() {
  local d
  for d in "${AVERAGETV_DIR:-}" "$ROOT/../AverageTV" "$HOME/.cache/averagetv"; do
    [[ -n $d && -x $d/scripts/install.sh ]] && { printf '%s' "$d"; return 0; }
  done
  return 1
}

step "plan"
note "install AverageTV: open source, no ad ID, the internet only for the film picks"
note "the launcher is a separate project: $AVERAGETV_URL"
note "Amazon's launcher stays installed, so the TV can always go back to it"

AVG=$(averagetv_dir) || AVG=""
if [[ -z $AVG ]]; then
  # No checkout yet: clone it. A clone is not a change to the television, so
  # it happens without asking.
  target="${AVERAGETV_DIR:-$ROOT/../AverageTV}"
  note "no AverageTV checkout found; cloning it into $target"
  if [[ $DRY_RUN == 1 ]]; then
    note "[dry-run] git clone $AVERAGETV_URL $target"
    exit 0
  fi
  mkdir -p "$(dirname "$target")"
  git clone --depth 1 "$AVERAGETV_URL" "$target" ||
    die "could not clone AverageTV into $target. The repository may need authentication; clone it by hand, or point AVERAGETV_DIR at a checkout you already have."
  AVG="$target"
fi

if [[ $DRY_RUN == 1 ]]; then
  note "[dry-run] ADB=$ADB ADB_SERIAL=$SERIAL $AVG/scripts/install.sh"
  exit 0
fi
# The undo is not a change to the television's home screen, it is the way back
# from one, and the restore path asks for no confirmation of its own.
if [[ $undo == 0 ]]; then
  confirm "Replace the home screen on $SERIAL?" || die "cancelled"
fi

ADB=$ADB ADB_SERIAL=$SERIAL "$AVG/scripts/install.sh" ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"} ||
  die "AverageTV install failed (see above)"

# The undo has already said what it did: HOME is somewhere else now, on purpose,
# so there is nothing to check for AverageTV in front.
if [[ $undo == 1 ]]; then
  exit 0
fi

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
