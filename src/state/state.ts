import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, parse } from 'node:path';

export type LiquidMailStateV1 = {
  version: 1;
  windows: Record<
    string,
    {
      topic_id?: string;
      updated_at?: string;
    }
  >;
};

function defaultState(): LiquidMailStateV1 {
  return { version: 1, windows: {} };
}

export function statePathForCwd(cwd: string): string {
  const root = findGitRoot(cwd);
  if (root) return join(root, '.liquid-mail', 'state.json');
  return join(homedir(), '.liquid-mail-state.json');
}

export async function readState(cwd: string): Promise<LiquidMailStateV1> {
  const path = statePathForCwd(cwd);
  try {
    const text = await readFile(path, 'utf8');
    const parsed = JSON.parse(text) as unknown;
    if (!isStateV1(parsed)) return defaultState();
    return parsed;
  } catch (err: any) {
    if (err && typeof err === 'object' && err.code === 'ENOENT') return defaultState();
    return defaultState();
  }
}

export async function writeState(cwd: string, state: LiquidMailStateV1): Promise<void> {
  const path = statePathForCwd(cwd);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export async function getPinnedTopicId(cwd: string, windowId: string): Promise<string | undefined> {
  const state = await readState(cwd);
  return state.windows[windowId]?.topic_id;
}

export async function setPinnedTopicId(cwd: string, windowId: string, topicId: string): Promise<void> {
  const state = await readState(cwd);
  state.windows[windowId] = {
    ...(state.windows[windowId] ?? {}),
    topic_id: topicId,
    updated_at: new Date().toISOString(),
  };
  await writeState(cwd, state);
}

function isStateV1(value: unknown): value is LiquidMailStateV1 {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return false;
  if (record.windows === undefined) return false;
  if (!record.windows || typeof record.windows !== 'object') return false;
  return true;
}

function findGitRoot(startDir: string): string | undefined {
  let current = startDir;
  const root = parse(current).root;

  while (true) {
    const gitPath = join(current, '.git');
    if (existsSync(gitPath)) return current;
    if (current === root) break;
    current = dirname(current);
  }

  return undefined;
}

