# Stage 3 — AverageTV: the brand, then the home screen the owner drew

Branch: `feat/variant-launcher`. Stage 2 (one product in the repo) is done and pushed.

This plan has two parts: the rename that is already implemented and measured on the
television, and the overhaul of the home screen from the owner's sketch. The second part
is written as steps, each of which can be built, measured on the television and shipped
on its own.

## 1. The name (done)

The owner renamed the product: **AverageTV**, "a play between smart and dumb".

| Surface | Before | Now |
|---|---|---|
| App label (the tile on the TV) | `dumbtv home (variant)` | `AverageTV` |
| Guard label (TV → Settings → Accessibility) | `dumbtv home (variant) button` | `AverageTV guard` |
| Settings screen title and the mode switch | `Free My TV` | `AverageTV` |
| Log tag | `FreeMyTV` | `AverageTV` |

Two things had to move with it, and both would have broken silently:

- **The Turkish translation** (`variant/assets/i18n/tr.json`) keys on the English string.
  Renaming the English without renaming the keys leaves those strings untranslated. The
  keys and the values moved together, and the two sentences that were rewritten (the Fire
  TV refusal and the TV-model refusal) were translated by hand.
- **`variant/local-changes.txt`**: the rename touched thirteen files that are upstream's.
  The vendor check fails on a file that differs from upstream and is not listed, and also
  on a file that is listed but no longer differs. The list now says what it should.

The guard label must stay different from the fallback launcher's (`dumbtv home button`),
because `dumpsys accessibility` names a bound service by its label and never by its
component. The two now part at the first character, so no cut of the label can make one
look like the other.

### Also fixed while renaming

- **The self-updater pointed at another project.** `Updates.java` looked at
  `simbasjungles/free-my-tv`'s releases. It was inert (the check only runs for an app
  signed with upstream's release key, which this fork is not), but it would have pulled
  another project's APK the moment that changed. It now looks at this repository's
  releases and stays off until we publish our own.
- **The Fire OS refusal told the user something false.** It said "AverageTV stays an app
  here: open it from your apps" — upstream's sentence, true for an app with no guard,
  false for ours: on Fire TV the fork *does* take the HOME key, with its guard. It now
  says that, and that the switch cannot change it.
- **The style name** `FreeMyTV.Home` → `AverageTV.Home`, and the app's `User-Agent`
  string with it.

### Measured on the television (Ember 55)

- `./variant/install.sh` → `home: AverageTV 1.0`.
- `dumpsys accessibility` → `Service[label=AverageTV guard` — the label prints whole.
- `./scripts/verify.sh` → all checks passed, and it says
  `ok home AverageTV: bound, front is tv.dumbtv.variant/io.freemytv.HomeActivity`.
- The PIN gate and the settings screen both read **AverageTV**, and the settings show
  `AverageTV — No ads, with the new screensaver` against `Original — The TV's factory
  home screen`.

## 2. The home screen the owner drew

The sketch: a left rail with **Home / Live TV / Apps / Inputs** and a settings gear and
the kids face at the bottom; a header with a greeting and a weather widget; a
**Favorites** row that mixes apps and inputs; and **Trending** as a big feature with a
ranked list beside it, each with a star rating.

That is a different information architecture from the one upstream has, not a skin over
it. Upstream's home is tabs of carousels (Explore / Movies / Shows) with a shelf of apps
at the bottom. The sketch is one long list of sections. Everything below is written on
that assumption.

The normal face is a hand-drawn `ViewGroup` (`HomeView extends ViewGroup`, with its own
focus handling and a `Choreographer`-driven animation), not a RecyclerView. That is the
fact that decides the order: a new row is a drawing job, and the rail is a drawing job
*plus* a new focus path.

### Step 1 — the greeting and the weather in the normal face

Already built, in the kids face: `KidsView` greets by time of day, shows a short
weather line under it, and has a full forecast card with the temperature, sunrise and
sunset. The normal face has the weather only in a drawer card.

What to do: draw the greeting and the weather in the normal face's header, without a
name (the owner's decision: "Good morning" and the weather, nothing that has to be
configured).

Risk: low. The pieces exist; this is moving them and leaving the child's name out.

Measure: a screenshot of the normal face at two times of day, and one with the TV's
network off (the greeting must still read).

### Step 2 — Favorites

Does not exist. Today the shelf is a list of packages in a preference, with a drag
editor, and the inputs live in the drawer and in the top buttons. The sketch's row
mixes both kinds.

What to do:

- A model that holds both kinds: a pinned list of entries `{kind: app|input, key}` in
  `Prefs`, next to the shelf's own preference.
- A picker: the app list already has the "All Apps" sheet, and `HomeApps` already knows
  the inputs and their names. Both can be reused.
- An editor: the shelf's drag editor ("← → to move · OK to drop") is the pattern to
  copy.
- Drawing: plain tiles — an app's icon and name, an input's name — not posters.

Risk: medium. The model and the persistence are small; the focus and the editor are the
work, and the editor has to reorder across two kinds of entry.

Measure: pin Netflix and HDMI 1, reorder them, restart the app, and reboot the TV: the
row is the same. Then unpin everything: the row disappears rather than showing an empty
strip.

### Step 3 — Trending as a section

The data is already there: `Recs` fetches TMDB's trending and sorts by `vote_average`,
which is the rating the sketch's stars want.

What to do: the layout — one large feature on the left (poster, title, metadata) and
three or four ranked rows on the right, each with a small thumb, a title, a second line
and a star rating.

Risk: medium. The data and the sorting are done; the drawing and the rating widget are
new. `Symbols` and `Glyphs` already draw the star shapes the fork uses.

Measure: the section renders with live TMDB data, the ratings match what the API
returned, and an empty or failed fetch leaves the section out rather than showing an
error.

### Step 4 — the left rail

The expensive one, and the reason it goes last: it rewires how everything else is
reached.

What to do:

- A rail column: Home, Live TV, Apps, Inputs, then the gear and the kids face at the
  bottom. The kids face moves out of the top-right corner, which is an improvement —
  a child should not have to hunt for it.
- A focus model: up and down inside the rail, left and right between the rail and the
  content. The current home screen has its own hand-rolled focus handling; the rail
  has to join it, not fight it.
- Four destinations: Live TV, the apps sheet and the inputs exist today as actions
  (the round top buttons and the drawer); as destinations they need their own screens,
  or the rail's items have to open what the buttons open.

Risk: high, and it is the one that can break the parts that work. The kids face has its
own view and its own focus model, and it must survive the change untouched.

Measure: every destination is reachable with the remote alone, in a few presses; the
focus never lands nowhere; the kids face is still one press away; the sleep timer and
the PIN keep working.

### Step 5 — the app's own mark

The four-pointed sparkle next to the app's name (in the settings, and as the tile that
opens them) is upstream's mark, and it is exactly the kind of decorative glyph the owner
has ruled out. Now that the product has a name of its own, the mark should be AverageTV's
too — or there should not be one, and the word alone carries it.

That is the owner's call: a wordmark on its own, or a simple mark of ours.

### What is not in this stage

- The app id stays `tv.dumbtv.variant`. Renaming it would make the app a different app
  on the television: the old one has to be uninstalled, the PIN and the children's
  settings are lost, and the guard has to be bound again. It is invisible to the user,
  so it is not worth the migration unless the owner wants it.
- The screenshots in `docs/assets/` still show the old launcher. New ones come with the
  overhaul.
