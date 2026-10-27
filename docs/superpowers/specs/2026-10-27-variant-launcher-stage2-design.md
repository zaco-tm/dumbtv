# The fork becomes the one product — stage 2 design

Date: 2026-10-27
Branch: `feat/variant-launcher` (off `origin/main` 225bb00)
Status: design, for the owner's review

## 1. What the owner asked for, in their words

> "we want our app to be the main one for the forked version, the whole reason we forked was
> to implement a new 'home' screen; also im not seeing any of the kid features we were
> supposed to add from the other project"

Both halves were already in this spec's stage list. The owner has now chosen the shape:

| Decision | Choice |
|---|---|
| How the fork takes over the home screen | **The variant replaces `launcher/` — one product** |
| The kids face | **Port from `suboss87/my-kids-tv` now, rework the look later** |
| How the kids face sits | **Not decided yet** — the normal face first, the shape question stays open for the stage that does it |
| The order | **Stage 2 first: HOME, inputs, keep-awake** |

## 2. Why the kid features were not there

Decision D1 of the stage-1 design chose **free-my-tv** as the base, not `my-kids-tv`, on the
reasoning that my-kids-tv's value is "≈5 self-contained files, which are cheap to port"
later. Stage 1 was therefore the vendored base, byte for byte, with our id and our key —
and no kids face in it. The owner was told that the kids face was stage 4; they are
reading "we forked free-my-tv" as "the kids face is in it". It is not: the fork is the
*base*, and the kids face is a port that has not been done.

The kid fork is `suboss87/my-kids-tv` (MIT, "Thanks to Free My TV for the inspiration and
the open-source code My Kids TV grew from"). What it adds, from its README: a parent PIN,
a curated catalog in three age bands (4‑6, 7‑10, 11‑13), one title at a time with a
hero composition, a quiet night sky, a greeting with the child's name and the weather, a
sleep timer, and app hiding (hidden, never uninstalled). Its catalog is **CC BY 4.0**, so a
port carries an attribution obligation into `variant/UPSTREAM.md`.

## 3. What the fork already does on this TV (measured, 2026-10-27)

Everything below was observed on the Ember 55 with the stage-1 APK installed
(`tv.dumbtv.variant`), not read off a README:

| Thing | State on the Ember 55 |
|---|---|
| Installs and runs | yes, no crash, `Displayed … +575ms` |
| TMDB picks | live, 24 titles, backdrops downloaded |
| The remote | drives it (DPAD moves the focus) |
| **Inputs** | **already there**: the drawer shows *Live TV, Apple TV, HDMI 2, HDMI 3, HDMI 4* (the disconnected ports dimmed), plus Shortcuts and the weather and crypto panels |
| Opening an input | works: the TV's own `PassthroughPlayerActivity` comes up and the picture appears — but it tunes `com.mediatek.tis/.HdmiInputService/HW2` |
| The HOME key | **not ours**: `tv.dumbtv.home` is in front, and the fork cannot be a HOME candidate (it declares no HOME category) |
| Keep-awake | **absent**: upstream has no `FLAG_KEEP_SCREEN_ON` anywhere |

Two consequences for this stage:

1. **The inputs row is not work to build — it is work to make right.** The fork discovers
   the inputs and opens them, but it tunes the *port* (`HW2`) where the tile is named after
   the *device* (`Apple TV`). `dumbtv home` gets this right: it tunes
   `com.mediatek.tis/.HdmiInputService/HDMI100004`, the CEC child input, which is what the
   Apple TV tile on this TV actually is. Our mapping is the proven one; it has to come
   across.
2. **Upstream's own way of taking over the home screen cannot work on Fire OS.** Upstream's
   "Free My TV" mode *disables the TV's launcher* so that its own becomes HOME. On Fire OS
   `com.amazon.tv.launcher` is protected and may not be disabled, so upstream refuses the
   mode outright (`HomeMode.AMAZON`). The only route on this TV is ours: the **Guard**,
   an accessibility service that waits for Amazon's home window and covers it with ours.

## 4. The work

### 4.1 The Guard comes across (the real work)

`launcher/src/tv/dumbtv/home/Guard.java` (204 lines) becomes `io.freemytv.Guard`:

- Fire OS handles the HOME key before any accessibility filter sees it, so the service
  waits for Amazon's home window and replaces it, with a cover overlay so Amazon's home
  never shows.
- A plain `startActivity` after a HOME press is held back by Android's five-second
  app-switch delay; the launch goes through an alarm-fired `PendingIntent` (sent by
  system_server, which is exempt) and needs `min_futurity=0`.
- Android 11 refuses an activity start from an app with no visible window, so the launch
  waits until the cover has reached the window manager.

Changes for the fork: the package, the activity it starts (the fork's `HomeActivity`,
not `tv.dumbtv.home/.Home`), the `xml/guard.xml` resource, and the manifest entry. The
alarm and cover mechanics come across as they are.

**One Guard at a time.** `launcher/install.sh`'s `set_guard` already knows how to swap
the enabled accessibility service (it filters out the old guard and puts the new one in
place, and clears first so the manager rebinds). The variant's install path needs the
same function, pointed at `tv.dumbtv.variant/io.freemytv.Guard`. While both guards are
enabled they both intercept HOME, which is a fight the owner would see as a stutter.

### 4.2 The input mapping comes across

`launcher/src/tv/dumbtv/home/Input.java` knows how this TV names its inputs and how to
hand an input over to the TV's own app (and when *not* to, because Amazon's Live TV
claims every passthrough URI and then redirects to a channel scan instead of showing the
picture). The fork has its own version of that logic, in `HomeApps.inputs()`, and it is
right on other TVs and wrong here. The mapping — not the discovery — is what comes over.

### 4.3 Keep-awake

`dumbtv home` holds the panel awake while a picture shows (`FLAG_KEEP_SCREEN_ON` on the
window that shows it, proven on this TV: a 30 s timeout, 70 s later still awake, no sleep
events, and a negative control that did sleep). The fork has no keep-awake at all, and
with a passthrough input the picture is a hardware layer that no window of ours holds, so
this has to be worked out rather than copied.

### 4.4 One product in the repo

`launcher/` becomes the fork's problem, not a second product:

- `scripts/launcher.sh` and `launcher/install.sh` become the fork's install path (the
  Guard, the alarm's `min_futurity`, the accessibility service, the app id).
- `scripts/verify.sh` learns the fork's id: the `home` and `home-key` checks must look at
  `tv.dumbtv.variant`, and the launcher-version check (from PR #121) must check the fork's
  version, not `tv.dumbtv.home`'s.
- `launcher/release-check.sh`, `launcher/version.env` and the `launcher` CI job fold into
  the variant's equivalents.
- `AGENTS.md` and `CONTRIBUTING.md` say one thing about one home screen, not two.
- The old `tv.dumbtv.home` stays installed on the TV as a fallback until the fork has
  proved itself there; the repo stops shipping it.

### 4.5 The kids face (after stage 2)

Port from `suboss87/my-kids-tv`: the parent PIN, the three-band catalog (CC BY 4.0, with
attribution), the one-title hero, `SpaceSky`, the greeting, the sleep timer, the app
hiding. "Rework the look later" means the port keeps my-kids-tv's behaviour and our own
visual language comes after it works on the TV.

Whether the kids face is the only face or a PIN-locked mode beside the normal one is
**still open** — the owner chose "normal face now, kids face later", so that question
belongs to the stage that ports it, not to this one.

## 5. Risks

1. **Two guards.** If the fork's guard is enabled while `tv.dumbtv.home`'s is still
   bound, both intercept HOME. The swap has to be atomic, and the fallback has to be
   reachable: if the fork's home is broken, the old launcher has to come back.
2. **`tv.dumbtv.home` is the only thing on the TV that works today.** It stays installed
   and bound until the fork's guard is proven on the TV. The rollback is one setting
   (`enabled_accessibility_services`).
3. **Keep-awake with a passthrough input** is the part that is not yet understood. It has
   to be measured on the TV, not reasoned about: an HDMI input shows a raw picture with
   no media session, so nothing resets the idle timer and the panel goes off mid-film.
4. **The fork's input logic is upstream's and stays upstream's** unless it is wrong here.
   Only the mapping comes over; the fork's discovery is left alone, so a future
   re-sync does not fight us.
5. **Retiring `launcher/` touches the upstream PR (#121)**, which is open in
   `humblemuzzu/dumbtv` against `zaco-tm/dumbtv`. The version check it added has to
   keep working for the launcher that is still on the TV, or be moved to the fork.

## 6. What stage 2 is not

- It is not the kids face. That is the next stage, and its shape is still open.
- It is not upstream's control plane (`HomeMode`'s mode switch, `Adb`, `ModeJob`,
  `Capabilities`, `Watchdog`, `Updates`' self-updater). On Fire OS that machinery is
  inert — the `AMAZON` branch, the `com.amazon.*` refusal and the cert-pinned updater
  that never downloads for another key — so it can be left in place until the stage that
  strips it. Carrying it is untidy, not dangerous.
- It does not change the app id or the label. `tv.dumbtv.variant` and "dumbtv home
  (variant)" stay until the naming is settled with the owner.
