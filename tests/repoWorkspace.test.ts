import { describe, expect, it } from 'bun:test';
import { slugifyWorkspaceId } from '../src/honcho/repoWorkspace';

describe('slugifyWorkspaceId', () => {
  it('lowercases and strips punctuation', () => {
    expect(slugifyWorkspaceId('Liquid Mail!!')).toBe('liquid-mail');
  });

  it('keeps underscores', () => {
    expect(slugifyWorkspaceId('my_repo')).toBe('my_repo');
  });

  it('returns empty for non-alnum input', () => {
    expect(slugifyWorkspaceId('---')).toBe('');
  });
});

