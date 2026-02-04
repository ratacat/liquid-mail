import { describe, expect, it } from 'bun:test';
import { detectDecision } from '../src/decisions/detectDecision';

describe('detectDecision', () => {
  it('detects decisions via --decision flag', () => {
    const result = detectDecision('hello', { decisionFlag: true });
    expect(result.isDecision).toBe(true);
    expect(result.source).toBe('flag');
  });

  it('detects DECISION: marker (case-insensitive)', () => {
    const result1 = detectDecision('DECISION: ship it', {});
    expect(result1.isDecision).toBe(true);
    expect(result1.decisions).toEqual(['ship it']);

    const result2 = detectDecision('Decision: ship it', {});
    expect(result2.isDecision).toBe(true);
    expect(result2.decisions).toEqual(['ship it']);
  });

  it('does not detect when no markers and no flag', () => {
    const result = detectDecision('nope', {});
    expect(result.isDecision).toBe(false);
    expect(result.source).toBe('none');
  });
});
