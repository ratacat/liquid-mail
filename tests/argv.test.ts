import { describe, expect, it } from 'bun:test';
import { parseArgv } from '../src/cli/argv';

describe('parseArgv', () => {
  it('preserves positionals after boolean flags', () => {
    const parsed = parseArgv(['post', '--decision', '[lm] DECISION: ship it']);

    expect(parsed.command).toBe('post');
    expect(parsed.flags['decision']).toBe(true);
    expect(parsed.positionals).toEqual(['[lm] DECISION: ship it']);
  });

  it('preserves positionals after output flags', () => {
    const parsed = parseArgv(['query', '--json', 'search text']);

    expect(parsed.command).toBe('query');
    expect(parsed.flags['json']).toBe(true);
    expect(parsed.positionals).toEqual(['search text']);
  });

  it('still parses known value flags', () => {
    const parsed = parseArgv(['post', '--topic', 'auth-system', 'hello']);

    expect(parsed.command).toBe('post');
    expect(parsed.flags['topic']).toBe('auth-system');
    expect(parsed.positionals).toEqual(['hello']);
  });

  it('accepts explicit boolean values when provided', () => {
    const parsed = parseArgv(['post', '--decision', 'true', 'hello']);

    expect(parsed.command).toBe('post');
    expect(parsed.flags['decision']).toBe('true');
    expect(parsed.positionals).toEqual(['hello']);
  });
});
