import { Plug } from "lucide-react"
import { FAVORITES, type FavoriteEntry } from "@/data/mock"

/**
 * Favorites: the apps and the inputs the household pinned, in the order they put them.
 * The two kinds have to look different at a glance — an app is a picture, an input is a
 * socket — but they sit in one row.
 *
 * The row is band 0 of the screen's focus grid: the tiles are columns 1 and up, so the
 * left arrow from the first tile crosses to the rail.
 */
export function Favorites({ items = FAVORITES }: { items?: FavoriteEntry[] }) {
  // An empty row is not a row: the section goes away rather than showing an empty strip.
  if (items.length === 0) return null

  return (
    <section data-focus-group="favorites" className="mt-8 px-16">
      <h2 className="text-[32px] font-medium tracking-tight">Favorites</h2>
      <div role="list" className="mt-4 flex gap-6 overflow-hidden">
        {items.map((item, i) => (
          <button
            key={`${item.kind}-${item.key}`}
            type="button"
            role="listitem"
            data-focusable
            data-row={0}
            data-col={i + 1}
            className="group flex w-[176px] shrink-0 flex-col items-center gap-3 rounded-2xl p-3 text-left outline-none transition-transform duration-200 focus:scale-105 focus:bg-accent focus:ring-4 focus:ring-ring"
          >
            {item.kind === "app" ? (
              <span
                aria-hidden
                className="grid size-[104px] place-items-center rounded-[26px] bg-card text-[46px] font-semibold text-muted-foreground ring-1 ring-border transition-colors group-focus:bg-muted group-focus:text-foreground"
              >
                {item.label.charAt(0)}
              </span>
            ) : (
              <span
                aria-hidden
                className="grid size-[104px] place-items-center rounded-[26px] border border-dashed border-border text-muted-foreground transition-colors group-focus:border-ring group-focus:text-foreground"
              >
                <Plug className="size-11" strokeWidth={1.6} />
              </span>
            )}
            <span className="w-full truncate text-center text-[22px] leading-tight">
              {item.label}
            </span>
            {item.kind === "input" ? (
              <span className="-mt-2 w-full truncate text-center text-[18px] text-muted-foreground">
                {item.detail}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  )
}
