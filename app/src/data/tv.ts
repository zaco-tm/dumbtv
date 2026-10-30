import {
  apps,
  inputs,
  PREF_FILES,
  prefs,
  type HomeInput,
  type TvApp,
} from '../native';

/**
 * The television's own data: the apps on it, the inputs on it, and the house's favourites.
 *
 * The apps and the inputs come from the native side, which asks the television. The rule that
 * tells a game from a streaming app is here, in the JavaScript, where it can be read and
 * tested: the store's category is the store's own, out of the app's manifest, and the native
 * side only carries it over.
 */

/** The store's categories, as `ApplicationInfo` has them. */
export const APP_CATEGORY = {
  GAME: 0,
  AUDIO: 1,
  VIDEO: 2,
  IMAGE: 3,
  SOCIAL: 4,
  NEWS: 5,
} as const;

/** The categories that are somebody else's video or music. */
const MEDIA_CATEGORIES: number[] = [
  APP_CATEGORY.AUDIO,
  APP_CATEGORY.VIDEO,
  APP_CATEGORY.IMAGE,
  APP_CATEGORY.SOCIAL,
  APP_CATEGORY.NEWS,
];

/**
 * What kind of app this is.
 *
 * A game is a game: the store says so. A streaming app is in one of the media categories. An app
 * that is neither is a streaming app too, because a television has nowhere else to put it.
 *
 * One thing to know about the number. `CATEGORY_GAME` is zero, and an app that declares no
 * category at all is *also* zero: the field is a plain int with no "unset" of its own, and
 * Android exposes no second copy of the category anywhere else. So the number alone cannot say
 * whether an app is a game or whether nobody ever said — and on a television where most apps
 * were put there by hand, nobody ever said is the common case.
 *
 * The installer says it instead. A store writes the category into the app it installs; an app
 * that was sideloaded has neither a store nor a category. So the two go together: zero plus a
 * store means the store said "game", and zero without a store means nobody said anything, which
 * is not the same thing.
 *
 * The consequence is worth stating plainly: a sideloaded game is a streaming app as far as this
 * rule is concerned, and the Gaming page is then filled by what the store installed, or by what
 * the house pins. That is measured on the television in task 9, and the rule can change then —
 * the numbers cross the bridge either way.
 */
export function kindOf(category: number, installedBy?: string): 'game' | 'streaming' {
  if (MEDIA_CATEGORIES.includes(category)) {
    return 'streaming';
  }
  if (category === APP_CATEGORY.GAME && installedBy) {
    return 'game';
  }
  return 'streaming';
}

/** The television's apps, split into the two pages they belong on. */
export function splitApps(all: TvApp[]): {streaming: TvApp[]; games: TvApp[]} {
  const streaming: TvApp[] = [];
  const games: TvApp[] = [];
  for (const app of all) {
    (kindOf(app.category, app.installedBy) === 'game' ? games : streaming).push(app);
  }
  return {streaming, games};
}

/** The apps on the television. */
export function loadApps(): Promise<TvApp[]> {
  return apps.list();
}

/** The television's HDMI inputs, with the consoles among them. */
export function loadInputs(): Promise<HomeInput[]> {
  return inputs.list();
}

/** One thing the house pinned: an app or an input. */
export type FavoriteEntry =
  | {kind: 'app'; key: string; label: string; icon: string}
  | {kind: 'input'; key: string; label: string; detail: string};

/** The key the favourites list is kept under, in the home screen's own file. */
export const FAVORITES_KEY = 'favorites';

/**
 * The house's favourites: the apps and the inputs they pinned, in the order they put them.
 *
 * The list is a line of keys in the home screen's own file (`home-ui`), separated by commas: an
 * app's package name, or an input's key. A key that names nothing that is on the television
 * any more is left out: the app was uninstalled, and a tile that opens nothing is worse than
 * no tile.
 */
export async function loadFavorites(): Promise<FavoriteEntry[]> {
  const [pinned, allApps, allInputs] = await Promise.all([
    prefs.get(PREF_FILES.homeUi, FAVORITES_KEY),
    loadApps(),
    loadInputs(),
  ]);
  const keys = String(pinned ?? '')
    .split(',')
    .map(key => key.trim())
    .filter(key => key.length > 0);
  const entries: FavoriteEntry[] = [];
  for (const key of keys) {
    const app = allApps.find(candidate => candidate.package === key);
    if (app) {
      entries.push({kind: 'app', key: app.package, label: app.label, icon: app.icon});
      continue;
    }
    const input = allInputs.find(candidate => candidate.key === key);
    if (input) {
      entries.push({
        kind: 'input',
        key: input.key,
        label: input.label,
        detail: input.detail,
      });
    }
  }
  return entries;
}
