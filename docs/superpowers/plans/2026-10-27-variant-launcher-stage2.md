# Plan — the fork becomes the one product (stage 2)

Plan: `docs/superpowers/plans/2026-10-27-variant-launcher-stage2.md`
Spec: `docs/superpowers/specs/2026-10-27-variant-launcher-stage2-design.md`
Branch: `feat/variant-launcher` (off `origin/main` 225bb00)

Base commit before Task 1: d7ad90a

Global constraints (they hold for every task):

- The vendored tree stays upstream's, byte for byte, except the paths in
  `variant/local-changes.txt` (adapted) and `variant/our-files.txt` (ours). **Our new
  code goes in the variant's tree, and those two lists grow.** `./variant/verify-vendor.sh`
  must still pass, and it fails on a file that differs without being listed.
- No Gradle, no libraries, no network in the build. Python stdlib only in the tools.
- `variant/config.properties`, `variant/release.keystore` and `variant/build/` stay
  git-ignored. The TMDB key is never printed and never committed.
- Never write `/system`, never root, never factory-reset, never disable a package in
  `never-disable.txt`, one TV at a time (`ADB_SERIAL`).
- The CI greps (private addresses, and the TMDB key) must stay clean over the tracked files.
- Every task ends with: `python3 -m unittest discover -s tests`,
  `python3 catalog/validate.py`, `bash -n` over every `scripts/*.sh launcher/*.sh
  variant/*.sh`, `./variant/verify-vendor.sh`, `./variant/check-apk.sh` after a build, and
  `./scripts/verify.sh` on the TV when the task touches the device.

## Task 1 — the Guard comes across

The fork has to own the HOME key on Fire OS, and the only way there is our Guard: an
accessibility service that waits for Amazon's home window and replaces it.

1. Port `launcher/src/tv/dumbtv/home/Guard.java` to `variant/src/io/freemytv/Guard.java`:
   same alarm-fired launch, same cover overlay, same `min_futurity=0` requirement, same
   "wait until the cover is on the window manager" rule. Change: the package, the
   activity it starts (the fork's `io.freemytv.HomeActivity`, not
   `tv.dumbtv.home/.Home`), and the app's own package name.
2. `variant/res/xml/guard.xml` — the accessibility service's configuration, from
   `launcher/res/xml/guard.xml`.
3. `variant/AndroidManifest.xml` — the service entry with `BIND_ACCESSIBILITY_SERVICE`
   and the `remote_key_service`-style `meta-data` pointing at the new xml. **This is an
   eighth documented difference from upstream's manifest**: the manifest test's `EXPECTED`
   counter and `variant/UPSTREAM.md` must both learn it, or the suite fails.
4. The class is `io.freemytv.Guard` — the vendored code stays in upstream's package, so
   no upstream file is edited; ours is a new file, listed in `variant/our-files.txt`.

Acceptance:

- `./variant/verify-vendor.sh` passes and prints `ours (not upstream's)` for the new
  files.
- `tests/test_variant_manifest.py` passes with the eighth documented difference; a new
  test asserts the guard service is declared and points at our xml.
- The built APK contains `Lio/freemytv/Guard;` in the dex, and `check-apk.sh` asserts it.
- The app installs on the Ember 55 and the fork's home still opens.

Not in this task: enabling the service on the TV (Task 2), and the input mapping
(Task 3).

## Task 2 — the install path and the checks that follow the home screen

The guard only matters once it is bound, and only one guard may be bound at a time.

1. The install path (`scripts/launcher.sh` / `launcher/install.sh`, or a
   `variant/install.sh` if that is cleaner): `set_guard` must point at
   `tv.dumbtv.variant/io.freemytv.Guard`, swap the old one out, keep every other
   accessibility service, and set `min_futurity=0` the way the launcher does now.
2. `scripts/verify.sh`: the `home` and `home-key` checks must look at the fork's id
   (`tv.dumbtv.variant`) once the fork is the home screen, and the launcher-version check
   from PR #121 must check the fork's version. The checks must be able to say which
   product they are about.
3. The rollback has to be one setting: `enabled_accessibility_services` back to
   `tv.dumbtv.home/tv.dumbtv.home.Guard` puts the working launcher in front again. That
   is the way the owner gets their TV back, so it must be written down and tested.

Acceptance:

- On the TV: the fork's guard is bound, HOME lands on `tv.dumbtv.home/...` — wait, on the
  fork's activity — the old guard is not, and `./scripts/verify.sh` passes end to end.
- The rollback was actually run on the TV and the old launcher came back; then the fork
  was bound again. Both directions are proven, not assumed.
- `bash -n` clean; the scripts job green.

## Task 3 + 4 — the inputs, and the TV staying awake while one shows

**These two are one task.** The fork opens an input by handing a passthrough URI to the
TV's own app (`Intent(ACTION_VIEW, buildChannelUriForPassthroughInput(it.inputId))` in
`HomeApps.inputIntent()`), so on this TV the picture is in Amazon's `PassthroughPlayerActivity`
— another app's window. That is why the fork has no keep-awake: there is nothing of ours
to hold the panel awake with, and BACK leaves the fork entirely. `dumbtv home` opens the
input with a `TvView` in **its own** activity, so the picture is in a window of ours, the
window can hold the panel awake, and BACK comes back home.

So: port `launcher/src/tv/dumbtv/home/Input.java` into the fork, and the device-id mapping
and the keep-awake come with it.

The mapping: the fork discovers the inputs and opens them, but it tunes the port (`HW2`)
where the tile is named after the device (`Apple TV`). `dumbtv home` tunes
`com.mediatek.tis/.HdmiInputService/HDMI100004`, the CEC child input, which is what that
tile is on this TV.

1. Find out exactly how the fork opens an input (`HomeApps`/`HomeView`) and where the
   id it tunes comes from.
2. Port the mapping: the device input (`HDMI100004`) rather than the port, and the "hand
   over to the TV's own app" rule, including the case where Amazon's Live TV claims the
   passthrough URI and would redirect to a channel scan instead of showing the picture.
   The launcher had three ways to answer that question behind a setting; the fork has no
   such setting and takes the "hand over to a single television app, but not to Live TV"
   one.
3. Keep-awake: `FLAG_KEEP_SCREEN_ON` on the window that shows the picture, and only while
   there is a picture — an input on a dead port still sleeps.

Acceptance, measured on the TV:

- The logcat line names `HDMI100004` for the Apple TV tile, and the picture appears.
- The other ports still work, and the maker-specific paths (Allwinner, Xiaomi) still go
  through upstream's own player.
- The sleep test: 30 s timeout, 70 s later still awake, no sleep events, and a negative
  control that does sleep. `mWakefulness` and `Display Power` are the signals —
  `mUserActivityTimeoutOverrideFromWindowManager` stays -1 on this build even when a
  window legitimately holds the screen.
- BACK from the input returns to the fork's home screen.
- The change is a diff against upstream's input logic, in the variant's tree, listed in
  `our-files.txt` or `local-changes.txt` as the lists require.

## Task 5 — one product in the repo

`launcher/` stops being a second product. The fork is the home screen; the old launcher
stays on the TV as a fallback but the repo stops shipping it.

1. `launcher/`'s build, release check, version file and CI job fold into the variant's
   equivalents, or go. The variant's version becomes the thing the release check looks at.
2. `AGENTS.md` and `CONTRIBUTING.md` describe one home screen, not two, and the
   interview's question 3 stays true.
3. The catalog and `scripts/verify.sh` agree about what the home screen is.
4. PR #121's launcher-version check keeps working for the launcher that is still on the
   TV, or moves to the fork cleanly.

Acceptance: the CI jobs are green, the docs name one product, and the repo has one
home-screen build path.

## Task 6 — the kids face (the next stage, not this one)

Port from `suboss87/my-kids-tv`: the parent PIN, the three-band catalog (CC BY 4.0, with
attribution in `variant/UPSTREAM.md`), the one-title hero, `SpaceSky`, the greeting, the
sleep timer, the app hiding. "Rework the look later": the port keeps my-kids-tv's
behaviour, our own visual language comes after it works on the TV.

**The shape is decided (2026-10-27, the owner):** HOME keeps showing the **normal** face —
upstream's TMDB picks. The **kids face is a PIN-locked mode** entered from it, and the PIN
is what a child cannot get past to leave it. So:

- the normal face stays the home screen, and the two faces coexist on it;
- the parent PIN does two jobs: it locks the kids mode, and it gates the settings (as it
  does in my-kids-tv);
- the age band is the parent's choice, made in the settings behind the PIN, out of the
  three the catalog has (4-6, 7-10, 11-13);
- the app hiding applies in the kids mode, so a child in it cannot reach the adult apps.

The PIN keypad is my-kids-tv's own: digits where the remote has them, arrows and OK
everywhere. Five wrong tries wait 30 seconds, and the wait is kept in the prefs, so
closing and reopening the settings does not reset it.

## Order

1 → 2 → (3, 4 together) → 6 → 5.

Task 5 (one product in the repo) is now **last**, not before the kids face. Two reasons:
the repo only says "one product" once the fork has proven it owns the home screen on the
TV, and the kids face is what the owner is waiting to see — retiring the launcher changes
nothing a person can see, and doing it before the product is finished risks retiring the
fallback too early.

Tasks 3 and 4 are one task: the fork opens an input by handing a passthrough URI to the
TV's own app, so the picture is in another app's window and there is nothing of ours to
hold the panel awake with. Our launcher opens it with a `TvView` in its own activity,
which is both the right input id and a window we own. One port, both outcomes.

## What the kids project turned out to be

`suboss87/my-kids-tv` is **a fork of the same upstream we vendored** — it credits
[simbasjungles/free-my-tv](https://github.com/simbasjungles/free-my-tv) and carries the same
class names under the package `io.mykidstv`. So the port is a **diff against our exact
base**, not a rewrite: two new files (`ParentLock.java` for the PIN, `SpaceSky.java`) and
23 shared files changed, the big ones being `HomeView.java` (1125 lines changed),
`Recs.java` (538), `SettingsActivity.java` (500), `HomeData.java` (216), `Prefs.java` (188)
and `HomeMode.java` (176).

Its catalog is an open dataset under **CC BY 4.0** with the attribution "My Kids TV":
931 title rows over three bands (4-6: 106, 7-10: 372, 11-13: 453), each judged for that
age with a badge and four scores (age fit, value, must-watch, fun). The attribution goes
in `variant/UPSTREAM.md`. Note that the kids project **dropped** upstream's `NowPlaying`
and `Updates` — the same control plane this fork is keeping inert until the stage that
strips it.
