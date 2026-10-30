import {dark, radius} from './tokens';

/**
 * The theme, as the app's components use it.
 *
 * The colours and the radii come from the generated tokens, so they are the
 * prototype's: nothing here is a hex value of our own.
 *
 * The typeface is the one thing the app cannot take from the tokens. The token carries
 * the prototype's CSS family name ('Inter Variable'), but Android finds a font by the
 * name of the file in `assets/fonts`, and the font's own PostScript name — the one
 * without a space — is the name the file has.
 */
export const FONT_FAMILY = 'InterVariable';

/** The television's look: the prototype's own page is dark (`<html class="dark">`). */
export const colors = dark;

/** The theme's corners, in dp. */
export const radii = radius;
