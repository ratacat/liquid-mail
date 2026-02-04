export function buildManagedBlock(startMarker: string, body: string, end: string): string {
  return [startMarker, body.trim(), end].join('\n');
}

const LEGACY_MARKER = '<!-- BEGIN LIQUID MAIL -->';
const VERSIONED_MARKER_RE = /<!-- BEGIN LIQUID MAIL \(v:[a-f0-9]+\) -->/g;

type BlockBoundaries = { startIndex: number; startEndIndex: number; endIndex: number };

function findAllBlockBoundaries(text: string, startHint: string, end: string): BlockBoundaries[] {
  const candidates: Array<{ startIndex: number; startEndIndex: number }> = [];

  if (startHint.includes('BEGIN LIQUID MAIL')) {
    for (const match of text.matchAll(VERSIONED_MARKER_RE)) {
      const startIndex = match.index ?? -1;
      if (startIndex < 0) continue;
      candidates.push({ startIndex, startEndIndex: startIndex + match[0].length });
    }

    let legacyIndex = text.indexOf(LEGACY_MARKER);
    while (legacyIndex !== -1) {
      candidates.push({ startIndex: legacyIndex, startEndIndex: legacyIndex + LEGACY_MARKER.length });
      legacyIndex = text.indexOf(LEGACY_MARKER, legacyIndex + LEGACY_MARKER.length);
    }
  } else {
    let idx = text.indexOf(startHint);
    while (idx !== -1) {
      candidates.push({ startIndex: idx, startEndIndex: idx + startHint.length });
      idx = text.indexOf(startHint, idx + startHint.length);
    }
  }

  candidates.sort((a, b) => a.startIndex - b.startIndex);

  const boundaries: BlockBoundaries[] = [];
  for (const candidate of candidates) {
    const endIndex = text.indexOf(end, candidate.startEndIndex);
    if (endIndex === -1 || endIndex <= candidate.startEndIndex) continue;
    boundaries.push({ startIndex: candidate.startIndex, startEndIndex: candidate.startEndIndex, endIndex });
  }

  return boundaries;
}

/**
 * Find the start of a managed block.
 * Handles both versioned markers (<!-- BEGIN LIQUID MAIL (v:abc123) -->)
 * and legacy/generic markers (<!-- BEGIN LIQUID MAIL --> or any custom start).
 */
function findBlockBoundaries(text: string, startHint: string, end: string): BlockBoundaries | undefined {
  const boundaries = findAllBlockBoundaries(text, startHint, end);
  return boundaries[0];
}

export function upsertManagedBlock(existing: string, block: string, start: string, end: string): string {
  const boundaries = findAllBlockBoundaries(existing, start, end);

  if (boundaries.length > 0) {
    // Replace the first matching block and remove any duplicates.
    const placeholder = '\u0000LIQUID_MAIL_BLOCK\u0000';
    let cursor = 0;
    const parts: string[] = [];

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]!;
      parts.push(existing.slice(cursor, boundary.startIndex));
      if (i === 0) parts.push(placeholder);
      cursor = boundary.endIndex + end.length;
    }
    parts.push(existing.slice(cursor));

    const withoutBlocks = parts.join('');
    const placeholderIndex = withoutBlocks.indexOf(placeholder);
    const before = withoutBlocks.slice(0, placeholderIndex).trimEnd();
    const after = withoutBlocks.slice(placeholderIndex + placeholder.length).trimStart();
    return ([before, block, after].filter(Boolean).join('\n\n')).trimEnd() + '\n';
  }

  if (existing.trim().length === 0) return block.trimEnd() + '\n';
  return (existing.trimEnd() + '\n\n' + block).trimEnd() + '\n';
}

/**
 * Extract the existing managed block content (without markers).
 */
export function extractManagedBlockContent(text: string, startHint: string, end: string): string | undefined {
  const boundary = findBlockBoundaries(text, startHint, end);
  if (!boundary) return undefined;
  return text.slice(boundary.startEndIndex, boundary.endIndex).trim();
}
