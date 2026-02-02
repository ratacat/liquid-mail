import { describe, expect, it } from 'bun:test';
import { chooseTopicFromMatches } from '../src/topics/autoTopic';

describe('chooseTopicFromMatches', () => {
  it('chooses a topic when dominance meets threshold', () => {
    const matches = [
      ...Array.from({ length: 8 }, () => ({ sessionId: 'A' })),
      ...Array.from({ length: 2 }, () => ({ sessionId: 'B' })),
    ];

    const chosen = chooseTopicFromMatches(matches, { threshold: 0.8, minHits: 2 });
    expect(chosen.chosenTopicId).toBe('A');
    expect(chosen.dominance).toBeCloseTo(0.8);
  });

  it('does not choose a topic when dominance is below threshold', () => {
    const matches = [
      ...Array.from({ length: 7 }, () => ({ sessionId: 'A' })),
      ...Array.from({ length: 3 }, () => ({ sessionId: 'B' })),
    ];

    const chosen = chooseTopicFromMatches(matches, { threshold: 0.8, minHits: 2 });
    expect(chosen.chosenTopicId).toBeUndefined();
    expect(chosen.bestTopicId).toBe('A');
    expect(chosen.dominance).toBeCloseTo(0.7);
  });

  it('does not choose when bestCount is below minHits', () => {
    const matches = [{ sessionId: 'A' }];
    const chosen = chooseTopicFromMatches(matches, { threshold: 0.8, minHits: 2 });
    expect(chosen.chosenTopicId).toBeUndefined();
    expect(chosen.bestTopicId).toBe('A');
  });
});

