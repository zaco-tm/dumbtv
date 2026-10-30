import * as React from "react"

/**
 * The television's focus model, in the browser.
 *
 * A remote is four arrow keys and an OK. This is a grid model, which is what a screen
 * with a rail on the left and rows of tiles needs:
 *
 *  - every focusable element says where it is: `data-row` and `data-col`;
 *  - an arrow key moves to the nearest element in that direction, measured first along
 *    the direction and then across it;
 *  - the rail is column 0, so "left" from the content's left edge lands on it, and
 *    "right" from the rail comes back into the content.
 *
 * The rows are the *bands* of the screen — the header is not focusable, so the Favorites
 * row is row 0, the Trending feature is row 1, and the ranked list runs down rows 2 to 5.
 * A list that is beside another element therefore moves up and down inside itself, and
 * left and right cross to its neighbour.
 */

export type Direction = "up" | "down" | "left" | "right"

export function focusables(container: Element | null): HTMLElement[] {
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>("[data-focusable]"))
}

export function positionOf(el: HTMLElement): { row: number; col: number } | null {
  if (el.dataset.row === undefined || el.dataset.col === undefined) return null
  return { row: Number(el.dataset.row), col: Number(el.dataset.col) }
}

/**
 * Moves the focus to the nearest element in `dir`. Returns false when there is nowhere to
 * go, so the caller can let the key do whatever else it does.
 */
export function moveFocus(scope: HTMLElement, from: HTMLElement, dir: Direction): boolean {
  const here = positionOf(from)
  if (!here) return false

  // The rail is not a column of the screen's bands: its items are a list of
  // destinations, numbered in the rail's own order (0, 1, 2 …), while the content's rows
  // are the bands of the page. The two numberings have nothing to do with each other, so
  // the rail is handled by its own rules rather than by measuring it against the bands:
  //
  //  - **up and down** stay inside whichever list you are in. The rail is a list that
  //    scrolls; the content is a grid that scrolls. They do not slide into each other,
  //    which is how "down" from a console once landed on the rail's Live TV.
  //  - **right** out of the rail enters the page at its top-left: the first item of the
  //    first band. Measuring instead would land on whichever band happens to be
  //    numerically nearest the rail item, which is how "right" from Streaming landed on
  //    the seventh app instead of the first.
  //  - **left** back into the rail returns to the item of the page you are on — the one
  //    marked `aria-current` — rather than to whichever rail item shares a band with
  //    whatever you had focused.
  const inRail = here.col === 0
  const leavingRail = dir === "right" && inRail
  const enteringRail = dir === "left" && !inRail

  if (enteringRail) {
    const current = scope.querySelector<HTMLElement>('a[aria-current="page"]')
    const there = current ? positionOf(current) : null
    if (current && there && there.col === 0) {
      current.focus()
      return true
    }
  }

  let best: HTMLElement | null = null
  let bestScore: number[] | null = null

  for (const el of focusables(scope)) {
    if (el === from) continue
    const there = positionOf(el)
    if (!there) continue

    // Up and down stay in one list: the rail's or the content's.
    if (dir === "up" || dir === "down") {
      if (there.col === 0 !== inRail) continue
    }

    // How far along the direction, how far across it, and which side of the current
    // element the candidate is on (so that "right" prefers what is below, not above).
    let along: number
    let across: number
    let side: number
    if (dir === "right") {
      along = there.col - here.col
      across = Math.abs(there.row - here.row)
      side = there.row >= here.row ? 0 : 1
    } else if (dir === "left") {
      along = here.col - there.col
      across = Math.abs(there.row - here.row)
      side = there.row <= here.row ? 0 : 1
    } else if (dir === "down") {
      along = there.row - here.row
      across = Math.abs(there.col - here.col)
      side = there.col >= here.col ? 0 : 1
    } else {
      along = here.row - there.row
      across = Math.abs(there.col - here.col)
      side = there.col <= here.col ? 0 : 1
    }
    if (along <= 0) continue

    // Leaving the rail: the top-left of the page, not the band nearest the rail item.
    const score = leavingRail ? [there.row, there.col] : [along, across, side]
    const better =
      !bestScore ||
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] &&
        (score[1] < bestScore[1] || (score[1] === bestScore[1] && score[2] < bestScore[2])))
    if (better) {
      best = el
      bestScore = score
    }
  }

  if (!best) return false
  best.focus()
  return true
}

/**
 * The key handler for the whole stage. It runs in the capture phase, so that the grid
 * owns the movement: the components below it (the Charcoal rail, for one) have their own
 * arrow handling, and two of them moving the focus at once is how a screen ends up with
 * the focus somewhere nobody chose.
 */
export function useStageFocus(stageRef: React.RefObject<HTMLElement | null>) {
  return React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const dir: Direction | null =
        (
          {
            ArrowUp: "up",
            ArrowDown: "down",
            ArrowLeft: "left",
            ArrowRight: "right",
          } satisfies Record<string, Direction>
        )[event.key] ?? null
      if (!dir) return
      const target = event.target as HTMLElement
      if (!target.hasAttribute("data-focusable")) return
      const stage = stageRef.current
      if (!stage) return
      if (moveFocus(stage, target, dir)) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    [stageRef],
  )
}
