import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {dark, light, radius} from '../src/ui/charcoal/tokens';

const root = join(__dirname, '..');
const target = join(root, 'src', 'ui', 'charcoal', 'tokens.ts');

const COLOURS = [
  'background',
  'foreground',
  'card',
  'cardForeground',
  'popover',
  'primary',
  'secondary',
  'muted',
  'mutedForeground',
  'accent',
  'destructive',
  'border',
  'input',
  'ring',
  'ember',
  'emberForeground',
  'emberGlow',
  'success',
] as const;

test('both looks have every colour of the theme', () => {
  for (const name of COLOURS) {
    expect(typeof light[name]).toBe('string');
    expect(typeof dark[name]).toBe('string');
  }
});

test('the radii are there', () => {
  expect(radius.base).toBeGreaterThan(0);
  expect(radius.sm).toBeLessThan(radius.md);
  expect(radius.md).toBeLessThan(radius.lg);
  expect(radius.lg).toBeLessThan(radius.xl);
});

test('the generator can be run again, and writes the same file', () => {
  const before = readFileSync(target, 'utf8');
  execFileSync('node', [join(root, 'tools', 'gen-tokens.mjs')], {cwd: root});
  expect(readFileSync(target, 'utf8')).toBe(before);
});
