import { HonchoClient } from '../honcho/client';
import { getSessionSummaries, listSessions, searchWorkspace } from '../honcho/api';
import { buildSearchFilters, metadataEq } from '../honcho/filters';

export type NotifyItem = {
  topic_id: string;
  reason: 'decision' | 'summary' | 'mention';
  excerpt: string;
  confidence: number;
};

export async function notifyForAgent(params: {
  client: HonchoClient;
  agentId: string;
  since?: string;
  decisionLimit?: number;
  mentionLimit?: number;
  sessionLimit?: number;
}): Promise<NotifyItem[]> {
  const { client, agentId, since, decisionLimit = 10, mentionLimit = 10, sessionLimit = 5 } = params;

  const decisionFilterParams: { since?: string; metadata?: Record<string, ReturnType<typeof metadataEq>> } = {
    metadata: { 'lm.kind': metadataEq('decision') },
  };
  if (since) decisionFilterParams.since = since;
  const decisions = await searchWorkspace(client, {
    query: 'decision',
    limit: decisionLimit,
    filters: buildSearchFilters(decisionFilterParams),
  });

  const mentionFilterParams: { since?: string } = {};
  if (since) mentionFilterParams.since = since;
  const mentions = await searchWorkspace(client, {
    query: agentId,
    limit: mentionLimit,
    filters: buildSearchFilters(mentionFilterParams),
  });

  const sessions = await listSessions(client, { limit: sessionLimit });

  const summaryItems: NotifyItem[] = [];
  for (const session of sessions.sessions) {
    const summaries = await getSessionSummaries(client, session.id);
    const short = summaries.summaries.find((summary) => summary.kind === 'short') ?? summaries.summaries[0];
    if (!short) continue;
    summaryItems.push({
      topic_id: session.id,
      reason: 'summary',
      excerpt: truncate(short.content, 160),
      confidence: 0.5,
    });
  }

  const decisionItems: NotifyItem[] = decisions.matches.map((match) => ({
    topic_id: match.session_id,
    reason: 'decision',
    excerpt: truncate(match.snippet ?? 'Decision update', 160),
    confidence: 0.9,
  }));

  const mentionItems: NotifyItem[] = mentions.matches.map((match) => ({
    topic_id: match.session_id,
    reason: 'mention',
    excerpt: truncate(match.snippet ?? `Mentioned ${agentId}`, 160),
    confidence: 0.7,
  }));

  return [...decisionItems, ...mentionItems, ...summaryItems].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.topic_id !== b.topic_id) return a.topic_id.localeCompare(b.topic_id);
    return a.reason.localeCompare(b.reason);
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}
