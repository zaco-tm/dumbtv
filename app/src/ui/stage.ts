import {PixelRatio} from 'react-native';

/**
 * The stage is designed at the television's own size — 1920x1080 — and scaled to fit
 * the window it is shown in. On the television there is no scaling: the screen *is* the
 * stage, and the prototype's pixel numbers are the television's pixels (60px rail rows,
 * 26px icons, 22px labels, a 220px rail).
 *
 * React Native measures in dp, and the density is what says how many dp a physical
 * pixel is. So a stage pixel is a dp divided by the density: the same 60px row is 30dp
 * on a 2x screen and 60dp on a 1x one, and 60 physical pixels either way.
 */

/** The stage's width, in stage pixels. */
export const STAGE_W = 1920;

/** The stage's height, in stage pixels. */
export const STAGE_H = 1080;

/**
 * A measurement in the prototype's pixels, as the app measures it.
 *
 * The prototype's numbers are the television's pixels, so they are divided by the
 * density rather than used as dp: on the television the row is 60 pixels tall whichever
 * way the screen is set up.
 */
export function dp(stagePx: number): number {
  return stagePx / PixelRatio.get();
}
