# dumbtv variant launcher — stage 1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor free-my-tv's Android app into this repo as `variant/`, get it to build and install on the Ember 55 as `tv.dumbtv.variant`, and prove it runs without disturbing the launcher that works today.

**Architecture:** The upstream app is vendored verbatim under `variant/src/io/freemytv/` with its resources and assets. `aapt2 link --rename-manifest-package` gives the APK the application id `tv.dumbtv.variant` while the generated `R` class stays in `io.freemytv`, so no upstream file is edited. Our `variant/build.sh` builds it with the same toolchain as `launcher/build.sh` (aapt2 → javac → d8 → zipalign → apksigner, no Gradle), and `variant/tools/gen_config.py` turns `config.properties` into the `io.freemytv.Config` class upstream's code expects.

**Tech Stack:** Plain Java (no libraries, no Gradle), Python 3 standard library for the config generator and the tests, bash for the build, `aapt2`/`d8`/`apksigner` from Android build-tools 34, JDK 17.

## Global Constraints

- Vendored upstream: `simbasjungles/free-my-tv` at commit `f1830445e6e629a2f1eab19602afef38a1a4f8b8`. No other revision.
- The vendored sources keep the `io.freemytv` package. Do not rename, reformat or "improve" them.
- The variant's application id is `tv.dumbtv.variant`. The manifest package stays `io.freemytv`; `aapt2 link --rename-manifest-package tv.dumbtv.variant` renames it at link time. (Verified: the APK id becomes `tv.dumbtv.variant` and the generated `R` stays in `io.freemytv`.)
- `minSdkVersion 26`, `targetSdkVersion 33`.
- The APK declares exactly upstream's eight permissions, in upstream's order. `variant/permissions.txt` is that list.
- No Gradle, no libraries, no network in the build. Python 3 standard library only, and only for `variant/tools/gen_config.py` and the tests.
  - **Amended 2026-10-29.** This promise is about *the vendored tree's* build, and it still
    holds for it: `aapt2` → `javac` → `d8`, nothing else, and the CI job that proves it
    stays. The product itself is now built in React Native (stage 4), whose build is npm,
    Metro, Gradle and the network. See
    [the stage 4 plan](2026-10-29-averagetv-stage4.md).
- `variant/config.properties`, `variant/release.keystore` and `variant/build/` are git-ignored. CI builds `--generic`, so no TMDB key is ever baked by CI.
- The existing `launcher/` tree is untouched in stage 1, with one documented exception:
  `launcher/build.sh` (commit `5ad39da`) now asks the javac to *run* rather than merely to
  exist, because macOS ships `/usr/bin/javac`, a stub that fails. The change is in the JDK
  probe only; the launcher's manifest, its code and its release are unchanged.
- The variant's build must not carry `launcher/build.sh`'s `-Werror`: upstream's code is not warning-clean.
- Every script this plan adds must pass `bash -n`, and these must stay green: `python3 -m unittest discover -s tests`, `python3 catalog/validate.py`, `./launcher/release-check.sh --manifest`.
- No private addresses, hardware ids or the TMDB key in anything committed.

## File structure

| Path | Responsibility |
|---|---|
| `variant/src/io/freemytv/*.java` | Upstream's app, verbatim (40 files). Not ours to edit. |
| `variant/res/**` | Upstream's resources, verbatim. `R` is generated into `io.freemytv`. |
| `variant/assets/**` | Upstream's assets: Inter font, symbol PNGs, 26 i18n catalogues, `zones.json`. |
| `variant/tools/translate.py` | Upstream's i18n tool, adapted to our paths. |
| `variant/tools/photos.py` | Upstream's photo pusher, adapted to our provider authority. |
| `variant/tools/gen_config.py` | **Ours.** Reads `config.properties`, writes `io/freemytv/Config.java`. |
| `variant/AndroidManifest.xml` | **Ours.** Upstream's manifest with our label, our version and our provider authority. |
| `variant/upstream/AndroidManifest.xml` | Upstream's manifest, byte for byte: the record of what our own manifest was made from. |
| `variant/build.sh` | **Ours.** Builds `variant/build/variant.apk`. |
| `variant/check-apk.sh` | **Ours.** Asserts the built APK is what this repo expects. |
| `variant/verify-vendor.sh` | **Ours.** Proves the vendored tree is upstream's, byte for byte. |
| `variant/permissions.txt` | The eight permissions, in order, as the whole line aapt2 prints. |
| `variant/local-changes.txt` | Upstream paths allowed to differ from upstream (the two adapted tools). |
| `variant/our-files.txt` | Paths in a vendored tree that are ours, not upstream's (`tools/gen_config.py`). |
| `variant/UPSTREAM.md` | Provenance: upstream commit, licence, what we changed and why. |
| `variant/README.md` | How to build and install the variant. |
| `tests/test_variant_config.py` | **Ours.** Unit tests for the config generator. |
| `tests/test_variant_manifest.py` | **Ours.** The manifest, the permissions list, and the differences from upstream's manifest. |
| `tests/test_variant_tools.py` | **Ours.** The hand-adapted tools, run in a copy of the tree. |

---

### Task 1: Vendor the upstream tree, and prove it unmodified

**Files:**
- Create: `variant/src/io/freemytv/*.java` (40 files), `variant/res/**`, `variant/assets/**`
- Create: `variant/tools/translate.py`, `variant/tools/photos.py`
- Create: `variant/verify-vendor.sh`, `variant/local-changes.txt`, `variant/our-files.txt`, `variant/UPSTREAM.md`
- Create: `variant/LICENSE.free-my-tv`
- Create: `variant/upstream/AndroidManifest.xml` (upstream's manifest, byte for byte)
- Create: `NOTICE`

**Interfaces:**
- Consumes: nothing. This is the first task.
- Produces: `variant/` holding upstream's tree, and `variant/verify-vendor.sh`, which later tasks and CI call to prove the tree is untouched.

- [ ] **Step 1: Fetch the pinned upstream tree**

```bash
cd /tmp
rm -rf fmy && mkdir fmy && cd fmy
curl -fsSL -o up.tar.gz https://github.com/simbasjungles/free-my-tv/archive/f1830445e6e629a2f1eab19602afef38a1a4f8b8.tar.gz
tar xzf up.tar.gz
ls -d free-my-tv-*
```

Expected: exactly one directory, `free-my-tv-f1830445e6e629a2f1eab19602afef38a1a4f8b8`.

- [ ] **Step 2: Copy the app into `variant/`**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
UP=/tmp/fmy/free-my-tv-f1830445e6e629a2f1eab19602afef38a1a4f8b8
mkdir -p variant/src/io variant/tools
cp -R "$UP/app/src/io/freemytv" variant/src/io/
cp -R "$UP/app/res"    variant/res
cp -R "$UP/app/assets" variant/assets
cp "$UP/tools/translate.py" "$UP/tools/photos.py" variant/tools/
cp "$UP/LICENSE" variant/LICENSE.free-my-tv
# Upstream's manifest comes too, byte for byte: it is the record of what our own
# manifest was made from, and the verifier compares it like the other vendored files.
mkdir -p variant/upstream
cp "$UP/app/AndroidManifest.xml" variant/upstream/AndroidManifest.xml
ls variant/src/io/freemytv/*.java | wc -l
```

Expected: `40`.

- [ ] **Step 3: Point the photo tool at our provider authority**

The manifest authority is ours; `photos.py` must send to the same one. The vendored app code is untouched — the authority lives in the manifest, not in `PhotoInbox.java`.

```bash
cd /Users/zaco/Projects/Personal/dumbtv
sed -i '' 's#io\.freemytv\.photos#tv.dumbtv.variant.photos#g' variant/tools/photos.py
grep -n "variant.photos" variant/tools/photos.py
```

Expected: at least one line with `content://tv.dumbtv.variant.photos`.

- [ ] **Step 4: Write the vendor verifier**

Create `variant/verify-vendor.sh`:

```bash
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
  done < <(find "$UP/$top" -type f -print0)
  while IFS= read -r -d '' f; do
    rel="$top/${f#$top/}"
    [ -e "$UP/$rel" ] || { echo "EXTRA: $rel"; rc=1; }
  done < <(find "$top" -type f -print0)
done

[ "$rc" = 0 ] && echo "vendor tree matches upstream $COMMIT"
exit "$rc"
```

```bash
chmod +x variant/verify-vendor.sh
```

The verifier as shipped also compares upstream's `app/AndroidManifest.xml` with our
`variant/upstream/AndroidManifest.xml` (byte for byte), so the record of what our own
manifest was made from cannot drift from upstream's:

```bash
compare_file "$UP/app/AndroidManifest.xml" upstream/AndroidManifest.xml
```

- [ ] **Step 5: Write `variant/local-changes.txt` and `variant/UPSTREAM.md`**

`variant/local-changes.txt` lists the two tools we adapted, so the verifier may find them changed:

```
tools/photos.py
tools/translate.py
```

`variant/our-files.txt` lists the files in the vendored tree that are ours, not upstream's:

```
tools/gen_config.py
```

```bash
: > variant/local-changes.txt
```

`variant/UPSTREAM.md`:

```markdown
# Vendored upstream

The Android app in `variant/` is free-my-tv, vendored verbatim.

- Upstream: <https://github.com/simbasjungles/free-my-tv>
- Commit: `f1830445e6e629a2f1eab19602afef38a1a4f8b8` (2026-10-26)
- Licence: MIT — the text is in `LICENSE.free-my-tv`
- Vendored from: `app/src`, `app/res`, `app/assets`
- Tools adapted: `tools/translate.py`, `tools/photos.py` (the photo tool now writes to
  `content://tv.dumbtv.variant.photos`, our provider authority)
- Not vendored: upstream's `web/`, `webos/`, `tizen/`, `docs/`, `README.md`,
  `AGENTS.md`, `CLAUDE.md`, `.github/`, `.gitignore`, `.gitattributes`, `build.sh` and
  `config.example.properties` (we generate the config class ourselves)
- The app's code keeps upstream's `io.freemytv` package. The application id is ours:
  `aapt2 link --rename-manifest-package tv.dumbtv.variant` renames the manifest at link
  time, so the generated `R` stays in `io.freemytv` and no upstream file is edited.

## Local changes

`local-changes.txt` lists the two tools we adapted, so the verifier may find them changed.
`our-files.txt` lists the files in the vendored tree that are ours, not upstream's
(`tools/gen_config.py`), so the verifier does not call them extra.

## Third-party material inside the app

- Inter (font, `assets/fonts/`) — SIL Open Font License 1.1
- Material Symbols (the `assets/symbols/` PNGs) — Apache 2.0
- Coin logos (`res/drawable/coin_*.xml`) — cryptocurrency-icons, CC0
- Samsung app logos — Simple Icons, CC0
- The 26 `assets/i18n/*.json` catalogues are upstream's own translations.
```

- [ ] **Step 6: Write the root `NOTICE`**

```markdown
# NOTICE

This project vendors third-party software. See `variant/UPSTREAM.md` for the full list.

## free-my-tv

`variant/src`, `variant/res` and `variant/assets` are from
<https://github.com/simbasjungles/free-my-tv>, commit
`f1830445e6e629a2f1eab19602afef38a1a4f8b8`, MIT licensed. The licence text is in
`variant/LICENSE.free-my-tv`.

## Fonts and symbols

- Inter — SIL Open Font License 1.1 — `variant/assets/fonts/`
- Material Symbols — Apache License 2.0 — `variant/assets/symbols/`
```

- [ ] **Step 7: Run the verifier — it must pass**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
./variant/verify-vendor.sh
```

Expected: `vendor tree matches upstream f1830445e6e629a2f1eab19602afef38a1a4f8b8` and exit 0.

- [ ] **Step 8: Prove the verifier actually fails on a change**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
printf '\n// tampered\n' >> variant/src/io/freemytv/Ui.java
./variant/verify-vendor.sh; echo "exit=$?"
```

Expected: `CHANGED: src/io/freemytv/Ui.java` and `exit=1`. Then restore the file from the
tarball, so this step works even if `/tmp/fmy` was cleaned up in between:

```bash
cd /tmp/fmy && tar xzf up.tar.gz
cp /tmp/fmy/free-my-tv-*/app/src/io/freemytv/Ui.java \
   /Users/zaco/Projects/Personal/dumbtv/variant/src/io/freemytv/Ui.java
cd /Users/zaco/Projects/Personal/dumbtv
./variant/verify-vendor.sh
```

Expected: the pass line again.

- [ ] **Step 9: Commit**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
git add variant NOTICE
git commit -m "feat(variant): vendor free-my-tv's Android app

The app comes in verbatim, with a verifier that proves every byte is
upstream's. The application id is ours; aapt2 renames the manifest at
link time, so the code keeps its io.freemytv package and the generated R
class stays where upstream's code expects it."
```

---

### Task 2: The config generator, with tests

**Files:**
- Create: `variant/tools/gen_config.py`
- Create: `tests/test_variant_config.py`
- Create: `variant/config.example.properties`

**Interfaces:**
- Consumes: `variant/config.properties` (optional) and `--generic`.
- Produces: `gen_config.py` writes an `io/freemytv/Config.java` with the sixteen fields upstream's code reads: `TMDB_KEY`, `WATCHMODE_KEY`, `TMDB_REGION`, `LATITUDE`, `LONGITUDE`, `CITY`, `LANGUAGE`, `CURRENCY`, `TEMPERATURE`, `HIDE_SERVICES`, `THEME`, `DISABLE_ASSISTANT`, `SHOW_CRYPTO`, `HIDE_ANIMATION`, `SCREENSAVER`, `GENERIC`. Task 3's build script calls it.

> **The empty-value rule (settled after review).** A key that is in `config.properties` but
> empty stays empty: an empty latitude or longitude is what makes the app guess the place
> from the TV's time zone (`Place.java`), and `config.example.properties` promises exactly
> that. Upstream's shell resolves an empty value to the default (`${v:-$2}`), which would
> pin every TV to New York. A key that is *not* in the file keeps the default, as upstream
> does. The four switches are Java booleans with no empty state: an empty one keeps the
> default, as upstream's shell does. Numbers are upstream's own pattern — an optional minus
> sign, digits, an optional fraction and nothing else, so `nan`, `inf` and `1e5` are refused.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_variant_config.py`:

```python
"""The variant's config.properties -> io.freemytv.Config generator, off-device."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'variant' / 'tools' / 'gen_config.py'

FIELDS = ['TMDB_KEY', 'WATCHMODE_KEY', 'TMDB_REGION', 'LATITUDE', 'LONGITUDE', 'CITY',
          'LANGUAGE', 'CURRENCY', 'TEMPERATURE', 'HIDE_SERVICES', 'THEME',
          'DISABLE_ASSISTANT', 'SHOW_CRYPTO', 'HIDE_ANIMATION', 'SCREENSAVER', 'GENERIC']


def run_tool(*arguments):
    """Run the tool with these arguments and return the finished process."""
    return subprocess.run([sys.executable, str(TOOL), *arguments],
                          capture_output=True, text=True)


def generate_bytes(properties, *, generic=False, encoding='utf-8'):
    """Run the tool on these properties and return the generated Java as bytes."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'Config.java'
        args = []
        if generic:
            args.append('--generic')
        else:
            props = Path(tmp) / 'config.properties'
            props.write_text(properties, encoding=encoding)
            args.append(str(props))
        args.append(str(out))
        done = run_tool(*args)
        if done.returncode != 0:
            raise AssertionError(done.stderr.strip())
        return out.read_bytes()


def generate(properties, *, generic=False, encoding='utf-8'):
    """Run the tool and return the generated Java."""
    return generate_bytes(properties, generic=generic, encoding=encoding).decode('utf-8')


class VariantConfigTests(unittest.TestCase):
    def test_generic_leaves_the_location_empty(self):
        java = generate('', generic=True)
        self.assertIn('static final String LATITUDE = "";', java)
        self.assertIn('static final String LONGITUDE = "";', java)
        self.assertIn('static final String TMDB_REGION = "";', java)
        self.assertIn('static final String CURRENCY = "";', java)

    def test_generic_takes_the_other_defaults(self):
        java = generate('', generic=True)
        self.assertIn('static final String TMDB_KEY = "";', java)
        self.assertIn('static final String LANGUAGE = "auto";', java)
        self.assertIn('static final String TEMPERATURE = "auto";', java)
        self.assertIn('static final String THEME = "auto";', java)
        self.assertIn('static final boolean SHOW_CRYPTO = true;', java)
        self.assertIn('static final boolean SCREENSAVER = true;', java)
        self.assertIn('static final boolean GENERIC = true;', java)

    def test_reads_the_values(self):
        java = generate('tmdb_key=abc123\ncity=Amsterdam\ntmdb_region=NL\n'
                        'latitude=52.37\nlongitude=4.89\ncurrency=EUR\n')
        self.assertIn('static final String TMDB_KEY = "abc123";', java)
        self.assertIn('static final String CITY = "Amsterdam";', java)
        self.assertIn('static final String TMDB_REGION = "NL";', java)
        self.assertIn('static final String LATITUDE = "52.37";', java)
        self.assertIn('static final String LONGITUDE = "4.89";', java)
        self.assertIn('static final String CURRENCY = "EUR";', java)

    def test_the_last_value_wins(self):
        java = generate('city=First\ncity=Second\n')
        self.assertIn('static final String CITY = "Second";', java)

    def test_quotes_and_backslashes_are_stripped(self):
        java = generate('tmdb_key="quoted"\n')
        self.assertIn('static final String TMDB_KEY = "quoted";', java)

    def test_spaces_around_the_equals_are_allowed(self):
        # The docstring's own form: "key = value".
        java = generate('city = Amsterdam\ntmdb_key  =  abc123\n')
        self.assertIn('static final String CITY = "Amsterdam";', java)
        self.assertIn('static final String TMDB_KEY = "abc123";', java)

    def test_a_comment_line_is_ignored(self):
        # A comment that looks like a setting is still a comment. It comes after the
        # setting it names, so if it were honoured the last value would win.
        java = generate('city=Amsterdam\n# city=Berlin\n# tmdb_key=commented\n')
        self.assertIn('static final String CITY = "Amsterdam";', java)
        self.assertIn('static final String TMDB_KEY = "";', java)
        self.assertNotIn('Berlin', java)
        self.assertNotIn('commented', java)

    def test_an_unknown_key_is_ignored(self):
        java = generate('not_a_setting=whatever\ncity=Amsterdam\n')
        self.assertIn('static final String CITY = "Amsterdam";', java)
        self.assertNotIn('not_a_setting', java)
        self.assertNotIn('whatever', java)
        # The class holds the sixteen fields and nothing else, so an unknown key in the
        # file cannot turn up in it.
        self.assertEqual(java.count('static final'), len(FIELDS))

    def test_hide_services_is_read(self):
        java = generate('hide_services=netflix,prime\n')
        self.assertIn('static final String HIDE_SERVICES = "netflix,prime";', java)

    def test_watchmode_key_is_read(self):
        java = generate('watchmode_key=abc123\n')
        self.assertIn('static final String WATCHMODE_KEY = "abc123";', java)

    def test_a_city_that_is_not_ascii_comes_out_as_utf8(self):
        # The build compiles with -encoding UTF-8, so the city has to be UTF-8 in the file.
        data = generate_bytes('city=København\n')
        self.assertIn('static final String CITY = "København";', data.decode('utf-8'))
        self.assertIn('København'.encode('utf-8'), data)

    def test_a_byte_order_mark_does_not_hide_the_first_key(self):
        # A file saved with a BOM starts with U+FEFF. Without utf-8-sig the first key
        # would be a byte order mark followed by "tmdb_key": not a known key, and
        # dropped without a word.
        java = generate('tmdb_key=abc123\ncity=Amsterdam\n', encoding='utf-8-sig')
        self.assertIn('static final String TMDB_KEY = "abc123";', java)
        self.assertIn('static final String CITY = "Amsterdam";', java)

    def test_booleans_follow_upstream(self):
        java = generate('disable_assistant=true\nshow_crypto=false\n'
                        'hide_animation=true\nscreensaver=false\n')
        self.assertIn('static final boolean DISABLE_ASSISTANT = true;', java)
        self.assertIn('static final boolean SHOW_CRYPTO = false;', java)
        self.assertIn('static final boolean HIDE_ANIMATION = true;', java)
        self.assertIn('static final boolean SCREENSAVER = false;', java)

    def test_a_word_that_is_not_true_is_not_true(self):
        java = generate('disable_assistant=yes\n')
        self.assertIn('static final boolean DISABLE_ASSISTANT = false;', java)

    def test_a_word_that_is_not_false_is_not_false(self):
        java = generate('screensaver=maybe\n')
        self.assertIn('static final boolean SCREENSAVER = true;', java)

    def test_an_empty_switch_keeps_the_default(self):
        # The app reads the switches as Java booleans: an empty one is a switch that was
        # not set, so it keeps the default, as upstream's shell does.
        java = generate('disable_assistant=\nshow_crypto=\nhide_animation=\nscreensaver=\n')
        self.assertIn('static final boolean DISABLE_ASSISTANT = false;', java)
        self.assertIn('static final boolean SHOW_CRYPTO = true;', java)
        self.assertIn('static final boolean HIDE_ANIMATION = false;', java)
        self.assertIn('static final boolean SCREENSAVER = true;', java)

    def test_an_empty_latitude_stays_empty(self):
        # An empty place is an answer: the app then guesses it from the TV's time zone
        # (Place.java). Upstream's shell would put New York here.
        java = generate('latitude=\nlongitude=\n')
        self.assertIn('static final String LATITUDE = "";', java)
        self.assertIn('static final String LONGITUDE = "";', java)

    def test_an_absent_latitude_stays_empty(self):
        # An absent key and an empty one mean the same thing: the app then guesses the
        # place from the TV's time zone (Place.java). Upstream's shell would put New
        # York here, and a config that sets only a key and a city would pin the TV to
        # New York without saying so.
        java = generate('city=Amsterdam\n')
        self.assertIn('static final String LATITUDE = "";', java)
        self.assertIn('static final String LONGITUDE = "";', java)

    def test_an_absent_region_and_currency_stay_empty(self):
        # The same for the region and the currency: empty means the TV's country.
        java = generate('city=Amsterdam\n')
        self.assertIn('static final String TMDB_REGION = "";', java)
        self.assertIn('static final String CURRENCY = "";', java)

    def test_a_latitude_is_read(self):
        java = generate('latitude=52.37\n')
        self.assertIn('static final String LATITUDE = "52.37";', java)

    def test_a_latitude_below_zero_is_read(self):
        java = generate('latitude=-33.87\nlongitude=151.21\n')
        self.assertIn('static final String LATITUDE = "-33.87";', java)
        self.assertIn('static final String LONGITUDE = "151.21";', java)

    def test_a_latitude_that_is_not_a_number_is_refused(self):
        with self.assertRaises(AssertionError) as caught:
            generate('latitude=52,37\n')
        self.assertIn('must be a number', str(caught.exception))

    def test_a_longitude_that_is_not_a_number_is_refused(self):
        with self.assertRaises(AssertionError) as caught:
            generate('longitude=4,89\n')
        self.assertIn('must be a number', str(caught.exception))

    def test_a_latitude_that_is_not_finite_is_refused(self):
        for value in ('nan', 'inf', '-inf'):
            with self.subTest(value=value):
                with self.assertRaises(AssertionError) as caught:
                    generate(f'latitude={value}\n')
                self.assertIn('must be a number', str(caught.exception))

    def test_a_latitude_in_exponent_form_is_refused(self):
        with self.assertRaises(AssertionError) as caught:
            generate('latitude=1e5\n')
        self.assertIn('must be a number', str(caught.exception))

    def test_a_latitude_with_letters_after_it_is_refused(self):
        with self.assertRaises(AssertionError) as caught:
            generate('latitude=52.37abc\n')
        self.assertIn('must be a number', str(caught.exception))

    def test_the_error_names_the_key_and_the_value(self):
        with self.assertRaises(AssertionError) as caught:
            generate('latitude=nan\n')
        message = str(caught.exception)
        self.assertIn('must be a number', message)
        self.assertIn('latitude', message)
        self.assertIn('nan', message)

    def test_a_refused_value_leaves_an_earlier_target_alone(self):
        # The text is built before the target is opened, so a refused value cannot leave
        # an empty Config.java behind for a later javac to misread.
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_text('latitude=52,37\n', encoding='utf-8')
            out = Path(tmp) / 'Config.java'
            out.write_text('// the build from before\n', encoding='utf-8')
            done = run_tool(str(props), str(out))
            self.assertNotEqual(done.returncode, 0)
            self.assertEqual(out.read_text(encoding='utf-8'), '// the build from before\n')

    def test_a_refused_value_leaves_no_target_at_all(self):
        # The same, with nothing to keep: the run leaves no file, not an empty one.
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_text('latitude=52,37\n', encoding='utf-8')
            out = Path(tmp) / 'Config.java'
            done = run_tool(str(props), str(out))
            self.assertNotEqual(done.returncode, 0)
            self.assertFalse(out.exists())

    def test_a_missing_input_file_says_so_in_one_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / 'nope.properties'
            done = run_tool(str(missing), str(Path(tmp) / 'Config.java'))
            self.assertNotEqual(done.returncode, 0)
            self.assertIn(str(missing), done.stderr)
            self.assertNotIn('Traceback', done.stderr)
            self.assertEqual(len(done.stderr.strip().splitlines()), 1)

    def test_a_missing_output_directory_says_so_in_one_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            props = Path(tmp) / 'config.properties'
            props.write_text('city=Amsterdam\n', encoding='utf-8')
            out = Path(tmp) / 'nowhere' / 'Config.java'
            done = run_tool(str(props), str(out))
            self.assertNotEqual(done.returncode, 0)
            self.assertIn(str(out), done.stderr)
            self.assertNotIn('Traceback', done.stderr)
            self.assertEqual(len(done.stderr.strip().splitlines()), 1)

    def test_an_empty_region_and_currency_stay_empty(self):
        # The app reads an empty region or currency as "the TV's time zone guesses" too.
        java = generate('tmdb_region=\ncurrency=\n')
        self.assertIn('static final String TMDB_REGION = "";', java)
        self.assertIn('static final String CURRENCY = "";', java)

    def test_every_field_upstream_reads_is_there(self):
        java = generate('', generic=True)
        for field in FIELDS:
            self.assertIn(field, java)

    def test_the_class_is_in_upstreams_package(self):
        java = generate('', generic=True)
        self.assertIn('package io.freemytv;', java)
        self.assertIn('final class Config {', java)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Run the tests — they must fail**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
python3 -m unittest tests.test_variant_config -v
```

Expected: `FileNotFoundError` — `variant/tools/gen_config.py` does not exist yet.

- [ ] **Step 3: Write the generator**

Create `variant/tools/gen_config.py`:

```python
#!/usr/bin/env python3
"""Turns variant/config.properties into the io.freemytv.Config class upstream's code reads.

    gen_config.py --generic OUT.java
    gen_config.py config.properties OUT.java

Upstream builds the same class from shell; this puts upstream's rules in one place, so the
repo's unit tests can check them without a device. There is one deliberate difference from
upstream, the empty-value rule, which the bullets below explain.
  - a value is the last "key = value" line, trimmed, with quotes and backslashes removed
  - a UTF-8 byte order mark at the start of the file is ignored
  - a key that is not in the file keeps the default; a key that is in the file but empty
    stays empty. The app reads an empty place, region or currency as "the TV's time zone
    guesses" (Place.java), so an empty value is an answer, not a missing one. This is the
    one deliberate difference from upstream: upstream's shell gives an empty value the
    default. The four place fields default to empty here, not to upstream's New York:
    an absent key and an empty one mean the same thing.
  - an unknown key is dropped, with a warning that names it
  - latitude and longitude must be a plain number: an optional minus sign, digits and an
    optional fraction, and nothing else
  - disable_assistant and hide_animation are true only for exactly "true"
  - show_crypto is true only for exactly "true"
  - screensaver is false only for exactly "false"
  - the four switches are Java booleans, which have no empty state: an empty one keeps
    the default
  - --generic leaves the location, region and currency empty, and sets GENERIC true
"""
import re
import sys

DEFAULTS = {
    'tmdb_key': '',
    'watchmode_key': '',
    # The place fields default to empty, not to upstream's New York: the app reads an
    # empty place, region or currency as "the TV's time zone guesses" (Place.java), so
    # an absent key and an empty one mean the same thing.
    'tmdb_region': '',
    'latitude': '',
    'longitude': '',
    'city': '',
    'language': 'auto',
    'currency': '',
    'temperature': 'auto',
    'hide_services': '',
    'theme': 'auto',
    'disable_assistant': 'false',
    'show_crypto': 'true',
    'hide_animation': 'false',
    'screensaver': 'true',
}

# The switches the app reads as Java booleans: there is no empty state for them, so an
# empty one is a switch that was not set and keeps the default.
SWITCHES = ('disable_assistant', 'show_crypto', 'hide_animation', 'screensaver')

# Upstream's own pattern: an optional minus sign, digits, an optional fraction.
NUMBER = re.compile(r'-?[0-9]+(\.[0-9]+)?')

TEMPLATE = '''package io.freemytv;

/** Generated by gen_config.py from config.properties: edit that file, not this one. */
final class Config {{
    private Config() {{}}

    static final String TMDB_KEY = "{tmdb_key}";
    static final String WATCHMODE_KEY = "{watchmode_key}";
    static final String TMDB_REGION = "{tmdb_region}";
    static final String LATITUDE = "{latitude}";
    static final String LONGITUDE = "{longitude}";
    static final String CITY = "{city}";
    static final String LANGUAGE = "{language}";
    static final String CURRENCY = "{currency}";
    static final String TEMPERATURE = "{temperature}";
    static final String HIDE_SERVICES = "{hide_services}";
    static final String THEME = "{theme}";
    static final boolean DISABLE_ASSISTANT = {disable_assistant};
    static final boolean SHOW_CRYPTO = {show_crypto};
    static final boolean HIDE_ANIMATION = {hide_animation};
    static final boolean SCREENSAVER = {screensaver};
    static final boolean GENERIC = {generic};
}}
'''


def read_properties(path):
    """The last value wins, as upstream's shell does.

    A key that is not in the file is not in the result, so the default is used for it. A
    key that is in the file is in the result with the value it has there, empty or not.

    utf-8-sig drops a byte order mark if the file has one. Without it the first key
    would be read as a byte order mark followed by "tmdb_key": not a known key, and
    dropped without a word.

    A key that is not one of ours is dropped with a warning that names it: a typo
    like "tmdb_keey" would otherwise build an APK without a key and say nothing.
    """
    values = {}
    warned = set()
    try:
        with open(path, encoding='utf-8-sig') as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, _, value = line.partition('=')
                key = key.strip()
                if key not in DEFAULTS:
                    if key not in warned:
                        warned.add(key)
                        print(f'{path}: unknown key "{key}" (ignored)', file=sys.stderr)
                    continue
                values[key] = value.strip().replace('"', '').replace('\\', '')
    except UnicodeDecodeError:
        # Notepad's "Unicode" saves UTF-16, which is not UTF-8. Upstream's own build
        # script says so in one line instead of reading no settings at all.
        raise SystemExit(f'{path}: is saved as UTF-16 (Notepad\'s "Unicode"). '
                         'Save it as UTF-8 and build again.')
    except OSError as error:
        raise SystemExit(f'{path}: cannot be read: {error.strerror or error}')
    return values


def number(value, name):
    """Upstream's rule: an optional minus sign, digits, an optional fraction. Nothing else,
    so "nan", "inf" and "1e5" are refused the way upstream refuses them.

    An empty value is left alone: it says the TV's time zone guesses, which is what the
    app does with an empty place.
    """
    if value == '':
        return value
    if not NUMBER.fullmatch(value):
        raise SystemExit(f'config.properties: {name} must be a number (got "{value}")')
    return value


def build(properties, generic):
    values = dict(DEFAULTS)
    if not generic:
        for key, value in properties.items():
            if key in SWITCHES and value == '':
                continue          # an empty switch is a switch that was not set
            values[key] = value
        values['latitude'] = number(values['latitude'], 'latitude')
        values['longitude'] = number(values['longitude'], 'longitude')
    # --generic leaves the place, the region and the currency empty: the TV's time zone
    # guesses them, which is what the defaults say too.
    values['disable_assistant'] = 'true' if values['disable_assistant'] == 'true' else 'false'
    values['show_crypto'] = 'true' if values['show_crypto'] == 'true' else 'false'
    values['hide_animation'] = 'true' if values['hide_animation'] == 'true' else 'false'
    values['screensaver'] = 'false' if values['screensaver'] == 'false' else 'true'
    values['generic'] = 'true' if generic else 'false'
    return TEMPLATE.format(**values)


def main(argv):
    generic = False
    args = []
    for arg in argv[1:]:
        if arg == '--generic':
            generic = True
        else:
            args.append(arg)
    if generic:
        if len(args) != 1:
            raise SystemExit('usage: gen_config.py --generic <Config.java>')
        source, target = None, args[0]
    else:
        if len(args) != 2:
            raise SystemExit('usage: gen_config.py <config.properties> <Config.java>')
        source, target = args
    properties = {} if generic else read_properties(source)
    # The text is built before the target is opened: a refused value must leave an
    # earlier Config.java alone, not leave an empty one behind.
    text = build(properties, generic)
    try:
        with open(target, 'w', encoding='utf-8') as handle:
            handle.write(text)
    except OSError as error:
        raise SystemExit(f'{target}: cannot be written: {error.strerror or error}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
```

- [ ] **Step 4: Run the tests — they must pass**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
python3 -m unittest tests.test_variant_config -v
```

Expected: 33 tests, all OK.

- [ ] **Step 5: Write the example config**

Create `variant/config.example.properties`:

```properties
# Copy to config.properties and fill in. config.properties is git-ignored; this file is not.
#
# Your TMDB API key (read-only): account.tmdb.org -> Settings -> API -> Authentication Key.
# Without it the shelf and the clock still work, but no picks appear.
tmdb_key=

# Your Watchmode API key (optional): a free key from watchmode.com makes the picks open
# the title's own page in its app, not just the app. Keep it private. Uncomment the line
# below and paste the key in.
#watchmode_key=

# Your city, and its coordinates. Leave them empty and the TV's time zone guesses.
city=
latitude=
longitude=

# Where the picks come from (TMDB region) and what the prices are in. Leave them empty
# and the TV's country decides. A region is two letters (US, NL, GB); a currency is
# three (USD, EUR).
tmdb_region=
currency=

# What the home screen speaks and how it looks.
language=auto
temperature=auto
theme=auto

# The switches.
show_crypto=true
hide_animation=false
disable_assistant=false
screensaver=true

# Comma-separated services to hide from the shelf.
hide_services=
```

- [ ] **Step 6: Commit**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
git add variant/tools/gen_config.py variant/config.example.properties tests/test_variant_config.py
git commit -m "feat(variant): the config.properties -> Config generator, with tests

Upstream builds its io.freemytv.Config from shell. The same rules live
here in one place, so the repo's own unit tests can check them without a
device: last value wins, latitude and longitude must be plain numbers or
empty, and the four booleans follow upstream's exact wording (GENERIC
marks the build that leaves the place to the TV's time zone)."
```

---

### Task 3: The manifest, the build, and the APK checks

**Files:**
- Create: `variant/AndroidManifest.xml`
- Create: `variant/permissions.txt`
- Create: `variant/build.sh`
- Create: `variant/check-apk.sh`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `variant/tools/gen_config.py` (Task 2), the vendored tree (Task 1).
- Produces: `variant/build/variant.apk`, and `variant/check-apk.sh`, which CI and Task 5 call.

- [ ] **Step 1: Write `variant/permissions.txt`**

Upstream's eight permissions, in their order, as the whole line `aapt2 dump permissions`
prints it — the attribute on `SCHEDULE_EXACT_ALARM` is part of the record:

```
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.ACCESS_NETWORK_STATE'
uses-permission: name='android.permission.RECEIVE_BOOT_COMPLETED'
uses-permission: name='android.permission.SYSTEM_ALERT_WINDOW'
uses-permission: name='android.permission.FOREGROUND_SERVICE'
uses-permission: name='android.permission.SCHEDULE_EXACT_ALARM' maxSdkVersion='32'
uses-permission: name='android.permission.USE_EXACT_ALARM'
uses-permission: name='android.permission.REQUEST_INSTALL_PACKAGES'
```

- [ ] **Step 2: Write `variant/AndroidManifest.xml`**

Upstream's manifest, with six changes: the label, the version, the provider authority, the
task affinity (twice), the fully-qualified component names, and the dropped HOME category.
The manifest package stays
`io.freemytv`, but `aapt2 link --rename-manifest-package` makes that `tv.dumbtv.variant` in
the APK, where our classes are not — so the relative names upstream used are written out in
full here.

The HOME category is dropped on purpose: on this Fire OS `tv.dumbtv.home` is the home
screen (through the Guard, an accessibility service that stage 2 adds), and a home-app
candidate could take the HOME key away from the launcher that works. The app is still in the
launcher through `SettingsActivity`'s LEANBACK_LAUNCHER and LAUNCHER filters.

Upstream's own manifest is vendored byte for byte at `variant/upstream/AndroidManifest.xml`,
and `tests/test_variant_manifest.py` asserts that the two differ in exactly these six
things.

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="io.freemytv"
    android:versionCode="1"
    android:versionName="1.0">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <!-- After the TV boots (and after a TV update), checks that the mode is still as you left it. -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <!-- The sleep timer's minutes left over any app (SleepOverlay), when picked; allowed through ADB, as Android TV
         has no screen for it. -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <!-- The sleep timer on time: from Android 12, windows under 10 minutes stretch to 10. No prompt for either. -->
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <!-- Upstream's in-app updater. Inert for a build signed with another key; stage 3 removes it. -->
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />

    <!-- Android 11+: without this list the app can't "see" the other apps. -->
    <queries>
        <package android:name="com.netflix.ninja" />
        <package android:name="com.google.android.youtube.tv" />
        <package android:name="com.amazon.firetv.youtube" />
        <package android:name="com.amazon.amazonvideo.livingroom" />
        <package android:name="com.amazon.firebat" />
        <package android:name="com.amazon.avod" />
        <package android:name="com.disney.disneyplus" />
        <package android:name="com.wbd.stream" />
        <package android:name="com.hbo.hbonow" />
        <package android:name="com.apple.atve.androidtv.appletv" />
        <package android:name="com.apple.atve.sony.appletv" />
        <package android:name="com.apple.atve.amazon.appletv" />
        <package android:name="com.hulu.livingroomplus" />
        <package android:name="com.hulu.plus" />
        <package android:name="com.cbs.ott" />
        <package android:name="com.cbs.ca" />
        <package android:name="com.bskyb.nowtv.beta" />
        <package android:name="de.swr.avp.ard.tv" />
        <package android:name="com.zdf.android.mediathek" />
        <package android:name="tv.arte.plus7" />
        <package android:name="de.prosiebensat1digital.seventv" />
        <package android:name="de.rtli.tvnow" />
        <package android:name="de.sky.online" />
        <package android:name="de.telekom.magentatv.tv" />
        <package android:name="com.peacocktv.peacockandroid" />
        <package android:name="com.peacock.peacockfiretv" />
        <package android:name="com.globo.globotv" />
        <package android:name="ru.kinopoisk.tv" />
        <package android:name="ru.more.play" />
        <package android:name="gpm.tnt_premier" />
        <package android:name="ru.amediateka" />
        <package android:name="ru.rt.video.app.tv" />
        <package android:name="in.startv.hotstar" />
        <package android:name="com.crunchyroll.crunchyroid" />
        <package android:name="net.cme.voyo.cz.tvapp" />
        <package android:name="com.spotify.tv.android" />
        <package android:name="com.tcl.tv" />
        <package android:name="com.google.android.tv" />
        <package android:name="com.mediatek.wwtv.tvcenter" />
        <package android:name="com.sony.dtv.tvx" />
        <package android:name="com.smartdevice.livetv" />
        <package android:name="com.mediatek.tv.oneworld.tvcenter" />
        <package android:name="com.htc.htcsettings" />
        <package android:name="com.softwinner.tcorrection" />
        <package android:name="com.softwinner.miracastReceiver" />
        <package android:name="com.softwinner.awlivetv" />
        <package android:name="com.xiaomi.mitv.tvplayer" />
        <package android:name="com.amazon.tv.livetv" />
        <package android:name="com.amazon.tv.inputpreference.service" />
        <package android:name="com.amazon.mediatek.livetv" />
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
        </intent>
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="content" android:host="android.media.tv" />
        </intent>
    </queries>

    <uses-feature android:name="android.software.leanback" android:required="false" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />

    <application
        android:name="io.freemytv.App"
        android:label="dumbtv home (variant)"
        android:icon="@drawable/icon"
        android:banner="@drawable/banner"
        android:allowBackup="false"
        android:usesCleartextTraffic="false">

        <activity
            android:name="io.freemytv.SettingsActivity"
            android:process=":home"
            android:exported="true"
            android:label="dumbtv home (variant)"
            android:launchMode="singleTask"
            android:taskAffinity="tv.dumbtv.variant.settings"
            android:excludeFromRecents="true"
            android:screenOrientation="landscape"
            android:configChanges="keyboard|keyboardHidden|navigation|orientation|screenSize|screenLayout|smallestScreenSize|uiMode|density|fontScale|locale|layoutDirection"
            android:theme="@style/FreeMyTV.Home">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity
            android:name="io.freemytv.HomeActivity"
            android:process=":home"
            android:exported="true"
            android:label="dumbtv home (variant)"
            android:launchMode="singleTask"
            android:taskAffinity=""
            android:stateNotNeeded="true"
            android:clearTaskOnLaunch="true"
            android:resumeWhilePausing="true"
            android:excludeFromRecents="true"
            android:screenOrientation="landscape"
            android:configChanges="keyboard|keyboardHidden|navigation|orientation|screenSize|screenLayout|smallestScreenSize|uiMode|density|fontScale|locale|layoutDirection"
            android:theme="@style/FreeMyTV.Home">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <!-- Upstream declares HOME (and DEFAULT) here. We do not: the variant
                     must not be able to take the HOME key from tv.dumbtv.home. -->
            </intent-filter>
        </activity>

        <activity
            android:name="io.freemytv.FireHomeActivity"
            android:process=":home"
            android:exported="false"
            android:label="dumbtv home (variant)"
            android:launchMode="singleTask"
            android:taskAffinity="tv.dumbtv.variant.settings"
            android:excludeFromRecents="true"
            android:screenOrientation="landscape"
            android:configChanges="keyboard|keyboardHidden|navigation|orientation|screenSize|screenLayout|smallestScreenSize|uiMode|density|fontScale|locale|layoutDirection"
            android:theme="@style/FreeMyTV.Home" />

        <service
            android:name="io.freemytv.Screensaver"
            android:process=":home"
            android:enabled="@bool/dream_in_home"
            android:exported="true"
            android:label="dumbtv home (variant)"
            android:permission="android.permission.BIND_DREAM_SERVICE">
            <intent-filter>
                <action android:name="android.service.dreams.DreamService" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </service>

        <service
            android:name="io.freemytv.ScreensaverAlone"
            android:enabled="@bool/dream_alone"
            android:exported="true"
            android:label="dumbtv home (variant)"
            android:permission="android.permission.BIND_DREAM_SERVICE">
            <intent-filter>
                <action android:name="android.service.dreams.DreamService" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </service>

        <service
            android:name="io.freemytv.ModeJob"
            android:exported="false"
            android:permission="android.permission.BIND_JOB_SERVICE" />

        <service
            android:name="io.freemytv.RemoteKeyService"
            android:process=":keys"
            android:exported="true"
            android:label="dumbtv home (variant)"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/remote_key_service" />
        </service>

        <provider
            android:name="io.freemytv.PhotoInbox"
            android:authorities="tv.dumbtv.variant.photos"
            android:exported="true" />

        <service
            android:name="io.freemytv.SleepOverlay"
            android:process=":sleep"
            android:exported="false" />

        <service
            android:name="io.freemytv.NowPlaying"
            android:exported="true"
            android:label="dumbtv home (variant)"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>

        <receiver
            android:name="io.freemytv.HomeReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>
```

The manifest's provider authority is `tv.dumbtv.variant.photos`, and `variant/tools/photos.py`
must speak to the variant — not just with our authority, but with our package: it also names
the app's data directory and lists the installed packages, and the variant installs as
`tv.dumbtv.variant`, not `io.freemytv`. Point the whole tool at the variant:

```bash
cd /Users/zaco/Projects/Personal/dumbtv
sed -i '' 's#io\.freemytv#tv.dumbtv.variant#g' variant/tools/photos.py
grep -n "tv.dumbtv.variant" variant/tools/photos.py
```

Expected: every `io.freemytv` in the tool is now `tv.dumbtv.variant`, and the photo
authority `content://tv.dumbtv.variant.photos` still matches the manifest.

- [ ] **Step 3: Write `variant/build.sh`**

```bash
#!/usr/bin/env bash
# Builds variant/build/variant.apk from the vendored free-my-tv app: no Gradle, no libraries.
# Needs an Android SDK with platforms;android-34 and build-tools 34+. The JDK it builds
# with is found by the script itself: a JDK 17, which builds cleanly.
#   ./build.sh            with variant/config.properties (your TMDB key, your city)
#   ./build.sh --generic  without one, as a CI build: no key, the TV's time zone gives the city
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

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
[ -x "$BT/aapt2" ] || { echo "no aapt2 in $BT - sdkmanager \"build-tools;34.0.0\""; exit 1; }
echo "build-tools: $(basename "$BT")"

# --- JDK: one that works, and not one that breaks d8.
# A javac that exists is not a javac that works: macOS ships /usr/bin/javac, a stub that
# fails with "Unable to locate a Java Runtime that supports javac". So the javac is asked
# to run, not merely to exist. A stub that hangs (it does, when JAVA_HOME points at
# something odd) is no better than one that fails: the probe waits five seconds, then
# gives up on it.
# The scheme is launcher/build.sh's: the JDK 17 paths, then macOS's java_home, then a
# warning when the JDK in use is 21 or newer.
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
```

```bash
chmod +x variant/build.sh
```

- [ ] **Step 4: Write `variant/check-apk.sh`**

```bash
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
[ -x "$BT/aapt2" ] || { echo "no aapt2 in $BT - sdkmanager \"build-tools;34.0.0\""; exit 1; }
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
```

```bash
chmod +x variant/check-apk.sh
```

- [ ] **Step 5: Ignore the variant's build output, key and config**

Add to `.gitignore`:

```
variant/build/
variant/*.keystore
variant/config.properties
```

- [ ] **Step 6: Install the SDK platform the build needs**

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "platforms;android-34"
```

Expected: `done`.

- [ ] **Step 7: Build the variant**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
./variant/build.sh --generic
```

Expected: `using JDK 17 at <path>`, then `built build/variant.apk  <n> bytes`, with `n` around
2 MB. The script finds a JDK 17 by itself; `JAVA_HOME` only points it at one.

If `javac` refuses a `java.*` API that upstream's own build accepts, switch the compile line
to upstream's flags, which take `java.*` from the Android jar instead of the JDK:

```
"$JAVAC" -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$AJ:$BT/core-lambda-stubs.jar" \
  -encoding UTF-8 -classpath "$AJ" -d "$WORK/classes" @"$WORK/sources.txt"
```

- [ ] **Step 8: Check the APK**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
./variant/check-apk.sh
```

Expected: `variant APK ok: tv.dumbtv.variant, minSdk 26, targetSdk 33, 8 permissions, signed`.

- [ ] **Step 9: Prove the check fails when the APK is not what we expect**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
cp variant/permissions.txt /tmp/permissions.txt.bak
printf 'android.permission.CAMERA\n' >> variant/permissions.txt
./variant/check-apk.sh; echo "exit=$?"
cp /tmp/permissions.txt.bak variant/permissions.txt
./variant/check-apk.sh
```

Expected: the first run prints `the permissions are not upstream's eight, in upstream's order`
and `exit=1`; the second run prints the ok line again.

- [ ] **Step 10: Commit**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
git add variant/AndroidManifest.xml variant/permissions.txt variant/build.sh variant/check-apk.sh .gitignore
git commit -m "feat(variant): the manifest, the build and the APK checks

The APK gets our application id through aapt2's --rename-manifest-package,
so upstream's code and its R class stay exactly where they are. The build
uses the same toolchain as launcher/build.sh: aapt2, javac, d8, zipalign,
apksigner, no Gradle and no libraries.

check-apk.sh asserts the id, the two SDK levels, upstream's eight
permissions in upstream's order, the classes in the dex, and the signature."
```

---

### Task 4: CI

**Files:**
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Consumes: `variant/build.sh`, `variant/check-apk.sh`, `variant/verify-vendor.sh` (Tasks 1–3).
- Produces: a `variant` job that fails when the vendored tree drifts, the build breaks, or the APK stops matching what this repo expects.

- [ ] **Step 1: Add the `variant` job**

Add to `.github/workflows/validate.yml`, after the `launcher` job:

```yaml
  variant:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      # The build-tools version is pinned, so the CI build and the local build use the
      # same aapt2/d8: the newest one in the image changes when GitHub updates it.
      BUILD_TOOLS: "34.0.0"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: sdk
        run: yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "platforms;android-34" "build-tools;34.0.0" >/dev/null
      - name: the vendored tree is upstream's
        run: ./variant/verify-vendor.sh
      - name: "build (generic: no TMDB key is ever baked by CI)"
        run: ./variant/build.sh --generic
      - name: the apk is what this repo expects
        run: ./variant/check-apk.sh
```

- [ ] **Step 2: Include the variant's scripts in the syntax check**

In the `scripts` job, change:

```yaml
      - name: syntax
        run: for f in scripts/*.sh launcher/*.sh; do bash -n "$f" || exit 1; done
```

to:

```yaml
      - name: syntax
        run: for f in scripts/*.sh launcher/*.sh variant/*.sh; do bash -n "$f" || exit 1; done
```

- [ ] **Step 2b: Widen the secret scan to the files this branch adds**

The `scripts` job greps for private addresses and hardware ids, but only over `*.md`,
`*.sh`, `*.txt`, `*.yaml`, `*.yml`, `*.json` and `*.py`. This branch adds a tracked
`variant/AndroidManifest.xml` and a tracked `variant/config.example.properties`, and
neither extension is scanned — so add both:

```yaml
               --include='*.xml' --include='*.properties' .
```

And add a check for the TMDB key itself, which nothing scanned for:

```yaml
      - name: no TMDB key in anything committed
        run: |
          # A key with a value: the key's name, an "=" and something that is not a
          # space. The pattern is put together in two parts, so that this file does
          # not match itself. Only the file names are printed: the key itself must
          # not end up in the log either.
          # The generator's own tests and the plan that quotes them carry a deliberate
          # fake ("abc123"), so those two files are excluded; nothing else may match.
          key='tmdb_key'
          if git grep -lE "$key=[^[:space:]]" -- . \
               ':!tests/test_variant_config.py' \
               ':!docs/superpowers/plans/2026-10-26-variant-launcher-stage1.md'; then
            echo "remove the TMDB key: it belongs in variant/config.properties, not the repo"; exit 1
          fi
```

- [ ] **Step 3: Run the same checks locally**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
for f in scripts/*.sh launcher/*.sh variant/*.sh; do bash -n "$f" || exit 1; done
python3 -m unittest discover -s tests
python3 catalog/validate.py
./launcher/release-check.sh --manifest
```

Expected: no output from the syntax loop, `OK` from the unit tests, `32 files valid` from the
catalog, and a consistent manifest from `release-check.sh`.

- [ ] **Step 4: Commit**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
git add .github/workflows/validate.yml
git commit -m "ci: build and check the variant launcher

The job fails when the vendored tree drifts from upstream, when the build
breaks, or when the APK stops being what this repo expects. CI builds
--generic, so no TMDB key is ever baked."
```

---

### Task 5: On the TV

**Files:**
- Create: `variant/README.md`

**Interfaces:**
- Consumes: `variant/build/variant.apk` (Task 3), the TV's address (found by the scan in Step 1).
- Produces: the variant installed and running beside the launcher that works today, and a written procedure.

- [ ] **Step 1: Find the TV and connect**

The TV's address moves when the cable moves. Find it and set `ADB_SERIAL`:

```bash
export PATH="$HOME/Downloads/platform-tools:$PATH"
for i in 4 5 6 7; do for j in $(seq 1 254); do echo "192.168.$i.$j"; done; done \
  | xargs -P 64 -n 1 sh -c 'nc -z -w 1 -G 1 "$0" 5555 2>/dev/null && echo "ADB-OPEN $0"'
export ADB_SERIAL=<the address the scan printed>:5555
adb connect "$ADB_SERIAL"
adb devices
```

Expected: the device listed as `device`.

- [ ] **Step 2: Record what is on the TV before touching it**

```bash
adb shell dumpsys package tv.dumbtv.home | grep -E "versionName|versionCode" | head -3
adb shell settings get secure enabled_accessibility_services
adb shell settings get system screen_off_timeout
adb shell cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.HOME \
  | grep -E "packageName=" | sort -u
adb shell dumpsys window | grep -i "mCurrentFocus"
```

Expected on the Ember 55: `versionName=1.5`, the Guard bound, `300000`, the HOME
candidates `com.amazon.tv.launcher`, `com.amazon.firehomestarter`, `com.amazon.servicemenu`,
`com.amazon.tv.settings.v2` and `tv.dumbtv.home` — and `tv.dumbtv.home/tv.dumbtv.home.Home`
in front. Write these down: the checks in Step 6 compare against them.

Two notes, both learned on the TV:

* **Do not use `resolve-activity` to ask who is HOME.** It answers
  `com.amazon.tv.launcher/.ui.HomeActivity_vNext` (`priority=950`, `isDefault=true`):
  Fire OS's own launcher wins the resolver, even though `tv.dumbtv.home` is the home
  screen in practice, because the Guard takes the HOME key rather than a HOME category.
  The candidate list is the check that matters — `tv.dumbtv.variant` must never be in it.
* **`mCurrentFocus` answers "who is in front"**, which is the thing the owner actually
  sees. That and the HOME key are what Step 6 compares.

- [ ] **Step 3: Install the variant beside it**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
adb install -r variant/build/variant.apk
adb shell pm list packages | grep dumbtv
```

Expected: both `package:tv.dumbtv.home` and `package:tv.dumbtv.variant`.

- [ ] **Step 4: Grant the two special permissions, over adb**

`SYSTEM_ALERT_WINDOW` (the sleep timer's overlay) and `REQUEST_INSTALL_PACKAGES` are
granted here, not by making the owner click through an installer's warning:

```bash
adb shell appops set tv.dumbtv.variant SYSTEM_ALERT_WINDOW allow
adb shell appops set tv.dumbtv.variant REQUEST_INSTALL_PACKAGES allow
adb shell appops set tv.dumbtv.variant SCHEDULE_EXACT_ALARM allow
adb shell appops get tv.dumbtv.variant SYSTEM_ALERT_WINDOW
```

Expected: `SYSTEM_ALERT_WINDOW: allow`.

- [ ] **Step 5: Open it and look**

```bash
adb shell am start -n tv.dumbtv.variant/io.freemytv.FireHomeActivity
sleep 6
adb logcat -d | grep -i freemytv | tail -20
```

Expected: the shelf appears, the clock is right, and the log shows no crash.

- [ ] **Step 6: Check that nothing that works today broke**

```bash
adb shell dumpsys package tv.dumbtv.home | grep -E "versionName" | head -1
adb shell settings get secure enabled_accessibility_services
adb shell settings get system screen_off_timeout
adb shell dumpsys window | grep -i "mCurrentFocus" | head -2
adb shell cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.HOME \
  | grep -E "packageName=" | sort -u
```

Expected: `1.5`, the Guard still bound, `300000`, the old launcher still the focus when
the variant is closed, and — the one that matters — `tv.dumbtv.variant` **not** among the
HOME candidates, the candidate set being the same as in Step 2. The variant declares no
HOME category, so it must not have taken the key.

Press HOME as well and check `mCurrentFocus` again: it must come back to
`tv.dumbtv.home/tv.dumbtv.home.Home`. That is the Guard doing its job, and it is what the
owner sees.

- [ ] **Step 7: Run the repo's own check on the TV**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
./scripts/verify.sh
```

Expected: every check passes.

- [ ] **Step 8: Write `variant/README.md`**

```markdown
# dumbtv home (variant)

The variant launcher: free-my-tv's app, vendored, with our application id
(`tv.dumbtv.variant`) and our own signing key. It sits beside the current dumbtv home
(`tv.dumbtv.home`) instead of replacing it, so the launcher that works today keeps working.

## Build

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cp variant/config.example.properties variant/config.properties   # add your TMDB key and city
./variant/build.sh
```

`./variant/build.sh --generic` builds without a key, as CI does.

## Install

```sh
export PATH="$HOME/Downloads/platform-tools:$PATH"
export ADB_SERIAL=<the TV>:5555
adb install -r variant/build/variant.apk
adb shell appops set tv.dumbtv.variant SYSTEM_ALERT_WINDOW allow
```

## What it is not yet

This is stage 1: the app runs and shows its content, but it does not take the HOME key, it
does not show the TV's passthrough inputs, and it does not hold the screen awake while a
picture shows. Those are ours and they come in stage 2.

See `variant/UPSTREAM.md` for the upstream commit and the licence.
```

- [ ] **Step 9: Commit**

```bash
cd /Users/zaco/Projects/Personal/dumbtv
git add variant/README.md
git commit -m "docs(variant): how to build and install the variant launcher"
```

---

## Self-review

- **Spec coverage.** §4 items 1–7 are Tasks 1–4; §5.1 the layout; §5.2 the application id
  (Task 3); §5.3 signing (Task 3); §5.4 the content hosts and the DNS filter (no task — the
  filter needs no change in stage 1; stage 3 owns `verify-allowed.txt`); §6 the CI checks
  (Task 4) and the on-TV checks (Task 5); §7 the risks; §9 the open items stay open.
- **Placeholders.** None: every step has a command, an expected result, or the full text of
  a file to write.
- **Type consistency.** `gen_config.py` writes the sixteen fields Task 3's build depends on
  and Task 2's tests assert; `check-apk.sh` reads `permissions.txt`, which lists the same
  eight permissions the manifest declares, in the same order.
- **Known gap, deliberately.** The variant's own `HomeMode` (its ADB-driven mode switch) and
  `Updates` (its self-updater) are still in the vendored tree. On Fire OS they are inert:
  `applyFree()` returns early on `AMAZON`, `mayTurnOff()` refuses every `com.amazon.*`
  package, and the updater refuses a build signed with another key. Stage 3 removes them.
- **Environment note.** The Ember 55 was unreachable (no adb port open on the local network)
  when this plan was written, so Task 5 starts by finding the TV again.
