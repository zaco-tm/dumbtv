import {Dimensions} from 'react-native';

/**
 * The stage is designed at the television's own size — 1920x1080 — and scaled to fit
 * the window it is shown in. Everything inside is therefore in "stage pixels", which is what
 * the React Native app will use too (there, scaled to the window).
 */

/** The stage's width, in stage pixels. */
export const STAGE_W = 1920;

/** The stage's height, in stage pixels. */
export const STAGE_H = 1080;

/**
 * How many dp one stage pixel is on this screen.
 *
 * The stage is a fixed 1920x1080 design that has to fit the window it is drawn in, the
 * way the prototype's `useFit` scales it with a CSS transform. The scale is therefore
 * the window's size over the stage's size.
 *
 * A television is 16:9 and the stage is 16:9, so the two axes agree; the smaller of
 * the two is used so that a window of a different shape letterboxes rather than
 * cropping, which is what the prototype's `Math.min` does.
 */
function fitScale(): number {
  const window = Dimensions.get('window');
  return Math.min(window.width / STAGE_W, window.height / STAGE_H);
}

/**
 * A measurement in the prototype's pixels, as the app measures it.
 *
 * The prototype's numbers are the television's pixels, so they are scaled to the window
 * the way the prototype scales its stage. On a screen whose window is exactly the
 * stage's size — a 1080p television — a stage pixel is half a dp, so a 60px row is
 * 30dp and 60 physical pixels, which is what the prototype draws. On a 4K television
 * the same 60px row is 60dp and 120 physical pixels, and the stage fills the panel.
 *
 * The density is deliberately not consulted: it says how many physical pixels a dp is,
 * not how big the stage should be. A stage pixel is a fraction of the window.
 */
export function dp(stagePx: number): number {
  return stagePx * fitScale();
}
