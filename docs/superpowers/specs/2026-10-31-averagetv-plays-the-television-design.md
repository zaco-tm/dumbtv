# Stage 5 — AverageTV plays the television

Branch: `feat/averagetv-rn`.

**Goal:** the launcher becomes an IPTV player. The Live TV page plays the channel itself —
the picture is Media3's, the guide stays ours — and OpenTV is gone.

**The owner's decisions (2026-10-31):**

1. **What plays:** live channels only in the first cut.
2. **Where the picture is drawn:** fullscreen, like a real TV. Going back returns to the guide
   with the picture still playing, in a small window at the top-right of the guide.
3. **OpenTV:** dropped entirely. The hand-off work goes with it.
4. **The front door:** home stays the front door. Settings gets an option to open on the guide.

This stage is the plan's "later: AverageTV plays the stream itself (Media3 in React Native)"
pulled forward. The OpenTV question dissolves, because the app no longer hands anything away.

---

## 1. What the product is now

The television's home screen is still the home screen: the rail, the greeting with the
weather, Favorites, Trending, the apps and the inputs. What is new is that the **Live TV
page plays the channel**.

Press a channel in the guide and the picture takes the screen, with the sound. Press back
and the guide comes back exactly as it was, with the picture still playing in a small window
at the top-right. Press back again, or go somewhere else, and the picture stops.

That is a television: a guide and a picture, and the guide is what you come back to.

## 2. The player's shape

### 2.1 The native player

Media3 **1.11.1** — the newest stable. (`1.12.0` exists only as `1.12.0-alpha02`; there is no
stable 1.12.0, and asking for one is a 404.) The artifacts, all verified to fetch from
`dl.google.com`:

| Artifact | Why |
| --- | --- |
| `androidx.media3:media3-exoplayer` | the player itself, and plain transport streams |
| `androidx.media3:media3-exoplayer-hls` | HLS, which is what most providers serve |
| `androidx.media3:media3-exoplayer-dash` | DASH, for the providers that do |
| `androidx.media3:media3-datasource-rtmp` | RTMP, which some providers still serve |
| `androidx.media3:media3-ui` | `PlayerView`, the view the picture is drawn in |

The `ExoPlayer` instance lives natively, in a new Kotlin package `io.freemytv.player`:

- **`TvPlayer`** — owns the `ExoPlayer` and the `PlayerView`. The `PlayerView` is a child of
  `HomeActivity`'s own container (`host`), the same container the kids face lives in. It has
  three states: **fullscreen** (fills the host), **window** (a rectangle at the top-right of
  the guide) and **hidden**.
- **`StreamUrl`** — builds a channel's address from the stored source and the sealed
  credentials. Pure Kotlin, no Android in it, so the JVM test proves it.
- **`PlayerModule`** — the React Native bridge.

The `PlayerView` is created with a **TextureView** surface, not a `SurfaceView`. A
`SurfaceView` is a separate surface composited *below* the window, so it cannot live
alongside the React Native content: either the guide draws over the picture, or the picture
punches a hole through the guide. A `TextureView` draws like any other view, so the picture
sits in the app's own window the way a normal view does.

The player draws **no controls**. A television's picture is clean; the remote is the
controller.

### 2.2 Why the picture is native and not a React child

The app runs the new architecture (`newArchEnabled=true`, React Native 0.88.1) and registers
no view managers today. Putting the video in the React tree means a `ViewManager` and the
Fabric interop layer, with more moving parts than the feature needs — and none of it can be
proven without the television, which is off.

So the picture is plain Android: a child of the activity's container, exactly like the kids
face. The consequence is the one thing the design has to pay for: **the guide has to
reserve the space the picture takes**, because the picture is not in the guide's layout. The
app knows the rectangle, so the app says where the picture is.

### 2.3 The bridge

A new React Native module `player`, registered in `AverageTVPackage` like the others. Every
method answers with a promise, as the app's modules do.

| Method | What it does |
| --- | --- |
| `play(channelId)` | plays a channel; the address is built natively |
| `pause()` / `resume()` | the picture's own controls |
| `seekBy(ms)` | seeks by a number of milliseconds |
| `stop()` | stops and releases the picture |
| `showFullscreen()` | the picture takes the screen |
| `showWindow(rect)` | the picture is a rectangle (dp) at the top-right of the guide |
| `hide()` | the picture goes away, playback stopped |
| `state()` | what is playing, whether it is playing, where it is, what went wrong |

The native side also **emits**: `player:state` when a channel starts, when it fails, and
when it ends. The app shows the failure in words rather than hanging on a black screen.

### 2.4 The stream address, built natively

The provider's password never crosses the bridge — it already does not for the login, and it
does not for playback either.

- **Xtream Codes:** `{base}/live/{user}/{password}/{streamId}.{ext}`. The extension comes
  from the provider's own `container_extension` field (`ts`, `m3u8`), which the current code
  reads and throws away.
- **M3U playlist:** the channel already carries its own address, parsed by `M3u`.

`StreamUrl.build(source, secret, channel)` is pure Kotlin, so the JVM test proves the shape
of the address, the extension, and the encoding of a name that needs it — with no device and
no network.

## 3. The layout

### 3.1 Fullscreen

The picture fills the host and the React root view is hidden (`GONE`). The React tree is
**not** unmounted: it stays mounted behind the picture, so going back shows the guide exactly
as it was — the same scroll position, the same focus.

### 3.2 The guide's window — top-right

The owner's change to the first draft: the picture in the guide is a **small window at the
top-right**, not a column down the right side.

- **Size:** 420 × 236 stage pixels (16:9). A fifth of the screen's width, so it reads as a
  preview of the channel rather than a second screen.
- **Place:** the top-right of the content area — its right edge 64 px from the screen's
  right edge (the page's own padding), its top 32 px down (the page's own top padding).

**The reserve.** The picture is not in the guide's layout, so the guide gives up the space:
while a channel is playing, the header and the "On now" row carry a right margin of 444 px
(420 for the picture plus a 24 px gap). Nothing is ever behind the picture, and nothing moves
when the picture arrives or leaves — only the right margin changes.

**One source of truth.** The rectangle is computed once, in JavaScript, in the app's own
`dp()` units, and sent to the native side, which does nothing but position the picture. The
two cannot drift, because there is only one number.

### 3.3 The way out

| From | Pressing back | The picture |
| --- | --- | --- |
| fullscreen | the guide comes back | shrinks to the top-right window, keeps playing, **silent** |
| the window | the window goes away | stops and is released |
| the guide | the guide's own rules | leaving the Live TV page stops the picture |

### 3.4 When a channel will not play

A channel that cannot be played — the provider's server is down, the token has expired, the
stream is a format Media3 does not have, the channel is a DRM channel — must not hang on a
black screen. The native side reports the failure, the app says it in words (**"This channel
will not play."**), the picture goes away and the guide comes back. The guide's own state is
untouched, so the household is back where they were, with a sentence they can read across a
room.

## 4. The keys

**Fullscreen — the native side has the keys**, because the React root view is hidden and
JavaScript is not in the way:

| Key | What |
| --- | --- |
| OK | pause, and OK again to resume |
| left / right | seek back / forward 30 seconds |
| back | the guide comes back, the picture shrinks to the window |
| Home | leave the app, as it does everywhere else |

**The window — the guide has the keys.** The picture is silent there (see §5), so there is
nothing for OK to do to it: OK belongs to the guide, as it does on every page.

## 5. The sound

- **Fullscreen:** the sound.
- **The window:** silent. Once you are back in the guide, OK belongs to the guide — there is
  no way to mute from there — so a soundtrack would follow you around the room with no off
  switch. The picture is for seeing what you chose, not for hearing it while you browse.

The player **takes the audio focus** (`handleAudioFocus = true`), so the sleep timer's blank
and any other app that takes the focus pause the picture rather than talking over it.

The lifecycle: `onPause` pauses the picture, `onStop` stops and releases it. Leaving the
app therefore leaves no sound behind.

## 6. The channel banner

When a channel starts, a small banner — the channel's number and its name — appears over
the picture and fades after three seconds. It is the way a television says which channel you
landed on, and it is the only confirmation the household gets that the right channel started.
Native side, drawn over the picture.

## 7. The front door

Home stays the front door. The Settings page gets a row:

> **Open on** — Home / Guide

Default: **Home**. It is stored in the app's own `settings` preference file, through the
`prefs` module that already exists, and the app reads it at start and routes to the guide
instead of home when it says Guide.

## 8. OpenTV is dropped

**Deleted:**

- `app/android/app/src/main/java/io/freemytv/iptv/OpenTv.kt`
- `app/android/app/src/main/java/io/freemytv/iptv/Handoff.kt`
- `app/__tests__/handoff.test.ts`
- `patches/opentv-play-channel-by-name.patch`
- the `watch` and `openTvInstalled` methods on the bridge, and the Live TV page's call to them

**Kept from the work that is in the tree but not committed**, because playback and the guide
need them:

- `Address.kt` and its test — one place that decides a source's scheme and whether that
  source is reached over an encrypted connection. `Provider.kt` asks it instead of deciding
  for itself.
- The XMLTV parser fix — a `DOCTYPE` is allowed (every provider's guide carries one, and
  refusing them all threw the guide away) and nothing outside the file is fetched to resolve
  it.

**No upstream PR and no fork.** The patch was for OpenTV's own app, and there is nothing left
to send it for. The OpenTV tree is untouched.

## 9. Cleartext

A plain `http://` provider works in a debug build and fails in the shipping one: React
Native's own Gradle plugin sets `usesCleartextTraffic` to false for release, after the app's
own `manifestPlaceholders`.

The fix is a **network security config**, which the platform prefers over that flag from API
24 (the app's `minSdk`). It permits cleartext generally, because the provider's domain is
whatever the household types in and cannot be known when the app is built. For a household
app whose provider the owner enters, that is the right trade — and it is written down here
rather than left as a surprise.

The Settings page already warns when the stored source is not reached over an encrypted
connection. That warning stays.

## 10. The prototype first, then the app

The prototype is the specification, and the picture is the biggest new thing in it. So the
prototype gets the same three pieces, as mocks:

1. **The guide with the picture window** at the top-right — a mock picture in the channel's
   own colour with its number, in exactly the 420 × 236 rectangle and the 444 px reserve, so
   the size can be judged in the browser before it exists on the television.
2. **The fullscreen picture** — a mock still with the channel's banner, so the transition
   and the banner can be seen.
3. **The Settings row** "Open on: Home / Guide", and the prototype's front door following it.

Then the app mirrors them: the prototype's behaviour matched, token for token, and the
parity tables (`docs/superpowers/averagetv-parity.md` and `app/src/ui/charcoal/PARITY.md`)
record it.

## 11. What is proved, and how

| What | How it is proved |
| --- | --- |
| The stream address, the extension, the encoding | JVM tests, pure Kotlin, no device and no network |
| Which source is reached, and whether it is encrypted | the JVM tests that came with `Address` |
| The guide's XMLTV, its channels, the now/next join | the JVM tests that came with the parser |
| The key map, the bridge's shape, the guide's press-a-channel path | Jest, with the native module mocked |
| The window's geometry and the reserve | Jest, on the pure function that computes the rectangle |
| **The picture, the sound, the keys, the provider's real stream format** | **the television** |

The last row is blocked: the Ember 55 is off, so nothing about the picture can be measured
yet. The stage therefore ends with a task that says *measure it on the television*, and every
other part is proved without it.

## 12. Out of scope

- The provider's movies and series (VOD). Live only, in this cut.
- Widevine and other DRM.
- The picture as the page's background: it needs every page's background to become
  transparent, and text over moving video is unreadable without a scrim on every screen.
- A mini-player that follows you to other pages.
- The upstream OpenTV pull request.

## 13. Risks and unknowns

- **The stream format is unknown** until the provider's login is on the television. Media3
  gets HLS, DASH and RTMP as well as plain transport streams, which covers what the
  providers actually serve, but the first real channel is still the first test.
- **The provider's tokens can expire.** The address is built fresh every time a channel is
  pressed, never cached.
- **No device proof** until the television is switched on. The parts that can be proved
  without it are proved; the picture itself is not.
- **Fabric is new in this app.** The picture is deliberately plain Android, so no codegen
  and no interop layer are involved.

## 14. The files that change

**New**

- `prototype/src/components/PlayerWindow.tsx` — the mock picture window
- `prototype/src/pages/FullScreenPlayer.tsx` — the mock fullscreen picture
- `app/src/data/player.ts` — the app's side of the player: what is playing, the mode, the
  rectangle, the actions
- `app/android/app/src/main/java/io/freemytv/player/TvPlayer.kt`
- `app/android/app/src/main/java/io/freemytv/player/PlayerModule.kt`
- `app/android/app/src/main/java/io/freemytv/player/StreamUrl.kt`
- `app/android/app/src/test/java/io/freemytv/player/StreamUrlTest.kt`
- `app/android/app/src/main/res/xml/network_security_config.xml`

**Changed**

- `app/android/app/build.gradle` — the Media3 dependencies
- `app/android/app/src/main/AndroidManifest.xml` — the network security config
- `app/android/app/src/main/java/io/freemytv/HomeActivity.kt` — the picture as a child of the
  host, the keys in fullscreen, the lifecycle
- `app/android/app/src/main/java/io/freemytv/AverageTVPackage.kt` — the player module
- `app/android/app/src/main/java/io/freemytv/iptv/IptvModule.kt` — the hand-off methods go,
  and the channel carries the provider's `container_extension`
- `app/android/app/src/main/java/io/freemytv/iptv/IptvModel.kt` — the channel's extension
- `app/android/app/src/main/java/io/freemytv/iptv/Provider.kt` — the extension is read
- `app/src/native/index.ts` — the `player` module's TypeScript face
- `app/src/screens/LiveTv.tsx` — a channel plays instead of handing off; the reserve
- `app/src/screens/Settings.tsx` — the "Open on" row
- `app/App.tsx` — the front door and the picture's window
- `prototype/src/pages/LiveTv.tsx`, `prototype/src/pages/Settings.tsx`, `prototype/src/App.tsx`
- `docs/superpowers/averagetv-parity.md`, `app/src/ui/charcoal/PARITY.md`

**Deleted**

- `app/android/app/src/main/java/io/freemytv/iptv/OpenTv.kt`
- `app/android/app/src/main/java/io/freemytv/iptv/Handoff.kt`
- `app/__tests__/handoff.test.ts`
- `patches/opentv-play-channel-by-name.patch`

## 15. The plan

The implementation plan is written from this document, task by task, in the way stage 4's
was: the prototype first, then the native player, then the bridge, then the app's screens,
then the release build, with a task at the end that measures it on the television — blocked
until the Ember 55 is switched on.
