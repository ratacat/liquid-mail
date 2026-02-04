import { describe, expect, it } from 'bun:test';
import type { HonchoClient } from '../src/honcho/client';
import { listSessions } from '../src/honcho/api';

describe('listSessions', () => {
  it('sorts sessions by created_at descending before slicing', async () => {
    const client = {
      workspaceId: 'ws_test',
      honcho: {
        http: {
          post: async () => ({
            items: [
              { id: 's1', created_at: '2026-01-01T00:00:00.000Z', metadata: {} },
              { id: 's2', created_at: '2026-02-01T00:00:00.000Z', metadata: {} },
              { id: 's3', created_at: '2025-12-31T00:00:00.000Z', metadata: {} },
            ],
            page: 1,
            size: 2,
            total: 3,
            pages: 2,
          }),
        },
      },
    } as unknown as HonchoClient;

    const out = await listSessions(client, { limit: 2 });
    expect(out.sessions.map((s) => s.id)).toEqual(['s2', 's1']);
  });
});

