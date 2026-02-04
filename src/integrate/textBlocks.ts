export function buildManagedBlock(startMarker: string, body: string, end: string): string {
  return [startMarker, body.trim(), end].join('\n');
}

const LEGACY_MARKER = '<!-- BEGIN LIQUID MAIL -->';

/**
 * Find the start of a managed block.
 * Handles both versioned markers (<!-- BEGIN LIQUID MAIL (v:abc123) -->)
 * and legacy/generic markers (<!-- BEGIN LIQUID MAIL --> or any custom start).
 */
function findBlockBoundaries(text: string, startHint: string, end: string): { startIndex: number; startEndIndex: number; endIndex: number } | undefined {
  // For Liquid Mail blocks, check both versioned and legacy markers
  if (startHint.includes('BEGIN LIQUID MAIL')) {
    // Try versioned marker first
    const versionedMatch = text.match(/<!-- BEGIN LIQUID MAIL \(v:[a-f0-9]+\) -->/);
    if (versionedMatch) {
      const startIndex = text.indexOf(versionedMatch[0]);
      const startEndIndex = startIndex + versionedMatch[0].length;
      const endIndex = text.indexOf(end, startEndIndex);
      if (endIndex > startEndIndex) {
        return { startIndex, startEndIndex, endIndex };
      }
    }

    // Try legacy marker (files created before versioning)
    const legacyIndex = text.indexOf(LEGACY_MARKER);
    if (legacyIndex !== -1) {
      const startEndIndex = legacyIndex + LEGACY_MARKER.length;
      const endIndex = text.indexOf(end, startEndIndex);
      if (endIndex > startEndIndex) {
        return { startIndex: legacyIndex, startEndIndex, endIndex };
      }
    }
  }

  // Fall back to exact start marker match (generic markers)
  const startIndex = text.indexOf(startHint);
  if (startIndex === -1) return undefined;

  const startEndIndex = startIndex + startHint.length;
  const endIndex = text.indexOf(end, startEndIndex);
  if (endIndex === -1 || endIndex <= startEndIndex) return undefined;

  return { startIndex, startEndIndex, endIndex };
}

export function upsertManagedBlock(existing: string, block: string, start: string, end: string): string {
  const boundaries = findBlockBoundaries(existing, start, end);

  if (boundaries) {
    const before = existing.slice(0, boundaries.startIndex).trimEnd();
    const after = existing.slice(boundaries.endIndex + end.length).trimStart();
    return ([before, block, after].filter(Boolean).join('\n\n')).trimEnd() + '\n';
  }

  if (existing.trim().length === 0) return block.trimEnd() + '\n';
  return (existing.trimEnd() + '\n\n' + block).trimEnd() + '\n';
}

/**
 * Extract the existing managed block content (without markers).
 */
export function extractManagedBlockContent(text: string, startHint: string, end: string): string | undefined {
  const boundaries = findBlockBoundaries(text, startHint, end);
  if (!boundaries) return undefined;
  return text.slice(boundaries.startEndIndex, boundaries.endIndex).trim();
}
