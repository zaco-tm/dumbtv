#!/usr/bin/env node
/**
 * The app's tokens, generated from the prototype's theme.
 *
 * The prototype is the design, so its CSS is the source: this script reads
 * prototype/src/index.css and writes app/src/ui/charcoal/tokens.ts. Change a colour in the
 * prototype, run this, and the app has it. Nothing is copied by hand and nothing is fetched.
 *
 *   node app/tools/gen-tokens.mjs
 *
 * The colours React Native cannot read as they are (the CSS `rgb(10 10 10 / 0.07)` form) are
 * written as hex, so a token can go straight into a StyleSheet.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, '../../prototype/src/index.css');
const TARGET = resolve(HERE, '../src/ui/charcoal/tokens.ts');

/** The theme's colours: the CSS variable, and the name the app gives it. */
const COLOURS = [
  ['background', 'background'],
  ['foreground', 'foreground'],
  ['card', 'card'],
  ['card-foreground', 'cardForeground'],
  ['popover', 'popover'],
  ['popover-foreground', 'popoverForeground'],
  ['primary', 'primary'],
  ['primary-foreground', 'primaryForeground'],
  ['secondary', 'secondary'],
  ['secondary-foreground', 'secondaryForeground'],
  ['muted', 'muted'],
  ['muted-foreground', 'mutedForeground'],
  ['accent', 'accent'],
  ['accent-foreground', 'accentForeground'],
  ['destructive', 'destructive'],
  ['border', 'border'],
  ['input', 'input'],
  ['ring', 'ring'],
  ['ember', 'ember'],
  ['ember-foreground', 'emberForeground'],
  ['ember-glow', 'emberGlow'],
  ['success', 'success'],
];

/** The radii: the CSS variable, and the name the app gives it. */
const RADII = [
  ['radius', 'base'],
  ['radius-sm', 'sm'],
  ['radius-md', 'md'],
  ['radius-lg', 'lg'],
  ['radius-xl', 'xl'],
  ['radius-2xl', '2xl'],
  ['radius-3xl', '3xl'],
  ['radius-4xl', '4xl'],
];

const REM = 16;

/** The block a selector opens in the CSS, with the declarations in it. */
function block(css, selector) {
  // The selector has to be followed by the brace: ".dark" also appears in the stylesheet's
  // `@custom-variant dark (&:is(.dark *))` line, which opens no block.
  const pattern = new RegExp(
    selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{',
  );
  const found = pattern.exec(css);
  if (!found) {
    throw new Error(`${SOURCE}: no "${selector}" in the stylesheet`);
  }
  const open = found.index + found[0].length - 1;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`${SOURCE}: "${selector}" is never closed`);
}

/** The declarations of a block, as a map of the variable's name and its value. */
function declarations(text) {
  const out = new Map();
  for (const part of text.split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    const name = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (!name.startsWith('--')) continue;
    out.set(name.slice(2), value);
  }
  return out;
}

/** A colour as hex, which React Native reads as it is. */
function toHex(value) {
  const text = value.trim();
  if (text.startsWith('#')) return fromHex(text);
  const rgb = text.match(/^rgba?\((.*)\)$/s);
  if (rgb) return fromRgb(rgb[1]);
  throw new Error(`cannot read the colour "${value}": only hex and rgb() are understood`);
}

function fromHex(text) {
  let hex = text.slice(1);
  if (!/^[0-9a-f]+$/i.test(hex)) {
    throw new Error(`cannot read the colour "${text}"`);
  }
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map(c => c + c)
      .join('');
  }
  if (hex.length !== 6 && hex.length !== 8) {
    throw new Error(`cannot read the colour "${text}"`);
  }
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return write(red, green, blue, alpha);
}

function fromRgb(body) {
  const parts = body.split('/').map(part => part.trim());
  const numbers = parts[0]
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (numbers.length < 3 || numbers.some(n => Number.isNaN(n))) {
    throw new Error(`cannot read the colour "rgb(${body})"`);
  }
  const alpha = parts.length > 1 ? Number(parts[1]) : 1;
  if (Number.isNaN(alpha)) {
    throw new Error(`cannot read the alpha of "rgb(${body})"`);
  }
  return write(numbers[0], numbers[1], numbers[2], alpha);
}

function write(red, green, blue, alpha) {
  const rgb = [red, green, blue]
    .map(value => Math.round(value).toString(16).padStart(2, '0'))
    .join('');
  if (alpha >= 1) return `#${rgb}`;
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${rgb}${a}`;
}

/** A radius in dp. The scale is a multiple of the base radius, as the CSS says it is. */
function toDp(value, base) {
  const scaled = value.match(/^calc\(var\(--radius\)\s*\*\s*([0-9.]+)\)$/);
  if (scaled) return base * Number(scaled[1]);
  if (value.replace(/\s/g, '') === 'var(--radius)') return base;
  const plain = value.match(/^([0-9.]+)(rem|px)$/);
  if (!plain) {
    throw new Error(`cannot read the radius "${value}"`);
  }
  return Number(plain[1]) * (plain[2] === 'rem' ? REM : 1);
}

/** A number as it is written in the file: 12, 7.2, 16.8. */
function number(value) {
  return String(Number(value.toFixed(2)));
}

function palette(variables, look) {
  const lines = [];
  for (const [cssName, tokenName] of COLOURS) {
    const value = variables.get(cssName);
    if (value === undefined) {
      throw new Error(`${SOURCE}: the ${look} theme has no --${cssName}`);
    }
    lines.push(`  ${tokenName}: '${toHex(value)}',`);
  }
  return lines.join('\n');
}

/**
 * The radii. The base one is in the theme's own block (`:root`) and the scale is in Tailwind's
 * (`@theme inline`), where the CSS puts it.
 */
function radii(theme, root) {
  const base = toDp(root.get('radius'), 0);
  const lines = [];
  for (const [cssName, tokenName] of RADII) {
    const value = theme.get(cssName) ?? root.get(cssName);
    if (value === undefined) {
      throw new Error(`${SOURCE}: the theme has no --${cssName}`);
    }
    lines.push(`  ${key(tokenName)}: ${number(toDp(value, base))},`);
  }
  return lines.join('\n');
}

/** An object key: quoted when it is not a name TypeScript can read as one ("2xl"). */
function key(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : `'${name}'`;
}

const css = readFileSync(SOURCE, 'utf8');
const light = declarations(block(css, ':root'));
const dark = declarations(block(css, '.dark'));
const theme = declarations(block(css, '@theme inline'));

/** The theme's typeface, as the CSS writes it: 'Inter Variable', sans-serif. */
function typeface(variables) {  const value = variables.get('font-sans');
  if (!value) {
    throw new Error(`${SOURCE}: the theme has no --font-sans`);
  }
  return value.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

const file = `/**
 * The theme's tokens, generated from the prototype's CSS.
 *
 * Generated by app/tools/gen-tokens.mjs from prototype/src/index.css. Do not edit this file by
 * hand: change the prototype's theme and run \`npm run tokens\` in app/.
 */

/** The colours of the theme, in one of its two looks. */
export type Palette = {
${COLOURS.map(([, tokenName]) => `  ${tokenName}: string;`).join('\n')}
};

export const light: Palette = {
${palette(light, 'light')}
};

export const dark: Palette = {
${palette(dark, 'dark')}
};

/** Both looks, by name. */
export const colors = {light, dark};

/** The radii, in dp. */
export const radius = {
${radii(theme, light)}
};

/**
 * The theme's typeface. The app ships Inter: variant/assets/fonts/InterVariable.ttf, copied in
 * when the font is added to the app (task 7).
 */
export const font = {
  sans: '${typeface(theme)}',
};
`;

mkdirSync(dirname(TARGET), {recursive: true});
writeFileSync(TARGET, file);
console.log(`wrote ${TARGET} from ${SOURCE}`);
