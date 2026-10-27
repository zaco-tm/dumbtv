# Vendored upstream

The Android app in `variant/` is free-my-tv, vendored verbatim.

- Upstream: <https://github.com/simbasjungles/free-my-tv>
- Commit: `f1830445e6e629a2f1eab19602afef38a1a4f8b8` (2026-10-26)
- Licence: MIT — the text is in `LICENSE.free-my-tv`
- Vendored from: `app/src`, `app/res`, `app/assets`
- Tools adapted: `tools/translate.py`, `tools/photos.py` (the photo tool now writes to
  `content://tv.dumbtv.variant.photos`, our provider authority)
- Not vendored: upstream's `web/`, `webos/`, `tizen/`, `docs/`, website and macOS app
- The app's code keeps upstream's `io.freemytv` package. The application id is ours:
  `aapt2 link --rename-manifest-package tv.dumbtv.variant` renames the manifest at link
  time, so the generated `R` stays in `io.freemytv` and no upstream file is edited.

## Local changes

None. `local-changes.txt` is empty, and `verify-vendor.sh` proves every vendored byte
is upstream's.

## Third-party material inside the app

- Inter (font, `assets/fonts/`) — SIL Open Font License 1.1
- Material Symbols (the `assets/symbols/` PNGs) — Apache 2.0
- The 26 `assets/i18n/*.json` catalogues are upstream's own translations.
