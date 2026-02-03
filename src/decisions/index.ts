import { createHash } from 'node:crypto';
import { HonchoClient } from '../honcho/client';
import { createMessage, searchWorkspace } from '../honcho/api';
import { buildSearchFilters, metadataEq } from '../honcho/filters';

export type DecisionIndexResult = {
  createdIds: string[];
  skipped: boolean;
};

export async function indexDecisions(params: {
  client: HonchoClient;
  sessionId: string;
  systemPeerId: string;
  sourceMessageId: string;
  decisions: string[];
}): Promise<DecisionIndexResult> {
  const { client, sessionId, systemPeerId, sourceMessageId, decisions } = params;

  if (decisions.length === 0) return { createdIds: [], skipped: true };

  const existing = await searchWorkspace(client, {
    query: sourceMessageId,
    limit: 1,
    filters: buildSearchFilters({
      sessionIds: [sessionId],
      metadata: {
        'lm.kind': metadataEq('decision'),
        'lm.source_message_id': metadataEq(sourceMessageId),
      },
    }),
  });

  if (existing.matches.length > 0) {
    return { createdIds: [], skipped: true };
  }

  const createdIds: string[] = [];

  for (const decision of decisions) {
    const decisionId = hashDecision(sourceMessageId, decision);
    const result = await createMessage(client, sessionId, {
      peer_id: systemPeerId,
      content: `DECISION: ${decision}`,
      metadata: {
        'lm.schema_version': '1',
        'lm.kind': 'decision',
        'lm.source_message_id': sourceMessageId,
        'lm.decision_id': decisionId,
      },
    });
    createdIds.push(result.message.id);
  }

  return { createdIds, skipped: false };
}

function hashDecision(sourceMessageId: string, decision: string): string {
  return createHash('sha256').update(`${sourceMessageId}:${decision}`).digest('hex');
}
