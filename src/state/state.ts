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
      watch?: {
        topics?: Record<
          string,
          {
            last_seen_at?: string;
            last_seen_ids?: string[];
            updated_at?: string;
          }
        >;
      };
    }
  >;
};

export type LiquidMailStateV2 = {
  version: 2;
  windows: LiquidMailStateV1['windows'];
  aliases: Record<string, string>;
};

function defaultState(): LiquidMailStateV2 {
  return { version: 2, windows: {}, aliases: {} };
}

export function statePathForCwd(cwd: string): string {
  const root = findGitRoot(cwd);
  if (root) return join(root, '.liquid-mail', 'state.json');
  return join(homedir(), '.liquid-mail-state.json');
}

export async function readState(cwd: string): Promise<LiquidMailStateV2> {
  const path = statePathForCwd(cwd);
  try {
    const text = await readFile(path, 'utf8');
    const parsed = JSON.parse(text) as unknown;
    return migrateState(parsed);
  } catch (err: any) {
    if (err && typeof err === 'object' && err.code === 'ENOENT') return defaultState();
    return defaultState();
  }
}

export async function writeState(cwd: string, state: LiquidMailStateV2): Promise<void> {
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
  if (state.windows[windowId]?.topic_id === topicId) return;
  state.windows[windowId] = {
    ...(state.windows[windowId] ?? {}),
    topic_id: topicId,
    updated_at: new Date().toISOString(),
  };
  await writeState(cwd, state);
}

export async function getAlias(cwd: string, name: string): Promise<string | undefined> {
  const state = await readState(cwd);
  return state.aliases[name];
}

export async function setAlias(cwd: string, oldName: string, newName: string): Promise<void> {
  const state = await readState(cwd);
  state.aliases[oldName] = newName;
  flattenAliasChainsInMemory(state.aliases);
  await writeState(cwd, state);
}

export async function resolveAlias(cwd: string, name: string): Promise<string> {
  const state = await readState(cwd);
  return resolveAliasInMemory(state.aliases, name);
}

export async function flattenAliasChains(cwd: string): Promise<void> {
  const state = await readState(cwd);
  const changed = flattenAliasChainsInMemory(state.aliases);
  if (changed) await writeState(cwd, state);
}

function migrateState(value: unknown): LiquidMailStateV2 {
  if (isStateV2(value)) return value;
  if (isStateV1(value)) return { version: 2, windows: value.windows, aliases: {} };
  return defaultState();
}

function isStateV1(value: unknown): value is LiquidMailStateV1 {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return false;
  if (record.windows === undefined) return false;
  if (!record.windows || typeof record.windows !== 'object') return false;
  return true;
}

function isStateV2(value: unknown): value is LiquidMailStateV2 {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.version !== 2) return false;
  if (!record.windows || typeof record.windows !== 'object') return false;
  if (!record.aliases || typeof record.aliases !== 'object') return false;
  return true;
}

function resolveAliasInMemory(aliases: Record<string, string>, name: string): string {
  let current = name;
  const visited = new Set<string>();

  while (true) {
    const next = aliases[current];
    if (!next) return current;
    if (visited.has(current)) return current;
    visited.add(current);
    current = next;
  }
}

function flattenAliasChainsInMemory(aliases: Record<string, string>): boolean {
  let changed = false;
  const keys = Object.keys(aliases);

  for (const key of keys) {
    const resolved = resolveAliasInMemory(aliases, key);
    const current = aliases[key];
    if (!current) continue;
    if (resolved === key) {
      delete aliases[key];
      changed = true;
      continue;
    }
    if (current !== resolved) {
      aliases[key] = resolved;
      changed = true;
    }
  }

  return changed;
}

export function findGitRoot(startDir: string): string | undefined {
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
