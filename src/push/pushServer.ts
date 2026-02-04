import { spawnSync } from 'node:child_process';

import type { HonchoClient } from '../honcho/client';
import { createMessage } from '../honcho/api';

export type PushServerOptions = {
  bind: string;
  port: number;
  secret?: string;
  notify: boolean;
  topicId?: string;
  client?: HonchoClient;
  output: {
    json: boolean;
    write: (text: string) => void;
  };
};

export type PushHookPayload = {
  event?: string;
  title?: string;
  body?: string;
  data?: unknown;
};

export async function runPushServer(options: PushServerOptions): Promise<void> {
  const { bind, port, secret, notify, topicId, client, output } = options;

  const server = Bun.serve({
    hostname: bind,
    port,
    fetch: async (req) => {
      const url = new URL(req.url);

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
        return jsonResponse(200, { ok: true, data: { status: 'ok' } });
      }

      if (req.method !== 'POST' || url.pathname !== '/hook') {
        return jsonResponse(404, { ok: false, error: { code: 'NOT_FOUND', message: 'Not found', retryable: false } });
      }

      if (secret) {
        const provided = req.headers.get('x-liquid-mail-secret') ?? '';
        if (provided !== secret) {
          return jsonResponse(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid secret', retryable: false } });
        }
      }

      let payload: PushHookPayload;
      try {
        payload = (await req.json()) as PushHookPayload;
      } catch {
        return jsonResponse(400, { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body', retryable: false } });
      }

      const event = payload.event?.trim() || 'push';
      const title = payload.title?.trim() || `Liquid Mail (${event})`;
      const body = payload.body?.trim() || stringifyCompact(payload.data) || '(no body)';

      if (output.json) {
        output.write(JSON.stringify({ ok: true, data: { event, title, body, payload } }, null, 2) + '\n');
      } else {
        output.write(`[push] ${event}: ${title} — ${truncateOneLine(body, 200)}\n`);
      }

      if (notify) notifyDesktop(title, body);

      const targetTopic = topicId;
      if (targetTopic && client) {
        try {
          await createMessage(client, targetTopic, {
            peer_id: 'liquid-mail',
            content: `[push:${event}] ${title}\n\n${body}`,
            metadata: { 'lm.kind': 'push', 'lm.event': event },
          });
        } catch (err) {
          if (!output.json) output.write(`[push] failed to post to ${targetTopic}: ${err instanceof Error ? err.message : String(err)}\n`);
        }
      }

      return jsonResponse(200, { ok: true, data: { received: true } });
    },
  });

  const url = server.url.toString();
  if (output.json) output.write(JSON.stringify({ ok: true, data: { url, hook: `${url}hook` } }, null, 2) + '\n');
  else {
    output.write(`Push server listening: ${url}\n`);
    output.write(`POST ${url}hook\n`);
    if (secret) output.write('Auth: header x-liquid-mail-secret\n');
  }

  // Keep process alive.
  await new Promise(() => undefined);
}

function truncateOneLine(value: string, maxLen: number): string {
  const line = value.replaceAll('\n', ' ').trim();
  if (line.length <= maxLen) return line;
  return line.slice(0, Math.max(0, maxLen - 1)) + '…';
}

function stringifyCompact(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function jsonResponse(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value, null, 2) + '\n', {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function notifyDesktop(title: string, body: string): void {
  if (process.platform !== 'darwin') return;
  try {
    spawnSync('osascript', ['-e', `display notification ${jsonString(body)} with title ${jsonString(title)}`], { stdio: 'ignore' });
  } catch {
    // Best-effort only.
  }
}

function jsonString(value: string): string {
  return JSON.stringify(value);
}
