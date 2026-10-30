import {apps, inputs, prefs} from '../src/native';
import {APP_CATEGORY, kindOf, loadFavorites, splitApps} from '../src/data/tv';

jest.mock('../src/native', () => ({
  apps: {list: jest.fn()},
  inputs: {list: jest.fn()},
  prefs: {get: jest.fn()},
  PREF_FILES: {settings: 'settings', homeUi: 'home-ui'},
}));

const listApps = apps.list as jest.Mock;
const listInputs = inputs.list as jest.Mock;
const get = prefs.get as jest.Mock;

beforeEach(() => {
  listApps.mockReset();
  listInputs.mockReset();
  get.mockReset();
});

test('a game is a game, and everything else is somebody else’s video', () => {
  // A store that installed the app also declared its category: zero means a game.
  expect(kindOf(APP_CATEGORY.GAME, 'com.android.vending')).toBe('game');
  expect(kindOf(APP_CATEGORY.AUDIO, 'com.android.vending')).toBe('streaming');
  expect(kindOf(APP_CATEGORY.VIDEO, 'com.android.vending')).toBe('streaming');
  expect(kindOf(APP_CATEGORY.IMAGE, 'com.android.vending')).toBe('streaming');
  expect(kindOf(APP_CATEGORY.SOCIAL, 'com.android.vending')).toBe('streaming');
  expect(kindOf(APP_CATEGORY.NEWS, 'com.android.vending')).toBe('streaming');
  // A category nobody knows about is not a game: a television has nowhere else to put it.
  expect(kindOf(99, 'com.android.vending')).toBe('streaming');
});

test('an app with no category and no installer is not a game', () => {
  // Zero is the game's number, and it is also the number of an app nobody declared. An app
  // that was put on the television by hand has no store and no category, so it is not a game:
  // otherwise every sideloaded app on the television would land on the Gaming page.
  expect(kindOf(APP_CATEGORY.GAME)).toBe('streaming');
  expect(kindOf(APP_CATEGORY.GAME, '')).toBe('streaming');
});

test('the apps are split into the two pages they belong on', () => {
  const {streaming, games} = splitApps([
    {
      package: 'com.netflix.ninja',
      label: 'Netflix',
      icon: '',
      category: 2,
      installedBy: 'com.android.vending',
    },
    {
      package: 'org.ppsspp.ppsspp',
      label: 'PPSSPP',
      icon: '',
      category: 0,
      installedBy: 'com.android.vending',
    },
    {
      package: 'com.spotify.tv.android',
      label: 'Spotify',
      icon: '',
      category: 1,
      installedBy: 'com.android.vending',
    },
    // Sideloaded, so nobody declared a category: a streaming app, not a game.
    {
      package: 'org.retroarch',
      label: 'RetroArch',
      icon: '',
      category: 0,
      installedBy: '',
    },
  ]);
  expect(streaming.map(app => app.package)).toEqual([
    'com.netflix.ninja',
    'com.spotify.tv.android',
    'org.retroarch',
  ]);
  expect(games.map(app => app.package)).toEqual(['org.ppsspp.ppsspp']);
});

test('the favourites are the pinned apps and inputs, in the order they were pinned', async () => {
  get.mockResolvedValue('com.netflix.ninja,hdmi1,com.example.gone');
  listApps.mockResolvedValue([
    {package: 'com.netflix.ninja', label: 'Netflix', icon: '/cache/icons/netflix.png', category: 2},
  ]);
  listInputs.mockResolvedValue([
    {key: 'hdmi1', label: 'PlayStation 5', detail: 'connected', isConsole: true},
  ]);

  const favorites = await loadFavorites();

  expect(favorites).toEqual([
    {
      kind: 'app',
      key: 'com.netflix.ninja',
      label: 'Netflix',
      icon: '/cache/icons/netflix.png',
    },
    {kind: 'input', key: 'hdmi1', label: 'PlayStation 5', detail: 'connected'},
  ]);
  // The app that is not on the television any more is left out: a tile that opens nothing is
  // worse than no tile.
  expect(favorites).toHaveLength(2);
  expect(get).toHaveBeenCalledWith('home-ui', 'favorites');
});

test('nothing pinned is nothing to show', async () => {
  get.mockResolvedValue(null);
  listApps.mockResolvedValue([]);
  listInputs.mockResolvedValue([]);

  expect(await loadFavorites()).toEqual([]);
});
