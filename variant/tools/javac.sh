#!/usr/bin/env bash
# Type-check the variant's Java sources against android.jar, without a full APK build.
#
# The R class is not generated here: a stub with the resource names the sources use
# is enough to check the code, and it keeps this fast. The real build (build.sh)
# makes the real R.
#
# Usage: tools/javac.sh [extra source dir]
set -euo pipefail
SDK="${ANDROID_SDK:-/opt/homebrew/share/android-commandlinetools}"
AJ="$SDK/platforms/android-34/android.jar"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT:-/tmp/variant-classes}"
GEN="${GEN:-/tmp/variant-gen}"
mkdir -p "$OUT" "$GEN/io/freemytv"
python3 "$ROOT/tools/gen_config.py" --generic "$GEN/io/freemytv/Config.java"

# The stub R: every drawable and string the sources name.
python3 - "$ROOT/res" "$GEN/io/freemytv/R.java" <<'PY'
import os, re, sys
res, out = sys.argv[1], sys.argv[2]
names = {'drawable': set(), 'string': set(), 'mipmap': set()}
for kind in list(names):
    for d in (kind, kind + '-nodpi', kind + '-anydpi'):
        p = os.path.join(res, d)
        if not os.path.isdir(p):
            continue
        for f in os.listdir(p):
            if '.' in f:
                names[kind].add(f.rsplit('.', 1)[0])
lines = ['package io.freemytv;', '', 'public final class R {', '    private R() {}']
for kind, items in names.items():
    if not items:
        continue
    lines.append('    public static final class %s {' % kind)
    for i, n in enumerate(sorted(items)):
        lines.append('        public static final int %s = %d;' % (n, i + 1))
    lines.append('    }')
lines.append('}')
open(out, 'w').write('\n'.join(lines) + '\n')
PY

FILES=()
while IFS= read -r f; do FILES+=("$f"); done < <(find "$ROOT/src" "$GEN" -name '*.java')

# javac's own exit status is the verdict: the output goes to a log, so a long list of
# errors is not cut in half by a pipe.
LOG="${LOG:-/tmp/variant-javac.log}"
set +e
"$JAVA_HOME/bin/javac" -nowarn -Xlint:-options --release 8 -encoding UTF-8 \
  -classpath "$AJ" -d "$OUT" "${FILES[@]}" > "$LOG" 2>&1
STATUS=$?
set -e
head -80 "$LOG"
if [ "$STATUS" -ne 0 ]; then
  echo "javac failed with status $STATUS; the whole output is in $LOG" >&2
fi
exit "$STATUS"
