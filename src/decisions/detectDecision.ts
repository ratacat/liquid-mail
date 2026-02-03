export type DecisionDetection = {
  isDecision: boolean;
  decisions: string[];
  source: 'flag' | 'marker' | 'heuristic' | 'none';
  reason?: string;
};

export function detectDecision(
  message: string,
  opts: { decisionFlag?: boolean; allowHeuristic?: boolean },
): DecisionDetection {
  const decisions = extractDecisionMarkers(message);

  if (opts.decisionFlag) {
    return {
      isDecision: true,
      decisions,
      source: 'flag',
    };
  }

  if (decisions.length > 0) {
    return {
      isDecision: true,
      decisions,
      source: 'marker',
    };
  }

  if (opts.allowHeuristic) {
    return {
      isDecision: false,
      decisions: [],
      source: 'heuristic',
      reason: 'heuristic_deferred',
    };
  }

  return {
    isDecision: false,
    decisions: [],
    source: 'none',
  };
}

function extractDecisionMarkers(message: string): string[] {
  const lines = message.split(/\r?\n/);
  const matches: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*DECISION:\s*(.+)$/);
    if (match?.[1]) matches.push(match[1].trim());
  }

  return matches;
}
