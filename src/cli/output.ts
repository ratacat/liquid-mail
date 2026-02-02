import { isatty } from 'node:tty';
import type { Flags } from './argv';

export type OutputMode = 'json' | 'text';

export function isStdoutTty(): boolean {
  const v = (process.stdout as any)?.isTTY;
  if (typeof v === 'boolean') return v;
  return isatty(1);
}

export function outputMode(flags: Flags): OutputMode {
  if (flags.json === true || flags.j === true) return 'json';
  if (flags.text === true) return 'text';
  return isStdoutTty() ? 'text' : 'json';
}

export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

