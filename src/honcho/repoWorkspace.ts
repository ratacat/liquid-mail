import { basename } from 'node:path';
import { findGitRoot } from '../state/state';

export function defaultWorkspaceIdForCwd(cwd: string): string {
  const root = findGitRoot(cwd) ?? cwd;
  const repoName = basename(root);
  const slug = slugifyWorkspaceId(repoName);
  const base = slug || 'default';
  return base.slice(0, 100);
}

export function slugifyWorkspaceId(input: string): string {
  const lowered = input.trim().toLowerCase();
  const cleaned = lowered
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return cleaned;
}
