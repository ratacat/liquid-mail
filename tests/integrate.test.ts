import { describe, expect, it } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { integrateProject } from '../src/integrate/integrate';
import {
  LIQUID_MAIL_AGENTS_BLOCK_END,
  LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX,
  buildBlockStart,
  computeSnippetHash,
  getAgentSnippet,
} from '../src/integrate/snippets';
import { extractManagedBlockContent } from '../src/integrate/textBlocks';

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
    expect(text).toContain(LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX);
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
    expect(claudeText).not.toContain(LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX);
  });

  it('falls back to AGENTS.md when CLAUDE.md is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'liquid-mail-integrate-'));
    const agentsPath = join(dir, 'AGENTS.md');

    const result = await integrateProject({ cwd: dir, target: 'claude' });
    expect(result.files[0]?.path).toBe(agentsPath);

    const text = await readFile(agentsPath, 'utf8');
    expect(text).toContain(LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX);
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

describe('integrate runs at repo root', () => {
  it('writes to root AGENTS.md when invoked from a subdirectory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'liquid-mail-integrate-'));
    await mkdir(join(dir, '.git'));
    await mkdir(join(dir, 'subdir'));

    const result = await integrateProject({ cwd: join(dir, 'subdir'), target: 'codex' });
    expect(result.files[0]?.path).toBe(join(dir, 'AGENTS.md'));

    const text = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    expect(text).toContain(LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX);
    expect(text).toContain(LIQUID_MAIL_AGENTS_BLOCK_END);
    expect(await fileExists(join(dir, 'subdir', 'AGENTS.md'))).toBe(false);
  });
});

describe('integrate managed block updates', () => {
  it('updates the block when content was manually edited even if the hash matches', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'liquid-mail-integrate-'));

    const snippet = getAgentSnippet();
    const hash = computeSnippetHash(snippet);
    const start = buildBlockStart(hash);

    const agentsPath = join(dir, 'AGENTS.md');
    await writeFile(agentsPath, [start, 'TAMPERED', LIQUID_MAIL_AGENTS_BLOCK_END].join('\n') + '\n', 'utf8');

    const result = await integrateProject({ cwd: dir, target: 'codex' });
    expect(result.files[0]?.action).toBe('updated');

    const updatedText = await readFile(agentsPath, 'utf8');
    const content = extractManagedBlockContent(updatedText, LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX, LIQUID_MAIL_AGENTS_BLOCK_END);
    expect(content).toBe(snippet.trim());
  });

  it('dedupes multiple Liquid Mail blocks into a single managed block', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'liquid-mail-integrate-'));

    const snippet = getAgentSnippet();
    const hash = computeSnippetHash(snippet);
    const start = buildBlockStart(hash);

    const agentsPath = join(dir, 'AGENTS.md');
    const legacyBlock = ['<!-- BEGIN LIQUID MAIL -->', 'LEGACY', LIQUID_MAIL_AGENTS_BLOCK_END].join('\n');
    const versionedBlock = [start, 'VERSIONED', LIQUID_MAIL_AGENTS_BLOCK_END].join('\n');
    await writeFile(agentsPath, `# Title\n\n${legacyBlock}\n\nBetween\n\n${versionedBlock}\n`, 'utf8');

    const result = await integrateProject({ cwd: dir, target: 'codex' });
    expect(result.files[0]?.action).toBe('updated');

    const updatedText = await readFile(agentsPath, 'utf8');
    expect(updatedText.match(new RegExp(LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX, 'g'))?.length).toBe(1);
    expect(updatedText.match(new RegExp(LIQUID_MAIL_AGENTS_BLOCK_END, 'g'))?.length).toBe(1);

    const content = extractManagedBlockContent(updatedText, LIQUID_MAIL_AGENTS_BLOCK_START_PREFIX, LIQUID_MAIL_AGENTS_BLOCK_END);
    expect(content).toBe(snippet.trim());
  });
});
