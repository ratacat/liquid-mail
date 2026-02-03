import { describe, expect, it } from 'bun:test';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { integrateProject } from '../src/integrate/integrate';
import { LIQUID_MAIL_AGENTS_BLOCK_END, LIQUID_MAIL_AGENTS_BLOCK_START } from '../src/integrate/snippets';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('integrate --to claude', () => {
  it('prefers CLAUDE.md when it exists and is non-empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'liquid-mail-integrate-'));
    const claudePath = join(dir, 'CLAUDE.md');
    await writeFile(claudePath, '# Project\n', 'utf8');

    const result = await integrateProject({ cwd: dir, target: 'claude' });
    expect(result.files[0]?.path).toBe(claudePath);

    const text = await readFile(claudePath, 'utf8');
    expect(text).toContain(LIQUID_MAIL_AGENTS_BLOCK_START);
    expect(text).toContain(LIQUID_MAIL_AGENTS_BLOCK_END);

    expect(await fileExists(join(dir, 'AGENTS.md'))).toBe(false);
  });

  it('falls back to AGENTS.md when CLAUDE.md is just a pointer to AGENTS.md', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'liquid-mail-integrate-'));
    const claudePath = join(dir, 'CLAUDE.md');
    await writeFile(claudePath, '@AGENTS.md\n', 'utf8');

    const result = await integrateProject({ cwd: dir, target: 'claude' });
    expect(result.files[0]?.path).toBe(join(dir, 'AGENTS.md'));

    const claudeText = await readFile(claudePath, 'utf8');
    expect(claudeText).not.toContain(LIQUID_MAIL_AGENTS_BLOCK_START);
  });

  it('falls back to AGENTS.md when CLAUDE.md is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'liquid-mail-integrate-'));
    const agentsPath = join(dir, 'AGENTS.md');

    const result = await integrateProject({ cwd: dir, target: 'claude' });
    expect(result.files[0]?.path).toBe(agentsPath);

    const text = await readFile(agentsPath, 'utf8');
    expect(text).toContain(LIQUID_MAIL_AGENTS_BLOCK_START);
    expect(text).toContain(LIQUID_MAIL_AGENTS_BLOCK_END);
  });

  it('falls back to AGENTS.md when CLAUDE.md exists but is empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'liquid-mail-integrate-'));
    await writeFile(join(dir, 'CLAUDE.md'), '   \n', 'utf8');
    const agentsPath = join(dir, 'AGENTS.md');

    const result = await integrateProject({ cwd: dir, target: 'claude' });
    expect(result.files[0]?.path).toBe(agentsPath);
    expect(await fileExists(join(dir, 'AGENTS.md'))).toBe(true);
  });
});
