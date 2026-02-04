export type WorkspaceSearchMatch = {
  sessionId: string;
};

export type TopicChoice = {
  chosenTopicId: string | undefined;
  dominance: number;
  bestTopicId: string | undefined;
  bestCount: number;
  totalMatches: number;
  counts: Record<string, number>;
};

export function chooseTopicFromMatches(
  matches: WorkspaceSearchMatch[],
  opts: { threshold: number; minHits: number },
): TopicChoice {
  const counts: Record<string, number> = {};

  for (const match of matches) {
    counts[match.sessionId] = (counts[match.sessionId] ?? 0) + 1;
  }

  let bestTopicId: string | undefined;
  let bestCount = 0;

  for (const [sessionId, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      bestTopicId = sessionId;
    }
  }

  const totalMatches = matches.length;
  const dominance = totalMatches === 0 ? 0 : bestCount / totalMatches;

  const chosenTopicId =
    bestTopicId && bestCount >= opts.minHits && dominance >= opts.threshold ? bestTopicId : undefined;

  return { chosenTopicId, dominance, bestTopicId, bestCount, totalMatches, counts };
}

