import { LmError } from '../cli/errors';
import { HonchoClient } from '../honcho/client';
import { chatWithPeer, searchWorkspace } from '../honcho/api';
import { buildSearchFilters, metadataEq } from '../honcho/filters';
import type { HonchoChatResponse } from '../honcho/types';

const CONFLICT_SCHEMA = {
  type: 'object',
  properties: {
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prior_decision_id: { type: 'string' },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
          suggested_action: { type: 'string' },
        },
        required: ['prior_decision_id', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['conflicts'],
  additionalProperties: false,
} as const;

export type ConflictItem = {
  prior_decision_id: string;
  confidence: number;
  rationale?: string;
  suggested_action?: string;
};

export type ConflictCheckResult = {
  conflicts: ConflictItem[];
  blocking: boolean;
  maxConfidence: number;
};

export async function checkDecisionConflicts(params: {
  client: HonchoClient;
  peerId: string;
  sessionId: string;
  proposedDecision: string;
  shortlistLimit: number;
  threshold: number;
  maxRetries?: number;
}): Promise<ConflictCheckResult> {
  const { client, peerId, sessionId, proposedDecision, shortlistLimit, threshold, maxRetries = 2 } = params;

  const search = await searchWorkspace(client, {
    query: proposedDecision,
    limit: shortlistLimit,
    filters: buildSearchFilters({
      sessionIds: [sessionId],
      metadata: { 'lm.kind': metadataEq('decision') },
    }),
  });

  if (search.matches.length === 0) {
    return { conflicts: [], blocking: false, maxConfidence: 0 };
  }

  const shortlist = search.matches.map((match) => ({
    prior_decision_id: match.message_id ?? match.session_id,
    snippet: match.snippet ?? '',
    score: match.score ?? 0,
  }));

  const prompt = [
    'You are checking if a proposed decision conflicts with prior decisions.',
    'Return strict JSON with shape: { "conflicts": [{ prior_decision_id, confidence, rationale?, suggested_action? }] }.',
    'Confidence is 0-1. Return an empty array if no conflicts.',
  ].join(' ');

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await chatWithPeer(client, peerId, {
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: JSON.stringify({ proposed_decision: proposedDecision, prior_decisions: shortlist }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'conflict_classify_v1', schema: CONFLICT_SCHEMA },
        },
        temperature: 0,
      });

      const parsed = parseConflictResponse(response);
      if (!isConflictResponse(parsed)) {
        throw new Error('Invalid conflict response');
      }

      const maxConfidence = parsed.conflicts.reduce((max, item) => Math.max(max, item.confidence), 0);
      return {
        conflicts: parsed.conflicts,
        blocking: parsed.conflicts.some((item) => item.confidence >= threshold),
        maxConfidence,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw new LmError({
    code: 'HONCHO_CHAT_INVALID',
    message: 'Honcho chat did not return valid conflict JSON.',
    exitCode: 6,
    retryable: true,
    suggestions: ['Retry the command', 'Inspect honcho response formatting'],
    details: lastError instanceof Error ? lastError.message : lastError,
  });
}

function parseConflictResponse(response: HonchoChatResponse): unknown {
  if (response.output_json !== undefined) return response.output_json;
  const text = response.output_text ?? response.message?.content ?? '';
  return safeJsonParse(text);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isConflictResponse(value: unknown): value is { conflicts: ConflictItem[] } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'conflicts') return false;
  const conflicts = record.conflicts;
  if (!Array.isArray(conflicts)) return false;
  return conflicts.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    if (typeof row.prior_decision_id !== 'string') return false;
    if (typeof row.confidence !== 'number') return false;
    if (row.rationale !== undefined && typeof row.rationale !== 'string') return false;
    if (row.suggested_action !== undefined && typeof row.suggested_action !== 'string') return false;
    return true;
  });
}
