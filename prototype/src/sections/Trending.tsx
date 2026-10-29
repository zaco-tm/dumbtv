import { Rating } from "@/components/ui/rating"
import { TRENDING, type Trend } from "@/data/mock"

/**
 * Trending: one big feature on the left, and the ranked list beside it.
 *
 * The feature is band 1, column 1. The list runs down bands 2 and up in column 2, so
 * the up and down arrows walk the list and the left arrow crosses to the feature.
 */
export function Trending({ items = TRENDING }: { items?: Trend[] }) {
  if (items.length === 0) return null
  const feature = items.find((item) => item.feature) ?? items[0]
  const rest = items.filter((item) => item !== feature)

  return (
    <section data-focus-group="trending" className="mt-8 flex gap-12 px-16">
      <button
        type="button"
        data-focusable
        data-row={1}
        data-col={1}
        className="group w-[340px] shrink-0 rounded-3xl text-left outline-none transition-transform duration-200 focus:scale-[1.02] focus:ring-4 focus:ring-ring"
      >
        <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-muted to-card ring-1 ring-border">
          {/* The name is on the poster, over a scrim: a poster card with its title under
              it takes more height than the stage has to give. */}
          <span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-background via-background/85 to-transparent px-7 pb-6 pt-24">
            <span className="text-[44px] font-semibold leading-tight tracking-tight">
              {feature.title}
            </span>
            <span className="text-[22px] text-muted-foreground">{feature.meta}</span>
            <span className="mt-1 flex items-center gap-3 text-[22px]">
              <Rating value={Math.round(feature.rating / 2)} readOnly size={20} />
              <span className="text-foreground">{feature.rating.toFixed(1)}</span>
            </span>
          </span>
        </span>
      </button>

      <ol className="flex flex-1 flex-col justify-center gap-2">
        {rest.map((item, i) => (
          <li key={item.title}>
            <button
              type="button"
              data-focusable
              data-row={i + 2}
              data-col={2}
              className="group flex w-full items-center gap-6 rounded-2xl px-4 py-2 text-left outline-none transition-colors focus:bg-accent focus:ring-4 focus:ring-ring"
            >
              <span className="w-[44px] shrink-0 text-right text-[30px] font-medium text-muted-foreground tabular-nums">
                {item.rank}
              </span>
              <span
                aria-hidden
                className="size-[92px] shrink-0 rounded-xl bg-gradient-to-b from-muted to-card ring-1 ring-border"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[32px] font-medium leading-tight">
                  {item.title}
                </span>
                <span className="mt-1 block truncate text-[22px] text-muted-foreground">
                  {item.year} · {item.meta}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <Rating value={Math.round(item.rating / 2)} readOnly size={18} />
                <span className="w-[48px] text-[24px] tabular-nums">{item.rating.toFixed(1)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
