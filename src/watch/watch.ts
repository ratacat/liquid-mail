import { HonchoClient } from '../honcho/client';
import { listSessionMessages } from '../honcho/api';
import { readState, writeState } from '../state/state';
import { spawnSync } from 'node:child_process';

export type WatchMessage = {
  id: string;
  session_id: string;
  peer_id: string;
  content: string;
  created_at?: string;
};

export type WatchOptions = {
  cwd: string;
  windowId: string;
  topicId: string;
  intervalMs: number;
  once: boolean;
  tail: number;
  notify: boolean;
  output: {
    json: boolean;
    write: (text: string) => void;
  };
};

export async function watchTopic(client: HonchoClient, options: WatchOptions): Promise<void> {
  const { cwd, windowId, topicId, intervalMs, once, tail, notify, output } = options;

  if (tail > 0) {
    const history = await listSessionMessages(client, topicId, { limit: tail });
    const ordered = sortByCreatedAt(history.messages);
    for (const msg of ordered) emitMessage(msg, { notify: false, output });
  }

  // Initialize watch cursor if missing.
  let cursor = await getWatchCursor(cwd, windowId, topicId);
  if (!cursor) {
    cursor = {
      last_seen_at: new Date().toISOString(),
      last_seen_ids: [],
    };
    await setWatchCursor(cwd, windowId, topicId, cursor);
  }

  while (true) {
    const batch = await listSessionMessages(client, topicId, { since: cursor.last_seen_at, limit: 100 });
    const ordered = sortByCreatedAt(batch.messages);
    const fresh = ordered.filter((m) => !isCursorDuplicate(cursor!, m));

    for (const msg of fresh) emitMessage(msg, { notify, output });

    if (fresh.length > 0) {
      cursor = nextCursor(cursor, fresh);
      await setWatchCursor(cwd, windowId, topicId, cursor);
    }

    if (once) return;
    await sleep(intervalMs);
  }
}

type WatchCursor = {
  last_seen_at: string;
  last_seen_ids: string[];
};

async function getWatchCursor(cwd: string, windowId: string, topicId: string): Promise<WatchCursor | undefined> {
  const state = await readState(cwd);
  const entry = state.windows[windowId]?.watch?.topics?.[topicId];
  if (!entry?.last_seen_at) return undefined;
  return { last_seen_at: entry.last_seen_at, last_seen_ids: entry.last_seen_ids ?? [] };
}

async function setWatchCursor(cwd: string, windowId: string, topicId: string, cursor: WatchCursor): Promise<void> {
  const state = await readState(cwd);
  state.windows[windowId] = state.windows[windowId] ?? {};
  state.windows[windowId].watch = state.windows[windowId].watch ?? {};
  state.windows[windowId].watch!.topics = state.windows[windowId].watch!.topics ?? {};
  state.windows[windowId].watch!.topics![topicId] = {
    last_seen_at: cursor.last_seen_at,
    last_seen_ids: cursor.last_seen_ids,
    updated_at: new Date().toISOString(),
  };
  await writeState(cwd, state);
}

function sortByCreatedAt<T extends { created_at?: string }>(messages: T[]): T[] {
  return [...messages].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
}

function isCursorDuplicate(cursor: WatchCursor, message: WatchMessage): boolean {
  if (!message.created_at) return false;
  if (message.created_at !== cursor.last_seen_at) return false;
  return cursor.last_seen_ids.includes(message.id);
}

function nextCursor(cursor: WatchCursor, messages: WatchMessage[]): WatchCursor {
  const maxCreatedAt = messages.reduce((best, m) => (m.created_at && m.created_at > best ? m.created_at : best), cursor.last_seen_at);
  const idsAtMax = messages.filter((m) => m.created_at === maxCreatedAt).map((m) => m.id);
  return {
    last_seen_at: maxCreatedAt,
    last_seen_ids: Array.from(new Set(idsAtMax)).slice(0, 50),
  };
}

function emitMessage(message: WatchMessage, params: { notify: boolean; output: WatchOptions['output'] }): void {
  if (params.output.json) {
    params.output.write(
      JSON.stringify(
        {
          ok: true,
          data: {
            event: 'message',
            message,
          },
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  const created = message.created_at ? ` ${message.created_at}` : '';
  const excerpt = message.content.replaceAll('\n', ' ').slice(0, 160);
  params.output.write(`[${message.session_id}]${created} ${message.peer_id}: ${excerpt}\n`);

  if (params.notify) notifyDesktop(message);
}

function notifyDesktop(message: WatchMessage): void {
  if (process.platform !== 'darwin') return;
  const title = `Liquid Mail: ${message.session_id}`;
  const body = message.content.replaceAll('\n', ' ').slice(0, 160);

  try {
    spawnSync('osascript', ['-e', `display notification ${jsonString(body)} with title ${jsonString(title)}`], {
      stdio: 'ignore',
    });
  } catch {
    // Best-effort only.
  }
}

function jsonString(value: string): string {
  return JSON.stringify(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
