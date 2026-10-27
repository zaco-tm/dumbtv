#!/usr/bin/env bash
# Fails if a vendored file is not upstream's, byte for byte, except the ones listed in
# variant/local-changes.txt (one path per line, relative to variant/).
#
#   ./verify-vendor.sh    compare against the pinned upstream commit
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

COMMIT=f1830445e6e629a2f1eab19602afef38a1a4f8b8
TMP=$(mktemp -d "${TMPDIR:-/tmp}/dumbtv-vendor.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://github.com/simbasjungles/free-my-tv/archive/$COMMIT.tar.gz" -o "$TMP/up.tar.gz"
tar xzf "$TMP/up.tar.gz" -C "$TMP"
UP="$TMP/free-my-tv-$COMMIT/app"

listed=()
if [ -f local-changes.txt ]; then
  while IFS= read -r line; do
    [ -n "$line" ] && listed+=("$line")
  done < local-changes.txt
fi
is_listed() {
  local want="$1" p
  for p in ${listed+"${listed[@]}"}; do [ "$p" = "$want" ] && return 0; done
  return 1
}

# macOS drops a .DS_Store in any directory it visits. It is not upstream's and it is
# git-ignored, so it is never part of the tree; only the real files are compared.
find_args=(-type f ! -name '.DS_Store')

rc=0
for top in src res assets; do
  [ -d "$UP/$top" ] || { echo "upstream has no $top/"; exit 1; }
  while IFS= read -r -d '' f; do
    rel="$top/${f#$UP/$top/}"
    if [ ! -e "$rel" ]; then echo "MISSING: $rel"; rc=1; continue; fi
    if cmp -s "$f" "$rel"; then
      if is_listed "$rel"; then echo "LISTED BUT UNCHANGED: $rel"; rc=1; fi
    elif is_listed "$rel"; then
      echo "changed (listed): $rel"
    else
      echo "CHANGED: $rel"; rc=1
    fi
  done < <(find "$UP/$top" "${find_args[@]}" -print0)
  while IFS= read -r -d '' f; do
    rel="$top/${f#$top/}"
    [ -e "$UP/$rel" ] || { echo "EXTRA: $rel"; rc=1; }
  done < <(find "$top" "${find_args[@]}" -print0)
done

[ "$rc" = 0 ] && echo "vendor tree matches upstream $COMMIT"
exit "$rc"
