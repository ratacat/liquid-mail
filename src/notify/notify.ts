import { HonchoClient } from '../honcho/client';
import { getSessionSummaries, listSessions, searchWorkspace } from '../honcho/api';
import { buildSearchFilters, metadataEq } from '../honcho/filters';

export type NotifyItem = {
  topic_id: string;
  reason: 'decision' | 'summary' | 'mention' | 'event';
  excerpt: string;
  confidence: number;
};

export async function notifyForAgent(params: {
  client: HonchoClient;
  agentId: string;
  since?: string;
  decisionLimit?: number;
  eventLimit?: number;
  mentionLimit?: number;
  sessionLimit?: number;
}): Promise<NotifyItem[]> {
  const { client, agentId, since, decisionLimit = 10, eventLimit = 10, mentionLimit = 10, sessionLimit = 5 } = params;

  const decisionFilterParams: { since?: string; metadata?: Record<string, ReturnType<typeof metadataEq>> } = {
    metadata: { 'lm.kind': metadataEq('decision') },
  };
  if (since) decisionFilterParams.since = since;
  const decisions = await searchWorkspace(client, {
    query: 'decision',
    limit: decisionLimit,
    filters: buildSearchFilters(decisionFilterParams),
  });

  const eventFilterParams: {
    since?: string;
    metadata?: Record<string, ReturnType<typeof metadataEq>>;
  } = {
    metadata: {
      'lm.kind': metadataEq('event'),
      'lm.agent_id': metadataEq(agentId),
    },
  };
  if (since) eventFilterParams.since = since;
  const events = await searchWorkspace(client, {
    query: agentId,
    limit: eventLimit,
    filters: buildSearchFilters(eventFilterParams),
  });

  const mentionFilterParams: { since?: string } = {};
  if (since) mentionFilterParams.since = since;
  const mentions = await searchWorkspace(client, {
    query: agentId,
    limit: mentionLimit,
    filters: buildSearchFilters(mentionFilterParams),
  });

  const sessions = await listSessions(client, { limit: sessionLimit });

  const summaryItems = (
    await Promise.all(
      sessions.sessions.map(async (session): Promise<NotifyItem | undefined> => {
        const summaries = await getSessionSummaries(client, session.id);
        const short = summaries.summaries.find((summary) => summary.kind === 'short') ?? summaries.summaries[0];
        if (!short) return undefined;
        return {
          topic_id: session.id,
          reason: 'summary',
          excerpt: truncate(short.content, 160),
          confidence: 0.5,
        };
      }),
    )
  ).filter((item): item is NotifyItem => item !== undefined);

  const decisionItems: NotifyItem[] = decisions.matches.map((match) => ({
    topic_id: match.session_id,
    reason: 'decision',
    excerpt: truncate(match.snippet ?? 'Decision update', 160),
    confidence: 0.9,
  }));

  const eventItems: NotifyItem[] = events.matches.map((match) => {
    const excerpt = truncate(match.snippet ?? `Event for ${agentId}`, 160);
    return {
      topic_id: match.session_id,
      reason: 'event',
      excerpt,
      confidence: scoreEvent(excerpt),
    };
  });

  const mentionItems: NotifyItem[] = mentions.matches.map((match) => ({
    topic_id: match.session_id,
    reason: 'mention',
    excerpt: truncate(match.snippet ?? `Mentioned ${agentId}`, 160),
    confidence: 0.7,
  }));

  return [...decisionItems, ...eventItems, ...mentionItems, ...summaryItems].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.topic_id !== b.topic_id) return a.topic_id.localeCompare(b.topic_id);
    return a.reason.localeCompare(b.reason);
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function scoreEvent(excerpt: string): number {
  const upper = excerpt.toUpperCase();
  if (upper.includes('ISSUE:')) return 0.95;
  if (upper.includes('FEEDBACK:')) return 0.9;
  if (upper.includes('START:')) return 0.6;
  if (upper.includes('FINISH:')) return 0.75;
  return 0.65;
}
