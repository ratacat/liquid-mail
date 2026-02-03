import { LmError } from '../cli/errors';
import { HonchoClient } from '../honcho/client';
import { chatWithPeer } from '../honcho/api';
import type { HonchoChatResponse } from '../honcho/types';

const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    decisions: { type: 'array', items: { type: 'string' } },
  },
  required: ['decisions'],
  additionalProperties: false,
} as const;

export type DecisionExtraction = {
  decisions: string[];
};

export async function extractDecisions(params: {
  client: HonchoClient;
  peerId: string;
  message: string;
  maxRetries?: number;
}): Promise<DecisionExtraction> {
  const { client, peerId, message, maxRetries = 2 } = params;

  const prompt = [
    'You are extracting decision statements.',
    'Return strict JSON with shape: { "decisions": string[] }.',
    'If no decisions are present, return { "decisions": [] }.',
  ].join(' ');

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await chatWithPeer(client, peerId, {
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: message },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'decision_extract_v1', schema: DECISION_SCHEMA },
        },
        temperature: 0,
      });

      const parsed = parseDecisionResponse(response);
      if (!isDecisionExtraction(parsed)) {
        throw new Error('Invalid decision extraction response');
      }

      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw new LmError({
    code: 'HONCHO_CHAT_INVALID',
    message: 'Honcho chat did not return valid decision JSON.',
    exitCode: 6,
    retryable: true,
    suggestions: ['Retry the command', 'Inspect honcho response formatting'],
    details: lastError instanceof Error ? lastError.message : lastError,
  });
}

function parseDecisionResponse(response: HonchoChatResponse): unknown {
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

function isDecisionExtraction(value: unknown): value is DecisionExtraction {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'decisions') return false;
  const decisions = record.decisions;
  return Array.isArray(decisions) && decisions.every((item) => typeof item === 'string');
}
