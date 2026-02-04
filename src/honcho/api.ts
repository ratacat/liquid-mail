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
import { randomUUID } from 'node:crypto';

const DEFAULT_SEARCH_LIMIT = 10;

export async function searchWorkspace(
  client: HonchoClient,
  request: HonchoSearchRequest,
): Promise<HonchoSearchResponse> {
  const results = await client.honcho.search(request.query, {
    limit: request.limit ?? DEFAULT_SEARCH_LIMIT,
    filters: request.filters as unknown as Record<string, unknown> | undefined,
  });

  return {
    matches: results.map((message) => ({
      session_id: message.sessionId,
      message_id: message.id,
      peer_id: message.peerId,
      snippet: message.content,
      created_at: message.createdAt,
    })),
  };
}

export async function getOrCreateSession(
  client: HonchoClient,
  request: HonchoSessionGetOrCreateRequest,
): Promise<HonchoSessionGetOrCreateResponse> {
  const sessionId = request.session_id ?? cryptoRandomId();
  const session = await client.honcho.session(sessionId, {
    metadata: (request.metadata as unknown as Record<string, unknown> | undefined) ?? {},
  });
  return {
    session: {
      id: session.id,
      ...(session.metadata ? { metadata: session.metadata as unknown as Record<string, any> } : {}),
    },
  };
}

export async function listSessions(
  client: HonchoClient,
  request: HonchoSessionListRequest = {},
): Promise<HonchoSessionListResponse> {
  const limit = request.limit;
  const pageSize = limit ?? 20;

  const page = await client.honcho.http.post<{ items: any[]; page: number; size: number; total: number; pages: number }>(
    `/v3/workspaces/${client.workspaceId}/sessions/list`,
    {
      body: { filters: undefined },
      query: { page: 1, size: pageSize },
    },
  );

  return {
    sessions: (page.items ?? []).slice(0, pageSize).map((item) => ({
      id: item.id,
      created_at: item.created_at,
      metadata: item.metadata,
    })),
    next: page.page < page.pages ? String(page.page + 1) : null,
  };
}

export async function createMessage(
  client: HonchoClient,
  sessionId: string,
  request: HonchoMessageCreateRequest,
): Promise<HonchoMessageCreateResponse> {
  const session = await client.honcho.session(sessionId);
  const peer = await client.honcho.peer(request.peer_id);
  const [message] = await session.addMessages(
    peer.message(request.content, {
      ...(request.metadata ? { metadata: request.metadata as unknown as Record<string, unknown> } : {}),
    }),
  );

  if (!message) {
    throw new Error('Honcho message creation returned no messages');
  }

  return {
    message: {
      id: message.id,
      session_id: message.sessionId,
      peer_id: message.peerId,
      content: message.content,
      created_at: message.createdAt,
      metadata: message.metadata as any,
    },
  };
}

export async function getSessionSummaries(client: HonchoClient, sessionId: string): Promise<HonchoSummaryListResponse> {
  const session = await client.honcho.session(sessionId);
  const summaries = await session.summaries();

  const out = [];
  if (summaries.shortSummary) {
    out.push({
      session_id: sessionId,
      kind: summaries.shortSummary.summaryType,
      content: summaries.shortSummary.content,
      created_at: summaries.shortSummary.createdAt,
    });
  }
  if (summaries.longSummary) {
    out.push({
      session_id: sessionId,
      kind: summaries.longSummary.summaryType,
      content: summaries.longSummary.content,
      created_at: summaries.longSummary.createdAt,
    });
  }

  return { summaries: out };
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

function cryptoRandomId(): string {
  // Honcho sessions require an id. Prefer a server-agnostic stable format.
  const uuid = randomUUID().replace(/-/g, '');
  return `lm${uuid}`;
}
