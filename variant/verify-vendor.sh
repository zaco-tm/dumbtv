#!/usr/bin/env bash
# Fails if a vendored file is not upstream's, byte for byte, except the ones listed in
# variant/local-changes.txt (one path per line, relative to variant/).
#
# variant/our-files.txt lists the paths in the vendored tree that are ours, not
# upstream's: they are not compared with upstream and are not reported as extra.
#
#   ./verify-vendor.sh    compare against the pinned upstream commit
#
# DUMBTV_VARIANT_TARBALL=/path/to/up.tar.gz  compare against a copy of upstream's
# archive instead of downloading it. The archive is still checked against the pinned
# hash, so this works offline.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

COMMIT=f1830445e6e629a2f1eab19602afef38a1a4f8b8
# sha256 of upstream's archive for the commit above, recorded on 2026-10-26. A different
# hash means the archive was regenerated (or it is not upstream's at all): check that
# upstream's commit is still the one this tree was vendored from before trusting it.
SHA256=ae5337a626a94c19591ac1a7c1285bedefeb876fd5d6568b4edb0840d59e2dc3

TMP=$(mktemp -d "${TMPDIR:-/tmp}/dumbtv-vendor.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

ARCHIVE="$TMP/up.tar.gz"
if [ -n "${DUMBTV_VARIANT_TARBALL:-}" ]; then
  [ -f "$DUMBTV_VARIANT_TARBALL" ] || { echo "no such archive: $DUMBTV_VARIANT_TARBALL"; exit 1; }
  cp "$DUMBTV_VARIANT_TARBALL" "$ARCHIVE"
else
  curl -fsSL "https://github.com/simbasjungles/free-my-tv/archive/$COMMIT.tar.gz" -o "$ARCHIVE" || {
    echo "could not download upstream's archive. Set DUMBTV_VARIANT_TARBALL to a copy of it to run offline."
    exit 1; }
fi

got=$(sha256 "$ARCHIVE")
if [ "$got" != "$SHA256" ]; then
  echo "upstream's archive is not the pinned one:"
  echo "  expected $SHA256"
  echo "  actual   $got"
  echo "The archive may have been regenerated, or it is not upstream's. Check that upstream's"
  echo "commit is still $COMMIT before trusting this tree."
  exit 1
fi

tar xzf "$ARCHIVE" -C "$TMP"
UP="$TMP/free-my-tv-$COMMIT"
[ -d "$UP" ] || { echo "the archive has no $COMMIT/ in it"; exit 1; }

listed=()
if [ -f local-changes.txt ]; then
  while IFS= read -r line; do
    if [ -n "$line" ]; then listed+=("$line"); fi
  done < local-changes.txt
fi
is_listed() {
  local want="$1" p
  for p in ${listed+"${listed[@]}"}; do [ "$p" = "$want" ] && return 0; done
  return 1
}

# our-files.txt holds the paths in the vendored tree that are ours, not upstream's:
# upstream has no such file, so it is neither compared with upstream nor extra.
our_files=()
if [ -f our-files.txt ]; then
  while IFS= read -r line; do
    if [ -n "$line" ]; then our_files+=("$line"); fi
  done < our-files.txt
fi
is_ours() {
  local want="$1" p
  for p in ${our_files+"${our_files[@]}"}; do [ "$p" = "$want" ] && return 0; done
  return 1
}

# macOS drops a .DS_Store in any directory it visits. It is not upstream's and it is
# git-ignored, so it is never part of the tree; only the real files are compared.
# tools/translate.py writes its own cache next to it (tools/.i18n-cache.json), also
# git-ignored and not upstream's: the same case, and the same exclusion.
find_args=(-type f ! -name '.DS_Store' ! -name '.i18n-cache.json')

rc=0

# Compares an upstream directory with ours: every upstream file we vendored must be
# here, byte for byte (unless it is listed in local-changes.txt), and every file of ours
# must be upstream's. The names given after the two directories are the upstream files
# to compare (all of them when none is given).
compare_tree() {
  local up="$1" ours="$2"
  shift 2
  local only="$*"
  [ -d "$up" ] || { echo "upstream has no $ours/"; exit 1; }
  local f rel name
  while IFS= read -r -d '' f; do
    name="${f#$up/}"
    rel="$ours/$name"
    if is_ours "$rel"; then
      # our-files.txt says this path is ours; upstream has it too, so one of the two
      # lists is wrong. Say so rather than compare: the proof must not be a loophole.
      echo "OURS BUT UPSTREAM'S: $rel"; rc=1; continue
    fi
    if [ -n "$only" ]; then     # only some of upstream's files are vendored here
      case " $only " in *" $name "*) ;; *) continue ;; esac
    fi
    if [ ! -e "$rel" ]; then echo "MISSING: $rel"; rc=1; continue; fi
    if cmp -s "$f" "$rel"; then
      if is_listed "$rel"; then echo "LISTED BUT UNCHANGED: $rel"; rc=1; fi
    elif is_listed "$rel"; then
      echo "changed (listed): $rel"
    else
      echo "CHANGED: $rel"; rc=1
    fi
  done < <(find "$up" "${find_args[@]}" -print0)
  while IFS= read -r -d '' f; do
    rel="$ours/${f#$ours/}"
    if [ -e "$up/${rel#$ours/}" ]; then
      continue                                # upstream has it: compared above
    elif is_ours "$rel"; then
      echo "ours (not upstream's): $rel"      # ours to begin with: nothing to compare
    else
      echo "EXTRA: $rel"; rc=1
    fi
  done < <(find "$ours" "${find_args[@]}" -print0)
}

# Compares one upstream file with ours (upstream's licence, renamed to ours).
compare_file() {
  local up="$1" ours="$2"
  [ -f "$up" ] || { echo "upstream has no $ours"; exit 1; }
  if [ ! -e "$ours" ]; then echo "MISSING: $ours"; rc=1; return; fi
  if cmp -s "$up" "$ours"; then
    if is_listed "$ours"; then echo "LISTED BUT UNCHANGED: $ours"; rc=1; fi
  elif is_listed "$ours"; then
    echo "changed (listed): $ours"
  else
    echo "CHANGED: $ours"; rc=1
  fi
}

compare_tree "$UP/app/src" src
compare_tree "$UP/app/res" res
compare_tree "$UP/app/assets" assets
# upstream's tools/ holds eight scripts; we vendored the two that work on the TV.
compare_tree "$UP/tools" tools photos.py translate.py
compare_file "$UP/LICENSE" LICENSE.free-my-tv
# Upstream's manifest, byte for byte: it is the record of what our own manifest was
# made from, so it cannot drift from upstream without the proof noticing.
compare_file "$UP/app/AndroidManifest.xml" upstream/AndroidManifest.xml

if [ "$rc" = 0 ]; then echo "vendor tree matches upstream $COMMIT"; fi
exit "$rc"
