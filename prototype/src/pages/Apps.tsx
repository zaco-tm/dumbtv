import { TV_APPS, TV_INPUTS } from "@/data/mock"

/**
 * Apps: the television's own apps, in a grid. A grid is the one layout the focus model
 * handles as a grid: the tiles are cells, and the arrow keys walk the cells.
 */
export function Apps() {
  const columns = 6
  return (
    <div className="px-16 pt-8">
      <header className="flex items-end justify-between gap-16">
        <h1 className="text-[72px] font-semibold leading-none tracking-tight">Apps</h1>
        <p className="text-[30px] text-muted-foreground">{TV_APPS.length} installed</p>
      </header>

      <section data-focus-group="apps" className="mt-10">
        <div className="grid grid-cols-6 gap-5">
          {TV_APPS.map((app, i) => (
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

/**
 * Inputs: the television's own inputs. The ones with nothing plugged in are dimmed, the
 * way they are on the television's own screen.
 */
export function Inputs() {
  return (
    <div className="px-16 pt-8">
      <header className="flex items-end justify-between gap-16">
        <h1 className="text-[72px] font-semibold leading-none tracking-tight">Inputs</h1>
        <p className="text-[30px] text-muted-foreground">{TV_INPUTS.length} sources</p>
      </header>

      <section data-focus-group="inputs" className="mt-10">
        <ol className="flex flex-col gap-3">
          {TV_INPUTS.map((input, i) => (
            <li key={input.key}>
              <button
                type="button"
                data-focusable
                data-row={i + 2}
                data-col={1}
                className="group flex w-full items-center gap-6 rounded-2xl px-5 py-4 text-left outline-none transition-colors focus:bg-accent focus:ring-4 focus:ring-ring"
              >
                <span
                  className={
                    input.connected
                      ? "text-[34px] font-medium"
                      : "text-[34px] font-medium text-muted-foreground opacity-60"
                  }
                >
                  {input.label}
                </span>
                <span className="flex-1 truncate text-[24px] text-muted-foreground">
                  {input.detail}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
