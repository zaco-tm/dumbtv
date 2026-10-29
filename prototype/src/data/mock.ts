/**
 * The prototype's data is mock data: no key, no network, no account. The app gets the
 * real thing from the same places the Java app does (open-meteo for the weather, TMDB for
 * the picks), but the design can be settled without either.
 */

export type AppEntry = { kind: "app"; key: string; label: string }
export type InputEntry = { kind: "input"; key: string; label: string; detail: string }
export type FavoriteEntry = AppEntry | InputEntry

export const FAVORITES: FavoriteEntry[] = [
  { kind: "app", key: "com.netflix.ninja", label: "Netflix" },
  { kind: "app", key: "com.amazon.avod", label: "Prime Video" },
  { kind: "input", key: "hdmi1", label: "HDMI 1", detail: "PlayStation" },
  { kind: "app", key: "com.spotify.tv.android", label: "Spotify" },
  { kind: "input", key: "hdmi2", label: "HDMI 2", detail: "Not connected" },
  { kind: "app", key: "tv.dumbtv.variant", label: "AverageTV" },
]

export type Weather = {
  place: string
  temperature: number
  summary: string
  high: number
  low: number
  sunrise: string
  sunset: string
}

export const WEATHER: Weather = {
  place: "Berlin",
  temperature: 12,
  summary: "Light rain",
  high: 14,
  low: 7,
  sunrise: "06:24",
  sunset: "18:12",
}

export type Trend = {
  rank: number
  title: string
  year: number
  meta: string
  rating: number
  poster: string
  feature: boolean
}

export const TRENDING: Trend[] = [
  {
    rank: 1,
    title: "The Salt Path",
    year: 2025,
    meta: "Drama · 2h 04m",
    rating: 8.4,
    poster: "salt-path",
    feature: true,
  },
  {
    rank: 2,
    title: "Quiet Hours",
    year: 2026,
    meta: "Thriller · 1h 48m",
    rating: 7.9,
    poster: "quiet-hours",
    feature: false,
  },
  {
    rank: 3,
    title: "Nine Kinds of Weather",
    year: 2025,
    meta: "Documentary · 52m",
    rating: 7.6,
    poster: "nine-weather",
    feature: false,
  },
  {
    rank: 4,
    title: "The Long Field",
    year: 2024,
    meta: "Comedy · 1h 31m",
    rating: 7.2,
    poster: "long-field",
    feature: false,
  },
  {
    rank: 5,
    title: "Frostlight",
    year: 2026,
    meta: "Sci-Fi · 2h 21m",
    rating: 6.9,
    poster: "frostlight",
    feature: false,
  },
]

export type AppEntry2 = { key: string; label: string }

export const TV_APPS: AppEntry2[] = [
  { key: "com.netflix.ninja", label: "Netflix" },
  { key: "com.amazon.avod", label: "Prime Video" },
  { key: "com.disney.disneyplus", label: "Disney+" },
  { key: "com.amazon.amazonvideo.livingroomplus", label: "YouTube" },
  { key: "com.spotify.tv.android", label: "Spotify" },
  { key: "com.plexapp.android", label: "Plex" },
  { key: "org.jellyfin.androidtv", label: "Jellyfin" },
  { key: "tv.dumbtv.variant", label: "AverageTV" },
  { key: "com.twitch.android.app", label: "Twitch" },
  { key: "org.kodi.team.android", label: "Kodi" },
  { key: "com.retro.arch", label: "RetroArch" },
  { key: "app.opentv", label: "OpenTV" },
]

export type TvInput = { key: string; label: string; detail: string; connected: boolean }

export const TV_INPUTS: TvInput[] = [
  { key: "live-tv", label: "Live TV", detail: "Antenna or cable", connected: true },
  { key: "hdmi1", label: "HDMI 1", detail: "PlayStation", connected: true },
  { key: "hdmi2", label: "HDMI 2", detail: "Nothing plugged in", connected: false },
  { key: "hdmi3", label: "HDMI 3", detail: "Nothing plugged in", connected: false },
  { key: "hdmi4", label: "HDMI 4", detail: "Nothing plugged in", connected: false },
]
