import { describe, expect, it } from 'bun:test';
import type { HonchoClient } from '../src/honcho/client';
import { sessionExists } from '../src/honcho/api';

describe('sessionExists', () => {
  it('returns true when session id is present in filtered results', async () => {
    const client = {
      workspaceId: 'ws_test',
      honcho: {
        http: {
          post: async (_path: string, opts: any) => {
            const ids = opts?.body?.filters?.session_ids ?? [];
            const want = ids[0];
            return { items: want ? [{ id: want }] : [] };
          },
        },
      },
    } as unknown as HonchoClient;

    expect(await sessionExists(client, 'auth-system')).toBe(true);
  });

  it('returns false when no items match', async () => {
    const client = {
      workspaceId: 'ws_test',
      honcho: { http: { post: async () => ({ items: [] }) } },
    } as unknown as HonchoClient;

    expect(await sessionExists(client, 'missing-topic')).toBe(false);
  });
});

