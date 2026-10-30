import {iptv, type TvChannel, type TvEvent} from '../src/native';
import {badgeFor, byNow, formatTime, loadLiveTv, progressFor, tonight} from '../src/data/livetv';

jest.mock('../src/native', () => ({
  iptv: {
    source: jest.fn(),
    channels: jest.fn(),
    guide: jest.fn(),
  },
}));

const source = iptv.source as jest.Mock;
const channels = iptv.channels as jest.Mock;
const guide = iptv.guide as jest.Mock;

beforeEach(() => {
  source.mockReset();
  channels.mockReset();
  guide.mockReset();
});

/** A moment in the evening. */
const EVENING = new Date(2026, 0, 1, 19, 0, 0).getTime();

function event(over: Partial<TvEvent> = {}): TvEvent {
  return {
    title: 'The News at Six',
    from: EVENING,
    to: EVENING + 30 * 60 * 1000,
    category: 'News',
    channelId: 'bbc-one.uk',
    channelName: 'BBC One',
    ...over,
  };
}

function channel(over: Partial<TvChannel> = {}): TvChannel {
  return {
    id: '1',
    name: 'BBC One',
    number: 1,
    group: 'News',
    logo: '',
    now: {title: 'The News at Six', from: EVENING - 10 * 60 * 1000, to: EVENING + 20 * 60 * 1000, category: 'News'},
    next: null,
    ...over,
  };
}

test('what is on now is labelled Live', () => {
  expect(badgeFor(event(), EVENING)).toBe('Live');
});

test('a programme that has finished is not Live', () => {
  const past = event({from: EVENING - 60 * 60 * 1000, to: EVENING - 30 * 60 * 1000});
  expect(badgeFor(past, EVENING)).toBe('New');
});

test('a sports programme is labelled Sports', () => {
  const match = event({category: 'Sports', from: EVENING + 60 * 60 * 1000, to: EVENING + 3 * 60 * 60 * 1000});
  expect(badgeFor(match, EVENING)).toBe('Sports');
});

test('a programme with no category has no label', () => {
  const plain = event({category: '', from: EVENING + 60 * 60 * 1000, to: EVENING + 3 * 60 * 60 * 1000});
  expect(badgeFor(plain, EVENING)).toBeUndefined();
});

test('the progress is how far through we are', () => {
  const programme = {
    title: 'The News at Six',
    from: EVENING - 30 * 60 * 1000,
    to: EVENING + 30 * 60 * 1000,
    category: 'News',
  };
  expect(progressFor(programme, programme.from)).toBe(0);
  expect(progressFor(programme, EVENING)).toBeCloseTo(0.5, 5);
  expect(progressFor(programme, programme.to)).toBe(1);
});

test('nothing on is no progress', () => {
  expect(progressFor(null, EVENING)).toBe(0);
});

test('a programme with no length has no progress', () => {
  const programme = {title: 'Nothing', from: EVENING, to: EVENING, category: ''};
  expect(progressFor(programme, EVENING)).toBe(0);
});

test('the time is written the way the television writes it', () => {
  expect(formatTime(new Date(2026, 0, 1, 19, 5, 0).getTime())).toBe('19:05');
  expect(formatTime(new Date(2026, 0, 1, 9, 30, 0).getTime())).toBe('09:30');
});

test('tonight is what is on now and what is still to come today', () => {
  const over = [
    event({title: 'Last night', from: EVENING - 4 * 60 * 60 * 1000, to: EVENING - 3 * 60 * 60 * 1000}),
    event({title: 'Now', from: EVENING - 10 * 60 * 1000, to: EVENING + 20 * 60 * 1000}),
    event({title: 'Later', from: EVENING + 60 * 60 * 1000, to: EVENING + 2 * 60 * 60 * 1000}),
    event({title: 'Tomorrow', from: EVENING + 26 * 60 * 60 * 1000, to: EVENING + 27 * 60 * 60 * 1000}),
  ];
  expect(tonight(over, EVENING).map(item => item.title)).toEqual(['Now', 'Later']);
});

test('tonight is in time order', () => {
  const over = [
    event({title: 'Later', from: EVENING + 60 * 60 * 1000, to: EVENING + 2 * 60 * 60 * 1000}),
    event({title: 'Sooner', from: EVENING + 10 * 60 * 1000, to: EVENING + 40 * 60 * 1000}),
  ];
  expect(tonight(over, EVENING).map(item => item.title)).toEqual(['Sooner', 'Later']);
});

test('the channels on now come first', () => {
  const over = [
    channel({id: '2', name: 'ITV', number: 3, now: null}),
    channel({id: '1', name: 'BBC One', number: 1}),
  ];
  expect(byNow(over, EVENING).map(item => item.name)).toEqual(['BBC One', 'ITV']);
});

test('with no source stored there is no page', async () => {
  source.mockResolvedValue(null);
  const page = await loadLiveTv();
  expect(page.configured).toBe(false);
  expect(page.channels).toEqual([]);
  expect(page.events).toEqual([]);
});

test('a source that is not encrypted is reported, not hidden', async () => {
  source.mockResolvedValue({
    kind: 'provider',
    host: 'provider.example.invalid',
    user: 'someone',
    url: '',
    secure: false,
  });
  channels.mockResolvedValue([channel()]);
  guide.mockResolvedValue([event()]);
  const page = await loadLiveTv();
  expect(page.configured).toBe(true);
  expect(page.secure).toBe(false);
  expect(page.channels).toHaveLength(1);
  expect(page.events).toHaveLength(1);
});
