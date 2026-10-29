/**
 * The Live TV page's data. Mock, like everything else in the prototype: the guide comes
 * from the IPTV provider (or a public EPG feed) in the app, and from OpenTV's own guide
 * if the integration goes that way. The shape of the data is the same either way.
 */

export type Programme = {
  title: string
  from: string
  to: string
  /** How far through the programme we are, 0 to 1. */
  progress: number
}

export type Channel = {
  id: string
  name: string
  number: number
  now: Programme
  next: Programme
}

export type Event = {
  time: string
  title: string
  channel: string
  /** A label, not a flourish: Live, Sports, New. */
  badge?: "Live" | "Sports" | "New"
}

export const CHANNELS: Channel[] = [
  {
    id: "bbc-one",
    name: "BBC One",
    number: 1,
    now: { title: "The News at Six", from: "18:00", to: "18:30", progress: 0.64 },
    next: { title: "Match of the Day", from: "20:30", to: "22:00", progress: 0 },
  },
  {
    id: "itv",
    name: "ITV",
    number: 3,
    now: { title: "Coronation Street", from: "18:00", to: "19:00", progress: 0.64 },
    next: { title: "The Voice", from: "20:00", to: "22:00", progress: 0 },
  },
  {
    id: "sky-sports",
    name: "Sky Sports Main Event",
    number: 401,
    now: { title: "Sky Sports News", from: "18:00", to: "18:30", progress: 0.64 },
    next: { title: "Premier League: Arsenal v Chelsea", from: "20:00", to: "22:15", progress: 0 },
  },
  {
    id: "bbc-two",
    name: "BBC Two",
    number: 2,
    now: { title: "Your Home", from: "17:00", to: "19:00", progress: 0.85 },
    next: { title: "The Great Bake Off", from: "19:00", to: "20:00", progress: 0 },
  },
  {
    id: "channel-4",
    name: "Channel 4",
    number: 4,
    now: { title: "Channel 4 News", from: "18:00", to: "18:30", progress: 0.64 },
    next: { title: "The Wire", from: "21:30", to: "22:30", progress: 0 },
  },
  {
    id: "e4",
    name: "E4",
    number: 14,
    now: { title: "Hollyoaks", from: "18:00", to: "19:00", progress: 0.64 },
    next: { title: "Taskmaster", from: "21:00", to: "22:00", progress: 0 },
  },
  {
    id: "dave",
    name: "Dave",
    number: 12,
    now: { title: "Storage Hunters", from: "17:00", to: "18:00", progress: 1 },
    next: { title: "Comedy Garage", from: "20:00", to: "21:00", progress: 0 },
  },
]

export const TONIGHT: Event[] = [
  {
    time: "19:00",
    title: "News at Six",
    channel: "BBC One",
    badge: "New",
  },
  {
    time: "20:00",
    title: "Premier League: Arsenal v Chelsea",
    channel: "Sky Sports Main Event",
    badge: "Live",
  },
  {
    time: "20:00",
    title: "The Voice",
    channel: "ITV",
    badge: "Sports",
  },
  {
    time: "21:00",
    title: "Taskmaster",
    channel: "E4",
  },
  {
    time: "21:30",
    title: "The Wire",
    channel: "Channel 4",
  },
  {
    time: "22:00",
    title: "Match of the Day",
    channel: "BBC One",
    badge: "Sports",
  },
]
