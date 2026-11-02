import {dp} from './stage';

/**
 * The type scale, and the line boxes that go with it.
 *
 * The prototype's sizes are Tailwind's arbitrary values, and its line boxes come from
 * CSS: Tailwind's preflight sets `line-height: 1.5` on the root, so a text with no
 * leading of its own sits in a box 1.5 times its size. `leading-tight` is 1.25, and
 * `leading-none` is 1.
 *
 * These are the prototype's own numbers, so they are computed here rather than written
 * out again at each use — a line box is not a number anyone should type by hand.
 */

/** The line box a text of this size sits in, with no leading of its own. */
export function lineBox(fontSize: number): number {
  return dp(fontSize * 1.5);
}

/** The line box of a text with Tailwind's `leading-tight`. */
export function lineBoxTight(fontSize: number): number {
  return dp(fontSize * 1.25);
}

/** The line box of a text with Tailwind's `leading-none`. */
export function lineBoxNone(fontSize: number): number {
  return dp(fontSize);
}
