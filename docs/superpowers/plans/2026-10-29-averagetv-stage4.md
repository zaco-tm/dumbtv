# Stage 4 — the prototype in Charcoal, then the app in React Native

Branch: `feat/averagetv-rn`, off `feat/variant-launcher` (stage 3 is done and pushed there).

**Goal:** build the home screen the owner drew, first as a prototype with the real Charcoal
UI Pro components, then as the product: a React Native app for the television, with the
Charcoal components ported to it.

**Architecture:** two trees and one design language.

- `prototype/` — Vite + React 19 + TypeScript + Tailwind 4 + the real Charcoal UI Pro
  components. It is the **design**: the layout, the motion, the tokens, and the behaviour
  of every element. It runs in a browser at 1920×1080 and never ships to the television.
- `app/` — React Native 0.88 (new architecture) for Android TV. It is the **product**.
  Its UI is the prototype's components, ported to `View`/`Text`/`Pressable` and Reanimated,
  with the same props and the same tokens.

The rule that keeps the two honest: **every Charcoal component used in the prototype has a
named port in `app/src/ui/charcoal/`, and a port is done when the prototype's behaviour is
matched.** The table that says which is which is
[docs/superpowers/averagetv-parity.md](../averagetv-parity.md), and it is part of the
deliverable, not a note.

The vendored Java app in `variant/` stops being the product and becomes the **reference
for the functions and ideas**: the guard, the mode switch, the inputs, the sleep timer, the
PIN, the kids face, the screensaver, the weather and the film picks are all already built
and measured on the television. What is *not* in it is the home screen the owner drew, and
that is what stage 4 builds.

## Why this order

Charcoal is React for the web: DOM, Tailwind, Radix, `motion`. It cannot run in React
Native as it is. So the owner's direction — "the app in React Native, taking the UI from
Charcoal" — has two halves that have to be done in this order:

1. **The prototype (B).** In the browser, with the real Charcoal components, the design
   gets decided: the rail, the greeting, Favorites, Trending, the focus states. This is
   fast, and every mistake here is cheap.
2. **The ports (C).** The same components in React Native, with the same tokens and the
   same motion. The prototype is the specification, so the port is a translation, not a
   design.

Building the app first and the design second means designing twice. Building the design
first means porting once.

## What the native side keeps

React Native replaces the *screen*. Everything that Android itself needs stays native,
inside the same APK, in the same package.

| Native piece | Why it cannot be JavaScript |
|---|---|
| `io.freemytv.Guard` | An accessibility service. Android binds it by component; the class name must not change or the service is unbound when the app is replaced. |
| `io.freemytv.HomeActivity` | The host. The Guard checks the window's **simple class name** against `"HomeActivity"`, so the RN host activity keeps that exact name. |
| `io.freemytv.KidsView`, `ParentLock` | The kids face and its PIN gate are already built, measured and (mostly) translated. They stay as they are. |
| `io.freemytv.Input` | The HDMI input screen: `DisplayManager`, a `TvView` layer, the back stack. |
| `io.freemytv.SleepBlank`, `SleepOverlay` | The sleep timer: an overlay window, the panel's brightness, its own process. |
| `io.freemytv.Screensaver`, `ScreensaverAlone` | Dream services (`BIND_DREAM_SERVICE`). |
| `io.freemytv.NowPlaying` | A notification listener service. |
| `io.freemytv.HomeReceiver`, `ModeJob` | Boot and package-replaced. |
| `io.freemytv.PhotoInbox` | A content provider, with the authority `tv.dumbtv.variant.photos`. |
| `io.freemytv.RemoteKeyService` | Upstream's own accessibility service. |

**The host activity holds both faces.** `HomeActivity` stays native and swaps between two
content views, the way it does today: the RN root view for the normal face, the existing
native `KidsView` for the kids face. The PIN gate, the HOME-key behaviour and the sleep
timer keep working exactly as they do now, and the overhaul is confined to the normal
face — which is what the owner's sketch is about.

**The preference files are a contract.** The household's settings live in
`settings`, `kids_settings`, `parent_pin`, `home-ui`, `homedata`, `recs` and
`recs_history`. The final install is *in place* (same id, same signing key), so these
files survive — but only if the RN app reads and writes the same names and the same
formats. `parent_pin` holds a salted hash, not a PIN: the native module keeps that format.

## The app id, the preview app, and the swap

The product's id stays **`tv.dumbtv.variant`** and the Java package stays `io.freemytv`.
Renaming the id would make the app a different app on the television: the old one has to
be uninstalled first, and the PIN and the children's settings are lost.

While the app is being built, it is **not** the home screen. Development happens under
**`tv.dumbtv.preview`**, signed with a separate debug key, with no HOME category and no
guard: an ordinary app in the television's app list, so the household's home screen keeps
working the whole time the new one is being built.

The swap, when the app is ready:

1. Build the release APK with `applicationId tv.dumbtv.variant`, signed with
   `variant/release.keystore` (the same key as the installed app).
2. Install it over the Java app. Android allows it: same id, same key. The data in
   `shared_prefs` is untouched, so the PIN, the kids settings and the favorites survive.
3. The guard stays bound — same package, same class, same label.
4. `scripts/verify.sh` still passes; the HOME key still lands on AverageTV.

The Java app stays in the repo as the reference and the rollback: `variant/build.sh` still
builds it, and the last good APK is kept with the keystore.

## The build promise changes

Stage 1's promise — *"No Gradle, no libraries, no network in the build. Python 3 standard
library only."* — described **the vendored tree's** build, and that promise is kept: the
vendored tree still builds with `aapt2` → `javac` → `d8` and nothing else, and the CI job
that proves it stays.

The new app's build is an ordinary Android build: npm, Metro, Gradle, the Android SDK, and
the network for the dependencies. Stage 1's plan says so at the top (amended on
2026-10-29 with a pointer here). Two new CI jobs come with it:

| Job | What it does |
|---|---|
| `prototype` | `npm ci && npm run build` in `prototype/`. Proves the design tree still builds. |
| `app` | The release APK in `app/`. Added with task 6, when the app tree exists. |

The CI greps are extended to the new file types (`.ts`, `.tsx`, `.js`, `.jsx`, `.java`,
`.kt`, `.gradle`, `.kts`), so a private address or the TMDB key still cannot get in.

## The design: the sketch in Charcoal

The owner's sketch: a left rail with **Home / Live TV / Apps / Inputs**, a settings gear and
the kids face at the bottom; a header with a greeting and a weather widget; a
**Favorites** row that mixes apps and inputs; and **Trending** as a big feature with a
ranked list beside it, each with a star rating.

The Charcoal components that carry it:

| Part of the sketch | Charcoal | Note |
|---|---|---|
| The rail | `line-sidebar` (Pro) | "Short lines that grow into labelled items when the pointer reaches the rail, with the active line in ember." On a television there is no pointer: the remote's focus is the pointer. The port replaces the hover with the focus. |
| Trending's feature | `carousel` | Drags, flicks, snaps. The television version scrolls with the D-pad. |
| The star ratings | `rating` (Pro) | A star rating with a ripple. The data-bearing glyph stays — it is a rating, not a flourish. |
| The greeting and the weather | built from the theme's tokens | There is no weather component: the weather is live data, and the greeting is text. The prototype uses mock data; the app uses open-meteo, as the Java app does. |
| The Favorites tiles | the theme's card and button primitives | An app's icon and name, an input's name. |

**No decorative glyphs.** The owner's standing rule: no sparkles, stars, diamonds or
flourishes in the UI. The one star is the rating, and it means something.

**The focus ring is not optional.** Every element in the prototype must show where the
remote's focus is, and the arrow keys must move it. A prototype that only works with a
mouse has not been designed for a television.

The prototype's data is mock JSON (`prototype/src/data/*.ts`): apps, inputs, weather,
trending. No key, no network, no account.

## The ports: Charcoal → React Native

| Charcoal (web) | React Native |
|---|---|
| Tailwind classes | `StyleSheet` with the tokens |
| CSS custom properties | `tokens.ts`, generated from the prototype's CSS |
| `motion` (framer-motion) | Reanimated |
| Radix `dialog` | `Modal` |
| Radix `tooltip` | an absolutely positioned view |
| `lucide-react` icons | `react-native-svg` with the same paths |
| hover | focus |

**The tokens are generated, not copied.** `app/tools/gen-tokens.mjs` reads the prototype's
theme CSS and writes `app/src/ui/charcoal/tokens.ts`. One source of truth: if the
prototype's ember changes, the app's ember changes with it, and there is nothing to
remember.

## Tasks

Each task is a brief for a worker, and each ends with something measured.

### Task 1 — the prototype tree (done)

Vite + React 19 + TypeScript, Tailwind 4, the Charcoal theme and the shadcn CLI
(`CHARCOAL_LICENSE_KEY` from `~/.zshrc.local`; the key is **never** committed, and
`.env.local` is git-ignored). The app shell at 1920×1080 with the Charcoal tokens.

Risk: low. Measure: `npm run dev` shows the theme; `npm run build` succeeds; the build
has no key in it; the tree is committed with a lockfile.

### Task 2 — the rail and the shell (done)

The `line-sidebar` rail (Home / Live TV / Apps / Inputs, the gear and the kids face at the
bottom) beside the content column, with the focus model: up and down inside the rail, left
and right between the rail and the content.

Risk: medium. The focus model is the whole of it. Measure: with the keyboard alone, every
destination is reachable in a few presses, and the focus is never nowhere.

### Task 3 — the greeting and the weather (done)

"Good morning" and the weather, with no name. The same pieces the kids face already draws.

Risk: low. Measure: the header reads correctly at 08:00 and at 21:00, and with the network
off it still reads.

### Task 4 — Favorites (done)

A row that mixes apps and inputs, in the order the household put them.

Risk: low in the prototype (mock data). Measure: a row of six, mixed, with the input tiles
visibly different from the app tiles.

### Task 5 — Trending (done)

One large feature on the left (poster, title, metadata) and a ranked list beside it, each
with a thumb, a title, a second line and a star rating.

Risk: low in the prototype. Measure: the ranking matches the mock data's order, and the
rating stars match the mock ratings.

### The prototype, as it stands

The five tasks above are done. `prototype/` is a Vite + React 19 + TypeScript + Tailwind 4
tree with the real Charcoal theme and three Charcoal components installed
(`line-sidebar`, `rating`, `carousel`), and the screen it draws is the owner's sketch: the
rail on the left with the gear and the children's face at the bottom, the greeting and the
weather in the header, the Favorites row, and Trending with the feature and the ranked
list.

Three things were decided while building it, and they are the ones the app has to keep:

- **The type is the television's.** A television is read from across a room: the greeting
  is 72px, the section titles 32px, the rail's labels 22px. Charcoal's own sidebar is
  browser-sized, so the prototype's copy of it was edited — the rows, the icons, the
  labels — and the port carries those numbers over.
- **The focus is a grid.** Every focusable says where it is (`data-row`, `data-col`), and
  an arrow key moves to the nearest one in that direction: the rail is column 0, so right
  from the rail enters the content and left from the content's left edge goes back. The
  measured behaviour: right from *Home* lands on the first Favorite, down from it lands
  on the Trending feature.
- **The carousel was not needed.** The sketch has no carousel: its rows are driven by the
  focus, not by dragging. It stays installed in the prototype (it is free) and is not
  ported.

The parity table is [docs/superpowers/averagetv-parity.md](../averagetv-parity.md).

### Task 6 — the parity table, the tokens, and the app tree

`app/src/ui/charcoal/PARITY.md` (every Charcoal component → its port, or "not ported, and
why"), `app/tools/gen-tokens.mjs` and the generated `tokens.ts`, and the React Native tree:
`npx @react-native-community/cli init`, `applicationId tv.dumbtv.preview`, the native host
activity `io.freemytv.HomeActivity` with the RN root view in it, and the native modules
stubbed (`parent_pin`, `home_mode`, `inputs`, `sleep`, `prefs`, `night`).

Risk: medium. This is the first time the two trees meet. Measure: the preview app builds,
installs on the television as an ordinary app, opens, and shows the prototype's shell with
the generated tokens.

### Task 7 — the ports

One component at a time, from `PARITY.md`: `line-sidebar` → `Rail`, `rating` → `Rating`,
`carousel` → `Carousel`, and the theme's primitives. Each port keeps the prototype's props
and its motion, and the two are compared side by side at 1920×1080.

Risk: medium. Measure: the port matches the prototype's behaviour and its look, and the
tokens match exactly (the generator says so).

### Task 8 — the native side, for real

The Guard in the RN app (same class name, same label, same mechanism), the PIN module
reading `parent_pin`, the mode switch, the inputs, the sleep timer, the kids face behind
the PIN, and the Screensaver.

Risk: high — this is the part that can break the parts that work. Measure: on the preview
id, the PIN gate holds, the kids face comes and goes, and the sleep timer blanks the
screen. Nothing is touched on `tv.dumbtv.variant` yet.

### Task 9 — the swap

Build the release APK with `tv.dumbtv.variant` and the release key, install it over the
Java app, and measure everything the Java app did: the guard bound, HOME landing on
AverageTV, the PIN, the kids face, the sleep timer, the inputs, `scripts/verify.sh` green.

Risk: high, and the rollback must be ready before it starts: the Java app's last good APK
and the keystore, and `variant/install.sh` to put it back.

## Live TV — the OpenTV integration

The owner's decision: the **Live TV** tab is a page that integrates with OpenTV
(`app.opentv`, the GPL IPTV player), showing what is on now and what is coming tonight —
the schedules and the sports events.

Two things were decided:

- **The guide comes from the provider, with the public feeds as the fallback.** The same
  IPTV login OpenTV uses (Xtream Codes or an M3U playlist), entered in AverageTV once, and
  the provider's EPG fills the guide. When there is no login, or the provider's guide is
  empty or unreachable, the **public EPG feeds OpenTV already ships** are used instead:
  `dp247/Freeview-EPG` for the UK, and `epgshare01` for the US, Canada and Australia.
  The credentials stay on the television and go nowhere but the provider.
- **OpenTV plays it for now; AverageTV plays it later.** Pressing a programme opens
  OpenTV on that channel. Later, AverageTV becomes the player too (Media3 in React
  Native), and OpenTV becomes optional.

### What OpenTV actually gives us

Measured from the APK (`app.opentv` 0.11.7) and its source:

| | |
|---|---|
| Exported | `app.opentv.MainActivity` only — `MAIN`/`LAUNCHER` and `MAIN`/`LEANBACK_LAUNCHER`, `launchMode="singleTask"` |
| The one thing it accepts | the extra **`opentv.play_channel`**, a Long: play that channel. `opentv.watch_recording` also works. |
| Not exported | every provider (`androidx.core.content.FileProvider`, `androidx.startup.InitializationProvider`), the media session, the recording service, the reminder receiver |
| The guide | XMLTV EPG, merged over "feeds": the provider's own, the built-in public ones, and any the user adds. It lives in OpenTV's Room database — `channels`, `programmes`, `epg_channels`, `epg_feeds`. |
| The channels | `Channel(id, sourceId, streamId, displayName, groupKey, epgChannelId, matchedEpgId, logoUrl, tvArchive…)`. `streamId` is the provider's own id, stable per source. `groupKey` is the normalised name OpenTV's matcher joins the guide on. |

So: **there is no way for another app to read OpenTV's channels or its guide.** The data is
in another app's private database, and the providers that exist are not exported.

### The one thing that has to change, and it is not in our repository

`opentv.play_channel` takes **OpenTV's own internal channel id** — the `channels.id`
autoincrement from its own database. AverageTV, which gets its channel list from the
provider, knows the provider's `streamId` and the names; it cannot know OpenTV's id.
Reading OpenTV's database is not possible without root.

There are two ways out, and only one of them is ours to take:

1. **A small change upstream to OpenTV** (recommended): let it accept a channel by name,
   the way it already accepts one by id. The patch is small and belongs in
   `MainActivity.handlePlayIntent` and the repository lookup beside it:

   ```kotlin
   const val EXTRA_PLAY_CHANNEL_NAME = "opentv.play_channel_name"

   // in handlePlayIntent, next to the id branch
   val name = intent?.getStringExtra(EXTRA_PLAY_CHANNEL_NAME)
   if (!name.isNullOrBlank()) {
       app.opentv.core.PlayRequests.request(
           ServiceLocator.get(this).channelRepository.idForName(name)   // groupKey first, then displayName
       )
   }
   ```

   OpenTV is GPL and takes contributions, so this can go upstream as a pull request. It
   needs an OpenTV release before the hand-off is exact.
2. **The hand-off without a channel**: AverageTV opens OpenTV and the viewer picks the
   channel. It works today with the installed OpenTV, and it is what the app does until
   (1) lands. AverageTV sends the name extra as well, so nothing has to change in the app
   when OpenTV learns to read it.

The app therefore sends both, and degrades:

```kotlin
Intent().setClassName("app.opentv", "app.opentv.MainActivity")
    .putExtra("opentv.play_channel", id)        // when the id is known
    .putExtra("opentv.play_channel_name", name)  // always; ignored by today's OpenTV
```

### The app's side of it

A native module `iptv`, because the parsing and the credentials are not JavaScript's job:

| Call | What it does |
|---|---|
| `saveProvider(host, user, password)` / `savePlaylist(url)` | stores the source, encrypted in the app's own preferences; never leaves the television |
| `channels()` | the channel list with the provider's ids, the logos and the guide ids |
| `guide()` | the programmes for the next days, from the provider's EPG, or from the public feeds when there is no provider guide |
| `watch(channel)` | the hand-off to OpenTV, as above |

And a `page` in the app: `app/src/screens/LiveTv.tsx`, the port of the prototype's
`prototype/src/pages/LiveTv.tsx`.

### The prototype

The page is already drawn: `prototype/src/pages/LiveTv.tsx`. "On now" is a row of channel
tiles (the channel's number, its name, what is on it, and a bar showing how far through
the programme we are), and "Tonight" is a list of the coming events with their times and
their channels — a **Live** badge in ember for what is on now, and an outline badge for
Sports and New. The rail's **Apps** and **Inputs** destinations are drawn too, so the
sketch's four destinations all go somewhere.

### Task 10 — the Live TV page in the app

The port of the prototype's page, the `iptv` module, and the hand-off.

Risk: medium for the page, high for the credentials (they are the owner's IPTV login, in
a second app). Measure: the preview app shows the guide with the owner's own provider
login; pressing a programme opens OpenTV; with no login, the public feed fills the guide
for the UK; a failed provider fetch leaves the public feed in place instead of an error.

## What is not in this stage

- The **kids face's strings are still English** in the twenty-five other languages (thirty-
  eight keys each). Still deferred: the overhaul changes those strings, so they are
  translated once and not twice.
- The **screensaver's starfield** stays native. It is a dream service that draws with
  `Canvas`, and nothing in the sketch touches it.
- The **film picks' data layer** stays as it is for the first release: the TMDB key, the
  cache in `recs` and `recs_history`, and the sorting by `vote_average`. The RN app reads
  the same caches through the native module, so the household does not lose its history.
- The **26 catalogues** are read by the RN app from the same JSON files in `variant/assets/
  i18n/`, copied into the app as an asset at build time. One set of strings, one place to
  translate.
- The **app's own mark** is done (stage 3). The banner and the icon stay as they are.
