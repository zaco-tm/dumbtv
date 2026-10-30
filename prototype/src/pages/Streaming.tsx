import { TV_STREAMING_APPS } from "@/data/mock"

/**
 * Streaming: the television's apps that play somebody else's video or music.
 *
 * The page was called "Apps" and held everything; it is called "Streaming" now and holds
 * the streaming apps, because the games moved to their own page and a grid of Netflix,
 * Plex and Spotify should not have to say "Apps" to be honest about itself.
 *
 * The games are the television's own apps whose store category says they are games, and
 * the consoles are the inputs that report a console over HDMI-CEC. Both are on the
 * Gaming page.
 */
export function Streaming() {
  const columns = 6
  return (
    <div className="px-16 pt-8">
      <header className="flex items-end justify-between gap-16">
        <h1 className="text-[72px] font-semibold leading-none tracking-tight">Streaming</h1>
        <p className="text-[30px] text-muted-foreground">
          {TV_STREAMING_APPS.length} apps
        </p>
      </header>

      <section data-focus-group="streaming" className="mt-10">
        <div className="grid grid-cols-6 gap-5">
          {TV_STREAMING_APPS.map((app, i) => (
            <button
              key={app.key}
              type="button"
              data-focusable
              data-row={Math.floor(i / columns)}
              data-col={(i % columns) + 1}
              className="group flex flex-col items-center gap-3 rounded-2xl p-3 outline-none transition-transform duration-200 focus:scale-105 focus:bg-accent focus:ring-4 focus:ring-ring"
            >
              <span
                aria-hidden
                className="grid size-[104px] place-items-center rounded-[26px] bg-card text-[42px] font-semibold text-muted-foreground ring-1 ring-border transition-colors group-focus:bg-muted group-focus:text-foreground"
              >
                {app.label.charAt(0)}
              </span>
              <span className="w-full truncate text-center text-[22px] leading-tight">
                {app.label}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
