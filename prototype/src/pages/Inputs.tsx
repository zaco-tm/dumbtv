import { TV_INPUTS } from "@/data/mock"

/**
 * Inputs: the television's own inputs. The ones with nothing plugged in are dimmed, the
 * way they are on the television's own screen.
 *
 * The consoles are not here: they are on the Gaming page, because a console is something
 * you play on. What is left here is everything else — the tuner, and the ports with
 * something that is not a console on the other end.
 */
export function Inputs() {
  const inputs = TV_INPUTS.filter((input) => !input.console)

  return (
    <div className="px-16 pt-8">
      <header className="flex items-end justify-between gap-16">
        <h1 className="text-[72px] font-semibold leading-none tracking-tight">Inputs</h1>
        <p className="text-[30px] text-muted-foreground">{inputs.length} sources</p>
      </header>

      <section data-focus-group="inputs" className="mt-10">
        <ol className="flex flex-col gap-3">
          {inputs.map((input, i) => (
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
