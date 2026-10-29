/**
 * The few Node builtins the tests use.
 *
 * The app's TypeScript is React Native's, and it only loads Jest's types. The tests read two files
 * of the build and run the token generator, so the three builtins they need are declared here
 * rather than adding @types/node to a tree that ships to a television.
 */

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
}

declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args: string[],
    options?: {cwd?: string},
  ): string;
}

declare const __dirname: string;
