import type { HonchoMetadataFilter, HonchoMetadataValue, HonchoSearchFilters } from './types';

export function metadataEq(value: HonchoMetadataValue): HonchoMetadataFilter {
  return { op: 'eq', value };
}

export function metadataIn(values: HonchoMetadataValue[]): HonchoMetadataFilter {
  return { op: 'in', value: values };
}

export function filtersForSession(sessionId: string): HonchoSearchFilters {
  return { session_ids: [sessionId] };
}

export function buildSearchFilters(params: {
  sessionIds?: string[];
  peerIds?: string[];
  metadata?: Record<string, HonchoMetadataFilter>;
  since?: string;
  until?: string;
}): HonchoSearchFilters {
  const filters: HonchoSearchFilters = {};
  if (params.sessionIds) filters.session_ids = params.sessionIds;
  if (params.peerIds) filters.peer_ids = params.peerIds;
  if (params.metadata) filters.metadata = params.metadata;
  if (params.since) filters.since = params.since;
  if (params.until) filters.until = params.until;
  return filters;
}
