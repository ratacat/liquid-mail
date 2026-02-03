import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { LmError } from '../cli/errors';

export type LiquidMailConfig = {
  honcho: {
    baseUrl: string;
    apiKey: string | undefined;
    workspaceId: string | undefined;
  };
  topics: {
    detectionEnabled: boolean;
    autoCreate: boolean;
    autoAssignThreshold: number;
    autoAssignK: number;
    autoAssignMinHits: number;
    maxActive?: number;
    consolidationStrategy: 'merge' | 'archive' | 'summarize';
  };
  conflicts: {
    enabled: boolean;
    decisionsOnly: boolean;
    confidenceThreshold: number;
  };
  decisions: {
    enabled: boolean;
    systemPeerId: string;
  };
  summaries: {
    enabled: boolean;
  };
  output: {
    mode: 'auto' | 'json' | 'text';
  };
};

export type LoadConfigOpts = {
  configPath?: string;
};

function defaultConfig(): LiquidMailConfig {
  return {
    honcho: {
      baseUrl: 'https://api.honcho.dev',
      apiKey: undefined,
      workspaceId: undefined,
    },
    topics: {
      detectionEnabled: true,
      autoCreate: true,
      autoAssignThreshold: 0.8,
      autoAssignK: 10,
      autoAssignMinHits: 2,
      consolidationStrategy: 'merge',
    },
    conflicts: {
      enabled: true,
      decisionsOnly: true,
      confidenceThreshold: 0.7,
    },
    decisions: {
      enabled: true,
      systemPeerId: 'liquid-mail',
    },
    summaries: {
      enabled: true,
    },
    output: {
      mode: 'auto',
    },
  };
}

function expandHome(p: string): string {
  if (!p.startsWith('~/')) return p;
  return join(homedir(), p.slice(2));
}

function resolveConfigPath(opts?: LoadConfigOpts): string {
  const fromEnv = process.env.LIQUID_MAIL_CONFIG;
  if (opts?.configPath) return expandHome(opts.configPath);
  if (fromEnv) return expandHome(fromEnv);
  return join(homedir(), '.liquid-mail.toml');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}

function getBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const v = obj[key];
  return typeof v === 'boolean' ? v : undefined;
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' ? v : undefined;
}

function mergeConfig(base: LiquidMailConfig, partial: unknown): LiquidMailConfig {
  if (!isRecord(partial)) return base;

  const merged: LiquidMailConfig = structuredClone(base);

  const honcho = partial['honcho'];
  if (isRecord(honcho)) {
    const baseUrl = getString(honcho, 'base_url') ?? getString(honcho, 'baseUrl');
    if (baseUrl) merged.honcho.baseUrl = baseUrl;
    const apiKey = getString(honcho, 'api_key') ?? getString(honcho, 'apiKey');
    if (apiKey) merged.honcho.apiKey = apiKey;
    const workspaceId = getString(honcho, 'workspace_id') ?? getString(honcho, 'workspaceId');
    if (workspaceId) merged.honcho.workspaceId = workspaceId;
  }

  const topics = partial['topics'];
  if (isRecord(topics)) {
    merged.topics.detectionEnabled =
      getBoolean(topics, 'detection_enabled') ?? getBoolean(topics, 'detectionEnabled') ?? merged.topics.detectionEnabled;
    merged.topics.autoCreate = getBoolean(topics, 'auto_create') ?? getBoolean(topics, 'autoCreate') ?? merged.topics.autoCreate;
    merged.topics.autoAssignThreshold =
      getNumber(topics, 'auto_assign_threshold') ?? getNumber(topics, 'autoAssignThreshold') ?? merged.topics.autoAssignThreshold;
    merged.topics.autoAssignK = getNumber(topics, 'auto_assign_k') ?? getNumber(topics, 'autoAssignK') ?? merged.topics.autoAssignK;
    merged.topics.autoAssignMinHits =
      getNumber(topics, 'auto_assign_min_hits') ?? getNumber(topics, 'autoAssignMinHits') ?? merged.topics.autoAssignMinHits;
    const maxActive = getNumber(topics, 'max_active') ?? getNumber(topics, 'maxActive');
    if (maxActive !== undefined) merged.topics.maxActive = maxActive;
    const consolidation =
      getString(topics, 'consolidation_strategy') ?? getString(topics, 'consolidationStrategy') ?? merged.topics.consolidationStrategy;
    if (consolidation === 'merge' || consolidation === 'archive' || consolidation === 'summarize') {
      merged.topics.consolidationStrategy = consolidation;
    }
  }

  const conflicts = partial['conflicts'];
  if (isRecord(conflicts)) {
    merged.conflicts.enabled = getBoolean(conflicts, 'enabled') ?? merged.conflicts.enabled;
    merged.conflicts.decisionsOnly = getBoolean(conflicts, 'decisions_only') ?? merged.conflicts.decisionsOnly;
    merged.conflicts.confidenceThreshold =
      getNumber(conflicts, 'confidence_threshold') ?? merged.conflicts.confidenceThreshold;
  }

  const decisions = partial['decisions'];
  if (isRecord(decisions)) {
    merged.decisions.enabled = getBoolean(decisions, 'enabled') ?? merged.decisions.enabled;
    const systemPeerId = getString(decisions, 'system_peer_id') ?? getString(decisions, 'systemPeerId');
    if (systemPeerId) merged.decisions.systemPeerId = systemPeerId;
  }

  const summaries = partial['summaries'];
  if (isRecord(summaries)) {
    merged.summaries.enabled = getBoolean(summaries, 'enabled') ?? merged.summaries.enabled;
  }

  const output = partial['output'];
  if (isRecord(output)) {
    const mode = getString(output, 'mode');
    if (mode === 'auto' || mode === 'json' || mode === 'text') merged.output.mode = mode;
  }

  return merged;
}

function applyEnvOverrides(config: LiquidMailConfig): LiquidMailConfig {
  const next: LiquidMailConfig = structuredClone(config);

  if (process.env.LIQUID_MAIL_HONCHO_BASE_URL) next.honcho.baseUrl = process.env.LIQUID_MAIL_HONCHO_BASE_URL;
  if (process.env.LIQUID_MAIL_HONCHO_API_KEY) next.honcho.apiKey = process.env.LIQUID_MAIL_HONCHO_API_KEY;
  if (process.env.LIQUID_MAIL_HONCHO_WORKSPACE_ID) next.honcho.workspaceId = process.env.LIQUID_MAIL_HONCHO_WORKSPACE_ID;

  return next;
}

async function readTomlIfExists(path: string): Promise<unknown> {
  try {
    const text = await readFile(path, 'utf8');
    return (globalThis as any).Bun?.TOML?.parse(text) ?? {};
  } catch (err: any) {
    if (err && typeof err === 'object' && err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function loadConfig(opts?: LoadConfigOpts): Promise<{ config: LiquidMailConfig; configPath: string }> {
  const path = resolveConfigPath(opts);
  const base = defaultConfig();
  const parsed = await readTomlIfExists(path);
  const merged = mergeConfig(base, parsed);
  const withEnv = applyEnvOverrides(merged);
  return { config: withEnv, configPath: path };
}

export function requireHonchoAuth(config: LiquidMailConfig): { apiKey: string; workspaceId: string; baseUrl: string } {
  const { apiKey, workspaceId, baseUrl } = config.honcho;
  if (!apiKey || !workspaceId) {
    throw new LmError({
      code: 'MISSING_CONFIG',
      message: 'Missing Honcho configuration (apiKey/workspaceId).',
      exitCode: 2,
      retryable: false,
      suggestions: [
        'Set LIQUID_MAIL_HONCHO_API_KEY and LIQUID_MAIL_HONCHO_WORKSPACE_ID',
        'Or create ~/.liquid-mail.toml with [honcho] api_key=..., workspace_id=...',
      ],
      details: { baseUrl },
    });
  }
  return { apiKey, workspaceId, baseUrl };
}
