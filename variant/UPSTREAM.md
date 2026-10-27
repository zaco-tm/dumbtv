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
- Not vendored: upstream's `web/`, `webos/`, `tizen/`, `docs/`, website and macOS app
- Not vendored: `build.sh` — it builds upstream's APK from upstream's checkout,
  generating `Config.java` out of `config.properties`; we generate that class ourselves.
- Not vendored: `config.example.properties` — upstream's settings template; ours is
  `variant/config.properties` (git-ignored, it holds the TMDB key).
- The app's code keeps upstream's `io.freemytv` package. The application id is ours:
  `aapt2 link --rename-manifest-package tv.dumbtv.variant` renames the manifest at link
  time, so the generated `R` stays in `io.freemytv` and no upstream file is edited.

## Local changes

`local-changes.txt` lists the two adapted tools: they are the only files that differ
from upstream. `verify-vendor.sh` proves every other vendored byte is upstream's, and
it fails on a file that differs without being listed as well as on a listed file that
no longer differs.

## The proof

`./variant/verify-vendor.sh` downloads upstream's archive for the pinned commit, checks
its sha256 (`ae5337a626a94c19591ac1a7c1285bedefeb876fd5d6568b4edb0840d59e2dc3`,
recorded on 2026-10-26), unpacks it and compares every vendored file with ours: `src`,
`res`, `assets`, `tools` and `LICENSE.free-my-tv`. Set
`DUMBTV_VARIANT_TARBALL=/path/to/up.tar.gz` to compare against a copy of the archive
instead of downloading it; the hash is still checked, so it works offline.

One deviation from the script in the task brief: the two `find` scans exclude
`.DS_Store`, which macOS drops into any directory it visits. It is not upstream's, it
is git-ignored, and without the exclusion the proof would fail on a Mac for no reason.

## Third-party material inside the app

- Inter (font, `assets/fonts/`) — SIL Open Font License 1.1
- Material Symbols (the `assets/symbols/` PNGs) — Apache 2.0
- The 26 `assets/i18n/*.json` catalogues are upstream's own translations.
