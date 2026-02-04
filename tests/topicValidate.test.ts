import { describe, expect, it } from 'bun:test';
import { validateTopicName } from '../src/topics/validate';

describe('validateTopicName', () => {
  it('accepts a valid topic name', () => {
    expect(validateTopicName('auth-system')).toEqual({ valid: true });
  });

  it('rejects too-short names', () => {
    const out = validateTopicName('abc');
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.code).toBe('INVALID_TOPIC_NAME');
  });

  it('rejects uppercase', () => {
    const out = validateTopicName('Auth-system');
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.code).toBe('INVALID_TOPIC_NAME');
  });

  it('rejects consecutive hyphens', () => {
    const out = validateTopicName('auth--system');
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.code).toBe('INVALID_TOPIC_NAME');
  });

  it('rejects names that end with a hyphen', () => {
    const out = validateTopicName('auth-system-');
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.code).toBe('INVALID_TOPIC_NAME');
  });

  it('rejects reserved names', () => {
    const out = validateTopicName('merge');
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.code).toBe('RESERVED_TOPIC_NAME');
  });

  it('rejects lm<32-hex> ids', () => {
    const out = validateTopicName('lm3189ed8785c64e879df0c7f331a04c40');
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.code).toBe('INVALID_TOPIC_NAME');
  });

  it('rejects standard UUIDs', () => {
    const out = validateTopicName('550e8400-e29b-41d4-a716-446655440000');
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.code).toBe('INVALID_TOPIC_NAME');
  });
});

