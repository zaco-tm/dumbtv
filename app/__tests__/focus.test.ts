import {moveFocus, type FocusTarget} from '../src/ui/focus';

/**
 * The focus model's measurements.
 *
 * The television is off, so this is where the movements are proved: the fixtures below
 * are the prototype's page layouts — the rail's seven destinations, the Home screen's
 * bands, the Streaming page's grid, the Gaming page's consoles above its games and the
 * Live TV page's channels — and the expectations are the ones the prototype was
 * measured against.
 */

/** The rail: seven destinations in the rail's own order, all in column 0. */
const RAIL: FocusTarget[] = [
  {id: 'rail:home', row: 0, col: 0, page: 'home'},
  {id: 'rail:live-tv', row: 1, col: 0, page: 'live-tv'},
  {id: 'rail:streaming', row: 2, col: 0, page: 'streaming'},
  {id: 'rail:gaming', row: 3, col: 0, page: 'gaming'},
  {id: 'rail:inputs', row: 4, col: 0, page: 'inputs'},
  {id: 'rail:kids', row: 5, col: 0, page: 'kids'},
  {id: 'rail:settings', row: 6, col: 0, page: 'settings'},
];

/** The Home screen: Favorites in band 0, the feature in band 1, the ranked list below. */
const HOME: FocusTarget[] = [
  {id: 'favourite:netflix', row: 0, col: 1, page: 'home'},
  {id: 'favourite:prime', row: 0, col: 2, page: 'home'},
  {id: 'favourite:hdmi1', row: 0, col: 3, page: 'home'},
  {id: 'favourite:spotify', row: 0, col: 4, page: 'home'},
  {id: 'favourite:hdmi2', row: 0, col: 5, page: 'home'},
  {id: 'favourite:averagetv', row: 0, col: 6, page: 'home'},
  {id: 'trending:feature', row: 1, col: 1, page: 'home'},
  {id: 'trending:2', row: 2, col: 2, page: 'home'},
  {id: 'trending:3', row: 3, col: 2, page: 'home'},
  {id: 'trending:4', row: 4, col: 2, page: 'home'},
  {id: 'trending:5', row: 5, col: 2, page: 'home'},
];

/** The Streaming page: the apps in a grid of six columns. */
const STREAMING: FocusTarget[] = [
  {id: 'app:netflix', row: 0, col: 1, page: 'streaming'},
  {id: 'app:prime', row: 0, col: 2, page: 'streaming'},
  {id: 'app:disney', row: 0, col: 3, page: 'streaming'},
  {id: 'app:youtube', row: 0, col: 4, page: 'streaming'},
  {id: 'app:spotify', row: 0, col: 5, page: 'streaming'},
  {id: 'app:plex', row: 0, col: 6, page: 'streaming'},
  {id: 'app:jellyfin', row: 1, col: 1, page: 'streaming'},
  {id: 'app:averagetv', row: 1, col: 2, page: 'streaming'},
  {id: 'app:twitch', row: 1, col: 3, page: 'streaming'},
  {id: 'app:kodi', row: 1, col: 4, page: 'streaming'},
  {id: 'app:opentv', row: 1, col: 5, page: 'streaming'},
];

/**
 * The Gaming page: the consoles are band 0 and the games are the bands below, so the
 * right arrow from the rail lands on the first console and the down arrow walks the
 * games.
 */
const GAMING: FocusTarget[] = [
  {id: 'console:playstation', row: 0, col: 1, page: 'gaming'},
  {id: 'console:xbox', row: 0, col: 2, page: 'gaming'},
  {id: 'console:switch', row: 0, col: 3, page: 'gaming'},
  {id: 'game:retroarch', row: 2, col: 1, page: 'gaming'},
  {id: 'game:pandora', row: 2, col: 2, page: 'gaming'},
  {id: 'game:sudoku', row: 2, col: 3, page: 'gaming'},
  {id: 'game:ppsspp', row: 2, col: 4, page: 'gaming'},
];

/** The Live TV page: the channels are band 0 and the evening's events run down band 2. */
const LIVE_TV: FocusTarget[] = [
  {id: 'channel:bbc-one', row: 0, col: 1, page: 'live-tv'},
  {id: 'channel:bbc-two', row: 0, col: 2, page: 'live-tv'},
  {id: 'channel:itv', row: 0, col: 3, page: 'live-tv'},
  {id: 'event:news', row: 2, col: 1, page: 'live-tv'},
  {id: 'event:drama', row: 3, col: 1, page: 'live-tv'},
];

/** The rail and one page's targets, which is what the screen holds at a time. */
function screen(...pages: FocusTarget[][]): FocusTarget[] {
  return [...RAIL, ...pages.flat()];
}

test('right from the rail enters the page at its top-left', () => {
  expect(moveFocus(screen(HOME), 'rail:home', 'right', 'home')).toBe('favourite:netflix');
});

test('right from Streaming lands on the first app, not the seventh', () => {
  expect(moveFocus(screen(STREAMING), 'rail:streaming', 'right', 'streaming')).toBe(
    'app:netflix',
  );
});

test('right from Gaming lands on the first console, not a game', () => {
  expect(moveFocus(screen(GAMING), 'rail:gaming', 'right', 'gaming')).toBe(
    'console:playstation',
  );
});

test('right from Live TV lands on the first channel', () => {
  expect(moveFocus(screen(LIVE_TV), 'rail:live-tv', 'right', 'live-tv')).toBe(
    'channel:bbc-one',
  );
});

test('down from a favourite crosses to the Trending feature', () => {
  expect(moveFocus(screen(HOME), 'favourite:netflix', 'down', 'home')).toBe(
    'trending:feature',
  );
});

test('down from a console walks the games', () => {
  expect(moveFocus(screen(GAMING), 'console:playstation', 'down', 'gaming')).toBe(
    'game:retroarch',
  );
});

test('up from a game walks back to the console', () => {
  expect(moveFocus(screen(GAMING), 'game:retroarch', 'up', 'gaming')).toBe(
    'console:playstation',
  );
});

test('left from the content returns to the rail item of the page you are on', () => {
  expect(moveFocus(screen(STREAMING), 'app:jellyfin', 'left', 'streaming')).toBe(
    'rail:streaming',
  );
  expect(moveFocus(screen(GAMING), 'game:sudoku', 'left', 'gaming')).toBe('rail:gaming');
  expect(moveFocus(screen(HOME), 'trending:3', 'left', 'home')).toBe('rail:home');
});

test('up and down stay inside the rail', () => {
  expect(moveFocus(screen(HOME), 'rail:home', 'down', 'home')).toBe('rail:live-tv');
  expect(moveFocus(screen(HOME), 'rail:live-tv', 'up', 'home')).toBe('rail:home');
});

test('up and down stay inside the content', () => {
  // From the last of the ranked list, up walks the list and never slides into the rail.
  expect(moveFocus(screen(HOME), 'trending:5', 'up', 'home')).toBe('trending:4');
  // And from the content, down never slides into the rail either.
  expect(moveFocus(screen(HOME), 'trending:2', 'down', 'home')).toBe('trending:3');
});

test('the rail is a list of destinations, so down from its last item stays there', () => {
  expect(moveFocus(screen(HOME), 'rail:settings', 'down', 'home')).toBeNull();
});

test('right and left go nowhere when there is nothing in that direction', () => {
  expect(moveFocus(screen(HOME), 'favourite:averagetv', 'right', 'home')).toBeNull();
  expect(moveFocus(screen(HOME), 'rail:home', 'left', 'home')).toBeNull();
});

test('a focus that is not in the grid goes nowhere', () => {
  expect(moveFocus(screen(HOME), 'nowhere', 'right', 'home')).toBeNull();
});
