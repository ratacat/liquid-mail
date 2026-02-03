import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { LmError } from '../cli/errors';
import { buildManagedBlock, upsertManagedBlock } from './textBlocks';
import {
  LIQUID_MAIL_AGENTS_BLOCK_END,
  LIQUID_MAIL_AGENTS_BLOCK_START,
  LIQUID_MAIL_AGENT_SNIPPET,
  OPENCODE_INSTRUCTIONS_RELATIVE_PATH,
} from './snippets';

export type IntegrateTarget = 'claude' | 'codex' | 'opencode';

export type IntegrateFileResult = {
  path: string;
  action: 'created' | 'updated' | 'unchanged';
};

export type IntegrateResult = {
  target: IntegrateTarget;
  files: IntegrateFileResult[];
};

export async function integrateProject(opts: { cwd: string; target: IntegrateTarget }): Promise<IntegrateResult> {
  if (opts.target === 'claude') return await integrateClaudeProject(opts.cwd);
  if (opts.target === 'codex') return await integrateManagedMarkdownFile('codex', join(opts.cwd, 'AGENTS.md'));
  return await integrateOpenCode(opts.cwd);
}

async function integrateClaudeProject(cwd: string): Promise<IntegrateResult> {
  const claudePath = join(cwd, 'CLAUDE.md');
  const agentsPath = join(cwd, 'AGENTS.md');

  // Claude Code projects often prefer CLAUDE.md for persistent instructions.
  const claudeExisting = await readTextIfExists(claudePath);
  const agentsExisting = await readTextIfExists(agentsPath);

  // If we already installed the managed block somewhere, keep updating it there (stable, no duplicates).
  if (hasLiquidMailBlock(claudeExisting)) {
    return await integrateManagedMarkdownFile('claude', claudePath);
  }

  if (hasLiquidMailBlock(agentsExisting)) {
    return await integrateManagedMarkdownFile('claude', agentsPath);
  }

  // If CLAUDE.md is present but is just a thin pointer to AGENTS.md (common pattern),
  // treat it as "no real CLAUDE instructions" and install into AGENTS.md.
  if (claudeExisting.trim().length > 0 && !looksLikeAgentsPointerClaudeMd(claudeExisting)) {
    return await integrateManagedMarkdownFile('claude', claudePath);
  }

  return await integrateManagedMarkdownFile('claude', agentsPath);
}

async function integrateManagedMarkdownFile(target: IntegrateTarget, filePath: string): Promise<IntegrateResult> {
  const block = buildManagedBlock(LIQUID_MAIL_AGENTS_BLOCK_START, LIQUID_MAIL_AGENT_SNIPPET, LIQUID_MAIL_AGENTS_BLOCK_END);
  const existing = await readTextIfExists(filePath);
  const next = upsertManagedBlock(existing, block, LIQUID_MAIL_AGENTS_BLOCK_START, LIQUID_MAIL_AGENTS_BLOCK_END);

  const action = await writeTextIfChanged(filePath, existing, next);
  return { target, files: [{ path: filePath, action }] };
}

async function integrateOpenCode(cwd: string): Promise<IntegrateResult> {
  const files: IntegrateFileResult[] = [];

  // OpenCode project config is `opencode.json` in the project root.
  const configPath = join(cwd, 'opencode.json');

  // Put Liquid Mail instructions in a project-scoped file and reference it from config.instructions.
  const instructionsFilePath = join(cwd, '.opencode', 'liquid-mail.md');
  await mkdir(dirname(instructionsFilePath), { recursive: true });
  const instructionsExisting = await readTextIfExists(instructionsFilePath);
  const instructionsNext = LIQUID_MAIL_AGENT_SNIPPET.trim() + '\n';
  files.push({
    path: instructionsFilePath,
    action: await writeTextIfChanged(instructionsFilePath, instructionsExisting, instructionsNext),
  });

  const configExistingText = await readTextIfExists(configPath);
  const configExisting = parseJsonConfig(configExistingText, configPath);
  const configNext = structuredClone(configExisting);

  if (configNext.$schema === undefined) configNext.$schema = 'https://opencode.ai/config.json';

  // We only touch `instructions`. Everything else is left alone so global config can handle providers/models.
  const current = normalizeInstructions(configNext.instructions);
  if (!current.includes(OPENCODE_INSTRUCTIONS_RELATIVE_PATH)) current.push(OPENCODE_INSTRUCTIONS_RELATIVE_PATH);
  configNext.instructions = current;

  const nextText = JSON.stringify(configNext, null, 2) + '\n';
  files.push({
    path: configPath,
    action: await writeTextIfChanged(configPath, configExistingText, nextText),
  });

  return { target: 'opencode', files };
}

async function readTextIfExists(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (err: any) {
    if (err && typeof err === 'object' && err.code === 'ENOENT') return '';
    throw err;
  }
}

async function writeTextIfChanged(path: string, existing: string, next: string): Promise<IntegrateFileResult['action']> {
  if (existing === next) return 'unchanged';
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next, 'utf8');
  return existing ? 'updated' : 'created';
}

type OpenCodeConfig = {
  $schema?: unknown;
  instructions?: unknown;
  [key: string]: unknown;
};

function parseJsonConfig(text: string, path: string): OpenCodeConfig {
  if (!text.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LmError({
      code: 'INVALID_CONFIG',
      message: `OpenCode config is not valid JSON: ${path}`,
      exitCode: 2,
      retryable: false,
      suggestions: ['Fix JSON syntax errors in opencode.json', 'Or delete opencode.json and re-run integrate'],
      details: { path },
    });
  }

  if (!isRecord(parsed)) {
    throw new LmError({
      code: 'INVALID_CONFIG',
      message: `OpenCode config must be a JSON object: ${path}`,
      exitCode: 2,
      retryable: false,
      suggestions: ['Edit opencode.json so the top-level is an object'],
      details: { path },
    });
  }

  return parsed as OpenCodeConfig;
}

function normalizeInstructions(value: unknown): string[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) {
    throw new LmError({
      code: 'INVALID_CONFIG',
      message: 'OpenCode config: instructions must be a string[]',
      exitCode: 2,
      retryable: false,
      suggestions: ['Fix opencode.json so "instructions" is an array of strings'],
      details: { instructions: value },
    });
  }
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new LmError({
        code: 'INVALID_CONFIG',
        message: 'OpenCode config: instructions must be a string[]',
        exitCode: 2,
        retryable: false,
        suggestions: ['Fix opencode.json so "instructions" is an array of strings'],
        details: { instructions: value },
      });
    }
    out.push(entry);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasLiquidMailBlock(text: string): boolean {
  return text.includes(LIQUID_MAIL_AGENTS_BLOCK_START) && text.includes(LIQUID_MAIL_AGENTS_BLOCK_END);
}

function looksLikeAgentsPointerClaudeMd(text: string): boolean {
  // Heuristic: treat CLAUDE.md as a "wrapper" when it mostly just points at AGENTS.md.
  // Example patterns:
  // - "@AGENTS.md"
  // - "See @AGENTS.md"
  // - "Follow @AGENTS.md for instructions"
  const trimmed = text.trim();
  if (!/agents\.md/i.test(trimmed)) return false;

  // Remove headings/comments and the obvious agents reference, then see if anything meaningful remains.
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('<!--'));

  const withoutAgentsRef = lines.join(' ')
    .replace(/agents\.md/gi, '')
    .replace(/[@`*_[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If there's basically no additional instruction content, treat it as a pointer-only CLAUDE.md.
  return withoutAgentsRef.length < 24;
}
