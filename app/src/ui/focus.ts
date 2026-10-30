/**
 * The television's focus model.
 *
 * A remote is four arrow keys and an OK. This is a grid model, which is what a screen
 * with a rail on the left and rows of tiles needs:
 *
 *  - every focusable says where it is: its row and its column;
 *  - an arrow key moves to the nearest element in that direction, measured first along
 *    the direction and then across it;
 *  - the rail is column 0, so "left" from the content's left edge lands on it, and
 *    "right" from the rail comes back into the content.
 *
 * The rows are the *bands* of the screen — the header is not focusable, so the Favorites
 * row is band 0, the Trending feature is band 1, and the ranked list runs down bands 2
 * and up. A list that is beside another element therefore moves up and down inside
 * itself, and left and right cross to its neighbour.
 *
 * This file is deliberately free of React and of React Native: the model is a pure
 * function over a list of positions, so jest can prove it with no device and no native
 * code. The React part lives in `useFocusGrid.ts`.
 */

/** The four things the remote's arrow keys do. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** One focusable thing, and where it sits. */
export type FocusTarget = {
  /** What the focusable is called. It is how the model names it. */
  id: string;
  /** The band of the screen it is in. */
  row: number;
  /** The column it is in. The rail is column 0. */
  col: number;
  /**
   * The page the target belongs to.
   *
   * The rail's items carry the page they open, and that is how "left" knows where to
   * go: back to the item of the page you are on, not to whichever rail item happens to
   * share a band with whatever you had focused.
   */
  page?: string;
};

/**
 * Moves the focus to the nearest target in `dir`.
 *
 * Returns the id of the target to focus, or null when there is nowhere to go, so the
 * caller can let the key do whatever else it does.
 */
export function moveFocus(
  targets: FocusTarget[],
  fromId: string,
  dir: Direction,
  currentPage?: string,
): string | null {
  const here = targets.find(target => target.id === fromId);
  if (!here) {
    return null;
  }

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
  //    the rail marks as current — rather than to whichever rail item shares a band
  //    with whatever you had focused.
  const inRail = here.col === 0;
  const leavingRail = dir === 'right' && inRail;
  const enteringRail = dir === 'left' && !inRail;

  if (enteringRail && currentPage) {
    const current = targets.find(target => target.col === 0 && target.page === currentPage);
    if (current) {
      return current.id;
    }
  }

  let best: FocusTarget | null = null;
  let bestScore: number[] | null = null;

  for (const there of targets) {
    if (there.id === fromId) {
      continue;
    }

    // Up and down stay in one list: the rail's or the content's.
    if (dir === 'up' || dir === 'down') {
      if ((there.col === 0) !== inRail) {
        continue;
      }
    }

    // How far along the direction, how far across it, and which side of the current
    // element the candidate is on (so that "right" prefers what is below, not above).
    let along: number;
    let across: number;
    let side: number;
    if (dir === 'right') {
      along = there.col - here.col;
      across = Math.abs(there.row - here.row);
      side = there.row >= here.row ? 0 : 1;
    } else if (dir === 'left') {
      along = here.col - there.col;
      across = Math.abs(there.row - here.row);
      side = there.row <= here.row ? 0 : 1;
    } else if (dir === 'down') {
      along = there.row - here.row;
      across = Math.abs(there.col - here.col);
      side = there.col >= here.col ? 0 : 1;
    } else {
      along = here.row - there.row;
      across = Math.abs(there.col - here.col);
      side = there.col <= here.col ? 0 : 1;
    }
    if (along <= 0) {
      continue;
    }

    // Leaving the rail: the top-left of the page, not the band nearest the rail item.
    const score = leavingRail ? [there.row, there.col] : [along, across, side];
    const better =
      !bestScore ||
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] &&
        (score[1] < bestScore[1] ||
          (score[1] === bestScore[1] && score[2] < bestScore[2])));
    if (better) {
      best = there;
      bestScore = score;
    }
  }

  return best ? best.id : null;
}
