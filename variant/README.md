# dumbtv home (variant)

The variant launcher: free-my-tv's app, vendored, with our application id
(`tv.dumbtv.variant`) and our own signing key. It sits beside the current dumbtv home
(`tv.dumbtv.home`) instead of replacing it, so the launcher that works today keeps working.

The Java package stays `io.freemytv` — that is where upstream's code lives, and renaming it
would mean editing every vendored file. Only the application id is ours, so the two apps
install side by side and neither can replace the other. A command that names an activity
gives the application id first and the class second: `tv.dumbtv.variant/io.freemytv.SettingsActivity`.

## Build

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
cp variant/config.example.properties variant/config.properties   # add your TMDB key and city
./variant/build.sh
```

`./variant/build.sh --generic` builds without a key, as CI does.

The key goes in `variant/config.properties`, which is git-ignored. The build bakes it into
the APK, so the installed app has working picks; never copy that file anywhere.

## Install

```sh
export PATH="$HOME/Downloads/platform-tools:$PATH"
export ADB_SERIAL=<the TV>:5555
adb connect "$ADB_SERIAL"
adb devices                                # the line must end in "device"
adb install -r variant/build/variant.apk
adb shell pm list packages | grep dumbtv
```

Both `package:tv.dumbtv.home` and `package:tv.dumbtv.variant` should be listed. The variant
is installed *beside* the launcher that works today; nothing existing is replaced.

## Grant the two special permissions

```sh
adb shell appops set tv.dumbtv.variant SYSTEM_ALERT_WINDOW allow
adb shell appops set tv.dumbtv.variant REQUEST_INSTALL_PACKAGES allow
adb shell appops set tv.dumbtv.variant SCHEDULE_EXACT_ALARM allow
adb shell appops get tv.dumbtv.variant SYSTEM_ALERT_WINDOW
```

`SYSTEM_ALERT_WINDOW` is the sleep timer's overlay, and `REQUEST_INSTALL_PACKAGES` belongs
to upstream's self-updater. Both are granted over adb here rather than by making the owner
click through an installer's warning. Stage 3 removes both permissions along with the code
that wanted them.

The third line is upstream's exact-alarm permission. `SCHEDULE_EXACT_ALARM` became an
appop in Android 12, so on Fire OS 8 (Android 11) `appops` may answer
`Unknown operation: SCHEDULE_EXACT_ALARM` and change nothing — that is harmless, because
the permission is granted at install on that release.

## Open it

```sh
adb shell am start -n tv.dumbtv.variant/io.freemytv.SettingsActivity
```

That is the app's launcher entry — the same activity the app row on the TV starts, and the
one `aapt2 dump badging` reports as the launchable activity.

Upstream's activity for Fire OS, `io.freemytv.FireHomeActivity`, is declared
`android:exported="false"`, so `am start` on it from the shell is refused with a
`SecurityException`. The home screen itself, `io.freemytv.HomeActivity`, is exported and can
be started directly:

```sh
adb shell am start -n tv.dumbtv.variant/io.freemytv.HomeActivity
```

Upstream's note on Fire OS: `HomeActivity` carries `android:resumeWhilePausing="true"`,
which leaves the window focus on the paused launcher and drops remote key events. If the
home screen shows but the remote does not drive it, that is this known quirk rather than a
fault here — upstream keeps a separate `FireHomeActivity` for exactly this reason.

## HOME stays with dumbtv home

The variant declares a HOME category, but installing it should not change the TV's default
home app: `tv.dumbtv.home` stays HOME. If Android ever offers to switch the home app,
decline it, and check rather than assume:

```sh
adb shell dumpsys window | grep -i "mCurrentFocus" | head -2
```

The old launcher should still be the one in front once the variant is closed, and
`./scripts/verify.sh` must still pass end to end.

## What it is not yet

This is stage 1: the app is upstream's, with our application id and our signing key. It does
not take the HOME key, it does not show the TV's passthrough inputs, and it does not hold
the screen awake while a picture shows. Those are ours and they come in stage 2.

## Status

The build and the APK checks run in CI on every push, and the steps above are what the
on-TV pass does. That pass has not happened yet: the Ember 55 was off the network when this
was written. Run the steps above on it, and confirm `./scripts/verify.sh` still passes end
to end afterwards.

See `variant/UPSTREAM.md` for the upstream commit and the licence.
