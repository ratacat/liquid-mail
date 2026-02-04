import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { readState, resolveAlias, setAlias, statePathForCwd } from '../src/state/state';

async function makeTempRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'liquid-mail-state-'));
  await mkdir(join(root, '.git'));
  return root;
}

describe('state schema v2', () => {
  it('migrates v1 state to v2', async () => {
    const cwd = await makeTempRepo();
    const path = statePathForCwd(cwd);

    await mkdir(join(cwd, '.liquid-mail'), { recursive: true });
    await writeFile(
      path,
      JSON.stringify(
        {
          version: 1,
          windows: { win1: { topic_id: 'topic-123', updated_at: '2026-02-04T00:00:00.000Z' } },
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    const state = await readState(cwd);
    expect(state.version).toBe(2);
    expect(state.windows.win1?.topic_id).toBe('topic-123');
    expect(state.aliases).toEqual({});
  });

  it('flattens alias chains on setAlias', async () => {
    const cwd = await makeTempRepo();

    await setAlias(cwd, 'b', 'a');
    await setAlias(cwd, 'a', 'c');

    const state = await readState(cwd);
    expect(state.aliases).toEqual({ a: 'c', b: 'c' });
    expect(await resolveAlias(cwd, 'b')).toBe('c');
  });
});

