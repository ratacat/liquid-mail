import { spawnSync } from 'node:child_process';
import { loadConfig, requireHonchoAuth } from '../src/config/config';
import { HonchoClient } from '../src/honcho/client';
import { getOrCreateSession } from '../src/honcho/api';

function runCli(args: string[]): void {
  const result = spawnSync('bun', ['run', 'src/main.ts', ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`CLI failed: ${args.join(' ')}`);
  }
}

async function run(): Promise<void> {
  const { config } = await loadConfig();
  const auth = requireHonchoAuth(config);
  const client = new HonchoClient(auth);

  const topic = await getOrCreateSession(client, { title: `Demo topic ${new Date().toISOString()}` });
  const topicId = topic.session.id;

  runCli(['post', '--topic', topicId, '--agent-id', 'agent-alpha', '--decision', 'DECISION: Use Postgres for storage.']);

  try {
    runCli(['post', '--topic', topicId, '--agent-id', 'agent-beta', '--decision', 'DECISION: Use SQLite for storage.']);
  } catch (err) {
    console.error('Expected conflict block:', err instanceof Error ? err.message : err);
  }
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
