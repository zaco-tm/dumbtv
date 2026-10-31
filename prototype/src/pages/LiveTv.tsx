import { CHANNELS, TONIGHT, type Channel, type Event } from "@/data/livetv"

/**
 * Live TV: what is on now, and what is coming tonight.
 *
 * The "on now" row is band 0 (the tiles are columns 1 and up); the events run down bands
 * 2 and up in column 1. So the up and down arrows walk the events and the left and right
 * arrows walk the channels.
 *
 * Pressing a channel or an event hands off to OpenTV, which does the playing: the guide
 * is here, the player is there.
 */
export function LiveTv({
  channels = CHANNELS,
  events = TONIGHT,
  onWatch,
}: {
  channels?: Channel[]
  events?: Event[]
  onWatch?: (channel: Channel | Event) => void
}) {
  return (
    <div className="px-16 pt-8">
      <header className="flex items-end justify-between gap-16">
        <div>
          <h1 className="text-[72px] font-semibold leading-none tracking-tight">Live TV</h1>
          <p className="mt-4 text-[30px] leading-none text-muted-foreground">
            {channels.length} channels · {events.length} events tonight
          </p>
        </div>
      </header>

      <section data-focus-group="livetv-now" className="mt-8">
        <h2 className="text-[32px] font-medium tracking-tight">On now</h2>
        {/* Clipped sideways so a long row cannot spill off the stage, but not downwards:
            the focused tile grows, and a row that clips both ways cuts it off. */}
        <div className="mt-4 flex gap-5 overflow-x-clip overflow-y-visible">
          {channels.map((channel, i) => (
            <button
              key={channel.id}
              type="button"
              data-focusable
              data-row={0}
              data-col={i + 1}
              onClick={() => onWatch?.(channel)}
              className="group flex w-[176px] shrink-0 flex-col items-center gap-2 rounded-2xl p-2 text-left outline-none transition-transform duration-200 focus:scale-105 focus:bg-accent focus:ring-4 focus:ring-ring"
            >
              <span
                aria-hidden
                className="grid size-[104px] place-items-center rounded-[26px] bg-card text-[34px] font-semibold text-muted-foreground ring-1 ring-border transition-colors group-focus:bg-muted group-focus:text-foreground"
              >
                {channel.number}
              </span>
              <span className="w-full truncate text-center text-[22px] leading-tight">
                {channel.name}
              </span>
              <span className="w-full truncate text-center text-[18px] text-muted-foreground">
                {channel.now.title}
              </span>
              {/* How far through the programme we are. */}
              <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-ember"
                  style={{ width: `${Math.round(channel.now.progress * 100)}%` }}
                />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section data-focus-group="livetv-tonight" className="mt-8">
        <h2 className="text-[32px] font-medium tracking-tight">Tonight</h2>
        <ol className="mt-4 flex flex-col gap-2">
          {events.map((event, i) => (
            <li key={`${event.time}-${event.title}`}>
              <button
                type="button"
                data-focusable
                data-row={i + 2}
                data-col={1}
                onClick={() => onWatch?.(event)}
                className="group flex w-full items-center gap-6 rounded-2xl px-4 py-2 text-left outline-none transition-colors focus:bg-accent focus:ring-4 focus:ring-ring"
              >
                <span className="w-[72px] shrink-0 text-[26px] tabular-nums text-muted-foreground">
                  {event.time}
                </span>
                <span className="min-w-0 flex-1 truncate text-[30px] leading-tight">
                  {event.title}
                </span>
                <span className="shrink-0 truncate text-[22px] text-muted-foreground">
                  {event.channel}
                </span>
                {event.badge ? <Badge badge={event.badge} /> : null}
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

/** A label on the event: Live, Sports, New. Never a flourish — it says what the event is. */
function Badge({ badge }: { badge: NonNullable<Event["badge"]> }) {
  const live = badge === "Live"
  return (
    <span
      className={
        live
          ? "shrink-0 rounded-md bg-ember px-3 py-1 text-[18px] font-medium uppercase tracking-wider text-ember-foreground"
          : "shrink-0 rounded-md border border-border px-3 py-1 text-[18px] uppercase tracking-wider text-muted-foreground"
      }
    >
      {badge}
    </span>
  )
}
