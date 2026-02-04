import type { LiquidMailConfig } from '../config/config';
import { HonchoClient } from '../honcho/client';
import { getOrCreateSession, searchWorkspace } from '../honcho/api';
import { chooseTopicFromMatches } from './autoTopic';

export type CandidateTopic = {
  sessionId: string;
  count: number;
  dominance: number;
};

export type AutoTopicDecision = {
  action: 'assigned' | 'created' | 'requires_topic' | 'disabled';
  chosenTopicId?: string;
  createdTopicId?: string;
  dominance: number;
  bestTopicId?: string;
  bestCount: number;
  totalMatches: number;
  candidates: CandidateTopic[];
  reason?: string;
};

export async function resolveTopicForMessage(params: {
  client: HonchoClient;
  message: string;
  config: LiquidMailConfig['topics'];
  titleHint?: string;
}): Promise<AutoTopicDecision> {
  const { client, message, config, titleHint } = params;

  if (!config.detectionEnabled) {
    return emptyDecision('disabled', 'detection_disabled');
  }

  const search = await searchWorkspace(client, {
    query: message,
    limit: config.autoAssignK,
  });

  const matches = search.matches.map((match) => ({ sessionId: match.session_id }));
  const choice = chooseTopicFromMatches(matches, {
    threshold: config.autoAssignThreshold,
    minHits: config.autoAssignMinHits,
  });

  const candidates = buildCandidates(choice.counts, config.autoAssignK, choice.totalMatches);
  const baseDecision: AutoTopicDecision = {
    action: 'requires_topic',
    dominance: choice.dominance,
    bestCount: choice.bestCount,
    totalMatches: choice.totalMatches,
    candidates,
    ...(choice.chosenTopicId ? { chosenTopicId: choice.chosenTopicId } : {}),
    ...(choice.bestTopicId ? { bestTopicId: choice.bestTopicId } : {}),
  };

  if (choice.chosenTopicId) {
    return {
      ...baseDecision,
      action: 'assigned',
      chosenTopicId: choice.chosenTopicId,
    };
  }

  if (!config.autoCreate) {
    return {
      ...baseDecision,
      action: 'requires_topic',
      reason: 'auto_create_disabled',
    };
  }

  const createRequest = titleHint ? { title: titleHint } : {};
  const created = await getOrCreateSession(client, createRequest);

  return {
    ...baseDecision,
    action: 'created',
    createdTopicId: created.session.id,
  };
}

function buildCandidates(counts: Record<string, number>, limit: number, totalMatches: number): CandidateTopic[] {
  return Object.entries(counts)
    .map(([sessionId, count]) => ({
      sessionId,
      count,
      dominance: totalMatches === 0 ? 0 : count / totalMatches,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.sessionId.localeCompare(b.sessionId);
    })
    .slice(0, limit);
}

function emptyDecision(action: AutoTopicDecision['action'], reason: string): AutoTopicDecision {
  return {
    action,
    reason,
    dominance: 0,
    bestCount: 0,
    totalMatches: 0,
    candidates: [],
  };
}
