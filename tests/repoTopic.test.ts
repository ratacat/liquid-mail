import { describe, expect, it } from 'bun:test';
import { slugifyTopicId } from '../src/topics/repoTopic';

describe('slugifyTopicId', () => {
  it('lowercases and strips punctuation', () => {
    expect(slugifyTopicId('Liquid Mail!!')).toBe('liquid-mail');
  });

  it('collapses whitespace', () => {
    expect(slugifyTopicId('  my   repo  name  ')).toBe('my-repo-name');
  });

  it('returns empty for non-alnum input', () => {
    expect(slugifyTopicId('---')).toBe('');
  });
});

