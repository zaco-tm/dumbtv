import {iptv, type TvChannel, type TvEvent, type TvProgramme} from '../native';

/**
 * Live TV's data.
 *
 * The native side holds the provider's credentials and parses the guide; what is left
 * here is the arithmetic a television does with it — what is on now, how far through it
 * we are, what is on tonight — and the formatting of the times.
 *
 * It is here, and not in the native side, because this is the part jest can hold: the
 * clock is the television's clock and the page is the television's page.
 */

/** A label on an event. It says what the event is; it is not a flourish. */
export type Badge = 'Live' | 'Sports' | 'New';

/** The label for an event, if it has one. */
export function badgeFor(event: TvEvent, now: number): Badge | undefined {
  if (event.from <= now && event.to > now) {
    return 'Live';
  }
  const category = event.category.toLowerCase();
  if (category.includes('sport')) {
    return 'Sports';
  }
  if (category.includes('news')) {
    return 'New';
  }
  return undefined;
}

/**
 * How far through a programme we are, from 0 to 1.
 *
 * A programme with no length has no progress to show, and the bar stays empty rather
 * than pretending to be at the end.
 */
export function progressFor(programme: TvProgramme | null, now: number): number {
  if (!programme) {
    return 0;
  }
  const length = programme.to - programme.from;
  if (length <= 0) {
    return 0;
  }
  const done = now - programme.from;
  if (done <= 0) {
    return 0;
  }
  if (done >= length) {
    return 1;
  }
  return done / length;
}

/** A time, as the television writes it: 19:00. */
export function formatTime(milliseconds: number): string {
  const date = new Date(milliseconds);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Tonight's events: what is on now, and what is still to come today.
 *
 * The day's end is the television's midnight, so the list is the evening rather than
 * the next twenty-four hours.
 */
export function tonight(events: TvEvent[], now: number): TvEvent[] {
  const endOfDay = new Date(now);
  endOfDay.setHours(24, 0, 0, 0);
  return events
    .filter(event => event.to > now && event.from < endOfDay.getTime())
    .sort((a, b) => a.from - b.from);
}

/** The channels, with the ones that are on now first. */
export function byNow(channels: TvChannel[], now: number): TvChannel[] {
  return [...channels].sort((a, b) => {
    const aOn = a.now && a.now.from <= now && a.now.to > now ? 0 : 1;
    const bOn = b.now && b.now.from <= now && b.now.to > now ? 0 : 1;
    if (aOn !== bOn) {
      return aOn - bOn;
    }
    if (a.number && b.number && a.number !== b.number) {
      return a.number - b.number;
    }
    return a.name.localeCompare(b.name);
  });
}

/** What the Live TV page shows. */
export type LiveTv = {
  /** The channels, and what is on them. */
  channels: TvChannel[];
  /** Tonight's events. */
  events: TvEvent[];
  /** Whether a source is stored at all. */
  configured: boolean;
  /** Whether the source is reached over an encrypted connection. */
  secure: boolean;
};

/**
 * The page's data, read from the native side.
 *
 * A source that is not there, or a provider that is down, is an empty page rather than
 * an error: the television shows what it has.
 */
export async function loadLiveTv(): Promise<LiveTv> {
  const source = await iptv.source();
  if (!source) {
    return {channels: [], events: [], configured: false, secure: true};
  }
  const [channels, events] = await Promise.all([iptv.channels(), iptv.guide()]);
  return {
    channels,
    events,
    configured: true,
    secure: source.secure,
  };
}
