import { describe, expect, it } from 'bun:test';
import { windowNameFromId } from '../src/window/nameFromId';

describe('windowNameFromId', () => {
  it('is deterministic', () => {
    const id = 'lm-test-123';
    expect(windowNameFromId(id)).toBe(windowNameFromId(id));
  });

  it('formats as adjective-noun-suffix', () => {
    const name = windowNameFromId('lm-test-456');
    expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]+(?:-[a-z0-9]+)*-[a-z2-7]{4}$/);
  });

  it('usually differs across ids', () => {
    expect(windowNameFromId('lm-a')).not.toBe(windowNameFromId('lm-b'));
  });
});

