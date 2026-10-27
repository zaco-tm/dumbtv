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

The variant does **not** declare a HOME category: it must not be able to take the HOME key
away from the launcher that works today. (`tv.dumbtv.home` is the TV's home screen through
the Guard, an accessibility service; stage 2 gives the variant the HOME key the same way,
and it does not need the category.)

Two different things have to be true, and on this TV they are checked two different ways.

**The variant is not a home app candidate.** Ask the package manager which activities
answer a HOME intent, and look for `tv.dumbtv.variant` in the answer — it must not be
there:

```sh
adb shell cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.HOME \
  | grep -E 'packageName=' | sort -u
```

The answer is the same set of packages before the variant is installed and after, and
`tv.dumbtv.variant` is in neither.

**Our launcher is still the one in front.** This is the check that matters, and the Guard
decides it, not the package manager:

```sh
adb shell dumpsys window | grep mCurrentFocus
adb shell input keyevent KEYCODE_HOME
adb shell dumpsys window | grep mCurrentFocus
```

Both must name `tv.dumbtv.home/tv.dumbtv.home.Home`.

Do **not** use `resolve-activity` for this. On the Ember 55 it answers
`com.amazon.tv.launcher/.ui.HomeActivity_vNext`, with `priority=950` and
`isDefault=true`: Fire OS's own launcher wins the resolver even though `tv.dumbtv.home`
is the home screen in practice, because the Guard takes the HOME key rather than a HOME
category. That answer is the same before and after the variant is installed — it is the
*change* that would matter, not the name.

If Android ever offers to switch the home app, decline it. The old launcher should still
be the one in front once the variant is closed, and `./scripts/verify.sh` must still pass
end to end.

## What the tile on the TV says

The launcher draws the app's **banner** as its tile, so the banner is the picture on the
TV. Upstream's banner has the words *Free My TV* in it, which is not what we want on our
own TV, so the variant has its own:

- `res/drawable-nodpi/banner_variant.png` — the picture that ships in the APK.
- `artwork/banner_variant.svg` — the design it was made from, kept so it can be looked at
  in a review and re-made with one command:

  ```sh
  rsvg-convert -w 640 -h 360 variant/artwork/banner_variant.svg \
    -o variant/res/drawable-nodpi/banner_variant.png
  ```

It is the same TV mark as `launcher/res/drawable/banner.xml`, in the launcher's own
colours, with our wordmark beside it. The label under the tile is the app's name,
`dumbtv home (variant)`, which the launcher shows when the tile is focused.

## What it is not yet

This is stage 1: the app is upstream's, with our application id and our signing key. It does
not take the HOME key, it does not show the TV's passthrough inputs, and it does not hold
the screen awake while a picture shows. Those are ours and they come in stage 2.

## Status

The build and the APK checks run in CI on every push. The on-TV pass has happened once, on
the Ember 55 (Fire OS 8): the variant installs beside `tv.dumbtv.home`, opens without a
crash, fetches live picks from TMDB, the remote drives it, HOME still lands on
`tv.dumbtv.home`, its tile in the APPS row carries our own banner, and
`./scripts/verify.sh` passes end to end.

See `variant/UPSTREAM.md` for the upstream commit and the licence.
