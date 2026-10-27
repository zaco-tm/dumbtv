# Vendored upstream

The Android app in `variant/` is free-my-tv, vendored verbatim.

- Upstream: <https://github.com/simbasjungles/free-my-tv>
- Commit: `f1830445e6e629a2f1eab19602afef38a1a4f8b8` (2026-10-26)
- Licence: MIT — the text is in `LICENSE.free-my-tv` (upstream's `LICENSE`, renamed)
- Vendored from: `app/src`, `app/res`, `app/assets`, plus two of upstream's `tools/`
  scripts and upstream's licence
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
- Not vendored: upstream's `app/AndroidManifest.xml` — ours is the record of it.
  See **The manifest** below.
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

Upstream's `app/AndroidManifest.xml` is not vendored, so `variant/AndroidManifest.xml` is
the only record of it. The verifier does not compare it either: it sits outside the vendored
trees (`src`, `res`, `assets`, `tools`), and it is ours.

It is upstream's manifest with five changes, and nothing else that matters:

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

Upstream's comments are trimmed: they describe upstream's own screens and its own names.

## Local changes

`local-changes.txt` lists the two adapted tools: they are the only files that differ
from upstream. `verify-vendor.sh` proves every other vendored byte is upstream's, and
it fails on a file that differs without being listed as well as on a listed file that
no longer differs.

`our-files.txt` lists the paths in the vendored tree that are ours, not upstream's
(`tools/gen_config.py`): upstream has no such file, so there is nothing to compare it
with and the verifier does not call it extra. It is not a loophole — a path upstream
does have cannot be excused this way, and the verifier says so if one is.

## The proof

`./variant/verify-vendor.sh` downloads upstream's archive for the pinned commit, checks
its sha256 (`ae5337a626a94c19591ac1a7c1285bedefeb876fd5d6568b4edb0840d59e2dc3`,
recorded on 2026-10-26), unpacks it and compares every vendored file with ours: `src`,
`res`, `assets`, `tools` and `LICENSE.free-my-tv`. Set
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
