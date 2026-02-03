import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { HonchoClient } from '../src/honcho/client';
import { LmError } from '../src/cli/errors';

describe('HonchoClient.requestJson', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses JSON responses', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, data: { value: 1 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;

    const client = new HonchoClient({ baseUrl: 'https://api.example.com', apiKey: 'x', workspaceId: 'ws' });
    const result = await client.requestJson<{ ok: boolean; data: { value: number } }>('GET', '/test');
    expect(result.ok).toBe(true);
    expect(result.data.value).toBe(1);
  });

  it('maps JSON error bodies into LmError details', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'nope' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;

    const client = new HonchoClient({ baseUrl: 'https://api.example.com', apiKey: 'x', workspaceId: 'ws' });

    try {
      await client.requestJson('GET', '/test');
      throw new Error('Expected request to fail');
    } catch (err) {
      expect(err).toBeInstanceOf(LmError);
      const lmError = err as LmError;
      expect(lmError.code).toBe('HONCHO_AUTH_FAILED');
      expect(lmError.details).toEqual({ error: 'nope' });
    }
  });

  it('maps non-JSON error bodies into LmError details', async () => {
    globalThis.fetch = (async () =>
      new Response('server down', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      })) as unknown as typeof fetch;

    const client = new HonchoClient({ baseUrl: 'https://api.example.com', apiKey: 'x', workspaceId: 'ws' });

    try {
      await client.requestJson('GET', '/test');
      throw new Error('Expected request to fail');
    } catch (err) {
      expect(err).toBeInstanceOf(LmError);
      const lmError = err as LmError;
      expect(lmError.code).toBe('HONCHO_UNAVAILABLE');
      expect(lmError.details).toBe('server down');
    }
  });
});
