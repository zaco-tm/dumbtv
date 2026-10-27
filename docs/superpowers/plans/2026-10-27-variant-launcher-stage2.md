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

## Task 3 — the input mapping

The fork discovers the inputs and opens them, but it tunes the port (`HW2`) where the
tile is named after the device (`Apple TV`). `dumbtv home` tunes
`com.mediatek.tis/.HdmiInputService/HDMI100004`, the CEC child input, which is what that
tile is on this TV.

1. Find out exactly how the fork opens an input (`HomeApps`/`HomeView`) and where the
   id it tunes comes from.
2. Port the mapping from `launcher/src/tv/dumbtv/home/Input.java`: the device input
   (`HDMI100004`) rather than the port, and the "hand over to the TV's own app" rule,
   including the case where Amazon's Live TV claims the passthrough URI and would
   redirect to a channel scan instead of showing the picture.
3. Measure on the TV: the tile is named "Apple TV", the log says the input tuned is
   `HDMI100004`, and the picture appears.

Acceptance:

- The logcat line names `HDMI100004` for the Apple TV tile.
- The picture appears, and the other ports still work.
- The change is a diff against upstream's input logic, in the variant's tree, listed in
  `our-files.txt` or `local-changes.txt` as the lists require.

## Task 4 — keep-awake

An HDMI input shows a raw picture with no media session, so nothing resets the idle
timer: the panel goes off at the screen-off timeout and the TV sleeps "to save energy"
while something is plainly playing. `dumbtv home` holds the panel awake
(`FLAG_KEEP_SCREEN_ON` on the window that shows the picture) — proven on this TV with a
30 s timeout: 70 s later still awake, no sleep events, and a negative control that did
sleep.

The fork has no keep-awake at all, and with a passthrough input the picture is a hardware
layer that no window of ours holds, so this is not a copy — it is a measurement first.

1. Measure: with the fork in front and an HDMI input up, what holds the panel awake on
   this TV? (`dumpsys power`, `mHoldScreenWindow`, `mUserActivityTimeoutOverrideFromWindowManager`.)
   Note that `mUserActivityTimeoutOverrideFromWindowManager` stays -1 on this build even
   when a window legitimately holds the screen, so judge by `mWakefulness` and
   `Display Power`, not by that field.
2. Implement what the measurement says.
3. Prove it: 30 s timeout, 70 s later, still awake, no sleep events; and a negative
   control that does sleep.

Acceptance: the sleep test is run on the TV and both directions are recorded.

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

Still open when this stage starts: whether the kids face is the only face, or a PIN-locked
mode beside the normal one. The owner chose "normal face now, kids face later", so that
question is asked at the start of this stage, not now.

## Order

1 → 2 → (3, 4 in parallel) → 5 → 6. Task 5 is last: the repo only says "one product"
once the fork has proven it owns the home screen on the TV.
