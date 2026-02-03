import { LmError } from '../cli/errors';
import { HonchoClient } from '../honcho/client';
import { chatWithPeer, createMessage, getOrCreateSession, getSessionSummaries, listSessions } from '../honcho/api';
import type { HonchoChatResponse } from '../honcho/types';

const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    merge: {
      type: 'object',
      properties: {
        from: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
        reason: { type: 'string' },
      },
      required: ['from'],
      additionalProperties: false,
    },
  },
  required: ['merge'],
  additionalProperties: false,
} as const;

export type MergePlan = {
  mergedTopicId: string;
  mergedFrom: [string, string];
  reason?: string;
};

export async function consolidateTopics(params: {
  client: HonchoClient;
  systemPeerId: string;
  sessionLimit: number;
  maxRetries?: number;
}): Promise<MergePlan> {
  const { client, systemPeerId, sessionLimit, maxRetries = 2 } = params;

  const sessions = await listSessions(client, { limit: sessionLimit });
  if (sessions.sessions.length < 2) {
    throw new LmError({
      code: 'TOPIC_CONSOLIDATION_FAILED',
      message: 'Not enough topics to consolidate.',
      exitCode: 6,
      retryable: false,
    });
  }

  const summaries = [];
  for (const session of sessions.sessions) {
    const sessionSummaries = await getSessionSummaries(client, session.id);
    const short = sessionSummaries.summaries.find((summary) => summary.kind === 'short') ?? sessionSummaries.summaries[0];
    summaries.push({
      session_id: session.id,
      summary: short?.content ?? '',
    });
  }

  const prompt = [
    'You are selecting two topics to merge to reduce topic sprawl.',
    'Choose the single best pair based only on short summaries.',
    'Return strict JSON: { "merge": { "from": [id1, id2], "reason": "..." } }.',
  ].join(' ');

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await chatWithPeer(client, systemPeerId, {
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify({ topics: summaries }) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'topic_merge_v1', schema: MERGE_SCHEMA },
        },
        temperature: 0,
      });

      const parsed = parseMergeResponse(response);
      if (!isMergeResponse(parsed)) {
        throw new Error('Invalid merge response');
      }

      const mergedSession = await getOrCreateSession(client, {
        title: 'Merged topic',
        metadata: {
          'lm.kind': 'topic_merge',
          'lm.merged_from': parsed.merge.from,
        },
      });

      const mergedTopicId = mergedSession.session.id;
      const [first, second] = parsed.merge.from;

      await createMessage(client, first, {
        peer_id: systemPeerId,
        content: `Topic merged into ${mergedTopicId}.`,
        metadata: { 'lm.kind': 'topic_merge_redirect', 'lm.merged_into': mergedTopicId },
      });

      await createMessage(client, second, {
        peer_id: systemPeerId,
        content: `Topic merged into ${mergedTopicId}.`,
        metadata: { 'lm.kind': 'topic_merge_redirect', 'lm.merged_into': mergedTopicId },
      });

      return parsed.merge.reason
        ? { mergedTopicId, mergedFrom: parsed.merge.from, reason: parsed.merge.reason }
        : { mergedTopicId, mergedFrom: parsed.merge.from };
    } catch (err) {
      lastError = err;
    }
  }

  throw new LmError({
    code: 'TOPIC_CONSOLIDATION_FAILED',
    message: 'Failed to consolidate topics.',
    exitCode: 6,
    retryable: true,
    details: lastError instanceof Error ? lastError.message : lastError,
  });
}

function parseMergeResponse(response: HonchoChatResponse): unknown {
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

function isMergeResponse(value: unknown): value is { merge: { from: [string, string]; reason?: string } } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'merge') return false;
  const merge = record.merge;
  if (!merge || typeof merge !== 'object') return false;
  const mergeRecord = merge as Record<string, unknown>;
  const from = mergeRecord.from;
  if (!Array.isArray(from) || from.length !== 2) return false;
  if (from.some((item) => typeof item !== 'string')) return false;
  if (mergeRecord.reason !== undefined && typeof mergeRecord.reason !== 'string') return false;
  return true;
}
