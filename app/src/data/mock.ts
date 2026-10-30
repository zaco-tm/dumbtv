/**
 * PLACEHOLDER DATA — the prototype's mock data, copied here so the screen has
 * something to draw.
 *
 * The prototype's data is mock data: no key, no network, no account. What the app can
 * read for real today comes from the native side, and it lives in src/data/tv.ts: the
 * television's apps, its inputs, and the house's favourites. What is left here is the
 * weather and the trending picks, which come off the network (open-meteo and TMDB), and
 * that is task 10's work.
 *
 * The prototype's app lists and input lists are gone from here on purpose: the native
 * side answers those now, with the television's own apps and the names the television
 * gives its ports.
 */

export type Weather = {
  place: string;
  temperature: number;
  summary: string;
  high: number;
  low: number;
  sunrise: string;
  sunset: string;
};

export const WEATHER: Weather = {
  place: 'Berlin',
  temperature: 12,
  summary: 'Light rain',
  high: 14,
  low: 7,
  sunrise: '06:24',
  sunset: '18:12',
};

export type Trend = {
  rank: number;
  title: string;
  year: number;
  meta: string;
  rating: number;
  poster: string;
  feature: boolean;
};

export const TRENDING: Trend[] = [
  {
    rank: 1,
    title: 'The Salt Path',
    year: 2025,
    meta: 'Drama · 2h 04m',
    rating: 8.4,
    poster: 'salt-path',
    feature: true,
  },
  {
    rank: 2,
    title: 'Quiet Hours',
    year: 2026,
    meta: 'Thriller · 1h 48m',
    rating: 7.9,
    poster: 'quiet-hours',
    feature: false,
  },
  {
    rank: 3,
    title: 'Nine Kinds of Weather',
    year: 2025,
    meta: 'Documentary · 52m',
    rating: 7.6,
    poster: 'nine-weather',
    feature: false,
  },
  {
    rank: 4,
    title: 'The Long Field',
    year: 2024,
    meta: 'Comedy · 1h 31m',
    rating: 7.2,
    poster: 'long-field',
    feature: false,
  },
  {
    rank: 5,
    title: 'Frostlight',
    year: 2026,
    meta: 'Sci-Fi · 2h 21m',
    rating: 6.9,
    poster: 'frostlight',
    feature: false,
  },
];
