# Design — stage 1: the dumbtv variant launcher

**Date:** 2026-10-26
**Status:** draft for review
**Branch:** `feat/variant-launcher` (off `origin/main`)
**Upstream vendored:** `simbasjungles/free-my-tv` @ `f1830445e6e629a2f1eab19602afef38a1a4f8b8` (2026-10-26)

---

## 1. Summary

Stage 1 vendors the free-my-tv Android app into this repo as a **new, parallel launcher**
(`variant/`) and gets it building, installing and running on the Ember 55 **without touching
anything that works today**. It carries free-my-tv's look and content layer; it does not yet
take the HOME key, does not yet show passthrough inputs, and does not yet hold the screen awake.

Those three things are ours and they arrive in stage 2. Stage 1 exists so that the hard part
of the fork — a working, installable, signed app in this repo's build system — is proven
before anything about the live TV depends on it.

## 2. Why this exists

The Fire TV sleep bug was fixed by upstream's launcher 1.3+ (`4b00014`), and the PR
[#121](https://github.com/humblemuzzu/dumbtv/pull/121) closes the gap where a TV is left on
the last buggy release. But dumbtv's launcher is deliberately minimal: 2,916 lines of plain
Java, one job (apps + passthrough inputs, and nothing else), 54 KB, no permissions.

The owner wants the launcher to reach free-my-tv's feature parity — the shelf, trending
picks, weather, crypto, day/night by real sunset, screensaver, now-playing, sleep timer, own
photos, 28 languages — and to add elements of my-kids-tv (parent PIN, age-banded curated
catalog, one-title hero, night sky).

Both upstream projects **refuse to be a home screen on Fire OS**, and neither knows what a
passthrough input is. That part stays ours, and it is the part that makes the TV a TV.

## 3. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Base is **free-my-tv**, not my-kids-tv | It is the parity target and the more mature code (a week old, 4.9k stars, 798 forks). my-kids-tv is 2 days old with 2 stars; its value is ~5 self-contained files, which are cheap to port. |
| D2 | The vendored code keeps its **`io.freemytv` package verbatim** | The diff against upstream stays clean and re-syncing is trivial. Only the *application id* differs. |
| D3 | The fork is **our own variant**; nothing is contributed to `humblemuzzu/dumbtv` | The owner runs a separate distribution. Upstream's launcher and releases are untouched. |
| D4 | **minSdk 26**, as upstream ships | Fire OS 5/6 sets (`aftmm`, `aftr`, `aftn`) keep launcher 1.5, which is the last build supporting API 25. |
| D5 | The variant gets **its own application id** and its own signing key | Upstream's 1.5 on the TV is signed with upstream's release key (`cfbd0152`); a locally signed APK cannot replace it (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). A separate id also means both apps can coexist. |
| D6 | Stage 1 is **additive** — `variant/` appears next to `launcher/` | Nothing that works today breaks, and the diff is reviewable as an addition rather than a replacement. |
| D7 | The app's own ADB control plane stays **inert** for stages 1–2, removed in stage 3 | free-my-tv's `applyFree()` bails out on `AMAZON` and `mayTurnOff()` refuses every `com.amazon.*` package, so on Fire OS it cannot disable Amazon's launcher. It only becomes a conflict once our Guard is wired in. |

## 4. Scope

### In

1. Vendor free-my-tv's Android app into `variant/`:
   - `variant/src/io/freemytv/*.java` — 37 files, verbatim, upstream `io.freemytv` package
   - `variant/assets/**` — Inter variable font, ~30 symbol PNGs, 28 `i18n/*.json` catalogues, `zones.json`
   - `variant/res/**` — merged with nothing; this is a separate app, so no resource collisions
   - `variant/tools/` — `translate.py`, `photos.py`, `make_art.py`, `make_symbols.py`, `make_zones.py`, `check.sh`
2. A `variant/build.sh` derived from upstream's, adapted to this repo:
   - `config.properties` → generated `io.freemytv.Config` (TMDB key, city, lat/lon, region, currency, toggles)
   - `--generic` builds with no key, as upstream's release APK
   - `minSdk 26`, `targetSdk 33` (upstream's values)
   - assets packed with `-A`, fonts stored uncompressed
   - signed with `variant/release.keystore`, created on demand, **never committed**
3. A `variant/AndroidManifest.xml` with the variant's application id, upstream's components, and
   upstream's permission set unchanged (see §5.4 — it is eight, not one).
4. A `variant/config.example.properties` committed; `variant/config.properties` git-ignored.
5. CI: a new job that builds the variant `--generic` and asserts the permission set, the
   signature, and that the expected classes are in the APK.
6. `variant/UPSTREAM.md` and a root `NOTICE` recording provenance: upstream commit, MIT text,
   Inter (OFL), Material Symbols (Apache 2.0).
7. A **real** `variant/config.properties` for the owner's own build: the TMDB API key, the
   city and its coordinates, the region and currency. The file is git-ignored; CI still
   builds `--generic`, so no key is ever committed or baked by CI.

### Out (later stages)

- HOME takeover, the INPUTS row, keep-awake — **stage 2**
- Stripping free-my-tv's control plane, the contract/CI/docs rewrite, attribution finalisation,
  `verify.sh` for the variant, the release flow — **stage 3**
- The my-kids-tv kids face (parent PIN, age bands, curated catalog, hero, night sky) — **stage 4**
- In-app rebranding of upstream's 28 language catalogues — **stage 3** (stage 1 changes only the
  Android app label)

## 5. Architecture

### 5.1 Layout

```
variant/
  AndroidManifest.xml        application id tv.dumbtv.variant (provisional)
  build.sh                   aapt2 -> javac -> d8 -> zipalign -> apksigner, no Gradle
  config.example.properties  committed
  config.properties          git-ignored, holds the TMDB key
  release.keystore           git-ignored, created on demand
  src/io/freemytv/*.java     37 upstream files, verbatim
  res/**                     upstream resources
  assets/**                  upstream assets
  tools/**                   upstream python tools
  UPSTREAM.md                provenance, upstream commit, what we changed
```

`launcher/` is untouched in stage 1. Stage 3 renames `variant/` to `launcher/` and retires the
old tree, at which point `launcher.sh` and `verify.sh` point at the variant.

### 5.2 The application id

Stage 1 uses **`tv.dumbtv.variant`** and the label *dumbtv home (variant)* so the two home
screens are distinguishable on the TV. Both the id and the label are one-line changes; the
final pair is decided in stage 3 when the first release is cut. The upstream id
`tv.dumbtv.home` is never used by the variant, so the two apps can be installed side by side
and neither can replace the other.

### 5.3 Signing

`variant/release.keystore` is created by `variant/build.sh` on first use, exactly like
`launcher/build.sh` does today, and is git-ignored. Updates to the variant must be signed with
the same key, so the key is kept, not regenerated. Upstream's release key is not used and not
needed: the variant is signed by us, for us.

### 5.4 Content and privacy

The variant ships **upstream's eight permissions unchanged** in stage 1. Removing one would
break a feature inside upstream's code, and stage 1 is the stage that proves the app runs;
the trim is stage 3's job.

| Permission | Why upstream needs it | Stage 3 |
|---|---|---|
| `INTERNET` | TMDB, Open-Meteo, Binance | **stays** |
| `ACCESS_NETWORK_STATE` | "No connection" on the card | **stays** |
| `RECEIVE_BOOT_COMPLETED` | boot check and the update job | goes with the control plane |
| `SYSTEM_ALERT_WINDOW` | the sleep timer's minutes-left overlay, over any app | goes with the sleep overlay, or is granted explicitly |
| `FOREGROUND_SERVICE` | the sleep timer's overlay service | goes with the sleep overlay |
| `SCHEDULE_EXACT_ALARM` (maxSdk 32) / `USE_EXACT_ALARM` | the sleep timer's exact wake-up | goes with the sleep timer |
| `REQUEST_INSTALL_PACKAGES` | the in-app self-updater | goes with `Updates` |

Two of these are *special* permissions: the TV's installer warns about
`REQUEST_INSTALL_PACKAGES`, and `SYSTEM_ALERT_WINDOW` needs a grant. Stage 1 grants them
over adb (`appops set tv.dumbtv.variant SYSTEM_ALERT_WINDOW allow`) instead of asking the
owner to click through an installer warning — and stage 3 removes both.

The variant talks to:

- `api.themoviedb.org` — trending picks, title metadata, images
- `api.open-meteo.com` — weather and sunrise/sunset
- `api.binance.com` — crypto prices (can be switched off in `config.properties`)

No accounts, no ads, no analytics, no crash reporting, no telemetry. The DNS filter is
unchanged: it blocks Amazon telemetry, not these three hosts.

The TMDB API key is baked into the APK when one is configured — that is upstream's model, and
the key is a read-only public key. `config.properties` is git-ignored and the CI build is
`--generic`, so no key is ever committed or baked by CI. The owner's own build in stage 1
carries a real key and a real city, so the first build on the TV shows real picks rather
than an empty shelf.

**The DNS filter already permits all of this.** Its blocklist is 56 hosts, every one of them
Amazon or Alexa telemetry and app-store CDN; nothing belonging to Netflix, TMDB, Open-Meteo
or Binance is blocked. The filter's `verify-allowed.txt` is a *check* list — hosts that must
keep resolving — not an enforcement list, so the content hosts work unchanged. Stage 3 adds
`api.themoviedb.org` and `api.open-meteo.com` to that check list, and `www.netflix.com` if
the owner keeps Netflix installed.

## 6. Testing

**In CI**
- `variant/build.sh --generic` succeeds on a clean checkout (JDK 17, platform android-26,
  build-tools 34).
- The built APK declares exactly upstream's eight `uses-permission` entries, no more and no
  fewer, in the order recorded in `variant/permissions.txt`.
- The APK is signed and verifies.
- The APK contains `io.freemytv.HomeActivity` and `io.freemytv.HomeView`.
- The existing checks still pass: 108 unit tests, `catalog/validate.py`, `bash -n` over every
  script, `launcher/release-check.sh --manifest`.

**On the TV (manual, on the Ember 55)**
- `adb install variant/build/variant.apk` succeeds and `tv.dumbtv.home` 1.5 stays installed,
  still HOME, still keeping the panel awake on a picture.
- The variant opens from the app row: shelf, clock, day/night theme, and the app row.
- The picks load with the owner's TMDB key; the weather card loads without one.
- The owner then installs Netflix (and any other streaming apps they want) and signs in, so
  the content layer can be judged on a shelf that actually has something to play. The
  launcher does not install, enable or sign in to anything: the apps are the owner's.
- The variant's own "Open original home" path is inert — it must not disable or switch away
  from anything (their `AMAZON` branch).
- `./scripts/verify.sh` on the TV still passes end to end.

## 7. Risks

| Risk | Handling |
|---|---|
| The vendored tree does not compile in this repo's build | Stage 1 *is* that test; upstream's own `build.sh` is the reference and is adapted, not rewritten. |
| Upstream's app pulls `POST_NOTIFICATIONS` or other runtime prompts | Those are device-SDK gated (API 33); Fire OS 8 is API 30, so they never appear. |
| The variant's app-side `HomeMode` disables something on Fire OS | `applyFree()` returns early on `AMAZON` and `mayTurnOff()` refuses every `com.amazon.*` package. Verified in upstream's source, and stage 1's on-TV check re-verifies it. |
| The variant's in-app self-updater installs something over our build | Upstream pins the release certificate (`RELEASE_CERT`), so a build signed with another key "checks only when asked and never downloads" — upstream's own words. Our variant is signed with our key, so the updater is inert by construction until stage 3 removes it. |
| The Ember 55 has almost no apps, so the shelf looks empty and the picks are not playable | Expected on the first look, and stated up front: this TV is a passthrough box for the Apple TV. The owner installs Netflix and signs in before judging the content layer, and stage 2 is where *this* TV gains. |
| Upstream keeps shipping daily, so our vendored copy drifts | Pinned to a commit in `UPSTREAM.md`; re-syncing is a deliberate later task, not an accident. |
| The variant asks for two *special* permissions on the owner's TV | `REQUEST_INSTALL_PACKAGES` makes the installer warn, and `SYSTEM_ALERT_WINDOW` needs a grant. Stage 1 grants the appops over adb instead of making the owner click through a warning, and stage 3 deletes both permissions along with the code that wanted them. |

## 8. Later stages (outline)

- **Stage 2 — Own.** Vendor our `Guard`, `Config` and the `Catalog` input discovery into the
  variant; point the Guard at the variant's home activity so it takes the HOME key; add the
  INPUTS row to the new shelf; add `FLAG_KEEP_SCREEN_ON` while a picture shows. The variant
  becomes the home screen; upstream's 1.5 stays installed but is no longer HOME.
- **Stage 3 — Clean.** Remove the app-side control plane (`HomeMode`'s mode switch, `Adb`,
  `ModeJob`, `Capabilities`, `Watchdog`, `home-state.json`, `Updates`' self-updater, and
  `RemoteKeys`); make the Mac-side scripts the only thing that changes the TV; rewrite the
  contract (AGENTS.md, CONTRIBUTING.md, README, the interview text) from "no internet access"
  to the precise promise in §5.4; relax the CI permission rule to "INTERNET only"; finalise
  the id, the label and the in-app branding; add `verify.sh` checks for the variant, and the
  content hosts to the DNS filter's `verify-allowed.txt`; set up
  the release and checksum flow.
- **Stage 4 — Extend.** Port the kids face from my-kids-tv: `ParentLock` (PIN), the bundled
  three-band catalog (CC BY 4.0), the one-title hero composition, `SpaceSky`, the calmer
  motion, and the greeting.

## 9. Open items for stage 3

- The final application id and app label.
- The fork's repository name and its relationship to `zaco-tm/dumbtv` (the current fork, which
  also holds PR #121).
- Whether the variant replaces `launcher/` in place or ships as a second product.
- PR #121's launcher-version check in `scripts/verify.sh` has to learn about the variant's
  id and version, or it will check the wrong package.
