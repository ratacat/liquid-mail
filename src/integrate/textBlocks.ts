export function buildManagedBlock(start: string, body: string, end: string): string {
  return [start, body.trim(), end].join('\n');
}

export function upsertManagedBlock(existing: string, block: string, start: string, end: string): string {
  const startIndex = existing.indexOf(start);
  const endIndex = existing.indexOf(end);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = existing.slice(0, startIndex).trimEnd();
    const after = existing.slice(endIndex + end.length).trimStart();
    return ([before, block, after].filter(Boolean).join('\n\n')).trimEnd() + '\n';
  }

  if (existing.trim().length === 0) return block.trimEnd() + '\n';
  return (existing.trimEnd() + '\n\n' + block).trimEnd() + '\n';
}
