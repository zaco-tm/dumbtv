# Vendored upstream

The Android app in `variant/` is free-my-tv, vendored verbatim.

- Upstream: <https://github.com/simbasjungles/free-my-tv>
- Commit: `f1830445e6e629a2f1eab19602afef38a1a4f8b8` (2026-10-26)
- Licence: MIT — the text is in `LICENSE.free-my-tv` (upstream's `LICENSE`, renamed)
- Vendored from: `app/src`, `app/res`, `app/assets`, plus two of upstream's `tools/`
  scripts, upstream's licence and upstream's `app/AndroidManifest.xml` (kept byte for byte
  at `upstream/AndroidManifest.xml`, as the record of what our own manifest was made from)
- Tools adapted:
  - `tools/photos.py` — names our application id throughout: the package it checks
    (`pm list packages tv.dumbtv.variant`), the app's own data folder
    (`/sdcard/Android/data/tv.dumbtv.variant/files/photos`) and the provider authority
    it writes to (`content://tv.dumbtv.variant.photos`). Upstream's package,
    `io.freemytv`, is gone from the file.
  - `tools/translate.py` — upstream's paths (`app/src`, `app/assets/i18n`, `web/`) point
    at upstream's checkout. Here they point at `src/` and `assets/i18n/`, and `web/` is
    optional: upstream's website is not vendored, so when the directory is absent its
    strings are skipped instead of crashing the tool.
    **Its write modes break the proof.** `--check` only reads and is safe here; the
    plain run rewrites `assets/i18n/en.json`, and `--prune` and `--new` change the
    catalogues, so the vendored tree stops being upstream's byte for byte. Run those on
    a copy of the tree, never on `variant/` itself. `--check` also exits non-zero out
    of the box: upstream's own catalogues carry eight keys the code no longer uses
    (`About this TV`, `Back closes.`, `Couldn't open TV Settings`, `Firmware`,
    `IP address`, `Model`, `System`, `Time zone`), and it reports them as obsolete in
    every language. That is upstream's state, not a fault of ours.
- Not vendored: upstream's `web/`, `webos/`, `tizen/`, `docs/`, website and macOS app
- Not vendored: `build.sh` — it builds upstream's APK from upstream's checkout,
  generating `Config.java` out of `config.properties`; we generate that class ourselves.
- Not vendored: `config.example.properties` — upstream's settings template; ours is
  `variant/config.properties` (git-ignored, it holds the TMDB key).
- Not vendored: upstream's root files, which are about upstream's own repository:
  - `README.md` — upstream's readme describes upstream's releases and TVs; ours is
    the repo's own readme.
  - `AGENTS.md`, `CLAUDE.md` — instructions for agents working on upstream's checkout;
    ours are this repo's.
  - `.github/` — upstream's CI, issue templates and funding config.
  - `.gitignore`, `.gitattributes` — upstream's git settings; ours are this repo's.
- The app's code keeps upstream's `io.freemytv` package. The application id is ours:
  `aapt2 link --rename-manifest-package tv.dumbtv.variant` renames the manifest at link
  time, so the generated `R` stays in `io.freemytv` and no upstream file is edited.

## The manifest

Upstream's `app/AndroidManifest.xml` is vendored byte for byte at
`variant/upstream/AndroidManifest.xml`, and the verifier compares it with upstream's, like
the other vendored files. It is the record of what our own `variant/AndroidManifest.xml`
was made from: without it, the prose below would be the only record of upstream's
manifest, and prose does not fail a build.

Our manifest is upstream's with eight changes, and nothing else that matters:

1. **The label** — `Free My TV` → `dumbtv home (variant)`, on the application and on every
   component that carries a label. The TV shows our name, not upstream's.
2. **The version** — `versionCode 3`, `versionName 1.2` → `versionCode 1`, `versionName 1.0`.
   Ours is a different app with its own key; upstream's numbers say nothing about ours.
3. **The provider authority** — `io.freemytv.photos` → `tv.dumbtv.variant.photos`. An
   authority belongs to the app that is installed, and ours is `tv.dumbtv.variant`.
   `tools/photos.py` writes to the same one.
4. **The task affinity, twice** — `io.freemytv.settings` → `tv.dumbtv.variant.settings`, on
   `SettingsActivity` and on `FireHomeActivity`. An affinity is a package name as well, and
   ours has to be ours, or the task lands in upstream's package.
5. **The fully-qualified component names** — `.App`, `.SettingsActivity`, `.HomeActivity`,
   `.FireHomeActivity`, `.Screensaver`, `.ScreensaverAlone`, `.ModeJob`, `.RemoteKeyService`,
   `.PhotoInbox`, `.SleepOverlay`, `.NowPlaying`, `.HomeReceiver` → `io.freemytv.App` and so
   on. Upstream's names are relative to the manifest's package, and `aapt2 link
   --rename-manifest-package` makes that `tv.dumbtv.variant`, where our classes are not.
   Written out in full, every component stays in `io.freemytv`, where the code is.
6. **The HOME category** — upstream's `HomeActivity` declares `android.intent.category.HOME`
   and `android.intent.category.DEFAULT` in its intent filter. We drop both. On this Fire OS
   the home screen is ours — not through `set-home-activity` (Android caps a
   third-party launcher's HOME priority to 0), but through our Guard, an accessibility
   service. A HOME category would make the variant a home-app candidate as well: if
   the system ever offers a chooser and the owner accepts it, the Guard stops
   being HOME. The activity stays, exported and startable, and the app is still in the
   launcher through `SettingsActivity`'s LEANBACK_LAUNCHER and LAUNCHER filters. The
   Guard gives the variant the HOME key, and it does not need the category.
7. **The banner** — `@drawable/banner` → `@drawable/banner_variant`. Upstream's banner is a
   picture with the words *Free My TV* in it, and the launcher draws the banner as the app's
   tile: the variant's tile in `dumbtv home`'s APPS row said "Free My TV", not our name. Ours
   is the same TV mark as `launcher/res/drawable/banner.xml`, in the launcher's own colours,
   with our wordmark. The picture is ours, so it is listed in `our-files.txt`, and the design
   is kept as an SVG next to it in `variant/artwork/` so the PNG can be re-made and looked at
   in a review.
8. **The Guard** — upstream declares no accessibility service for the home screen; we declare
   `io.freemytv.Guard`, ours. Fire OS gives the HOME key to Amazon's protected launcher and
   lets no third-party app be the home app, so the only way to own HOME there is a Guard: an
   accessibility service that waits for Amazon's home window and covers it with ours. It is the
   port of `tv.dumbtv.home`'s Guard (`launcher/src/tv/dumbtv/home/Guard.java`) — the same
   alarm-fired launch, the same cover, the same rules — and it is a new file of ours, listed in
   `our-files.txt`. Its configuration is `res/xml/guard.xml`, with its two strings in
   `res/values/guard.xml`. It is declared `android:exported="true"` behind
   `android.permission.BIND_ACCESSIBILITY_SERVICE`, like upstream's own `RemoteKeyService`:
   this APK targets 33, and Android 12 refuses to install a component with an intent filter
   and no explicit `android:exported`.

Upstream's comments are trimmed: they describe upstream's own screens and its own names.

`tests/test_variant_manifest.py` parses both manifests and asserts that the differences
between them are exactly these eight, and names any difference that is not one of them. A
manifest that drifted away from upstream's — a permission added, an attribute dropped —
fails the test suite rather than the reviewer.

## Re-syncing upstream

Upstream ships daily, so a re-sync is a deliberate piece of work and not an accident. It
means, in this order:

1. Pick the commit: the one upstream's `main` is on, or a commit you choose
   (`git ls-remote https://github.com/simbasjungles/free-my-tv HEAD`).
2. Download that commit's archive and note its hash:
   `curl -fsSL https://github.com/simbasjungles/free-my-tv/archive/<commit>.tar.gz -o up.tar.gz`
   then `shasum -a 256 up.tar.gz`.
3. Update the pin in `variant/verify-vendor.sh`: `COMMIT=` and `SHA256=`.
4. Replace the vendored tree from the new archive, byte for byte: `src/`, `res/`,
   `assets/`, the two tools, `LICENSE.free-my-tv` and `upstream/AndroidManifest.xml`.
5. Re-apply our two adapted tools (the paths in `variant/local-changes.txt`) and our own
   files (the paths in `variant/our-files.txt`); adapt them again if upstream changed them.
   Step 4 replaces `res/` wholesale, so our banner goes with it: re-make it from
   `variant/artwork/banner_variant.svg` (the command is in `variant/README.md`).
6. Update the version in `variant/AndroidManifest.xml` (`versionCode`, `versionName`), so the
   new build is a different one on the TV than the old.
7. Update `variant/local-changes.txt` and `variant/our-files.txt` if upstream's paths moved.
8. Update `variant/UPSTREAM.md`: the commit, the date, the hash — and the list of manifest
   changes above, if upstream's manifest changed. The test compares both manifests, so a
   new upstream attribute has to be looked at and either accepted or documented.
9. Run the proof and the tests: `./variant/verify-vendor.sh`,
   `python3 -m unittest discover -s tests`, and `./variant/check-apk.sh` after a build.

## Local changes

`local-changes.txt` lists the two adapted tools: they are the only files that differ
from upstream. `verify-vendor.sh` proves every other vendored byte is upstream's, and
it fails on a file that differs without being listed as well as on a listed file that
no longer differs.

`our-files.txt` lists the paths in the vendored tree that are ours, not upstream's
(`tools/gen_config.py`, `res/drawable-nodpi/banner_variant.png`, `src/io/freemytv/Guard.java`,
`res/xml/guard.xml` and `res/values/guard.xml`): upstream has no such files, so there is
nothing to compare them with and the verifier does not call them extra. It is not a loophole —
a path upstream does have cannot be excused this way, and the verifier says so if one is.

## The proof

`./variant/verify-vendor.sh` downloads upstream's archive for the pinned commit, checks
its sha256 (`ae5337a626a94c19591ac1a7c1285bedefeb876fd5d6568b4edb0840d59e2dc3`,
recorded on 2026-10-26), unpacks it and compares every vendored file with ours: `src`,
`res`, `assets`, `tools`, `LICENSE.free-my-tv` and `upstream/AndroidManifest.xml`. Set
`DUMBTV_VARIANT_TARBALL=/path/to/up.tar.gz` to compare against a copy of the archive
instead of downloading it; the hash is still checked, so it works offline.

One deviation from the script in the task brief: the two `find` scans exclude
`.DS_Store`, which macOS drops into any directory it visits, and
`tools/.i18n-cache.json`, which `tools/translate.py` writes next to itself. Neither is
upstream's, both are git-ignored, and without the exclusion the proof would fail for no
reason.

## Third-party material

- Inter (font, `assets/fonts/`) — SIL Open Font License 1.1
- Material Symbols (the `assets/symbols/` PNGs) — Apache 2.0
- cryptocurrency-icons (the coin logos, `res/drawable/coin_btc.xml`, `coin_eth.xml`,
  `coin_sol.xml`, `coin_usdt.xml`) — CC0 1.0
- Simple Icons — CC0 1.0 — upstream's Samsung app logos, in upstream's `web/icons/`.
  That app is not vendored here, so no Simple Icons file is in this tree.
- The 26 `assets/i18n/*.json` catalogues are upstream's own translations.
