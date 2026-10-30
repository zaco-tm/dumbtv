import { Gamepad2 } from "lucide-react"
import { TV_GAMES, TV_INPUTS } from "@/data/mock"

/**
 * Gaming: the consoles plugged into the television, and the games installed on it.
 *
 * The two kinds of thing are told apart the way the television itself tells them apart:
 *
 *  - a **console** is an input. It is a device on the other end of a cable, and the
 *    television names it — a console that talks HDMI-CEC gets its own input, named after
 *    the device ("PlayStation 5"). The app matches those words, the way the Java app does
 *    in HomeApps.deviceSymbol.
 *  - a **game** is an app. Its store category says it is a game, and that is the whole test.
 *
 * The consoles are a row of tiles at the top (row 0, the columns to the right of the rail);
 * the games are a grid below them (rows 2 and down). So the up and down arrows walk the
 * games and the left and right arrows walk the consoles, and the rail is on the left of
 * both.
 */
export function Gaming() {
  const consoles = TV_INPUTS.filter((input) => input.console)
  const columns = 6

  return (
    <div className="px-16 pt-8">
      <header className="flex items-end justify-between gap-16">
        <h1 className="text-[72px] font-semibold leading-none tracking-tight">Gaming</h1>
        <p className="text-[30px] text-muted-foreground">
          {consoles.length} consoles · {TV_GAMES.length} games
        </p>
      </header>

      <section data-focus-group="gaming-consoles" className="mt-10">
        <h2 className="text-[32px] font-medium tracking-tight">Consoles</h2>
        <div className="mt-4 flex gap-5 overflow-hidden">
          {consoles.map((console_, i) => (
            <button
              key={console_.key}
              type="button"
              data-focusable
              data-row={0}
              data-col={i + 1}
              className="group flex w-[220px] shrink-0 flex-col items-center gap-3 rounded-2xl p-3 outline-none transition-transform duration-200 focus:scale-105 focus:bg-accent focus:ring-4 focus:ring-ring"
            >
              <span
                aria-hidden
                className="grid size-[104px] place-items-center rounded-[26px] border border-dashed border-border text-muted-foreground transition-colors group-focus:border-ring group-focus:text-foreground"
              >
                <Gamepad2 className="size-12" strokeWidth={1.6} />
              </span>
              <span className="w-full truncate text-center text-[22px] leading-tight">
                {console_.detail}
              </span>
              <span className="-mt-2 w-full truncate text-center text-[18px] text-muted-foreground">
                {console_.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section data-focus-group="gaming-games" className="mt-8">
        <h2 className="text-[32px] font-medium tracking-tight">Games</h2>
        <div className="mt-4 grid grid-cols-6 gap-5">
          {TV_GAMES.map((game, i) => (
            <button
              key={game.key}
              type="button"
              data-focusable
              data-row={Math.floor(i / columns) + 2}
              data-col={(i % columns) + 1}
              className="group flex flex-col items-center gap-3 rounded-2xl p-3 outline-none transition-transform duration-200 focus:scale-105 focus:bg-accent focus:ring-4 focus:ring-ring"
            >
              <span
                aria-hidden
                className="grid size-[104px] place-items-center rounded-[26px] bg-card text-[42px] font-semibold text-muted-foreground ring-1 ring-border transition-colors group-focus:bg-muted group-focus:text-foreground"
              >
                {game.label.charAt(0)}
              </span>
              <span className="w-full truncate text-center text-[22px] leading-tight">
                {game.label}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
