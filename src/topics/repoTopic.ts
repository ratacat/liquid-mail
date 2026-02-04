import { basename } from 'node:path';
import { findGitRoot } from '../state/state';

export function repoTopicIdForCwd(cwd: string): string {
  const root = findGitRoot(cwd) ?? cwd;
  const name = basename(root);
  const slug = slugifyTopicId(name);
  return slug || 'project';
}

export function slugifyTopicId(input: string): string {
  const lowered = input.trim().toLowerCase();
  const cleaned = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  return cleaned;
}

