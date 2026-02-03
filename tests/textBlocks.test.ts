import { describe, expect, it } from 'bun:test';
import { upsertManagedBlock } from '../src/integrate/textBlocks';

describe('upsertManagedBlock', () => {
  it('writes block into empty content', () => {
    const start = '<!-- START -->';
    const end = '<!-- END -->';
    const block = `${start}\nhello\n${end}`;
    expect(upsertManagedBlock('', block, start, end)).toBe(block + '\n');
  });

  it('appends block when markers are missing', () => {
    const start = '<!-- START -->';
    const end = '<!-- END -->';
    const block = `${start}\nhello\n${end}`;
    const existing = '# Title\n\nSomething\n';
    expect(upsertManagedBlock(existing, block, start, end)).toBe('# Title\n\nSomething\n\n' + block + '\n');
  });

  it('replaces existing block when markers exist', () => {
    const start = '<!-- START -->';
    const end = '<!-- END -->';
    const before = '# Title\n';
    const existing = `${before}\n${start}\nold\n${end}\n\nAfter\n`;
    const block = `${start}\nnew\n${end}`;
    expect(upsertManagedBlock(existing, block, start, end)).toBe('# Title\n\n' + block + '\n\nAfter\n');
  });
});

