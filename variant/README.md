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
./variant/install.sh --build               # build the APK, install it, and give it HOME
```

`./variant/install.sh` installs the APK in `variant/build` when it is already there;
`--build` builds it first (it needs `variant/config.properties` with your TMDB key).
Either way the script does the whole job: it installs the fork, grants the two app
ops, sets the alarm setting the Guard needs, and swaps the fork's Guard into
`enabled_accessibility_services` — the old launcher's Guard goes out, the fork's comes
in, and every other accessibility service stays.

To install the APK by hand instead:

```sh
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

`./variant/install.sh` sets the first two; the commands are here for a TV where the
app was installed by hand. `SYSTEM_ALERT_WINDOW` is the sleep timer's overlay, and
`REQUEST_INSTALL_PACKAGES` belongs to upstream's self-updater. Both are granted over adb
here rather than by making the owner click through an installer's warning. Stage 3
removes both permissions along with the code that wanted them.

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

## The fork takes the HOME key

Fire OS protects Amazon's launcher and lets no third-party app be the home app, so HOME
is taken by a Guard: an accessibility service that covers Amazon's home window with
ours. `./variant/install.sh` points the TV's `enabled_accessibility_services` at the
fork's Guard, `tv.dumbtv.variant/io.freemytv.Guard`, and takes the old launcher's Guard
out. Only one Guard may be bound at a time: two of them would fight over the HOME key.

The fork is **not** a home-app candidate. It declares no HOME category and the install
path never calls `set-home-activity`: the Guard is the whole mechanism. Ask the package
manager which activities answer a HOME intent, and look for `tv.dumbtv.variant` in the
answer — it must not be there:

```sh
adb shell cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.HOME \
  | grep -E 'packageName=' | sort -u
```

The answer is the same set of packages before the variant is installed and after.

**Which Guard is bound.** The setting names the component; the dump names the label:

```sh
adb shell settings --user 0 get secure enabled_accessibility_services
adb shell dumpsys accessibility | grep -o 'Service\[label=[^,]*'
```

The fork's service is `dumbtv home (variant) button`, the old launcher's is
`dumbtv home button`. The two labels differ on purpose, so the two guards can be told
apart there and in the TV's accessibility settings.

The dump cuts a long label short at 22 characters: the fork's comes out as
`Service[label=dumbtv home (variant) b…`, with an ellipsis where the rest was. The two
labels part at the eleventh character, so what is left of the cut still says which
service it is — the old launcher's is short enough to print whole.

**HOME has to land on the fork's home screen.** That is the proof, and it is the only
one: a bound service says nothing about whether the key arrives.

```sh
adb shell dumpsys window | grep mCurrentFocus
adb shell input keyevent KEYCODE_HOME
adb shell dumpsys window | grep mCurrentFocus
```

Both must name `tv.dumbtv.variant/io.freemytv.HomeActivity`. `./scripts/verify.sh`
checks all of it and says which product it is about: `dumbtv home (variant)` when the
fork is in front, `dumbtv home` when the old launcher is.

Do **not** use `resolve-activity` for this. On the Ember 55 it answers
`com.amazon.tv.launcher/.ui.HomeActivity_vNext`, with `priority=950` and
`isDefault=true`: Fire OS's own launcher wins the resolver even though our home screen
is the one in practice, because the Guard takes the HOME key rather than a HOME
category. That answer is the same before and after the variant is installed — it is the
*change* that would matter, not the name.

If Android ever offers to switch the home app, decline it. The Guard stays the way HOME
is taken, and `./scripts/verify.sh` must still pass end to end.

## The way back to a working TV

One setting. If the fork misbehaves, put the old launcher's Guard back:

```sh
adb shell settings put secure enabled_accessibility_services tv.dumbtv.home/tv.dumbtv.home.Guard
```

`accessibility_enabled` is already 1. The launcher that works today is the home screen
again — HOME lands on `tv.dumbtv.home/.Home` — and `./scripts/verify.sh` passes and
names the launcher.

That one command replaces the whole list, so any *other* accessibility service on the
TV is dropped with it. `./variant/install.sh --undo` does the same swap and keeps the
other services; it waits for the old Guard to bind before it says the TV is back.

To put the fork back in front: `./variant/install.sh`.

## The Guard

The fork carries our own Guard (`src/io/freemytv/Guard.java`): the accessibility service
that takes the HOME key on Fire OS, where Amazon's launcher is protected and no
third-party app can be the home app. It waits for Amazon's home window, covers it, and
brings the fork's home screen up instead. It is the port of `tv.dumbtv.home`'s Guard —
same alarm-fired launch, same cover, same rules — and it is ours, not upstream's, so it
is listed in `variant/our-files.txt` and described in `variant/UPSTREAM.md`.

`variant/install.sh` binds it: it points the TV's `enabled_accessibility_services` at
`tv.dumbtv.variant/io.freemytv.Guard`, swaps the old launcher's Guard out, keeps every
other accessibility service, and sets `min_futurity=0` (the Guard's launch goes through
an alarm, and an alarm does not fire sooner than five seconds from now unless that
setting says otherwise). `./variant/install.sh --undo` puts the old Guard back, and the
rollback is that one setting, written down above.

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

## The TV's inputs

The home screen's Inputs row lists the TV's HDMI inputs, and a tile named after a device that
talks HDMI-CEC (an Apple TV on the Ember 55) carries that device's own name. Tapping a tile
opens the input on **our** screen — `io.freemytv.Input`, the port of `tv.dumbtv.home`'s input
screen — with the picture in a window of ours:

- BACK returns to the home screen, because the input is our own screen and not another app's.
- The panel stays awake while the input shows a picture, and the normal idle timeout applies
  again when it does not (a port with nothing plugged into it).
- A tile named after a device tunes that device's own input, not the port it is plugged into.

The maker's own players (Allwinner, Xiaomi) still have the last word on the boards where no
app opens a passthrough input, and Live TV is still Amazon's: upstream's paths, unchanged.

## Status

The build and the APK checks run in CI on every push. The on-TV pass has happened on the
Ember 55 (Fire OS 8): the variant installs beside `tv.dumbtv.home`, opens without a
crash, fetches live picks from TMDB, the remote drives it, its tile in the APPS row
carries our own banner, and it takes the HOME key through its Guard — HOME lands on
`tv.dumbtv.variant/io.freemytv.HomeActivity` and `./scripts/verify.sh` passes end to
end, naming the fork. The way back was run on the TV as well: with the old launcher's
Guard back in `enabled_accessibility_services`, HOME landed on `tv.dumbtv.home/.Home`
and `verify.sh` named the launcher.

The inputs were measured on the same TV: the "Apple TV" tile opens our screen and tunes the
device's own input (`…/HdmiInputService/HDMI100004`, not the port's `HW2`), the picture
comes up, BACK comes back to the home screen, and with a 30-second idle timeout the picture
held the panel awake for 70 seconds while the same screen with no signal slept in 28.

See `variant/UPSTREAM.md` for the upstream commit and the licence.
