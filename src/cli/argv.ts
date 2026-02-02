export type FlagValue = string | boolean;
export type Flags = Record<string, FlagValue>;

export type ParsedArgv = {
  command: string | undefined;
  flags: Flags;
  positionals: string[];
};

export function getArgv(): string[] {
  const bunArgv = (globalThis as any).Bun?.argv;
  if (Array.isArray(bunArgv)) return bunArgv.slice(2);
  return process.argv.slice(2);
}

export function parseArgv(argv: string[]): ParsedArgv {
  let command: string | undefined;
  const flags: Flags = {};
  const positionals: string[] = [];

  let stopParsingFlags = false;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;

    if (!stopParsingFlags && token === '--') {
      stopParsingFlags = true;
      continue;
    }

    if (!stopParsingFlags && token.startsWith('--')) {
      const eq = token.indexOf('=');
      const name = eq >= 0 ? token.slice(2, eq) : token.slice(2);
      if (!name) continue;

      if (eq >= 0) {
        flags[name] = token.slice(eq + 1);
        continue;
      }

      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[name] = next;
        i++;
        continue;
      }

      flags[name] = true;
      continue;
    }

    if (!stopParsingFlags && token.startsWith('-') && token !== '-') {
      for (const letter of token.slice(1)) flags[letter] = true;
      continue;
    }

    if (command === undefined) command = token;
    else positionals.push(token);
  }

  return { command, flags, positionals };
}

export function getFlagString(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}
