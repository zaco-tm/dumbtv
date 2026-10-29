# AverageTV — the parity table

What the prototype (`prototype/`) uses, and what the React Native app (`app/`) has to
have. The prototype is the specification: **a port is done when the prototype's behaviour
is matched**, not when its code looks similar.

The rule that keeps the two honest: the prototype's tokens are the source, and
`app/tools/gen-tokens.mjs` writes the app's `tokens.ts` from the prototype's CSS. If a
colour changes in one, it changes in both, and there is nothing to remember.

## The components

| In the prototype | In the app | What the port has to match |
|---|---|---|
| `@charcoal/line-sidebar` (`src/components/ui/line-sidebar.tsx`) | `app/src/ui/charcoal/Rail.tsx` | The items, the label beside the icon, the active line in ember, the spring (stiffness 360, damping 34), the reduced-motion case. The television's differences: the rail is **always open** (there is no pointer), the sizes are the television's (60px rows, 26px icons, 22px labels), and the items sit at the **top** with the gear and the children's face at the bottom. The prototype's copy of the component was edited for exactly these three things; the port carries them over. |
| `@charcoal/rating` (`src/components/ui/rating.tsx`) | `app/src/ui/charcoal/Rating.tsx` | Five stars, the filled ones in ember, the empty one outlined and muted. Always **read-only** in the app: the rating is data, not something a television lets you change, so it never takes the focus. |
| `@charcoal/carousel` (`src/components/ui/carousel.tsx`) | — | **Not ported.** The sketch has no carousel: the Favorites row and the ranked list are driven by the focus, not by dragging. It is installed in the prototype because it is free, and it is left there unused rather than ported for its own sake. |
| The theme's card and button primitives | `app/src/ui/charcoal/Card.tsx`, `Button.tsx` | The surface colours, the radii, the ring. Only what the screen actually uses. |
| The theme's CSS variables | `app/src/ui/charcoal/tokens.ts` | **Generated**, never hand-copied: `background`, `foreground`, `card`, `muted`, `muted-foreground`, `border`, `ring`, `ember`, `ember-foreground`, `ember-glow`, `success`, `destructive`, and the radii. Light and dark. |
| The theme's fonts | `app/src/ui/charcoal/tokens.ts` | Inter Variable. The app already ships Inter (`variant/assets/fonts/InterVariable.ttf`), and the prototype was switched to it so that the two look the same. |

## The parts that are not components

| In the prototype | In the app | Notes |
|---|---|---|
| `src/lib/tvFocus.ts` — the grid focus model | `app/src/ui/focus.ts` | Every focusable says where it is (`data-row`, `data-col`); an arrow key moves to the nearest one in that direction. The rail is column 0. The same rules, in TypeScript, with the same measurements. |
| `src/lib/fit.ts` — the 1920×1080 stage | `app/src/ui/stage.ts` | The television's screen is the stage; there is no scaling there. The numbers in the prototype are the television's pixels, and the app's density decides how many of them a dp is. |
| `src/data/mock.ts` | the native modules | The prototype's data is mock data. The app's comes from the same places the Java app uses: open-meteo for the weather, TMDB for the picks, the native modules for the apps and the inputs. |
| `src/sections/*` | `app/src/screens/Home.tsx` | The greeting, the Favorites row, the Trending section. |

## What the app has that the prototype does not

The prototype is the design. These are the parts of the product that Android itself needs,
and they stay native — they are not ports:

| Native | Why |
|---|---|
| `io.freemytv.Guard` | An accessibility service. Its class name must not change, or the service is unbound when the app is replaced. |
| `io.freemytv.HomeActivity` | The host activity. The Guard compares the window's **simple class name** with `"HomeActivity"`, so the React Native host keeps that exact name. |
| `io.freemytv.KidsView`, `ParentLock` | The children's face and its PIN gate. They stay as they are. |
| `io.freemytv.Input`, `SleepBlank`, `SleepOverlay` | The inputs and the sleep timer. |
| `io.freemytv.Screensaver`, `NowPlaying`, `HomeReceiver`, `ModeJob`, `PhotoInbox` | The dream service, the notification listener, the boot receiver, the content provider. |

The native modules the app's JavaScript calls:

| Module | What it answers |
|---|---|
| `parent_pin` | `check(pin)`, `set(pin)` — the hash stays in the `parent_pin` preference file, in the format it has today. |
| `home_mode` | `isHome()`, `setHome(on)`, `refresh()` — whether this app is the home screen. |
| `inputs` | `list()` — the HDMI inputs and their names. |
| `sleep` | `start(minutes)`, `cancel()` — the sleep timer. |
| `prefs` | `get`/`set` for `settings` and `home-ui` (the Favorites list). |
| `night` | `isNight()` — for the Guard's cover colour, which must match the sky the home screen is about to paint. |

## The preferences are a contract

The household's settings live in `settings`, `kids_settings`, `parent_pin`, `home-ui`,
`homedata`, `recs` and `recs_history`. The final install is in place — the same id, the
same signing key — so these survive, **but only if the app reads and writes the same
names and the same formats**. `parent_pin` holds a salted hash, not a PIN.
