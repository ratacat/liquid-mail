import type {
  HonchoChatRequest,
  HonchoChatResponse,
  HonchoMessageCreateRequest,
  HonchoMessageCreateResponse,
  HonchoSearchRequest,
  HonchoSearchResponse,
  HonchoSessionGetOrCreateRequest,
  HonchoSessionGetOrCreateResponse,
  HonchoSessionListRequest,
  HonchoSessionListResponse,
  HonchoSummaryListResponse,
} from './types';
import { HonchoClient } from './client';

const DEFAULT_SEARCH_LIMIT = 10;

export async function searchWorkspace(
  client: HonchoClient,
  request: HonchoSearchRequest,
): Promise<HonchoSearchResponse> {
  const body = {
    query: request.query,
    limit: request.limit ?? DEFAULT_SEARCH_LIMIT,
    filters: request.filters,
  };
  return await client.requestJson('POST', `/v3/workspaces/${client.workspaceId}/search`, body);
}

export async function getOrCreateSession(
  client: HonchoClient,
  request: HonchoSessionGetOrCreateRequest,
): Promise<HonchoSessionGetOrCreateResponse> {
  const body = {
    session_id: request.session_id,
    title: request.title,
    metadata: request.metadata,
  };
  return await client.requestJson('POST', `/v3/workspaces/${client.workspaceId}/sessions`, body);
}

export async function listSessions(
  client: HonchoClient,
  request: HonchoSessionListRequest = {},
): Promise<HonchoSessionListResponse> {
  const params = new URLSearchParams();
  if (request.limit !== undefined) params.set('limit', String(request.limit));
  if (request.cursor) params.set('cursor', request.cursor);
  const query = params.toString();
  const path = `/v3/workspaces/${client.workspaceId}/sessions/list${query ? `?${query}` : ''}`;
  return await client.requestJson('GET', path);
}

export async function createMessage(
  client: HonchoClient,
  sessionId: string,
  request: HonchoMessageCreateRequest,
): Promise<HonchoMessageCreateResponse> {
  const body = {
    peer_id: request.peer_id,
    content: request.content,
    metadata: request.metadata,
  };
  return await client.requestJson(
    'POST',
    `/v3/workspaces/${client.workspaceId}/sessions/${sessionId}/messages`,
    body,
  );
}

export async function getSessionSummaries(client: HonchoClient, sessionId: string): Promise<HonchoSummaryListResponse> {
  return await client.requestJson(
    'GET',
    `/v3/workspaces/${client.workspaceId}/sessions/${sessionId}/summaries`,
  );
}

export async function chatWithPeer(
  client: HonchoClient,
  peerId: string,
  request: HonchoChatRequest,
): Promise<HonchoChatResponse> {
  const body = {
    messages: request.messages,
    temperature: request.temperature,
    response_format: request.response_format,
  };
  return await client.requestJson('POST', `/v3/workspaces/${client.workspaceId}/peers/${peerId}/chat`, body);
}
